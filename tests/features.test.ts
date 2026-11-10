import { describe, it, expect } from 'vitest';
import { weekKey, ACHIEVEMENTS, DECOR_INFO } from '../src/systems/progress';
import { makeCode, parseCode } from '../src/ui/challenge';
import { QUESTS } from '../src/world/quests';
import { RESIDENT_BY_ID } from '../src/data/residents';
import { LESSONS } from '../src/data/lessons';
import { LEGENDS, HISTORY } from '../src/data/missions';
import { DECOR_TILE, TILE, TILE_COUNT } from '../src/art/art';
import { trackForMap } from '../src/systems/music';
import { REASONS } from '../src/ui/journal';

describe('agenda e traguardi', () => {
  it('la chiave della settimana segue le settimane ISO', () => {
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(weekKey(new Date(2024, 11, 30))).toBe('2025-W01');
    expect(weekKey(new Date(2026, 10, 10))).toBe('2026-W46');
  });
  it('ogni oggetto dei traguardi ha un tile di arredo', () => {
    for (const a of ACHIEVEMENTS) if (a.decor) expect(DECOR_INFO[a.decor], a.id).toBeDefined();
    for (const d of Object.values(DECOR_INFO)) expect(DECOR_TILE[d.tile], d.name).toBeDefined();
    expect(Math.max(...Object.values(DECOR_TILE))).toBeLessThan(TILE_COUNT);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('sfida della settimana', () => {
  it('il codice si rilegge e rifiuta manomissioni', () => {
    const code = makeCode('2026-W46', 85, 'Nisiix');
    expect(code.startsWith('TS-2026W46-NISIIX-85-')).toBe(true);
    expect(parseCode(code)).toEqual({ week: '2026-W46', name: 'NISIIX', score: 85 });
    expect(parseCode(code.replace('-85-', '-99-'))).toBeNull();
    expect(parseCode('TS-ciao')).toBeNull();
  });
});

describe('storie degli abitanti', () => {
  it('chi dà la storia, i bersagli e le lezioni esistono', () => {
    for (const q of QUESTS) {
      expect(RESIDENT_BY_ID[q.giver], q.id).toBeDefined();
      for (const s of q.steps) {
        if (s.kind === 'talk') { expect(RESIDENT_BY_ID[s.target!], `${q.id} ${s.target}`).toBeDefined(); expect(s.targetLine?.length).toBeGreaterThan(0); }
        if (s.kind === 'lesson') expect(LESSONS.some((l) => l.id === s.target), `${q.id} ${s.target}`).toBe(true);
        if (s.kind === 'duel') expect(s.topics?.length).toBeGreaterThan(0);
        expect(s.say.length).toBeGreaterThan(0); expect(s.done.length).toBeGreaterThan(0);
      }
      if (q.decor) expect(DECOR_INFO[q.decor], q.id).toBeDefined();
    }
    expect(new Set(QUESTS.map((q) => q.giver)).size).toBe(QUESTS.length);
  });
});

describe('scenari storici, musica e diario', () => {
  it('ogni crisi leggendaria ha la sua spiegazione storica', () => {
    for (const l of LEGENDS) { expect(HISTORY[l.id], l.id).toBeDefined(); expect(HISTORY[l.id].cause.length).toBeGreaterThan(100); }
  });
  it('la mappa sceglie il brano giusto', () => {
    expect(trackForMap('t0', false, false)).toBe('town');
    expect(trackForMap('r3', false, true)).toBe('night');
    expect(trackForMap('academy_2', true, false)).toBe('academy');
    expect(trackForMap('league', true, false)).toBe('league');
    expect(trackForMap('h1_moretti', true, false)).toBe('interior');
  });
  it('i motivi del diario hanno tutti un commento e una finestra notturna esiste', () => {
    for (const r of REASONS) expect(r.comment.length).toBeGreaterThan(20);
    expect(TILE.WINDOW).toBeLessThan(TILE_COUNT);
  });
});
