// Tutta la grafica di Tradermon è generata in codice (pixel art originale, nessun asset esterno).

import { POOLS, POOL_ORDER, lookIndex, type Look, type LookPool } from './looks';

export const T = 16;
/** Scala di resa: ogni pixel logico diventa RS×RS pixel reali, con le diagonali smussate (Scale3x). */
export const RS = 3;
export const P = T * RS;

export const TILE = {
  GRASS: 0, FLOWERS: 1, PATH: 2, TREE: 3, WATER: 4, MARKET: 5, FENCE: 6, SIGN: 7, ROOF: 8, WALL: 9, DOOR: 10,
  WINDOW: 11, FLOOR: 12, IWALL: 13, COUNTER: 14, SHELF: 15, TABLE: 16, PC: 17, MAT: 18, GATE: 19, NOISE: 20,
  ROOF_CLINIC: 21, ROOF_ACADEMY: 22, ROOF_SPECIAL: 23, PLAZA: 24, ROULETTE: 25, RUG: 26, CASE_TABLE: 27, STATION: 28, BED: 29, PLANT: 30, LEDGE: 31,
  // arredi sbloccabili per la casa (traguardi e storie degli abitanti)
  TROPHY_S: 32, TROPHY_G: 33, TROPHY_L: 34, POSTER: 35, CALENDAR: 36, DESK: 37, ARCADE: 38, FRAME: 39, GLOBE: 40, PAINTING: 41, RADIO: 42, AQUARIUM: 43,
  // mare, spiagge e grotte
  SAND: 44, ROCK: 45, CAVE: 46, CAVE_MOUTH: 47, BOULDER: 48, PIER: 49, LADDER: 50,
} as const;
export const TILE_COUNT = 51;
/** Nome del tile di arredo per ogni oggetto sbloccabile. */
export const DECOR_TILE: Record<string, number> = { plant: TILE.PLANT, shelf: TILE.SHELF, trophy_silver: TILE.TROPHY_S, trophy_gold: TILE.TROPHY_G, trophy_league: TILE.TROPHY_L, poster: TILE.POSTER, calendar: TILE.CALENDAR, desk: TILE.DESK, arcade: TILE.ARCADE, frame: TILE.FRAME, globe: TILE.GLOBE, painting: TILE.PAINTING, radio: TILE.RADIO, aquarium: TILE.AQUARIUM };
/** Arredi da parete (sostituiscono un pezzo di muro interno) e da pavimento. */
export const WALL_DECOR = new Set<number>([TILE.POSTER, TILE.CALENDAR, TILE.FRAME, TILE.PAINTING]);

export const SOLID = new Set<number>([TILE.TREE, TILE.WATER, TILE.FENCE, TILE.SIGN, TILE.ROOF, TILE.WALL, TILE.WINDOW, TILE.IWALL, TILE.COUNTER, TILE.SHELF, TILE.TABLE, TILE.PC, TILE.GATE, TILE.NOISE, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL, TILE.ROULETTE, TILE.CASE_TABLE, TILE.STATION, TILE.BED, TILE.PLANT, TILE.TROPHY_S, TILE.TROPHY_G, TILE.TROPHY_L, TILE.POSTER, TILE.CALENDAR, TILE.DESK, TILE.ARCADE, TILE.FRAME, TILE.GLOBE, TILE.PAINTING, TILE.RADIO, TILE.AQUARIUM, TILE.ROCK, TILE.BOULDER]);

type Ctx = CanvasRenderingContext2D;

// Stile ispirato alle console portatili dei primi anni 2000: tile 16×16, contorni scuri,
// rampe di 3-4 tonalità per materiale, luce dall'alto a sinistra. Tutto disegnato in codice.

function px(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

/** Generatore deterministico per i dettagli dei tile. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// Tavolozza ispirata alle portatili di metà anni 2000 (stile "DS"): rampe di 5 tonalità,
// contorni colorati invece che neri, ombre portate a terra e luce morbida dall'alto a sinistra.
const C = {
  grass: '#7cc858', grassL: '#a4e07c', grassLL: '#c8f0a0', grassD: '#5eac48', grassDD: '#3f8a3c', grassO: '#2c6a34',
  tall: '#3f9a40', tallL: '#78c858', tallLL: '#a8e080', tallD: '#2c7a34', tallO: '#1c5228',
  sand: '#e6cf94', sandL: '#f6e6b8', sandD: '#c9ac70', sandDD: '#a88a52', sandO: '#86683c',
  water: '#4a8ce0', waterL: '#7cb4f4', waterLL: '#c8e4ff', waterD: '#3670c8', waterDD: '#2858a8', foam: '#e8f4ff',
  leaf: '#46a04c', leafL: '#6cc45c', leafLL: '#a6e084', leafD: '#2f7c3c', leafDD: '#225e30', leafO: '#163e22',
  bark: '#8a5a34', barkL: '#b07a48', barkD: '#5e3a20',
  wood: '#c8884c', woodL: '#e6ac6c', woodLL: '#f6cc90', woodD: '#9a6234', woodO: '#5c3a1e',
  wall: '#f4ecdc', wallL: '#fffaf0', wallD: '#d8ccb0', wallDD: '#b8aa8c', wallO: '#6a604c',
  stone: '#b4aca0', stoneL: '#d4ccc0', stoneD: '#8c8478',
  floor: '#d6ae74', floorL: '#ecc88e', floorD: '#b48c54', floorDD: '#946c3c',
  out: '#2a3230',
};

// Registro dei tile visivi: ogni tile logico può avere varianti (bordi, animazioni, ombre).
const COLS = 16;
type Draw = (c: Ctx, o: { x: number; y: number }) => void;
const REG: { name: string; draw: Draw }[] = [];
const IDX: Record<string, number> = {};
function reg(name: string, draw: Draw) { IDX[name] = REG.length; REG.push({ name, draw }); }

/** Ombra portata da ciò che sta sopra (alberi, edifici): banda morbida in alto. */
function castShadow(c: Ctx, o: { x: number; y: number }, h = 5) {
  for (let i = 0; i < h; i++) { c.fillStyle = `rgba(16,40,24,${0.30 - i * (0.26 / h)})`; c.fillRect(o.x, o.y + i, 16, 1); }
}

function grassBase(c: Ctx, o: { x: number; y: number }, v = 0) {
  px(c, o.x, o.y, 16, 16, C.grass);
  const r = prng(17 + v * 31);
  // trama fine: puntini chiari e scuri, come l'erba rasata
  for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); px(c, o.x + x, o.y + y, 1, 1, i % 3 ? C.grassD : C.grassL); }
  // ciuffetti a "V" con la punta illuminata
  for (let i = 0; i < 1 + v; i++) {
    const x = o.x + 1 + Math.floor(r() * 12), y = o.y + 3 + Math.floor(r() * 11);
    px(c, x, y, 1, 1, C.grassDD); px(c, x + 2, y, 1, 1, C.grassDD); px(c, x + 1, y + 1, 1, 1, C.grassDD);
    px(c, x, y - 1, 1, 1, C.grassL); px(c, x + 2, y - 1, 1, 1, C.grassLL);
  }
  if (v === 2) { px(c, o.x + 5, o.y + 5, 1, 1, '#f8f0a0'); px(c, o.x + 11, o.y + 12, 1, 1, '#ffffff'); }
}

function tree(c: Ctx, o: { x: number; y: number }, v: number) {
  grassBase(c, o, 1);
  // ombra ellittica a terra
  c.fillStyle = 'rgba(16,48,24,.35)'; c.beginPath(); c.ellipse(o.x + 8.5, o.y + 14.5, 7, 2, 0, 0, Math.PI * 2); c.fill();
  // tronco con luce a sinistra
  px(c, o.x + 6, o.y + 10, 4, 5, C.barkD); px(c, o.x + 6, o.y + 10, 3, 5, C.bark); px(c, o.x + 6, o.y + 10, 1, 5, C.barkL);
  px(c, o.x + 5, o.y + 14, 6, 1, C.barkD);
  // chioma a tre lobi: contorno, base, ombra in basso a destra, luci in alto a sinistra
  const lobes: [number, number, number][] = [[8, 5.5, 6.5], [4.6, 7.6, 4.2], [11.4, 7.6, 4.2]];
  const disk = (col: string, grow: number, dx = 0, dy = 0) => { c.fillStyle = col; for (const [x, y, rr] of lobes) { c.beginPath(); c.arc(o.x + x + dx, o.y + y + dy, rr + grow, 0, Math.PI * 2); c.fill(); } };
  disk(C.leafO, 1);
  disk(C.leafDD, 0);
  disk(C.leafD, -0.4, -0.6, -0.6);
  disk(C.leaf, -1.4, -1.2, -1.3);
  c.fillStyle = C.leafL; c.beginPath(); c.arc(o.x + 6.5, o.y + 4, 2.6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(o.x + 3.6, o.y + 6.6, 1.5, 0, Math.PI * 2); c.fill();
  px(c, o.x + 5, o.y + 2, 2, 1, C.leafLL); px(c, o.x + 4, o.y + 3, 1, 1, C.leafLL); px(c, o.x + 10 + v, o.y + 4, 1, 1, C.leafLL);
  // foglie in ombra
  px(c, o.x + 9 - v, o.y + 8, 2, 1, C.leafDD); px(c, o.x + 12, o.y + 9, 1, 1, C.leafDD); px(c, o.x + 6, o.y + 9, 1, 1, C.leafDD);
  // il pixel art non vuole bordi sfumati: riallinea l'alfa del tile
  hardEdges(c, o);
}

/** Toglie le semitrasparenze lasciate dagli archi del canvas (resta pixel art nitida). */
function hardEdges(c: Ctx, o: { x: number; y: number }) {
  const im = c.getImageData(o.x, o.y, 16, 16);
  for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] < 110 ? 0 : 255;
  c.putImageData(im, o.x, o.y);
}

/** Bordo d'erba sopra un tile di sentiero o acqua; m = maschera dei lati diversi (1 su, 2 destra, 4 giù, 8 sinistra). */
function grassEdges(c: Ctx, o: { x: number; y: number }, m: number, under: string) {
  const blades = (horizontal: boolean, at: number, dir: 1 | -1) => {
    for (let k = 0; k < 16; k++) {
      const len = 2 + ((k * 7) % 3 === 0 ? 1 : 0) + (k % 5 === 0 ? 1 : 0);
      for (let j = 0; j < len; j++) {
        const pos = at + dir * j;
        const col = j === len - 1 ? C.grassD : C.grass;
        if (horizontal) px(c, o.x + k, o.y + pos, 1, 1, col); else px(c, o.x + pos, o.y + k, 1, 1, col);
      }
      // ombra dell'erba sul terreno
      const s = at + dir * len;
      if (horizontal) px(c, o.x + k, o.y + s, 1, 1, under); else px(c, o.x + s, o.y + k, 1, 1, under);
    }
  };
  if (m & 1) blades(true, 0, 1);
  if (m & 4) blades(true, 15, -1);
  if (m & 8) blades(false, 0, 1);
  if (m & 2) blades(false, 15, -1);
}

