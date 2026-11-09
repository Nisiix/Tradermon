// Tutta la grafica di Tradermon è generata in codice (pixel art originale, nessun asset esterno).

export const T = 16;

export const TILE = {
  GRASS: 0, FLOWERS: 1, PATH: 2, TREE: 3, WATER: 4, MARKET: 5, FENCE: 6, SIGN: 7, ROOF: 8, WALL: 9, DOOR: 10,
  WINDOW: 11, FLOOR: 12, IWALL: 13, COUNTER: 14, SHELF: 15, TABLE: 16, PC: 17, MAT: 18, GATE: 19, NOISE: 20,
  ROOF_CLINIC: 21, ROOF_ACADEMY: 22, ROOF_SPECIAL: 23, PLAZA: 24, ROULETTE: 25, RUG: 26, CASE_TABLE: 27, STATION: 28, BED: 29, PLANT: 30, LEDGE: 31,
} as const;
export const TILE_COUNT = 32;

export const SOLID = new Set<number>([TILE.TREE, TILE.WATER, TILE.FENCE, TILE.SIGN, TILE.ROOF, TILE.WALL, TILE.WINDOW, TILE.IWALL, TILE.COUNTER, TILE.SHELF, TILE.TABLE, TILE.PC, TILE.GATE, TILE.NOISE, TILE.ROOF_CLINIC, TILE.ROOF_ACADEMY, TILE.ROOF_SPECIAL, TILE.ROULETTE, TILE.CASE_TABLE, TILE.STATION, TILE.BED, TILE.PLANT]);

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

const C = {
  grass: '#78c850', grassL: '#a0e078', grassD: '#58a838', grassDD: '#387828',
  tall: '#4c9c34', tallL: '#88d060', tallD: '#2c6c1c',
  sand: '#e8d098', sandL: '#f8e8b8', sandD: '#c8a868', sandDD: '#a08048',
  water: '#4888e8', waterL: '#88b8f8', waterD: '#3060c0', foam: '#d8ecff',
  leaf: '#48a040', leafL: '#80d058', leafD: '#2c7028', leafO: '#18401c',
  bark: '#8c5a30', barkD: '#5c3818',
  wood: '#c88850', woodL: '#e8b070', woodD: '#985c30', woodO: '#583418',
  wall: '#f0e8d0', wallD: '#d0c4a0', wallO: '#686050',
  floor: '#d8b078', floorL: '#e8c890', floorD: '#b08850',
  out: '#283028',
};

// Registro dei tile visivi: ogni tile logico può avere varianti (bordi, animazioni).
const COLS = 16;
type Draw = (c: Ctx, o: { x: number; y: number }) => void;
const REG: { name: string; draw: Draw }[] = [];
const IDX: Record<string, number> = {};
function reg(name: string, draw: Draw) { IDX[name] = REG.length; REG.push({ name, draw }); }

function grassBase(c: Ctx, o: { x: number; y: number }, v = 0) {
  px(c, o.x, o.y, 16, 16, C.grass);
  const r = prng(17 + v * 31);
  for (let i = 0; i < 4; i++) {
    const x = o.x + 1 + Math.floor(r() * 13), y = o.y + 2 + Math.floor(r() * 12);
    px(c, x, y, 1, 1, C.grassD); px(c, x + 2, y, 1, 1, C.grassD); px(c, x + 1, y - 1, 1, 1, C.grassL);
  }
  if (v === 2) { px(c, o.x + 10, o.y + 4, 1, 1, C.grassL); px(c, o.x + 4, o.y + 11, 1, 1, C.grassL); }
}

