import { describe, it, expect } from 'vitest';
import { profileFromScore, profileTimer, S, newGame } from '../src/systems/state';
import { mentorMission } from '../src/data/missions';
import { presetTarget, newPortfolio } from '../src/systems/portfolio';
import type { RiskProfile, Track } from '../src/types';

const PROFILES: RiskProfile[] = ['prudente', 'equilibrato', 'audace'];

describe('profilo di rischio', () => {
  it('soglie sulle 3 domande di rischio (0-6)', () => {
    expect([0, 1].map(profileFromScore)).toEqual(['prudente', 'prudente']);
    expect([2, 3].map(profileFromScore)).toEqual(['equilibrato', 'equilibrato']);
    expect([4, 5, 6].map(profileFromScore)).toEqual(['audace', 'audace', 'audace']);
  });

  it('non cambia le regole: timer e missioni uguali per tutti', () => {
    newGame();
    const timers = PROFILES.map((p) => { S.profile = p; return profileTimer(); });
    expect(new Set(timers).size).toBe(1);
    for (const track of ['listed', 'crypto', 'mixed'] as Track[]) {
      for (let m = 1; m <= 8; m++) {
        const briefs = PROFILES.map((p) => mentorMission(m, track, p).brief);
        expect(new Set(briefs).size, `missione ${m} ${track}`).toBe(1);
      }
    }
  });

  it('propone solo l\'allocazione obiettivo', () => {
    for (const p of PROFILES) {
      const t = presetTarget(p);
      expect(t.risky + t.defensive + t.cash).toBe(100);
      expect(newPortfolio(1000, 0, p).target).toEqual(t);
    }
  });
});