function roof(c: Ctx, o: { x: number; y: number }, base: string, pos: { top: boolean; left: boolean; right: boolean; bottom: boolean }) {
  const L = shade(base, 0.28), LL = shade(base, 0.5), D = shade(base, -0.22), DD = shade(base, -0.45), O = shade(base, -0.65);
  px(c, o.x, o.y, 16, 16, base);
  // file di tegole sovrapposte: riflesso in alto, ombra sotto, giunte sfalsate
  for (let y = 0; y < 16; y += 4) {
    px(c, o.x, o.y + y, 16, 1, L);
    px(c, o.x, o.y + y + 2, 16, 1, D);
    px(c, o.x, o.y + y + 3, 16, 1, DD);
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) { px(c, o.x + x, o.y + y, 1, 3, DD); px(c, o.x + x + 1, o.y + y, 1, 2, LL); }
  }
  // gradiente verso il basso: le file più basse sono un po' più scure
  c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(o.x, o.y + 8, 16, 8);
  if (pos.top) { px(c, o.x, o.y, 16, 3, L); px(c, o.x, o.y, 16, 1, O); px(c, o.x, o.y + 1, 16, 1, LL); px(c, o.x, o.y + 3, 16, 1, D); }
  if (pos.bottom) { px(c, o.x, o.y + 12, 16, 1, L); px(c, o.x, o.y + 13, 16, 2, D); px(c, o.x, o.y + 15, 16, 1, O); }
  if (pos.left) { px(c, o.x, o.y, 1, 16, O); px(c, o.x + 1, o.y, 1, 16, L); }
  if (pos.right) { px(c, o.x + 15, o.y, 1, 16, O); px(c, o.x + 13, o.y, 2, 16, D); }
}

function wallBase(c: Ctx, o: { x: number; y: number }, left: boolean, right: boolean) {
  px(c, o.x, o.y, 16, 16, C.wall);
  // assi orizzontali con riflesso
  for (let y = 4; y < 13; y += 3) { px(c, o.x, o.y + y, 16, 1, C.wallD); px(c, o.x, o.y + y + 1, 16, 1, C.wallL); }
  // ombra della gronda
  px(c, o.x, o.y, 16, 1, C.wallO); px(c, o.x, o.y + 1, 16, 2, C.wallDD); px(c, o.x, o.y + 3, 16, 1, C.wallD);
  // zoccolo in pietra
  px(c, o.x, o.y + 13, 16, 3, C.stone); px(c, o.x, o.y + 13, 16, 1, C.stoneL); px(c, o.x, o.y + 15, 16, 1, C.stoneD);
  for (let x = 2; x < 16; x += 5) px(c, o.x + x, o.y + 14, 1, 1, C.stoneD);
  if (left) { px(c, o.x, o.y, 1, 16, C.wallO); px(c, o.x + 1, o.y + 3, 1, 10, C.wallL); }
  if (right) { px(c, o.x + 15, o.y, 1, 16, C.wallO); px(c, o.x + 13, o.y + 3, 2, 10, C.wallD); }
}

function floorBase(c: Ctx, o: { x: number; y: number }) {
  px(c, o.x, o.y, 16, 16, C.floor);
  // listoni di legno con venature e giunte sfalsate
  for (let y = 0; y < 16; y += 4) {
    px(c, o.x, o.y + y, 16, 1, C.floorL); px(c, o.x, o.y + y + 3, 16, 1, C.floorD);
    const j = (y / 4) % 2 ? 11 : 4;
    px(c, o.x + j, o.y + y, 1, 3, C.floorDD);
    px(c, o.x + ((j + 6) % 16), o.y + y + 1, 3, 1, shade(C.floor, -0.08));
  }
}

function briefcase(c: Ctx, o: { x: number; y: number }, col: string) {
  const D = shade(col, -0.35), L = shade(col, 0.35), O = shade(col, -0.65);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(o.x + 3, o.y + 14, 11, 1);
  px(c, o.x + 5, o.y + 3, 6, 2, O); c.clearRect(o.x + 6, o.y + 4, 4, 1);
  px(c, o.x + 2, o.y + 5, 12, 9, O);
  px(c, o.x + 3, o.y + 6, 10, 7, col);
  px(c, o.x + 3, o.y + 6, 10, 1, L); px(c, o.x + 3, o.y + 7, 1, 5, L);
  px(c, o.x + 3, o.y + 12, 10, 1, D); px(c, o.x + 12, o.y + 7, 1, 5, D);
  px(c, o.x + 3, o.y + 9, 10, 1, D);
  px(c, o.x + 7, o.y + 8, 2, 3, '#f8d848'); px(c, o.x + 7, o.y + 8, 1, 1, '#fff8c0');
}

