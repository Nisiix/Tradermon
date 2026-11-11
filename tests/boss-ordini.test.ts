// Boss dei Mercati con ordini veri: presentare il piano compra davvero sul conto di gioco e mette uno stop vero.
// Vendere il titolo del mandato annulla la sfida; se il piano va male, la perdita resta sul conto.
// Browser (account.ts, mandate.ts) → server di Tradermon → finto Alpaca locale.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { newGame, S } from '../src/systems/state';
import * as Acc from '../src/systems/account';
import * as M from '../src/systems/mandate';
import { BOSS_BY_ID, positionSize, mandateOn, outcome } from '../src/systems/boss';

const PORT = 18796;
const base = `http://127.0.0.1:${PORT}`;
let srv: ChildProcess;
let fake: FakeAlpaca;
let dir: string;
const realFetch = globalThis.fetch;
const marea = BOSS_BY_ID.marea, fulmine = BOSS_BY_ID.fulmine;

/** Quiz superato, nessun piano: il punto in cui il giocatore presenta il piano. */
const passQuiz = (id: string) => { (S.boss.runs ??= {})[id] = { id, quiz: 8, quizMax: 8, plan: null, startedAt: Date.now() }; };
// le quantità frazionarie lasciano residui minuscoli (milionesimi di azione): non sono una posizione
const pos = (id: string) => S.portfolio.positions.find((p) => p.id === id && p.qty > 1e-4);
const stopOf = (id: string) => S.portfolio.pending.find((p) => p.asset === id && p.tag === 'boss-stop');

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
  S.badges = 8;
  S.flags.champion = true; // i Boss si affrontano dopo la Lega: le Prove sul conto sono finite
  for (const id of ['AAPL', 'KO', 'JNJ', 'JPM', 'NEE', 'XOM']) S.cards[id] = { level: 1, study: 0, heldDays: 0, gold: false } as never;
  expect((await Acc.checkLink(true)).paper).toBe(true);
  await Acc.sync(true);
}, 20_000);
afterAll(async () => { vi.unstubAllGlobals(); srv?.kill(); await fake?.close(); rmSync(dir, { recursive: true, force: true }); });

describe('quanto si compra: il rischio scelto decide la dimensione della posizione', () => {
  it('se scatta lo stop si perde la quota di capitale indicata', () => {
    // 1.000 $ di capitale, rischio 2% = 20 $; stop al 5% sotto l'ingresso: posizione da 400 $
    expect(positionSize(1000, 0.02, 200, 190, 5000)).toEqual({ amount: 400, capped: false });
  });
  it('non si compra più della liquidità disponibile: lo dice, e il rischio vero scende', () => {
    expect(positionSize(1000, 0.05, 200, 198, 300)).toEqual({ amount: 300, capped: true });
  });
  it('piano non valido o liquidità assente: niente ordine', () => {
    expect(positionSize(1000, 0.02, 200, 200, 5000).amount).toBe(0);
    expect(positionSize(1000, 0.02, 200, 190, 0.5).amount).toBe(0);
  });
});

describe('presentare il piano invia ordini veri sul conto di gioco', () => {
  it('compra il titolo al prezzo vero e mette lo stop vero; il piano registra ingresso e quantità reali', async () => {
    passQuiz('marea');
    const cash = S.portfolio.cash;
    const eq = Acc.equity();
    const r = await M.openMandate(marea, { asset: 'AAPL', stop: 190, target: 220, risk: 0.02 }, 26);
    expect(r.ok).toBe(true);
    const plan = S.boss.runs!.marea.plan!;
    expect(plan).toMatchObject({ asset: 'AAPL', real: true, entry: 200, stop: 190, target: 220, quality: 26 });
    // rischio 2% del capitale con stop al 5%: posizione pari al 40% del capitale
    expect(plan.amount).toBeCloseTo(Math.floor(eq * 0.4 * 100) / 100, 2);
    expect(plan.qty).toBeCloseTo(plan.amount! / 200, 6);
    expect(pos('AAPL')!.qty).toBeCloseTo(plan.qty!, 6);
    expect(fake.positions.AAPL).toBeCloseTo(plan.qty!, 6);
    expect(S.portfolio.cash).toBeLessThan(cash - plan.amount! + 0.01);
    expect(stopOf('AAPL')).toMatchObject({ side: 'sell', type: 'stop', price: 190 });
    expect([...fake.orders.values()].some((o) => o.symbol === 'AAPL' && o.type === 'stop' && o.status === 'new')).toBe(true);
    expect(mandateOn(S.boss, 'AAPL')).toBe('marea');
    expect(M.stopMissing('marea')).toBe(false);
  }, 20_000);

  it('un titolo già in portafoglio o già in un altro mandato non si può usare', async () => {
    passQuiz('ghiacciaio');
    const r = await M.openMandate(BOSS_BY_ID.ghiacciaio, { asset: 'AAPL', stop: 190, target: 220, risk: 0.01 }, 26);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/già/);
    expect(S.boss.runs!.ghiacciaio.plan).toBeNull();
  }, 20_000);

  it('a Borsa chiusa il piano su un\'azione non parte e nessun ordine viene inviato', async () => {
    fake.open = false;
    const n = fake.orders.size;
    const r = await M.openMandate(BOSS_BY_ID.ghiacciaio, { asset: 'KO', stop: 57, target: 66, risk: 0.01 }, 26);
    fake.open = true;
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/Borsa/);
    expect(fake.orders.size).toBe(n);
    expect(pos('KO')).toBeUndefined();
  }, 20_000);
});

