// Tradermon: intermediario verso Alpaca per chi gioca dal sito pubblico (senza server locale).
//
// Che cosa fa: riceve dal gioco le stesse chiamate "/api/..." del server locale e le inoltra ad Alpaca, con le
// stesse regole (core.js): elenco chiuso di endpoint, niente vendite allo scoperto, acquisti entro la liquidità.
//
// Sicurezza:
//  - SOLO conto Paper (denaro finto): l'indirizzo del conto reale non è nemmeno configurato. Il conto reale si
//    usa soltanto giocando sul proprio computer, dove le chiavi Live restano sul server locale;
//  - serve un giocatore Tradermon collegato (token di sessione Supabase, verificato a ogni richiesta);
//  - le chiavi Paper NON sono salvate qui: arrivano a ogni richiesta nelle intestazioni x-alpaca-key e
//    x-alpaca-secret (su Supabase resta solo la copia cifrata nel browser con la password del giocatore),
//    vivono in memoria per la durata della richiesta e non finiscono mai nei log né nelle risposte;
//  - gli indirizzi di Alpaca sono fissi nel codice: nessun parametro della richiesta può cambiarli.
// @ts-ignore: file JavaScript condiviso con il server locale
import { createCore, validKeys } from './core.js';

// deno-lint-ignore no-explicit-any
declare const Deno: any;

export interface Deps {
  /** API di trading del conto Paper e API dei dati di mercato. */
  trading: string;
  data: string;
  /** Restituisce l'id del giocatore se il token di sessione è valido, altrimenti null. */
  verifyUser: (token: string, apikey: string) => Promise<string | null>;
  /** Registro degli ordini nei log della funzione (mai le chiavi). */
  log: (entry: Record<string, unknown>) => void;
  limitPerMinute?: number;
}

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alpaca-key, x-alpaca-secret, x-tradermon-margin',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

const LIVE_LOCAL_ONLY = 'Il conto reale non passa mai dal sito: si usa solo giocando sul tuo computer, dove le chiavi Live restano sul server locale.';
const MAX_BODY = 64 * 1024;

// Limite di richieste per giocatore (al minuto). Vive nella memoria dell'istanza: frena gli abusi, non è un contatore esatto.
const hits = new Map<string, { n: number; t: number }>();
function tooMany(user: string, max: number, now = Date.now()): boolean {
  const h = hits.get(user);
  if (!h || now - h.t >= 60_000) {
    if (hits.size > 5000) hits.clear();
    hits.set(user, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > max;
}

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    const segs = url.pathname.split('/').filter(Boolean);
    const at = segs.indexOf('api');
    if (at < 0) return reply(404, { message: 'Endpoint non disponibile' });
    const parts = segs.slice(at + 1);

    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const user = token ? await deps.verifyUser(token, req.headers.get('apikey') ?? '') : null;
    if (!user) return reply(401, { message: 'Entra con il tuo giocatore Tradermon per usare il conto Paper dal sito.' });
    if (tooMany(user, deps.limitPerMinute ?? 240)) return reply(429, { message: 'Troppe richieste in poco tempo: aspetta un minuto e riprova.' });

    if (parts[0] === 'status' && req.method === 'GET') return reply(200, { ok: true, cloud: true, liveMaxOrder: 0 });

    const keyId = (req.headers.get('x-alpaca-key') ?? '').trim();
    const secret = (req.headers.get('x-alpaca-secret') ?? '').trim();
    if (!validKeys(keyId, secret)) return reply(400, { message: 'Chiavi Alpaca Paper mancanti o non valide.' });

    const core = createCore({
      trading: { paper: deps.trading },
      data: deps.data,
      keysOf: (env: string) => (env === 'paper' ? { keyId, secret } : null),
      dataEnv: () => 'paper',
      audit: (entry: Record<string, unknown>) => deps.log({ ...entry, user }),
      liveMaxOrder: 0,
      noEnv: LIVE_LOCAL_ONLY,
    });
    const readBody = async () => {
      const raw = await req.text();
      if (raw.length > MAX_BODY) throw Object.assign(new Error('Richiesta troppo grande'), { status: 413 });
      try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Richiesta non valida'), { status: 400 }); }
    };

    // verifica delle chiavi appena inserite: una lettura del conto, nessun salvataggio
    if (parts[0] === 'keys' && req.method === 'POST') {
      const b = await readBody();
      if (b?.env !== 'paper') return reply(403, { message: LIVE_LOCAL_ONLY });
      try {
        const acc = await core.alpaca('paper', 'GET', `${deps.trading}/account`);
        return reply(200, { ok: true, account: { status: acc.status, currency: acc.currency } });
      } catch (e) {
        return reply(400, { message: `Alpaca ha rifiutato le chiavi Paper: ${(e as Error).message}` });
      }
    }

    const out = await core.handle({ method: req.method, parts, query: url.searchParams, header: (n: string) => req.headers.get(n), body: readBody });
    if (!out) return reply(404, { message: 'Endpoint non disponibile' });
    return reply(out.status, out.body);
  } catch (e) {
    const status = Number((e as { status?: number }).status);
    return reply(status >= 400 && status < 600 ? status : 500, { message: (e as Error).message || 'Errore interno' });
  }
}

// ---------- ospite: Supabase Edge Functions (Deno) ----------

// Verifica del token: la fa il servizio Auth del progetto. Un esito positivo vale 5 minuti in memoria.
const seen = new Map<string, { id: string; until: number }>();
async function verifyUser(token: string, apikey: string): Promise<string | null> {
  const hit = seen.get(token);
  if (hit && hit.until > Date.now()) return hit.id;
  const base = Deno.env.get('SUPABASE_URL');
  const key = apikey || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!base || !key) return null;
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: key } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id || u.is_anonymous) return null;
    if (seen.size > 5000) seen.clear();
    seen.set(token, { id: String(u.id), until: Date.now() + 5 * 60_000 });
    return String(u.id);
  } catch { return null; }
}

if (typeof Deno !== 'undefined') {
  const deps: Deps = {
    trading: 'https://paper-api.alpaca.markets/v2',
    data: 'https://data.alpaca.markets',
    verifyUser,
    log: (entry) => console.log(JSON.stringify({ t: new Date().toISOString(), ...entry })),
  };
  Deno.serve((req: Request) => handleRequest(req, deps));
}