// ---- registrazione ----
for (let v = 0; v < 3; v++) reg(`grass${v}`, (c, o) => grassBase(c, o, v));
reg('grass_sh', (c, o) => { grassBase(c, o, 0); castShadow(c, o); });
for (let f = 0; f < 2; f++) reg(`flowers${f}`, (c, o) => {
  grassBase(c, o, 1);
  const fl = (x: number, y: number, col: string) => {
    const D = shade(col, -0.3);
    px(c, o.x + x - 1, o.y + y + 3, 1, 1, C.grassDD); px(c, o.x + x, o.y + y + 2, 1, 2, C.grassDD);
    px(c, o.x + x - 1, o.y + y, 3, 1, col); px(c, o.x + x, o.y + y - 1, 1, 3, col);
    px(c, o.x + x + 1, o.y + y + 1, 1, 1, D); px(c, o.x + x - 1, o.y + y - 1, 1, 1, shade(col, 0.4));
    px(c, o.x + x, o.y + y, 1, 1, '#f8c830');
  };
  const d = f ? 1 : 0;
  fl(4 + d, 4, '#f05868'); fl(11, 3 + d, '#ffffff'); fl(6, 11 - d, '#ffffff'); fl(12 - d, 11, '#f8a0c0');
});
for (let v = 0; v < 2; v++) reg(`tall${v}`, (c, o) => {
  // erba alta folta: fondo scuro e due file di ciuffi a punta, sfalsati, con contorno e luce
  px(c, o.x, o.y, 16, 16, C.tallD);
  const blade = (cx: number, top: number, h: number, light: boolean) => {
    const rowW = (i: number) => Math.min(5, 1 + Math.floor(i / 2));
    for (let i = 0; i < h; i++) { const w = rowW(i) + 2; px(c, o.x + cx - Math.floor(w / 2), o.y + top + i - 1, w, 1, C.tallO); }
    for (let i = 0; i < h; i++) {
      const w = rowW(i), x0 = o.x + cx - Math.floor(w / 2), y = o.y + top + i;
      px(c, x0, y, w, 1, C.tall);
      px(c, x0, y, 1, 1, light ? C.tallLL : C.tallL);
      if (w > 2) px(c, x0 + w - 1, y, 1, 1, C.tallD);
    }
  };
  for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
    const cx = 2 + k * 4 + (row ? 2 : 0), top = row * 8 + 1 + ((k + row) % 2);
    if (cx > 16) continue;
    blade(cx, top, 8, k % 2 === 0);
  }
  px(c, o.x, o.y + 15, 16, 1, C.tallO);
  if (v === 1) { px(c, o.x + 12, o.y + 3, 1, 1, '#fff8b0'); px(c, o.x + 11, o.y + 4, 3, 1, '#f8d030'); px(c, o.x + 12, o.y + 5, 1, 1, '#fff8b0'); }
});
// ciuffi d'erba sciolti su sfondo trasparente: nel mondo 2.5D danno corpo all'erba alta e ai prati
for (let v = 0; v < 3; v++) reg(`tuft${v}`, (c, o) => {
  const blade = (cx: number, h: number, light: boolean) => {
    const top = 16 - h;
    const rowW = (i: number) => Math.min(5, 1 + Math.floor(i / 2));
    for (let i = 0; i < h; i++) { const w = rowW(i) + 2; px(c, o.x + cx - Math.floor(w / 2), o.y + top + i - 1, w, 1, C.tallO); }
    for (let i = 0; i < h; i++) {
      const w = rowW(i), x0 = o.x + cx - Math.floor(w / 2), y = o.y + top + i;
      px(c, x0, y, w, 1, C.tall);
      px(c, x0, y, 1, 1, light ? C.tallLL : C.tallL);
      if (w > 2) px(c, x0 + w - 1, y, 1, 1, C.tallD);
    }
  };
  const sets: [number, number, boolean][][] = [[[4, 7, true], [9, 10, false], [13, 6, true]], [[3, 9, false], [8, 6, true], [12, 8, false]], [[5, 10, true], [11, 7, false]]];
  for (const [cx, h, light] of sets[v]) blade(cx, h, light);
});
for (let s = 0; s < 2; s++) for (let m = 0; m < 16; m++) reg(`path${m}${s ? 's' : ''}`, (c, o) => {
  px(c, o.x, o.y, 16, 16, C.sand);
  const r = prng(91 + m);
  // terra battuta: granelli, piccole pietre con luce e ombra
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); px(c, o.x + x, o.y + y, 1, 1, i % 3 ? C.sandD : C.sandL); }
  for (let i = 0; i < 2; i++) { const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11); px(c, o.x + x, o.y + y, 2, 1, C.sandDD); px(c, o.x + x, o.y + y - 1, 2, 1, C.sandL); }
  if (s) castShadow(c, o);
  grassEdges(c, o, m, C.sandDD);
});
reg('plaza', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#dcd4c4');
  // lastre con fughe e luce
  for (const [x, y, w, h] of [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) {
    px(c, o.x + x, o.y + y, w, 1, '#f0e8dc'); px(c, o.x + x, o.y + y, 1, h, '#ece4d6');
    px(c, o.x + x, o.y + y + h - 1, w, 1, '#aca494'); px(c, o.x + x + w - 1, o.y + y, 1, h, '#b8b0a0');
  }
  px(c, o.x + 3, o.y + 4, 1, 1, '#c4bcac'); px(c, o.x + 12, o.y + 11, 1, 1, '#c4bcac');
});
for (let v = 0; v < 2; v++) reg(`tree${v}`, (c, o) => tree(c, o, v));
for (let f = 0; f < 2; f++) for (let m = 0; m < 16; m++) reg(`water${f}_${m}`, (c, o) => {
  // acqua con profondità: più chiara vicino alla riva, onde che scorrono
  px(c, o.x, o.y, 16, 16, C.water);
  const rw = prng(300 + m);
  for (let i = 0; i < 6; i++) { const x = Math.floor(rw() * 14), y = Math.floor(rw() * 15); px(c, o.x + x, o.y + y, 2, 1, C.waterD); }
  const sh = f ? 3 : 0;
  px(c, o.x + 1 + sh, o.y + 3, 5, 1, C.waterL); px(c, o.x + 2 + sh, o.y + 2, 3, 1, C.waterLL); px(c, o.x + 2 + sh, o.y + 4, 3, 1, C.waterD);
  px(c, o.x + 9 - sh, o.y + 10, 5, 1, C.waterL); px(c, o.x + 10 - sh, o.y + 9, 2, 1, C.waterLL); px(c, o.x + 10 - sh, o.y + 11, 3, 1, C.waterDD);
  if (f) px(c, o.x + 13, o.y + 5, 1, 1, '#ffffff'); else px(c, o.x + 5, o.y + 13, 1, 1, '#ffffff');
  // schiuma lungo le rive
  if (m & 1) { px(c, o.x, o.y + 3, 16, 2, C.waterL); px(c, o.x, o.y + 3, 16, 1, C.foam); }
  if (m & 4) { px(c, o.x, o.y + 11, 16, 1, C.foam); }
  if (m & 8) { px(c, o.x + 3, o.y, 1, 16, C.foam); px(c, o.x + 4, o.y, 1, 16, C.waterL); }
  if (m & 2) { px(c, o.x + 12, o.y, 1, 16, C.foam); }
  grassEdges(c, o, m, C.grassO);
});
reg('fence', (c, o) => {
  grassBase(c, o, 0);
  c.fillStyle = 'rgba(16,48,24,.25)'; c.fillRect(o.x, o.y + 14, 16, 2);
  for (const y of [5, 10]) { px(c, o.x, o.y + y, 16, 3, C.woodO); px(c, o.x, o.y + y + 1, 16, 1, C.woodL); px(c, o.x, o.y + y + 2, 16, 1, C.woodD); }
  for (const x of [2, 11]) {
    px(c, o.x + x, o.y + 1, 4, 14, C.woodO); px(c, o.x + x + 1, o.y + 2, 2, 12, C.wood); px(c, o.x + x + 1, o.y + 2, 1, 12, C.woodLL);
    px(c, o.x + x + 1, o.y + 1, 2, 1, C.woodL);
  }
});
reg('sign', (c, o) => {
  grassBase(c, o, 0);
  c.fillStyle = 'rgba(16,48,24,.3)'; c.fillRect(o.x + 3, o.y + 14, 11, 2);
  px(c, o.x + 4, o.y + 10, 2, 5, C.woodO); px(c, o.x + 10, o.y + 10, 2, 5, C.woodO);
  px(c, o.x + 1, o.y + 1, 14, 10, C.woodO);
  px(c, o.x + 2, o.y + 2, 12, 8, C.wood); px(c, o.x + 2, o.y + 2, 12, 1, C.woodLL); px(c, o.x + 2, o.y + 3, 1, 6, C.woodL);
  px(c, o.x + 2, o.y + 5, 12, 1, C.woodD); px(c, o.x + 2, o.y + 9, 12, 1, C.woodD);
  px(c, o.x + 4, o.y + 3, 7, 1, C.woodO); px(c, o.x + 4, o.y + 7, 5, 1, C.woodO);
});
const ROOFS: [string, string][] = [['roof', '#d0503c'], ['roof_clinic', '#3c7ad8'], ['roof_academy', '#3aa05a'], ['roof_special', '#8a5ac8']];
for (const [name, col] of ROOFS) for (let m = 0; m < 16; m++) reg(`${name}${m}`, (c, o) => roof(c, o, col, { top: !!(m & 1), right: !!(m & 2), bottom: !!(m & 4), left: !!(m & 8) }));
for (let m = 0; m < 4; m++) reg(`wall${m}`, (c, o) => wallBase(c, o, !!(m & 1), !!(m & 2)));
reg('window', (c, o) => {
  wallBase(c, o, false, false);
  // cornice, vetro sfumato con riflesso diagonale, tende e davanzale
  px(c, o.x + 2, o.y + 3, 12, 10, C.wallO); px(c, o.x + 3, o.y + 4, 10, 8, '#ffffff');
  px(c, o.x + 4, o.y + 5, 8, 6, '#78b0e8'); px(c, o.x + 4, o.y + 5, 8, 2, '#a8d0f8'); px(c, o.x + 4, o.y + 10, 8, 1, '#5890d0');
  px(c, o.x + 5, o.y + 7, 1, 1, '#e8f4ff'); px(c, o.x + 6, o.y + 6, 1, 1, '#e8f4ff'); px(c, o.x + 7, o.y + 5, 1, 1, '#ffffff');
  px(c, o.x + 4, o.y + 5, 1, 4, '#f0a0a8'); px(c, o.x + 11, o.y + 5, 1, 4, '#f0a0a8');
  px(c, o.x + 8, o.y + 5, 1, 6, '#ffffff');
  px(c, o.x + 1, o.y + 12, 14, 2, C.wallO); px(c, o.x + 2, o.y + 12, 12, 1, C.wallL);
});
reg('door', (c, o) => {
  wallBase(c, o, false, false);
  // tettoia, stipiti, porta a pannelli con pomello e gradino
  px(c, o.x + 1, o.y + 1, 14, 3, C.woodO); px(c, o.x + 2, o.y + 1, 12, 1, C.woodL); px(c, o.x + 2, o.y + 2, 12, 1, C.wood);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(o.x + 2, o.y + 4, 12, 2);
  px(c, o.x + 3, o.y + 4, 10, 12, C.woodO); px(c, o.x + 4, o.y + 5, 8, 11, C.woodD);
  px(c, o.x + 5, o.y + 6, 6, 4, C.wood); px(c, o.x + 5, o.y + 11, 6, 4, C.wood);
  px(c, o.x + 5, o.y + 6, 6, 1, C.woodL); px(c, o.x + 5, o.y + 11, 6, 1, C.woodL); px(c, o.x + 5, o.y + 6, 1, 4, C.woodLL);
  px(c, o.x + 10, o.y + 10, 1, 2, '#f8d030'); px(c, o.x + 10, o.y + 10, 1, 1, '#fff8c0');
  px(c, o.x + 2, o.y + 15, 12, 1, C.stoneD);
});
reg('floor', (c, o) => floorBase(c, o));
reg('iwall_top', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#b4c2d8');
  for (let x = 0; x < 16; x += 4) { px(c, o.x + x, o.y, 1, 16, '#a4b2c8'); px(c, o.x + x + 2, o.y + 6, 1, 1, '#ccd8ec'); }
  px(c, o.x, o.y, 16, 2, '#4a5870'); px(c, o.x, o.y + 2, 16, 1, '#d8e2f0');
});
reg('iwall', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#b4c2d8');
  for (let x = 0; x < 16; x += 4) { px(c, o.x + x, o.y, 1, 9, '#a4b2c8'); px(c, o.x + x + 2, o.y + 3, 1, 1, '#ccd8ec'); }
  // boiserie con modanatura
  px(c, o.x, o.y + 9, 16, 1, '#ffffff'); px(c, o.x, o.y + 10, 16, 1, '#5a6880');
  px(c, o.x, o.y + 11, 16, 4, '#8292ac'); px(c, o.x, o.y + 11, 16, 1, '#a0b0c8');
  for (let x = 1; x < 16; x += 8) { px(c, o.x + x, o.y + 12, 6, 2, '#76869e'); px(c, o.x + x, o.y + 12, 6, 1, '#6a7a92'); }
  px(c, o.x, o.y + 15, 16, 1, '#3e4a60');
});
reg('counter', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x, o.y + 14, 16, 2);
  px(c, o.x, o.y + 2, 16, 12, C.woodO); px(c, o.x, o.y + 3, 16, 3, '#f4f4f4'); px(c, o.x, o.y + 3, 16, 1, '#ffffff'); px(c, o.x, o.y + 5, 16, 1, '#d8d8e0');
  px(c, o.x, o.y + 6, 16, 7, '#e86868'); px(c, o.x, o.y + 6, 16, 1, '#c44848'); px(c, o.x, o.y + 12, 16, 1, '#a43838');
  for (let x = 3; x < 16; x += 8) px(c, o.x + x, o.y + 8, 3, 3, '#f08c8c');
});
reg('shelf', (c, o) => {
  px(c, o.x, o.y, 16, 16, C.woodO); px(c, o.x + 1, o.y + 1, 14, 14, C.woodD); px(c, o.x + 1, o.y + 1, 14, 1, C.wood);
  const cols = ['#d84848', '#4878d8', '#e8c040', '#48a860', '#a058c8', '#f0f0f0', '#e88848'];
  for (let sy = 0; sy < 3; sy++) {
    const y = o.y + 1 + sy * 5;
    px(c, o.x + 1, y + 4, 14, 1, C.woodL);
    for (let bx = 2, k = sy * 2; bx < 14; bx += 2, k++) {
      const h = 3 + ((bx + sy) % 2), col = cols[k % cols.length];
      px(c, o.x + bx, y + 4 - h, 2, h, col); px(c, o.x + bx, y + 4 - h, 1, h, shade(col, 0.3)); px(c, o.x + bx + 1, y + 4 - h, 1, 1, shade(col, -0.3));
    }
  }
});
reg('table', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 1, o.y + 13, 15, 3);
  px(c, o.x + 2, o.y + 11, 2, 4, C.woodO); px(c, o.x + 12, o.y + 11, 2, 4, C.woodO);
  px(c, o.x, o.y + 3, 16, 9, C.woodO); px(c, o.x + 1, o.y + 4, 14, 6, C.wood); px(c, o.x + 1, o.y + 4, 14, 1, C.woodLL); px(c, o.x + 1, o.y + 5, 14, 1, C.woodL);
  px(c, o.x + 1, o.y + 10, 14, 1, C.woodD); px(c, o.x + 4, o.y + 7, 5, 1, shade(C.wood, -0.1));
});
reg('case_table', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x, o.y + 14, 16, 2);
  px(c, o.x, o.y + 4, 16, 11, C.woodO); px(c, o.x, o.y + 5, 16, 7, '#f4f4f4'); px(c, o.x, o.y + 5, 16, 1, '#ffffff'); px(c, o.x, o.y + 12, 16, 2, '#b8b8c8'); px(c, o.x, o.y + 11, 16, 1, '#dcdce6');
});
reg('pc', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 2, o.y + 14, 13, 2);
  px(c, o.x + 1, o.y + 1, 14, 11, C.out); px(c, o.x + 2, o.y + 2, 12, 8, '#4a5a78'); px(c, o.x + 2, o.y + 2, 12, 1, '#6a7a98');
  px(c, o.x + 3, o.y + 3, 10, 6, '#48c880'); px(c, o.x + 3, o.y + 3, 10, 2, '#78e8a8');
  px(c, o.x + 4, o.y + 7, 2, 1, '#206040'); px(c, o.x + 6, o.y + 5, 2, 1, '#206040'); px(c, o.x + 8, o.y + 6, 1, 1, '#206040'); px(c, o.x + 9, o.y + 4, 3, 1, '#206040');
  px(c, o.x + 3, o.y + 3, 2, 1, '#e0fff0');
  px(c, o.x + 5, o.y + 12, 6, 2, '#888898'); px(c, o.x + 3, o.y + 14, 10, 1, C.out); px(c, o.x + 5, o.y + 12, 6, 1, '#a8a8b8');
});
reg('mat', (c, o) => { floorBase(c, o); px(c, o.x + 1, o.y + 3, 14, 11, '#8a2828'); px(c, o.x + 2, o.y + 4, 12, 9, '#d84848'); px(c, o.x + 2, o.y + 4, 12, 1, '#f07070'); for (let x = 3; x < 13; x += 2) px(c, o.x + x, o.y + 6, 1, 5, '#f08080'); });
reg('gate', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#4a4a5a'); px(c, o.x, o.y, 16, 2, '#f8d030'); px(c, o.x, o.y + 2, 16, 1, '#c8a020');
  for (let x = 1; x < 16; x += 4) { px(c, o.x + x, o.y + 3, 2, 13, '#9898a8'); px(c, o.x + x, o.y + 3, 1, 13, '#d0d0e0'); }
  px(c, o.x + 5, o.y + 6, 6, 5, '#f8d030'); px(c, o.x + 5, o.y + 6, 6, 1, '#fff0a0'); px(c, o.x + 7, o.y + 8, 2, 2, '#4a4a5a');
});
for (let f = 0; f < 2; f++) reg(`noise${f}`, (c, o) => {
  px(c, o.x, o.y, 16, 16, '#482868');
  const r = prng(5 + f * 77);
  const cols = ['#f85888', '#f8d030', '#78f0f8', '#ffffff', '#a070f0'];
  for (let i = 0; i < 26; i++) px(c, o.x + Math.floor(r() * 15), o.y + Math.floor(r() * 15), 1 + Math.floor(r() * 2), 1, cols[i % cols.length]);
});
reg('roulette', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#186838');
  c.fillStyle = C.out; c.beginPath(); c.arc(o.x + 8, o.y + 8, 7, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 12; k++) { c.fillStyle = k % 2 ? '#c02828' : '#202020'; c.beginPath(); c.moveTo(o.x + 8, o.y + 8); c.arc(o.x + 8, o.y + 8, 6, (k * Math.PI) / 6, ((k + 1) * Math.PI) / 6); c.fill(); }
  c.fillStyle = '#c8a040'; c.beginPath(); c.arc(o.x + 8, o.y + 8, 2, 0, Math.PI * 2); c.fill();
  px(c, o.x + 8, o.y + 3, 1, 1, '#ffffff');
  hardEdges(c, o);
});
for (let m = 0; m < 16; m++) reg(`rug${m}`, (c, o) => {
  // tappeto su più caselle: bordo dorato solo sui lati esterni, motivo a rombi al centro
  px(c, o.x, o.y, 16, 16, '#7a50b0');
  for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) { px(c, o.x + x + 1, o.y + y, 1, 1, '#9670cc'); px(c, o.x + x, o.y + y + 1, 3, 1, '#9670cc'); px(c, o.x + x + 1, o.y + y + 2, 1, 1, '#9670cc'); }
  const B = '#e8c040', BD = '#a87e20', BO = '#4a2a70';
  if (m & 1) { px(c, o.x, o.y, 16, 1, BO); px(c, o.x, o.y + 1, 16, 2, B); px(c, o.x, o.y + 3, 16, 1, BD); }
  if (m & 4) { px(c, o.x, o.y + 12, 16, 1, B); px(c, o.x, o.y + 13, 16, 2, BD); px(c, o.x, o.y + 15, 16, 1, BO); }
  if (m & 8) { px(c, o.x, o.y, 1, 16, BO); px(c, o.x + 1, o.y, 2, 16, B); px(c, o.x + 3, o.y, 1, 16, BD); }
  if (m & 2) { px(c, o.x + 12, o.y, 1, 16, B); px(c, o.x + 13, o.y, 2, 16, BD); px(c, o.x + 15, o.y, 1, 16, BO); }
});
reg('station', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#d8d0c0');
  px(c, o.x + 7, o.y + 10, 2, 6, '#585868'); px(c, o.x + 7, o.y + 10, 1, 6, '#888898');
  px(c, o.x, o.y, 16, 11, C.out); px(c, o.x + 1, o.y + 1, 14, 9, '#2860b8'); px(c, o.x + 1, o.y + 1, 14, 1, '#5888d8');
  px(c, o.x + 3, o.y + 3, 10, 2, '#ffffff'); px(c, o.x + 3, o.y + 6, 6, 2, '#ffffff'); px(c, o.x + 11, o.y + 6, 2, 2, '#f8d030');
});
reg('bed', (c, o) => {
  floorBase(c, o);
  px(c, o.x + 1, o.y, 14, 16, C.woodO); px(c, o.x + 2, o.y + 1, 12, 14, '#5888e0');
  px(c, o.x + 2, o.y + 6, 12, 1, '#88b0f0'); for (let y = 8; y < 15; y += 3) px(c, o.x + 2, o.y + y, 12, 1, '#4a78d0');
  px(c, o.x + 3, o.y + 1, 10, 4, '#ffffff'); px(c, o.x + 3, o.y + 4, 10, 1, '#c8d0e0'); px(c, o.x + 3, o.y + 1, 3, 1, '#f0f4ff');
});
reg('plant', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 3, o.y + 14, 11, 2);
  px(c, o.x + 4, o.y + 10, 8, 5, C.woodO); px(c, o.x + 5, o.y + 10, 6, 4, '#d07840'); px(c, o.x + 5, o.y + 10, 6, 1, '#f09858'); px(c, o.x + 5, o.y + 11, 1, 3, '#e88850');
  const leaf = (x: number, y: number) => { px(c, o.x + x, o.y + y, 3, 2, C.leaf); px(c, o.x + x, o.y + y, 2, 1, C.leafL); px(c, o.x + x + 2, o.y + y + 1, 1, 1, C.leafD); };
  px(c, o.x + 3, o.y + 2, 10, 8, C.leafO); px(c, o.x + 4, o.y + 3, 8, 6, C.leafDD); leaf(4, 3); leaf(8, 2); leaf(6, 5); leaf(9, 6); leaf(4, 7);
});
reg('window_night', (c, o) => {
  wallBase(c, o, false, false);
  // di notte la finestra è illuminata dall'interno: vetro caldo e alone sul muro
  px(c, o.x + 1, o.y + 2, 14, 12, 'rgba(255,220,140,.25)');
  px(c, o.x + 2, o.y + 3, 12, 10, C.wallO); px(c, o.x + 3, o.y + 4, 10, 8, '#ffe9a0');
  px(c, o.x + 4, o.y + 5, 8, 6, '#ffd060'); px(c, o.x + 4, o.y + 5, 8, 2, '#fff0b8'); px(c, o.x + 4, o.y + 10, 8, 1, '#e8a830');
  px(c, o.x + 4, o.y + 5, 1, 4, '#f0a0a8'); px(c, o.x + 11, o.y + 5, 1, 4, '#f0a0a8');
  px(c, o.x + 8, o.y + 5, 1, 6, '#fff8e0');
  px(c, o.x + 1, o.y + 12, 14, 2, C.wallO); px(c, o.x + 2, o.y + 12, 12, 1, C.wallL);
});
const iwallBase = (c: Ctx, o: { x: number; y: number }) => REG[IDX.iwall].draw(c, o);
function trophy(c: Ctx, o: { x: number; y: number }, col: string, light: string, dark: string, tall: number) {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 4, o.y + 14, 9, 2);
  px(c, o.x + 4, o.y + 12, 8, 3, C.woodO); px(c, o.x + 5, o.y + 12, 6, 2, C.woodD); px(c, o.x + 5, o.y + 12, 6, 1, C.woodL);
  px(c, o.x + 7, o.y + 10 - tall, 2, 2 + tall, dark);
  px(c, o.x + 4, o.y + 4 - tall, 8, 6, dark); px(c, o.x + 5, o.y + 4 - tall, 6, 5, col); px(c, o.x + 5, o.y + 4 - tall, 2, 3, light);
  px(c, o.x + 3, o.y + 5 - tall, 1, 3, dark); px(c, o.x + 12, o.y + 5 - tall, 1, 3, dark);
  px(c, o.x + 6, o.y + 2 - tall, 4, 2, col); px(c, o.x + 6, o.y + 2 - tall, 2, 1, light);
}
reg('trophy_silver', (c, o) => trophy(c, o, '#c8ccd8', '#f4f6ff', '#6a7088', 0));
reg('trophy_gold', (c, o) => trophy(c, o, '#f0c030', '#fff0a0', '#9a7010', 1));
reg('trophy_league', (c, o) => { trophy(c, o, '#f0c030', '#fff0a0', '#9a7010', 2); px(c, o.x + 7, o.y + 1, 2, 1, '#e04848'); px(c, o.x + 6, o.y + 0, 4, 1, '#f06060'); });
reg('poster', (c, o) => {
  iwallBase(c, o);
  px(c, o.x + 2, o.y + 1, 12, 9, '#3a3450'); px(c, o.x + 3, o.y + 2, 10, 7, '#fff4d0');
  // otto medaglie in due file
  const cols = ['#e04848', '#f0a030', '#f0d040', '#48b060', '#4890e0', '#8060c8', '#e070b0', '#80d0d0'];
  cols.forEach((k, i) => px(c, o.x + 4 + (i % 4) * 2, o.y + 3 + Math.floor(i / 4) * 3, 1, 1, k));
  px(c, o.x + 4, o.y + 7, 8, 1, '#8a8070');
});
reg('calendar', (c, o) => {
  iwallBase(c, o);
  px(c, o.x + 4, o.y + 1, 8, 9, '#3a3450'); px(c, o.x + 5, o.y + 2, 6, 7, '#ffffff'); px(c, o.x + 5, o.y + 2, 6, 2, '#e04848');
  for (let y = 5; y < 9; y += 2) for (let x = 5; x < 11; x += 2) px(c, o.x + x, o.y + y, 1, 1, '#9a9aa8');
  px(c, o.x + 7, o.y + 7, 1, 1, '#e04848');
});
reg('frame', (c, o) => {
  iwallBase(c, o);
  px(c, o.x + 3, o.y + 1, 10, 8, '#8a6a30'); px(c, o.x + 4, o.y + 2, 8, 6, '#f0c040'); px(c, o.x + 5, o.y + 3, 6, 4, '#fff8e0');
  px(c, o.x + 6, o.y + 4, 4, 1, '#6a6a7a'); px(c, o.x + 6, o.y + 6, 3, 1, '#6a6a7a'); px(c, o.x + 9, o.y + 5, 1, 1, '#e04848');
});
reg('painting', (c, o) => {
  iwallBase(c, o);
  px(c, o.x + 2, o.y + 1, 12, 8, '#6a4a28'); px(c, o.x + 3, o.y + 2, 10, 6, '#8ac8f0');
  px(c, o.x + 3, o.y + 6, 10, 2, '#58a048'); px(c, o.x + 6, o.y + 3, 4, 3, '#48a060'); px(c, o.x + 7, o.y + 2, 2, 2, '#a0e080');
  px(c, o.x + 10, o.y + 3, 2, 1, '#fff4a0');
});
reg('desk', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 1, o.y + 13, 14, 2);
  px(c, o.x + 1, o.y + 5, 14, 9, C.woodO); px(c, o.x + 2, o.y + 6, 12, 7, C.wood); px(c, o.x + 2, o.y + 6, 12, 1, C.woodL);
  px(c, o.x + 2, o.y + 11, 2, 2, C.woodD); px(c, o.x + 12, o.y + 11, 2, 2, C.woodD);
  // diario aperto e penna
  px(c, o.x + 4, o.y + 7, 7, 4, '#ffffff'); px(c, o.x + 7, o.y + 7, 1, 4, '#c8c8d8'); px(c, o.x + 5, o.y + 8, 2, 1, '#9a9ab0'); px(c, o.x + 8, o.y + 8, 2, 1, '#9a9ab0');
  px(c, o.x + 11, o.y + 7, 1, 4, '#3858c8');
});
reg('arcade', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 3, o.y + 14, 11, 2);
  px(c, o.x + 3, o.y + 1, 10, 14, '#2a2a48'); px(c, o.x + 4, o.y + 2, 8, 12, '#4848a0');
  px(c, o.x + 5, o.y + 3, 6, 5, '#101828'); px(c, o.x + 6, o.y + 4, 1, 1, '#50f080'); px(c, o.x + 8, o.y + 5, 2, 1, '#f0e050'); px(c, o.x + 7, o.y + 6, 1, 1, '#f05050');
  px(c, o.x + 4, o.y + 9, 8, 2, '#6868c0'); px(c, o.x + 6, o.y + 9, 1, 1, '#f04040'); px(c, o.x + 9, o.y + 9, 1, 1, '#f0d040');
  px(c, o.x + 4, o.y + 2, 8, 1, '#f0c040');
});
reg('globe', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 4, o.y + 14, 9, 2);
  px(c, o.x + 5, o.y + 12, 6, 3, C.woodO); px(c, o.x + 6, o.y + 12, 4, 2, C.woodD); px(c, o.x + 7, o.y + 9, 2, 3, C.woodO);
  px(c, o.x + 4, o.y + 3, 8, 7, '#1a4a90'); px(c, o.x + 5, o.y + 2, 6, 9, '#2868c8'); px(c, o.x + 3, o.y + 4, 10, 5, '#2868c8');
  px(c, o.x + 5, o.y + 4, 3, 2, '#58b058'); px(c, o.x + 9, o.y + 5, 2, 3, '#58b058'); px(c, o.x + 6, o.y + 8, 2, 1, '#58b058');
  px(c, o.x + 5, o.y + 3, 2, 1, '#88b8f0'); px(c, o.x + 12, o.y + 2, 1, 9, '#c8a040');
});
reg('radio', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 2, o.y + 14, 12, 2);
  px(c, o.x + 2, o.y + 6, 12, 8, C.woodO); px(c, o.x + 3, o.y + 7, 10, 6, '#b06a3a'); px(c, o.x + 3, o.y + 7, 10, 1, '#d08a58');
  px(c, o.x + 4, o.y + 8, 4, 4, '#4a3a2a'); for (let y = 8; y < 12; y++) px(c, o.x + 4 + (y % 2), o.y + y, 3, 1, '#2a1a10');
  px(c, o.x + 9, o.y + 8, 3, 2, '#f0e8c0'); px(c, o.x + 10, o.y + 8, 1, 1, '#e04848'); px(c, o.x + 9, o.y + 11, 1, 1, '#f0d040'); px(c, o.x + 11, o.y + 11, 1, 1, '#f0d040');
  px(c, o.x + 11, o.y + 2, 1, 4, '#9a9aa8');
});
reg('aquarium', (c, o) => {
  floorBase(c, o);
  c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(o.x + 1, o.y + 14, 14, 2);
  px(c, o.x + 1, o.y + 10, 14, 4, C.woodO); px(c, o.x + 2, o.y + 11, 12, 2, C.woodD);
  px(c, o.x + 1, o.y + 2, 14, 8, '#2a3a50'); px(c, o.x + 2, o.y + 3, 12, 6, '#58b0f0'); px(c, o.x + 2, o.y + 3, 12, 1, '#a8e0ff');
  px(c, o.x + 2, o.y + 8, 12, 1, '#d8c070'); px(c, o.x + 4, o.y + 6, 1, 2, '#48b060'); px(c, o.x + 11, o.y + 5, 1, 3, '#48b060');
  px(c, o.x + 6, o.y + 5, 2, 1, '#f0a030'); px(c, o.x + 8, o.y + 5, 1, 1, '#f0a030'); px(c, o.x + 9, o.y + 7, 2, 1, '#f06060'); px(c, o.x + 5, o.y + 4, 1, 1, '#ffffff');
});
reg('ledge', (c, o) => {
  grassBase(c, o, 0);
  px(c, o.x, o.y + 8, 16, 1, C.grassO); px(c, o.x, o.y + 9, 16, 4, C.sandD); px(c, o.x, o.y + 9, 16, 1, C.sandL); px(c, o.x, o.y + 12, 16, 1, C.sandDD);
  for (let x = 1; x < 16; x += 4) px(c, o.x + x, o.y + 10, 2, 1, C.sandDD);
  c.fillStyle = 'rgba(16,48,24,.3)'; c.fillRect(o.x, o.y + 13, 16, 2);
});
// ---- mare e grotte ----
reg('sand', (c, o) => {
  px(c, o.x, o.y, 16, 16, C.sand);
  const r = prng(o.x * 7 + o.y);
  for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); px(c, o.x + x, o.y + y, 1, 1, i % 3 ? C.sandD : C.sandL); }
  px(c, o.x + 4, o.y + 9, 2, 1, C.sandDD); px(c, o.x + 11, o.y + 4, 2, 1, C.sandDD);
});
function rockFace(c: Ctx, o: { x: number; y: number }, dark: boolean) {
  const b = dark ? '#5a5048' : '#9a8c7c', l = dark ? '#7a6c60' : '#c4b6a2', d = dark ? '#3a322c' : '#6c6054', o2 = dark ? '#221c18' : '#4a3e34';
  px(c, o.x, o.y, 16, 16, b);
  // blocchi di roccia a strati, luce da sinistra in alto
  for (const [x, y, w, h] of [[0, 0, 9, 6], [9, 0, 7, 7], [0, 6, 6, 5], [6, 7, 10, 5], [0, 11, 10, 5], [10, 12, 6, 4]]) {
    px(c, o.x + x, o.y + y, w, h, b); px(c, o.x + x, o.y + y, w, 1, l); px(c, o.x + x, o.y + y, 1, h, l);
    px(c, o.x + x, o.y + y + h - 1, w, 1, d); px(c, o.x + x + w - 1, o.y + y, 1, h, o2);
  }
}
reg('rock', (c, o) => rockFace(c, o, false));
reg('rock_cave', (c, o) => rockFace(c, o, true));
reg('cave', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#6a5c50');
  const r = prng(77 + o.x + o.y * 3);
  for (let i = 0; i < 12; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); px(c, o.x + x, o.y + y, 2, 1, i % 2 ? '#5a4c42' : '#7c6e60'); }
  px(c, o.x + 3, o.y + 11, 1, 1, '#f0d070');
});
reg('cave_mouth', (c, o) => {
  rockFace(c, o, false);
  px(c, o.x + 2, o.y + 4, 12, 12, '#2a2018'); px(c, o.x + 4, o.y + 2, 8, 2, '#2a2018');
  px(c, o.x + 3, o.y + 5, 10, 11, '#120c08'); px(c, o.x + 5, o.y + 3, 6, 2, '#120c08');
  px(c, o.x + 2, o.y + 15, 12, 1, '#3a2c20');
});
reg('ladder', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#6a5c50');
  px(c, o.x + 3, o.y + 2, 10, 13, '#120c08');
  px(c, o.x + 4, o.y + 1, 1, 15, '#c08848'); px(c, o.x + 11, o.y + 1, 1, 15, '#c08848');
  for (let y = 3; y < 15; y += 3) px(c, o.x + 4, o.y + y, 8, 1, '#e0a860');
});
for (const onCave of [false, true]) reg(onCave ? 'boulder_cave' : 'boulder', (c, o) => {
  if (onCave) { px(c, o.x, o.y, 16, 16, '#6a5c50'); } else grassBase(c, o, 0);
  c.fillStyle = 'rgba(16,48,24,.3)'; c.fillRect(o.x + 2, o.y + 13, 13, 2);
  px(c, o.x + 2, o.y + 3, 12, 11, '#4a3e34'); px(c, o.x + 3, o.y + 2, 10, 12, '#4a3e34');
  px(c, o.x + 3, o.y + 3, 10, 10, '#a89480'); px(c, o.x + 4, o.y + 3, 6, 3, '#d0c0a8'); px(c, o.x + 9, o.y + 9, 4, 4, '#7c6a58');
  // crepa a forma di simbolo di commissione: "%"
  px(c, o.x + 5, o.y + 7, 1, 1, '#4a3e34'); px(c, o.x + 10, o.y + 10, 1, 1, '#4a3e34');
  for (let i = 0; i < 5; i++) px(c, o.x + 10 - i, o.y + 6 + i, 1, 1, '#4a3e34');
});
reg('pier', (c, o) => {
  px(c, o.x, o.y, 16, 16, C.water);
  px(c, o.x + 1, o.y, 14, 16, '#8a5828');
  for (let y = 0; y < 16; y += 4) { px(c, o.x + 1, o.y + y, 14, 3, '#c08848'); px(c, o.x + 1, o.y + y, 14, 1, '#e0a860'); }
  px(c, o.x + 1, o.y, 1, 16, '#5a3418'); px(c, o.x + 14, o.y, 1, 16, '#5a3418');
});
reg('case_blue', (c, o) => briefcase(c, o, '#3878d8'));
reg('case_purple', (c, o) => briefcase(c, o, '#8858c8'));
reg('case_orange', (c, o) => briefcase(c, o, '#f08830'));

