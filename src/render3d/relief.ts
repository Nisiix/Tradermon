// Oggetti "in rilievo" per la resa 2.5D: dalla pixel art 16×16 dei tile si ricava la maschera dell'oggetto
// (i pixel che non appartengono allo sfondo) e la si estrude in un volume con bordi a scalini, come in un
// diorama di cartone spesso. Nessun modello di terze parti: la forma e i colori vengono dal disegno stesso.
import * as THREE from 'three';
import { drawTileRaw, scale3x, T, RS } from '../art/art';

export interface PropSprite { name: string; mask: Uint8Array; rgb: Uint8ClampedArray; cell: number }

const CELLS = 32;
const sprites = new Map<string, PropSprite>();
let atlasRaw: HTMLCanvasElement | null = null;
let atlasTex: THREE.CanvasTexture | null = null;
let used = 0;
let dirty = false;

function baseCanvas(base: string | null): HTMLCanvasElement | null {
  if (!base) return null;
  if (base.startsWith('#')) { const cv = document.createElement('canvas'); cv.width = T; cv.height = T; const g = cv.getContext('2d')!; g.fillStyle = base; g.fillRect(0, 0, T, T); return cv; }
  return drawTileRaw(base);
}

/** Un pixel è "ombra sullo sfondo" se è lo stesso colore dello sfondo scurito in modo uniforme. */
function isShadeOf(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  if (r === br && g === bg && b === bb) return true;
  const k = [r / Math.max(1, br), g / Math.max(1, bg), b / Math.max(1, bb)];
  const lo = Math.min(...k), hi = Math.max(...k);
  return lo >= 0.5 && hi <= 1.0 && hi - lo < 0.12;
}

/** Registra (una volta) la maschera di un tile: pixel diversi dallo sfondo indicato (o con alpha > 0 se lo sfondo è null). */
export function propSprite(name: string, base: string | null): PropSprite {
  const key = name + '|' + base;
  const hit = sprites.get(key);
  if (hit) return hit;
  if (!atlasRaw) { atlasRaw = document.createElement('canvas'); atlasRaw.width = T * CELLS; atlasRaw.height = T * CELLS; }
  const tile = drawTileRaw(name).getContext('2d')!.getImageData(0, 0, T, T).data;
  const bc = baseCanvas(base);
  const bd = bc ? bc.getContext('2d')!.getImageData(0, 0, T, T).data : null;
  const mask = new Uint8Array(T * T);
  const rgb = new Uint8ClampedArray(T * T * 3);
  const out = atlasRaw.getContext('2d')!;
  const img = out.createImageData(T, T);
  for (let i = 0; i < T * T; i++) {
    const r = tile[i * 4], g = tile[i * 4 + 1], b = tile[i * 4 + 2], a = tile[i * 4 + 3];
    let on = a > 40;
    if (on && bd) on = !isShadeOf(r, g, b, bd[i * 4], bd[i * 4 + 1], bd[i * 4 + 2]);
    mask[i] = on ? 1 : 0;
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = on ? 255 : 0;
  }
  // pixel isolati (rumore della maschera) vengono tolti; buchi isolati riempiti
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= T || y >= T ? 0 : mask[y * T + x]);
  const m2 = new Uint8Array(mask);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1);
    if (mask[y * T + x] && n === 0) { m2[y * T + x] = 0; img.data[(y * T + x) * 4 + 3] = 0; }
    if (!mask[y * T + x] && n === 4) { m2[y * T + x] = 1; img.data[(y * T + x) * 4 + 3] = 255; }
  }
  const cell = used++;
  out.putImageData(img, (cell % CELLS) * T, Math.floor(cell / CELLS) * T);
  dirty = true;
  const sp = { name, mask: m2, rgb, cell };
  sprites.set(key, sp);
  return sp;
}