function tree(c: Ctx, o: { x: number; y: number }, v: number) {
  grassBase(c, o, 1);
  // ombra a terra
  px(c, o.x + 2, o.y + 14, 12, 2, C.grassDD);
  // tronco
  px(c, o.x + 6, o.y + 11, 4, 4, C.bark); px(c, o.x + 6, o.y + 11, 1, 4, C.barkD); px(c, o.x + 9, o.y + 11, 1, 4, C.barkD);
  // chioma a nuvola con contorno
  const rows = [[5, 10], [3, 12], [2, 13], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [2, 13], [2, 13], [3, 12], [5, 10]];
  rows.forEach(([a, b], i) => { px(c, o.x + a - 1, o.y + i, b - a + 3, 1, C.leafO); });
  rows.forEach(([a, b], i) => { px(c, o.x + a, o.y + i, b - a + 1, 1, i < 1 || i > 10 ? C.leafD : C.leaf); });
  for (let i = 1; i < 11; i++) { px(c, o.x + rows[i][1] - 1, o.y + i, 2, 1, C.leafD); }
  for (let i = 8; i < 11; i++) px(c, o.x + rows[i][0], o.y + i, rows[i][1] - rows[i][0] + 1, 1, C.leafD);
  // luci
  px(c, o.x + 4, o.y + 2, 4, 1, C.leafL); px(c, o.x + 3, o.y + 3, 3, 2, C.leafL); px(c, o.x + 7 + v, o.y + 5, 2, 1, C.leafL);
  px(c, o.x + 10, o.y + 3, 2, 1, C.leafL);
  // ciuffi
  px(c, o.x + 5, o.y + 7, 1, 1, C.leafD); px(c, o.x + 9 - v, o.y + 8, 1, 1, C.leafD); px(c, o.x + 11, o.y + 6, 1, 1, C.leafD);
}

/** Bordo d'erba sopra un tile di sentiero o acqua; m = maschera dei lati diversi (1 su, 2 destra, 4 giù, 8 sinistra). */
function grassEdges(c: Ctx, o: { x: number; y: number }, m: number, line: string) {
  if (m & 1) { px(c, o.x, o.y, 16, 2, C.grass); for (let x = 0; x < 16; x += 4) px(c, o.x + x + 1, o.y + 2, 2, 1, C.grass); px(c, o.x, o.y + 2, 16, 0, line); for (let x = 0; x < 16; x++) px(c, o.x + x, o.y + ((x % 4 === 1 || x % 4 === 2) ? 3 : 2), 1, 1, line); }
  if (m & 4) { px(c, o.x, o.y + 14, 16, 2, C.grass); for (let x = 0; x < 16; x++) px(c, o.x + x, o.y + ((x % 4 === 1 || x % 4 === 2) ? 12 : 13), 1, 1, line); for (let x = 0; x < 16; x += 4) px(c, o.x + x + 1, o.y + 13, 2, 1, C.grass); }
  if (m & 8) { px(c, o.x, o.y, 2, 16, C.grass); for (let y = 0; y < 16; y++) px(c, o.x + ((y % 4 === 1 || y % 4 === 2) ? 3 : 2), o.y + y, 1, 1, line); for (let y = 0; y < 16; y += 4) px(c, o.x + 2, o.y + y + 1, 1, 2, C.grass); }
  if (m & 2) { px(c, o.x + 14, o.y, 2, 16, C.grass); for (let y = 0; y < 16; y++) px(c, o.x + ((y % 4 === 1 || y % 4 === 2) ? 12 : 13), o.y + y, 1, 1, line); for (let y = 0; y < 16; y += 4) px(c, o.x + 13, o.y + y + 1, 1, 2, C.grass); }
}

function roof(c: Ctx, o: { x: number; y: number }, base: string, pos: { top: boolean; left: boolean; right: boolean; bottom: boolean }) {
  const L = shade(base, 0.3), D = shade(base, -0.25), DD = shade(base, -0.5);
  px(c, o.x, o.y, 16, 16, base);
  for (let y = 0; y < 16; y += 4) {
    px(c, o.x, o.y + y + 3, 16, 1, D);
    px(c, o.x, o.y + y, 16, 1, L);
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) px(c, o.x + x, o.y + y + 1, 1, 2, D);
  }
  if (pos.top) { px(c, o.x, o.y, 16, 2, L); px(c, o.x, o.y, 16, 1, DD); px(c, o.x, o.y + 2, 16, 1, shade(base, 0.5)); }
  if (pos.bottom) { px(c, o.x, o.y + 13, 16, 2, D); px(c, o.x, o.y + 15, 16, 1, DD); }
  if (pos.left) { px(c, o.x, o.y, 1, 16, DD); px(c, o.x + 1, o.y, 1, 16, L); }
  if (pos.right) { px(c, o.x + 15, o.y, 1, 16, DD); px(c, o.x + 14, o.y, 1, 16, D); }
}

