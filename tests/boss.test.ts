import { describe, it, expect } from 'vitest';
import { BOSSES, BOSS_RULES, planError, planScore, outcome, quizPoints, bossWon, sellOut, planPool, endRun } from '../src/systems/boss';
import type { BossState } from '../src/types';

const bar = (o: number, h: number, l: number, c: number) => ({ o, h, l, c });

describe('Boss dei Mercati: quiz, qualità del piano ed esito reale', () => {
  it('tre boss su tre orizzonti diversi; solo il più breve ripiega sulle cripto a mercato chiuso', () => {
    expect(BOSSES.map((b) => b.tf)).toEqual(['5Min', '1Hour', '1Day']);
    expect(BOSSES.filter((b) => b.cryptoOnlyWhenClosed).map((b) => b.id)).toEqual(['fulmine']);
  });
  it('il piano deve essere coerente: stop sotto, obiettivo sopra, rischio tra 0,5% e 5%', () => {
    expect(planError({ entry: 100, stop: 101, target: 110, risk: 0.01 })).toContain('stop');
    expect(planError({ entry: 100, stop: 95, target: 99, risk: 0.01 })).toContain('obiettivo');
    expect(planError({ entry: 100, stop: 95, target: 110, risk: 0.2 })).toContain('rischio');
    expect(planError({ entry: 100, stop: 95, target: 110, risk: 0.01 })).toBe('');
  });
  it('la qualità premia rapporto rendimento/rischio, rischio piccolo e stop fuori dal rumore', () => {
    const good = planScore({ entry: 100, stop: 97, target: 106, risk: 0.01 }, 0.01);
    expect(good.points).toBe(BOSS_RULES.planMax);
    expect(planScore({ entry: 100, stop: 97, target: 101, risk: 0.05 }, 0.01).points).toBeLessThan(15);
    // stop dentro le oscillazioni normali
    expect(planScore({ entry: 100, stop: 99.95, target: 100.2, risk: 0.01 }, 0.01).notes[2].ok).toBe(false);
  });
  it('l\'esito segue le barre reali: stop, obiettivo, scadenza, gap e caso prudente nella stessa candela', () => {
    const p = { entry: 100, stop: 95, target: 110 };
    expect(outcome(p, [bar(100, 104, 99, 103), bar(103, 111, 102, 110)])).toMatchObject({ how: 'obiettivo', r: 2, points: 30 });
    expect(outcome(p, [bar(100, 101, 94, 96)])).toMatchObject({ how: 'stop', r: -1, points: 0 });
    expect(outcome(p, [bar(100, 112, 94, 100)]).how).toBe('stop'); // entrambi toccati: vale lo stop
    const gap = outcome(p, [bar(90, 92, 89, 91)]);
    expect(gap.exit).toBe(90);
    expect(gap.points).toBe(0);
    expect(outcome(p, [bar(100, 103, 99, 102)])).toMatchObject({ how: 'scadenza', points: 20 });
    expect(outcome(p, []).r).toBe(0);
  });
  it('quiz e piano fatti bene bastano: l\'esito reale non è mai l\'unica via per vincere', () => {
    expect(quizPoints(8, 8)).toBe(BOSS_RULES.quizMax);
    expect(bossWon(quizPoints(8, 8), BOSS_RULES.planMax, 0)).toBe(true);
    expect(bossWon(quizPoints(7, 8), BOSS_RULES.planMax, 0)).toBe(false); // 7 su 8 e stop pieno: non basta
    expect(bossWon(quizPoints(7, 8), BOSS_RULES.planMax, 10)).toBe(true);
    expect(bossWon(quizPoints(BOSS_RULES.quizMin, 8), BOSS_RULES.planMax, 20)).toBe(true);
    // un esito fortunato non salva un piano costruito male
    expect(bossWon(quizPoints(5, 8), 8, BOSS_RULES.outcomeMax)).toBe(false);
  });
});

describe('vendere durante un mandato annulla la sfida', () => {
  const plan = { asset: 'AAPL', side: 'long' as const, entry: 100, stop: 95, target: 110, risk: 0.01, placedAt: 1, deadline: 2, quality: 20 };
  const state = (): BossState => ({ run: null, runs: { marea: { id: 'marea', quiz: 6, quizMax: 8, plan: { ...plan }, startedAt: 1 } }, beaten: [], tries: {} });

  it('la vendita, anche parziale, cancella la sfida in corso (quiz compreso) e non conta come sconfitta', () => {
    const b = state();
    expect(sellOut(b, 'marea')).toBe('AAPL');
    expect(b.runs!.marea).toBeUndefined();
    expect(b.tries.marea ?? 0).toBe(0);
  });
  it('la sfida si ripete con un titolo diverso: quello venduto esce dalla scelta di quel Boss, non degli altri', () => {
    const b = state();
    sellOut(b, 'marea');
    const pool = [{ id: 'AAPL' }, { id: 'KO' }];
    expect(planPool(pool, b, 'marea').map((a) => a.id)).toEqual(['KO']);
    expect(planPool(pool, b, 'fulmine').map((a) => a.id)).toEqual(['AAPL', 'KO']);
  });
  it('senza un piano in corso non c\'è nulla da vendere', () => {
    const b = state();
    b.runs!.marea.plan = null;
    expect(sellOut(b, 'marea')).toBeNull();
    expect(b.runs!.marea).toBeDefined();
    expect(sellOut(b, 'ghiacciaio')).toBeNull();
  });
  it('chiusa la sfida ripetuta (vinta o persa) il titolo torna disponibile', () => {
    const b = state();
    sellOut(b, 'marea');
    // quiz rifatto e fallito prima di un nuovo piano: il titolo venduto resta escluso
    b.runs!.marea = { id: 'marea', quiz: 6, quizMax: 8, plan: null, startedAt: 2 };
    endRun(b, 'marea');
    expect(planPool([{ id: 'AAPL' }], b, 'marea')).toHaveLength(0);
    b.runs!.marea = { id: 'marea', quiz: 6, quizMax: 8, plan: { ...plan, asset: 'KO' }, startedAt: 3 };
    endRun(b, 'marea');
    expect(b.runs!.marea).toBeUndefined();
    expect(planPool([{ id: 'AAPL' }], b, 'marea')).toHaveLength(1);
  });
});
