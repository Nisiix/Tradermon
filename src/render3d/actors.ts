// Personaggi in volume per la resa 2.5D. Prima erano un foglio di carta verticale illuminato in modo uniforme:
// visti dall'alto sembravano schiacciati e piatti. Qui ogni fotogramma del foglio 'chars' diventa:
//  - una sagoma spessa (fronte e retro con il disegno, fianchi estrusi pixel per pixel con i colori del bordo),
//  - con una mappa delle normali "a cuscino" ricavata dalla sagoma stessa (centro in rilievo, bordi che girano),
//    così il sole illumina un lato e lascia l'altro in penombra come su una figura tonda,
//  - appoggiata ai piedi e leggermente inclinata verso la camera, così le proporzioni non si schiacciano.
// Nessun modello esterno: forma, colori e rilievo vengono dalla stessa pixel art del gioco.
import * as THREE from 'three';
import { RS, CH, CHAR_PER_ROW, drawCharacters, characterPixels } from '../art/art';
import { normalMapPixels, takeNormalPixels } from './normals';

/** Misure dei personaggi nel mondo 3D (una casella = 1). */
export const ACTOR_W = 1, ACTOR_H = 1.5;
/** Spessore della sagoma: abbastanza da vedersi di lato, non tanto da sembrare un cartone. */
export const ACTOR_DEPTH = 0.13;
/** Inclinazione all'indietro (radianti) verso la camera del gioco: toglie lo schiacciamento verticale. */
export const ACTOR_LEAN = 0.36;

const FW = 16 * RS, FH = CH * RS; // un fotogramma nel foglio ingrandito

