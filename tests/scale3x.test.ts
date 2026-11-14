import { describe, it, expect } from 'vitest';
import { scale3xPixels } from '../src/art/art';

// Riferimento: l'algoritmo com'era prima, una cella alla volta con i vicini fermati al bordo della cella.
function reference(s: Uint32Array, w: number, h: number): Uint32Array {
  const d = new Uint32Array(w * 3 * h * 3);
  const px = (x: number, y: number) => s[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const put = (x: number, y: number, v: number) => { d[y * w * 3 + x] = v; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const A = px(x - 1, y - 1), B = px(x, y - 1), C = px(x + 1, y - 1);
    const D = px(x - 1, y), E = px(x, y), F = px(x + 1, y);
    const G = px(x - 1, y + 1), H = px(x, y + 1), I = px(x + 1, y + 1);
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
    const X = 3 * x, Y = 3 * y;
    put(X, Y, e0); put(X + 1, Y, e1); put(X + 2, Y, e2);
    put(X, Y + 1, e3); put(X + 1, Y + 1, E); put(X + 2, Y + 1, e5);
    put(X, Y + 2, e6); put(X + 1, Y + 2, e7); put(X + 2, Y + 2, e8);
  }
  return d;
}

describe('Scale3x in un solo passaggio', () => {
  // pochi colori, così le uguaglianze tra vicini (che guidano lo smussamento) capitano spesso
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const W = 4 * 16, H = 3 * 24, CW = 16, CH = 24;
  const img = Uint32Array.from({ length: W * H }, () => [0, 0xff0000ff, 0x00ff00ff, 0x101010ff][Math.floor(rnd() * 4)]);

  it("dà gli stessi pixel di prima su un'immagine intera", () => {
    expect(scale3xPixels(img, W, H)).toEqual(reference(img, W, H));
  });

  it('smussa ogni cella da sola, come quando le celle si ingrandivano una per una', () => {
    const out = scale3xPixels(img, W, H, CW, CH);
    for (let cy = 0; cy < H; cy += CH) for (let cx = 0; cx < W; cx += CW) {
      const cell = new Uint32Array(CW * CH);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) cell[y * CW + x] = img[(cy + y) * W + cx + x];
      const ref = reference(cell, CW, CH);
      for (let y = 0; y < CH * 3; y++) for (let x = 0; x < CW * 3; x++) {
        if (out[(cy * 3 + y) * W * 3 + cx * 3 + x] !== ref[y * CW * 3 + x]) throw new Error(`cella ${cx},${cy} pixel ${x},${y} diverso`);
      }
    }
  });
});
