import { TILE, SOLID, lookPal } from '../art/art';
import { poolFor, type LookPool } from '../art/looks';
import { TOWNS, TRAINER_NAMES, TRAINER_LINES } from '../data/story';
import { mulberry32 } from '../systems/rng';
import { HOUSEHOLDS, type Household } from '../data/residents';
import { ISLET_ROUTES } from './travel';
import { TAPE_SHELF, TAPE_ROOM, HODL_STONE, WHALE } from './secretsData';
import { T } from '../i18n';

export type NpcKind =
  | 'talk' | 'trainer' | 'mentor' | 'student' | 'guard' | 'nurse' | 'prof' | 'aide' | 'case' | 'rival'
  | 'librarian' | 'daily' | 'pc' | 'station' | 'simop' | 'croupier' | 'archivist' | 'league' | 'towerop' | 'speculator' | 'legend' | 'mom' | 'sage' | 'resident' | 'hermit' | 'secret';

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
  /** Allievo che sbarra la strada alla Whale: se il giocatore sale oltre questa riga senza averlo battuto, si gira e lo sfida. */
  guardY?: number;
  hiddenSprite?: boolean;
}

export interface Warp { x: number; y: number; to: string; tx: number; ty: number; dir?: 0 | 1 | 2 | 3; lock?: 'archive' | 'tower' | 'badge' | 'swim' | 'dark' | 'secret' }
export interface Sign { x: number; y: number; text: string[] }
/** Scaffali "parlanti" della Biblioteca: il gruppo di celle (x..x+w-1, y) apre una sezione. */
export interface Section { x: number; y: number; w: number; kind: 'mentor' | 'general' | 'review' | 'index'; label: string }
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
  /** Sezioni della Biblioteca (scaffali che aprono libri, lezioni, ripasso, Investidex). */
  sections?: Section[];
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
  buildSeaAndCaves();
  buildSecrets();
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
  // h = 21: sotto la Clinica e la casa corre una via parallela, lontana dal bosco
  const w = 24, h = 21;
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 2, TILE.TREE); rect(t, 0, h - 2, w, 2, TILE.TREE); rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 1, 9, w - 1, 1, TILE.PATH);
  t[9][w - 1] = TILE.PATH;
  const home = building(t, 3, 3, 5, TILE.ROOF);
  const lab = building(t, 13, 3, 7, TILE.ROOF_SPECIAL);
  // Banca e casa abitata con due caselle di prato fra loro: gli edifici non si toccano mai (MIN_GAP)
  const clinic = building(t, 3, 11, 5, TILE.ROOF_CLINIC);
  rect(t, home.dx, home.dy + 1, 1, 9 - home.dy - 1, TILE.PATH);
  rect(t, lab.dx, lab.dy + 1, 1, 9 - lab.dy - 1, TILE.PATH);
  rect(t, 15, 12, 5, 3, TILE.WATER);
  [[2, 7], [10, 6], [20, 14], [2, 15], [21, 4]].forEach(([x, y]) => (t[y][x] = TILE.FLOWERS));
  const t0House = addHouse(t, HOUSEHOLDS[0][0], 10, 11, 4, 't0');
  // via del borgo davanti alla Banca e alla casa, collegata alla strada principale ai due lati
  rect(t, 2, clinic.dy + 1, 13, 1, TILE.PATH);
  rect(t, 2, 10, 1, clinic.dy + 1 - 10, TILE.PATH);
  rect(t, 14, 10, 1, clinic.dy + 1 - 10, TILE.PATH);
  t[8][11] = TILE.SIGN;
  const m: MapDef = { id: 't0', name: T('Borgo Semina'), w, h, tiles: t, interior: false, town: 0, encounterRate: 0, bg: '#6cc04a',
    npcs: [
      { id: 't0_aide', x: w - 2, y: 9, pal: 22, dir: 2, name: T('Assistente'), kind: 'aide' },
      { id: 't0_kid', x: 12, y: 10, pal: 21, dir: 0, name: T('Bambina'), kind: 'talk', lines: [T('Il mio papà dice che i soldi sotto il materasso perdono valore. Si chiama inflazione!')] },
      { id: 't0_old', x: 17, y: 10, pal: 19, dir: 1, name: T('Nonno Elio'), kind: 'talk', lines: [T('Ai miei tempi si diceva: "Non mettere tutte le uova nello stesso paniere".'), T('Vale ancora oggi, sai?')] },
      { id: 't0_student', x: 21, y: 12, pal: 23, dir: 3, name: T('Studentessa'), kind: 'talk', lines: [T('Torno ora dalla Biblioteca di Ponte Cedola: ogni città dalla prossima ne ha una.'), T('Gli scaffali in alto a sinistra sono la Sezione della Whale: ci sono i libri sull\'argomento del suo duello.'), T('Li ho letti tutti prima della sfida e ho risposto a quasi ogni domanda!')] },
    ],
    warps: [
      { x: home.dx, y: home.dy, to: 'home', tx: 4, ty: 6, dir: 1 },
      { x: lab.dx, y: lab.dy, to: 'lab', tx: 6, ty: 8, dir: 1 },
      { x: clinic.dx, y: clinic.dy, to: 'clinic_0', tx: 5, ty: 7, dir: 1 },
      { x: w - 1, y: 9, to: 'r1', tx: 1, ty: 6, dir: 3 },
      ...(t0House ? [t0House] : []),
    ],
    signs: [{ x: 11, y: 8, text: [T('BORGO SEMINA'), T('Dove ogni investitore pianta il primo seme.')] }],
    plaques: [plaque(lab, T('LABORATORIO')), plaque(clinic, T('BANCA'), 'clinic')],
  };
  clearUnderPlaques(m);
  MAPS.t0 = m;

  const hm = interior('home', T('Casa'), 10, 8, 't0', home.dx, home.dy);
  hm.tiles[2][1] = TILE.BED; hm.tiles[3][1] = TILE.BED; hm.tiles[2][8] = TILE.PLANT; hm.tiles[2][5] = TILE.TABLE; hm.tiles[2][3] = TILE.SHELF;
  hm.npcs.push({ id: 'mom', x: 6, y: 4, pal: 26, dir: 2, name: T('Mamma'), kind: 'mom' });
  MAPS.home = hm;

  const lb = interior('lab', T('Laboratorio del Prof. Saldi'), 13, 10, 't0', lab.dx, lab.dy);
  rect(lb.tiles, 1, 2, 2, 1, TILE.SHELF); rect(lb.tiles, 10, 2, 2, 1, TILE.SHELF); lb.tiles[2][6] = TILE.PC;
  rect(lb.tiles, 4, 4, 5, 1, TILE.CASE_TABLE);
  lb.npcs.push(
    { id: 'prof', x: 6, y: 3, pal: 3, dir: 0, name: T('Prof. Saldi'), kind: 'prof' },
    { id: 'case_stocks', x: 4, y: 4, pal: 0, dir: 0, name: T('Valigetta Blu'), kind: 'case', data: { cls: 'stocks' }, hiddenSprite: true },
    { id: 'case_etf', x: 6, y: 4, pal: 0, dir: 0, name: T('Valigetta Verde'), kind: 'case', data: { cls: 'etf' }, hiddenSprite: true },
    { id: 'case_crypto', x: 8, y: 4, pal: 0, dir: 0, name: T('Valigetta Arancione'), kind: 'case', data: { cls: 'crypto' }, hiddenSprite: true },
    { id: 'lab_rival', x: 10, y: 6, pal: 5, dir: 2, name: T('Rivale'), kind: 'rival', data: { n: 1 } },
    { id: 'lab_aide', x: 2, y: 6, pal: 23, dir: 3, name: T('Ricercatrice'), kind: 'talk', lines: [T('Il Professore ha gestito fondi per trent\'anni.'), T('Dice che il suo errore più grande è stato credersi infallibile.')] },
  );
  MAPS.lab = lb;
  addClinic(0, clinic.dx, clinic.dy, 't0');
}