function wallBase(c: Ctx, o: { x: number; y: number }, left: boolean, right: boolean) {
  px(c, o.x, o.y, 16, 16, C.wall);
  px(c, o.x, o.y, 16, 2, C.wallD);
  px(c, o.x, o.y + 7, 16, 1, '#e4dabc');
  px(c, o.x, o.y + 14, 16, 2, C.wallD); px(c, o.x, o.y + 15, 16, 1, C.wallO);
  if (left) px(c, o.x, o.y, 1, 16, C.wallO);
  if (right) px(c, o.x + 15, o.y, 1, 16, C.wallO);
}

function floorBase(c: Ctx, o: { x: number; y: number }) {
  px(c, o.x, o.y, 16, 16, C.floor);
  for (let y = 0; y < 16; y += 4) { px(c, o.x, o.y + y, 16, 1, C.floorL); px(c, o.x, o.y + y + 3, 16, 1, C.floorD); }
  [[3, 0], [11, 4], [6, 8], [14, 12]].forEach(([x, y]) => px(c, o.x + x, o.y + y + 1, 1, 2, C.floorD));
}

function briefcase(c: Ctx, o: { x: number; y: number }, col: string) {
  const D = shade(col, -0.35), L = shade(col, 0.35);
  px(c, o.x + 5, o.y + 3, 6, 2, C.out); px(c, o.x + 6, o.y + 4, 4, 1, 'transparent');
  c.clearRect(o.x + 6, o.y + 4, 4, 1);
  px(c, o.x + 2, o.y + 5, 12, 9, C.out);
  px(c, o.x + 3, o.y + 6, 10, 7, col);
  px(c, o.x + 3, o.y + 6, 10, 1, L);
  px(c, o.x + 3, o.y + 12, 10, 1, D);
  px(c, o.x + 7, o.y + 8, 2, 2, '#f8d848');
  px(c, o.x + 3, o.y + 14, 10, 1, 'rgba(0,0,0,0.25)');
}