export const TILE_ATLAS_COLS = COLS;
export function tileIndex(name: string): number { return IDX[name]; }
export function tileName(idx: number): string { return REG[idx]?.name ?? ''; }

/** Un singolo tile alla risoluzione logica 16×16 (senza Scale3x): serve alla resa 2.5D per ricavare maschere e colori. */
export function drawTileRaw(name: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = T; cv.height = T;
  const r = REG[IDX[name]];
  if (r) r.draw(cv.getContext('2d')!, { x: 0, y: 0 });
  return cv;
}

let tileSheet: HTMLCanvasElement | undefined;
/** Atlante di tutti i tile alla scala di resa (disegnato una volta sola, usato da Phaser e dalla 2.5D). */
export function drawTiles(): HTMLCanvasElement {
  if (tileSheet) return tileSheet;
  const cv = document.createElement('canvas');
  const rows = Math.ceil(REG.length / COLS);
  cv.width = T * COLS;
  cv.height = T * rows;
  const c = cv.getContext('2d')!;
  REG.forEach((r, i) => r.draw(c, { x: (i % COLS) * T, y: Math.floor(i / COLS) * T }));
  tileSheet = upscale(cv);
  return tileSheet;
}

/** Porta un atlante alla scala di resa (RS). Ogni tile viene smussato da solo, così i bordi tra tile non sbavano. */
function upscale(cv: HTMLCanvasElement, cellW = T, cellH = T): HTMLCanvasElement {
  if (RS !== 3) {
    const out = document.createElement('canvas'); out.width = cv.width * RS; out.height = cv.height * RS;
    const oc = out.getContext('2d')!; oc.imageSmoothingEnabled = false;
    const cell = document.createElement('canvas'); cell.width = cellW; cell.height = cellH;
    const cc = cell.getContext('2d')!;
    for (let y = 0; y < cv.height; y += cellH) for (let x = 0; x < cv.width; x += cellW) {
      cc.clearRect(0, 0, cellW, cellH); cc.drawImage(cv, x, y, cellW, cellH, 0, 0, cellW, cellH);
      const big = RS === 2 ? scale2x(cell) : cell;
      oc.drawImage(big, 0, 0, big.width, big.height, x * RS, y * RS, cellW * RS, cellH * RS);
    }
    return out;
  }
  // un'unica lettura e un'unica scrittura dei pixel: su telefono ogni lettura di un canvas costa molto
  // (prima si leggeva e riscriveva ogni cella da sola, migliaia di volte per il foglio dei personaggi)
  const w = cv.width, h = cv.height;
  const src = new Uint32Array(cv.getContext('2d')!.getImageData(0, 0, w, h).data.buffer);
  return pixelsToCanvas(scale3xPixels(src, w, h, cellW, cellH), w * 3, h * 3);
}

