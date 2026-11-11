// Cassaforte delle chiavi Alpaca: cifratura fatta nel browser, il server vede solo dati illeggibili.
//
// Schema (Web Crypto, nessuna libreria):
//  - chiave dati (DEK): AES-GCM 256 casuale, creata alla registrazione; cifra le chiavi del conto Alpaca Paper.
//  - chiave della password (KEK): PBKDF2-SHA256 (600.000 iterazioni, sale casuale) dalla password del giocatore.
//  - su Supabase va solo la DEK "avvolta" dalla KEK (profiles.crypto) e le chiavi Alpaca cifrate con la DEK.
//    Senza la password nessuno, nemmeno chi amministra il database, può aprirle.
//  - su questo dispositivo la DEK resta in IndexedDB come CryptoKey NON estraibile: il gioco la usa
//    senza richiedere la password a ogni avvio, ma nessuno script può leggerne i byte.

export interface Wrapped { v: 1; salt: string; iter: number; iv: string; key: string }
export interface Sealed { ciphertext: string; iv: string }

export const PBKDF2_ITER = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s);
}
export function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));

async function kek(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

/** Crea una nuova chiave dati e la restituisce avvolta dalla password (da salvare su Supabase) e pronta all'uso. */
export async function createDataKey(password: string, iter = PBKDF2_ITER): Promise<{ wrapped: Wrapped; key: CryptoKey }> {
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const wrapped = await wrapDataKey(dek, password, iter);
  // da qui in poi si usa una copia non estraibile
  const key = await unwrapDataKey(wrapped, password);
  return { wrapped, key };
}

async function wrapDataKey(dek: CryptoKey, password: string, iter: number): Promise<Wrapped> {
  const salt = rand(16), iv = rand(12);
  const k = await kek(password, salt, iter);
  const w = await crypto.subtle.wrapKey('raw', dek, k, { name: 'AES-GCM', iv });
  return { v: 1, salt: b64(salt), iter, iv: b64(iv), key: b64(w) };
}

/** Apre la chiave dati con la password. Lancia un errore se la password è sbagliata (AES-GCM autentica). */
export async function unwrapDataKey(w: Wrapped, password: string): Promise<CryptoKey> {
  const k = await kek(password, unb64(w.salt), w.iter);
  return crypto.subtle.unwrapKey('raw', unb64(w.key), k, { name: 'AES-GCM', iv: unb64(w.iv) }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Riavvolge la chiave dati con una nuova password (cambio password): le chiavi Alpaca cifrate restano valide. */
export async function rewrapDataKey(w: Wrapped, oldPassword: string, newPassword: string): Promise<Wrapped> {
  const k = await kek(oldPassword, unb64(w.salt), w.iter);
  const dek = await crypto.subtle.unwrapKey('raw', unb64(w.key), k, { name: 'AES-GCM', iv: unb64(w.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return wrapDataKey(dek, newPassword, w.iter);
}

export async function seal(key: CryptoKey, data: unknown, aad: string): Promise<Sealed> {
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(data)));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function open<T>(key: CryptoKey, s: Sealed, aad: string): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv), additionalData: enc.encode(aad) }, key, unb64(s.ciphertext));
  return JSON.parse(dec.decode(pt)) as T;
}

// ---------- chiave dati su questo dispositivo (IndexedDB, non estraibile) ----------

const DB = 'tradermon-vault', STORE = 'keys';
function idb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb();
  return new Promise<T>((ok, ko) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => ko(r.error);
  }).finally(() => db.close());
}

let memKey: { user: string; key: CryptoKey } | null = null;

export async function rememberKey(user: string, key: CryptoKey): Promise<void> {
  memKey = { user, key };
  try { await tx('readwrite', (s) => s.put(key, user)); } catch { /* IndexedDB non disponibile: resta in memoria per questa sessione */ }
}
export async function recallKey(user: string): Promise<CryptoKey | null> {
  if (memKey?.user === user) return memKey.key;
  try {
    const k = await tx<CryptoKey | undefined>('readonly', (s) => s.get(user));
    if (k) { memKey = { user, key: k }; return k; }
  } catch { /* niente */ }
  return null;
}
export async function forgetKeys(): Promise<void> {
  memKey = null;
  try { await tx('readwrite', (s) => s.clear()); } catch { /* niente */ }
}
