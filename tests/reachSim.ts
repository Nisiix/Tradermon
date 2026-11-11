import { getMap, type MapDef } from '../src/world/maps';
import { SOLID, TILE } from '../src/art/art';

/**
 * Raggiungibilità dell'intero mondo per numero di Medaglie: simula il giocatore casella per casella,
 * con passaggi, guardie, acqua (Medaglia 3), Massi delle Commissioni (4), grotte buie e Archivio (5),
 * Muro del Rumore (7). Serve a scoprire scorciatoie che saltano un'Accademia e vicoli senza ritorno.
 */
const VANISH = new Set(['rival', 'speculator', 'league', 'aide', 'case']);
export type St = string;
export const key = (m: string, x: number, y: number): St => `${m}:${x},${y}`;

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
  if (lock === 'secret') return b >= 4; // scaffale della Sala del Nastro (segreti della seconda parte)
  return true;
}

export function explore(b: number) {
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

export const mapsOf = (seen: Set<St>) => new Set([...seen].map((s) => s.split(':')[0]));

