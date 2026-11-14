// Mappa delle normali "a cuscino" del foglio dei personaggi (vedi actors.ts). Calcolo puro sui pixel, senza Three.js
// né canvas: può girare in un worker (systems/prewarm.ts) mentre il giocatore è sul titolo. Su un telefono, nella
// pagina, costa più di un secondo.
import { RS, CH } from '../art/art';

const FW = 16 * RS, FH = CH * RS; // un fotogramma nel foglio ingrandito
const RADIUS = 3.2 * RS; // raggio del "cuscino" in pixel del foglio
const DETAIL = 0.22; // quanto i chiari/scuri del disegno (contorni, pieghe) entrano nel rilievo
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * Mappa delle normali per tutto il foglio dei personaggi. Per ogni fotogramma: distanza dal bordo della sagoma
 * (chamfer 3-4) → altezza a cupola, più un po' della luminosità del disegno (i contorni scuri diventano solchi
 * e separano testa, braccia e corpo). Le normali sono in spazio tangente (convenzione OpenGL, +Y in alto).
 */
export function normalMapPixels(src: Uint8ClampedArray, W: number, H: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  new Uint32Array(d.buffer).fill(LE ? 0xffff8080 : 0x8080ffff); // normale piatta (128, 128, 255) ovunque
  // distanze su una griglia con un bordo vuoto di una casella: niente controlli dei limiti nei cicli
  const PW = FW + 2, PH = FH + 2;
  const dist = new Float32Array(PW * PH), hgt = new Float32Array(FW * FH);
  const BIG = 1e6;
  for (let cy = 0; cy + FH <= H; cy += FH) for (let cx = 0; cx + FW <= W; cx += FW) {
    let any = false;
    for (let y = 0; y < FH; y++) {
      const row = ((cy + y) * W + cx) * 4 + 3, o = (y + 1) * PW + 1;
      for (let x = 0; x < FW; x++) { const on = src[row + x * 4] > 127; dist[o + x] = on ? BIG : 0; if (on) any = true; }
    }
    if (!any) continue;
    for (let y = 1; y <= FH; y++) for (let x = 1; x <= FW; x++) {
      const i = y * PW + x; const v = dist[i]; if (!v) continue;
      dist[i] = Math.min(v, dist[i - 1] + 3, dist[i - PW] + 3, dist[i - PW - 1] + 4, dist[i - PW + 1] + 4);
    }
    for (let y = FH; y >= 1; y--) for (let x = FW; x >= 1; x--) {
      const i = y * PW + x; const v = dist[i]; if (!v) continue;
      dist[i] = Math.min(v, dist[i + 1] + 3, dist[i + PW] + 3, dist[i + PW + 1] + 4, dist[i + PW - 1] + 4);
    }
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x, dv = dist[(y + 1) * PW + x + 1];
      if (!dv) { hgt[i] = 0; continue; }
      const t = Math.min(1, dv / 3 / RADIUS), dome = Math.sqrt(1 - (1 - t) * (1 - t));
      const p = ((cy + y) * W + cx + x) * 4;
      const lum = (0.3 * src[p] + 0.59 * src[p + 1] + 0.11 * src[p + 2]) / 255;
      hgt[i] = dome * RADIUS + DETAIL * RADIUS * lum;
    }
    for (let y = 0; y < FH; y++) {
      const yu = (y > 0 ? y - 1 : 0) * FW, yd = (y < FH - 1 ? y + 1 : FH - 1) * FW, ym = y * FW;
      for (let x = 0; x < FW; x++) {
        if (!dist[(y + 1) * PW + x + 1]) continue;
        const gx = (hgt[ym + (x < FW - 1 ? x + 1 : x)] - hgt[ym + (x > 0 ? x - 1 : 0)]) / 2, gy = (hgt[yd + x] - hgt[yu + x]) / 2;
        // gy cresce verso il basso del foglio; nello spazio tangente +Y è verso l'alto
        let nx = -gx, ny = gy, nz = 1;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l;
        const p = ((cy + y) * W + cx + x) * 4;
        d[p] = Math.round((nx * 0.5 + 0.5) * 255); d[p + 1] = Math.round((ny * 0.5 + 0.5) * 255); d[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      }
    }
  }
  return d;
}


/** Mappa già calcolata dal worker per il foglio del gioco, in attesa di diventare una texture. */
let pending: { px: Uint8ClampedArray; w: number; h: number } | undefined;
export function adoptNormalPixels(px: Uint8ClampedArray, w: number, h: number) { pending = { px, w, h }; }
export function takeNormalPixels(w: number, h: number): Uint8ClampedArray | undefined {
  const p = pending; pending = undefined;
  return p && p.w === w && p.h === h && p.px.length === w * h * 4 ? p.px : undefined;
}
