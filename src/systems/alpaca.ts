// Client verso il conto Alpaca Paper (denaro finto, prezzi veri): Tradermon è un gioco e non usa mai denaro reale.
// Tre strade, con le stesse regole sugli ordini (supabase/functions/alpaca/core.js):
//  - in locale il server sul computer del giocatore (server/index.mjs): custodisce le chiavi Paper, che il
//    browser invia una volta e non rilegge mai;
//  - dal sito pubblico il browser parla DIRETTAMENTE con Alpaca. Le chiavi restano solo sul dispositivo, cifrate
//    (systems/keystore.ts): vengono aperte con la password del giocatore, tenute in memoria per la sessione e
//    inviate soltanto ad Alpaca, su connessione cifrata. Nessun server di Tradermon le vede;
//  - riserva, solo se il giocatore lo sceglie: quando il browser non riesce a raggiungere Alpaca direttamente
//    (il controllo CORS non passa), il giocatore può far passare le chiamate dalla funzione Supabase "alpaca",
//    che non salva le chiavi.
// Gli indirizzi di Alpaca sono fissi nel codice. Un backend diverso si può indicare alla compilazione con
// VITE_API_BASE, senza toccare il resto del gioco.
import * as C from './cloud';
import * as K from './keystore';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase';
import { createCore, validKeys } from '../../supabase/functions/alpaca/core.js';

const API_BASE = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '').replace(/\/$/, '');

/** L'unico conto che il gioco usa: il Paper di Alpaca. */
export type Env = 'paper';

export interface KeyStatus { configured: boolean; keyHint?: string }
/**
 * `direct`: il browser parla direttamente con Alpaca (sito pubblico), le chiavi sono solo sul dispositivo.
 * `cloud`: riserva del sito pubblico, le chiamate passano dalla funzione Supabase.
 */
export interface ServerStatus { ok: boolean; paper: KeyStatus; cloud?: boolean; direct?: boolean }

/** Il browser non raggiunge Alpaca e il giocatore non ha (ancora) scelto il passaggio dal servizio di Tradermon. */
export const DIRECT_BLOCKED = 'Questo browser non riesce a raggiungere Alpaca direttamente: controlla la connessione ed eventuali blocchi di contenuti. In alternativa, dalla voce "Chiavi API" puoi far passare il conto Paper dal servizio di Tradermon.';

const ALPACA = { paper: 'https://paper-api.alpaca.markets/v2', data: 'https://data.alpaca.markets' } as const;

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

// ---------- quale strada: server locale, browser diretto, riserva Supabase ----------

type Mode = 'local' | 'direct' | 'cloud';
let mode: Mode | null = null;

/** Decide una volta per sessione: se la pagina non è servita da un server Tradermon (sito pubblico) il browser chiama Alpaca. */
async function transport(): Promise<Mode> {
  if (mode) return mode;
  if (API_BASE || typeof location === 'undefined' || isLocalHost() || !C.cloudEnabled()) return (mode = 'local');
  try {
    // il gioco aperto da un altro dispositivo della rete di casa ha comunque il suo server alla stessa origine
    const r = await fetch('/api/status');
    const d = (await r.json()) as { ok?: boolean };
    if (r.ok && d?.ok) return (mode = 'local');
  } catch { /* sito statico: nessun server */ }
  return (mode = 'direct');
}

/** Le chiamate Paper stanno passando dalla funzione Supabase? (riserva scelta dal giocatore) */
export function cloudActive(): boolean { return mode === 'cloud'; }

// La riserva non parte mai da sola: le chiavi Paper passano da un servizio di Tradermon solo se il giocatore lo ha
// scelto, su questo dispositivo, dopo aver letto che cosa comporta.
const RELAY_SLOT = 'tradermon.alpaca.relay';
let relay: boolean | null = null;
let blocked = false;
/** Il giocatore ha accettato, su questo dispositivo, di far passare il conto Paper dal servizio di Tradermon? */
export function relayAllowed(): boolean {
  if (relay === null) { try { relay = localStorage.getItem(RELAY_SLOT) === '1'; } catch { relay = false; } }
  return relay;
}
/** Accetta o ritira il passaggio dal servizio di Tradermon (solo Paper). Ritirandolo si torna al collegamento diretto. */
export function allowRelay(on: boolean): void {
  relay = on;
  try { if (on) localStorage.setItem(RELAY_SLOT, '1'); else localStorage.removeItem(RELAY_SLOT); } catch { /* vale per questa sessione */ }
  if (!on && mode === 'cloud') { mode = 'direct'; blocked = false; }
}
/** L'ultima chiamata diretta è stata bloccata prima di arrivare ad Alpaca e la riserva non è attiva. */
export function directBlocked(): boolean { return blocked && mode === 'direct'; }
/** Il browser sta parlando direttamente con Alpaca? (vale dopo la prima chiamata, per esempio serverStatus) */
export function directActive(): boolean { return mode === 'direct'; }