function pixelsToCanvas(px: Uint32Array, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  out.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px.buffer as ArrayBuffer, px.byteOffset, w * h * 4), w, h), 0, 0);
  return out;
}

/**
 * Scale3x (variante di EPX) su pixel grezzi (un intero a 32 bit per pixel). L'immagine è divisa in celle
 * cellW×cellH e ogni cella è smussata da sola: ai bordi della cella il pixel vicino è quello del bordo stesso.
 */
export function scale3xPixels(s: Uint32Array, w: number, h: number, cellW = w, cellH = h): Uint32Array {
  const W3 = w * 3;
  const d = new Uint32Array(W3 * h * 3);
  for (let y = 0; y < h; y++) {
    const cy0 = y - (y % cellH), cy1 = Math.min(h, cy0 + cellH) - 1;
    const ru = (y > cy0 ? y - 1 : y) * w, rm = y * w, rd = (y < cy1 ? y + 1 : y) * w;
    const o0 = 3 * y * W3, o1 = o0 + W3, o2 = o1 + W3;
    for (let x = 0; x < w; x++) {
      const cx0 = x - (x % cellW), cx1 = Math.min(w, cx0 + cellW) - 1;
      const xl = x > cx0 ? x - 1 : x, xr = x < cx1 ? x + 1 : x;
      const A = s[ru + xl], B = s[ru + x], C = s[ru + xr];
      const D = s[rm + xl], E = s[rm + x], F = s[rm + xr];
      const G = s[rd + xl], H = s[rd + x], I = s[rd + xr];
      let e0 = E, e1 = E, e2 = E, e3 = E, e5 = E, e6 = E, e7 = E, e8 = E;
      if (B !== H && D !== F) {
        e0 = D === B ? D : E;
        e1 = (D === B && E !== C) || (B === F && E !== A) ? B : E;
        e2 = B === F ? F : E;
        e3 = (D === B && E !== G) || (D === H && E !== A) ? D : E;
        e5 = (B === F && E !== I) || (H === F && E !== C) ? F : E;
        e6 = D === H ? D : E;
        e7 = (D === H && E !== I) || (H === F && E !== G) ? H : E;
        e8 = H === F ? F : E;
      }
      const X = 3 * x;
      d[o0 + X] = e0; d[o0 + X + 1] = e1; d[o0 + X + 2] = e2;
      d[o1 + X] = e3; d[o1 + X + 1] = E; d[o1 + X + 2] = e5;
      d[o2 + X] = e6; d[o2 + X + 1] = e7; d[o2 + X + 2] = e8;
    }
  }
  return d;
}

