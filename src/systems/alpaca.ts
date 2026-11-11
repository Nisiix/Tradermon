// Client verso l'intermediario di Tradermon, l'unico che parla con Alpaca. Sono due, con le stesse regole:
//  - in locale il server sul computer del giocatore (server/index.mjs): custodisce le chiavi Paper e Live, che il
//    browser invia una volta e non rilegge mai;
//  - dal sito pubblico la funzione Supabase "alpaca" (supabase/functions/alpaca): solo conto Paper. Lì le chiavi
//    non sono salvate: il browser apre la copia cifrata del giocatore (cassaforte, systems/vault.ts), la tiene in
//    memoria per la sessione e la manda a ogni richiesta su connessione cifrata. Il conto reale non passa mai dal sito.
// Un backend diverso si può indicare alla compilazione con VITE_API_BASE, senza toccare il resto del gioco.
import * as C from './cloud';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase';

const API_BASE = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '').replace(/\/$/, '');

export type Env = 'paper' | 'live';

export interface KeyStatus { configured: boolean; keyHint?: string }
/** `cloud`: le chiamate passano dalla funzione Supabase (sito pubblico), dove esiste solo il conto Paper. */
export interface ServerStatus { ok: boolean; paper: KeyStatus; live: KeyStatus; liveMaxOrder: number; cloud?: boolean }