/** Texture (con trasparenza) di tutti gli oggetti registrati, ingrandita con Scale3x. */
export function propAtlas(): THREE.CanvasTexture {
  if (!atlasRaw) { atlasRaw = document.createElement('canvas'); atlasRaw.width = T * CELLS; atlasRaw.height = T * CELLS; }
  if (!atlasTex || dirty) {
    // Scale3x cella per cella, così i bordi non sbavano tra oggetti vicini nell'atlante
    const big = document.createElement('canvas'); big.width = atlasRaw.width * RS; big.height = atlasRaw.height * RS;
    const bg = big.getContext('2d')!; bg.imageSmoothingEnabled = false;
    const cellCv = document.createElement('canvas'); cellCv.width = T; cellCv.height = T;
    const cc = cellCv.getContext('2d')!;
    for (const sp of sprites.values()) {
      const sx = (sp.cell % CELLS) * T, sy = Math.floor(sp.cell / CELLS) * T;
      cc.clearRect(0, 0, T, T); cc.drawImage(atlasRaw, sx, sy, T, T, 0, 0, T, T);
      bg.drawImage(RS === 3 ? scale3x(cellCv) : cellCv, sx * RS, sy * RS);
    }
    if (!atlasTex) {
      atlasTex = new THREE.CanvasTexture(big);
      atlasTex.magFilter = THREE.LinearFilter; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.colorSpace = THREE.SRGBColorSpace;
    } else { atlasTex.image = big; atlasTex.needsUpdate = true; }
    dirty = false;
  }
  return atlasTex;
}

/** Coordinate UV (u0,v0,u1,v1) della cella di un oggetto nell'atlante degli oggetti. */
export function propUv(sp: PropSprite): [number, number, number, number] {
  const cx = sp.cell % CELLS, cy = Math.floor(sp.cell / CELLS);
  const e = 0.25 / T;
  return [(cx + e) / CELLS, 1 - (cy + 1 - e) / CELLS, (cx + 1 - e) / CELLS, 1 - (cy + e) / CELLS];
}

/** Accumulatore di geometria: posizioni, normali, uv (facciate con texture) e colori (fianchi tinta unita). */
export class GeoBuilder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  private n = 0;
  /** Quadrilatero con 4 vertici in senso antiorario visto dal davanti. */
  quad(p: number[][], normal: number[], uvs?: number[][], color?: [number, number, number]) {
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.nor.push(normal[0], normal[1], normal[2]);
      if (uvs) this.uv.push(uvs[k][0], uvs[k][1]); else this.uv.push(0, 0);
      const c = color ?? [1, 1, 1];
      this.col.push(c[0], c[1], c[2]);
    }
    this.idx.push(this.n, this.n + 1, this.n + 2, this.n, this.n + 2, this.n + 3);
    this.n += 4;
  }
  get empty() { return this.n === 0; }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

