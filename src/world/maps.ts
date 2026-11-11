import { TILE, lookPal } from '../art/art';
import { poolFor, type LookPool } from '../art/looks';
import { TOWNS, TRAINER_NAMES, TRAINER_LINES } from '../data/story';
import { mulberry32 } from '../systems/rng';
import { HOUSEHOLDS, type Household } from '../data/residents';

export type NpcKind =
  | 'talk' | 'trainer' | 'mentor' | 'student' | 'guard' | 'nurse' | 'prof' | 'aide' | 'case' | 'rival'
  | 'librarian' | 'daily' | 'pc' | 'station' | 'simop' | 'croupier' | 'archivist' | 'league' | 'towerop' | 'speculator' | 'legend' | 'mom' | 'sage' | 'resident';

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  pal: number;
  dir: 0 | 1 | 2 | 3;
  name: string;
  kind: NpcKind;
  lines?: string[];
  data?: Record<string, unknown>;
  sight?: number;
  /** Allievo che sbarra la strada al Mentore: se il giocatore sale oltre questa riga senza averlo battuto, si gira e lo sfida. */
  guardY?: number;
  hiddenSprite?: boolean;
}

export interface Warp { x: number; y: number; to: string; tx: number; ty: number; dir?: 0 | 1 | 2 | 3; lock?: 'archive' | 'tower' | 'badge' }
export interface Sign { x: number; y: number; text: string[] }
/** Insegna sul muro frontale di un edificio pubblico: centrata sulla porta (x), appesa al bordo tra tetto e muro (y = riga del muro). */
export interface Plaque { x: number; y: number; text: string; kind: 'clinic' | 'gym' | 'public' }

export interface MapDef {
  id: string;
  name: string;
  w: number;
  h: number;
  tiles: number[][];
  npcs: NpcDef[];
  warps: Warp[];
  signs: Sign[];
  /** Insegne degli edifici speciali (le case normali non ne hanno). */
  plaques?: Plaque[];
  interior: boolean;
  town?: number;
  route?: number;
  encounterRate: number;
  bg: string;
}

function grid(w: number, h: number, fill: number): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

function rect(t: number[][], x: number, y: number, w: number, h: number, v: number) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (t[j] && t[j][i] !== undefined) t[j][i] = v;
}

function building(t: number[][], x: number, y: number, w: number, roofTile: number): { dx: number; dy: number } {
  rect(t, x, y, w, 2, roofTile);
  rect(t, x, y + 2, w, 2, TILE.WALL);
  for (let i = x + 1; i < x + w - 1; i += 2) t[y + 2][i] = TILE.WINDOW;
  const dx = x + Math.floor(w / 2);
  t[y + 3][dx] = TILE.DOOR;
  return { dx, dy: y + 3 };
}

/** Insegna per un edificio costruito con building(): b.dy è la riga della porta, il muro inizia una riga sopra. */
function plaque(b: { dx: number; dy: number }, text: string, kind: Plaque['kind'] = 'public'): Plaque {
  return { x: b.dx, y: b.dy - 1, text, kind };
}

/**
 * Edifici con insegna: la fila alta del muro resta libera per l'insegna, quindi le finestre
 * scendono nella fila bassa (quella della porta), alle stesse colonne, saltando la porta.
 */
function clearUnderPlaques(m: MapDef) {
  const isWall = (v: number | undefined) => v === TILE.WALL || v === TILE.WINDOW;
  for (const p of m.plaques ?? []) {
    const up = m.tiles[p.y], low = m.tiles[p.y + 1];
    if (!up || !low) continue;
    let x0 = p.x, x1 = p.x;
    while (isWall(up[x0 - 1])) x0--;
    while (isWall(up[x1 + 1])) x1++;
    for (let x = x0; x <= x1; x++) {
      if (up[x] !== TILE.WINDOW) continue;
      up[x] = TILE.WALL;
      if (low[x] === TILE.WALL) low[x] = TILE.WINDOW;
    }
  }
}

function interior(id: string, name: string, w: number, h: number, back: string, bx: number, by: number): MapDef {
  const t = grid(w, h, TILE.FLOOR);
  rect(t, 0, 0, w, 2, TILE.IWALL);
  const ex = Math.floor(w / 2);
  t[h - 1][ex] = TILE.MAT;
  return { id, name, w, h, tiles: t, npcs: [], warps: [{ x: ex, y: h - 1, to: back, tx: bx, ty: by + 1, dir: 0 }], signs: [], interior: true, encounterRate: 0, bg: '#1b1b24' };
}