export const LIVE_LOCAL_ONLY = 'Il conto reale non passa mai dal sito: si usa solo giocando sul tuo computer, dove le chiavi Live restano sul server locale.';

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    const msg = (data as { message?: string; error?: string })?.message ?? (data as { error?: string })?.error ?? `Errore ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// ---------- quale intermediario: server locale o funzione Supabase ----------

let mode: 'local' | 'cloud' | null = null;

/** Decide una volta per sessione: se la pagina non è servita da un server Tradermon (sito pubblico) si passa da Supabase. */
async function transport(): Promise<'local' | 'cloud'> {
  if (mode) return mode;
  if (API_BASE || typeof location === 'undefined' || isLocalHost() || !C.cloudEnabled()) return (mode = 'local');
  try {
    // il gioco aperto da un altro dispositivo della rete di casa ha comunque il suo server alla stessa origine
    const r = await fetch('/api/status');
    const d = (await r.json()) as { ok?: boolean };
    if (r.ok && d?.ok) return (mode = 'local');
  } catch { /* sito statico: nessun server */ }
  return (mode = 'cloud');
}

/** Le chiamate stanno passando dalla funzione Supabase? (vale dopo la prima chiamata, per esempio serverStatus) */
export function cloudActive(): boolean { return mode === 'cloud'; }

/** Chiavi Paper aperte dalla cassaforte: solo in memoria, per questa sessione. Mai in localStorage. */
let paperKeys: C.AlpacaKeyPair | null = null;
const hintOf = (k: C.AlpacaKeyPair) => `${k.keyId.slice(0, 4)}…${k.keyId.slice(-3)}`;

async function cloudCall<T>(path: string, init?: RequestInit): Promise<T> {
  if (path.startsWith('/api/alpaca/live/') || path === '/api/keys/live') throw new Error(LIVE_LOCAL_ONLY);
  const token = await C.accessToken();
  if (!token) throw new Error('Per usare il conto Paper dal sito entra con il tuo giocatore Tradermon (ricarica la pagina).');
  if (!paperKeys) {
    try { paperKeys = await C.loadAlpacaKeys('paper'); } catch (e) {
      if ((e as Error).message === 'LOCKED') throw new Error('Le chiavi Paper sono salvate cifrate: per usarle su questo dispositivo serve la password del giocatore. Aprile dalla voce "Chiavi API".');
      throw e;
    }
  }
  if (!paperKeys) throw new Error('Le chiavi del conto Alpaca Paper non sono collegate.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/alpaca${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'x-alpaca-key': paperKeys.keyId, 'x-alpaca-secret': paperKeys.secret, ...(init?.headers ?? {}) },
  });
  return parse<T>(res);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if ((await transport()) === 'cloud') return cloudCall<T>(path, init);
  const res = await fetch(API_BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  return parse<T>(res);
}

export async function serverStatus(): Promise<ServerStatus | null> {
  if ((await transport()) === 'cloud') {
    // dal sito lo stato si legge qui: giocatore collegato e chiavi Paper aperte dalla cassaforte
    if (!(await C.currentPlayer())) return null;
    if (!paperKeys) { try { if (await C.vaultUnlocked()) paperKeys = await C.loadAlpacaKeys('paper'); } catch { /* rete assente o cassaforte chiusa */ } }
    return { ok: true, cloud: true, paper: paperKeys ? { configured: true, keyHint: hintOf(paperKeys) } : { configured: false }, live: { configured: false }, liveMaxOrder: 0 };
  }
  try { return await call<ServerStatus>('/api/status'); } catch { return null; }
}

type KeysResult = { ok: boolean; account?: { status: string; currency: string } };

export async function setKeys(env: Env, keyId: string, secret: string): Promise<KeysResult> {
  if ((await transport()) === 'cloud') {
    if (env === 'live') throw new Error(LIVE_LOCAL_ONLY);
    if (!/^[A-Z0-9]{10,40}$/i.test(keyId) || secret.length < 20 || secret.length > 120) throw new Error('Chiavi non valide');
    // la funzione le verifica con Alpaca e non le salva: restano in memoria qui, e cifrate su Supabase (cassaforte)
    const prev = paperKeys;
    paperKeys = { keyId, secret };
    try { return await cloudCall<KeysResult>('/api/keys', { method: 'POST', body: JSON.stringify({ env }) }); }
    catch (e) { paperKeys = prev; throw e; }
  }
  return call<KeysResult>('/api/keys', { method: 'POST', body: JSON.stringify({ env, keyId, secret }) });
}

export async function deleteKeys(env: Env): Promise<{ ok: boolean }> {
  if ((await transport()) === 'cloud') { if (env === 'paper') paperKeys = null; return { ok: true }; }
  return call<{ ok: boolean }>(`/api/keys/${env}`, { method: 'DELETE' });
}

export interface AlpacaAccount { status: string; currency: string; cash: string; equity: string; buying_power: string; portfolio_value: string; account_number: string; multiplier?: string; created_at?: string; crypto_status?: string }
export interface AlpacaPosition { symbol: string; qty: string; market_value: string; unrealized_pl: string; unrealized_plpc: string; avg_entry_price: string; current_price: string; asset_class: string }
export interface AlpacaOrder { id: string; client_order_id?: string; symbol: string; side: string; type: string; qty: string | null; notional: string | null; status: string; limit_price: string | null; stop_price: string | null; submitted_at: string; filled_at?: string | null; filled_avg_price: string | null; filled_qty?: string | null }

export const account = (env: Env) => call<AlpacaAccount>(`/api/alpaca/${env}/account`);
export const positions = (env: Env) => call<AlpacaPosition[]>(`/api/alpaca/${env}/positions`);
export const openOrders = (env: Env) => call<AlpacaOrder[]>(`/api/alpaca/${env}/orders?status=open`);
/** Ultimi ordini chiusi (eseguiti, annullati, scaduti): servono a leggere il prezzo vero delle vendite fatte fuori dal gioco. */
export const closedOrders = (env: Env) => call<AlpacaOrder[]>(`/api/alpaca/${env}/orders?status=closed`);
export const clock = (env: Env) => call<{ is_open: boolean; next_open: string; next_close: string }>(`/api/alpaca/${env}/clock`);
export const asset = (env: Env, symbol: string) => call<{ symbol: string; class: string; tradable: boolean; fractionable: boolean; name: string; min_order_size?: string; min_trade_increment?: string; price_increment?: string }>(`/api/alpaca/${env}/assets/${encodeURIComponent(symbol)}`);
export const cancelOrder = (env: Env, id: string) => call<unknown>(`/api/alpaca/${env}/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });

