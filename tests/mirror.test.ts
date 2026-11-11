import { describe, it, expect, beforeEach } from 'vitest';
import { S, newGame } from '../src/systems/state';
import { recordMission, mirrorObs, revealedProfile, mirrorReport, obsScore, MIN_OBS } from '../src/systems/mirror';

const sim = (o: Partial<{ investedW: number; maxW: number; lossSales: number; mdd: number; orders: number }>) =>
  ({ investedW: 0.6, maxW: 0.3, lossSales: 0, mdd: 0.08, orders: 4, ...o });

describe('Specchio dell\'investitore', () => {
  beforeEach(() => newGame());

  it('servono almeno due missioni con ordini', () => {
    recordMission('m1', sim({ orders: 0 }));
    expect(mirrorObs()).toHaveLength(0);
    recordMission('m1', sim({}));
    expect(revealedProfile()).toBeNull();
    expect(mirrorReport().lines.join(' ')).toContain(`ancora ${MIN_OBS - 1} missione`);
  });

  it('tiene solo l\'ultima prova per missione', () => {
    recordMission('m1', sim({ investedW: 0.1 }));
    recordMission('m1', sim({ investedW: 0.9 }));
    expect(mirrorObs()).toHaveLength(1);
    expect(mirrorObs()[0].inv).toBe(0.9);
  });

  it('chi vende in perdita e resta poco investito risulta prudente', () => {
    recordMission('m6', sim({ investedW: 0.3, lossSales: 3 }));
    recordMission('m8', sim({ investedW: 0.35, lossSales: 2 }));
    expect(revealedProfile()).toBe('prudente');
    S.profile = 'audace';
    const r = mirrorReport();
    expect(r.lines[0]).toContain('più prudente');
    expect(r.lines.join(' ')).toContain('venduto in perdita 5 volte');
  });

  it('chi concentra e regge cali grandi risulta audace', () => {
    recordMission('m3', sim({ investedW: 0.95, maxW: 0.6, mdd: 0.2 }));
    recordMission('m7', sim({ investedW: 0.9, maxW: 0.5, mdd: 0.15 }));
    expect(revealedProfile()).toBe('audace');
    S.profile = 'audace';
    expect(mirrorReport().lines[0]).toContain('coincidono');
  });

  it('punteggio sempre nella scala 0-2 e dati salvati come testo nei flag', () => {
    expect(obsScore({ id: 'x', inv: 1, maxW: 1, loss: 0, mdd: 1, orders: 1 })).toBe(2);
    expect(obsScore({ id: 'x', inv: 0, maxW: 0, loss: 9, mdd: 0, orders: 1 })).toBe(0);
    recordMission('m1', sim({}));
    expect(typeof S.flags.mirror).toBe('string');
    S.flags.mirror = 'non json';
    expect(mirrorObs()).toEqual([]);
  });
});
