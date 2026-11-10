// Casa arredabile: gli oggetti sbloccati con traguardi e storie compaiono nella casa di Borgo Semina.
import { S } from '../systems/state';
import { TILE, DECOR_TILE, WALL_DECOR } from '../art/art';
import { DECOR_INFO } from '../systems/progress';
import type { MapDef } from './maps';

/** Posti liberi in casa: prima i muri per quadri e bacheche, poi il pavimento lungo le pareti. */
const WALL_SPOTS: [number, number][] = [[2, 1], [4, 1], [6, 1], [7, 1], [8, 1], [1, 1]];
const FLOOR_SPOTS: [number, number][] = [[8, 3], [1, 5], [8, 5], [2, 2], [4, 5], [1, 6], [8, 6], [7, 2]];

/** Restituisce una copia della mappa di casa con gli arredi sbloccati. L'originale non viene toccato. */
export function decorateHome(m: MapDef): MapDef {
  const tiles = m.tiles.map((r) => r.slice());
  const walls = WALL_SPOTS.slice(), floors = FLOOR_SPOTS.slice();
  for (const id of S.decor) {
    const tile = DECOR_TILE[DECOR_INFO[id]?.tile ?? ''];
    if (!tile) continue;
    const spots = WALL_DECOR.has(tile) ? walls : floors;
    const spot = spots.shift();
    if (!spot) continue;
    const [x, y] = spot;
    const cur = tiles[y]?.[x];
    if (cur === undefined || (!WALL_DECOR.has(tile) && cur !== TILE.FLOOR) || (WALL_DECOR.has(tile) && cur !== TILE.IWALL)) continue;
    tiles[y][x] = tile;
  }
  return { ...m, tiles };
}