export interface OrderReq { symbol: string; side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop' | 'stop_limit'; notional?: string; qty?: string; limit_price?: string; stop_price?: string; time_in_force: 'day' | 'gtc' | 'ioc'; client_order_id: string }

export function submitOrder(env: Env, o: OrderReq, confirmWord?: string, margin = false) {
  const headers: Record<string, string> = {};
  if (confirmWord) headers['x-tradermon-confirm'] = confirmWord;
  // leva: il server confronta l'ordine con il potere d'acquisto di Alpaca invece che con la liquidità
  if (margin) headers['x-tradermon-margin'] = '1';
  return call<AlpacaOrder>(`/api/alpaca/${env}/orders`, { method: 'POST', body: JSON.stringify(o), headers });
}

/** Stato aggiornato di un ordine già inviato (esecuzioni, scadenza, annullamento). */
export const order = (env: Env, id: string) => call<AlpacaOrder>(`/api/alpaca/${env}/orders/${encodeURIComponent(id)}`);

/** Chiusure giornaliere reali di più simboli insieme (azioni, ETF e cripto), tra due date. */
export function daily(symbols: string[], start: string, end: string) {
  return call<{ bars: Record<string, Bar[]> }>(`/api/data/daily?symbols=${encodeURIComponent(symbols.join(','))}&start=${start}&end=${end}`);
}

/** Ultimo prezzo scambiato di più simboli insieme. */
export function snapshot(symbols: string[]) {
  return call<{ prices: Record<string, number> }>(`/api/data/snapshot?symbols=${encodeURIComponent(symbols.join(','))}`);
}

export interface Bar { t: string; o: number; h: number; l: number; c: number; v: number }
export type BarTimeframe = '5Min' | '15Min' | '1Hour' | '4Hour' | '1Day';
export function bars(symbol: string, cls: 'stocks' | 'crypto', start: string, end: string, timeframe: BarTimeframe = '1Day') {
  return call<{ bars: Bar[] }>(`/api/data/bars?symbol=${encodeURIComponent(symbol)}&class=${cls}&start=${start}&end=${end}&timeframe=${timeframe}`);
}
export function latest(symbol: string, cls: 'stocks' | 'crypto') {
  return call<{ price: number }>(`/api/data/latest?symbol=${encodeURIComponent(symbol)}&class=${cls}`);
}

export const ALPACA_DASHBOARD = 'https://app.alpaca.markets/';
export const ALPACA_SIGNUP = 'https://alpaca.markets/';

/** Il gioco gira sul computer del giocatore (server locale) oppure è la versione online senza server? */
export function isLocalHost(): boolean {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname); } catch { return false; }
}

/** Spiegazione unica quando l'intermediario verso Alpaca non è raggiungibile. */
export function noServerLines(what: string): string[] {
  return isLocalHost()
    ? [`Per ${what} serve il server locale di Tradermon, che ora non risponde.`, 'Avvialo con "npm start" (oppure "npm run dev"): le istruzioni sono nel file LEGGIMI e nella sezione Guida della pagina iniziale.', ...ACCOUNT_LINES]
    : [`Per ${what} serve un conto Alpaca Paper collegato con le chiavi API. Dal sito il collegamento passa da Supabase e richiede di essere entrati con il proprio giocatore: ricarica la pagina ed entra con nome e password.`, 'La sezione Guida della pagina iniziale spiega passo per passo come creare il conto e collegare le chiavi. Il conto reale si usa solo giocando sul proprio computer.', ...ACCOUNT_LINES];
}

/** Perché serve un conto Alpaca: senza chiavi resta il percorso di studio (storia, quiz, biblioteche, Attestati). */
export const ACCOUNT_LINES = [
  'Senza un conto Alpaca collegato (basta il Paper, gratuito e con denaro finto) puoi seguire tutto il percorso di studio e ottenere gli Attestati dei Mentori, ma non i Sigilli pratici, la Lega e le sfide sui grafici e sui titoli reali.',
];