function srgbToLin(c: number) { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

const normalMaps = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** Mappa delle normali del foglio (normals.ts) come canvas, calcolata una volta per foglio. */
export function charNormalMap(sheet: HTMLCanvasElement): HTMLCanvasElement {
  // calcolata una volta per foglio: cambiare gli effetti ricrea la vista 2.5D, non serve rifare questo lavoro
  const done = normalMaps.get(sheet);
  if (done) return done;
  const W = sheet.width, H = sheet.height;
  // già pronta dal worker se è il foglio del gioco; altrimenti si calcola qui
  const px = (sheet === drawCharacters() ? takeNormalPixels(W, H) : undefined) ?? normalMapPixels(sheetPixels(sheet), W, H);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  out.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
  normalMaps.set(sheet, out);
  return out;
}

/** Pixel del foglio: quelli già calcolati se è il foglio del gioco (rileggere un canvas grande su telefono è lento). */
function sheetPixels(sheet: HTMLCanvasElement): Uint8ClampedArray {
  return sheet === drawCharacters() ? characterPixels() : sheet.getContext('2d')!.getImageData(0, 0, sheet.width, sheet.height).data;
}

/**
 * Costruisce (e tiene in memoria) la sagoma spessa di un fotogramma. L'origine è ai piedi, al centro dello
 * spessore: così l'inclinazione verso la camera ruota attorno ai piedi. Gruppo 0 = fronte e retro (texture),
 * gruppo 1 = fianchi (colori del bordo, senza texture).
 */
export class ActorGeometries {
  private cache = new Map<number, THREE.BufferGeometry>();
  private px: Uint8ClampedArray;
  private W: number; private rows: number;
  constructor(private sheet: HTMLCanvasElement) {
    this.W = sheet.width;
    this.rows = sheet.height / FH;
    this.px = sheetPixels(sheet);
  }

  /** UV (u0,v0,u1,v1) di un fotogramma, con un piccolo margine. */
  uv(frame: number): [number, number, number, number] {
    const pal = Math.floor(frame / 12), f = frame % 12;
    const col = (pal % CHAR_PER_ROW) * 12 + f, row = Math.floor(pal / CHAR_PER_ROW), FR = 12 * CHAR_PER_ROW;
    const e = 0.3 / 16;
    return [(col + e) / FR, 1 - (row + 1 - e / 1.5) / this.rows, (col + 1 - e) / FR, 1 - (row + e / 1.5) / this.rows];
  }

  get(frame: number): THREE.BufferGeometry {
    let g = this.cache.get(frame);
    if (!g) { g = this.build(frame); this.cache.set(frame, g); }
    return g;
  }

  private build(frame: number): THREE.BufferGeometry {
    const pal = Math.floor(frame / 12), f = frame % 12;
    const ox = ((pal % CHAR_PER_ROW) * 12 + f) * FW, oy = Math.floor(pal / CHAR_PER_ROW) * FH;
    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], col: number[] = [], idx: number[] = [];
    let n = 0;
    const quad = (p: number[][], nm: number[], uv?: number[][], c?: number[]) => {
      for (let k = 0; k < 4; k++) {
        pos.push(p[k][0], p[k][1], p[k][2]); nor.push(nm[0], nm[1], nm[2]);
        if (uv) uvs.push(uv[k][0], uv[k][1]); else uvs.push(0, 0); // (0,0) è trasparente: i fianchi non entrano nell'ombra
        const cc = c ?? [1, 1, 1]; col.push(cc[0], cc[1], cc[2]);
      }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    };
    const hw = ACTOR_W / 2, zf = ACTOR_DEPTH / 2, zb = -ACTOR_DEPTH / 2;
    const [u0, v0, u1, v1] = this.uv(frame);
    const fuv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    quad([[-hw, 0, zf], [hw, 0, zf], [hw, ACTOR_H, zf], [-hw, ACTOR_H, zf]], [0, 0, 1], fuv);
    quad([[hw, 0, zb], [-hw, 0, zb], [-hw, ACTOR_H, zb], [hw, ACTOR_H, zb]], [0, 0, -1], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]]);
    const faces = idx.length;
    // fianchi: un passo per pixel del foglio ingrandito, colore del pixel di bordo un po' scurito
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < FW && y < FH && this.px[((oy + y) * this.W + ox + x) * 4 + 3] > 127;
    const color = (x: number, y: number, k: number) => {
      const p = ((oy + y) * this.W + ox + x) * 4;
      return [srgbToLin(this.px[p]) * k, srgbToLin(this.px[p + 1]) * k, srgbToLin(this.px[p + 2]) * k];
    };
    const sx = ACTOR_W / FW, sy = ACTOR_H / FH;
    // per ridurre i triangoli unisce in verticale i tratti di bordo sinistro/destro dello stesso colore
    for (let x = 0; x < FW; x++) {
      for (const side of [-1, 1]) {
        let y = 0;
        while (y < FH) {
          if (!on(x, y) || on(x + side, y)) { y++; continue; }
          const c0 = this.px[((oy + y) * this.W + ox + x) * 4], start = y;
          while (y < FH && on(x, y) && !on(x + side, y) && this.px[((oy + y) * this.W + ox + x) * 4] === c0) y++;
          const top = ACTOR_H - start * sy, bot = ACTOR_H - y * sy;
          const ax = -hw + (side < 0 ? x : x + 1) * sx;
          const c = color(x, start, 0.62);
          if (side < 0) quad([[ax, bot, zb], [ax, bot, zf], [ax, top, zf], [ax, top, zb]], [-1, 0, 0], undefined, c);
          else quad([[ax, bot, zf], [ax, bot, zb], [ax, top, zb], [ax, top, zf]], [1, 0, 0], undefined, c);
        }
      }
    }
    for (let y = 0; y < FH; y++) {
      for (const side of [-1, 1]) {
        let x = 0;
        while (x < FW) {
          if (!on(x, y) || on(x, y + side)) { x++; continue; }
          const c0 = this.px[((oy + y) * this.W + ox + x) * 4], start = x;
          while (x < FW && on(x, y) && !on(x, y + side) && this.px[((oy + y) * this.W + ox + x) * 4] === c0) x++;
          const ax = -hw + start * sx, bx = -hw + x * sx;
          if (side < 0) { // bordo superiore: visto dalla camera alta, prende luce
            const t = ACTOR_H - y * sy;
            quad([[ax, t, zf], [bx, t, zf], [bx, t, zb], [ax, t, zb]], [0, 1, 0], undefined, color(start, y, 0.9));
          } else if (y < FH - 1) { // bordo inferiore (sotto braccia, mento): in ombra
            const b = ACTOR_H - (y + 1) * sy;
            quad([[ax, b, zb], [bx, b, zb], [bx, b, zf], [ax, b, zf]], [0, -1, 0], undefined, color(start, y, 0.45));
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    // i fianchi si disegnano per primi: i pixel semitrasparenti del bordo del disegno si fondono con loro
    // e non con il terreno dietro (altrimenti resta un filo verde tra faccia e spessore)
    g.addGroup(faces, idx.length - faces, 1);
    g.addGroup(0, faces, 0);
    return g;
  }
}