// ---- registrazione ----
for (let v = 0; v < 3; v++) reg(`grass${v}`, (c, o) => grassBase(c, o, v));
for (let f = 0; f < 2; f++) reg(`flowers${f}`, (c, o) => {
  grassBase(c, o, 1);
  const fl = (x: number, y: number, col: string) => {
    px(c, o.x + x - 1, o.y + y, 3, 1, col); px(c, o.x + x, o.y + y - 1, 1, 3, col);
    px(c, o.x + x, o.y + y, 1, 1, '#f8d030'); px(c, o.x + x, o.y + y + 2, 1, 1, C.grassD);
  };
  const d = f ? 1 : 0;
  fl(4, 4 + d, '#f86870'); fl(11, 3, '#ffffff'); fl(6, 11, '#ffffff'); fl(12, 11 - d, '#f86870');
});
for (let v = 0; v < 2; v++) reg(`tall${v}`, (c, o) => {
  px(c, o.x, o.y, 16, 16, C.tall);
  for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
    const bx = o.x + k * 4 + (row ? 2 : 0) - (row && k === 3 ? 0 : 0), by = o.y + row * 8;
    px(c, bx, by + 6, 4, 2, C.tallD);
    px(c, bx + 1, by + 1, 1, 5, C.tallL); px(c, bx, by + 3, 1, 3, C.tallL); px(c, bx + 2, by + 2, 1, 4, C.tallL);
    px(c, bx + 3, by + 3, 1, 3, C.tallD);
  }
  if (v === 1) { px(c, o.x + 12, o.y + 3, 1, 1, '#fff8b0'); px(c, o.x + 11, o.y + 4, 3, 1, '#f8d030'); px(c, o.x + 12, o.y + 5, 1, 1, '#fff8b0'); }
});
for (let m = 0; m < 16; m++) reg(`path${m}`, (c, o) => {
  px(c, o.x, o.y, 16, 16, C.sand);
  const r = prng(91 + m);
  for (let i = 0; i < 7; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); px(c, o.x + x, o.y + y, 1, 1, i % 2 ? C.sandD : C.sandL); }
  grassEdges(c, o, m, C.grassDD);
});
reg('plaza', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#d8d0c0');
  px(c, o.x, o.y + 7, 16, 1, '#b0a898'); px(c, o.x, o.y + 15, 16, 1, '#b0a898');
  px(c, o.x + 7, o.y, 1, 7, '#b0a898'); px(c, o.x + 15, o.y + 8, 1, 7, '#b0a898');
  px(c, o.x, o.y, 7, 1, '#e8e0d0'); px(c, o.x + 8, o.y + 8, 7, 1, '#e8e0d0');
});
for (let v = 0; v < 2; v++) reg(`tree${v}`, (c, o) => tree(c, o, v));
for (let f = 0; f < 2; f++) for (let m = 0; m < 16; m++) reg(`water${f}_${m}`, (c, o) => {
  px(c, o.x, o.y, 16, 16, C.water);
  const sh = f ? 2 : 0;
  px(c, o.x + 2 + sh, o.y + 4, 4, 1, C.waterL); px(c, o.x + 3 + sh, o.y + 5, 2, 1, C.waterD);
  px(c, o.x + 9 - sh, o.y + 10, 4, 1, C.waterL); px(c, o.x + 10 - sh, o.y + 11, 2, 1, C.waterD);
  // schiuma lungo le rive
  if (m & 1) px(c, o.x, o.y + 3, 16, 1, C.foam);
  if (m & 4) px(c, o.x, o.y + 12, 16, 1, C.foam);
  if (m & 8) px(c, o.x + 3, o.y, 1, 16, C.foam);
  if (m & 2) px(c, o.x + 12, o.y, 1, 16, C.foam);
  grassEdges(c, o, m, C.grassDD);
});
reg('fence', (c, o) => {
  grassBase(c, o, 0);
  px(c, o.x, o.y + 5, 16, 3, C.woodO); px(c, o.x, o.y + 6, 16, 1, C.woodL);
  px(c, o.x, o.y + 10, 16, 3, C.woodO); px(c, o.x, o.y + 11, 16, 1, C.woodL);
  for (const x of [2, 11]) { px(c, o.x + x, o.y + 2, 4, 13, C.woodO); px(c, o.x + x + 1, o.y + 3, 2, 11, C.wood); px(c, o.x + x + 1, o.y + 3, 1, 11, C.woodL); }
  px(c, o.x + 2, o.y + 15, 13, 1, C.grassDD);
});
reg('sign', (c, o) => {
  grassBase(c, o, 0);
  px(c, o.x + 7, o.y + 10, 2, 5, C.woodO); px(c, o.x + 1, o.y + 1, 14, 10, C.woodO);
  px(c, o.x + 2, o.y + 2, 12, 8, C.wood); px(c, o.x + 2, o.y + 2, 12, 1, C.woodL); px(c, o.x + 2, o.y + 9, 12, 1, C.woodD);
  px(c, o.x + 4, o.y + 4, 8, 1, C.woodD); px(c, o.x + 4, o.y + 6, 6, 1, C.woodD);
  px(c, o.x + 4, o.y + 15, 8, 1, C.grassDD);
});
const ROOFS: [string, string][] = [['roof', '#d05038'], ['roof_clinic', '#3878d8'], ['roof_academy', '#38a058'], ['roof_special', '#8858c8']];
for (const [name, col] of ROOFS) for (let m = 0; m < 16; m++) reg(`${name}${m}`, (c, o) => roof(c, o, col, { top: !!(m & 1), right: !!(m & 2), bottom: !!(m & 4), left: !!(m & 8) }));
for (let m = 0; m < 4; m++) reg(`wall${m}`, (c, o) => wallBase(c, o, !!(m & 1), !!(m & 2)));
reg('window', (c, o) => {
  wallBase(c, o, false, false);
  px(c, o.x + 3, o.y + 3, 10, 9, C.wallO); px(c, o.x + 4, o.y + 4, 8, 7, '#88c0f0');
  px(c, o.x + 4, o.y + 4, 8, 1, '#c8e8ff'); px(c, o.x + 5, o.y + 5, 2, 1, '#ffffff'); px(c, o.x + 5, o.y + 6, 1, 1, '#ffffff');
  px(c, o.x + 8, o.y + 4, 1, 7, C.wallO); px(c, o.x + 3, o.y + 12, 10, 1, C.wallD);
});
reg('door', (c, o) => {
  wallBase(c, o, false, false);
  px(c, o.x + 3, o.y + 1, 10, 15, C.woodO); px(c, o.x + 4, o.y + 2, 8, 14, C.woodD);
  px(c, o.x + 5, o.y + 3, 6, 5, C.wood); px(c, o.x + 5, o.y + 9, 6, 6, C.wood); px(c, o.x + 5, o.y + 3, 6, 1, C.woodL);
  px(c, o.x + 10, o.y + 9, 1, 2, '#f8d030');
  px(c, o.x + 2, o.y + 15, 12, 1, '#a09078');
});
reg('floor', (c, o) => floorBase(c, o));
reg('iwall_top', (c, o) => { px(c, o.x, o.y, 16, 16, '#a8b8d0'); px(c, o.x, o.y, 16, 3, '#586880'); px(c, o.x, o.y + 3, 16, 1, '#c8d4e8'); for (let x = 2; x < 16; x += 6) px(c, o.x + x, o.y + 6, 2, 8, '#98a8c0'); });
reg('iwall', (c, o) => { px(c, o.x, o.y, 16, 16, '#a8b8d0'); for (let x = 2; x < 16; x += 6) px(c, o.x + x, o.y, 2, 9, '#98a8c0'); px(c, o.x, o.y + 10, 16, 1, '#586880'); px(c, o.x, o.y + 11, 16, 4, '#788aa4'); px(c, o.x, o.y + 11, 16, 1, '#98a8c0'); px(c, o.x, o.y + 15, 16, 1, '#485870'); });
reg('counter', (c, o) => {
  floorBase(c, o);
  px(c, o.x, o.y + 2, 16, 12, C.woodO); px(c, o.x, o.y + 3, 16, 3, '#f0f0f0'); px(c, o.x, o.y + 3, 16, 1, '#ffffff');
  px(c, o.x, o.y + 6, 16, 7, '#e86868'); px(c, o.x, o.y + 6, 16, 1, '#c84848'); px(c, o.x, o.y + 12, 16, 1, '#a83838');
  px(c, o.x, o.y + 14, 16, 1, 'rgba(0,0,0,.2)');
});
reg('shelf', (c, o) => {
  px(c, o.x, o.y, 16, 16, C.woodO); px(c, o.x + 1, o.y + 1, 14, 14, C.woodD);
  const cols = ['#d84848', '#4878d8', '#e8c040', '#48a860', '#a058c8', '#f0f0f0'];
  for (let sy = 0; sy < 3; sy++) {
    const y = o.y + 1 + sy * 5;
    px(c, o.x + 1, y + 4, 14, 1, C.wood);
    for (let bx = 2, k = sy; bx < 14; bx += 2, k++) { const h = 3 + ((bx + sy) % 2); px(c, o.x + bx, y + 4 - h, 2, h, cols[k % cols.length]); px(c, o.x + bx, y + 4 - h, 1, h, shade(cols[k % cols.length], 0.3)); }
  }
});
reg('table', (c, o) => {
  floorBase(c, o);
  px(c, o.x + 2, o.y + 12, 2, 4, C.woodO); px(c, o.x + 12, o.y + 12, 2, 4, C.woodO);
  px(c, o.x, o.y + 3, 16, 10, C.woodO); px(c, o.x + 1, o.y + 4, 14, 7, C.wood); px(c, o.x + 1, o.y + 4, 14, 2, C.woodL); px(c, o.x + 1, o.y + 11, 14, 1, C.woodD);
});
reg('case_table', (c, o) => {
  floorBase(c, o);
  px(c, o.x, o.y + 4, 16, 11, C.woodO); px(c, o.x, o.y + 5, 16, 7, '#f0f0f0'); px(c, o.x, o.y + 5, 16, 1, '#ffffff'); px(c, o.x, o.y + 12, 16, 2, '#b8b8c8');
});
reg('pc', (c, o) => {
  floorBase(c, o);
  px(c, o.x + 1, o.y + 1, 14, 11, C.out); px(c, o.x + 2, o.y + 2, 12, 8, '#305080');
  px(c, o.x + 3, o.y + 3, 10, 6, '#58d890');
  px(c, o.x + 4, o.y + 7, 2, 1, '#206040'); px(c, o.x + 6, o.y + 5, 2, 1, '#206040'); px(c, o.x + 8, o.y + 6, 1, 1, '#206040'); px(c, o.x + 9, o.y + 4, 3, 1, '#206040');
  px(c, o.x + 3, o.y + 3, 3, 1, '#b8f8d0');
  px(c, o.x + 5, o.y + 12, 6, 2, '#888898'); px(c, o.x + 3, o.y + 14, 10, 1, C.out);
});
reg('mat', (c, o) => { floorBase(c, o); px(c, o.x + 1, o.y + 3, 14, 11, '#a83030'); px(c, o.x + 2, o.y + 4, 12, 9, '#e05050'); for (let x = 3; x < 13; x += 2) px(c, o.x + x, o.y + 6, 1, 5, '#f07878'); });
reg('gate', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#484858'); px(c, o.x, o.y, 16, 2, '#f8d030');
  for (let x = 1; x < 16; x += 4) { px(c, o.x + x, o.y + 2, 2, 14, '#9898a8'); px(c, o.x + x, o.y + 2, 1, 14, '#c8c8d8'); }
  px(c, o.x + 5, o.y + 6, 6, 5, '#f8d030'); px(c, o.x + 7, o.y + 8, 2, 2, '#484858');
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
});
reg('rug', (c, o) => { px(c, o.x, o.y, 16, 16, '#7048a8'); px(c, o.x + 1, o.y + 1, 14, 14, '#9068c8'); px(c, o.x + 3, o.y + 3, 10, 10, '#7048a8'); px(c, o.x + 6, o.y + 6, 4, 4, '#e8c040'); });
reg('station', (c, o) => {
  px(c, o.x, o.y, 16, 16, '#d8d0c0');
  px(c, o.x + 7, o.y + 10, 2, 6, '#585868');
  px(c, o.x, o.y, 16, 11, C.out); px(c, o.x + 1, o.y + 1, 14, 9, '#2860b8');
  px(c, o.x + 3, o.y + 3, 10, 2, '#ffffff'); px(c, o.x + 3, o.y + 6, 6, 2, '#ffffff'); px(c, o.x + 11, o.y + 6, 2, 2, '#f8d030');
});
reg('bed', (c, o) => {
  floorBase(c, o);
  px(c, o.x + 1, o.y, 14, 16, C.woodO); px(c, o.x + 2, o.y + 1, 12, 14, '#5888e0');
  px(c, o.x + 3, o.y + 1, 10, 4, '#ffffff'); px(c, o.x + 3, o.y + 4, 10, 1, '#c8d0e0');
  px(c, o.x + 2, o.y + 6, 12, 1, '#88b0f0');
});
reg('plant', (c, o) => {
  floorBase(c, o);
  px(c, o.x + 4, o.y + 10, 8, 5, C.woodO); px(c, o.x + 5, o.y + 10, 6, 4, '#d07840'); px(c, o.x + 5, o.y + 10, 6, 1, '#f09858');
  const leaf = (x: number, y: number) => { px(c, o.x + x, o.y + y, 3, 2, C.leaf); px(c, o.x + x, o.y + y, 2, 1, C.leafL); };
  px(c, o.x + 3, o.y + 2, 10, 8, C.leafO); leaf(4, 3); leaf(8, 2); leaf(6, 5); leaf(9, 6); leaf(4, 7);
});
reg('ledge', (c, o) => {
  grassBase(c, o, 0);
  px(c, o.x, o.y + 9, 16, 1, C.grassDD); px(c, o.x, o.y + 10, 16, 3, '#a08048'); px(c, o.x, o.y + 10, 16, 1, '#c8a868'); px(c, o.x, o.y + 13, 16, 1, C.grassDD);
});
reg('case_blue', (c, o) => briefcase(c, o, '#3878d8'));
reg('case_green', (c, o) => briefcase(c, o, '#38a058'));
reg('case_orange', (c, o) => briefcase(c, o, '#f08830'));

