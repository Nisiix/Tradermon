import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { characterSheetPixels, adoptCharacterPixels, charactersReady, CW, CH, CHAR_PER_ROW, CHAR_PALETTES, RS } from '../src/art/art';
import { normalMapPixels, adoptNormalPixels, takeNormalPixels } from '../src/render3d/normals';

// Caricamento su telefono: il foglio dei personaggi e la mappa delle normali si preparano in un worker
// (src/render3d/prep.worker.ts) con funzioni pure; la pagina adotta il risultato solo se le misure tornano.
describe('preparazione del mondo in sottofondo', () => {
  const sheet = characterSheetPixels();

  it('il foglio calcolato fuori dalla pagina ha le misure del foglio del gioco', () => {
    expect(RS).toBe(3);
    expect(sheet.w).toBe(CW * 12 * CHAR_PER_ROW * 3);
    expect(sheet.h).toBe(CH * Math.ceil(CHAR_PALETTES.length / CHAR_PER_ROW) * 3);
    expect(sheet.px.length).toBe(sheet.w * sheet.h);
    // calcolo deterministico: due calcoli danno gli stessi pixel
    expect(characterSheetPixels().px).toEqual(sheet.px);
  });

  it('un foglio con misure sbagliate non viene adottato (il gioco lo ridisegna da sé)', () => {
    expect(adoptCharacterPixels(new Uint32Array(4), 2, 2)).toBe(false);
    expect(charactersReady()).toBe(false);
  });

  it('la mappa delle normali è piatta fuori dalle sagome e in rilievo dentro', () => {
    const src = new Uint8ClampedArray(sheet.px.buffer.slice(0));
    const n = normalMapPixels(src, sheet.w, sheet.h);
    expect(n.length).toBe(sheet.w * sheet.h * 4);
    let flat = 0, shaped = 0, wrong = 0;
    for (let i = 0; i < sheet.w * sheet.h; i++) {
      const a = src[i * 4 + 3], r = n[i * 4], g = n[i * 4 + 1], b = n[i * 4 + 2];
      if (a <= 127) { if (r === 128 && g === 128 && b === 255) flat++; else wrong++; } else if (r !== 128 || g !== 128) shaped++;
    }
    expect(wrong).toBe(0);
    expect(flat).toBeGreaterThan(0);
    expect(shaped).toBeGreaterThan(0);
  });

  it('la mappa preparata si usa una volta sola e solo con le misure giuste', () => {
    const px = new Uint8ClampedArray(16);
    adoptNormalPixels(px, 2, 2);
    expect(takeNormalPixels(3, 2)).toBeUndefined();
    adoptNormalPixels(px, 2, 2);
    expect(takeNormalPixels(2, 2)).toBe(px);
    expect(takeNormalPixels(2, 2)).toBeUndefined();
  });
});

describe('cache dei file del gioco (public/sw.js)', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const re = new RegExp(/\/\\\/assets\\\/(.+?)\$\/\.test/.exec(sw)?.[0].slice(1, -7).replace(/\\\//g, '/') ?? '^$');

  it('tiene in cache solo i file con l\'impronta nel nome, mai pagine o file che cambiano', () => {
    expect(re.test('/Tradermon/assets/main-Cipq2cry.js')).toBe(true);
    expect(re.test('/Tradermon/assets/phaser.esm-DMjGVukU.js')).toBe(true);
    expect(re.test('/Tradermon/assets/i18n-en--pjKEqlO.js')).toBe(true);
    expect(re.test('/Tradermon/assets/press-start-2p-latin-400-normal-KLytu4cr.woff2')).toBe(true);
    expect(re.test('/Tradermon/gioca/')).toBe(false);
    expect(re.test('/Tradermon/boot.js')).toBe(false);
    expect(re.test('/Tradermon/sw.js')).toBe(false);
    expect(re.test('/Tradermon/fonts/press-start-2p.woff2')).toBe(false);
  });
});