// ---------------- Città 1..8 ----------------

function addClinic(n: number, dx: number, dy: number, back: string) {
  const c = interior(`clinic_${n}`, T('Banca del Portafoglio'), 11, 9, back, dx, dy);
  rect(c.tiles, 3, 3, 5, 1, TILE.COUNTER);
  c.tiles[2][9] = TILE.PC; c.tiles[2][1] = TILE.PLANT; c.tiles[7][1] = TILE.PLANT; c.tiles[7][9] = TILE.PLANT;
  c.npcs.push(
    { id: `nurse_${n}`, x: 5, y: 2, pal: 4, dir: 0, name: T('Dott.ssa Ratio'), kind: 'nurse' },
    { id: `pc_${n}`, x: 9, y: 2, pal: 0, dir: 0, name: T('Terminale'), kind: 'pc', hiddenSprite: true },
  );
  c.warps[0].tx = dx; c.warps[0].ty = dy + 1;
  MAPS[c.id] = c;
}

/** Altezza delle città 1-8 e riga della via su cui si affacciano le case a sud della strada principale. */
const TOWN_H = 22;
const SOUTH_ST = 16;

function buildTown(n: number) {
  const def = TOWNS[n];
  // h = 22: le case a sud della strada principale hanno la porta su una seconda via (riga SOUTH_ST),
  // con tre file di prato prima del bosco
  const w = 30, h = TOWN_H;
  const t = grid(w, h, TILE.GRASS);
  rect(t, 0, 0, w, 2, TILE.TREE); rect(t, 0, h - 2, w, 2, TILE.TREE); rect(t, 0, 0, 1, h, TILE.TREE); rect(t, w - 1, 0, 1, h, TILE.TREE);
  rect(t, 1, 9, w - 2, 2, TILE.PATH);
  rect(t, 2, SOUTH_ST, w - 4, 1, TILE.PATH);
  // due vicoli collegano la via delle case alla strada principale, negli spazi fra un edificio e l'altro
  for (const lx of [7, 20]) rect(t, lx, 11, 1, SOUTH_ST - 11, TILE.PATH);
  t[9][0] = TILE.PATH; t[9][w - 1] = TILE.PATH;
  const rng = mulberry32(1000 + n);
  const clinic = building(t, 3, 4, 5, TILE.ROOF_CLINIC);
  const lib = building(t, 10, 4, 5, TILE.ROOF);
  const acad = building(t, 18, 3, 7, TILE.ROOF_ACADEMY);
  [clinic, lib, acad].forEach((b) => rect(t, b.dx, b.dy + 1, 1, 9 - b.dy - 1, TILE.PATH));
  const special = def.special && def.special !== 'lab' ? building(t, 2, 12, 5, TILE.ROOF_SPECIAL) : null;
  if (special && t[special.dy + 1]) t[special.dy + 1][special.dx] = TILE.PATH;
  const id0 = `t${n}`;
  // case abitate: slot nell'ordine dei nuclei familiari della città, con due caselle libere fra un edificio e l'altro
  const slots: [number, number, number][] = [[15, 12, 5], [9, 12, 4], [22, 12, 4], ...(special ? [] : [[2, 12, 5] as [number, number, number]])];
  const houseWarps = slots.map(([x, y, hw], i) => addHouse(t, HOUSEHOLDS[n]?.[i], x, y, hw, id0)).filter((x): x is Warp => !!x);
  // piazzetta con la fontana a sud della via delle case (prima stava fra le case, a ridosso dell'ultima)
  rect(t, 14, SOUTH_ST + 1, 4, 3, TILE.PLAZA);
  t[SOUTH_ST + 2][15] = TILE.WATER; t[SOUTH_ST + 2][16] = TILE.WATER;
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
      { id: `${id}_guard`, x: w - 2, y: 9, pal: 20, dir: 2, name: T('Guardia della Borsa'), kind: 'guard', data: { badge: n } },
      { id: `${id}_guard2`, x: w - 2, y: 10, pal: 20, dir: 2, name: T('Guardia della Borsa'), kind: 'guard', data: { badge: n } },
      { id: `${id}_station`, x: 26, y: 9, pal: 16, dir: 0, name: T('Capostazione'), kind: 'station', hiddenSprite: true },
      { id: `${id}_npc1`, x: 8 + Math.floor(rng() * 4), y: 11, pal: 16 + (n % 4), dir: 0, name: T('Abitante'), kind: 'talk', lines: [TOWN_TALK[(n * 2) % TOWN_TALK.length]] },
      { id: `${id}_npc2`, x: 11, y: SOUTH_ST + 1, pal: 17 + (n % 3), dir: 3, name: T('Abitante'), kind: 'talk', lines: [TOWN_TALK[(n * 2 + 1) % TOWN_TALK.length]] },
    ],
    warps: [
      { x: 0, y: 9, to: `r${n}`, tx: 42, ty: 6, dir: 2 },
      { x: w - 1, y: 9, to: `r${n + 1}`, tx: 1, ty: 6, dir: 3 },
      { x: clinic.dx, y: clinic.dy, to: `clinic_${n}`, tx: 5, ty: 7, dir: 1 },
      { x: lib.dx, y: lib.dy, to: `library_${n}`, tx: 5, ty: 7, dir: 1 },
      { x: acad.dx, y: acad.dy, to: `academy_${n}`, tx: 6, ty: 11, dir: 1 },
      ...houseWarps,
    ],
    signs: [{ x: 2, y: 8, text: [def.name.toUpperCase(), T`Exchange di ${def.name}: Whale n. ${n}.`] }],
    plaques: [plaque(clinic, T('BANCA'), 'clinic'), plaque(lib, T('BIBLIOTECA')), plaque(acad, T('EXCHANGE'), 'gym')],
  };
  // Leo aspetta sulla strada principale chi arriva per la prima volta a Ponte Cedola (giro della città, nessuna sfida)
  if (n === 1) m.npcs.push({ id: 't1_leo', x: 7, y: 9, pal: 5, dir: 2, name: T('Rivale'), kind: 'rival', data: { n: 0 } });
  if (n === 3) m.npcs.push({ id: 't3_rival', x: 15, y: 10, pal: 5, dir: 2, name: T('Rivale'), kind: 'rival', data: { n: 3 } });
  addClinic(n, clinic.dx, clinic.dy, id);

  const lb = interior(`library_${n}`, T`Biblioteca di ${def.name}`, 11, 9, id, lib.dx, lib.dy);
  rect(lb.tiles, 1, 2, 4, 1, TILE.SHELF); rect(lb.tiles, 6, 2, 4, 1, TILE.SHELF); rect(lb.tiles, 1, 4, 3, 1, TILE.SHELF); rect(lb.tiles, 7, 4, 3, 1, TILE.SHELF);
  // sezioni: a sinistra i libri della Whale della città (l'argomento del suo duello), a destra le lezioni generali,
  // in basso il ripasso degli errori e l'Investidex
  lb.tiles[1][2] = TILE.POSTER; lb.tiles[1][7] = TILE.FRAME; // manifesto sopra la Sezione della Whale, quadro sopra quella generale
  lb.sections = [
    { x: 1, y: 2, w: 4, kind: 'mentor', label: T`Sezione della Whale n. ${n}` },
    { x: 6, y: 2, w: 4, kind: 'general', label: T('Sezione generale: lezioni') },
    { x: 1, y: 4, w: 3, kind: 'review', label: T('Archivio del ripasso') },
    { x: 7, y: 4, w: 3, kind: 'index', label: 'Investidex' },
  ];
  lb.npcs.push(
    { id: `lib_${n}`, x: 5, y: 3, pal: 23, dir: 0, name: T('Bibliotecaria'), kind: 'librarian', data: { town: n } },
    { id: `daily_${n}`, x: 2, y: 6, pal: 18, dir: 3, name: T('Professoressa del giorno'), kind: 'daily' },
  );
  MAPS[lb.id] = lb;

  const ac = interior(`academy_${n}`, T`Exchange di ${def.name}`, 13, 13, id, acad.dx, acad.dy);
  rect(ac.tiles, 1, 2, 1, 10, TILE.SHELF); rect(ac.tiles, 11, 2, 1, 10, TILE.SHELF);
  rect(ac.tiles, 4, 7, 2, 1, TILE.TABLE); rect(ac.tiles, 7, 7, 2, 1, TILE.TABLE);
  rect(ac.tiles, 5, 2, 3, 1, TILE.RUG);
  ac.npcs.push(
    { id: `mentor_${n}`, x: 6, y: 3, pal: 0, dir: 0, name: T('Whale'), kind: 'mentor', data: { n } },
    { id: `student_${n}_a`, x: 4, y: 9, pal: 21, dir: 3, name: T('Allievo'), kind: 'student', data: { n }, sight: 3, guardY: 9 },
    { id: `student_${n}_b`, x: 8, y: 5, pal: 22, dir: 2, name: T('Allieva'), kind: 'student', data: { n }, sight: 3, guardY: 5 },
  );
  MAPS[ac.id] = ac;


  if (special && def.special) {
    if (def.special === 'simzone') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'simzone', tx: 5, ty: 7, dir: 1 });
      m.plaques!.push(plaque(special, T('SIMULAZIONE')));
      const sz = interior('simzone', T('Zona Simulazione'), 11, 9, id, special.dx, special.dy);
      rect(sz.tiles, 2, 2, 7, 1, TILE.PC);
      sz.npcs.push({ id: 'simop', x: 5, y: 4, pal: 11, dir: 0, name: T('Operatrice'), kind: 'simop' });
      MAPS.simzone = sz;
    } else if (def.special === 'casino') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'casino', tx: 5, ty: 7, dir: 1 });
      m.plaques!.push(plaque(special, T('CASINÒ')));
      const cs = interior('casino', T('Casinò dello Speculatore'), 11, 9, id, special.dx, special.dy);
      for (let y = 2; y < 8; y++) for (let x = 0; x < 11; x++) if (cs.tiles[y][x] === TILE.FLOOR) cs.tiles[y][x] = TILE.RUG;
      cs.tiles[8][5] = TILE.MAT;
      cs.tiles[3][4] = TILE.ROULETTE; cs.tiles[3][6] = TILE.ROULETTE;
      cs.npcs.push({ id: 'croupier', x: 5, y: 3, pal: 15, dir: 0, name: T('Croupier Speculatore'), kind: 'croupier' });
      MAPS.casino = cs;
    } else if (def.special === 'archive') {
      m.warps.push({ x: special.dx, y: special.dy, to: 'archive', tx: 5, ty: 7, dir: 1, lock: 'archive' });
      m.plaques!.push(plaque(special, T('ARCHIVIO')));
      const ar = interior('archive', T('Archivio di Bilancia'), 11, 9, id, special.dx, special.dy);
      rect(ar.tiles, 1, 2, 9, 1, TILE.SHELF); rect(ar.tiles, 1, 4, 3, 1, TILE.SHELF); rect(ar.tiles, 7, 4, 3, 1, TILE.SHELF);
      ar.npcs.push({ id: 'archivist', x: 5, y: 3, pal: 8, dir: 0, name: T('Archivista'), kind: 'archivist' });
      MAPS.archive = ar;
    }
  }
  clearUnderPlaques(m);
  MAPS[id] = m;
}