/** Chiavi aperte dalla cassaforte del dispositivo: solo in memoria, per questa sessione. */
const mem: Partial<Record<Env, K.KeyPair>> = {};
const hintOf = (k: K.KeyPair) => `${k.keyId.slice(0, 4)}…${k.keyId.slice(-3)}`;

/** Porta in memoria le chiavi del conto, se sul dispositivo ci sono e la cassaforte è aperta. */
async function recall(env: Env, quiet = false): Promise<void> {
  if (mem[env]) return;
  try { const k = await K.loadKeys(env); if (k) mem[env] = k; } catch (e) {
    if (quiet) return;
    if ((e as Error).message === 'LOCKED') throw new Error(`Le chiavi Paper sono salvate cifrate su questo dispositivo: per usarle serve la password del giocatore. Aprile dalla voce "Chiavi API".`);
    throw e;
  }
}

// ---- browser → Alpaca ----

/** Il browser ha già ricevuto una risposta da Alpaca in questa sessione (quindi il controllo CORS passa). */
let reached = false;
/** Gli ordini partono con Content-Type JSON finché il browser non lo rifiuta; poi come testo semplice. */
let jsonBody = true;

/**
 * Chiamata dal browser ad Alpaca. Le letture non portano Content-Type (Alpaca non lo ammette tra le intestazioni
 * delle chiamate dal browser). Se un invio con Content-Type JSON viene bloccato prima di partire (TypeError) si
 * riprova una volta come testo semplice: l'ordine non può raddoppiare, perché ha un client_order_id unico che
 * Alpaca accetta una volta sola.
 */
async function alpacaFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body != null;
  if (!hasBody) headers.delete('Content-Type');
  else if (!jsonBody) headers.set('Content-Type', 'text/plain');
  const send = () => fetch(url, { ...init, headers, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  try { const r = await send(); reached = true; blocked = false; return r; } catch (e) {
    if (!(hasBody && jsonBody && e instanceof TypeError)) throw e;
    headers.set('Content-Type', 'text/plain');
    const r = await send();
    jsonBody = false; reached = true; blocked = false;
    return r;
  }
}

const core = createCore({
  trading: { paper: ALPACA.paper },
  data: ALPACA.data,
  keysOf: (env) => (env === 'paper' ? mem.paper ?? null : null),
  dataEnv: () => 'paper',
  fetch: alpacaFetch,
});

const UNREACHABLE = 'Il browser non riesce a raggiungere Alpaca: controlla la connessione e riprova. Se usi un blocco di contenuti o una rete aziendale, potrebbe impedire le chiamate verso alpaca.markets.';

async function directCall<T>(path: string, init?: RequestInit): Promise<T> {
  const u = new URL(path, 'https://tradermon.invalid');
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs[0] !== 'api') throw new Error('Endpoint non disponibile');
  const parts = segs.slice(1);
  if (parts[0] === 'alpaca' && parts[1] !== 'paper') throw new Error('Endpoint non disponibile');
  await recall('paper');
  const h = new Headers(init?.headers);
  try {
    const out = await core.handle({
      method: (init?.method ?? 'GET').toUpperCase(), parts, query: u.searchParams,
      header: (n) => h.get(n),
      body: async () => { try { return init?.body ? JSON.parse(String(init.body)) : {}; } catch { throw new Error('Richiesta non valida'); } },
    });
    if (!out) throw new Error('Endpoint non disponibile');
    if (out.status >= 400) throw new Error(out.body?.message ?? `Errore ${out.status}`);
    return out.body as T;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    if (reached) throw new Error(UNREACHABLE);
    // mai una risposta da Alpaca in questa sessione: il browser non può chiamarlo. La riserva vale solo se il
    // giocatore l'ha scelta.
    blocked = true;
    if (!relayAllowed()) throw new Error(DIRECT_BLOCKED);
    mode = 'cloud';
    return cloudCall<T>(path, init);
  }
}

// ---- riserva: funzione Supabase ----

async function cloudCall<T>(path: string, init?: RequestInit): Promise<T> {
  if (path.startsWith('/api/alpaca/') && !path.startsWith('/api/alpaca/paper/')) throw new Error('Endpoint non disponibile');
  const token = await C.accessToken();
  if (!token) throw new Error('Per usare il conto Paper dal sito entra con il tuo giocatore Tradermon (ricarica la pagina).');
  await recall('paper');
  const k = mem.paper;
  if (!k) throw new Error('Le chiavi del conto Alpaca Paper non sono collegate.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/alpaca${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'x-alpaca-key': k.keyId, 'x-alpaca-secret': k.secret, ...(init?.headers ?? {}) },
  });
  return parse<T>(res);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const m = await transport();
  if (m === 'direct') return directCall<T>(path, init);
  if (m === 'cloud') return cloudCall<T>(path, init);
  const res = await fetch(API_BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  return parse<T>(res);
}