const PATHLIKE = new Set<number>([TILE.PATH, TILE.PLAZA, TILE.STATION, TILE.SIGN, TILE.DOOR, TILE.GATE, TILE.CAVE_MOUTH, TILE.PIER]);
const ROOFSET: Record<number, string> = { [TILE.ROOF]: 'roof', [TILE.ROOF_CLINIC]: 'roof_clinic', [TILE.ROOF_ACADEMY]: 'roof_academy', [TILE.ROOF_SPECIAL]: 'roof_special' };

/** Tile che proiettano un'ombra sulla casella sotto (alberi e facciate). */
const CASTERS = new Set<number>([TILE.TREE, TILE.WALL, TILE.WINDOW, TILE.FENCE]);
function casts(t: number) { return CASTERS.has(t); }

function hash(x: number, y: number) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

/** Converte la mappa logica nei tile visivi (bordi automatici, varianti e fotogramma di animazione). */
const DECOR_NAME: Record<number, string> = { [TILE.TROPHY_S]: 'trophy_silver', [TILE.TROPHY_G]: 'trophy_gold', [TILE.TROPHY_L]: 'trophy_league', [TILE.POSTER]: 'poster', [TILE.CALENDAR]: 'calendar', [TILE.DESK]: 'desk', [TILE.ARCADE]: 'arcade', [TILE.FRAME]: 'frame', [TILE.GLOBE]: 'globe', [TILE.PAINTING]: 'painting', [TILE.RADIO]: 'radio', [TILE.AQUARIUM]: 'aquarium' };

export function visualTiles(tiles: number[][], frame = 0, night = false): number[][] {
  const h = tiles.length, w = tiles[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : tiles[y][x]);
  const mask = (x: number, y: number, same: (t: number) => boolean) =>
    (same(at(x, y - 1)) || at(x, y - 1) === -1 ? 0 : 1) | (same(at(x + 1, y)) || at(x + 1, y) === -1 ? 0 : 2) |
    (same(at(x, y + 1)) || at(x, y + 1) === -1 ? 0 : 4) | (same(at(x - 1, y)) || at(x - 1, y) === -1 ? 0 : 8);
  // nelle grotte la roccia è più scura
  const cave = tiles.some((r) => r.includes(TILE.CAVE));
  return tiles.map((row, y) => row.map((t, x) => {
    const hv = hash(x, y);
    switch (t) {
      case TILE.GRASS: return casts(at(x, y - 1)) ? IDX.grass_sh : IDX[`grass${hv % 7 === 0 ? 2 : hv % 3 === 0 ? 1 : 0}`];
      case TILE.FLOWERS: return IDX[`flowers${frame}`];
      case TILE.MARKET: return IDX[`tall${hv % 9 === 0 ? 1 : 0}`];
      case TILE.PATH: {
        const notGrass = (n: number) => !(n === TILE.GRASS || n === TILE.FLOWERS || n === TILE.MARKET || n === TILE.TREE || n === TILE.FENCE || n === TILE.LEDGE || n === TILE.WATER);
        return IDX[`path${mask(x, y, (n) => notGrass(n) || PATHLIKE.has(n))}${casts(at(x, y - 1)) ? 's' : ''}`];
      }
      case TILE.PLAZA: return IDX.plaza;
      case TILE.TREE: return IDX[`tree${hv % 2}`];
      case TILE.WATER: return IDX[`water${frame}_${mask(x, y, (n) => n === TILE.WATER)}`];
      case TILE.FENCE: return IDX.fence;
      case TILE.SIGN: return IDX.sign;
      case TILE.ROOF: case TILE.ROOF_CLINIC: case TILE.ROOF_ACADEMY: case TILE.ROOF_SPECIAL:
        return IDX[`${ROOFSET[t]}${mask(x, y, (n) => n === t)}`];
      case TILE.WALL: {
        const isW = (n: number) => n === TILE.WALL || n === TILE.WINDOW || n === TILE.DOOR;
        return IDX[`wall${(isW(at(x - 1, y)) ? 0 : 1) | (isW(at(x + 1, y)) ? 0 : 2)}`];
      }
      case TILE.WINDOW: return night ? IDX.window_night : IDX.window;
      case TILE.DOOR: return IDX.door;
      case TILE.FLOOR: return IDX.floor;
      case TILE.IWALL: return at(x, y + 1) === TILE.IWALL ? IDX.iwall_top : IDX.iwall;
      case TILE.COUNTER: return IDX.counter;
      case TILE.SHELF: return IDX.shelf;
      case TILE.TABLE: return IDX.table;
      case TILE.CASE_TABLE: return IDX.case_table;
      case TILE.PC: return IDX.pc;
      case TILE.MAT: return IDX.mat;
      case TILE.GATE: return IDX.gate;
      case TILE.NOISE: return IDX[`noise${frame}`];
      case TILE.ROULETTE: return IDX.roulette;
      case TILE.RUG: return IDX[`rug${mask(x, y, (n) => n === TILE.RUG)}`];
      case TILE.STATION: return IDX.station;
      case TILE.BED: return IDX.bed;
      case TILE.PLANT: return IDX.plant;
      case TILE.LEDGE: return IDX.ledge;
      case TILE.SAND: return IDX.sand;
      case TILE.ROCK: return IDX[cave ? 'rock_cave' : 'rock'];
      case TILE.CAVE: return IDX.cave;
      case TILE.CAVE_MOUTH: return IDX.cave_mouth;
      case TILE.BOULDER: return IDX[cave ? 'boulder_cave' : 'boulder'];
      case TILE.PIER: return IDX.pier;
      case TILE.LADDER: return IDX.ladder;
      default: return DECOR_NAME[t] ? IDX[DECOR_NAME[t]] : IDX.grass0;
    }
  }));
}

/** Tile che cambiano tra i fotogrammi dell'animazione. */
export const ANIMATED = new Set<number>([TILE.WATER, TILE.FLOWERS, TILE.NOISE]);


// ---------------- Sprite dei personaggi (16×24, quattro direzioni, tre fotogrammi) ----------------

export const CW = 16;
export const CH = 24;

// Legenda: o contorno · h capelli · H luce capelli · d capelli scuri · s pelle · S pelle in ombra · e occhi
// c maglia · C maglia in ombra · x dettaglio (cravatta, sciarpa) · p pantaloni · P pantaloni scuri · k scarpe
// Le viste frontale e posteriore sono descritte a metà (8 colonne) e specchiate.
const FRONT_HALF = [
  '........',
  '........',
  '.....ooo',
  '...oohhh',
  '..ohhhHH',
  '.ohhhhhH',
  '.ohhhhhh',
  '.ohdhhhh',
  '.ohdssss',
  '.odssess',
  '.odssess',
  '..oSssss',
  '...ooSss',
  '...occcx',
  '..occccx',
  '.occCccc',
  '.occCccc',
  '.osoCccc',
  '..oppppp',
  '...oppPo',
  '...oppo.',
  '...okko.',
  '....oo..',
  '........',
];
const BACK_HALF = FRONT_HALF.map((r, i) => {
  if (i >= 8 && i <= 10) return ['.ohhhhhh', '.ohdhhhh', '.odhhhhh'][i - 8];
  if (i === 11) return '..odhhhh';
  if (i === 12) return '...oodSs';
  return r.replace(/x/g, 'c');
});
const SIDE = [
  '................',
  '................',
  '.....ooooo......',
  '...oohhhhhoo....',
  '..ohhhhHHhhho...',
  '.ohhhhhhHHhhho..',
  '.ohhhhhhhhhhho..',
  '.ohdhhhhhhhhhho.',
  '.odhhhsssssssso.',
  '.odhhssssssesso.',
  '.odhhssssssesso.',
  '..odhsssssssSo..',
  '...ooSsssSooo...',
  '....occcxco.....',
  '...occcccco.....',
  '...occsCcco.....',
  '...occsCcco.....',
  '...occsscco.....',
  '....oppppo......',
  '....opPppo......',
  '.....oppo.......',
  '.....okkko......',
  '......ooo.......',
  '................',
];
// Gambe dei passi (righe 18-22) per la vista laterale.
const SIDE_STEP = [
  ['....opppppo.....', '...oppooppo.....', '...okko.oppo....', '....oo..okko....', '.........oo.....'],
  ['....oppppo......', '....opPppo......', '....oppppo......', '....okkkko......', '.....oooo.......'],
];

function mirrorHalf(rows: string[]): string[] { return rows.map((r) => r + r.split('').reverse().join('')); }

export interface CharPal { skin: string; hair: string; shirt: string; pants: string; extra?: string; cap?: string; long?: boolean }

// Cappellino del protagonista: righe 2-7 della testa (q tessuto, Q riflesso, b visiera, w stemma).
const CAP_FRONT_HALF = ['.....ooo', '...ooqqq', '..oqqqQw', '.oqqqqQQ', '.obbbbbb', '.ohdhhhh'];
const CAP_BACK_HALF = ['.....ooo', '...ooqqq', '..oqqqQQ', '.oqqqqqQ', '.oqqqqqq', '.ohhhhhh'];
const CAP_SIDE = ['.....ooooo......', '...ooqqqqqoo....', '..oqqqqQQqqqo...', '.oqqqqqqQQqqqo..', '.oqqqqqqqqqbbbbo', '.ohdhhhhhhhhhho.'];

function withCap(rows: string[], dir: number): string[] {
  const cap = dir === 0 ? mirrorHalf(CAP_FRONT_HALF) : dir === 1 ? mirrorHalf(CAP_BACK_HALF) : CAP_SIDE;
  return rows.map((r, y) => (y >= 2 && y < 2 + cap.length ? cap[y - 2] : r));
}

// Capelli lunghi della protagonista (righe 11-17): ciocche ai lati del viso, chioma sciolta sulla schiena.
// Sovrapposizioni: '.' lascia il pixel del corpo com'è.
const LONG_FRONT_HALF = ['.od.....', '.odh....', '.odh....', '.odhh...', '.odd....', '..oo....'];
const LONG_BACK_HALF = ['...oddhh', '..odhhhH', '..odhhhh', '..oddhhh', '...oddhh', '....oooo'];
const LONG_SIDE = ['.odh', '.odh', '.odh', '.odh', '.odd', '..oo'];

function withLongHair(rows: string[], dir: number): string[] {
  const over = dir === 0 ? mirrorHalf(LONG_FRONT_HALF) : dir === 1 ? mirrorHalf(LONG_BACK_HALF) : LONG_SIDE;
  const top = dir === 1 ? 12 : 11;
  return rows.map((r, y) => {
    const o = over[y - top];
    if (!o) return r;
    return r.split('').map((ch, x) => (o[x] && o[x] !== '.' ? o[x] : ch)).join('');
  });
}
// ---------------- Personaggi ----------------


