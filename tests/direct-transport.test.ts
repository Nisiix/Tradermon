// Dal sito pubblico (nessun server locale) il browser parla direttamente con Alpaca: le chiavi Paper e Live
// restano sul dispositivo (cassaforte locale, qui simulata) e nessun servizio di Tradermon le vede.
// Gli indirizzi veri di Alpaca vengono deviati sul finto Alpaca di prova.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { SUPABASE_URL } from '../src/config/supabase';

const PAPER = { keyId: 'PKTESTTESTTEST00', secret: 's'.repeat(40) };
const LIVE = { keyId: 'AKLIVELIVELIVE00', secret: 'v'.repeat(40) };
type Pair = { keyId: string; secret: string };
const store = vi.hoisted(() => ({ unlocked: false, keys: {} as Record<string, { keyId: string; secret: string } | undefined> }));
vi.mock('../src/systems/keystore', () => ({
  unlocked: async () => store.unlocked,
  loadKeys: async (env: string) => { if (!store.unlocked) throw new Error('LOCKED'); return store.keys[env] ?? null; },
  storeKeys: async (env: string, k: Pair) => { if (!store.unlocked) throw new Error('LOCKED'); store.keys[env] = k; },
  removeKeys: async (env: string) => { delete store.keys[env]; },
  keyEnvs: async () => Object.keys(store.keys).filter((e) => store.keys[e]),
}));
vi.mock('../src/systems/cloud', () => ({
  cloudEnabled: () => true,
  accessToken: async () => 'buono',
  currentPlayer: async () => ({ id: 'g1', name: 'Ada' }),
}));

import * as A from '../src/systems/alpaca';
import * as Acc from '../src/systems/account';
import { newGame, S } from '../src/systems/state';

let fake: FakeAlpaca;
const realFetch = globalThis.fetch;
const seen: { url: string; method: string; headers: Headers }[] = [];
/** Simula un server che non ammette l'intestazione Content-Type: application/json nelle chiamate dal browser. */
let refuseJsonType = false;

beforeAll(async () => {
  fake = await startFakeAlpaca();
  vi.stubGlobal('location', { hostname: 'giocatori.example', origin: 'https://giocatori.example' });
  vi.stubGlobal('fetch', async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    const headers = new Headers(init?.headers);
    const to = url.startsWith('https://paper-api.alpaca.markets/v2') ? url.replace('https://paper-api.alpaca.markets/v2', `${fake.url}/paper/v2`)
      : url.startsWith('https://api.alpaca.markets/v2') ? url.replace('https://api.alpaca.markets/v2', `${fake.url}/live/v2`)
      : url.startsWith('https://data.alpaca.markets') ? url.replace('https://data.alpaca.markets', `${fake.url}/data`) : '';
    if (to) {
      seen.push({ url, method: init?.method ?? 'GET', headers });
      // il browser rifiuta la chiamata prima di inviarla, come fa quando il controllo preliminare (CORS) non passa
      if (refuseJsonType && headers.get('content-type') === 'application/json') throw new TypeError('Failed to fetch');
      return realFetch(to, init);
    }
    if (url.startsWith('/')) return new Response('<html>404</html>', { status: 404 }); // sito statico: niente "/api"
    if (url.startsWith(SUPABASE_URL)) throw new Error(`nessuna chiamata deve passare da Supabase: ${url}`);
    return realFetch(u, init);
  });
});
afterAll(async () => { vi.unstubAllGlobals(); await fake?.close(); });

