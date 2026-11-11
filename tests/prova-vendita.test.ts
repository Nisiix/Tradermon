// Vendere il titolo di una Prova sul conto, anche solo in parte, annulla la Prova: si rifà con un altro titolo.
// Browser (account.ts) → server di Tradermon → finto Alpaca locale.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { newGame, S } from '../src/systems/state';
import * as Acc from '../src/systems/account';

const PORT = 18795;
const base = `http://127.0.0.1:${PORT}`;
let srv: ChildProcess;
let fake: FakeAlpaca;
let dir: string;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  fake = await startFakeAlpaca();
  dir = mkdtempSync(path.join(tmpdir(), 'tradermon-test-'));
  srv = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, TRADERMON_PORT: String(PORT), TRADERMON_ALPACA_MOCK: fake.url, TRADERMON_SECRETS_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await realFetch(base + '/api/status'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  vi.stubGlobal('fetch', (u: string | URL | Request, init?: RequestInit) => realFetch(typeof u === 'string' && u.startsWith('/') ? base + u : u, init));
  const r = await realFetch(base + '/api/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ env: 'paper', keyId: 'PKTESTTESTTEST00', secret: 'x'.repeat(40) }) });
  expect(r.status).toBe(200);
  newGame();
  S.flags.starter = 'AAPL';
  for (const id of ['AAPL', 'KO', 'JNJ', 'JPM', 'NEE', 'XOM']) S.cards[id] = { level: 1, study: 0, heldDays: 0, gold: false } as never;
  expect((await Acc.checkLink(true)).paper).toBe(true);
  await Acc.sync(true);
}, 20_000);
afterAll(async () => { vi.unstubAllGlobals(); srv?.kill(); await fake?.close(); rmSync(dir, { recursive: true, force: true }); });

const got = () => Acc.exercise().got;