const MAPS: Record<string, MapDef> = {};

/** Interno di una casa abitata: arredo e posti in base al tipo di nucleo (single, coppia, famiglia). */
function houseInterior(h: Household, back: string, bx: number, by: number): MapDef {
  const size = { single: [9, 7], couple: [9, 8], family: [11, 8] }[h.kind];
  const m = interior(h.id, h.name, size[0], size[1], back, bx, by);
  const t = m.tiles;
  const spots: [number, number, 0 | 1 | 2 | 3][] = [];
  if (h.kind === 'single') {
    t[2][1] = TILE.BED; t[2][3] = TILE.SHELF; t[2][7] = TILE.PLANT; t[4][5] = TILE.TABLE;
    spots.push([2, 4, 3]);
  } else if (h.kind === 'couple') {
    t[2][1] = TILE.BED; t[2][2] = TILE.BED; t[2][4] = TILE.SHELF; t[2][5] = TILE.SHELF; t[2][7] = TILE.PLANT;
    t[4][4] = TILE.TABLE; t[4][5] = TILE.TABLE; rect(t, 3, 5, 4, 1, TILE.RUG);
    spots.push([2, 5, 3], [7, 4, 2]);
  } else {
    t[2][1] = TILE.BED; t[2][2] = TILE.BED; t[2][9] = TILE.BED; t[2][4] = TILE.SHELF; t[2][5] = TILE.SHELF; t[2][7] = TILE.PC;
    t[4][5] = TILE.TABLE; t[4][6] = TILE.TABLE; t[6][9] = TILE.PLANT; rect(t, 4, 5, 4, 1, TILE.RUG);
    spots.push([3, 4, 3], [8, 4, 2], [7, 6, 1]);
  }
  h.people.forEach((r, i) => {
    const [x, y, dir] = spots[i];
    m.npcs.push({ id: `res_${r.id}`, x, y, pal: r.pal, dir, name: r.name, kind: 'resident', data: { rid: r.id } });
  });
  return m;
}

/** Costruisce una casa nella mappa esterna e il suo interno. Restituisce il passaggio da aggiungere. */
function addHouse(t: number[][], h: Household | undefined, x: number, y: number, w: number, back: string): Warp | null {
  if (!h) return null;
  const b = building(t, x, y, w, TILE.ROOF);
  if (t[b.dy + 1]) t[b.dy + 1][b.dx] = TILE.PATH;
  const inside = houseInterior(h, back, b.dx, b.dy);
  MAPS[h.id] = inside;
  return { x: b.dx, y: b.dy, to: h.id, tx: Math.floor(inside.w / 2), ty: inside.h - 2, dir: 1 };
}

export function getMap(id: string): MapDef {
  if (!MAPS[id]) buildAll();
  return MAPS[id];
}

let built = false;
function buildAll() {
  if (built) return;
  built = true;
  buildHomeTown();
  for (let i = 1; i <= 8; i++) buildTown(i);
  buildLeagueTown();
  for (let r = 1; r <= 9; r++) buildRoute(r);
  for (const m of Object.values(MAPS)) diversify(m);
}

/** Personaggi con un aspetto voluto, che non cambiano mai. */
const FIXED_LOOK = new Set(['t0_old', 'league_hall']);

/** Gruppo di aspetti e seme per i personaggi generici; undefined per chi tiene la sua palette. */
function lookSeed(n: NpcDef): [LookPool, string] | undefined {
  if (n.hiddenSprite || FIXED_LOOK.has(n.id)) return undefined;
  switch (n.kind) {
    case 'trainer': return [poolFor(n.name), n.name]; // stesso allenatore, stesso aspetto su ogni percorso
    case 'talk': case 'student': case 'aide': case 'daily': case 'librarian': return [poolFor(n.name), n.id];
    case 'guard': return ['guard', n.id];
    case 'speculator': return n.data?.boss ? undefined : ['spec', n.id];
    default: return undefined;
  }
}

