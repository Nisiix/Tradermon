// Riserva del sito pubblico: se il browser NON riesce a raggiungere Alpaca direttamente (il controllo CORS non
// passa), il solo conto Paper passa dalla funzione Supabase "alpaca". Il conto reale non usa mai questa strada.
// Qui la funzione gira dentro il test contro il finto Alpaca; Supabase (sessione) e la cassaforte sono simulati.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { handleRequest, type Deps } from '../supabase/functions/alpaca/index';
import { SUPABASE_URL } from '../src/config/supabase';

const KEY = 'PKTESTTESTTEST00', SECRET = 's'.repeat(40);
const cloud = vi.hoisted(() => ({ token: 'buono' as string | null, player: { id: 'g1', name: 'Ada' } as { id: string; name: string } | null, unlocked: false, saved: null as { keyId: string; secret: string } | null }));
vi.mock('../src/systems/cloud', () => ({
  cloudEnabled: () => true,
  accessToken: async () => cloud.token,
  currentPlayer: async () => cloud.player,
}));
vi.mock('../src/systems/keystore', () => ({
  unlocked: async () => cloud.unlocked,
  loadKeys: async (env: string) => { if (!cloud.unlocked) throw new Error('LOCKED'); return env === 'paper' ? cloud.saved : null; },
  keyEnvs: async () => (cloud.saved ? ['paper'] : []),
}));

import * as A from '../src/systems/alpaca';
import * as Acc from '../src/systems/account';
import { newGame, S } from '../src/systems/state';

let fake: FakeAlpaca;
const realFetch = globalThis.fetch;
const seen: { url: string; headers: Headers }[] = [];
const blocked: string[] = [];

beforeAll(async () => {
  fake = await startFakeAlpaca();
  const deps: Deps = { trading: `${fake.url}/paper/v2`, data: `${fake.url}/data`, verifyUser: async (t) => (t === 'buono' ? 'g1' : null), log: () => undefined };
  vi.stubGlobal('location', { hostname: 'giocatori.example', origin: 'https://giocatori.example' });
  vi.stubGlobal('fetch', async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    if (url.startsWith(`${SUPABASE_URL}/functions/v1/alpaca/`)) {
      seen.push({ url, headers: new Headers(init?.headers) });
      return handleRequest(new Request(url, init), deps);
    }
    // questo browser non può chiamare Alpaca: la richiesta viene bloccata prima di partire
    if (/^https:\/\/(paper-api|api|data)\.alpaca\.markets\//.test(url)) { blocked.push(url); throw new TypeError('Failed to fetch'); }
    // il sito statico non ha "/api": risponde con una pagina 404
    if (url.startsWith('/')) return new Response('<html>404</html>', { status: 404 });
    return realFetch(u, init);
  });
  cloud.saved = { keyId: KEY, secret: SECRET };
});
afterAll(async () => { vi.unstubAllGlobals(); await fake?.close(); });

describe('riserva del sito pubblico: conto Paper attraverso Supabase quando il browser non raggiunge Alpaca', () => {
  it('con la cassaforte chiusa il conto non risulta collegato e nessuna chiave parte', async () => {
    const st = await A.serverStatus();
    expect(st).toMatchObject({ ok: true, direct: true, paper: { configured: false }, live: { configured: false } });
    await expect(A.account('paper')).rejects.toThrow(/password/i);
    expect(seen).toHaveLength(0);
    expect(blocked).toHaveLength(0);
  });

  it('il browser prova Alpaca direttamente; bloccato, il Paper passa dalla funzione con il token del giocatore', async () => {
    cloud.unlocked = true;
    const st = await A.serverStatus();
    expect(st?.paper).toMatchObject({ configured: true, keyHint: 'PKTE…T00' });
    expect(A.cloudActive()).toBe(false);
    const acc = await A.account('paper');
    expect(acc.status).toBe('ACTIVE');
    expect(blocked).toEqual(['https://paper-api.alpaca.markets/v2/account']);
    expect(A.cloudActive()).toBe(true);
    expect(await A.serverStatus()).toMatchObject({ ok: true, cloud: true, live: { configured: false }, liveMaxOrder: 0 });
    const last = seen.at(-1)!;
    expect(last.url).toBe(`${SUPABASE_URL}/functions/v1/alpaca/api/alpaca/paper/account`);
    expect(last.headers.get('authorization')).toBe('Bearer buono');
    expect(last.headers.get('x-alpaca-key')).toBe(KEY);
  });

  it('il conto reale non usa mai la riserva: nessuna richiesta parte, né verso Supabase né verso Alpaca', async () => {
    const n = seen.length;
    const b = blocked.length;
    await expect(A.account('live')).rejects.toThrow(/tuo computer/);
    await expect(A.setKeys('live', 'AKTESTTESTTEST00', SECRET)).rejects.toThrow(/tuo computer/);
    await expect(A.submitOrder('live', { symbol: 'AAPL', side: 'buy', type: 'market', notional: '10', time_in_force: 'day', client_order_id: 'x' }, 'CONFERMO')).rejects.toThrow(/tuo computer/);
    expect(seen.length).toBe(n);
    expect(blocked.length).toBe(b);
  });

  it('un ordine del conto di gioco arriva ad Alpaca e torna nel registro', async () => {
    newGame();
    S.flags.starter = 'AAPL';
    S.cards.AAPL = { level: 1, study: 0, heldDays: 0, gold: false } as never;
    expect((await Acc.checkLink(true)).paper).toBe(true);
    await Acc.sync(true);
    expect(S.market.prices.AAPL).toBe(200);
    const r = await Acc.buy('AAPL', 400);
    expect(r.ok && r.filled).toBe(true);
    expect(S.portfolio.positions[0].qty).toBeCloseTo(2, 6);
    expect(fake.positions.AAPL).toBeCloseTo(2, 6);
    const s = await Acc.sell('AAPL', 1);
    expect(s.ok && s.filled).toBe(true);
  }, 20_000);

  it('scollegare toglie le chiavi dalla memoria; ricollegarle le verifica con Alpaca senza salvarle sul server', async () => {
    cloud.saved = null;
    await A.deleteKeys('paper');
    expect((await A.serverStatus())?.paper.configured).toBe(false);
    const n = seen.length;
    await expect(A.setKeys('paper', 'no', 'corta')).rejects.toThrow();
    expect(seen.length).toBe(n);
    const r = await A.setKeys('paper', KEY, SECRET);
    expect(r.ok).toBe(true);
    expect(seen.at(-1)!.url).toMatch(/\/api\/alpaca\/paper\/account$/);
    expect((await A.serverStatus())?.paper.configured).toBe(true);
  });

  it('senza un giocatore collegato il conto non è raggiungibile', async () => {
    cloud.player = null;
    expect(await A.serverStatus()).toBeNull();
    cloud.player = { id: 'g1', name: 'Ada' };
    cloud.token = null;
    await expect(A.account('paper')).rejects.toThrow(/giocatore/);
  });
});