describe('vendere il titolo del mandato annulla la sfida', () => {
  it('una vendita dalla Clinica, anche parziale, annulla il mandato: non è una sconfitta, si rifà con un altro titolo', async () => {
    expect(M.sellCancelsMandate('AAPL')).toBe('marea');
    const q = pos('AAPL')!.qty;
    const r = await Acc.sell('AAPL', q / 4);
    expect(r.ok).toBe(true);
    expect(r.cancelled).toMatch(/La Marea/);
    expect(r.cancelled).toMatch(/annullat/);
    expect(S.boss.runs!.marea).toBeUndefined();
    expect(S.boss.barred!.marea).toBe('AAPL');
    expect(mandateOn(S.boss, 'AAPL')).toBeNull();
    // lo stop del mandato viene tolto: la posizione rimasta torna una posizione normale
    await Acc.sync(true);
    expect(stopOf('AAPL')).toBeUndefined();
    expect(pos('AAPL')!.qty).toBeCloseTo(q * 0.75, 6);
  }, 20_000);

  it('"vendo e cambio titolo" dalla Torre vende davvero e annulla la sfida', async () => {
    await Acc.sell('AAPL', pos('AAPL')!.qty);
    passQuiz('marea');
    expect((await M.openMandate(marea, { asset: 'KO', stop: 57, target: 66, risk: 0.01 }, 26)).ok).toBe(true);
    const r = await M.closeMandate('marea', 'annulla');
    expect(r.ok && r.filled).toBe(true);
    expect(pos('KO')).toBeUndefined();
    expect(fake.positions.KO ?? 0).toBeCloseTo(0, 6);
    expect(S.boss.runs!.marea).toBeUndefined();
    expect(S.boss.barred!.marea).toBe('KO');
    expect(stopOf('KO')).toBeUndefined();
  }, 20_000);
});

describe('se il piano va male la perdita resta sul conto', () => {
  it('lo stop vero scatta: la posizione viene venduta in perdita, il mandato resta da giudicare e non viene annullato', async () => {
    passQuiz('marea');
    const before = Acc.equity();
    expect((await M.openMandate(marea, { asset: 'JNJ', stop: 142.5, target: 165, risk: 0.02 }, 26)).ok).toBe(true);
    const plan = S.boss.runs!.marea.plan!;
    fake.prices.JNJ = 140;
    fake.match();
    const notes = await Acc.sync(true);
    expect(notes.join(' ')).toMatch(/Vendute/);
    expect(pos('JNJ')).toBeUndefined();
    // il mandato non è annullato: lo stop che scatta è il piano che ha funzionato, e l'esito si legge alla scadenza
    expect(S.boss.runs!.marea.plan).toBeTruthy();
    expect(S.boss.barred?.marea).not.toBe('JNJ');
    const money = M.mandateMoney('marea')!;
    expect(money.held).toBeCloseTo(0, 6);
    expect(money.result).toBeLessThan(0);
    // la perdita è vera: circa il 2% del capitale, e resta sul conto
    expect(Acc.equity()).toBeLessThan(before - plan.amount! * 0.05);
    // dieci dollari per azione, più il costo didattico dell'ordine
    expect(money.result).toBeLessThan((140 - 150) * plan.qty! + 0.01);
    expect(money.result).toBeGreaterThan((140 - 150) * plan.qty! * 1.03);
    // sulle candele lo stesso piano risulta fermato dallo stop: nessun punto per l'esito
    expect(outcome(plan, [{ o: 149, h: 151, l: 139, c: 140 }])).toMatchObject({ how: 'stop', points: 0 });
    fake.prices.JNJ = 150;
  }, 20_000);

  it('alla scadenza la posizione si chiude con una vendita vera che non annulla la sfida', async () => {
    delete S.boss.runs!.marea;
    passQuiz('fulmine');
    expect((await M.openMandate(fulmine, { asset: 'JPM', stop: 214, target: 232, risk: 0.01 }, 26)).ok).toBe(true);
    fake.prices.JPM = 226;
    const r = await M.closeMandate('fulmine', 'mandato');
    expect(r.ok && r.filled).toBe(true);
    expect(r.cancelled).toBeFalsy();
    expect(S.boss.runs!.fulmine.plan).toBeTruthy();
    const money = M.mandateMoney('fulmine')!;
    expect(money.held).toBeCloseTo(0, 6);
    expect(money.result).toBeGreaterThan(0);
    expect(stopOf('JPM')).toBeUndefined();
    fake.prices.JPM = 220;
  }, 20_000);

  it('se lo stop del mandato è scaduto si può rimettere; una vendita fatta sul sito di Alpaca annulla la sfida', async () => {
    delete S.boss.runs!.fulmine;
    passQuiz('marea');
    delete S.boss.barred;
    expect((await M.openMandate(marea, { asset: 'NEE', stop: 66.5, target: 78, risk: 0.01 }, 26)).ok).toBe(true);
    const st = stopOf('NEE')!;
    await Acc.cancel(st); // come uno stop frazionario scaduto a fine seduta
    expect(M.stopMissing('marea')).toBe(true);
    expect((await M.restoreStop('marea')).ok).toBe(true);
    expect(M.stopMissing('marea')).toBe(false);
    // vendita esterna: il giocatore toglie lo stop e vende tutto dal sito di Alpaca
    await Acc.cancel(stopOf('NEE')!);
    fake.positions.NEE = 0;
    const notes = await Acc.sync(true);
    expect(notes.join(' ')).toMatch(/fuori dal gioco/);
    expect(notes.join(' ')).toMatch(/La Marea/);
    expect(S.boss.runs!.marea).toBeUndefined();
    expect(S.boss.barred!.marea).toBe('NEE');
  }, 20_000);
});
