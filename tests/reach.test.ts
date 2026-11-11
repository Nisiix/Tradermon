import { describe, it, expect } from 'vitest';
import { getMap, allMapIds, type MapDef } from '../src/world/maps';
import { SOLID, TILE } from '../src/art/art';

/**
 * Raggiungibilità dell'intero mondo per numero di Medaglie: simula il giocatore casella per casella,
 * con passaggi, guardie, acqua (Medaglia 3), Massi delle Commissioni (4), grotte buie e Archivio (5),
 * Muro del Rumore (7). Serve a scoprire scorciatoie che saltano un'Accademia e vicoli senza ritorno.
 */
const VANISH = new Set(['rival', 'speculator', 'league', 'aide', 'case']);
type St = string;
const key = (m: string, x: number, y: number): St => `${m}:${x},${y}`;

function blockers(m: MapDef, b: number): Set<string> {
  const s = new Set<string>();
  for (const n of m.npcs) {
    if (n.hiddenSprite || VANISH.has(n.kind)) continue;
    if (n.kind === 'guard' && b >= (n.data?.badge as number)) continue;
    s.add(`${n.x},${n.y}`);
  }
  return s;
}

function passable(t: number, b: number) {
  if (t === TILE.WATER) return b >= 3;
  if (t === TILE.BOULDER) return b >= 4;
  if (t === TILE.NOISE) return b >= 7;
  return !SOLID.has(t);
}

function lockOk(lock: string | undefined, b: number) {
  if (!lock) return true;
  if (lock === 'swim') return b >= 3;
  if (lock === 'dark' || lock === 'archive') return b >= 5;
  if (lock === 'tower') return false; // solo dopo la Lega
  return true;
}

function explore(b: number) {
  const edges = new Map<St, St[]>();
  const start = key('home', 4, 4);
  const seen = new Set<St>([start]);
  const q: [string, number, number][] = [['home', 4, 4]];
  const block = new Map<string, Set<string>>();
  const bl = (id: string) => { if (!block.has(id)) block.set(id, blockers(getMap(id), b)); return block.get(id)!; };
  while (q.length) {
    const [id, x, y] = q.shift()!;
    const m = getMap(id);
    const from = key(id, x, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || bl(id).has(`${nx},${ny}`)) continue;
      const warp = m.warps.find((w) => w.x === nx && w.y === ny);
      let to: [string, number, number] | null = null;
      if (warp) { if (lockOk(warp.lock, b)) to = [warp.to, warp.tx, warp.ty]; }
      else if (passable(m.tiles[ny][nx], b)) to = [id, nx, ny];
      if (!to) continue;
      const k = key(...to);
      (edges.get(from) ?? edges.set(from, []).get(from)!).push(k);
      if (!seen.has(k)) { seen.add(k); q.push(to); }
    }
  }
  return { seen, edges, start };
}

const mapsOf = (seen: Set<St>) => new Set([...seen].map((s) => s.split(':')[0]));

describe('struttura del mondo', () => {
  it('con N Medaglie non si arriva oltre la città N+1 (nessuna scorciatoia salta un\'Accademia)', () => {
    for (let b = 0; b <= 8; b++) {
      const maps = mapsOf(explore(b).seen);
      for (let n = 1; n <= 8; n++) expect(maps.has(`academy_${n}`), `Medaglie ${b}: Accademia ${n}`).toBe(n <= b + 1);
      expect(maps.has('league'), `Medaglie ${b}: Lega`).toBe(b >= 8);
    }
  });
  it('con tutte le Medaglie ogni luogo del mondo è raggiungibile', () => {
    const maps = mapsOf(explore(8).seen);
    const missing = allMapIds().filter((id) => id !== 'tower' && !maps.has(id));
    expect(missing).toEqual([]);
  });
  it('da ogni casella raggiungibile si torna sempre a casa (nessun vicolo senza uscita)', () => {
    for (const b of [0, 2, 3, 4, 5, 7, 8]) {
      const { seen, edges, start } = explore(b);
      const back = new Map<St, St[]>();
      for (const [f, ts] of edges) for (const t of ts) (back.get(t) ?? back.set(t, []).get(t)!).push(f);
      const ok = new Set<St>([start]);
      const q = [start];
      while (q.length) for (const p of back.get(q.shift()!) ?? []) if (!ok.has(p)) { ok.add(p); q.push(p); }
      const stuck = [...seen].filter((s) => !ok.has(s));
      expect(stuck.slice(0, 5), `Medaglie ${b}`).toEqual([]);
    }
  });
});