function srgbToLin(c: number) { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function pixColor(sp: PropSprite, i: number, k: number): [number, number, number] {
  return [srgbToLin(sp.rgb[i * 3]) * k, srgbToLin(sp.rgb[i * 3 + 1]) * k, srgbToLin(sp.rgb[i * 3 + 2]) * k];
}

/**
 * Oggetto in piedi (recinti, cartelli, piante, mobili alti): facciata e retro con la texture trasparente,
 * fianchi estrusi pixel per pixel. Occupa la cella (x, y) della mappa, profondità `depth` centrata in zc.
 */
export function uprightRelief(front: GeoBuilder, sides: GeoBuilder, sp: PropSprite, x: number, y: number, depth: number, w = 1, h = 1, zc = y + 0.5) {
  const [u0, v0, u1, v1] = propUv(sp);
  const x0 = x + 0.5 - w / 2, x1 = x + 0.5 + w / 2;
  const zf = zc + depth / 2, zb = zc - depth / 2;
  front.quad([[x0, 0, zf], [x1, 0, zf], [x1, h, zf], [x0, h, zf]], [0, 0, 1], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  front.quad([[x1, 0, zb], [x0, 0, zb], [x0, h, zb], [x1, h, zb]], [0, 0, -1], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  if (depth < 0.03) return;
  const m = sp.mask;
  const at = (px: number, py: number) => (px < 0 || py < 0 || px >= T || py >= T ? 0 : m[py * T + px]);
  const pw = w / T, ph = h / T;
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    if (!m[py * T + px]) continue;
    const i = py * T + px;
    const ax = x0 + px * pw, bx = ax + pw;
    const top = h - py * ph, bot = top - ph;
    if (!at(px - 1, py)) sides.quad([[ax, bot, zb], [ax, bot, zf], [ax, top, zf], [ax, top, zb]], [-1, 0, 0], undefined, pixColor(sp, i, 0.78));
    if (!at(px + 1, py)) sides.quad([[bx, bot, zf], [bx, bot, zb], [bx, top, zb], [bx, top, zf]], [1, 0, 0], undefined, pixColor(sp, i, 0.78));
    if (!at(px, py - 1)) sides.quad([[ax, top, zf], [bx, top, zf], [bx, top, zb], [ax, top, zb]], [0, 1, 0], undefined, pixColor(sp, i, 0.95));
    if (!at(px, py + 1) && py < T - 1) sides.quad([[ax, bot, zb], [bx, bot, zb], [bx, bot, zf], [ax, bot, zf]], [0, -1, 0], undefined, pixColor(sp, i, 0.55));
  }
}

/**
 * Oggetto sdraiato (massi, cespugli): la texture sta sopra, all'altezza `h`, e i fianchi scendono fino a terra
 * seguendo i pixel della maschera. Occupa la cella (x, y).
 */
export function flatRelief(top: GeoBuilder, sides: GeoBuilder, sp: PropSprite, x: number, y: number, h: number) {
  const [u0, v0, u1, v1] = propUv(sp);
  top.quad([[x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y]], [0, 1, 0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  const m = sp.mask;
  const at = (px: number, py: number) => (px < 0 || py < 0 || px >= T || py >= T ? 0 : m[py * T + px]);
  const s = 1 / T;
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    if (!m[py * T + px]) continue;
    const i = py * T + px;
    const ax = x + px * s, bx = ax + s, az = y + py * s, bz = az + s;
    if (!at(px - 1, py)) sides.quad([[ax, 0, az], [ax, 0, bz], [ax, h, bz], [ax, h, az]], [-1, 0, 0], undefined, pixColor(sp, i, 0.7));
    if (!at(px + 1, py)) sides.quad([[bx, 0, bz], [bx, 0, az], [bx, h, az], [bx, h, bz]], [1, 0, 0], undefined, pixColor(sp, i, 0.7));
    if (!at(px, py - 1)) sides.quad([[bx, 0, az], [ax, 0, az], [ax, h, az], [bx, h, az]], [0, 0, -1], undefined, pixColor(sp, i, 0.6));
    if (!at(px, py + 1)) sides.quad([[ax, 0, bz], [bx, 0, bz], [bx, h, bz], [ax, h, bz]], [0, 0, 1], undefined, pixColor(sp, i, 0.85));
  }
}

/** Due pannelli incrociati (alberi, erba alta, fiori): leggibili da ogni angolazione, con ombra vera. */
export function crossPlanes(front: GeoBuilder, sp: PropSprite, x: number, y: number, w: number, h: number, lift = 0) {
  const [u0, v0, u1, v1] = propUv(sp);
  const cx = x + 0.5, cz = y + 0.5, hw = w / 2;
  const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  front.quad([[cx - hw, lift, cz], [cx + hw, lift, cz], [cx + hw, lift + h, cz], [cx - hw, lift + h, cz]], [0, 0, 1], uvs);
  front.quad([[cx, lift, cz + hw], [cx, lift, cz - hw], [cx, lift + h, cz - hw], [cx, lift + h, cz + hw]], [1, 0, 0], uvs);
}

/** Pannello rivolto alla camera inclinata (alberi): visto dall'inquadratura del gioco appare senza deformazioni. */
export function billboardQuad(front: GeoBuilder, sp: PropSprite, x: number, y: number, w: number, h: number, tilt: number, lift = 0) {
  const [u0, v0, u1, v1] = propUv(sp);
  const cx = x + 0.5, cz = y + 0.5, hw = w / 2;
  const uy = Math.cos(tilt), uz = -Math.sin(tilt);
  const nz = Math.cos(tilt), ny = Math.sin(tilt);
  front.quad([[cx - hw, lift, cz], [cx + hw, lift, cz], [cx + hw, lift + h * uy, cz + h * uz], [cx - hw, lift + h * uy, cz + h * uz]], [0, ny, nz], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
}
