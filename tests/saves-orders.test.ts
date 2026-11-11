import { describe, it, expect } from 'vitest';
import { newGame, migrate, validSave, SAVE_VERSION, setState, newGamePlus } from '../src/systems/state';
import * as State from '../src/systems/state';
import { marketBuy, marketSell } from '../src/systems/portfolio';
import * as Acc from '../src/systems/account';
import { DIFFICULTY, LEVERAGE } from '../src/systems/balance';
import type { AssetDef, PendingOrder, SaveData } from '../src/types';
import type { AlpacaOrder } from '../src/systems/alpaca';

const order = (o: Partial<AlpacaOrder>): AlpacaOrder => ({ id: 'x', symbol: 'AAPL', side: 'buy', type: 'market', qty: null, notional: null, status: 'new', limit_price: null, stop_price: null, submitted_at: '', filled_avg_price: null, filled_qty: '0', ...o });
const pending = (o: Partial<PendingOrder>): PendingOrder => ({ id: 'x', cid: 'tm-test-1', asset: 'AAPL', side: 'buy', type: 'market', reserved: 0, filledQty: 0, filledCost: 0, createdAt: 0, tag: 'mercato', ...o });

describe('registro del conto di gioco', () => {
  it('registra le esecuzioni parziali una volta sola, ai prezzi reali, con il costo didattico a parte', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    const pf = S.portfolio;
    const p = pending({ notional: 400, reserved: 400.4 });
    pf.pending.push(p); pf.bought = 400;
    let r = Acc.applyOrder(pf, p, order({ status: 'partially_filled', filled_qty: '1', filled_avg_price: '200' }));
    expect(r.done).toBe(false);
    expect(pf.cash).toBeCloseTo(5000 - 200.2, 6);
    r = Acc.applyOrder(pf, p, order({ status: 'partially_filled', filled_qty: '1', filled_avg_price: '200' }));
    expect(pf.cash).toBeCloseTo(5000 - 200.2, 6); // la stessa lettura non conta due volte
    r = Acc.applyOrder(pf, p, order({ status: 'filled', filled_qty: '2', filled_avg_price: '200' }));
    expect(r.done).toBe(true);
    expect(pf.pending.length).toBe(0);
    expect(pf.positions[0]).toMatchObject({ id: 'AAPL', qty: 2, cost: 400 });
    expect(pf.costs).toBeCloseTo(0.4, 6);
    expect(pf.loan).toBe(0);
  });
  it('un acquisto scaduto libera il denaro riservato e la rata va versata di nuovo', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    const pf = S.portfolio;
    const p = pending({ type: 'limit', qty: 2, price: 190, reserved: 380.38, tag: 'limite' });
    pf.pending.push(p); pf.bought = 380;
    expect(Acc.usableCash()).toBeCloseTo(500 - 380.38, 6);
    const r = Acc.applyOrder(pf, p, order({ status: 'expired' }));
    expect(r.notes.join(' ')).toContain('scaduto');
    expect(pf.bought).toBe(0);
    expect(Acc.usableCash()).toBeCloseTo(500, 6);
    // dopo un conto azzerato gli acquisti ripartono da zero: un ordine scaduto non riapre gli esercizi già fatti
    S.exDone = 4; S.seals = 3; S.badges = 4;
    const q = pending({ notional: 100, reserved: 100.1 });
    pf.pending.push(q); pf.bought = 100;
    Acc.applyOrder(pf, q, order({ status: 'canceled' }));
    expect(S.exDone).toBe(4);
    expect(S.seals).toBe(3);
    expect(pf.cash).toBe(5000);
  });
  it('le rate liberano il capitale un Attestato alla volta e gli esercizi si aprono in ordine', () => {
    const S = newGame();
    expect(Acc.releasedFrac()).toBe(0); // senza Valigetta non c'è ancora un conto di gioco
    S.flags.starter = 'AAPL';
    expect(Acc.releasedFrac()).toBeCloseTo(0.1, 9);
    expect(Acc.locked()).toBeCloseTo(4500, 6);
    S.badges = 3;
    expect(Acc.releasedFrac()).toBeCloseTo(0.4, 9);
    S.badges = 8;
    expect(Acc.releasedFrac()).toBeCloseTo(0.9, 9);
    S.flags.champion = true;
    expect(Acc.releasedFrac()).toBe(1);
    // rata cumulata con la tolleranza della difficoltà
    S.difficulty = 'leggenda'; S.portfolio.initial = 1000;
    expect(Acc.exNeed(0)).toBeCloseTo(95, 6);
    expect(Acc.exNeed(8)).toBeCloseTo(855, 6);
    for (const d of Object.values(DIFFICULTY)) expect(d.fee).toBeLessThan(d.tolerance); // il costo non può rendere impossibile una rata
  });
  it('il Sigillo m chiede Attestato, missione ed esercizio della tappa m, in ordine', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    S.badges = 2; S.exDone = 3;
    expect(Acc.grantSeals()).toEqual([]); // manca la missione del Mentore 1
    S.flags.m2_mission = true;
    expect(Acc.grantSeals()).toEqual([]); // i Sigilli non si saltano
    S.flags.m1_mission = true;
    expect(Acc.grantSeals()).toEqual([1, 2]);
    S.badges = 3; S.flags.m3_mission = true;
    expect(Acc.grantSeals()).toEqual([]); // manca l'esercizio della tappa 3
    S.exDone = 4;
    expect(Acc.grantSeals()).toEqual([3]);
    expect(S.seals).toBe(3);
  });
  it('la leva si apre solo dopo esame e ottavo Attestato; interessi, chiamata di margine e bancarotta seguono le regole', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    S.market.asOf = Date.now(); S.market.prices = { AAPL: 100 };
    expect(Acc.leverageOpen()).toBe(false);
    S.levExam = true;
    expect(Acc.credit()).toBe(0);
    S.badges = LEVERAGE.fromBadge; S.flags.champion = true;
    expect(Acc.leverageOpen()).toBe(true);
    const pf = S.portfolio;
    expect(Acc.credit()).toBeCloseTo(5000, 6); // al massimo 2x: un dollaro in prestito per ogni dollaro proprio
    // tutto investito con 5000 $ di prestito
    pf.cash = 0; pf.loan = 5000; pf.positions = [{ id: 'AAPL', qty: 100, cost: 10000 }];
    expect(Acc.margin().call).toBe(false);
    const mon = Date.UTC(2026, 10, 9, 15);
    pf.interestDay = new Date(mon).toISOString().slice(0, 10);
    const interest = Acc.accrue(pf, mon + 7 * 86400000);
    expect(interest).toBeCloseTo(5000 * (LEVERAGE.interest / 252) * 5, 4);
    S.market.prices.AAPL = 70; // 7000 di titoli, ~5000 di prestito: margine sotto il 30%
    expect(Acc.margin().call).toBe(true);
    expect(Acc.margin().bankrupt).toBe(false);
    S.market.prices.AAPL = 54; // patrimonio netto sotto il 10% del capitale
    expect(Acc.margin().bankrupt).toBe(true);
  });
  it('la Nuova Partita+ conserva il conto di gioco vero, la difficoltà e gli esercizi', () => {
    const S0 = newGame();
    S0.flags.starter = 'AAPL'; S0.difficulty = 'stratega'; S0.exDone = 9; S0.seals = 8; S0.badges = 8;
    S0.portfolio.positions = [{ id: 'AAPL', qty: 1, cost: 100 }];
    const id = S0.saveId;
    newGamePlus('etf');
    const S1 = State.S;
    expect(S1.ngPlus).toBe(1);
    expect(S1.badges).toBe(0);
    expect(S1.seals).toBe(0);
    expect(S1.saveId).toBe(id);
    expect(S1.difficulty).toBe('stratega');
    expect(S1.exDone).toBe(9);
    expect(S1.portfolio.positions.length).toBe(1);
    // finché il Professore non riassegna il percorso il conto resta fermo; poi tutto il capitale è già libero
    S1.flags.starter = 'SPY';
    expect(Acc.releasedFrac()).toBe(1);
    // i Sigilli tornano con Attestato e missione: gli esercizi sul conto vero sono già stati fatti
    S1.badges = 1; S1.flags.m1_mission = true;
    expect(Acc.grantSeals()).toEqual([1]);
  });
});