const TOWN_TALK = [
  T('Ho comprato un titolo solo perché ne parlavano tutti. Ora ne parlano ancora, ma per un altro motivo...'),
  T('La Dott.ssa Ratio dice che il mio portafoglio "ha la febbre". Troppa tecnologia, a quanto pare.'),
  T('Lo sapevi? Dopo un −50% serve un +100% per tornare in pari!'),
  T('Mio nonno ha fatto un piano di accumulo per 30 anni. Dice che il segreto è stato non guardare troppo spesso.'),
  T('Le Guardie della Borsa ti lasciano passare con l\'Attestato della Whale della città: lo vinci nel duello.'),
  T('In Biblioteca il ripasso ti ripropone le domande al momento giusto. Io ci passo ogni giorno!'),
  T('Le cripto non dormono mai: sono aperte anche la domenica!'),
  T('Un signore elegante mi ha offerto il 20% al mese. Gli ho detto di no. Ho fatto bene, vero?'),
  T('Il treno collega le città visitate dal secondo Attestato. Dal quarto ti trasferisci ovunque dalla Mappa della Regione!'),
  T('Ho letto che i costi si compongono come i rendimenti. Che brutta sorpresa!'),
  T('La Zona Simulazione di Diversia è perfetta per sperimentare senza rischi.'),
  T('Chi promette rendimenti garantiti di solito garantisce solo una cosa: i suoi guadagni.'),
  T('Sui percorsi c\'è più di quanto sembri: chi esplora trova pagine perdute e passaggi nascosti.'),
  T('Il mio portafoglio è diversificato: azioni, obbligazioni e un po\' di liquidità. Dormo tranquillo.'),
  T('Dicono che nel Casinò di Interessa il banco vinca sempre. Matematicamente, è vero.'),
  T('Per sfidare Wall Street servono otto Medaglie complete: Attestato e Sigillo pratico, guadagnato sul conto Paper.'),
  T('Un buon investitore scrive il suo piano a mente fredda.'),
  T('L\'Archivio di Bilancia si apre solo a chi sa leggere oltre la superficie.'),
];

