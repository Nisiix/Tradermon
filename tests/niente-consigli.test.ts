import { describe, it, expect } from 'vitest';
import { reading } from '../src/systems/candles';
import { simulatedCandles } from './helpers/candles-sim';
import { newPortfolio, rebalanceGap, maxGap } from '../src/systems/portfolio';

// Il gioco è educativo: le letture del grafico e il ribilanciamento descrivono e calcolano, non dicono come operare.
const OPERATIVE = /\b(meglio entrare|conviene|compra ora|vendi ora|entra ora|sono coerenti|ti consiglio)\b/i;

describe('niente consigli operativi', () => {
  it('la lettura del grafico descrive e fa domande, senza indicazioni su come entrare', () => {
    const series = [
      Array.from({ length: 140 }, (_, i) => 100 * (1 + i * 0.002)),
      Array.from({ length: 140 }, (_, i) => 100 * (1 - i * 0.002)),
      Array.from({ length: 140 }, (_, i) => 100 + Math.sin(i / 3)),
    ];
    for (const hist of series) {
      for (const tf of ['1g', '1h', '5m'] as const) {
        const r = reading(simulatedCandles('AAPL', hist, tf, false, 7), tf);
        for (const l of r.lines) expect(l).not.toMatch(OPERATIVE);
      }
    }
  });

  it('il calcolo del ribilanciamento dà scostamenti per gruppo, mai ordini su titoli', () => {
    const pf = newPortfolio(1000, 0, 'equilibrato');
    pf.target = { risky: 50, defensive: 40, cash: 10 };
    pf.cash = 200;
    pf.positions = [{ id: 'AAPL', qty: 8, cost: 800 }];
    const gaps = rebalanceGap(pf, { AAPL: 100 });
    expect(gaps.map((g) => g.group)).toEqual(['risky', 'defensive', 'cash']);
    const risky = gaps.find((g) => g.group === 'risky')!;
    expect(risky.now).toBeCloseTo(80, 5);
    expect(risky.amount).toBeCloseTo(-300, 5);
    expect(maxGap(gaps)).toBeCloseTo(40, 5);
    for (const g of gaps) expect(Object.keys(g)).not.toContain('id');
  });
});

import { pctArt } from '../src/systems/portfolio';
describe('percentuali con articolo', () => {
  it('elide davanti a 1, 8, 11 e 80-89', () => {
    expect(pctArt(60, 'al')).toBe('al 60%');
    expect(pctArt(82, 'al')).toBe("all'82%");
    expect(pctArt(8)).toBe("l'8%");
    expect(pctArt(11)).toBe("l'11%");
    expect(pctArt(18)).toBe('il 18%');
  });
});
