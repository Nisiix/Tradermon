import { describe, it, expect } from 'vitest';
import { newPortfolio, marketBuy, marketSell, value, FEE } from '../src/systems/portfolio';
import { metrics, generateScenario } from '../src/systems/market';
import { ASSETS } from '../src/data/assets';
import { mentorMission, leagueMission } from '../src/data/missions';

describe('portafoglio', () => {
  const prices = { SLR: 100, GLB: 50 };
  it('acquisto e vendita con costi, senza leva né vendite allo scoperto', () => {
    const pf = newPortfolio(1000, 0, 'equilibrato');
    expect(marketBuy(pf, 'SLR', 500, prices, 0, 10).ok).toBe(true);
    expect(pf.cash).toBeCloseTo(500, 6);
    const pos = pf.positions.find((p) => p.id === 'SLR')!;
    expect(pos.qty).toBeGreaterThan(4.9);
    expect(value(pf, prices)).toBeLessThan(1000);
    expect(value(pf, prices)).toBeGreaterThan(1000 - FEE - 5);
    expect(marketBuy(pf, 'GLB', 5000, prices, 0, 10).ok).toBe(false); // niente margine
    expect(marketSell(pf, 'GLB', 1, prices, 0).ok).toBe(false); // niente scoperto
    expect(marketSell(pf, 'SLR', 1000, prices, 1).ok).toBe(true); // vende al massimo ciò che possiede
    expect(pf.positions.length).toBe(0);
    expect(pf.cash).toBeLessThan(1000);
  });
  it('rispetta il numero massimo di posizioni', () => {
    const pf = newPortfolio(1000, 0, 'equilibrato');
    expect(marketBuy(pf, 'SLR', 100, prices, 0, 1).ok).toBe(true);
    expect(marketBuy(pf, 'GLB', 100, prices, 0, 1).ok).toBe(false);
  });
});

describe('mercato', () => {
  it('metriche corrette su una serie nota', () => {
    const m = metrics([100, 110, 99, 120]);
    expect(m.ret).toBeCloseTo(0.2, 5);
    expect(m.mdd).toBeCloseTo(0.1, 5);
  });
  it('gli scenari sono deterministici col seme', () => {
    const sc = mentorMission(1, 'stocks', 'equilibrato');
    if (sc.kind !== 'sim') throw new Error('atteso sim');
    const a = generateScenario(sc.scenario, ASSETS.slice(0, 5), 42);
    const b = generateScenario(sc.scenario, ASSETS.slice(0, 5), 42);
    expect(a.prices).toEqual(b.prices);
    for (const s of Object.values(a.prices)) for (const p of s) expect(p).toBeGreaterThan(0);
  });
  it('tutte le missioni di Mentori e Lega sono definite', () => {
    for (const t of ['stocks', 'etf', 'crypto', 'mixed'] as const) for (let m = 1; m <= 8; m++) expect(mentorMission(m, t, 'prudente').title).toBeTruthy();
    for (let i = 0; i < 5; i++) expect(leagueMission(i).title).toBeTruthy();
  });
});