// ---------------- Wall Street ----------------

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
  const m: MapDef = { id: 't9', name: T('Wall Street'), w, h, tiles: t, interior: false, town: 9, encounterRate: 0, bg: '#6cc04a',
    npcs: [{ id: 't9_guard', x: league.dx, y: league.dy + 1, pal: 20, dir: 0, name: T('Guardia di Wall Street'), kind: 'guard', data: { badge: 8, league: true } }],
    warps: [
      { x: 0, y: 11, to: 'r9', tx: 42, ty: 6, dir: 2 },
      { x: league.dx, y: league.dy, to: 'league', tx: 7, ty: 18, dir: 1 },
      { x: clinic.dx, y: clinic.dy, to: 'clinic_9', tx: 5, ty: 7, dir: 1 },
      { x: tower.dx, y: tower.dy, to: 'tower', tx: 5, ty: 7, dir: 1, lock: 'tower' },
    ],
    signs: [],
    plaques: [plaque(league, T('WALL STREET')), plaque(clinic, T('BANCA'), 'clinic'), plaque(tower, T('TORRE'))] };
  clearUnderPlaques(m);
  MAPS.t9 = m;
  addClinic(9, clinic.dx, clinic.dy, 't9');
  const lg = interior('league', T('Wall Street'), 15, 20, 't9', league.dx, league.dy);
  for (let y = 2; y < 19; y++) { rect(lg.tiles, 0, y, 6, 1, TILE.IWALL); rect(lg.tiles, 9, y, 6, 1, TILE.IWALL); }
  for (let y = 2; y < 19; y++) for (let x = 6; x < 9; x++) lg.tiles[y][x] = TILE.RUG;
  lg.tiles[19][7] = TILE.MAT;
  lg.warps[0].x = 7;
  [16, 13, 10, 7, 4].forEach((y, i) => lg.npcs.push({ id: `league_${i}`, x: 7, y, pal: 10 + i, dir: 0, name: T('Superiore'), kind: 'league', data: { i } }));
  lg.npcs.push({ id: 'league_hall', x: 7, y: 2, pal: 3, dir: 0, name: T('Prof. Saldi'), kind: 'talk', lines: [T('Ce l\'hai fatta! Benvenut{o|a} nella Sala dei Campioni.'), T('Ricorda: il titolo non ti rende infallibile. Continua a imparare.')] });
  MAPS.league = lg;
  const tw = interior('tower', T('Torre delle Sfide'), 11, 9, 't9', tower.dx, tower.dy);
  rect(tw.tiles, 1, 2, 9, 1, TILE.SHELF);
  tw.npcs.push({ id: 'towerop', x: 5, y: 3, pal: 13, dir: 0, name: T('Custode della Torre'), kind: 'towerop' });
  MAPS.tower = tw;
}

