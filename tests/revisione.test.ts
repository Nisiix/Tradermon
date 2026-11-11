import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S, advanceDays } from '../src/systems/state';
import { simulatedCandles, aggregate, dayBars5m, sma, reading, TIMEFRAMES, BARS_SHOWN } from '../src/systems/candles';
import { resolveScenario, generateScenario } from '../src/systems/market';
import { mentorMission, processReview, type SimResult } from '../src/data/missions';
import { targetDiff, generatedCount, pickQuestions } from '../src/systems/quiz';
import { mentorTopics } from '../src/data/quiz/build';
import { topicCards, nextStep, missionStars } from '../src/ui/student';
import { headlines, weekSummary } from '../src/systems/gazette';
import { ASSETS } from '../src/data/assets';
import { presetTarget } from '../src/systems/portfolio';
import { isGenerated } from '../src/data/quiz/generated';
import { mulberry32 } from '../src/systems/rng';

describe('grafico a candele del conto di prova', () => {
  beforeEach(() => { newGame('Test', 0, 'stocks', 'equilibrato'); });

  it('un giorno diventa 78 barre a 5 minuti (288 per le cripto) che partono dalla chiusura precedente e arrivano alla chiusura', () => {
    const bars = dayBars5m('X', 3, 100, 104, 0.015, false);
    expect(bars.length).toBe(78);
    expect(bars[0].o).toBeCloseTo(100, 6);
    expect(bars[bars.length - 1].c).toBeCloseTo(104, 6);
    for (const b of bars) { expect(b.h).toBeGreaterThanOrEqual(Math.max(b.o, b.c)); expect(b.l).toBeLessThanOrEqual(Math.min(b.o, b.c)); expect(b.l).toBeGreaterThan(0); }
    expect(dayBars5m('X', 3, 100, 104, 0.015, true).length).toBe(288);
    // deterministico: stesso asset e giorno, stesse candele
    expect(dayBars5m('X', 3, 100, 104, 0.015, false)).toEqual(bars);
    expect(dayBars5m('X', 4, 100, 104, 0.015, false)).not.toEqual(bars);
  });

  it('aggregare a 1 ora conserva apertura, chiusura, massimo e minimo', () => {
    const b5 = dayBars5m('Y', 1, 50, 49, 0.02, true);
    const h = aggregate(b5, 60);
    expect(h.length).toBe(24);
    expect(h[0].o).toBe(b5[0].o);
    expect(h[0].c).toBe(b5[11].c);
    expect(h[0].h).toBe(Math.max(...b5.slice(0, 12).map((b) => b.h)));
    expect(h[0].l).toBe(Math.min(...b5.slice(0, 12).map((b) => b.l)));
  });

  it('ogni orizzonte riempie il grafico e le candele giornaliere seguono la storia dei prezzi', () => {
    const a = ASSETS[0];
    const hist = S.market.history[a.id];
    for (const tf of TIMEFRAMES) {
      const c = simulatedCandles(a.id, hist, tf, false, S.market.seed);
      expect(c.length, tf).toBe(BARS_SHOWN[tf]);
    }
    const d = simulatedCandles(a.id, hist, '1g', false, S.market.seed);
    expect(d[d.length - 1].c).toBeCloseTo(hist[hist.length - 1], 6);
    expect(d[d.length - 1].o).toBeCloseTo(hist[hist.length - 2], 6);
    const r = reading(d, '1g');
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    expect(sma(d, 20)[19]).not.toBeNull();
  });
});

describe('missioni: shock in un giorno casuale e stelle di processo', () => {
  it('lo spostamento vale per fasi e shock insieme e cambia con il seme', () => {
    const m8 = mentorMission(8, 'stocks', 'equilibrato');
    if (m8.kind !== 'sim') throw new Error('m8 deve essere una simulazione');
    const a = resolveScenario(m8.scenario, 1), b = resolveScenario(m8.scenario, 2);
    const off = (sc: typeof a) => sc.shocks[0].day - m8.scenario.shocks[0].day;
    expect(off(a)).not.toBe(off(b));
    expect(a.phases[0].until - m8.scenario.phases[0].until).toBe(off(a));
    expect(Math.abs(off(a))).toBeLessThanOrEqual(m8.scenario.jitter!);
    expect(a.phases[a.phases.length - 1].until).toBe(999);
    // la generazione dei prezzi usa lo scenario spostato: due semi diversi danno crolli in giorni diversi
    const assets = ASSETS.filter((x) => x.cls === 'stocks');
    const seriesA = generateScenario(m8.scenario, assets, 1);
    const crashDay = (idx: number[]) => idx.findIndex((v, i) => i > 0 && v / idx[i - 1] - 1 < -0.06);
    expect(crashDay(seriesA.index)).toBe(resolveScenario(m8.scenario, 1).shocks[0].day);
  });

  it('m7 richiede un minimo investito; m3 non annuncia più il giorno dello shock', () => {
    const m7 = mentorMission(7, 'stocks', 'equilibrato');
    const m3 = mentorMission(3, 'etf', 'prudente');
    if (m7.kind !== 'sim' || m3.kind !== 'sim') throw new Error();
    const base: SimResult = { values: Array(90).fill(10000), ret: 0, vol: 0, sharpe: 0, mdd: 0, orders: 2, limitFills: 0, monthlyBuys: 0, fees: 0, contributed: 10000, lossSales: 0, sectors: 2, maxW: 0.3, investedW: 0, finalValue: 10000, startValue: 10000, dripShareGrowth: 0 };
    expect(m7.check(base).ok).toBe(false);
    expect(m7.check({ ...base, investedW: 0.5 }).ok).toBe(true);
    expect(m3.brief).not.toContain('metà periodo');
    expect(m3.scenario.jitter).toBeGreaterThan(0);
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

  it('il Giornale racconta i giorni passati del mercato del mondo', () => {
    advanceDays(10);
    const hs = headlines(8);
    expect(hs.length).toBe(8);
    expect(hs[0].day).toBe(S.market.day);
    expect(hs[1].day).toBe(S.market.day - 1);
    expect(hs.every((h) => h.title.includes('%'))).toBe(true);
    expect(weekSummary()).toContain('Ultimi 5 giorni');
  });
});