/** Dà a ogni personaggio generico un aspetto deterministico e, nella stessa mappa, diverso dagli altri. */
function diversify(m: MapDef) {
  const taken = new Set(m.npcs.filter((n) => n.kind === 'resident').map((n) => n.pal));
  for (const n of m.npcs) {
    const seed = lookSeed(n);
    if (!seed) continue;
    let pal = lookPal(seed[1], seed[0]);
    for (let b = 1; taken.has(pal) && b < 16; b++) pal = lookPal(seed[1], seed[0], b);
    taken.add(pal);
    n.pal = pal;
  }
}

// ---------------- Borgo Semina ----------------

function buildHomeTown() {
  const w = 24, h = 18;
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 2, TILE.TREE); rect(t, 0, h - 2, w, 2, TILE.TREE); rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 1, 9, w - 1, 1, TILE.PATH);
  t[9][w - 1] = TILE.PATH;
  const home = building(t, 3, 3, 5, TILE.ROOF);
  const lab = building(t, 13, 2, 7, TILE.ROOF_SPECIAL);
  const clinic = building(t, 4, 11, 5, TILE.ROOF_CLINIC);
  rect(t, home.dx, home.dy + 1, 1, 9 - home.dy - 1, TILE.PATH);
  rect(t, lab.dx, lab.dy + 1, 1, 9 - lab.dy - 1, TILE.PATH);
  t[clinic.dy + 1][clinic.dx] = TILE.PATH;
  rect(t, 15, 12, 5, 3, TILE.WATER);
  [[2, 7], [10, 6], [20, 14], [2, 15], [21, 4]].forEach(([x, y]) => (t[y][x] = TILE.FLOWERS));
  const t0House = addHouse(t, HOUSEHOLDS[0][0], 9, 11, 4, 't0');
  t[8][11] = TILE.SIGN;
  const m: MapDef = { id: 't0', name: 'Borgo Semina', w, h, tiles: t, interior: false, town: 0, encounterRate: 0, bg: '#6cc04a',
    npcs: [
      { id: 't0_aide', x: w - 2, y: 9, pal: 22, dir: 2, name: 'Assistente', kind: 'aide' },
      { id: 't0_kid', x: 13, y: 10, pal: 21, dir: 0, name: 'Bambina', kind: 'talk', lines: ['Il mio papà dice che i soldi sotto il materasso perdono valore. Si chiama inflazione!'] },
      { id: 't0_old', x: 17, y: 10, pal: 19, dir: 1, name: 'Nonno Elio', kind: 'talk', lines: ['Ai miei tempi si diceva: "Non mettere tutte le uova nello stesso paniere".', 'Vale ancora oggi, sai?'] },
    ],
    warps: [
      { x: home.dx, y: home.dy, to: 'home', tx: 4, ty: 6, dir: 1 },
      { x: lab.dx, y: lab.dy, to: 'lab', tx: 6, ty: 8, dir: 1 },
      { x: clinic.dx, y: clinic.dy, to: 'clinic_0', tx: 5, ty: 7, dir: 1 },
      { x: w - 1, y: 9, to: 'r1', tx: 1, ty: 6, dir: 3 },
      ...(t0House ? [t0House] : []),
    ],
    signs: [{ x: 11, y: 8, text: ['BORGO SEMINA', 'Dove ogni investitore pianta il primo seme.'] }],
    plaques: [plaque(lab, 'LABORATORIO'), plaque(clinic, 'CLINICA', 'clinic')],
  };
  clearUnderPlaques(m);
  MAPS.t0 = m;

  const hm = interior('home', 'Casa', 10, 8, 't0', home.dx, home.dy);
  hm.tiles[2][1] = TILE.BED; hm.tiles[3][1] = TILE.BED; hm.tiles[2][8] = TILE.PLANT; hm.tiles[2][5] = TILE.TABLE; hm.tiles[2][3] = TILE.SHELF;
  hm.npcs.push({ id: 'mom', x: 6, y: 4, pal: 19, dir: 2, name: 'Zia Mara', kind: 'mom' });
  MAPS.home = hm;

  const lb = interior('lab', 'Laboratorio del Prof. Saldi', 13, 10, 't0', lab.dx, lab.dy);
  rect(lb.tiles, 1, 2, 2, 1, TILE.SHELF); rect(lb.tiles, 10, 2, 2, 1, TILE.SHELF); lb.tiles[2][6] = TILE.PC;
  rect(lb.tiles, 4, 4, 5, 1, TILE.CASE_TABLE);
  lb.npcs.push(
    { id: 'prof', x: 6, y: 3, pal: 3, dir: 0, name: 'Prof. Saldi', kind: 'prof' },
    { id: 'case_stocks', x: 4, y: 4, pal: 0, dir: 0, name: 'Valigetta Blu', kind: 'case', data: { cls: 'stocks' }, hiddenSprite: true },
    { id: 'case_etf', x: 6, y: 4, pal: 0, dir: 0, name: 'Valigetta Verde', kind: 'case', data: { cls: 'etf' }, hiddenSprite: true },
    { id: 'case_crypto', x: 8, y: 4, pal: 0, dir: 0, name: 'Valigetta Arancione', kind: 'case', data: { cls: 'crypto' }, hiddenSprite: true },
    { id: 'lab_rival', x: 10, y: 6, pal: 5, dir: 2, name: 'Rivale', kind: 'rival', data: { n: 1 } },
    { id: 'lab_aide', x: 2, y: 6, pal: 23, dir: 3, name: 'Ricercatrice', kind: 'talk', lines: ['Il Professore ha gestito fondi per trent\'anni.', 'Dice che il suo errore più grande è stato credersi infallibile.'] },
  );
  MAPS.lab = lb;
  addClinic(0, clinic.dx, clinic.dy, 't0');
}