// ---------------- Percorsi ----------------

/** Chi abita le Isole della Liquidità: sfida a quiz una volta sola, per esperienza e studio delle carte. */
export const HERMITS: Record<string | number, { name: string; pal: number }> = {
  3: { name: T('Cassettista dell\'Isola'), pal: 19 },
  5: { name: T('Arbitraggista Solitaria'), pal: 23 },
  7: { name: T('Guardiano delle Riserve'), pal: 13 },
  faro: { name: T('Guardiana del Faro'), pal: 22 },
  perle: { name: T('Pescatore di Perle'), pal: 17 },
};

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
    npcs.push({ id: `r${r}_t${i}`, x, y, pal: spec ? 15 : 16 + ((r + i) % 8), dir: d, name: spec ? T('Speculatore') : TRAINER_NAMES[nameIdx], kind: spec ? 'speculator' : 'trainer', sight: 4, lines: [TRAINER_LINES[(r + i) % TRAINER_LINES.length]], data: { r } });
  }
  if (r === 2) npcs.push({ id: 'r2_rival', x: 26, y: 6, pal: 5, dir: 2, name: T('Rivale'), kind: 'rival', data: { n: 2 } });
  if (r === 9) npcs.push({ id: 'r9_rival', x: 30, y: 7, pal: 5, dir: 2, name: T('Rivale'), kind: 'rival', data: { n: 4 } });
  if (r === 8) npcs.push({ id: 'r8_boss', x: 34, y: 6, pal: 15, dir: 2, name: T('Capo degli antagonisti'), kind: 'speculator', data: { r, boss: true }, sight: 0 });
  const signs: Sign[] = [{ x: 3, y: 5, text: [T`PERCORSO ${r}`, `← ${r === 1 ? T('Borgo Semina') : TOWNS[r - 1].name}   ·   ${TOWNS[r === 9 ? 9 : r].name} →`, T('Attenzione: Zone di Mercato (erba alta con il grafico).')] }];
  if (ISLET_ROUTES.includes(r)) {
    // Isola della Liquidità: un lago a nord del sentiero, raggiungibile solo con il Flusso di Liquidità (Medaglia 3)
    rect(t, 14, 1, 8, 5, TILE.WATER);
    rect(t, 16, 2, 4, 2, TILE.GRASS);
    t[3][16] = TILE.FLOWERS; t[2][19] = TILE.FLOWERS;
    const h = HERMITS[r];
    npcs.push({ id: `islet_r${r}`, x: 18, y: 2, pal: h.pal, dir: 0, name: h.name, kind: 'hermit', data: { key: `r${r}` } });
  }
  if (r === 7) {
    // Muro del Rumore e nicchia segreta
    rect(t, 36, 1, 7, 4, TILE.GRASS);
    rect(t, 35, 1, 1, 4, TILE.NOISE);
    rect(t, 36, 5, 7, 1, TILE.NOISE);
    t[5][39] = TILE.NOISE;
    npcs.push({ id: 'r7_legend', x: 39, y: 2, pal: 14, dir: 0, name: T('Investitrice Leggendaria'), kind: 'legend' });
  }
  MAPS[`r${r}`] = { id: `r${r}`, name: T`Percorso ${r}`, w, h, tiles: t, interior: false, route: r, encounterRate: 0.08, bg: '#6cc04a', npcs, signs,
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

/**
 * Casella sicura per una posizione salvata: se le mappe sono cambiate (edifici spostati, mappa più grande)
 * una posizione vecchia può finire fuori mappa o dentro un muro. Allora si sceglie la casella calpestabile
 * più vicina (non acqua, non un passaggio). Una posizione già libera resta com'è.
 */
export function safeSpot(m: MapDef, x: number, y: number): [number, number] {
  const cx = Math.max(0, Math.min(m.w - 1, Math.round(x) || 0)), cy = Math.max(0, Math.min(m.h - 1, Math.round(y) || 0));
  if (cx === x && cy === y && !SOLID.has(m.tiles[cy][cx]) && m.tiles[cy][cx] !== TILE.DOOR) return [cx, cy];
  const free = (i: number, j: number) => !SOLID.has(m.tiles[j][i]) && m.tiles[j][i] !== TILE.WATER && !m.warps.some((w) => w.x === i && w.y === j);
  const seen = new Set([`${cx},${cy}`]);
  const q: [number, number][] = [[cx, cy]];
  while (q.length) {
    const [i, j] = q.shift()!;
    if (free(i, j)) return [i, j];
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const ni = i + dx, nj = j + dy;
      if (ni < 0 || nj < 0 || ni >= m.w || nj >= m.h || seen.has(`${ni},${nj}`)) continue;
      seen.add(`${ni},${nj}`); q.push([ni, nj]);
    }
  }
  return [cx, cy];
}

