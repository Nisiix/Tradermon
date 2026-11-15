import { describe, it, expect } from 'vitest';
import { TRACKS, trackForMap, type TrackId } from '../src/systems/music';

// Musica: esplorazione e sfida si distinguono, e nessun brano è stridente.
const N: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const top = (id: TrackId) => {
  const t = TRACKS[id];
  let mx = 0;
  for (const b of t.lead) for (const tok of b.split(/\s+/)) {
    const m = /^([A-G]#?)(\d)$/.exec(tok);
    if (m) mx = Math.max(mx, 12 * (+m[2] + 1) + N[m[1]] + t.key + (t.shift ?? 0));
  }
  return mx;
};
const EXPLORE: TrackId[] = ['title', 'town', 'route', 'interior', 'night', 'cave_gold', 'cave_dp', 'cave_pearl'];
const CHALLENGE: TrackId[] = ['battle', 'league', 'academy'];

describe('musica', () => {
  it('nessuna melodia sale oltre il Si5 (circa 990 Hz) e nessun brano usa l\'onda quadra', () => {
    for (const id of Object.keys(TRACKS) as TrackId[]) {
      expect(top(id), id).toBeLessThanOrEqual(83);
      expect(TRACKS[id].leadWave, id).not.toBe('square');
      expect(TRACKS[id].lp, id).toBeGreaterThan(0);
    }
  });
  it('l\'esplorazione è calma e morbida, la sfida è in minore e più veloce', () => {
    for (const id of EXPLORE) {
      expect(TRACKS[id].challenge, id).toBeFalsy();
      expect(TRACKS[id].bpm, id).toBeLessThanOrEqual(108);
      expect(TRACKS[id].drums.split('').filter((d) => d === 'h').length, id).toBeLessThanOrEqual(1);
    }
    for (const id of CHALLENGE) {
      expect(TRACKS[id].challenge, id).toBe(true);
      expect(TRACKS[id].minor, id).toBe(true);
    }
    const slowestChallenge = Math.min(...CHALLENGE.map((id) => TRACKS[id].bpm));
    const fastestTownOrRoute = Math.max(TRACKS.town.bpm, TRACKS.route.bpm);
    expect(slowestChallenge).toBeGreaterThan(fastestTownOrRoute);
  });
  it('città e percorsi suonano brani di esplorazione, Wall Street e la Torre quello di sfida', () => {
    expect(EXPLORE).toContain(trackForMap('t1', false, false));
    expect(EXPLORE).toContain(trackForMap('r2', false, false));
    expect(trackForMap('league', true, false)).toBe('league');
  });
});
