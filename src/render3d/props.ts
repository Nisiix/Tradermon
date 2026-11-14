// Come ogni tipo di tile della mappa diventa un oggetto nel mondo 2.5D.
import { TILE } from '../art/art';

export type Repr =
  | { kind: 'ground' }
  /** parallelepipedo: texture del tile sopra (e sul davanti se `front`), fianchi tinta unita ricavata dal tile */
  | { kind: 'block'; h: number; front?: boolean; ground?: string }
  /** oggetto in piedi ricavato dalla maschera del tile (sfondo `base`), con la sua profondità */
  | { kind: 'upright'; depth: number; base: string | null; h?: number; w?: number; ground?: string }
  /** oggetto sdraiato ricavato dalla maschera (massi) */
  | { kind: 'flat'; h: number; base: string | null; ground?: string }
  /** pannelli incrociati (alberi, erba alta) */
  | { kind: 'cross'; base: string | null; w: number; h: number; ground?: string }
  | { kind: 'house' }
  | { kind: 'wall' }
  | { kind: 'none' };

const R: Record<number, Repr> = {
  [TILE.GRASS]: { kind: 'ground' }, [TILE.FLOWERS]: { kind: 'ground' }, [TILE.PATH]: { kind: 'ground' }, [TILE.PLAZA]: { kind: 'ground' },
  [TILE.SAND]: { kind: 'ground' }, [TILE.CAVE]: { kind: 'ground' }, [TILE.PIER]: { kind: 'ground' }, [TILE.LADDER]: { kind: 'ground' },
  [TILE.FLOOR]: { kind: 'ground' }, [TILE.RUG]: { kind: 'ground' }, [TILE.MAT]: { kind: 'ground' }, [TILE.WATER]: { kind: 'ground' },
  [TILE.MARKET]: { kind: 'cross', base: 'grass0', w: 1, h: 0.5, ground: 'grass0' },
  [TILE.TREE]: { kind: 'cross', base: 'grass1', w: 1.25, h: 1.5, ground: 'grass_sh' },
  [TILE.FENCE]: { kind: 'upright', depth: 0.14, base: 'grass0', ground: 'grass0' },
  [TILE.SIGN]: { kind: 'upright', depth: 0.18, base: 'grass0', ground: 'grass0' },
  [TILE.STATION]: { kind: 'upright', depth: 0.18, base: '#d8d0c0', ground: 'plaza' },
  [TILE.GATE]: { kind: 'upright', depth: 0.22, base: null, h: 1.1 },
  [TILE.NOISE]: { kind: 'block', h: 1.2, front: true },
  [TILE.LEDGE]: { kind: 'block', h: 0.3 },
  [TILE.ROCK]: { kind: 'block', h: 1.0, front: true },
  [TILE.CAVE_MOUTH]: { kind: 'block', h: 1.0, front: true },
  [TILE.BOULDER]: { kind: 'flat', h: 0.7, base: 'grass0' },
  [TILE.ROOF]: { kind: 'house' }, [TILE.ROOF_CLINIC]: { kind: 'house' }, [TILE.ROOF_ACADEMY]: { kind: 'house' }, [TILE.ROOF_SPECIAL]: { kind: 'house' },
  [TILE.WALL]: { kind: 'house' }, [TILE.WINDOW]: { kind: 'house' }, [TILE.DOOR]: { kind: 'house' },
  [TILE.IWALL]: { kind: 'wall' }, [TILE.POSTER]: { kind: 'wall' }, [TILE.CALENDAR]: { kind: 'wall' }, [TILE.FRAME]: { kind: 'wall' }, [TILE.PAINTING]: { kind: 'wall' },
  [TILE.COUNTER]: { kind: 'block', h: 0.72, ground: 'floor' },
  [TILE.CASE_TABLE]: { kind: 'block', h: 0.6, ground: 'floor' },
  [TILE.TABLE]: { kind: 'block', h: 0.6, ground: 'floor' },
  [TILE.DESK]: { kind: 'block', h: 0.66, ground: 'floor' },
  [TILE.BED]: { kind: 'block', h: 0.45, ground: 'floor' },
  [TILE.ROULETTE]: { kind: 'block', h: 0.7, ground: 'floor' },
  [TILE.SHELF]: { kind: 'upright', depth: 0.42, base: null, ground: 'floor' },
  [TILE.PC]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.PLANT]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.ARCADE]: { kind: 'upright', depth: 0.5, base: 'floor', ground: 'floor' },
  [TILE.AQUARIUM]: { kind: 'upright', depth: 0.4, base: 'floor', ground: 'floor' },
  [TILE.TROPHY_S]: { kind: 'upright', depth: 0.22, base: 'floor', ground: 'floor' },
  [TILE.TROPHY_G]: { kind: 'upright', depth: 0.22, base: 'floor', ground: 'floor' },
  [TILE.TROPHY_L]: { kind: 'upright', depth: 0.22, base: 'floor', ground: 'floor' },
  [TILE.GLOBE]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.RADIO]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.INGOT]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.PEARL]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.LANTERN]: { kind: 'upright', depth: 0.3, base: 'floor', ground: 'floor' },
  [TILE.TABLET]: { kind: 'upright', depth: 0.2, base: 'cave', ground: 'cave' },
  [TILE.CRYSTAL_GOLD]: { kind: 'upright', depth: 0.34, base: 'cave', ground: 'cave' },
  [TILE.CRYSTAL_DARK]: { kind: 'upright', depth: 0.34, base: 'cave', ground: 'cave' },
  [TILE.CRYSTAL_SEA]: { kind: 'upright', depth: 0.34, base: 'cave', ground: 'cave' },
};

export function reprOf(t: number): Repr { return R[t] ?? { kind: 'ground' }; }
export const HOUSE_ROOFS = new Set<number>([TILE.ROOF, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL]);
export const HOUSE_WALLS = new Set<number>([TILE.WALL, TILE.WINDOW, TILE.DOOR]);
export const WALL_LIKE = new Set<number>([TILE.IWALL, TILE.POSTER, TILE.CALENDAR, TILE.FRAME, TILE.PAINTING]);