// ---------------- Città 1..8 ----------------

function addClinic(n: number, dx: number, dy: number, back: string) {
  const c = interior(`clinic_${n}`, 'Clinica del Portafoglio', 11, 9, back, dx, dy);
  rect(c.tiles, 3, 3, 5, 1, TILE.COUNTER);
  c.tiles[2][9] = TILE.PC; c.tiles[2][1] = TILE.PLANT; c.tiles[7][1] = TILE.PLANT; c.tiles[7][9] = TILE.PLANT;
  c.npcs.push(
    { id: `nurse_${n}`, x: 5, y: 2, pal: 4, dir: 0, name: 'Dott.ssa Ratio', kind: 'nurse' },
    { id: `pc_${n}`, x: 9, y: 2, pal: 0, dir: 0, name: 'Terminale', kind: 'pc', hiddenSprite: true },
  );
  c.warps[0].tx = dx; c.warps[0].ty = dy + 1;
  MAPS[c.id] = c;
}

function buildTown(n: number) {
  const def = TOWNS[n];
  const w = 30, h = 20;
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 2, TILE.TREE); rect(t, 0, h - 2, w, 2, TILE.TREE); rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 1, 9, w - 2, 2, TILE.PATH);
  t[9][0] = TILE.PATH; t[9][w - 1] = TILE.PATH;
  const rng = mulberry32(1000 + n);
  const clinic = building(t, 3, 4, 5, TILE.ROOF_CLINIC);
  const lib = building(t, 10, 4, 5, TILE.ROOF);
  const acad = building(t, 18, 3, 7, TILE.ROOF_ACADEMY);
  [clinic, lib, acad].forEach((b) => rect(t, b.dx, b.dy + 1, 1, 9 - b.dy - 1, TILE.PATH));
  const special = def.special && def.special !== 'lab' ? building(t, 2, 12, 5, TILE.ROOF_SPECIAL) : null;
  if (special && t[special.dy + 1]) t[special.dy + 1][special.dx] = TILE.PATH;
  const id0 = `t${n}`;
  // case abitate: slot nell'ordine dei nuclei familiari della città
  const slots: [number, number, number][] = [[13, 12, 5], [8, 12, 4], [19, 12, 4], ...(special ? [] : [[2, 12, 5] as [number, number, number]])];
  const houseWarps = slots.map(([x, y, hw], i) => addHouse(t, HOUSEHOLDS[n]?.[i], x, y, hw, id0)).filter((x): x is Warp => !!x);
  rect(t, 24, 13, 4, 3, TILE.PLAZA);
  t[14][25] = TILE.WATER; t[14][26] = TILE.WATER;
  for (let i = 0; i < 8; i++) {
    const x = 1 + Math.floor(rng() * (w - 2));
    const y = 2 + Math.floor(rng() * (h - 4));
    if (t[y][x] === TILE.GRASS) t[y][x] = TILE.FLOWERS;
  }
  t[8][2] = TILE.SIGN;
  t[8][26] = TILE.STATION;
  const id = `t${n}`;
  const m: MapDef = { id, name: def.name, w, h, tiles: t, interior: false, town: n, encounterRate: 0, bg: '#6cc04a',
    npcs: [
      { id: `${id}_guard`, x: w - 2, y: 9, pal: 20, dir: 2, name: 'Guardia della Borsa', kind: 'guard', data: { badge: n } },
      { id: `${id}_guard2`, x: w - 2, y: 10, pal: 20, dir: 2, name: 'Guardia della Borsa', kind: 'guard', data: { badge: n } },
      { id: `${id}_station`, x: 26, y: 9, pal: 16, dir: 0, name: 'Capostazione', kind: 'station', hiddenSprite: true },
      { id: `${id}_npc1`, x: 8 + Math.floor(rng() * 4), y: 11, pal: 16 + (n % 4), dir: 0, name: 'Abitante', kind: 'talk', lines: [TOWN_TALK[(n * 2) % TOWN_TALK.length]] },
      { id: `${id}_npc2`, x: 18, y: 16, pal: 17 + (n % 3), dir: 3, name: 'Abitante', kind: 'talk', lines: [TOWN_TALK[(n * 2 + 1) % TOWN_TALK.length]] },
    ],
    warps: [
      { x: 0, y: 9, to: `r${n}`, tx: 42, ty: 6, dir: 2 },
      { x: w - 1, y: 9, to: `r${n + 1}`, tx: 1, ty: 6, dir: 3 },
      { x: clinic.dx, y: clinic.dy, to: `clinic_${n}`, tx: 5, ty: 7, dir: 1 },
      { x: lib.dx, y: lib.dy, to: `library_${n}`, tx: 5, ty: 7, dir: 1 },
      { x: acad.dx, y: acad.dy, to: `academy_${n}`, tx: 6, ty: 11, dir: 1 },
      ...houseWarps,
    ],
    signs: [{ x: 2, y: 8, text: [def.name.toUpperCase(), `Accademia di ${def.name}: Mentore n. ${n}.`] }],
    plaques: [plaque(clinic, 'CLINICA', 'clinic'), plaque(lib, 'BIBLIOTECA'), plaque(acad, 'PALESTRA', 'gym')],
  };
  if (n === 3) m.npcs.push({ id: 't3_rival', x: 15, y: 10, pal: 5, dir: 2, name: 'Rivale', kind: 'rival', data: { n: 3 } });
  addClinic(n, clinic.dx, clinic.dy, id);

  const lb = interior(`library_${n}`, `Biblioteca di ${def.name}`, 11, 9, id, lib.dx, lib.dy);
  rect(lb.tiles, 1, 2, 4, 1, TILE.SHELF); rect(lb.tiles, 6, 2, 4, 1, TILE.SHELF); rect(lb.tiles, 1, 4, 3, 1, TILE.SHELF); rect(lb.tiles, 7, 4, 3, 1, TILE.SHELF);
  lb.npcs.push(
    { id: `lib_${n}`, x: 5, y: 3, pal: 23, dir: 0, name: 'Bibliotecaria', kind: 'librarian', data: { town: n } },
    { id: `daily_${n}`, x: 2, y: 6, pal: 18, dir: 3, name: 'Professoressa del giorno', kind: 'daily' },
  );
  MAPS[lb.id] = lb;

  const ac = interior(`academy_${n}`, `Accademia di ${def.name}`, 13, 13, id, acad.dx, acad.dy);
  rect(ac.tiles, 1, 2, 1, 10, TILE.SHELF); rect(ac.tiles, 11, 2, 1, 10, TILE.SHELF);
  rect(ac.tiles, 4, 7, 2, 1, TILE.TABLE); rect(ac.tiles, 7, 7, 2, 1, TILE.TABLE);
  rect(ac.tiles, 5, 2, 3, 1, TILE.RUG);
  ac.npcs.push(
    { id: `mentor_${n}`, x: 6, y: 3, pal: 0, dir: 0, name: 'Mentore', kind: 'mentor', data: { n } },
    { id: `student_${n}_a`, x: 4, y: 9, pal: 21, dir: 3, name: 'Allievo', kind: 'student', data: { n }, sight: 3, guardY: 9 },
    { id: `student_${n}_b`, x: 8, y: 5, pal: 22, dir: 2, name: 'Allieva', kind: 'student', data: { n }, sight: 3, guardY: 5 },
  );
  MAPS[ac.id] = ac;


  if (special && def.special) {
    if (def.special === 'simzone') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'simzone', tx: 5, ty: 7, dir: 1 });
      m.plaques!.push(plaque(special, 'SIMULAZIONE'));
      const sz = interior('simzone', 'Zona Simulazione', 11, 9, id, special.dx, special.dy);
      rect(sz.tiles, 2, 2, 7, 1, TILE.PC);
      sz.npcs.push({ id: 'simop', x: 5, y: 4, pal: 11, dir: 0, name: 'Operatrice', kind: 'simop' });
      MAPS.simzone = sz;
    } else if (def.special === 'casino') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'casino', tx: 5, ty: 7, dir: 1 });
      m.plaques!.push(plaque(special, 'CASINÒ'));
      const cs = interior('casino', 'Casinò dello Speculatore', 11, 9, id, special.dx, special.dy);
      for (let y = 2; y < 8; y++) for (let x = 0; x < 11; x++) if (cs.tiles[y][x] === TILE.FLOOR) cs.tiles[y][x] = TILE.RUG;
      cs.tiles[8][5] = TILE.MAT;
      cs.tiles[3][4] = TILE.ROULETTE; cs.tiles[3][6] = TILE.ROULETTE;
      cs.npcs.push({ id: 'croupier', x: 5, y: 3, pal: 15, dir: 0, name: 'Croupier Speculatore', kind: 'croupier' });
      MAPS.casino = cs;
    } else if (def.special === 'archive') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'archive', tx: 5, ty: 7, dir: 1, lock: 'archive' });
      m.plaques!.push(plaque(special, 'ARCHIVIO'));
      const ar = interior('archive', 'Archivio di Bilancia', 11, 9, id, special.dx, special.dy);
      rect(ar.tiles, 1, 2, 9, 1, TILE.SHELF); rect(ar.tiles, 1, 4, 3, 1, TILE.SHELF); rect(ar.tiles, 7, 4, 3, 1, TILE.SHELF);
      ar.npcs.push({ id: 'archivist', x: 5, y: 3, pal: 8, dir: 0, name: 'Archivista', kind: 'archivist' });
      MAPS.archive = ar;
    }
  }
  clearUnderPlaques(m);
  MAPS[id] = m;
}

