import { describe, it, expect } from 'vitest';
import { getMap } from '../src/world/maps';
import { SOLID, TILE } from '../src/art/art';
import { LEDGER_PAGES, TAPE_SHELF, TAPE_ROOM, HODL_STONE, WHALE, SECRET_BADGE, isWeekend } from '../src/world/secretsData';
import { ACHIEVEMENTS } from '../src/systems/progress';
import { explore, key, mapsOf } from './reachSim';

const near = (seen: Set<string>, map: string, x: number, y: number) =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(map, x + dx, y + dy)));

describe('segreti della seconda parte', () => {
  it('le pagine del Libro Mastro stanno su caselle libere, una per posto, e si raggiungono con tutte le Medaglie', () => {
    const seen = explore(8).seen;
    const spots = new Set<string>();
    for (const p of LEDGER_PAGES) {
      const m = getMap(p.map);
      expect(m, p.id).toBeDefined();
      expect(SOLID.has(m.tiles[p.y][p.x]), `${p.id} su un tile solido`).toBe(false);
      expect(m.warps.some((w) => w.x === p.x && w.y === p.y) || m.npcs.some((n) => n.x === p.x && n.y === p.y), `${p.id} occupata`).toBe(false);
      expect(near(seen, p.map, p.x, p.y), `${p.id} irraggiungibile`).toBe(true);
      spots.add(key(p.map, p.x, p.y));
    }
    expect(spots.size).toBe(LEDGER_PAGES.length);
  });

  it('la Sala del Nastro si apre solo dalla Medaglia 4 e ha l\'uscita verso la Biblioteca', () => {
    expect(SECRET_BADGE).toBe(4);
    expect(mapsOf(explore(3).seen).has(TAPE_ROOM)).toBe(false);
    expect(mapsOf(explore(4).seen).has(TAPE_ROOM)).toBe(true);
    const lib = getMap(TAPE_SHELF.map);
    expect(lib.tiles[TAPE_SHELF.y][TAPE_SHELF.x]).toBe(TILE.SHELF);
    expect(lib.warps.find((w) => w.x === TAPE_SHELF.x && w.y === TAPE_SHELF.y)?.lock).toBe('secret');
    expect(getMap(TAPE_ROOM).warps[0].to).toBe(TAPE_SHELF.map);
  });

  it('la pietra delle Mani di Diamante e lo Squalo sono raggiungibili', () => {
    const seen = explore(8).seen;
    expect(getMap(HODL_STONE.map).tiles[HODL_STONE.y][HODL_STONE.x]).toBe(TILE.SIGN);
    expect(HODL_STONE.standY - HODL_STONE.y).toBe(1); // in piedi sotto la pietra, rivolti in su
    expect(seen.has(key(HODL_STONE.map, HODL_STONE.standX, HODL_STONE.standY))).toBe(true);
    expect(getMap(WHALE.map).npcs.some((n) => n.id === 'secret_whale' && n.x === WHALE.x && n.y === WHALE.y)).toBe(true);
    expect(near(seen, WHALE.map, WHALE.x, WHALE.y)).toBe(true);
  });

  it('lo Squalo è solo del fine settimana', () => {
    expect(isWeekend(new Date(2026, 10, 14))).toBe(true); // sabato
    expect(isWeekend(new Date(2026, 10, 15))).toBe(true); // domenica
    expect(isWeekend(new Date(2026, 10, 11))).toBe(false); // mercoledì
  });

  it('i traguardi segreti esistono e sono nascosti', () => {
    const sec = ACHIEVEMENTS.filter((a) => a.secret).map((a) => a.id);
    expect(sec).toEqual(['secret_ledger', 'secret_tape', 'secret_whale', 'secret_hodl', 'secret_all']);
  });
});

describe('indizi dei personaggi secondari', () => {
  it('ogni indizio è legato a un personaggio che esiste e parla, e ogni segreto ha almeno un indizio', async () => {
    const { SECRET_HINTS } = await import('../src/world/secretsData');
    const { allMapIds } = await import('../src/world/maps');
    const talkers = new Set(allMapIds().flatMap((id) => getMap(id).npcs.filter((n) => n.kind === 'talk' || n.kind === 'caveguide').map((n) => n.id)));
    for (const id of Object.keys(SECRET_HINTS)) expect(talkers.has(id), id).toBe(true);
    const about = new Set(Object.values(SECRET_HINTS).map((h) => h.about));
    for (const k of ['pages', 'tape', 'whale', 'hodl', 'rumors']) expect(about.has(k as never), k).toBe(true);
  });
});