describe('conto Alpaca dal sito pubblico, direttamente dal browser', () => {
  it('con la cassaforte chiusa il conto non risulta collegato e nessuna chiave parte', async () => {
    store.keys.paper = PAPER;
    const st = await A.serverStatus();
    expect(await A.lockedKeys()).toEqual(['paper']);
    expect(st).toMatchObject({ ok: true, direct: true, paper: { configured: false }, live: { configured: false } });
    await expect(A.account('paper')).rejects.toThrow(/password/i);
    expect(seen).toHaveLength(0);
  });

  it('sbloccata la cassaforte, le chiamate vanno ad Alpaca con le chiavi del dispositivo e a nessun altro', async () => {
    store.unlocked = true;
    const st = await A.serverStatus();
    expect(st?.paper).toMatchObject({ configured: true, keyHint: 'PKTE…T00' });
    expect(A.directActive()).toBe(true);
    expect(await A.lockedKeys()).toEqual([]);
    const acc = await A.account('paper');
    expect(acc.status).toBe('ACTIVE');
    const last = seen.at(-1)!;
    expect(last.url).toBe('https://paper-api.alpaca.markets/v2/account');
    expect(last.headers.get('apca-api-key-id')).toBe(PAPER.keyId);
    expect(last.headers.get('apca-api-secret-key')).toBe(PAPER.secret);
    // le letture non portano Content-Type: Alpaca non lo ammette nelle chiamate dal browser
    expect(last.headers.get('content-type')).toBeNull();
    expect(seen.every((s) => /^https:\/\/(paper-api|api|data)\.alpaca\.markets\//.test(s.url))).toBe(true);
  });

  it('i dati di mercato si leggono da data.alpaca.markets con le stesse chiavi', async () => {
    const p = await A.latest('AAPL', 'stocks');
    expect(p.price).toBe(200);
    expect(seen.at(-1)!.url).toContain('https://data.alpaca.markets/v2/stocks/AAPL/trades/latest');
  });

  it('gli ordini passano dalle stesse regole del server: entro la liquidità, niente vendite allo scoperto', async () => {
    newGame();
    S.flags.starter = 'AAPL';
    S.cards.AAPL = { level: 1, study: 0, heldDays: 0, gold: false } as never;
    expect((await Acc.checkLink(true)).paper).toBe(true);
    await Acc.sync(true);
    const r = await Acc.buy('AAPL', 400);
    expect(r.ok && r.filled).toBe(true);
    expect(fake.positions.AAPL).toBeCloseTo(2, 6);
    const post = seen.filter((s) => s.method === 'POST').at(-1)!;
    expect(post.url).toBe('https://paper-api.alpaca.markets/v2/orders');
    fake.cash = 10;
    await expect(A.submitOrder('paper', { symbol: 'KO', side: 'buy', type: 'market', notional: '500', time_in_force: 'day', client_order_id: 'tm-x-1' })).rejects.toThrow(/Liquidità insufficiente/);
    await expect(A.submitOrder('paper', { symbol: 'JNJ', side: 'sell', type: 'market', qty: '1', time_in_force: 'day', client_order_id: 'tm-x-2' })).rejects.toThrow(/scoperto/);
    await expect(A.asset('paper', '../account')).rejects.toThrow(/Simbolo non valido/);
    fake.cash = 100000;
  }, 20_000);

  it('collegare le chiavi le verifica con Alpaca; chiavi rifiutate non restano in memoria', async () => {
    const bad = { keyId: 'PKBADBADBADBAD00', secret: 'b'.repeat(40) };
    const calls = seen.length;
    await expect(A.setKeys('paper', 'corta', 'x')).rejects.toThrow(/non valide/);
    expect(seen.length).toBe(calls);
    const realStub = globalThis.fetch;
    vi.stubGlobal('fetch', async (u: string | URL | Request, init?: RequestInit) => (new Headers(init?.headers).get('apca-api-key-id') === bad.keyId ? new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }) : realStub(u, init)));
    await expect(A.setKeys('paper', bad.keyId, bad.secret)).rejects.toThrow(/forbidden/);
    vi.stubGlobal('fetch', realStub);
    expect((await A.account('paper')).status).toBe('ACTIVE'); // valgono ancora le chiavi di prima
    expect(seen.at(-1)!.headers.get('apca-api-key-id')).toBe(PAPER.keyId);
    const ok = await A.setKeys('paper', PAPER.keyId, PAPER.secret);
    expect(ok).toMatchObject({ ok: true, account: { status: 'ACTIVE' } });
  });

  it('conto reale: stesso percorso diretto, con parola di conferma e tetto per ordine', async () => {
    await expect(A.account('live')).rejects.toThrow(/Nessuna chiave Live/);
    // con la cassaforte chiusa le chiavi verificate valgono per la sessione ma non vengono salvate
    store.unlocked = false;
    const first = await A.setKeys('live', LIVE.keyId, LIVE.secret);
    expect(first).toMatchObject({ ok: true, stored: false });
    expect(store.keys.live).toBeUndefined();
    store.unlocked = true;
    expect(await A.persistKeys('live')).toEqual({ stored: true });
    expect(store.keys.live).toEqual(LIVE);
    const st = await A.serverStatus();
    expect(st?.live.configured).toBe(true);
    expect(st!.liveMaxOrder).toBeGreaterThan(0);
    await A.account('live');
    expect(seen.at(-1)!.url).toBe('https://api.alpaca.markets/v2/account');
    expect(seen.at(-1)!.headers.get('apca-api-key-id')).toBe(LIVE.keyId);
    const o = { symbol: 'AAPL', side: 'buy' as const, type: 'market' as const, notional: '50', time_in_force: 'day' as const, client_order_id: 'tm-live-1' };
    await expect(A.submitOrder('live', o)).rejects.toThrow(/CONFERMO/);
    await expect(A.submitOrder('live', { ...o, notional: String(st!.liveMaxOrder + 1) }, 'CONFERMO')).rejects.toThrow(/tetto/);
    const out = await A.submitOrder('live', o, 'CONFERMO');
    expect(out.symbol).toBe('AAPL');
    expect(seen.at(-1)!.url).toBe('https://api.alpaca.markets/v2/orders');
    // scollegare: le chiavi spariscono dalla memoria e dal dispositivo
    await A.deleteKeys('live');
    expect(store.keys.live).toBeUndefined();
    await expect(A.account('live')).rejects.toThrow(/Nessuna chiave Live/);
  });

  it('se Alpaca non ammette Content-Type JSON dal browser, l\'ordine viene inviato come testo semplice, una volta sola', async () => {
    refuseJsonType = true;
    const before = fake.orders.size;
    const out = await A.submitOrder('paper', { symbol: 'KO', side: 'buy', type: 'market', notional: '60', time_in_force: 'day', client_order_id: 'tm-x-3' });
    expect(out.symbol).toBe('KO');
    expect(fake.orders.size).toBe(before + 1);
    expect(seen.at(-1)!.headers.get('content-type')).toBe('text/plain');
    // la scelta resta per la sessione: l'ordine seguente non riprova con JSON
    const n = seen.length;
    await A.submitOrder('paper', { symbol: 'KO', side: 'buy', type: 'market', notional: '60', time_in_force: 'day', client_order_id: 'tm-x-4' });
    expect(seen.slice(n).filter((s) => s.method === 'POST').map((s) => s.headers.get('content-type'))).toEqual(['text/plain']);
    refuseJsonType = false;
  });
});