const TOWN_TALK = [
  'Ho comprato un titolo solo perché ne parlavano tutti. Ora ne parlano ancora, ma per un altro motivo...',
  'La Dott.ssa Ratio dice che il mio portafoglio "ha la febbre". Troppa tecnologia, a quanto pare.',
  'Lo sapevi? Dopo un −50% serve un +100% per tornare in pari!',
  'Mio nonno ha fatto un piano di accumulo per 30 anni. Dice che il segreto è stato non guardare troppo spesso.',
  'Le Guardie della Borsa ti lasciano passare solo con la Medaglia della città.',
  'In Biblioteca puoi ripassare le domande sbagliate. Io ci vado ogni giorno!',
  'Le cripto non dormono mai: sono aperte anche la domenica!',
  'Un signore elegante mi ha offerto il 20% al mese. Gli ho detto di no. Ho fatto bene, vero?',
  'Il treno collega le città che hai già visitato, dopo la seconda Medaglia.',
  'Ho letto che i costi si compongono come i rendimenti. Che brutta sorpresa!',
  'La Zona Simulazione di Diversia è perfetta per sperimentare senza rischi.',
  'Chi promette rendimenti garantiti di solito garantisce solo una cosa: i suoi guadagni.',
  'Le Zone di Mercato, quelle con l\'erba alta e il grafico, sono piene di sorprese.',
  'Il mio portafoglio è diversificato: azioni, obbligazioni e un po\' di liquidità. Dormo tranquillo.',
  'Dicono che nel Casinò di Interessa il banco vinca sempre. Matematicamente, è vero.',
  'Per sfidare la Lega servono tutte e otto le Medaglie.',
  'Un buon investitore scrive il suo piano a mente fredda.',
  'L\'Archivio di Bilancia si apre solo a chi sa leggere oltre la superficie.',
];

