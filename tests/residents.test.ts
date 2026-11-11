import { describe, it, expect } from 'vitest';
import { HOUSEHOLDS, ALL_RESIDENTS } from '../src/data/residents';
import { SOURCES } from '../src/data/sources';
import { TOWNS } from '../src/data/story';
import { getMap } from '../src/world/maps';
import { CHAR_PALETTES } from '../src/art/art';

describe('case e abitanti', () => {
  it('ogni nucleo ha il numero giusto di persone', () => {
    const size = { single: 1, couple: 2, family: 3 };
    for (const h of HOUSEHOLDS.flat()) expect(h.people.length, h.id).toBe(size[h.kind]);
  });
  it('nessun consiglio ripetuto: argomenti, id e testi unici', () => {
    const topics = ALL_RESIDENTS.map((r) => r.topic);
    expect(new Set(topics).size).toBe(topics.length);
    expect(new Set(ALL_RESIDENTS.map((r) => r.id)).size).toBe(ALL_RESIDENTS.length);
    const lines = ALL_RESIDENTS.flatMap((r) => r.lines);
    expect(new Set(lines).size).toBe(lines.length);
  });
  it('ogni consiglio cita una fonte esistente e usa una tavolozza valida', () => {
    for (const r of ALL_RESIDENTS) {
      expect(SOURCES[r.source], r.id).toBeDefined();
      expect(r.pal).toBeLessThan(CHAR_PALETTES.length);
    }
  });
  it('ogni città ha le sue case collegate e visitabili', () => {
    for (let n = 0; n <= 8; n++) {
      const town = getMap(TOWNS[n].id);
      for (const h of HOUSEHOLDS[n]) {
        expect(town.warps.some((w) => w.to === h.id), `${TOWNS[n].id} → ${h.id}`).toBe(true);
        const inside = getMap(h.id);
        expect(inside.npcs.filter((x) => x.kind === 'resident').length).toBe(h.people.length);
        expect(inside.warps[0].to).toBe(TOWNS[n].id);
      }
    }
    for (let n = 1; n <= 8; n++) expect(HOUSEHOLDS[n].length).toBe(TOWNS[n].special ? 3 : 4);
  });
});
