import { describe, it, expect } from 'vitest';
import { errorsAllowed, errorsLeft, lifeStep, lifeAfterWrong, lifeShown } from '../src/systems/duelLife';
import { DUEL } from '../src/systems/balance';

/** Simula solo errori da vita piena: quanti ne servono per arrivare a zero. */
function wrongsToZero(n: number, need: number, start = 100): number {
  let life = start, w = 0;
  while (lifeShown(life) > 0) { w++; life = lifeAfterWrong(life, w, n, need); }
  return w;
}

describe('vita del giocatore nei duelli', () => {
  it('scende a zero esattamente con l\'errore che rende impossibile vincere, per ogni preset', () => {
    for (const [k, p] of Object.entries(DUEL)) {
      expect(wrongsToZero(p.n, p.need), k).toBe(p.n - p.need + 1);
    }
  });

  it('cala a passi uguali, speculare alla Convinzione dell\'avversario', () => {
    expect(errorsAllowed(3, 2)).toBe(1);
    expect(lifeStep(3, 2)).toBe(50);
    expect(lifeStep(8, 6)).toBeCloseTo(100 / 3);
    let life = 100;
    life = lifeAfterWrong(life, 1, 8, 6); expect(lifeShown(life)).toBe(67);
    life = lifeAfterWrong(life, 2, 8, 6); expect(lifeShown(life)).toBe(34);
    life = lifeAfterWrong(life, 3, 8, 6); expect(lifeShown(life)).toBe(0);
  });

  it('a errori concessi finiti va a zero anche se la vita era risalita con le risposte giuste', () => {
    expect(lifeAfterWrong(100, 2, 3, 2)).toBe(0);
  });

  it('se si parte con poca Fiducia si va in tilt prima di finire gli errori concessi', () => {
    expect(wrongsToZero(8, 6, 40)).toBe(2);
  });

  it('con zero errori concessi il primo errore azzera la vita', () => {
    expect(wrongsToZero(3, 3)).toBe(1);
    expect(wrongsToZero(5, 6)).toBe(1);
  });
});

describe('errori ancora possibili', () => {
  it('a vita piena coincidono con gli errori concessi', () => {
    expect(errorsLeft(100, 0, 8, 6)).toBe(2);
    expect(errorsLeft(100, 0, 3, 3)).toBe(0);
  });
  it('con poca Fiducia sono meno dei concessi', () => {
    expect(errorsLeft(40, 0, 8, 6)).toBe(1);
    expect(errorsLeft(30, 0, 8, 6)).toBe(0);
  });
});

describe('Fiducia recuperata vincendo', () => {
  it('scende con la difficoltà e non supera 100', async () => {
    const { DIFFICULTY, DIFFICULTIES } = await import('../src/systems/balance');
    const { fiduciaAfterWin } = await import('../src/systems/duelLife');
    const gains = DIFFICULTIES.map((d) => DIFFICULTY[d].fiduciaWin);
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeLessThan(gains[i - 1]);
    expect(fiduciaAfterWin(90, 40)).toBe(100);
    expect(fiduciaAfterWin(4, 10)).toBe(14);
  });
});
