import { describe, it, expect } from 'vitest';
import { newGame, migrate, validSave, SAVE_VERSION, setState, newGamePlus } from '../src/systems/state';
import * as State from '../src/systems/state';
import { marketBuy, marketSell } from '../src/systems/portfolio';
import * as Acc from '../src/systems/account';
import { DIFFICULTY, LEVERAGE, ZERO } from '../src/systems/balance';
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
  it('un acquisto scaduto libera il denaro riservato e la quota va investita di nuovo', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    const pf = S.portfolio;
    const p = pending({ type: 'limit', qty: 2, price: 190, reserved: 380.38, tag: 'limite' });
    pf.pending.push(p); pf.bought = 380;
    expect(Acc.usableCash()).toBeCloseTo(5000 - 380.38, 6);
    const r = Acc.applyOrder(pf, p, order({ status: 'expired' }));
    expect(r.notes.join(' ')).toContain('scaduto');
    expect(pf.bought).toBe(0);
    expect(Acc.usableCash()).toBeCloseTo(5000, 6);
    // dopo un conto azzerato gli acquisti ripartono da zero: un ordine scaduto non riapre gli esercizi già fatti
    S.exDone = 4; S.seals = 3; S.badges = 4;
    const q = pending({ notional: 100, reserved: 100.1 });
    pf.pending.push(q); pf.bought = 100;
    Acc.applyOrder(pf, q, order({ status: 'canceled' }));
    expect(S.exDone).toBe(4);
    expect(S.seals).toBe(3);
    expect(pf.cash).toBe(5000);
  });
  it('tutto il capitale è investibile dal primo giorno; le tappe chiedono solo un minimo, più alto nelle difficoltà dure', () => {
    const S = newGame();
    expect(Acc.releasedFrac()).toBe(0); // senza Valigetta non c'è ancora un conto di gioco
    S.flags.starter = 'AAPL';
    expect(Acc.releasedFrac()).toBe(1);
    expect(Acc.locked()).toBe(0);
    expect(Acc.usableCash()).toBe(5000);
    // quota minima cumulata, secondo la difficoltà
    S.difficulty = 'leggenda'; S.portfolio.initial = 1000;
    expect(Acc.exNeed(0)).toBeCloseTo(95, 6);
    expect(Acc.exNeed(8)).toBeCloseTo(855, 6);
    S.difficulty = 'apprendista'; S.portfolio.initial = 10000;
    expect(Acc.exNeed(8)).toBeCloseTo(4500, 6);
    const mins = Object.values(DIFFICULTY).map((d) => 1 - d.tolerance);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins); // più dura la difficoltà, più alta la quota minima
    for (const d of Object.values(DIFFICULTY)) expect(d.fee).toBeLessThan(d.tolerance); // il costo non può rendere impossibile una quota
  });
  it('il Sigillo m chiede Attestato e Prova sul conto della tappa m, in ordine, senza replay', () => {
    const S = newGame();
    S.flags.starter = 'AAPL';
    S.badges = 2; S.exDone = 2;
    expect(Acc.grantSeals()).toEqual([1]); // la Prova della tappa 2 non è ancora fatta
    S.exDone = 3;
    expect(Acc.grantSeals()).toEqual([2]);
    S.badges = 3; S.exDone = 9;
    expect(Acc.grantSeals()).toEqual([3]); // senza Attestato il Sigillo non arriva, anche con le Prove fatte
    expect(S.seals).toBe(3);
    S.flags.bankrupt = true; S.badges = 8;
    expect(Acc.grantSeals()).toEqual([]);
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
    expect(Acc.margin().bankrupt).toBe(false); // la chiamata di margine arriva molto prima dello zero
    S.market.prices.AAPL = 51; // resta ancora qualcosa: non è bancarotta
    expect(Acc.margin().bankrupt).toBe(false);
    S.market.prices.AAPL = 50; // i titoli valgono quanto il prestito: il conto è a zero
    expect(Acc.margin().bankrupt).toBe(true);
  });
  it('la bancarotta arriva solo a conto azzerato, in ogni difficoltà; un prezzo mancante non è una perdita', () => {
    for (const d of Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]) {
      const S = newGame();
      S.flags.starter = 'BTC/USD'; S.difficulty = d;
      const cap = DIFFICULTY[d].capital;
      S.portfolio.initial = cap; S.portfolio.contributed = cap;
      S.market.asOf = Date.now(); S.market.prices = { 'BTC/USD': 100 };
      S.portfolio.cash = 0; S.portfolio.positions = [{ id: 'BTC/USD', qty: cap / 100, cost: cap }];
      expect(Acc.margin().bankrupt).toBe(false);
      S.market.prices['BTC/USD'] = 5; // −95%: quasi tutto perso, ma il conto non è a zero
      expect(Acc.margin().bankrupt).toBe(false);
      S.market.prices['BTC/USD'] = 0.00001; // sotto 1 $: non si può più inviare nemmeno l'ordine minimo
      expect(Acc.equity()).toBeLessThan(ZERO);
      expect(Acc.margin().bankrupt).toBe(true);
      delete S.market.prices['BTC/USD']; // prezzo non scaricato: nessuna bancarotta finta
      expect(Acc.margin().bankrupt).toBe(false);
    }
  });
  it('le quote di tappa sono importi fissi sul capitale di partenza, anche dopo perdite o una ripartenza', async () => {
    const S = newGame();
    S.flags.starter = 'AAPL'; S.difficulty = 'investitore';
    const q = Acc.stageQuota();
    expect(q).toBeCloseTo(350, 6); // 7% di 5.000 $
    expect(Acc.exNeed(3)).toBeCloseTo(4 * 350, 6);
    // il patrimonio si è dimezzato: le quote non scendono con lui
    S.portfolio.cash = 2500;
    expect(Acc.stageQuota()).toBeCloseTo(350, 6);
    // ripartenza dopo una bancarotta: metà del capitale di PARTENZA, acquisti già fatti ancora contati
    S.badges = 3; S.exDone = 3; S.seals = 2; S.portfolio.bought = 1100; S.portfolio.cash = 0.2;
    S.portfolio.pending = [{ id: 'p', cid: 'tm-x-9', asset: 'AAPL', side: 'buy', type: 'limit', qty: 1, price: 50, reserved: 50, filledQty: 0, filledCost: 0, createdAt: 0, tag: 'limite' }];
    S.portfolio.bought += 50; // accredito provvisorio dell'ordine in coda
    const A = await import('../src/systems/alpaca');
    const { vi } = await import('vitest');
    const spy = vi.spyOn(A, 'cancelOrder').mockRejectedValue(new Error('offline'));
    await Acc.restartAfterBankruptcy();
    spy.mockRestore();
    expect(S.portfolio.initial).toBe(2500);
    expect(S.portfolio.cash).toBe(2500);
    // la bancarotta annulla la Prova in corso (tappa 3): la sua quota riparte da zero, ordine in coda compreso;
    // le Prove già fatte e i Sigilli restano
    expect(Acc.credited()).toBeCloseTo(Acc.exNeed(2), 6);
    expect([S.exDone, S.seals]).toEqual([3, 2]);
    expect(Acc.exNeed(3)).toBeCloseTo(1400, 6); // alla prossima Prova manca la quota di una tappa, non un capitale intero
    expect(Acc.exMissing()).toBeCloseTo(350, 6);
    await Acc.restartAfterBankruptcy(); // un'altra ripartenza dà ancora metà del capitale di partenza, non un quarto
    expect(S.portfolio.initial).toBe(2500);
  });
  it('la Nuova Partita+ riparte da zero e conserva solo i trofei, il giocatore e le tutele del conto reale', () => {
    const S0 = newGame();
    S0.name = 'Nina'; S0.profile = 'audace';
    S0.flags.starter = 'AAPL'; S0.flags.champion = true; S0.flags.bankrupt = true; S0.flags.liveBase = 800; S0.flags.liveClosed = true;
    S0.difficulty = 'stratega'; S0.exDone = 9; S0.seals = 8; S0.badges = 8; S0.levExam = true;
    S0.portfolio.positions = [{ id: 'AAPL', qty: 1, cost: 100 }];
    S0.tower.best = 7; S0.legends = ['leg2020']; S0.achievements = ['a1']; S0.title = 'Campione'; S0.boss.beaten = ['b1'];
    S0.boss.runs = { b2: { id: 'b2', quiz: 6, quizMax: 8, plan: null, startedAt: 1 } };
    S0.cards.AAPL = { xp: 90, gold: true } as never; S0.cards.KO = { xp: 10, gold: false } as never;
    S0.license = 'investitore'; S0.liveLimits.perOrder = 50; S0.playMs = 1234;
    const id = S0.saveId;
    newGamePlus('etf');
    const S1 = State.S;
    expect(S1.ngPlus).toBe(1);
    expect(S1.track).toBe('etf');
    // da zero
    expect([S1.badges, S1.seals, S1.exDone, S1.levExam]).toEqual([0, 0, 0, false]);
    expect(S1.saveId).not.toBe(id);
    expect(S1.portfolio.positions.length).toBe(0);
    expect(S1.portfolio.bought).toBe(0);
    expect(S1.flags.champion).toBeUndefined(); // Torre e Boss tornano chiusi fino alla prossima Lega
    expect(S1.flags.bankrupt).toBeUndefined();
    expect(S1.flags.starter).toBeUndefined();
    expect(Acc.graduated()).toBe(false);
    expect(Acc.caseOpen()).toBe(false);
    expect(S1.boss.runs).toEqual({});
    expect(S1.cards.KO).toBeUndefined();
    // trofei, giocatore, tutele del conto reale
    expect(S1.tower.best).toBe(7);
    expect(S1.legends).toEqual(['leg2020']);
    expect(S1.achievements).toEqual(['a1']);
    expect(S1.title).toBe('Campione');
    expect(S1.boss.beaten).toEqual(['b1']);
    expect(S1.cards.AAPL.gold).toBe(true);
    expect([S1.name, S1.profile, S1.playMs]).toEqual(['Nina', 'audace', 1234]);
    expect(S1.license).toBe('investitore');
    expect(S1.liveLimits.perOrder).toBe(50);
    expect([S1.flags.liveBase, S1.flags.liveClosed]).toEqual([800, true]);
  });
  it('bancarotta sul conto reale: a zero, con pausa degli acquisti o chiusura secondo la difficoltà', () => {
    const day = 86400000, t0 = Date.UTC(2026, 10, 11);
    let S = newGame(); // Investitore: riparte dopo una pausa
    expect(Acc.liveCheck(0, t0).state).toBe('ok'); // un conto mai finanziato non è in bancarotta
    expect(S.flags.liveBase).toBeUndefined();
    expect(Acc.liveCheck(1000, t0).state).toBe('ok');
    expect(S.flags.liveBase).toBe(1000);
    expect(Acc.liveCheck(40, t0).state).toBe('ok'); // −96%: non è ancora zero
    const bust = Acc.liveCheck(0.4, t0);
    expect([bust.state, bust.fresh, bust.busts]).toEqual(['paused', true, 1]);
    expect(Acc.liveCheck(900, t0 + 3 * day).state).toBe('paused'); // la pausa non si accorcia
    const back = Acc.liveCheck(600, t0 + 8 * day);
    expect([back.state, back.base]).toEqual(['ok', 600]); // si riparte dal patrimonio trovato
    S = newGame(); S.difficulty = 'stratega';
    Acc.liveCheck(1000, t0);
    expect(Acc.liveCheck(0, t0).state).toBe('paused');
    Acc.liveCheck(300, t0 + 31 * day);
    expect(Acc.liveCheck(0.5, t0 + 32 * day).state).toBe('closed'); // una sola ripartenza
    expect(Acc.liveCheck(5000, t0 + 400 * day).state).toBe('closed');
    S = newGame(); S.difficulty = 'leggenda';
    Acc.liveCheck(1000, t0);
    expect(Acc.liveCheck(0, t0).state).toBe('closed');
  });
});

describe('confronto con il rivale', () => {
  it('usa gli stessi giorni reali del giocatore e lo stesso capitale di partenza', async () => {
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
    // 14 sedute tra il 19 ottobre e il 6 novembre, con l'80% investito (stile audace)
    expect(c.rival[5]).toBeCloseTo(5000 * (0.2 + 0.8 * 1.01 ** 14), 4);
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