describe('confronto con il rivale', () => {
  it('usa gli stessi giorni reali del giocatore, lo stesso capitale e la stessa Riserva', async () => {
    const { rivalSeries } = await import('../src/world/scripts/story');
    const S = newGame();
    S.flags.starter = true; S.track = 'stocks';
    expect(rivalSeries('audace')).toBeNull(); // nessun prezzo scaricato
    // 60 sedute di storico di prova, in salita dell'1% al giorno, fino a venerdì 6 novembre 2026
    for (const id of ['AAPL', 'KO', 'JNJ', 'JPM', 'NEE', 'XOM', 'MSFT', 'PG', 'NVDA', 'UNH', 'V', 'DUK', 'TSLA', 'CVX']) S.market.history[id] = Array.from({ length: 60 }, (_, i) => 100 * 1.01 ** i);
    S.market.lastBar = '2026-11-06'; S.market.asOf = Date.now();
    const pf = S.portfolio;
    // il conto è stato misurato in sei giorni non consecutivi
    pf.valueDays = ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-30', '2026-11-04', '2026-11-06'];
    pf.valueHistory = [5000, 5005, 5010, 5008, 5020, 5030];
    const c = rivalSeries('audace')!;
    expect(c.days).toBe(6);
    expect(c.me).toEqual(pf.valueHistory);
    expect(c.rival[0]).toBeCloseTo(5000, 6);
    // 14 sedute tra il 19 ottobre e il 6 novembre, solo il 10% liberato è investito
    expect(c.rival[5]).toBeCloseTo(5000 * (0.9 + 0.1 * 1.01 ** 14), 4);
    expect(rivalSeries('prudente')!.rival[5]).toBeLessThan(c.rival[5]);
    pf.valueDays = pf.valueDays.slice(0, 3); pf.valueHistory = pf.valueHistory.slice(0, 3);
    expect(rivalSeries('audace')).toBeNull(); // conto troppo giovane
  });
});

