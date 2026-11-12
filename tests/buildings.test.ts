import { describe, it, expect } from 'vitest';
import { getMap, allMapIds, type MapDef } from '../src/world/maps';
import { SOLID, TILE } from '../src/art/art';

/**
 * Posizione degli edifici nelle mappe esterne: chi esce da una porta deve trovarsi su una strada
 * collegata alla strada principale (quella che porta ai percorsi), raggiungibile camminando,
 * e nessun edificio deve stare a ridosso del bosco che fa da bordo alla mappa.
 */
const BUILDING = new Set<number>([TILE.ROOF, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL, TILE.WALL, TILE.WINDOW, TILE.DOOR]);
const ROAD = new Set<number>([TILE.PATH, TILE.PLAZA]);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

interface Door { map: MapDef; x: number; y: number; to: string; exit: [number, number] }

function doors(): Door[] {
  const out: Door[] = [];
  for (const id of allMapIds()) {
    const m = getMap(id);
    if (m.interior) continue;
    for (const w of m.warps) {
      if (m.tiles[w.y][w.x] !== TILE.DOOR) continue;
      const back = getMap(w.to).warps.find((b) => b.to === id);
      expect(back, `${id}: ${w.to} non ha un'uscita verso ${id}`).toBeDefined();
      out.push({ map: m, x: w.x, y: w.y, to: w.to, exit: [back!.tx, back!.ty] });
    }
  }
  return out;
}

function flood(m: MapDef, sx: number, sy: number, ok: (t: number) => boolean): Set<string> {
  const seen = new Set([`${sx},${sy}`]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k) || !ok(m.tiles[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

/** Caselle dei passaggi sul bordo della mappa (verso i percorsi o la città). */
const edgeWarps = (m: MapDef) => m.warps.filter((w) => w.x === 0 || w.y === 0 || w.x === m.w - 1 || w.y === m.h - 1);

describe('edifici e strade', () => {
  const all = doors();

  it('ci sono porte da controllare in ogni città', () => {
    for (let n = 0; n <= 9; n++) expect(all.some((d) => d.map.id === `t${n}`), `t${n}`).toBe(true);
  });

  it('uscendo da un edificio si arriva sulla casella davanti alla porta, calpestabile e libera', () => {
    for (const d of all) {
      const [ex, ey] = d.exit, m = d.map, at = `${m.id}: uscita da ${d.to} (${ex},${ey})`;
      expect([ex, ey], at).toEqual([d.x, d.y + 1]);
      expect(SOLID.has(m.tiles[ey][ex]) || m.tiles[ey][ex] === TILE.WATER, `${at} su un tile solido`).toBe(false);
      // le guardie non contano: chi è dentro ha già il requisito, quindi la guardia si è già spostata
      expect(m.npcs.some((n) => !n.hiddenSprite && n.kind !== 'guard' && n.x === ex && n.y === ey), `${at} occupata da un personaggio`).toBe(false);
    }
  });

  it('davanti a ogni porta c\'è una strada collegata alla strada principale', () => {
    for (const d of all) {
      const [ex, ey] = d.exit, m = d.map, at = `${m.id}: porta di ${d.to} (${d.x},${d.y})`;
      expect(ROAD.has(m.tiles[ey][ex]), `${at}: davanti non c'è strada`).toBe(true);
      const road = flood(m, ex, ey, (t) => ROAD.has(t));
      expect(edgeWarps(m).some((w) => road.has(`${w.x},${w.y}`)), `${at}: la strada non arriva alla strada principale`).toBe(true);
    }
  });

  it('dall\'uscita di ogni edificio si raggiunge a piedi la strada principale (senza acqua né abilità)', () => {
    for (const d of all) {
      const [ex, ey] = d.exit, m = d.map;
      const walk = flood(m, ex, ey, (t) => !SOLID.has(t) && t !== TILE.WATER);
      expect(edgeWarps(m).some((w) => walk.has(`${w.x},${w.y}`)), `${m.id}: uscita di ${d.to} (${ex},${ey}) isolata`).toBe(true);
    }
  });

  it('nessun edificio sta a ridosso del bosco di bordo', () => {
    for (const d of all) {
      const m = d.map;
      const cells = [...flood(m, d.x, d.y, (t) => BUILDING.has(t))].map((k) => k.split(',').map(Number));
      const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
      const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        expect(m.tiles[y]?.[x] === TILE.TREE, `${m.id}: edificio di ${d.to} tocca il bosco in (${x},${y})`).toBe(false);
      }
    }
  });
});

describe('salvataggi fatti prima dello spostamento degli edifici', () => {
  it('una posizione salvata finita dentro un edificio viene spostata sulla casella libera più vicina', async () => {
    const { safeSpot } = await import('../src/world/maps');
    const m = getMap('t0');
    // la riga davanti al vecchio Laboratorio ora è il suo muro (con la porta nuova al centro)
    expect(SOLID.has(m.tiles[6][15])).toBe(true);
    expect(safeSpot(m, 15, 6)).toEqual([15, 7]);
    expect(m.tiles[6][16]).toBe(TILE.DOOR);
    expect(safeSpot(m, 16, 6)).toEqual([16, 7]);
    // una casella già libera resta com'è; fuori mappa si torna dentro
    expect(safeSpot(m, 16, 8)).toEqual([16, 8]);
    const [x, y] = safeSpot(m, 99, 99);
    expect(SOLID.has(m.tiles[y][x])).toBe(false);
  });
});