export function allMapIds(): string[] {
  buildAll();
  return Object.keys(MAPS);
}

// ---------------- Mare della Liquidità e grotte ----------------

/** Bocca di grotta su una mappa esterna: roccia intorno, ingresso al centro, sentiero davanti. */
function caveMouth(t: number[][], x: number, y: number) {
  rect(t, x - 1, y - 1, 3, 2, TILE.ROCK);
  t[y][x] = TILE.CAVE_MOUTH;
}

/** Grotta: tutta roccia, poi si scavano i corridoi (rettangoli di pavimento). */
function cave(id: string, name: string, w: number, h: number, halls: [number, number, number, number][]): MapDef {
  const t = grid(w, h, TILE.ROCK);
  halls.forEach(([x, y, hw, hh]) => rect(t, x, y, hw, hh, TILE.CAVE));
  return { id, name, w, h, tiles: t, npcs: [], warps: [], signs: [], interior: true, encounterRate: 0, bg: '#2a2018' };
}

function buildSeaAndCaves() {
  // --- Molo di Porto Ordini → Mare della Liquidità (serve il Flusso di Liquidità) ---
  const port = MAPS.t2;
  const ph = port.h;
  rect(port.tiles, 24, ph - 2, 3, 2, TILE.WATER);
  rect(port.tiles, 25, SOUTH_ST + 1, 1, ph - 3 - SOUTH_ST, TILE.PIER);
  port.tiles[SOUTH_ST + 1][24] = TILE.SIGN;
  port.signs.push({ x: 24, y: SOUTH_ST + 1, text: [T('MOLO DI PORTO ORDINI'), T('A sud: Mare della Liquidità. Solo con il Flusso di Liquidità (Attestato 3).')] });
  port.warps.push({ x: 25, y: ph - 1, to: 'sea', tx: 20, ty: 1, dir: 0, lock: 'swim' });

  const w = 40, h = 26;
  const t = grid(w, h, TILE.WATER);
  t[0][20] = TILE.PIER; t[1][20] = TILE.PIER;
  rect(t, 16, 2, 3, 2, TILE.SAND);
  // scogli
  [[8, 2], [9, 2], [31, 2], [26, 13], [27, 13], [5, 15], [36, 18], [12, 21], [33, 23], [17, 12]].forEach(([x, y]) => (t[y][x] = TILE.ROCK));
  // Isola del Faro (ovest)
  rect(t, 3, 5, 8, 6, TILE.SAND); rect(t, 4, 6, 6, 4, TILE.GRASS);
  rect(t, 5, 6, 3, 2, TILE.ROOF_SPECIAL); rect(t, 5, 8, 3, 1, TILE.WALL); t[8][6] = TILE.WINDOW;
  t[9][9] = TILE.FLOWERS;
  // Isola del Relitto (est)
  rect(t, 29, 5, 8, 6, TILE.SAND); rect(t, 31, 6, 3, 2, TILE.GRASS);
  t[8][30] = TILE.SIGN; t[9][34] = TILE.FENCE; t[9][35] = TILE.FENCE; t[8][35] = TILE.FENCE;
  // Isola Lontana (sud) con la Grotta delle Perle
  rect(t, 14, 17, 12, 7, TILE.SAND); rect(t, 15, 18, 10, 5, TILE.GRASS);
  [[15, 18], [24, 18], [15, 22], [24, 22]].forEach(([x, y]) => (t[y][x] = TILE.TREE));
  caveMouth(t, 20, 19);
  rect(t, 20, 20, 1, 3, TILE.PATH);
  t[21][22] = TILE.SIGN;
  MAPS.sea = { id: 'sea', name: T('Mare della Liquidità'), w, h, tiles: t, interior: false, encounterRate: 0, bg: '#3060c0',
    npcs: [
      { id: 'sea_faro', x: 8, y: 9, pal: HERMITS.faro.pal, dir: 0, name: HERMITS.faro.name, kind: 'hermit', data: { key: 'faro' } },
      { id: 'sea_wreck', x: 32, y: 9, pal: 18, dir: 0, name: T('Storica del Relitto'), kind: 'talk', lines: [
        T('Questo relitto ha un nome: la "Compagnia dei Mari Lontani". Prometteva commerci favolosi oltre l\'oceano.'),
        T('Le sue azioni salirono di dieci volte in pochi mesi. Tutti compravano perché tutti compravano.'),
        T('Poi si scoprì che i commerci erano quasi nulli. Il prezzo crollò e molti persero tutto. Succede ancora oggi, con nomi nuovi.'),
      ] },
      { id: 'sea_sailor', x: 17, y: 2, pal: 16, dir: 0, name: T('Marinaia'), kind: 'talk', lines: [T('Più lontano vai dalla riva, più le onde sono alte. Come il rischio, quando cerchi rendimenti lontani dalla media!'), T('L\'isola a sud ha una grotta buia: senza una lanterna non entri.')] },
    ],
    warps: [{ x: 20, y: 0, to: 't2', tx: 25, ty: port.h - 3, dir: 1 }, { x: 20, y: 19, to: 'cave_pearl', tx: 6, ty: 7, dir: 1, lock: 'dark' }],
    signs: [
      { x: 30, y: 8, text: [T('RELITTO DELLA COMPAGNIA DEI MARI LONTANI'), T('Una bolla speculativa finita in fondo al mare.')] },
      { x: 22, y: 21, text: [T('GROTTA DELLE PERLE'), T('Buia come un bilancio non letto. Serve la Lanterna della Due Diligence (Attestato 5).')] },
    ] };

  const pearl = cave('cave_pearl', T('Grotta delle Perle'), 13, 10, [[5, 7, 3, 3], [2, 2, 9, 5], [1, 4, 2, 2]]);
  pearl.tiles[9][6] = TILE.CAVE;
  pearl.warps.push({ x: 6, y: 9, to: 'sea', tx: 20, ty: 20, dir: 0 });
  pearl.npcs.push({ id: 'cave_pearl_h', x: 6, y: 2, pal: HERMITS.perle.pal, dir: 0, name: HERMITS.perle.name, kind: 'hermit', data: { key: 'perle' } });
  MAPS.cave_pearl = pearl;

  // --- Galleria del Dark Pool: Percorso 2 (a metà, lato nord) ↔ Diversia. Massi delle Commissioni ai due capi ---
  const r2 = MAPS.r2;
  caveMouth(r2.tiles, 30, 1);
  rect(r2.tiles, 30, 2, 1, 4, TILE.PATH);
  r2.tiles[3][30] = TILE.BOULDER;
  // roccia ai lati: il masso non si aggira
  rect(r2.tiles, 29, 2, 1, 2, TILE.ROCK); rect(r2.tiles, 31, 2, 1, 2, TILE.ROCK);
  r2.warps.push({ x: 30, y: 1, to: 'cave_dp', tx: 3, ty: 11, dir: 1 });
  r2.signs.push({ x: 29, y: 4, text: [T('GALLERIA DEL DARK POOL'), T('Scorciatoia per Diversia. Bloccata dai Massi delle Commissioni.')] });
  r2.tiles[4][29] = TILE.SIGN;
  const t3 = MAPS.t3;
  const cy = TOWN_H - 3; // bocca della grotta al limite sud, collegata alla via delle case
  caveMouth(t3.tiles, 27, cy);
  rect(t3.tiles, 27, SOUTH_ST + 1, 1, cy - 1 - SOUTH_ST, TILE.PATH);
  t3.warps.push({ x: 27, y: cy, to: 'cave_dp', tx: 22, ty: 11, dir: 1 });
  const dp = cave('cave_dp', T('Galleria del Dark Pool'), 26, 14, [
    [2, 9, 3, 4], [2, 2, 3, 7], [5, 2, 8, 3], [12, 5, 3, 5], [15, 7, 6, 3], [20, 3, 3, 5], [20, 9, 4, 4], [8, 7, 4, 4],
  ]);
  dp.tiles[13][3] = TILE.CAVE; dp.tiles[13][22] = TILE.CAVE;
  dp.warps.push({ x: 3, y: 13, to: 'r2', tx: 30, ty: 2, dir: 0 }, { x: 22, y: 13, to: 't3', tx: 27, ty: cy - 1, dir: 0 });
  dp.npcs.push(
    { id: 'cave_dp_t0', x: 9, y: 3, pal: 20, dir: 0, name: T('Operatore Ombra'), kind: 'trainer', sight: 3, lines: [T('Qui gli ordini non si vedono finché non sono eseguiti. Tu invece ti vedo benissimo!')], data: { r: 3 } },
    { id: 'cave_dp_t1', x: 17, y: 8, pal: 15, dir: 2, name: T('Broker Notturna'), kind: 'trainer', sight: 3, lines: [T('Nel buio si fanno affari grossi. Ma servono regole chiare, sai?')], data: { r: 3 } },
  );
  MAPS.cave_dp = dp;

  // --- Miniera dei Lingotti: Percorso 5 (a metà) ↔ Valdividendo. Buia: serve la Lanterna ---
  const r5 = MAPS.r5;
  caveMouth(r5.tiles, 28, 1);
  rect(r5.tiles, 28, 2, 1, 4, TILE.PATH);
  r5.tiles[4][27] = TILE.SIGN;
  r5.signs.push({ x: 27, y: 4, text: [T('MINIERA DEI LINGOTTI'), T('Porta a Valdividendo. All\'interno è buio pesto.')] });
  r5.warps.push({ x: 28, y: 1, to: 'cave_gold', tx: 2, ty: 12, dir: 1, lock: 'dark' });
  const t6 = MAPS.t6;
  caveMouth(t6.tiles, 27, cy);
  rect(t6.tiles, 27, SOUTH_ST + 1, 1, cy - 1 - SOUTH_ST, TILE.PATH);
  t6.warps.push({ x: 27, y: cy, to: 'cave_gold', tx: 25, ty: 12, dir: 1, lock: 'dark' });
  const gold = cave('cave_gold', T('Miniera dei Lingotti'), 28, 15, [
    [1, 10, 4, 3], [2, 4, 3, 6], [2, 2, 10, 2], [10, 4, 3, 5], [10, 9, 9, 3], [17, 3, 3, 6], [19, 3, 7, 2], [24, 5, 3, 8],
  ]);
  gold.tiles[14][2] = TILE.CAVE; gold.tiles[13][2] = TILE.CAVE; gold.tiles[14][25] = TILE.CAVE; gold.tiles[13][25] = TILE.CAVE;
  gold.warps.push({ x: 2, y: 14, to: 'r5', tx: 28, ty: 2, dir: 0 }, { x: 25, y: 14, to: 't6', tx: 27, ty: cy - 1, dir: 0 });
  gold.npcs.push(
    { id: 'cave_gold_t0', x: 6, y: 2, pal: 21, dir: 3, name: T('Cercatrice d\'Oro'), kind: 'trainer', sight: 4, lines: [T('L\'oro non paga dividendi, ma nelle crisi molti lo cercano. Tu cosa cerchi?')], data: { r: 5 } },
    { id: 'cave_gold_t1', x: 15, y: 10, pal: 19, dir: 2, name: T('Minatore Prudente'), kind: 'trainer', sight: 3, lines: [T('Scavo piano e diversifico le gallerie. Vediamo se scavi bene anche tu!')], data: { r: 5 } },
    { id: 'cave_gold_s', x: 21, y: 3, pal: 18, dir: 0, name: T('Vecchio Minatore'), kind: 'talk', lines: [T('Una volta ho messo tutto in una sola vena d\'oro. Si è esaurita in un mese.'), T('Da allora scavo in tante gallerie diverse. Si chiama diversificare, ragazz{o|a}.')] },
  );
  MAPS.cave_gold = gold;
}