export const TILE_ATLAS_COLS = COLS;
export function tileIndex(name: string): number { return IDX[name]; }

export function drawTiles(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const rows = Math.ceil(REG.length / COLS);
  cv.width = T * COLS;
  cv.height = T * rows;
  const c = cv.getContext('2d')!;
  REG.forEach((r, i) => r.draw(c, { x: (i % COLS) * T, y: Math.floor(i / COLS) * T }));
  return cv;
}

const PATHLIKE = new Set<number>([TILE.PATH, TILE.PLAZA, TILE.STATION, TILE.SIGN, TILE.DOOR, TILE.GATE]);
const ROOFSET: Record<number, string> = { [TILE.ROOF]: 'roof', [TILE.ROOF_CLINIC]: 'roof_clinic', [TILE.ROOF_ACADEMY]: 'roof_academy', [TILE.ROOF_SPECIAL]: 'roof_special' };

function hash(x: number, y: number) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

/** Converte la mappa logica nei tile visivi (bordi automatici, varianti e fotogramma di animazione). */
export function visualTiles(tiles: number[][], frame = 0): number[][] {
  const h = tiles.length, w = tiles[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : tiles[y][x]);
  const mask = (x: number, y: number, same: (t: number) => boolean) =>
    (same(at(x, y - 1)) || at(x, y - 1) === -1 ? 0 : 1) | (same(at(x + 1, y)) || at(x + 1, y) === -1 ? 0 : 2) |
    (same(at(x, y + 1)) || at(x, y + 1) === -1 ? 0 : 4) | (same(at(x - 1, y)) || at(x - 1, y) === -1 ? 0 : 8);
  return tiles.map((row, y) => row.map((t, x) => {
    const hv = hash(x, y);
    switch (t) {
      case TILE.GRASS: return IDX[`grass${hv % 7 === 0 ? 2 : hv % 3 === 0 ? 1 : 0}`];
      case TILE.FLOWERS: return IDX[`flowers${frame}`];
      case TILE.MARKET: return IDX[`tall${hv % 9 === 0 ? 1 : 0}`];
      case TILE.PATH: {
        const notGrass = (n: number) => !(n === TILE.GRASS || n === TILE.FLOWERS || n === TILE.MARKET || n === TILE.TREE || n === TILE.FENCE || n === TILE.LEDGE || n === TILE.WATER);
        return IDX[`path${mask(x, y, (n) => notGrass(n) || PATHLIKE.has(n))}`];
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
      case TILE.WINDOW: return IDX.window;
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
      case TILE.RUG: return IDX.rug;
      case TILE.STATION: return IDX.station;
      case TILE.BED: return IDX.bed;
      case TILE.PLANT: return IDX.plant;
      case TILE.LEDGE: return IDX.ledge;
      default: return IDX.grass0;
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

export interface CharPal { skin: string; hair: string; shirt: string; pants: string; extra?: string }
// ---------------- Personaggi ----------------


export const PALETTES: CharPal[] = [
  { skin: '#f5c9a0', hair: '#5a3418', shirt: '#e0473d', pants: '#2d3b6b' }, // 0 avatar A
  { skin: '#e8b48a', hair: '#1f1f2a', shirt: '#3d8ee8', pants: '#3a3a3a' }, // 1 avatar B
  { skin: '#c98e62', hair: '#e8c547', shirt: '#3a9a5b', pants: '#4a3a2a' }, // 2 avatar C / Gaia
  { skin: '#f5c9a0', hair: '#8a8a8a', shirt: '#f2f2f2', pants: '#5a5a6a', extra: '#3d7fd9' }, // 3 Prof / Orazio
  { skin: '#f0c0a0', hair: '#ff8ab0', shirt: '#ffffff', pants: '#ff8ab0' }, // 4 Dott.ssa Ratio / Vera
  { skin: '#e8b48a', hair: '#3a2a1a', shirt: '#8a56c2', pants: '#2a2a3a' }, // 5 rivale / Cosimo
  { skin: '#d9a77a', hair: '#c8463d', shirt: '#7af0ff', pants: '#3a5a7a' }, // 6 Serena
  { skin: '#b5835a', hair: '#1f1f2a', shirt: '#5a5a6a', pants: '#2a2a2a' }, // 7 Rocco
  { skin: '#f5c9a0', hair: '#f2f2f2', shirt: '#e8c547', pants: '#4a3a2a' }, // 8 Mentore 5
  { skin: '#c98e62', hair: '#5a3418', shirt: '#f2a541', pants: '#3a5a2a' }, // 9 Mentore 6
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
];

export const PAL = { PROF: 3, NURSE: 4, RIVAL: 5, SPEC: 15, GUARD: 20, LIB: 23 };

function colorsFor(p: CharPal): Record<string, string> {
  return {
    o: '#283038', h: p.hair, H: shade(p.hair, 0.18), d: shade(p.hair, -0.3), s: p.skin, S: shade(p.skin, -0.18), e: '#283038',
    c: p.shirt, C: shade(p.shirt, -0.25), x: p.extra ?? shade(p.shirt, -0.25), p: p.pants, P: shade(p.pants, -0.3), k: '#403838',
  };
}

function paint(c: Ctx, ox: number, oy: number, rows: string[], col: Record<string, string>, flip = false) {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[flip ? r.length - 1 - x : x];
      if (ch === '.' || !col[ch]) continue;
      c.fillStyle = col[ch];
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
  // ombra ellittica
  c.fillStyle = 'rgba(24,32,40,0.28)';
  c.fillRect(ox + 4, oy + 21, 8, 2); c.fillRect(ox + 3, oy + 22, 10, 1);
  const { rows, flip } = frameRows(dir, frame);
  paint(c, ox, oy + (frame ? -1 : 0) * 0, rows, colorsFor(p), flip);
}

export function drawCharacters(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CW * 12;
  cv.height = CH * PALETTES.length;
  const c = cv.getContext('2d')!;
  PALETTES.forEach((p, row) => {
    for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 3; f++) drawChar(c, (dir * 3 + f) * CW, row * CH, p, dir, f);
  });
  return cv;
}

function bigSprite(pal: number, dir: number, scale: number): string {
  const small = document.createElement('canvas');
  small.width = CW; small.height = CH;
  drawChar(small.getContext('2d')!, 0, 0, PALETTES[pal % PALETTES.length], dir, 0);
  const cv = document.createElement('canvas');
  cv.width = CW * scale; cv.height = CH * scale;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.drawImage(small, 0, 0, CW * scale, CH * scale);
  return cv.toDataURL();
}

/** Sprite grande frontale per le schermate di sfida. */
export function portrait(pal: number): string { return bigSprite(pal, 0, 4); }
/** Il giocatore visto di spalle, come nelle sfide classiche. */
export function portraitBack(pal: number): string { return bigSprite(pal, 1, 5); }

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
