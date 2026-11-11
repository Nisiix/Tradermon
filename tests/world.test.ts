import { describe, it, expect } from 'vitest';
import { getMap, allMapIds } from '../src/world/maps';
import { SOLID, TILE } from '../src/art/art';

describe('mappe', () => {
  const ids = allMapIds();
  it('esistono tutte le mappe principali', () => {
    for (const id of ['home', 'lab', 't0', 't9', 'r1', 'r9', 'league', 'tower']) expect(ids).toContain(id);
  });
  it('ogni passaggio porta su un tile calpestabile di una mappa esistente', () => {
    for (const id of ids) {
      const m = getMap(id);
      for (const w of m.warps) {
        const to = getMap(w.to);
        expect(to, `${id} → ${w.to}`).toBeDefined();
        expect(w.tx >= 0 && w.ty >= 0 && w.tx < to.w && w.ty < to.h, `${id} → ${w.to} (${w.tx},${w.ty}) fuori mappa`).toBe(true);
        expect(SOLID.has(to.tiles[w.ty][w.tx]), `${id} → ${w.to} (${w.tx},${w.ty}) su tile solido`).toBe(false);
      }
    }
  });
  it('ogni porta ha davanti un tile calpestabile e gli edifici sono interi', () => {
    for (const id of ids) {
      const m = getMap(id);
      m.tiles.forEach((row, y) => row.forEach((t, x) => {
        if (t === TILE.DOOR) expect(SOLID.has(m.tiles[y + 1]?.[x] ?? TILE.TREE), `${id}: porta (${x},${y}) bloccata`).toBe(false);
        // nessun sentiero tra tetto e muro dello stesso edificio
        if (t === TILE.PATH && [TILE.ROOF, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL].includes(m.tiles[y - 1]?.[x] as never)) expect.fail(`${id}: sentiero dentro un edificio in (${x},${y})`);
      }));
    }
  });
  it('i personaggi stanno dentro la mappa', () => {
    for (const id of ids) {
      const m = getMap(id);
      for (const n of m.npcs) expect(n.x >= 0 && n.y >= 0 && n.x < m.w && n.y < m.h, `${id}:${n.id}`).toBe(true);
    }
  });
  it('dal punto di arrivo di ogni città si raggiungono tutte le sue uscite', () => {
    for (const id of ids) {
      const m = getMap(id);
      if (!m.warps.length) continue;
      const start = (() => { for (const other of ids) for (const w of getMap(other).warps) if (w.to === id) return [w.tx, w.ty]; return null; })();
      if (!start) continue;
      const seen = new Set<string>([start.join(',')]);
      const q = [start];
      const npcAt = new Set(m.npcs.filter((n) => !['case', 'guard', 'aide'].includes(n.kind)).map((n) => `${n.x},${n.y}`));
      while (q.length) {
        const [x, y] = q.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k)) continue;
          if ((SOLID.has(m.tiles[ny][nx]) && m.tiles[ny][nx] !== TILE.BOULDER) || npcAt.has(k)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      // i passaggi chiusi da un'abilità (acqua, grotte buie) o segreti li verifica reach.test.ts
      for (const w of m.warps.filter((x) => x.lock !== 'swim' && x.lock !== 'dark' && x.lock !== 'secret')) expect(seen.has(`${w.x},${w.y}`), `${id}: uscita (${w.x},${w.y}) verso ${w.to} irraggiungibile`).toBe(true);
    }
  });
});

describe('isole della liquidità', () => {
  const reach = (id: string, swim: boolean) => {
    const m = getMap(id);
    const start = [1, 6];
    const seen = new Set<string>([start.join(',')]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k)) continue;
        const t = m.tiles[ny][nx];
        if (SOLID.has(t) && !(swim && t === TILE.WATER)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  };
  it('chi abita le isole si raggiunge solo attraversando l\'acqua', () => {
    for (const r of [3, 5, 7]) {
      const m = getMap(`r${r}`);
      const h = m.npcs.find((n) => n.kind === 'hermit')!;
      expect(h, `r${r}`).toBeDefined();
      const front = `${h.x},${h.y + 1}`;
      expect(reach(`r${r}`, false).has(front), `r${r}: isola raggiungibile a piedi`).toBe(false);
      expect(reach(`r${r}`, true).has(front), `r${r}: isola irraggiungibile anche nuotando`).toBe(true);
    }
  });
});

describe('Accademie: gli allievi non si saltano', () => {
  it('ogni allievo sbarra la strada tra l\'ingresso e il Mentore', () => {
    for (const id of allMapIds().filter((x) => x.startsWith('academy_'))) {
      const m = getMap(id);
      const mentor = m.npcs.find((n) => n.kind === 'mentor')!;
      const entranceY = m.h - 2;
      const students = m.npcs.filter((n) => n.kind === 'student');
      expect(students.length, id).toBeGreaterThan(0);
      for (const s of students) {
        expect(s.guardY, `${id}/${s.id} senza guardY`).toBeDefined();
        // l'ingresso è prima della linea, la casella davanti al Mentore è oltre
        expect(entranceY >= s.guardY!, `${id}/${s.id}`).toBe(true);
        expect(mentor.y + 1 < s.guardY!, `${id}/${s.id}`).toBe(true);
        // l'allievo sta sulla sua linea, quindi lo si incrocia per forza
        expect(s.y >= s.guardY!, `${id}/${s.id}`).toBe(true);
      }
    }
  });
});
