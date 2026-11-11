// Funzione Supabase "alpaca": lo stesso intermediario del server locale, per chi gioca dal sito pubblico.
// Qui gira dentro il test, contro il finto Alpaca: nessuna chiamata esce verso Alpaca o Supabase.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { handleRequest, type Deps } from '../supabase/functions/alpaca/index';

let fake: FakeAlpaca;
let deps: Deps;
const KEY = 'PKTESTTESTTEST00', SECRET = 's'.repeat(40);
const url = (p: string) => `https://progetto.supabase.co/functions/v1/alpaca${p}`;
const req = (p: string, init: RequestInit & { token?: string | null; keys?: boolean } = {}) => {
  const h = new Headers(init.headers);
  if (init.token !== null) h.set('authorization', `Bearer ${init.token ?? 'buono'}`);
  if (init.keys !== false) { h.set('x-alpaca-key', KEY); h.set('x-alpaca-secret', SECRET); }
  if (init.body) h.set('content-type', 'application/json');
  return handleRequest(new Request(url(p), { ...init, headers: h }), deps);
};
const order = (o: object, headers: Record<string, string> = {}) => req('/api/alpaca/paper/orders', { method: 'POST', body: JSON.stringify(o), headers });

beforeAll(async () => {
  fake = await startFakeAlpaca();
  deps = { trading: `${fake.url}/paper/v2`, data: `${fake.url}/data`, verifyUser: async (t) => (t === 'buono' ? 'giocatore-1' : null), log: () => undefined };
});
afterAll(async () => { await fake?.close(); });

