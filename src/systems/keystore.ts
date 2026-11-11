// Chiavi Alpaca (Paper e Live) tenute SOLO su questo dispositivo.
//
// Dove stanno: nella memoria locale del browser (localStorage), cifrate con AES-GCM dalla chiave della cassaforte
// del giocatore. Quella chiave nasce dalla password, vive nel browser in forma non estraibile (systems/vault.ts) e
// non lascia mai il dispositivo: chi copiasse i dati salvati qui non potrebbe aprirli.
// Dove NON stanno: su Supabase, nel salvataggio della partita, in un server di Tradermon.
// Conseguenze per il giocatore (dette nell'avviso prima dell'inserimento): su un altro dispositivo le chiavi vanno
// inserite di nuovo, e cancellando i dati del sito si perdono (si rigenerano dal sito di Alpaca).
import * as C from './cloud';
import { seal, open, type Sealed } from './vault';

export type KeyEnv = 'paper' | 'live';
export interface KeyPair { keyId: string; secret: string }

const ENVS: KeyEnv[] = ['paper', 'live'];
const slot = (user: string, env: KeyEnv) => `tradermon.alpaca.${user}.${env}`;
/** Il dato cifrato è legato a giocatore e conto: una copia spostata su un altro conto non si apre. */
const aad = (user: string, env: KeyEnv) => `tradermon:alpaca:${user}:${env}`;

function read(user: string, env: KeyEnv): Sealed | null {
  try {
    const raw = localStorage.getItem(slot(user, env));
    const s = raw ? (JSON.parse(raw) as Sealed) : null;
    return s && typeof s.ciphertext === 'string' && typeof s.iv === 'string' ? s : null;
  } catch { return null; }
}

/** La cassaforte è aperta su questo dispositivo? (altrimenti serve la password del giocatore) */
export function unlocked(): Promise<boolean> { return C.vaultUnlocked(); }

/** Salva le chiavi cifrate su questo dispositivo. Lancia 'LOCKED' se la cassaforte è chiusa. */
export async function storeKeys(env: KeyEnv, k: KeyPair): Promise<void> {
  const { user, key } = await C.vaultKey();
  const s = await seal(key, { keyId: k.keyId, secret: k.secret }, aad(user, env));
  try { localStorage.setItem(slot(user, env), JSON.stringify(s)); }
  catch { throw new Error('Il browser non permette di salvare dati per questo sito: le chiavi valgono solo finché la pagina resta aperta.'); }
}

/** Apre le chiavi salvate su questo dispositivo (null se non ce ne sono). Lancia 'LOCKED' se la cassaforte è chiusa. */
export async function loadKeys(env: KeyEnv): Promise<KeyPair | null> {
  const p = await C.currentPlayer();
  if (!p) return null;
  const s = read(p.id, env);
  if (!s) return null;
  const { user, key } = await C.vaultKey();
  return open<KeyPair>(key, s, aad(user, env));
}

/** Quali conti hanno chiavi salvate su questo dispositivo (senza aprirle). */
export async function keyEnvs(): Promise<KeyEnv[]> {
  const p = await C.currentPlayer();
  return p ? ENVS.filter((e) => read(p.id, e)) : [];
}

export async function removeKeys(env: KeyEnv): Promise<void> {
  const p = await C.currentPlayer();
  if (!p) return;
  try { localStorage.removeItem(slot(p.id, env)); } catch { /* niente da cancellare */ }
}

/**
 * Le versioni precedenti tenevano una copia cifrata delle chiavi su Supabase. Qui viene portata sul dispositivo
 * (se manca) e poi cancellata da Supabase. Restituisce i conti spostati. Serve la cassaforte aperta.
 * `only` limita i conti: le chiavi Live si spostano su un dispositivo solo dopo che il giocatore ha letto l'avviso.
 */
export async function migrateFromCloud(only: KeyEnv[] = ENVS): Promise<KeyEnv[]> {
  const moved: KeyEnv[] = [];
  for (const env of (await C.savedKeyEnvs()).filter((e) => only.includes(e))) {
    const p = await C.currentPlayer();
    if (!p) break;
    if (!read(p.id, env)) {
      const k = await C.loadAlpacaKeys(env);
      if (k) { await storeKeys(env, k); moved.push(env); }
    }
    await C.removeAlpacaKeys(env);
  }
  return moved;
}