/** Colori proposti dal Prof. Saldi; l'indice è S.avatar (0 rosso, 1 blu, 2 verde come nei vecchi salvataggi). */
export const PLAYER_COLOR_LIST = [
  { name: 'Rosso', hex: '#e0473d' },
  { name: 'Blu', hex: '#3d8ee8' },
  { name: 'Verde', hex: '#3a9a5b' },
  { name: 'Giallo', hex: '#e8b828' },
  { name: 'Viola', hex: '#8a56c2' },
  { name: 'Arancione', hex: '#f08a30' },
  { name: 'Rosa', hex: '#f070a8' },
  { name: 'Nero', hex: '#3a3a48' },
];
const PLAYER_PAL_BASE = 32;

export const PALETTES: CharPal[] = [
  { skin: '#f5c9a0', hair: '#5a3418', shirt: '#e0473d', pants: '#2d3b6b' }, // 0 avatar A
  { skin: '#e8b48a', hair: '#1f1f2a', shirt: '#3d8ee8', pants: '#3a3a3a' }, // 1 avatar B
  { skin: '#c98e62', hair: '#e8c547', shirt: '#3a9a5b', pants: '#4a3a2a' }, // 2 avatar C / Gaia
  { skin: '#f5c9a0', hair: '#8a8a8a', shirt: '#f2f2f2', pants: '#5a5a6a', extra: '#3d7fd9' }, // 3 Prof / Orazio
  { skin: '#f0c0a0', hair: '#7a3a28', shirt: '#2c4a7a', pants: '#22345a' }, // 4 Dott.ssa Ratio (funzionaria della Banca) / Vera
  { skin: '#e8b48a', hair: '#3a2a1a', shirt: '#8a56c2', pants: '#2a2a3a' }, // 5 rivale / Cosimo
  { skin: '#d9a77a', hair: '#c8463d', shirt: '#7af0ff', pants: '#3a5a7a' }, // 6 Serena
  { skin: '#b5835a', hair: '#1f1f2a', shirt: '#5a5a6a', pants: '#2a2a2a' }, // 7 Rocco
  { skin: '#f5c9a0', hair: '#f2f2f2', shirt: '#e8c547', pants: '#4a3a2a' }, // 8 Whale 5
  { skin: '#c98e62', hair: '#5a3418', shirt: '#f2a541', pants: '#3a5a2a' }, // 9 Whale 6
  { skin: '#f0c0a0', hair: '#3a2a1a', shirt: '#2a5ea8', pants: '#1f1f2a' }, // 10 Marta
  { skin: '#e8b48a', hair: '#8a8a8a', shirt: '#4fb06a', pants: '#2a2a3a' }, // 11 Tito
  { skin: '#d9a77a', hair: '#1f1f2a', shirt: '#c8463d', pants: '#1f1f2a' }, // 12 Giulia
  { skin: '#f5c9a0', hair: '#7af0ff', shirt: '#3a3a5a', pants: '#1f1f2a' }, // 13 Fabio
  { skin: '#e8b48a', hair: '#e8c547', shirt: '#f2f2f2', pants: '#e8c547' }, // 14 Campione
  { skin: '#f5c9a0', hair: '#1f1f2a', shirt: '#1f1f2a', pants: '#1f1f2a', extra: '#c8463d' }, // 15 Speculatore
  { skin: '#e8b48a', hair: '#5a3418', shirt: '#9aa5b1', pants: '#4a4a5a' }, // 16 passante
  { skin: '#c98e62', hair: '#3a2a1a', shirt: '#ffb347', pants: '#3a5a7a' }, // 17 passante
  { skin: '#f0c0a0', hair: '#c8463d', shirt: '#7fd1ae', pants: '#4a3a2a' }, // 18 passante
  { skin: '#d9a77a', hair: '#8a8a8a', shirt: '#b06ad9', pants: '#2d3b6b' }, // 19 passante
  { skin: '#b5835a', hair: '#1f1f2a', shirt: '#2a5ea8', pants: '#2a2a2a', extra: '#e8c547' }, // 20 guardia
  { skin: '#f5c9a0', hair: '#e8c547', shirt: '#e5546b', pants: '#2a2a3a' }, // 21 allievo
  { skin: '#e8b48a', hair: '#5a3418', shirt: '#5fc9c9', pants: '#2a2a3a' }, // 22 allievo
  { skin: '#f0c0a0', hair: '#3a2a1a', shirt: '#6cc04a', pants: '#4a4a5a' }, // 23 bibliotecaria
  { skin: '#f5c9a0', hair: '#b85a28', shirt: '#f0f0f0', pants: '#5878b8' }, // 24 abitante
  { skin: '#c98e62', hair: '#2a2018', shirt: '#7890a8', pants: '#383848', extra: '#e8c547' }, // 25 abitante
  { skin: '#e8b48a', hair: '#6a4a2a', shirt: '#b84848', pants: '#4a3a2a' }, // 26 abitante
  { skin: '#f0c0a0', hair: '#d8a848', shirt: '#58a8a0', pants: '#f0f0f0' }, // 27 abitante
  { skin: '#b5835a', hair: '#1f1f2a', shirt: '#e8a040', pants: '#2a3a5a' }, // 28 abitante
  { skin: '#f5c9a0', hair: '#7a3a5a', shirt: '#c870a8', pants: '#3a2a4a' }, // 29 abitante
  { skin: '#d9a77a', hair: '#4a3020', shirt: '#486848', pants: '#c8b890' }, // 30 abitante
  { skin: '#f0c0a0', hair: '#e8e0d0', shirt: '#4858a0', pants: '#585868', extra: '#c84848' }, // 31 abitante
  // 32+ protagonista: stesso viso e capelli, vestiti e cappellino del colore scelto dal Prof. Saldi
  ...PLAYER_COLOR_LIST.map((c) => ({ skin: '#f5c9a0', hair: '#5a3418', shirt: c.hex, pants: '#2d3b6b', extra: '#f2f2f2', cap: c.hex })),
  // poi la protagonista: stessi colori, capelli lunghi con la coda di cavallo
  ...PLAYER_COLOR_LIST.map((c) => ({ skin: '#f5c9a0', hair: '#5a3418', shirt: c.hex, pants: '#2d3b6b', extra: '#f2f2f2', cap: c.hex, long: true })),
];

/** Riga della palette del protagonista per il colore scelto (S.avatar) e il genere (S.gender). */
export function playerPal(avatar: number, gender?: 'm' | 'f'): number {
  const n = PLAYER_COLOR_LIST.length;
  return PLAYER_PAL_BASE + (gender === 'f' ? n : 0) + (((avatar | 0) % n) + n) % n;
}

export const PAL = { PROF: 3, NURSE: 4, RIVAL: 5, SPEC: 15, GUARD: 20, LIB: 23 };

function colorsFor(p: CharPal): Record<string, string> {
  return {
    o: '#283038', h: p.hair, H: shade(p.hair, 0.18), d: shade(p.hair, -0.3), s: p.skin, S: shade(p.skin, -0.18), e: (p as Look).eyes ?? '#283038',
    c: p.shirt, C: shade(p.shirt, -0.25), x: p.extra ?? shade(p.shirt, -0.25), p: p.pants, P: shade(p.pants, -0.3), k: '#403838',
    ...(p.cap ? { q: p.cap, Q: shade(p.cap, 0.22), b: shade(p.cap, -0.3), w: '#f2f2f2' } : {}),
  };
}

