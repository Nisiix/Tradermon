import { describe, it, expect } from 'vitest';
import { BOSSES, BOSS_RULES, planError, planScore, outcome, quizPoints, bossWon } from '../src/systems/boss';

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
    expect(outcome(p, [bar(100, 101, 94, 96)])).toMatchObject({ how: 'stop', r: -1, points: 5 });
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
    expect(bossWon(quizPoints(BOSS_RULES.quizMin, 8), BOSS_RULES.planMax, 5)).toBe(false);
    expect(bossWon(quizPoints(BOSS_RULES.quizMin, 8), BOSS_RULES.planMax, 20)).toBe(true);
    // un esito fortunato non salva un piano costruito male
    expect(bossWon(quizPoints(5, 8), 8, BOSS_RULES.outcomeMax)).toBe(false);
  });
});
