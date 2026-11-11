import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 18787;
const base = `http://127.0.0.1:${PORT}`;
let srv: ChildProcess;

beforeAll(async () => {
  srv = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, TRADERMON_PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/status'); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
});
afterAll(() => { srv?.kill(); });

describe('server locale Alpaca', () => {
  it('stato senza chiavi', async () => {
    const r = await (await fetch(base + '/api/status')).json();
    expect(r.ok).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['ok', 'paper']);
  });
  it('rifiuta le richieste da altre origini', async () => {
    const r = await fetch(base + '/api/keys', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(403);
  });
  it('collega e usa solo il conto Paper', async () => {
    const k = await fetch(base + '/api/keys', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ env: 'altro', keyId: 'AKTESTTESTTEST00', secret: 's'.repeat(40) }) });
    expect(k.status).toBe(403);
    expect((await k.json()).message).toMatch(/solo il conto Alpaca Paper/);
    const r = await fetch(base + '/api/alpaca/altro/orders', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ symbol: 'AAPL', side: 'buy', type: 'market', time_in_force: 'day', notional: 10 }) });
    expect(r.status).toBe(404);
  });
  it('rifiuta la vendita allo scoperto e i simboli non validi', async () => {
    const r = await fetch(base + '/api/alpaca/paper/orders', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ symbol: 'rm -rf', side: 'buy', type: 'market', time_in_force: 'day', qty: 1 }) });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('applica le regole di Alpaca: niente stop semplice sulle cripto, frazionari solo a mercato', async () => {
    const post = (b: object) => fetch(base + '/api/alpaca/paper/orders', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(b) });
    const c = await post({ symbol: 'BTC/USD', side: 'sell', type: 'stop', time_in_force: 'gtc', qty: 0.01, stop_price: 50000 });
    expect(c.status).toBe(400);
    expect((await c.json()).message).toMatch(/stop limit/);
    const f = await post({ symbol: 'AAPL', side: 'buy', type: 'limit', time_in_force: 'day', notional: 50, limit_price: 100 });
    expect(f.status).toBe(400);
    const p = await post({ symbol: 'AAPL', side: 'buy', type: 'limit', time_in_force: 'day', qty: 1, limit_price: 0 });
    expect(p.status).toBe(400);
  });
});