export async function serverStatus(): Promise<ServerStatus | null> {
  const m = await transport();
  if (m !== 'local') {
    // dal sito lo stato si legge qui: giocatore collegato e chiavi aperte dalla cassaforte del dispositivo
    if (!(await C.currentPlayer())) return null;
    let open = false;
    try { open = await K.unlocked(); } catch { open = false; }
    if (open) await recall('paper', true);
    const paper: KeyStatus = mem.paper ? { configured: true, keyHint: hintOf(mem.paper) } : { configured: false };
    return m === 'direct' ? { ok: true, direct: true, paper } : { ok: true, cloud: true, paper };
  }
  try { return await call<ServerStatus>('/api/status'); } catch { return null; }
}

/** `stored`: solo dal sito, dice se le chiavi sono state salvate cifrate sul dispositivo (false: cassaforte chiusa). */
type KeysResult = { ok: boolean; account?: { status: string; currency: string }; stored?: boolean; storeError?: string };

export async function setKeys(env: Env, keyId: string, secret: string): Promise<KeysResult> {
  if (env !== 'paper') throw new Error('Il gioco collega solo il conto Alpaca Paper.');
  if ((await transport()) !== 'local') {
    // solo caratteri che possono stare in un'intestazione: una chiave incollata male non deve sembrare un blocco di rete
    if (!validKeys(keyId, secret) || !/^[\x21-\x7e]+$/.test(secret)) throw new Error('Chiavi non valide');
    // la verifica è una lettura del conto fatta con le chiavi nuove; se Alpaca le rifiuta tornano quelle di prima
    const prev = mem[env];
    mem[env] = { keyId, secret };
    try {
      const acc = await call<{ status: string; currency: string }>(`/api/alpaca/${env}/account`);
      return { ok: true, account: { status: acc.status, currency: acc.currency }, ...(await persistKeys(env)) };
    } catch (e) {
      if (prev) mem[env] = prev; else delete mem[env];
      const msg = (e as Error).message;
      throw new Error(msg === UNREACHABLE || msg === DIRECT_BLOCKED ? msg : `Alpaca ha rifiutato le chiavi Paper: ${msg}`);
    }
  }
  return call<KeysResult>('/api/keys', { method: 'POST', body: JSON.stringify({ env, keyId, secret }) });
}

/**
 * Dal sito: salva sul dispositivo, cifrate, le chiavi già verificate in questa sessione. `stored: false` quando la
 * cassaforte è chiusa (serve la password del giocatore) o il browser non permette di salvare: le chiavi valgono
 * allora solo finché la pagina resta aperta.
 */
export async function persistKeys(env: Env): Promise<{ stored: boolean; storeError?: string }> {
  const k = mem[env];
  if (!k) return { stored: false };
  try { await K.storeKeys(env, k); return { stored: true }; }
  catch (e) { const m = (e as Error).message; return m === 'LOCKED' ? { stored: false } : { stored: false, storeError: m }; }
}

/** Dal sito: conti con chiavi salvate su questo dispositivo ma non ancora aperte (serve la password del giocatore). */
export async function lockedKeys(): Promise<Env[]> {
  if ((await transport()) === 'local') return [];
  try { return (await K.keyEnvs()).filter((e) => !mem[e]); } catch { return []; }
}

export async function deleteKeys(env: Env): Promise<{ ok: boolean }> {
  if ((await transport()) !== 'local') { delete mem[env]; await K.removeKeys(env); return { ok: true }; }
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

export function submitOrder(env: Env, o: OrderReq, margin = false) {
  const headers: Record<string, string> = {};
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
    : [`Per ${what} serve un conto Alpaca collegato con le chiavi API. Dal sito le chiavi restano cifrate su questo dispositivo e si aprono con la password del tuo giocatore: ricarica la pagina ed entra con nome e password.`, 'La sezione Guida della pagina iniziale spiega passo per passo come creare il conto e collegare le chiavi.', ...ACCOUNT_LINES];
}

/** Perché serve un conto Alpaca: senza chiavi resta il percorso di studio (storia, quiz, biblioteche, Attestati). */
export const ACCOUNT_LINES = [
  'Senza un conto Alpaca collegato (basta il Paper, gratuito e con denaro finto) puoi seguire tutto il percorso di studio e ottenere gli Attestati dei Mentori, ma non i Sigilli pratici, la Lega e le sfide sui grafici e sui titoli reali.',
];

