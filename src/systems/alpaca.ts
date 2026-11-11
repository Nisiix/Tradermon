// Client verso il server di Tradermon (server/index.mjs): l'unico intermediario verso Alpaca.
// Le chiavi Alpaca restano sul server: il browser le invia una volta e non le rilegge mai.
// La base delle chiamate è il server locale ("/api"); un backend diverso (per esempio per il sito
// pubblico) si indica alla compilazione con VITE_API_BASE, senza toccare il resto del gioco.

const API_BASE = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '').replace(/\/$/, '');

export type Env = 'paper' | 'live';

export interface KeyStatus { configured: boolean; keyHint?: string }
export interface ServerStatus { ok: boolean; paper: KeyStatus; live: KeyStatus; liveMaxOrder: number }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    const msg = (data as { message?: string; error?: string })?.message ?? (data as { error?: string })?.error ?? `Errore ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function serverStatus(): Promise<ServerStatus | null> {
  try { return await call<ServerStatus>('/api/status'); } catch { return null; }
}

export function setKeys(env: Env, keyId: string, secret: string) {
  return call<{ ok: boolean; account?: { status: string; currency: string } }>('/api/keys', { method: 'POST', body: JSON.stringify({ env, keyId, secret }) });
}

export function deleteKeys(env: Env) {
  return call<{ ok: boolean }>(`/api/keys/${env}`, { method: 'DELETE' });
}

export interface AlpacaAccount { status: string; currency: string; cash: string; equity: string; buying_power: string; portfolio_value: string; account_number: string; multiplier?: string; created_at?: string; crypto_status?: string }
export interface AlpacaPosition { symbol: string; qty: string; market_value: string; unrealized_pl: string; unrealized_plpc: string; avg_entry_price: string; current_price: string; asset_class: string }
export interface AlpacaOrder { id: string; client_order_id?: string; symbol: string; side: string; type: string; qty: string | null; notional: string | null; status: string; limit_price: string | null; stop_price: string | null; submitted_at: string; filled_avg_price: string | null; filled_qty?: string | null }

export const account = (env: Env) => call<AlpacaAccount>(`/api/alpaca/${env}/account`);
export const positions = (env: Env) => call<AlpacaPosition[]>(`/api/alpaca/${env}/positions`);
export const openOrders = (env: Env) => call<AlpacaOrder[]>(`/api/alpaca/${env}/orders?status=open`);
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

/** Spiegazione unica quando il server locale (e quindi Alpaca) non è raggiungibile. */
export function noServerLines(what: string): string[] {
  return isLocalHost()
    ? [`Per ${what} serve il server locale di Tradermon, che ora non risponde.`, 'Avvialo con "npm start" (oppure "npm run dev"): le istruzioni sono nel file LEGGIMI e nella sezione Guida della pagina iniziale.', ...ACCOUNT_LINES]
    : [`Per ${what} serve un conto Alpaca collegato con le chiavi API, e il server locale che le custodisce: qui online non c'è.`, 'La sezione Guida della pagina iniziale spiega passo per passo come creare il conto (Paper o Live) e avviare il gioco sul tuo computer.', ...ACCOUNT_LINES];
}

/** Perché serve un conto Alpaca: senza chiavi resta il percorso di studio (storia, quiz, biblioteche, Attestati). */
export const ACCOUNT_LINES = [
  'Senza un conto Alpaca collegato (basta il Paper, gratuito e con denaro finto) puoi seguire tutto il percorso di studio e ottenere gli Attestati dei Mentori, ma non i Sigilli pratici, la Lega e le sfide sui grafici e sui titoli reali.',
];