describe('vendere il titolo di una Prova sul conto annulla la Prova', () => {
  it('il gioco sa dirlo prima della vendita; una vendita parziale annulla la Prova e azzera la quota della tappa', async () => {
    expect(Acc.sellCancels('AAPL')).toBeNull(); // niente acquisti, niente da annullare
    expect((await Acc.buy('AAPL', 200)).filled).toBe(true); // sotto la quota minima (350 $): la Prova resta aperta
    expect(got()).toBeCloseTo(200, 6);
    expect(Acc.sellCancels('AAPL')).toEqual({ stage: 0 });
    const r = await Acc.sell('AAPL', 0.25); // un quarto di azione su una intera: vendita parziale
    expect(r.ok && r.filled).toBe(true);
    expect(r.cancelled).toContain('annullata');
    expect(r.cancelled).toContain('un altro titolo');
    expect(got()).toBe(0);
    expect(S.exDone).toBe(0);
    expect(Acc.exBarred()).toEqual(['AAPL']);
    expect(Acc.caseOpen()).toBe(true); // la Valigetta resta aperta: si annulla la Prova, non la partita
    expect(S.portfolio.positions.find((p) => p.id === 'AAPL')!.qty).toBeCloseTo(0.75, 6);
    expect(Acc.sellCancels('AAPL')).toBeNull(); // già annullata: vendere il resto non annulla altro
  }, 20_000);

  it('il titolo venduto non conta più per questa Prova: si completa con un altro titolo', async () => {
    const again = await Acc.buy('AAPL', 400);
    expect(again.ok).toBe(true);
    expect(again.msg + ' ' + (again.exercise ?? '')).toContain('non conta');
    expect(got()).toBe(0);
    expect(S.exDone).toBe(0);
    const other = await Acc.buy('KO', 400);
    expect(other.filled).toBe(true);
    expect(S.exDone).toBe(1);
    expect(Acc.exBarred()).toEqual([]); // Prova completata: l'elenco riparte vuoto
  }, 20_000);

  it('vendere un titolo che non conta per la Prova in corso non annulla nulla; venderne uno che conta sì', async () => {
    S.badges = 1; // tappa 1 aperta: servono 700 $ in tutto, finora 400 $ (i 50 $ oltre la quota di tappa 0 vengono da KO)
    expect(got()).toBeCloseTo(400, 6);
    expect(Acc.sellCancels('AAPL')).toBeNull();
    const a = await Acc.sell('AAPL', 0.5);
    expect(a.ok).toBe(true);
    expect(a.cancelled).toBeFalsy();
    expect(got()).toBeCloseTo(400, 6);
    expect(Acc.sellCancels('KO')).toEqual({ stage: 1 });
    const k = await Acc.sell('KO', 1);
    expect(k.cancelled).toContain('tappa 1');
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6); // la tappa riparte da zero, le Prove già fatte restano
    expect(S.exDone).toBe(1);
    expect(Acc.exBarred()).toEqual(['KO']);
  }, 20_000);

  it('mettere uno stop non annulla; se lo stop scatta è una vendita e la Prova si annulla', async () => {
    expect((await Acc.buy('JNJ', 150)).filled).toBe(true);
    const before = got();
    const st = await Acc.sell('JNJ', 1, { type: 'stop', price: 140 });
    expect(st.ok).toBe(true);
    expect(st.cancelled).toBeFalsy();
    expect(st.msg).toContain('annulla'); // l'avviso: se scatta, vende e la Prova riparte
    expect(got()).toBeCloseTo(before, 6);
    fake.prices.JNJ = 135; fake.match();
    const notes = (await Acc.sync(true)).join(' ');
    expect(notes).toContain('Vendute');
    expect(notes).toContain('annullata');
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6);
    expect(Acc.exBarred()).toEqual(['KO', 'JNJ']);
  }, 20_000);

  it('una vendita fatta fuori dal gioco annulla la Prova come una vendita fatta nel gioco', async () => {
    expect((await Acc.buy('JPM', 220)).filled).toBe(true);
    expect(got()).toBeCloseTo(Acc.exNeed(0) + 220, 6);
    fake.positions.JPM = 0.5;
    const notes = (await Acc.sync(true)).join(' ');
    expect(notes).toContain('fuori dal gioco');
    expect(notes).toContain('annullata');
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6);
    expect(Acc.exBarred()).toContain('JPM');
  }, 20_000);

  it('un acquisto in coda annullato dopo la vendita non toglie la quota due volte', async () => {
    // libero gli slot: vendere il resto di titoli che non contano più per la Prova non annulla altro
    for (const id of ['AAPL', 'KO', 'JPM']) {
      const pos = S.portfolio.positions.find((p) => p.id === id);
      if (pos) expect((await Acc.sell(id, pos.qty)).cancelled).toBeFalsy();
    }
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6);
    expect((await Acc.buy('XOM', 110)).filled).toBe(true);
    fake.open = false;
    expect((await Acc.buy('NEE', 140)).ok).toBe(true); // in coda: accreditato in via provvisoria
    expect(got()).toBeCloseTo(Acc.exNeed(0) + 250, 6);
    const s = await Acc.sell('XOM', 0.5); // la decisione di vendere vale subito, anche se l'ordine si esegue all'apertura
    expect(s.ok).toBe(true);
    expect(s.cancelled).toContain('annullata');
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6);
    const nee = S.portfolio.pending.find((p) => p.asset === 'NEE')!;
    await Acc.cancel(nee);
    expect(got()).toBeCloseTo(Acc.exNeed(0), 6);
    expect(S.exDone).toBe(1); // la Prova già fatta non torna in sospeso
    fake.open = true; fake.match();
    await Acc.sync(true);
  }, 20_000);

  it('se non restano altri titoli in vetrina la Prova si rifà con gli stessi', async () => {
    // tutti i titoli disponibili sono già stati venduti in questa Prova tranne NEE: venduto anche quello, l'elenco si svuota
    for (const pos of S.portfolio.positions.filter((x) => x.qty > 0.001)) expect((await Acc.sell(pos.id, pos.qty)).ok).toBe(true); // i residui infinitesimali non si vendono
    for (const id of Object.keys(S.cards)) if (!['AAPL', 'KO', 'JNJ', 'JPM', 'NEE', 'XOM'].includes(id)) delete S.cards[id];
    S.badges = 0; S.exDone = 0; S.portfolio.exVoid = S.portfolio.bought; S.portfolio.exBuys = {}; S.portfolio.exBarred = ['AAPL', 'KO', 'JNJ', 'JPM', 'XOM'];
    expect((await Acc.buy('NEE', 70)).filled).toBe(true);
    const r = await Acc.sell('NEE', 0.5);
    expect(r.cancelled).toContain('annullata');
    expect(r.cancelled).toContain('non ci sono altri titoli');
    expect(Acc.exBarred()).toEqual([]);
  }, 20_000);

  it('la vendita forzata della leva non è una decisione del giocatore: non annulla la Prova', async () => {
    expect((await Acc.buy('NEE', 70)).filled).toBe(true);
    const before = got();
    expect(Acc.sellCancels('NEE')).toEqual({ stage: 0 });
    const r = await Acc.sell('NEE', 0.5, { tag: 'liquidazione' });
    expect(r.ok).toBe(true);
    expect(r.cancelled).toBeFalsy();
    expect(got()).toBeCloseTo(before, 6);
  }, 20_000);
});
