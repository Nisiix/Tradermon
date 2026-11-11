// Conto di gioco contro un finto Alpaca: browser (account.ts) → server di Tradermon → finto Alpaca locale.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startFakeAlpaca, type FakeAlpaca } from './helpers/fake-alpaca';
import { newGame, S } from '../src/systems/state';
import * as Acc from '../src/systems/account';
import { hasPrices } from '../src/systems/realdata';
import { DIFFICULTY } from '../src/systems/balance';

const PORT = 18791;
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
  // il gioco chiama "/api/...": nei test l'indirizzo relativo diventa quello del server avviato qui sopra
  vi.stubGlobal('fetch', (u: string | URL | Request, init?: RequestInit) => realFetch(typeof u === 'string' && u.startsWith('/') ? base + u : u, init));
  const r = await realFetch(base + '/api/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ env: 'paper', keyId: 'PKTESTTESTTEST00', secret: 'x'.repeat(40) }) });
  expect(r.status).toBe(200);
}, 20_000);
afterAll(async () => { vi.unstubAllGlobals(); srv?.kill(); await fake?.close(); rmSync(dir, { recursive: true, force: true }); });

function start() {
  newGame();
  S.flags.starter = 'AAPL';
  S.cards.AAPL = { level: 1, study: 0, heldDays: 0, gold: false } as never;
  S.cards.KO = { level: 1, study: 0, heldDays: 0, gold: false } as never;
}