// ---------------- Altopiano della Lega ----------------

function buildLeagueTown() {
  const w = 26, h = 18;
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 2, TILE.TREE); rect(t, 0, h - 2, w, 2, TILE.TREE); rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 1, 11, w - 2, 1, TILE.PATH); t[11][0] = TILE.PATH;
  rect(t, 8, 2, 10, 8, TILE.PLAZA);
  const league = building(t, 9, 3, 8, TILE.ROOF_SPECIAL);
  const clinic = building(t, 2, 6, 5, TILE.ROOF_CLINIC);
  const tower = building(t, 19, 5, 5, TILE.ROOF);
  rect(t, league.dx, league.dy + 1, 1, 11 - league.dy - 1, TILE.PATH);
  rect(t, clinic.dx, clinic.dy + 1, 1, 11 - clinic.dy - 1, TILE.PATH);
  rect(t, tower.dx, tower.dy + 1, 1, 11 - tower.dy - 1, TILE.PATH);
  const m: MapDef = { id: 't9', name: 'Altopiano della Lega', w, h, tiles: t, interior: false, town: 9, encounterRate: 0, bg: '#6cc04a',
    npcs: [{ id: 't9_guard', x: league.dx, y: league.dy + 1, pal: 20, dir: 0, name: 'Guardia della Lega', kind: 'guard', data: { badge: 8, league: true } }],
    warps: [
      { x: 0, y: 11, to: 'r9', tx: 42, ty: 6, dir: 2 },
      { x: league.dx, y: league.dy, to: 'league', tx: 7, ty: 18, dir: 1 },
      { x: clinic.dx, y: clinic.dy, to: 'clinic_9', tx: 5, ty: 7, dir: 1 },
      { x: tower.dx, y: tower.dy, to: 'tower', tx: 5, ty: 7, dir: 1, lock: 'tower' },
    ],
    signs: [],
    plaques: [plaque(league, 'LEGA'), plaque(clinic, 'CLINICA', 'clinic'), plaque(tower, 'TORRE')] };
  clearUnderPlaques(m);
  MAPS.t9 = m;
  addClinic(9, clinic.dx, clinic.dy, 't9');
  const lg = interior('league', 'Lega degli Investitori', 15, 20, 't9', league.dx, league.dy);
  for (let y = 2; y < 19; y++) { rect(lg.tiles, 0, y, 6, 1, TILE.IWALL); rect(lg.tiles, 9, y, 6, 1, TILE.IWALL); }
  for (let y = 2; y < 19; y++) for (let x = 6; x < 9; x++) lg.tiles[y][x] = TILE.RUG;
  lg.tiles[19][7] = TILE.MAT;
  lg.warps[0].x = 7;
  [16, 13, 10, 7, 4].forEach((y, i) => lg.npcs.push({ id: `league_${i}`, x: 7, y, pal: 10 + i, dir: 0, name: 'Superiore', kind: 'league', data: { i } }));
  lg.npcs.push({ id: 'league_hall', x: 7, y: 2, pal: 3, dir: 0, name: 'Prof. Saldi', kind: 'talk', lines: ['Ce l\'hai fatta! Benvenuto nella Sala dei Campioni.', 'Ricorda: il titolo non ti rende infallibile. Continua a imparare.'] });
  MAPS.league = lg;
  const tw = interior('tower', 'Torre delle Sfide', 11, 9, 't9', tower.dx, tower.dy);
  rect(tw.tiles, 1, 2, 9, 1, TILE.SHELF);
  tw.npcs.push({ id: 'towerop', x: 5, y: 3, pal: 13, dir: 0, name: 'Custode della Torre', kind: 'towerop' });
  MAPS.tower = tw;
}

