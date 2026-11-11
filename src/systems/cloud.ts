// Account del giocatore e dati su Supabase: nome univoco + password, salvataggio, chiavi Alpaca cifrate.
// Nel browser c'è solo la chiave pubblica del progetto: ognuno legge e scrive soltanto le proprie righe (RLS).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase';
import { createDataKey, unwrapDataKey, rememberKey, recallKey, forgetKeys, seal, open, type Wrapped } from './vault';

export type KeyEnv = 'paper';
export interface Player { id: string; name: string }
export interface CloudSave { data: Record<string, unknown>; playMs: number; updatedAt: string }

export const NAME_MIN = 3, NAME_MAX = 15, PASSWORD_MIN = 8, PASSWORD_MAX = 72;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]*$/;
/** Dominio riservato (RFC 2606): l'indirizzo interno del giocatore non è un'email vera e non riceve posta. */
const MAIL_DOMAIN = 'giocatori.tradermon.invalid';

export function cloudEnabled(): boolean { return !!SUPABASE_URL && !!SUPABASE_KEY; }

let sb: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!sb) sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tradermon.auth' } });
  return sb;
}

export function normName(s: string): string { return s.normalize('NFC').trim().replace(/\s+/g, ' '); }
/** Stessa regola della funzione Edge e del vincolo nel database. */
export function nameProblem(raw: string): string | null {
  const n = normName(raw);
  if (n.length < NAME_MIN || n.length > NAME_MAX) return `Il nome deve avere da ${NAME_MIN} a ${NAME_MAX} caratteri.`;
  if (!NAME_RE.test(n)) return 'Usa solo lettere, numeri, spazio, punto, trattino e trattino basso (e inizia con una lettera o un numero).';
  return null;
}
export function passwordProblem(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `La password deve avere almeno ${PASSWORD_MIN} caratteri.`;
  if (p.length > PASSWORD_MAX) return `La password può avere al massimo ${PASSWORD_MAX} caratteri.`;
  return null;
}
/** Nome → indirizzo interno: esadecimale del nome in minuscolo (lo stesso calcolo è nel trigger SQL). */
export function nameEmail(name: string): string {
  const hex = [...new TextEncoder().encode(normName(name).toLowerCase())].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `g${hex}@${MAIL_DOMAIN}`;
}

const netMsg = (e: unknown) => (e instanceof TypeError || /fetch|network/i.test(String((e as Error)?.message)) ? 'Il servizio dei salvataggi non è raggiungibile: controlla la connessione e riprova.' : null);

/** Giocatore della sessione salvata su questo dispositivo (nessuna richiesta di rete). */
export async function currentPlayer(): Promise<Player | null> {
  if (!cloudEnabled()) return null;
  try {
    const { data } = await client().auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, name: String(u.user_metadata?.name ?? '') } : null;
  } catch { return null; }
}

/** Token della sessione del giocatore, per le chiamate alla funzione Supabase che parla con Alpaca (null se non collegato). */
export async function accessToken(): Promise<string | null> {
  if (!cloudEnabled()) return null;
  try { return (await client().auth.getSession()).data.session?.access_token ?? null; } catch { return null; }
}

export async function isNameFree(name: string): Promise<boolean> {
  const { data, error } = await client().rpc('nome_disponibile', { n: normName(name) });
  if (error) throw new Error(netMsg(error) ?? 'Non riesco a controllare il nome, riprova tra poco.');
  return !!data;
}

/** Crea il giocatore (funzione Edge: nome univoco) ed entra subito. */
export async function register(name: string, password: string): Promise<Player> {
  const n = normName(name);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/registra-giocatore`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify({ name: n, password }) });
  } catch (e) { throw new Error(netMsg(e) ?? 'Registrazione non riuscita.'); }
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Registrazione non riuscita (${res.status}).`);
  return login(n, password);
}

/** Entra con nome e password e apre la cassaforte delle chiavi su questo dispositivo. */
export async function login(name: string, password: string): Promise<Player> {
  const { data, error } = await client().auth.signInWithPassword({ email: nameEmail(name), password });
  if (error || !data.user) {
    if (error && netMsg(error)) throw new Error(netMsg(error)!);
    throw new Error('Nome o password non corretti.');
  }
  const p = { id: data.user.id, name: String(data.user.user_metadata?.name ?? normName(name)) };
  await openVault(p.id, password);
  return p;
}

export async function logout(): Promise<void> {
  try { await client().auth.signOut({ scope: 'local' }); } catch { /* sessione già scaduta */ }
  await forgetKeys();
}

/**
 * Cancella il giocatore da Supabase (profilo, salvataggio, vecchie copie delle chiavi) e libera il nome.
 * Chiede la password: si rientra subito, così la funzione riceve una sessione appena aperta.
 */
export async function deletePlayer(password: string): Promise<void> {
  const p = await currentPlayer();
  if (!p) throw new Error('Nessun giocatore collegato.');
  await login(p.name, password);
  const token = await accessToken();
  if (!token) throw new Error('Sessione non valida: rientra e riprova.');
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/elimina-giocatore`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY } });
  } catch (e) { throw new Error(netMsg(e) ?? 'Cancellazione non riuscita.'); }
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Cancellazione non riuscita (${res.status}).`);
  await logout();
}

