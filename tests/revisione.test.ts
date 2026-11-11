import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { aggregate, sma, reading } from '../src/systems/candles';
// candele generate: servono solo ai test (il gioco mostra soltanto barre reali di Alpaca)
import { dayBars5m, simulatedCandles } from './helpers/candles-sim';
import { mentorMission, processReview, type SimResult } from '../src/data/missions';
import { targetDiff, generatedCount, pickQuestions } from '../src/systems/quiz';
import { mentorTopics } from '../src/data/quiz/build';
import { topicCards, nextStep, missionStars } from '../src/ui/student';
import { headlines, weekSummary } from '../src/systems/gazette';
import { ASSETS } from '../src/data/assets';
import { presetTarget } from '../src/systems/portfolio';
import { isGenerated } from '../src/data/quiz/generated';
import { mulberry32 } from '../src/systems/rng';

describe('grafico a candele', () => {
  beforeEach(() => { newGame('Test', 0, 'stocks', 'equilibrato'); });

  it('aggregare a 1 ora conserva apertura, chiusura, massimo e minimo', () => {
    const b5 = dayBars5m('Y', 1, 50, 49, 0.02, true);
    const h = aggregate(b5, 60);
    expect(h.length).toBe(24);
    expect(h[0].o).toBe(b5[0].o);
    expect(h[0].c).toBe(b5[11].c);
    expect(h[0].h).toBe(Math.max(...b5.slice(0, 12).map((b) => b.h)));
    expect(h[0].l).toBe(Math.min(...b5.slice(0, 12).map((b) => b.l)));
  });

  it('media mobile e lettura didattica funzionano su una serie di candele giornaliere', () => {
    const hist = Array.from({ length: 140 }, (_, i) => 100 * (1 + i * 0.002));
    const d = simulatedCandles('AAPL', hist, '1g', false, 7);
    expect(d[d.length - 1].c).toBeCloseTo(hist[hist.length - 1], 6);
    const r = reading(d, '1g');
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    expect(r.trend).toBe('su');
    expect(sma(d, 20)[19]).not.toBeNull();
    expect(sma(d, 20)[18]).toBeNull();
  });
});

describe('missioni sui periodi reali e stelle di processo', () => {
  it('m7 richiede un minimo investito; m3 non rivela il periodo né il giorno dello shock', () => {
    const m7 = mentorMission(7, 'stocks', 'equilibrato');
    const m3 = mentorMission(3, 'etf', 'prudente');
    if (m7.kind !== 'sim' || m3.kind !== 'sim') throw new Error();
    const base: SimResult = { values: Array(90).fill(10000), ret: 0, vol: 0, sharpe: 0, mdd: 0, orders: 2, limitFills: 0, monthlyBuys: 0, fees: 0, contributed: 10000, lossSales: 0, sectors: 2, maxW: 0.3, investedW: 0, finalValue: 10000, startValue: 10000, dripShareGrowth: 0 };
    expect(m7.check(base).ok).toBe(false);
    expect(m7.check({ ...base, investedW: 0.5 }).ok).toBe(true);
    expect(m3.brief).not.toContain('metà periodo');
    expect(m3.brief).not.toMatch(/20\d\d/);
    expect(m3.scenario.window.start).toMatch(/^20\d\d-/);
  });

  it('le stelle di processo premiano diversificazione, niente vendite nel panico e poche operazioni', () => {
    const good: SimResult = { values: Array(60).fill(1), ret: 0.1, vol: 0.1, sharpe: 1, mdd: 0.05, orders: 4, limitFills: 0, monthlyBuys: 0, fees: 0, contributed: 1, lossSales: 0, sectors: 3, maxW: 0.3, investedW: 0.8, finalValue: 1.1, startValue: 1, dripShareGrowth: 0 };
    expect(processReview(good).stars).toBe(3);
    expect(processReview({ ...good, maxW: 0.7 }).stars).toBe(2);
    expect(processReview({ ...good, lossSales: 2, orders: 40 }).stars).toBe(1);
  });
});

describe('Nuova Partita+, profilo e strumenti di studio', () => {
  beforeEach(() => { newGame('Test', 0, 'stocks', 'equilibrato'); });

  it('in Nuova Partita+ le domande sono più difficili e più spesso generate', () => {
    expect(targetDiff(0)).toBe(1);
    expect(generatedCount(8)).toBe(2);
    S.ngPlus = 1;
    expect(targetDiff(0)).toBe(1.5);
    expect(targetDiff(12)).toBe(4);
    expect(generatedCount(8)).toBe(4);
    const qs = pickQuestions(mentorTopics(1, 'stocks', []), 8, { target: targetDiff(0), rng: mulberry32(5) });
    expect(qs.filter((q) => isGenerated(q.id)).length).toBeGreaterThanOrEqual(2);
    expect(qs.some((q) => q.diff === 2)).toBe(true);
  });

  it('il preset dell\'allocazione dipende dal profilo e somma a 100', () => {
    for (const p of ['prudente', 'equilibrato', 'audace']) { const t = presetTarget(p); expect(t.risky + t.defensive + t.cash).toBe(100); }
    expect(presetTarget('prudente').risky).toBeLessThan(presetTarget('audace').risky);
  });

  it('la Cartella dello studente elenca gli argomenti del percorso e propone un passo successivo', () => {
    const cards = topicCards();
    expect(cards.map((c) => c.topic)).toContain('rischio');
    expect(cards.map((c) => c.topic)).toContain('macro');
    expect(cards.every((c) => c.total >= 12)).toBe(true);
    expect(nextStep(cards)).toContain('Mentore');
    expect(missionStars().length).toBe(8);
  });

  it('il Giornale racconta le sedute reali scaricate, e senza prezzi lo dice', () => {
    expect(headlines(8).length).toBe(0);
    expect(weekSummary()).toContain('Nessun prezzo reale');
    // chiusure di prova messe a mano al posto di quelle scaricate da Alpaca
    for (const a of ASSETS) S.market.history[a.id] = Array.from({ length: 30 }, (_, i) => 100 + i + (a.id.length % 3));
    S.market.index = Array.from({ length: 30 }, (_, i) => 100 + i);
    S.market.day = 12;
    const hs = headlines(8);
    expect(hs.length).toBe(8);
    expect(hs[0].day).toBe(12);
    expect(hs[1].day).toBe(11);
    expect(hs.every((h) => h.title.includes('%'))).toBe(true);
    expect(weekSummary()).toContain('Ultime 5 sedute reali');
  });
});
