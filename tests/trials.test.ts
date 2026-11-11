import { describe, it, expect } from 'vitest';
import { newGame } from '../src/systems/state';
import { leagueTrial, runTrial, book, TRIAL } from '../src/systems/trials';
import type { PendingOrder } from '../src/types';

const stop = (asset: string, qty: number): PendingOrder => ({ id: 's' + asset, cid: 'tm-t-1', asset, side: 'sell', type: 'stop', qty, price: 1, reserved: 0, filledQty: 0, filledCost: 0, createdAt: 0, tag: 'stop' });

function setup() {
  const S = newGame();
  S.flags.starter = 'AAPL'; S.track = 'stocks'; S.badges = 8;
  S.market.asOf = Date.now();
  S.market.prices = { AAPL: 100, KO: 50, JNJ: 100, NVDA: 100 };
  return S;
}

describe('prove pratiche della Lega sul conto di gioco', () => {
  it('la fotografia conta solo le posizioni eseguite e gli stop attivi', () => {
    const S = setup();
    const pf = S.portfolio;
    pf.cash = 2000; pf.positions = [{ id: 'AAPL', qty: 20, cost: 2000 }, { id: 'KO', qty: 20, cost: 1000 }];
    pf.pending = [{ ...stop('AAPL', 10) }, { id: 'b', cid: 'tm-t-2', asset: 'JNJ', side: 'buy', type: 'market', notional: 500, reserved: 500, filledQty: 0, filledCost: 0, createdAt: 0, tag: 'mercato' }];
    const b = book();
    expect(b.invested).toBe(3000);
    expect(b.equity).toBe(5000);
    expect(Object.keys(b.byAsset)).toEqual(['AAPL', 'KO']); // l'acquisto in coda non conta
    expect(b.waiting).toBe(1);
    expect(b.maxWeight).toBeCloseTo(2 / 3, 6);
    expect(b.stopCover).toBeCloseTo(1000 / 3000, 6);
    expect(b.defensive).toBe(true); // KO: rischio 2
    expect(b.risky).toBeCloseTo((2000 / 3000) * 100, 6);
  });

  it('capitale al lavoro: metà del patrimonio investita, tre titoli, uno difensivo', () => {
    const S = setup();
    const t = leagueTrial(0)!;
    const pf = S.portfolio;
    expect(runTrial(t).ok).toBe(false); // conto vuoto
    pf.cash = 2400; pf.positions = [{ id: 'AAPL', qty: 13, cost: 1300 }, { id: 'NVDA', qty: 13, cost: 1300 }];
    let r = runTrial(t);
    expect(r.checks.map((c) => c.ok)).toEqual([true, false, false]);
    pf.cash = 2000; pf.positions.push({ id: 'KO', qty: 8, cost: 400 });
    r = runTrial(t);
    expect(r.ok).toBe(true);
  });

  it('entrata e uscita: nessun titolo oltre il 40% e stop su un quarto dell\'investito', () => {
    const S = setup();
    const t = leagueTrial(1)!;
    const pf = S.portfolio;
    pf.cash = 2000; pf.positions = [{ id: 'AAPL', qty: 10, cost: 1000 }, { id: 'NVDA', qty: 10, cost: 1000 }, { id: 'JNJ', qty: 10, cost: 1000 }];
    expect(runTrial(t).checks.map((c) => c.ok)).toEqual([true, false]);
    pf.pending = [stop('NVDA', 8)];
    expect(runTrial(t).ok).toBe(true);
    S.market.prices.AAPL = 300; // un titolo è cresciuto fino a pesare troppo
    expect(runTrial(t).checks[0].ok).toBe(false);
  });

  it('il piano prima dell\'umore: quota rischiosa vicina al piano e decisioni motivate nel Diario', () => {
    const S = setup();
    const t = leagueTrial(3)!;
    const pf = S.portfolio;
    pf.target = { risky: 60, defensive: 30, cash: 10 }; // piano: due terzi dell'investito in titoli rischiosi
    pf.positions = [{ id: 'AAPL', qty: 20, cost: 2000 }, { id: 'KO', qty: 20, cost: 1000 }];
    expect(runTrial(t).checks.map((c) => c.ok)).toEqual([true, false]);
    S.journal = [1, 2, 3].map((i) => ({ id: 'j' + i, day: i, date: '2026-11-0' + i, asset: 'AAPL', side: 'buy', amount: 100, price: 100, reason: 'Piano di accumulo', note: '', account: 'paper', reviewed: false })) as never;
    expect(runTrial(t).ok).toBe(true);
    pf.positions = [{ id: 'AAPL', qty: 30, cost: 3000 }]; // tutto rischioso: 100% contro il 67% del piano
    expect(runTrial(t).checks[0].ok).toBe(false);
  });

  it('la prova delle Regole non passa dal conto; quella del Campione chiede tutto insieme', () => {
    const S = setup();
    expect(leagueTrial(2)).toBeNull();
    const t = leagueTrial(4)!;
    const pf = S.portfolio;
    pf.target = { risky: 60, defensive: 30, cash: 10 };
    pf.cash = 2000; pf.positions = [{ id: 'AAPL', qty: 10, cost: 1000 }, { id: 'NVDA', qty: 10, cost: 1000 }, { id: 'KO', qty: 20, cost: 1000 }];
    pf.pending = [stop('AAPL', 8)];
    const r = runTrial(t);
    expect(r.checks.length).toBe(6);
    expect(r.ok).toBe(true);
    // obiettivi raggiungibili: nessuna soglia chiede un rendimento
    expect(r.checks.some((c) => /rendiment|sharpe/i.test(c.label))).toBe(false);
    expect(TRIAL.invested).toBeLessThanOrEqual(0.6);
  });

  it('percorso solo cripto: il titolo difensivo è la stablecoin, quando è disponibile', () => {
    const S = setup();
    S.track = 'crypto'; S.badges = 0; S.cards = {};
    S.market.prices = { 'BTC/USD': 100, 'ETH/USD': 100, 'SOL/USD': 100 };
    S.portfolio.cash = 2000;
    S.portfolio.positions = [{ id: 'BTC/USD', qty: 10, cost: 1000 }, { id: 'ETH/USD', qty: 10, cost: 1000 }, { id: 'SOL/USD', qty: 10, cost: 1000 }];
    // senza un titolo difensivo sbloccato la prova non lo chiede
    expect(runTrial(leagueTrial(0)!).checks.length).toBe(2);
    expect(runTrial(leagueTrial(0)!).ok).toBe(true);
  });
});