// ---------- cassaforte (chiave dati per le chiavi Alpaca) ----------

async function readWrapped(user: string): Promise<Wrapped | null> {
  const { data, error } = await client().from('profiles').select('crypto').eq('id', user).maybeSingle();
  if (error) throw new Error(netMsg(error) ?? 'Profilo non leggibile.');
  return (data?.crypto as Wrapped | null) ?? null;
}

async function openVault(user: string, password: string): Promise<CryptoKey> {
  const w = await readWrapped(user);
  if (w) {
    const key = await unwrapDataKey(w, password);
    await rememberKey(user, key);
    return key;
  }
  const { wrapped, key } = await createDataKey(password);
  const { error } = await client().from('profiles').update({ crypto: wrapped }).eq('id', user);
  if (error) throw new Error('Non riesco a preparare la cassaforte delle chiavi.');
  await rememberKey(user, key);
  return key;
}

/** La chiave dati è disponibile su questo dispositivo? (altrimenti serve la password per sbloccarla) */
export async function vaultUnlocked(): Promise<boolean> {
  const p = await currentPlayer();
  return !!p && !!(await recallKey(p.id));
}

/** Sblocca la cassaforte con la password (per esempio dopo che il browser ha cancellato i dati del sito). */
export async function unlockVault(password: string): Promise<void> {
  const p = await currentPlayer();
  if (!p) throw new Error('Nessun giocatore collegato.');
  try { await openVault(p.id, password); } catch (e) {
    if (e instanceof DOMException || (e as Error).name === 'OperationError') throw new Error('Password non corretta.');
    throw e;
  }
}

/** Chiave della cassaforte del giocatore collegato (per cifrare ciò che resta sul dispositivo). Lancia 'LOCKED' se serve la password. */
export function vaultKey(): Promise<{ user: string; key: CryptoKey }> { return dataKey(); }

async function dataKey(): Promise<{ user: string; key: CryptoKey }> {
  const p = await currentPlayer();
  if (!p) throw new Error('Nessun giocatore collegato.');
  const key = await recallKey(p.id);
  if (!key) throw new Error('LOCKED');
  return { user: p.id, key };
}

// ---------- salvataggio ----------

export async function fetchSave(): Promise<CloudSave | null> {
  const { data, error } = await client().from('saves').select('data, play_ms, updated_at').maybeSingle();
  if (error) throw new Error(netMsg(error) ?? error.message);
  return data ? { data: data.data as Record<string, unknown>, playMs: Number(data.play_ms) || 0, updatedAt: String(data.updated_at) } : null;
}

export async function pushSave(user: string, s: { version: number; playMs: number; badges: number; map: string }): Promise<void> {
  const { error } = await client().from('saves').upsert({ user_id: user, data: s, version: s.version, play_ms: Math.floor(s.playMs || 0), badges: s.badges | 0, map: s.map });
  if (error) throw new Error(netMsg(error) ?? error.message);
}

export async function pushPlayTime(ms: number, createdAt: number): Promise<void> {
  const { error } = await client().rpc('salva_tempo', { ms: Math.floor(ms), created: createdAt });
  if (error) throw new Error(error.message);
}

export async function deleteSave(): Promise<void> {
  const p = await currentPlayer();
  if (!p) return;
  await client().from('saves').delete().eq('user_id', p.id);
}

// ---------- vecchie copie cifrate delle chiavi Alpaca su Supabase ----------
// Le chiavi ora restano solo sul dispositivo (systems/keystore.ts). Queste funzioni servono a portare lì le copie
// salvate in passato e a cancellarle da Supabase: il gioco non ne scrive più di nuove.

export interface AlpacaKeyPair { keyId: string; secret: string }
/** Il dato cifrato è legato a giocatore e conto: una riga copiata su un altro conto non si apre. */
const aad = (user: string, env: KeyEnv) => `tradermon:alpaca:${user}:${env}`;

export async function loadAlpacaKeys(env: KeyEnv): Promise<AlpacaKeyPair | null> {
  const { user, key } = await dataKey();
  const { data, error } = await client().from('alpaca_keys').select('ciphertext, iv').eq('env', env).maybeSingle();
  if (error) throw new Error(netMsg(error) ?? error.message);
  if (!data) return null;
  return open<AlpacaKeyPair>(key, { ciphertext: data.ciphertext, iv: data.iv }, aad(user, env));
}

/** Quali conti hanno chiavi salvate (senza aprirle). */
export async function savedKeyEnvs(): Promise<KeyEnv[]> {
  if (!(await currentPlayer())) return [];
  const { data, error } = await client().from('alpaca_keys').select('env').eq('env', 'paper');
  if (error) return [];
  return (data ?? []).map(() => 'paper' as const);
}

export async function removeAlpacaKeys(env: KeyEnv): Promise<void> {
  const { error } = await client().from('alpaca_keys').delete().eq('env', env);
  if (error) throw new Error(netMsg(error) ?? error.message);
}