describe('salvataggi', () => {
  it('migrazione: un salvataggio del mercato simulato passa ai dati reali senza perdere studio e Attestati', () => {
    const S = newGame();
    const old = JSON.parse(JSON.stringify(S)) as Record<string, any>;
    old.version = 1;
    delete old.reviewDue; delete old.seals; delete old.exDone; delete old.boss; delete old.difficulty; delete old.saveId;
    old.badges = 3; old.flags = { starter: 'SLR', m1_mission: true };
    old.cards = { SLR: { level: 2 }, AAPL: { level: 1 } };
    old.legends = ['leg2008'];
    old.market = { day: 40, prices: { SLR: 12 }, history: { SLR: [10, 11, 12] }, index: [100, 101], seed: 5, climate: 'toro' };
    old.portfolio = { cash: 1234, initial: 10000, contributed: 10000, positions: [{ id: 'SLR', qty: 3, cost: 30 }], orders: [{ id: 'x', asset: 'SLR', side: 'buy', type: 'limit', qty: 1, price: 1, createdDay: 5 }], log: [], peak: 1, valueHistory: [], eggs: [], drip: false, monthly: 0, refillsUsed: 0, target: { risky: 20, defensive: 50, cash: 30 } };
    const m = migrate(old as SaveData);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.reviewDue).toEqual({});
    expect(m.badges).toBe(3);
    expect(m.seals).toBe(0);
    expect(m.difficulty).toBe('apprendista');
    expect(m.portfolio.cash).toBe(DIFFICULTY.apprendista.capital);
    expect(m.portfolio.positions).toEqual([]);
    expect(m.portfolio.pending).toEqual([]);
    expect(m.portfolio.target).toEqual({ risky: 20, defensive: 50, cash: 30 });
    expect(m.market.prices).toEqual({});
    expect(m.market.asOf).toBe(0);
    expect(Object.keys(m.cards)).toEqual(['AAPL']); // le carte dei titoli inventati escono dall'Investidex
    expect(m.legends).toEqual([]);
    expect(m.flags.migratedV3).toBe(true);
    expect(m.saveId).toMatch(/^[0-9a-z]{6}$/);
    expect(validSave(JSON.parse(JSON.stringify(m)))).toBeNull();
    setState(m);
  });
  it('importazione: rifiuta file alterati', () => {
    const S = newGame();
    const ok = JSON.parse(JSON.stringify(S));
    expect(validSave(ok)).toBeNull();
    expect(validSave({ ...ok, portfolio: { cash: 'tanti' } })).not.toBeNull();
    expect(validSave({ ...ok, version: 99 })).not.toBeNull();
    expect(validSave({ ...ok, market: null })).not.toBeNull();
    expect(validSave('ciao')).not.toBeNull();
  });
});

describe('replay di dati reali Alpaca', () => {
  it('si può comprare e vendere il simbolo reale passato al simulatore', () => {
    const REAL = { id: 'REAL', ticker: 'AAPL', name: 'AAPL', cls: 'stocks', sector: 'world', risk: 3, mu: 0, sigma: 0.2, beta: 1, dividend: 0, desc: '', facts: [], unlock: 'real' } as AssetDef;
    const book = { cash: 1000, positions: [], orders: [], log: [] };
    const defs = { REAL };
    expect(marketBuy(book, 'REAL', 500, { REAL: 100 }, 0, 10).ok).toBe(false); // prima della correzione: "Asset sconosciuto"
    expect(marketBuy(book, 'REAL', 500, { REAL: 100 }, 0, 10, 'mercato', defs).ok).toBe(true);
    expect(marketSell(book, 'REAL', 1, { REAL: 110 }, 1, 'mercato', defs).ok).toBe(true);
  });
});