describe('conto di gioco dentro il conto Alpaca Paper', () => {
  it('senza server non si opera; con le chiavi il mondo riceve prezzi reali e nessun prezzo inventato', async () => {
    start();
    expect(hasPrices()).toBe(false);
    expect((await Acc.buy('AAPL', 100)).ok).toBe(false); // collegamento non ancora verificato
    expect((await Acc.checkLink(true)).paper).toBe(true);
    await Acc.sync(true);
    expect(hasPrices()).toBe(true);
    expect(S.market.prices.AAPL).toBe(200);
    expect(S.market.history.AAPL.length).toBeGreaterThan(100);
  }, 20_000);

  it('la Valigetta si apre con il primo acquisto accettato e la Riserva blocca il capitale non liberato', async () => {
    const cap = DIFFICULTY.investitore.capital;
    expect(Acc.caseOpen()).toBe(false);
    expect(Acc.usableCash()).toBeCloseTo(cap * 0.1, 6);
    const over = await Acc.buy('AAPL', cap * 0.2);
    expect(over.ok).toBe(false);
    expect(over.msg).toContain('Riserva');
    const r = await Acc.buy('AAPL', 400);
    expect(r.ok && r.filled).toBe(true);
    expect(S.portfolio.positions[0].qty).toBeCloseTo(2, 6);
    expect(S.portfolio.cash).toBeCloseTo(cap - 400 * (1 + DIFFICULTY.investitore.fee), 6);
    expect(S.portfolio.costs).toBeCloseTo(0.4, 6);
    expect(Acc.caseOpen()).toBe(true);
    expect(S.exDone).toBe(1); // 400 $ ≥ rata di 500 $ meno la tolleranza del 30%
    expect(r.exercise).toContain('Valigetta');
    expect(fake.positions.AAPL).toBeCloseTo(2, 6);
  }, 20_000);

  it('a mercato chiuso l\'ordine è accettato, il denaro resta riservato e l\'esecuzione arriva alla riapertura', async () => {
    S.badges = 1;
    S.flags.m1_mission = true;
    fake.open = false;
    const before = S.portfolio.cash;
    const r = await Acc.buy('KO', 300);
    expect(r.ok).toBe(true);
    expect(r.filled).toBe(false);
    expect(S.portfolio.pending.length).toBe(1);
    expect(S.portfolio.cash).toBe(before);
    expect(Acc.reserved()).toBeCloseTo(300 * 1.001, 6);
    // l'esercizio vale all'accettazione: secondo titolo e rata della tappa 1, quindi Sigillo 1
    expect(S.exDone).toBe(2);
    expect(S.seals).toBe(1);
    fake.open = true; fake.prices.KO = 62; fake.match();
    const notes = await Acc.sync(true);
    expect(notes.join(' ')).toContain('Comprate');
    expect(S.portfolio.pending.length).toBe(0);
    expect(S.portfolio.positions.find((p) => p.id === 'KO')!.qty).toBeCloseTo(300 / 62, 6);
    expect(S.portfolio.cash).toBeCloseTo(before - 300.3, 6);
  }, 20_000);

  it('un ordine annullato prima dell\'esecuzione non vale come rata: esercizio e Sigillo tornano in sospeso', async () => {
    S.badges = 2; S.flags.m2_mission = true;
    fake.open = false;
    // limite lontanissimo dal prezzo per tutta la rata della tappa 2: accettato, quindi esercizio e Sigillo arrivano subito
    const need = Acc.exNeed(2) - S.portfolio.bought;
    const r = await Acc.buy('KO', Math.ceil(need), { type: 'limit', price: 10 });
    expect(r.ok).toBe(true);
    expect(S.exDone).toBe(3);
    expect(S.seals).toBe(2);
    const rep = S.stats.reputazione;
    // il giocatore annulla: la rata non è mai stata versata
    const note = await Acc.cancel(S.portfolio.pending[0]);
    expect(note).toContain('sospeso');
    expect(S.exDone).toBe(2);
    expect(S.seals).toBe(1);
    fake.open = true;
    // versata davvero: l'esercizio si richiude senza rifare l'ordine limite, il Sigillo torna e il premio non raddoppia
    const again = await Acc.buy('KO', Math.ceil(need));
    expect(again.filled).toBe(true);
    expect(S.exDone).toBe(3);
    expect(S.seals).toBe(2);
    expect(S.stats.reputazione).toBe(rep);
    S.badges = 1; // le prove seguenti ripartono dalla situazione della tappa 1
  }, 20_000);

  it('lo stop su quote frazionarie scade a fine seduta e il gioco lo dice', async () => {
    const r = await Acc.sell('AAPL', 1.5, { type: 'stop', price: 180 });
    expect(r.ok).toBe(true);
    expect(r.msg).toContain('solo fino alla chiusura');
    expect(S.exTools.stop).toBe(true);
    fake.endOfDay();
    const notes = await Acc.sync(true);
    expect(notes.join(' ')).toContain('protezione non è più attiva');
    expect(S.portfolio.pending.length).toBe(0);
    expect(S.portfolio.positions.find((p) => p.id === 'AAPL')!.qty).toBeCloseTo(2, 6);
  }, 20_000);

  it('niente vendite allo scoperto; una vendita in perdita è riconosciuta', async () => {
    expect((await Acc.sell('JNJ', 1)).ok).toBe(false);
    fake.prices.AAPL = 190;
    const r = await Acc.sell('AAPL', 1);
    expect(r.ok && r.filled).toBe(true);
    expect(r.atLoss).toBe(true);
    expect(S.portfolio.positions.find((p) => p.id === 'AAPL')!.qty).toBeCloseTo(1, 6);
  }, 20_000);

  it('una vendita fatta fuori dal gioco viene annotata; un conto Paper azzerato fa ripartire il registro', async () => {
    fake.positions.KO = fake.positions.KO / 2;
    let notes = await Acc.sync(true);
    expect(notes.join(' ')).toContain('fuori dal gioco');
    expect(S.portfolio.positions.find((p) => p.id === 'KO')!.qty).toBeCloseTo(fake.positions.KO, 6);
    fake.accountNumber = 'PA0000002'; fake.positions = {}; fake.cash = 100000;
    notes = await Acc.sync(true);
    expect(notes.join(' ')).toContain('azzerato o sostituito');
    expect(S.portfolio.positions.length).toBe(0);
    expect(S.portfolio.cash).toBe(S.portfolio.initial);
    expect(S.seals).toBe(2); // Attestati, esercizi e Sigilli restano
    expect(S.exDone).toBe(3);
  }, 20_000);

  it('le chiavi non tornano mai al browser', async () => {
    const st = await (await realFetch(base + '/api/status')).json();
    expect(JSON.stringify(st)).not.toContain('x'.repeat(40));
    expect(st.paper.configured).toBe(true);
  });
});