describe('funzione Supabase per il conto Paper', () => {
  it('risponde alla verifica CORS del browser e accetta le intestazioni delle chiavi', async () => {
    const r = await handleRequest(new Request(url('/api/status'), { method: 'OPTIONS' }), deps);
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-headers')).toMatch(/x-alpaca-secret/);
  });

  it('senza un giocatore valido non passa nulla', async () => {
    expect((await req('/api/alpaca/paper/account', { token: null })).status).toBe(401);
    expect((await req('/api/alpaca/paper/account', { token: 'falso' })).status).toBe(401);
  });

  it('senza chiavi Alpaca valide nelle intestazioni risponde 400', async () => {
    expect((await req('/api/alpaca/paper/account', { keys: false })).status).toBe(400);
    const r = await req('/api/alpaca/paper/account', { headers: { 'x-alpaca-key': 'no', 'x-alpaca-secret': 'corta' }, keys: false });
    expect(r.status).toBe(400);
  });

  it('legge conto, posizioni e orologio del Paper con le chiavi del giocatore', async () => {
    const acc = await (await req('/api/alpaca/paper/account')).json();
    expect(acc.status).toBe('ACTIVE');
    expect((await req('/api/alpaca/paper/positions')).status).toBe(200);
    expect((await (await req('/api/alpaca/paper/clock')).json()).is_open).toBe(true);
  });

  it('il conto reale non passa mai da Supabase', async () => {
    const before = fake.orders.size;
    expect((await req('/api/alpaca/live/account')).status).toBe(403);
    const r = await req('/api/alpaca/live/orders', { method: 'POST', body: JSON.stringify({ symbol: 'AAPL', side: 'buy', type: 'market', time_in_force: 'day', notional: 10 }), headers: { 'x-tradermon-confirm': 'CONFERMO' } });
    expect(r.status).toBe(403);
    expect(fake.orders.size).toBe(before);
  });

  it('invia un acquisto frazionato e applica le stesse regole del server locale', async () => {
    const ok = await order({ symbol: 'AAPL', side: 'buy', type: 'market', time_in_force: 'day', notional: 100, client_order_id: 'tm-x-1' });
    expect(ok.status).toBe(200);
    const o = await ok.json();
    expect(o.status).toBe('filled');
    expect(fake.positions.AAPL).toBeCloseTo(0.5, 9);
    // niente vendite allo scoperto
    expect((await order({ symbol: 'KO', side: 'sell', type: 'market', time_in_force: 'day', qty: 1 })).status).toBe(403);
    // senza leva non si supera la liquidità; con la leva vale il potere d'acquisto di Alpaca
    const big = { symbol: 'KO', side: 'buy', type: 'market', time_in_force: 'day', notional: fake.cash * 1.5 };
    expect((await order(big)).status).toBe(403);
    expect((await order(big, { 'x-tradermon-margin': '1' })).status).toBe(200);
    // simboli e tipi non validi
    expect((await order({ symbol: 'rm -rf', side: 'buy', type: 'market', time_in_force: 'day', qty: 1 })).status).toBe(400);
    expect((await order({ symbol: 'BTC/USD', side: 'sell', type: 'stop', time_in_force: 'gtc', qty: 0.01, stop_price: 50000 })).status).toBe(400);
    // importi negativi o non numerici non arrivano ad Alpaca
    const n = fake.orders.size;
    expect((await order({ symbol: 'AAPL', side: 'buy', type: 'market', time_in_force: 'day', notional: -50 })).status).toBe(400);
    expect((await order({ symbol: 'AAPL', side: 'buy', type: 'market', time_in_force: 'day', qty: 'tanti' })).status).toBe(400);
    expect(fake.orders.size).toBe(n);
  });

  it('rilegge un ordine, elenca quelli chiusi e annulla quelli aperti', async () => {
    fake.open = false;
    fake.cash = 100000; // la prova precedente ha speso oltre la liquidità usando la leva
    const o = await (await order({ symbol: 'JNJ', side: 'buy', type: 'market', time_in_force: 'day', notional: 150 })).json();
    expect(o.status).toBe('new');
    expect((await (await req(`/api/alpaca/paper/orders/${o.id}`)).json()).id).toBe(o.id);
    expect((await (await req('/api/alpaca/paper/orders?status=open')).json()).map((x: { id: string }) => x.id)).toContain(o.id);
    expect((await req(`/api/alpaca/paper/orders/${o.id}`, { method: 'DELETE' })).status).toBe(200);
    const closed = await (await req('/api/alpaca/paper/orders?status=closed')).json();
    expect(closed.map((x: { id: string }) => x.id)).toContain(o.id);
    expect(closed.every((x: { status: string }) => x.status !== 'new')).toBe(true);
    fake.open = true;
  });

  it('dà prezzi e barre del mercato con le chiavi del giocatore', async () => {
    const snap = await (await req('/api/data/snapshot?symbols=AAPL,BTC/USD')).json();
    expect(snap.prices.AAPL).toBe(200);
    expect(snap.prices['BTC/USD']).toBe(60000);
    const d = await (await req('/api/data/daily?symbols=AAPL&start=2026-01-01&end=2026-03-01')).json();
    expect(d.bars.AAPL.length).toBeGreaterThan(20);
    expect((await (await req('/api/data/latest?symbol=KO&class=stocks')).json()).price).toBe(60);
  });

  it('verifica le chiavi con Alpaca senza salvarle e senza restituirle', async () => {
    const r = await req('/api/keys', { method: 'POST', body: JSON.stringify({ env: 'paper' }) });
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(JSON.parse(text).ok).toBe(true);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(KEY);
    expect((await req('/api/keys', { method: 'POST', body: JSON.stringify({ env: 'live' }) })).status).toBe(403);
  });

  it('nessuna risposta, nemmeno di errore, contiene le chiavi; i percorsi sconosciuti danno 404', async () => {
    const r = await req('/api/alpaca/paper/segreti');
    expect(r.status).toBe(404);
    const st = await req('/api/status');
    expect(st.status).toBe(200);
    for (const x of [r, st]) { const t = await x.text(); expect(t).not.toContain(SECRET); expect(t).not.toContain(KEY); }
  });

  it('ferma chi manda troppe richieste in un minuto', async () => {
    const limited: Deps = { ...deps, verifyUser: async () => 'giocatore-lento', limitPerMinute: 3 };
    const go = () => handleRequest(new Request(url('/api/status'), { headers: { authorization: 'Bearer buono', 'x-alpaca-key': KEY, 'x-alpaca-secret': SECRET } }), limited);
    expect((await go()).status).toBe(200);
    await go(); await go();
    expect((await go()).status).toBe(429);
  });
});
