import { describe, it, expect } from 'vitest';
import { CHAR_PALETTES, PALETTES, PAL, lookPal, lookPoolOf } from '../src/art/art';
import { CROWD, SKINS } from '../src/art/looks';
import { getMap, allMapIds } from '../src/world/maps';
import { HOUSEHOLDS } from '../src/data/residents';


describe('aspetti dei personaggi', () => {
  it('la folla usa tutte le carnagioni e combinazioni diverse', () => {
    expect(new Set(CROWD.map((l) => l.skin)).size).toBe(SKINS.length);
    expect(new Set(CROWD.map((l) => `${l.skin}${l.hair}${l.shirt}${l.pants}`)).size).toBe(CROWD.length);
    expect(new Set(CROWD.map((l) => l.eyes)).size).toBeGreaterThan(4);
  });

  it('lo stesso id dà sempre lo stesso aspetto', () => {
    expect(lookPal('res_eleonora')).toBe(lookPal('res_eleonora'));
    expect(lookPoolOf(lookPal('x', 'guard'))).toBe('guard');
    expect(lookPal('x')).toBeGreaterThanOrEqual(PALETTES.length);
    expect(lookPal('x')).toBeLessThan(CHAR_PALETTES.length);
  });

  it('nella stessa mappa i personaggi generici non sono uguali', () => {
    for (const id of allMapIds()) {
      const m = getMap(id);
      const gen = m.npcs.filter((n) => !n.hiddenSprite && lookPoolOf(n.pal));
      expect(new Set(gen.map((n) => n.pal)).size, id).toBe(gen.length);
    }
  });

  it('i personaggi principali mantengono il loro aspetto', () => {
    const lab = getMap('lab');
    expect(lab.npcs.find((n) => n.id === 'prof')?.pal).toBe(PAL.PROF);
    expect(lab.npcs.find((n) => n.id === 'lab_rival')?.pal).toBe(PAL.RIVAL);
    expect(getMap('r8').npcs.find((n) => n.id === 'r8_boss')?.pal).toBe(PAL.SPEC);
  });

  it('in una casa nessun abitante ha lo stesso aspetto', () => {
    for (const town of HOUSEHOLDS) for (const h of town) expect(new Set(h.people.map((p) => p.pal)).size).toBe(h.people.length);
  });
});