// ---------------- Segreti della seconda parte (dalla Medaglia 4) ----------------

function buildSecrets() {
  // Sala del Nastro: dietro lo scaffale con il libro al contrario nella Biblioteca di Bilancia
  const lib = MAPS[TAPE_SHELF.map];
  const room = interior(TAPE_ROOM, T('Sala del Nastro'), 9, 7, TAPE_SHELF.map, TAPE_SHELF.x, TAPE_SHELF.y);
  room.tiles[2][1] = TILE.PC; room.tiles[2][2] = TILE.PC; room.tiles[2][6] = TILE.PC; room.tiles[2][7] = TILE.PC;
  room.tiles[2][4] = TILE.SHELF; room.tiles[6][1] = TILE.PLANT;
  rect(room.tiles, 3, 4, 3, 1, TILE.RUG);
  room.npcs.push({ id: 'secret_tape_lady', x: 4, y: 3, pal: 19, dir: 0, name: T('Vecchia del Nastro'), kind: 'secret', data: { key: 'tape' } });
  MAPS[TAPE_ROOM] = room;
  lib.warps.push({ x: TAPE_SHELF.x, y: TAPE_SHELF.y, to: TAPE_ROOM, tx: Math.floor(room.w / 2), ty: room.h - 2, dir: 1, lock: 'secret' });

  // Pietra delle Mani di Diamante, con due fiori ai lati
  const r6 = MAPS[HODL_STONE.map];
  r6.tiles[HODL_STONE.y][HODL_STONE.x] = TILE.SIGN;
  r6.tiles[HODL_STONE.y][HODL_STONE.x - 1] = TILE.FLOWERS; r6.tiles[HODL_STONE.y][HODL_STONE.x + 1] = TILE.FLOWERS;
  r6.signs.push({ x: HODL_STONE.x, y: HODL_STONE.y, text: [T('Una pietra antica con due mani scolpite, chiuse a pugno.'), T('Sotto, un\'incisione consumata: "CHI NON SI MUOVE, VEDE."')] });

  // Lo Squalo (solo nel fine settimana) e il Sussurratore del Casinò
  MAPS[WHALE.map].npcs.push({ id: 'secret_whale', x: WHALE.x, y: WHALE.y, pal: 12, dir: 2, name: T('Lo Squalo'), kind: 'secret', data: { key: 'whale' } });
  MAPS.casino.npcs.push({ id: 'secret_rumors', x: 9, y: 5, pal: 17, dir: 2, name: T('Il Sussurratore'), kind: 'secret', data: { key: 'rumors' } });
}