// ---------------- Percorsi ----------------

function buildRoute(r: number) {
  const w = 44, h = 14;
  const rng = mulberry32(500 + r * 31);
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 1, TILE.TREE); rect(t, 0, h - 1, w, 1, TILE.TREE);
  rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 0, 6, w, 2, TILE.PATH);
  t[7][0] = TILE.TREE; t[7][w - 1] = TILE.TREE;
  // zone di mercato
  const zones = [[5, 2, 6, 3], [15, 9, 7, 3], [27, 2, 6, 3], [34, 9, 6, 3]];
  zones.forEach(([x, y, zw, zh], i) => { if (i < 2 + (r % 3)) rect(t, x, y, zw, zh, TILE.MARKET); });
  // ponte su un ruscello
  if (r % 2 === 0) { rect(t, 22, 1, 2, 12, TILE.WATER); rect(t, 22, 6, 2, 2, TILE.PATH); }
  for (let i = 0; i < 26; i++) {
    const x = 1 + Math.floor(rng() * (w - 2));
    const y = 1 + Math.floor(rng() * (h - 2));
    if (t[y][x] === TILE.GRASS && (y < 5 || y > 8)) t[y][x] = rng() < 0.6 ? TILE.TREE : TILE.FLOWERS;
  }
  t[5][3] = TILE.SIGN;
  const prev = r === 1 ? 't0' : `t${r - 1}`;
  const next = r === 9 ? 't9' : `t${r}`;
  const npcs: NpcDef[] = [];
  const spots: [number, number, 0 | 1][] = [[12, 4, 0], [20, 9, 1], [31, 4, 0], [38, 9, 1]];
  const nT = Math.min(4, 2 + Math.floor(r / 3));
  for (let i = 0; i < nT; i++) {
    const [x, y, d] = spots[i];
    rect(t, x, y, 1, 1, TILE.GRASS);
    const nameIdx = ((r - 1) * 3 + i) % TRAINER_NAMES.length;
    const spec = (r === 3 && i === 1) || (r === 6 && i === 2) || (r === 8 && i === 0) || (r === 1 && i === 1);
    npcs.push({ id: `r${r}_t${i}`, x, y, pal: spec ? 15 : 16 + ((r + i) % 8), dir: d, name: spec ? 'Speculatore' : TRAINER_NAMES[nameIdx], kind: spec ? 'speculator' : 'trainer', sight: 4, lines: [TRAINER_LINES[(r + i) % TRAINER_LINES.length]], data: { r } });
  }
  if (r === 2) npcs.push({ id: 'r2_rival', x: 26, y: 6, pal: 5, dir: 2, name: 'Rivale', kind: 'rival', data: { n: 2 } });
  if (r === 9) npcs.push({ id: 'r9_rival', x: 30, y: 7, pal: 5, dir: 2, name: 'Rivale', kind: 'rival', data: { n: 4 } });
  if (r === 8) npcs.push({ id: 'r8_boss', x: 34, y: 6, pal: 15, dir: 2, name: 'Capo degli antagonisti', kind: 'speculator', data: { r, boss: true }, sight: 0 });
  const signs: Sign[] = [{ x: 3, y: 5, text: [`PERCORSO ${r}`, `← ${r === 1 ? 'Borgo Semina' : TOWNS[r - 1].name}   ·   ${TOWNS[r === 9 ? 9 : r].name} →`, 'Attenzione: Zone di Mercato (erba alta con il grafico).'] }];
  if (r === 7) {
    // Muro del Rumore e nicchia segreta
    rect(t, 36, 1, 7, 4, TILE.GRASS);
    rect(t, 35, 1, 1, 4, TILE.NOISE);
    rect(t, 36, 5, 7, 1, TILE.NOISE);
    t[5][39] = TILE.NOISE;
    npcs.push({ id: 'r7_legend', x: 39, y: 2, pal: 14, dir: 0, name: 'Investitrice Leggendaria', kind: 'legend' });
  }
  MAPS[`r${r}`] = { id: `r${r}`, name: `Percorso ${r}`, w, h, tiles: t, interior: false, route: r, encounterRate: 0.08, bg: '#6cc04a', npcs, signs,
    warps: [
      { x: 0, y: 6, to: prev, tx: (MAPS[prev]?.w ?? 30) - 2, ty: r === 1 ? 9 : prev === 't0' ? 9 : 9, dir: 2 },
      { x: w - 1, y: 6, to: next, tx: 1, ty: next === 't9' ? 11 : 9, dir: 3 },
    ] };
  if (prev === 't0') MAPS[`r${r}`].warps[0].tx = 22;
}

/** Città a cui appartiene una mappa: le mappe interne risalgono all'esterno da cui si entra. I percorsi non hanno città. */
export function townOf(id: string): number | undefined {
  let m: MapDef | undefined = getMap(id);
  for (let i = 0; m && i < 4; i++) {
    if (!m.interior) return m.town;
    m = m.warps[0] ? getMap(m.warps[0].to) : undefined;
  }
  return undefined;
}

export function allMapIds(): string[] {
  buildAll();
  return Object.keys(MAPS);
}