function paint(c: Ctx, ox: number, oy: number, rows: string[], col: Record<string, string>, flip = false) {
  const at = (x: number, y: number) => { const r = rows[y]; if (!r || x < 0 || x >= r.length) return '.'; return r[flip ? r.length - 1 - x : x]; };
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = at(x, y);
      if (ch === '.' || !col[ch]) continue;
      let fill = col[ch];
      if (ch === 'o') {
        // contorno colorato: prende il colore della parte che racchiude, molto scurito (stile DS)
        const nb = [at(x, y + 1), at(x + 1, y), at(x - 1, y), at(x, y - 1)].find((k) => k !== '.' && k !== 'o' && col[k]);
        fill = nb ? shade(col[nb], -0.62) : col.o;
      }
      c.fillStyle = fill;
      c.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

/** Righe del fotogramma: dir 0 giù, 1 su, 2 sinistra, 3 destra · frame 0 fermo, 1-2 passo. */
function frameRows(dir: number, frame: number): { rows: string[]; flip: boolean } {
  if (dir === 0 || dir === 1) {
    const base = mirrorHalf(dir === 0 ? FRONT_HALF : BACK_HALF);
    if (frame === 0) return { rows: base, flip: false };
    const rows = base.slice();
    // un piede avanti: abbassa la gamba sinistra o destra di un pixel e sposta il busto
    const leftSide = frame === 1;
    for (let y = 23; y >= 19; y--) {
      const cur = rows[y].split(''), above = rows[y - 1].split('');
      for (let x = leftSide ? 0 : 8; x < (leftSide ? 8 : 16); x++) cur[x] = above[x];
      rows[y] = cur.join('');
    }
    // braccio opposto in avanti
    return { rows: rows.map((r, y) => (y === 17 ? (leftSide ? r.replace(/^\.oso/, '.ocC') : r) : r)), flip: false };
  }
  const rows = SIDE.slice();
  if (frame > 0) SIDE_STEP[frame - 1].forEach((r, i) => (rows[18 + i] = r));
  if (frame === 1) rows[15] = '...occCcsco.....', rows[16] = '...occCcsco.....', rows[17] = '...occccsso.....';
  return { rows, flip: dir === 2 };
}

function drawChar(c: Ctx, ox: number, oy: number, p: CharPal, dir: number, frame: number) {
  // l'ombra a terra è uno sprite separato nella scena
  const fr = frameRows(dir, frame);
  const capped = p.cap ? withCap(fr.rows, dir) : fr.rows;
  const rows = p.long ? withLongHair(capped, dir) : capped;
  paint(c, ox, oy + (frame ? -1 : 0) * 0, rows, colorsFor(p), fr.flip);
}

// Dopo le palette fisse vengono gli aspetti generati per i personaggi generici (src/art/looks.ts).
const LOOK_BASE = {} as Record<LookPool, number>;
/** Tutte le palette disegnate nel foglio 'chars': fisse + folla, anziani, guardie, speculatori. */
export const CHAR_PALETTES: CharPal[] = POOL_ORDER.reduce<CharPal[]>((all, k) => { LOOK_BASE[k] = all.length; return all.concat(POOLS[k]); }, PALETTES.slice());
/** Palette per un personaggio generico: sempre la stessa per lo stesso seme (id o nome). */
export function lookPal(seed: string, pool: LookPool = 'crowd', bump = 0): number { return LOOK_BASE[pool] + lookIndex(seed, pool, bump); }
/** Il gruppo a cui appartiene una palette generata (undefined per le palette fisse). */
export function lookPoolOf(pal: number): LookPool | undefined { return POOL_ORDER.find((k) => pal >= LOOK_BASE[k] && pal < LOOK_BASE[k] + POOLS[k].length); }
/** Palette per riga nel foglio 'chars' (12 fotogrammi ciascuna): il foglio resta sotto i 4096 px anche su mobile. */
export const CHAR_PER_ROW = 6;

/**
 * Pixel grezzi con la stessa interfaccia minima di un contesto 2D (fillStyle + fillRect), per disegnare i personaggi
 * senza migliaia di chiamate al canvas: su un telefono ogni fillRect su un canvas accelerato costa caro.
 */
class PixelPainter {
  readonly px: Uint32Array;
  private color = 0;
  private static cache = new Map<string, number>();
  constructor(readonly w: number, readonly h: number) { this.px = new Uint32Array(w * h); }
  set fillStyle(css: string) {
    let v = PixelPainter.cache.get(css);
    if (v === undefined) {
      // '#rrggbb' (tutte le tinte dei personaggi); byte in memoria R, G, B, A come in ImageData
      const n = parseInt(css.slice(1, 7), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      v = LITTLE_ENDIAN ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
      PixelPainter.cache.set(css, v);
    }
    this.color = v;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.px[yy * this.w + xx] = this.color;
  }
}
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

let charSheet: HTMLCanvasElement | undefined;
/**
 * Pixel del foglio di tutti i personaggi già alla scala di resa (RS = 3). Calcolo puro, senza canvas: può girare
 * in un worker (systems/prewarm.ts) mentre il giocatore è sul titolo, così all'avvio del mondo il foglio è pronto.
 */
export function characterSheetPixels(): { px: Uint32Array; w: number; h: number } {
  const w = CW * 12 * CHAR_PER_ROW, h = CH * Math.ceil(CHAR_PALETTES.length / CHAR_PER_ROW);
  const pp = new PixelPainter(w, h);
  const c = pp as unknown as Ctx;
  CHAR_PALETTES.forEach((p, i) => {
    const ox = (i % CHAR_PER_ROW) * 12 * CW, oy = Math.floor(i / CHAR_PER_ROW) * CH;
    for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) drawChar(c, ox + (dir * 3 + f) * CW, oy, p, dir, f);
  });
  return RS === 3 ? { px: scale3xPixels(pp.px, w, h, CW, CH), w: w * 3, h: h * 3 } : { px: pp.px, w, h };
}
/** Usa i pixel del foglio calcolati altrove (dal worker). Ignorati se il foglio c'è già o le misure non tornano. */
export function adoptCharacterPixels(px: Uint32Array, w: number, h: number): boolean {
  if (charSheet || RS !== 3) return false;
  const W = CW * 12 * CHAR_PER_ROW * 3, H = CH * Math.ceil(CHAR_PALETTES.length / CHAR_PER_ROW) * 3;
  if (w !== W || h !== H || px.length !== W * H) return false;
  charPixels = px;
  charSheet = pixelsToCanvas(px, w, h);
  return true;
}
/** Il foglio dei personaggi è già pronto (non costa più niente chiederlo). */
export function charactersReady(): boolean { return !!charSheet; }
/** Foglio di tutti i personaggi alla scala di resa. Si disegna una volta sola: le palette non cambiano durante il gioco. */
export function drawCharacters(): HTMLCanvasElement {
  if (charSheet) return charSheet;
  const s = characterSheetPixels();
  if (RS === 3) { charPixels = s.px; charSheet = pixelsToCanvas(s.px, s.w, s.h); }
  else charSheet = upscale(pixelsToCanvas(s.px, s.w, s.h), CW, CH);
  return charSheet;
}
let charPixels: Uint32Array | undefined;
/**
 * Pixel RGBA del foglio dei personaggi (come getImageData().data), senza rileggerli dal canvas: su telefono
 * rileggere un canvas grande blocca la pagina per molto tempo.
 */
export function characterPixels(): Uint8ClampedArray {
  const cv = drawCharacters();
  if (!charPixels) charPixels = new Uint32Array(cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data.buffer);
  return new Uint8ClampedArray(charPixels.buffer as ArrayBuffer, charPixels.byteOffset, charPixels.length * 4);
}

/**
 * Foglio piccolo con solo alcuni personaggi (per la landing): stessa disposizione di drawCharacters
 * (12 fotogrammi per palette, CHAR_PER_ROW palette per riga) ma solo con le palette richieste, nell'ordine dato.
 */
export function drawCharactersFor(pals: number[]): HTMLCanvasElement {
  const w = CW * 12 * CHAR_PER_ROW, h = CH * Math.ceil(pals.length / CHAR_PER_ROW);
  const pp = new PixelPainter(w, h);
  pals.forEach((pal, i) => {
    const p = CHAR_PALETTES[pal % CHAR_PALETTES.length];
    const ox = (i % CHAR_PER_ROW) * 12 * CW, oy = Math.floor(i / CHAR_PER_ROW) * CH;
    for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) drawChar(pp as unknown as Ctx, ox + (dir * 3 + f) * CW, oy, p, dir, f);
  });
  return RS === 3 ? pixelsToCanvas(scale3xPixels(pp.px, w, h, CW, CH), w * 3, h * 3) : upscale(pixelsToCanvas(pp.px, w, h), CW, CH);
}

/** Scale3x: triplica la risoluzione smussando le diagonali senza sfocare (variante dell'algoritmo EPX). */
export function scale3x(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const px = new Uint32Array(src.getContext('2d')!.getImageData(0, 0, w, h).data.buffer);
  return pixelsToCanvas(scale3xPixels(px, w, h), w * 3, h * 3);
}

/** Scale2x (EPX): raddoppia la risoluzione arrotondando le diagonali, per sprite di sfida più definiti. */
function scale2x(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const s = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w * 2; out.height = h * 2;
  const oc = out.getContext('2d')!; const im = oc.createImageData(w * 2, h * 2); const d = im.data;
  const px32 = (x: number, y: number) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); const i = (y * w + x) * 4; return (s[i] << 24 | s[i + 1] << 16 | s[i + 2] << 8 | s[i + 3]) >>> 0; };
  const put = (x: number, y: number, v: number) => { const i = (y * w * 2 + x) * 4; d[i] = v >>> 24; d[i + 1] = (v >>> 16) & 255; d[i + 2] = (v >>> 8) & 255; d[i + 3] = v & 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = px32(x, y), A = px32(x, y - 1), B = px32(x + 1, y), Cc = px32(x - 1, y), D = px32(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (A !== D && Cc !== B) { if (Cc === A) e0 = A; if (A === B) e1 = B; if (Cc === D) e2 = Cc; if (D === B) e3 = D; }
    put(2 * x, 2 * y, e0); put(2 * x + 1, 2 * y, e1); put(2 * x, 2 * y + 1, e2); put(2 * x + 1, 2 * y + 1, e3);
  }
  oc.putImageData(im, 0, 0);
  return out;
}

function bigSprite(pal: number, dir: number, scale: number): string {
  const small = document.createElement('canvas');
  small.width = CW; small.height = CH;
  drawChar(small.getContext('2d')!, 0, 0, CHAR_PALETTES[pal % CHAR_PALETTES.length], dir, 0);
  // due passaggi di Scale2x (×4) e poi ingrandimento nitido fino alla scala richiesta
  const smooth = scale2x(scale2x(small));
  const cv = document.createElement('canvas');
  cv.width = CW * scale; cv.height = CH * scale;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(smooth, 0, 0, CW * scale, CH * scale);
  return cv.toDataURL();
}

/** Sprite grande frontale per le schermate di sfida. */
export function portrait(pal: number): string { return bigSprite(pal, 0, 4); }

/**
 * Fumetto che compare sopra un allenatore quando ti nota: un simbolo del dollaro verde (12×14 pixel).
 * Usato dalla scena 2D e dal diorama 2.5D.
 */
export function drawSpotBubble(): HTMLCanvasElement {
  const bb = document.createElement('canvas'); bb.width = 12; bb.height = 14;
  const b = bb.getContext('2d')!;
  b.fillStyle = '#202020'; b.fillRect(1, 0, 10, 11); b.fillRect(0, 1, 12, 9); b.fillRect(4, 11, 4, 1); b.fillRect(5, 12, 2, 1);
  b.fillStyle = '#ffffff'; b.fillRect(2, 1, 8, 9); b.fillRect(1, 2, 10, 7); b.fillRect(5, 10, 2, 1);
  // "$": asta in alto e in basso, S a tre tratti
  b.fillStyle = '#1e9a4a';
  b.fillRect(5, 1, 2, 1);
  b.fillRect(4, 2, 4, 1); b.fillRect(3, 3, 2, 1);
  b.fillRect(4, 4, 3, 1); b.fillRect(5, 5, 3, 1);
  b.fillRect(7, 6, 2, 1); b.fillRect(4, 7, 4, 1);
  b.fillRect(5, 8, 2, 1);
  return bb;
}

/** Icona dell'app (PNG data URL) */
export function appIcon(size: number): string {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#1b2a4a'; c.fillRect(0, 0, size, size);
  c.strokeStyle = '#3ddc84'; c.lineWidth = size / 12; c.beginPath();
  c.moveTo(size * 0.15, size * 0.7); c.lineTo(size * 0.4, size * 0.45); c.lineTo(size * 0.55, size * 0.58); c.lineTo(size * 0.85, size * 0.25); c.stroke();
  return cv.toDataURL('image/png');
}

/** Fondale della schermata del titolo: città al tramonto con un grafico che sale (240×160). */
export function titleBackdrop(): string {
  const W = 240, H = 160;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const bands = ['#202858', '#283068', '#383878', '#504888', '#705090', '#985890', '#c06888', '#e08078', '#f09868', '#f8b860'];
  bands.forEach((col, i) => px(c, 0, i * 10, W, 10, col));
  // retinatura tra le bande, come sulle portatili
  for (let i = 1; i < bands.length; i++) for (let x = (i % 2); x < W; x += 2) px(c, x, i * 10 - 1, 1, 1, bands[i]);
  c.fillStyle = '#f8e8a0'; c.beginPath(); c.arc(184, 96, 18, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f8f8d0'; c.beginPath(); c.arc(184, 96, 13, 0, Math.PI * 2); c.fill();
  const r = prng(2024);
  // skyline lontana e vicina
  for (const [col, base, hmin, hmax, win] of [['#584078', 112, 14, 40, '#906890'], ['#302848', 118, 20, 58, '#f8d870']] as [string, number, number, number, string][]) {
    let x = -4;
    while (x < W) {
      const w = 10 + Math.floor(r() * 16), h = hmin + Math.floor(r() * (hmax - hmin));
      px(c, x, base - h, w, h + 10, col);
      if (r() < 0.3) px(c, x + Math.floor(w / 2), base - h - 6, 1, 6, col);
      for (let wy = base - h + 3; wy < base - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() < 0.35) px(c, wx, wy, 1, 2, win);
      x += w + Math.floor(r() * 3);
    }
  }
  // grafico in crescita sopra la città
  const pts = [[8, 100], [40, 88], [62, 94], [92, 70], [116, 78], [150, 50], [172, 58], [210, 26], [232, 18]];
  c.lineWidth = 3; c.strokeStyle = '#185828'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y + 1) : c.moveTo(x, y + 1))); c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#58e878'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  px(c, 228, 14, 8, 2, '#58e878'); px(c, 232, 14, 2, 8, '#58e878');
  // colline ed erba
  for (let x = 0; x < W; x++) {
    const hy = 120 + Math.round(Math.sin(x / 19) * 3 + Math.sin(x / 7) * 1);
    px(c, x, hy, 1, H - hy, C.grass); px(c, x, hy, 1, 1, C.grassDD); px(c, x, hy + 1, 1, 1, C.grassL);
  }
  for (let x = 0; x < W; x += 4) { const y = 146 + ((x / 4) % 2); px(c, x, y, 4, 14, C.tall); px(c, x + 1, y - 3, 1, 4, C.tallL); px(c, x + 2, y - 2, 1, 3, C.tallL); px(c, x + 3, y, 1, 2, C.tallD); }
  return cv.toDataURL();
}
