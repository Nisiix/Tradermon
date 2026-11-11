import { describe, it, expect } from 'vitest';
import { newPortfolio, marketBuy, marketSell, value } from '../src/systems/portfolio';
import { metrics, tradingDaysBetween } from '../src/systems/market';
import { alignBars } from '../src/systems/realdata';
import { mentorMission, leagueMission } from '../src/data/missions';

describe('portafoglio', () => {
  const prices = { AAPL: 100, KO: 50 };
  it('acquisto e vendita con costi, senza leva né vendite allo scoperto', () => {
    const pf = newPortfolio(1000, 0, 'equilibrato');
    // costo didattico dello 0,5% (difficoltà Leggenda): è trattenuto dall'importo, non dal prezzo
    expect(marketBuy(pf, 'AAPL', 500, prices, 0, 10, 'mercato', undefined, 0.005).ok).toBe(true);
    expect(pf.cash).toBeCloseTo(500, 6);
    const pos = pf.positions.find((p) => p.id === 'AAPL')!;
    expect(pos.qty).toBeGreaterThan(4.9);
    expect(value(pf, prices)).toBeLessThan(1000);
    expect(value(pf, prices)).toBeGreaterThan(1000 - 2.5 - 5);
    expect(marketBuy(pf, 'KO', 5000, prices, 0, 10).ok).toBe(false); // niente margine
    expect(marketSell(pf, 'KO', 1, prices, 0).ok).toBe(false); // niente scoperto
    expect(marketSell(pf, 'AAPL', 1000, prices, 1).ok).toBe(true); // vende al massimo ciò che possiede
    expect(pf.positions.length).toBe(0);
    expect(pf.cash).toBeLessThan(1000);
  });
  it('rispetta il numero massimo di posizioni', () => {
    const pf = newPortfolio(1000, 0, 'equilibrato');
    expect(marketBuy(pf, 'AAPL', 100, prices, 0, 1).ok).toBe(true);
    expect(marketBuy(pf, 'KO', 100, prices, 0, 1).ok).toBe(false);
  });
});

describe('mercato', () => {
  it('metriche corrette su una serie nota', () => {
    const m = metrics([100, 110, 99, 120]);
    expect(m.ret).toBeCloseTo(0.2, 5);
    expect(m.mdd).toBeCloseTo(0.1, 5);
  });
  it('allinea le chiusure reali sulle date di borsa senza inventare prezzi', () => {
    const d = (n: number) => `2024-01-${String(n).padStart(2, '0')}T05:00:00Z`;
    const bars = {
      AAA: [2, 3, 4, 5, 8].map((n, i) => ({ t: d(n), c: 100 + i })),
      // la cripto ha anche sabato e domenica: restano solo le date di borsa
      'BTC/USD': [2, 3, 4, 5, 6, 7, 8].map((n) => ({ t: d(n), c: 1000 + n })),
      // un titolo quotato a metà periodo non viene "riempito all'indietro": è scartato
      NEW: [5, 8].map((n) => ({ t: d(n), c: 10 })),
      // un giorno mancante prende l'ultima chiusura nota
      GAP: [2, 3, 5, 8].map((n) => ({ t: d(n), c: 50 + n })),
    };
    const al = alignBars(bars, ['AAA', 'BTC/USD', 'NEW', 'GAP', 'NONE'], 0.7);
    expect(al.dates).toEqual(['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08']);
    expect(al.ids).toEqual(['AAA', 'BTC/USD', 'GAP']);
    expect(al.prices['BTC/USD']).toEqual([1002, 1003, 1004, 1005, 1008]);
    expect(al.prices.GAP).toEqual([52, 53, 53, 55, 58]);
    expect(alignBars({}, ['AAA']).ids).toEqual([]);
  });
  it('il tempo del conto è quello dei mercati: contano solo i giorni feriali', () => {
    const mon = Date.UTC(2026, 10, 9, 15), nextMon = Date.UTC(2026, 10, 16, 15);
    expect(tradingDaysBetween(mon, nextMon)).toBe(5);
    expect(tradingDaysBetween(nextMon, mon)).toBe(0);
  });
  it('ogni missione pratica dei Mentori e della Lega ha una finestra reale, anche per i percorsi con le cripto', () => {
    const check = (m: ReturnType<typeof mentorMission>) => {
      if (m.kind !== 'sim') return;
      const w = m.scenario.window;
      expect(Date.parse(w.start)).toBeLessThan(Date.parse(w.end));
      expect(Date.parse(w.start)).toBeGreaterThan(Date.parse('2016-01-01')); // lo storico gratuito di Alpaca parte dal 2016
      if (w.crypto) expect(Date.parse(w.crypto.start)).toBeGreaterThan(Date.parse('2021-01-01'));
    };
    for (const t of ['stocks', 'etf', 'crypto', 'mixed'] as const) for (let m = 1; m <= 8; m++) check(mentorMission(m, t, 'equilibrato'));
    for (let i = 0; i < 5; i++) check(leagueMission(i));
  });
  it('tutte le missioni di Mentori e Lega sono definite', () => {
    for (const t of ['stocks', 'etf', 'crypto', 'mixed'] as const) for (let m = 1; m <= 8; m++) expect(mentorMission(m, t, 'prudente').title).toBeTruthy();
    for (let i = 0; i < 5; i++) expect(leagueMission(i).title).toBeTruthy();
  });
});
