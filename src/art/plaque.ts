import { RS } from './art';

/**
 * Insegne degli edifici (BANCA, EXCHANGE, ...): un piccolo font bitmap in pixel art, disegnato
 * alla scala interna RS così resta nitido come il resto della grafica (non dipende dal caricamento dei web font).
 */
const GLYPHS: Record<string, string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Z: ['####', '...#', '.##.', '#...', '####'],
  ' ': ['..', '..', '..', '..', '..'],
};
/** Lettere accentate: glifo base + accento grave disegnato sopra (nelle due righe di margine). */
const GRAVE: Record<string, string> = { 'Ò': 'O', 'À': 'A', 'È': 'E', 'Ì': 'I', 'Ù': 'U' };

export const PLAQUE_COLORS = {
  clinic: { bg: '#1f6a4a', hi: '#3a8a64', text: '#f6dc78', edge: '#0c2a1e' },
  gym: { bg: '#2f4fa8', hi: '#4a6cc8', text: '#ffe060', edge: '#101c48' },
  public: { bg: '#f2e6c4', hi: '#fff6dc', text: '#5a3a1c', edge: '#4a3020' },
} as const;

export function hasGlyphs(text: string): boolean {
  return [...text].every((c) => GLYPHS[c] || GLYPHS[GRAVE[c] ?? '']);
}

/** Larghezza e altezza in pixel logici dell'insegna. */
export function plaqueSize(text: string): { w: number; h: number } {
  const chars = [...text];
  const textW = chars.reduce((s, c) => s + (GLYPHS[GRAVE[c] ?? c]?.[0].length ?? 3), 0) + (chars.length - 1);
  return { w: textW + 6, h: 11 };
}

export function drawPlaque(text: string, kind: keyof typeof PLAQUE_COLORS): HTMLCanvasElement {
  const col = PLAQUE_COLORS[kind];
  const { w, h } = plaqueSize(text);
  const c = document.createElement('canvas');
  c.width = w * RS; c.height = (h + 1) * RS;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, ww = 1, hh = 1) => g.fillRect(x * RS, y * RS, ww * RS, hh * RS);
  // ombra portata sul muro
  g.fillStyle = 'rgba(0,0,0,.28)'; px(1, h, w - 1, 1);
  // cornice con angoli smussati, fondo e riflesso in alto
  g.fillStyle = col.edge; px(1, 0, w - 2, h); px(0, 1, w, h - 2);
  g.fillStyle = col.bg; px(1, 1, w - 2, h - 2);
  g.fillStyle = col.hi; px(1, 1, w - 2, 1);
  // testo
  g.fillStyle = col.text;
  let x = 3;
  for (const ch of text) {
    const base = GRAVE[ch];
    const rows = GLYPHS[base ?? ch] ?? GLYPHS[' '];
    rows.forEach((r, j) => [...r].forEach((b, i) => { if (b === '#') px(x + i, 3 + j); }));
    if (base) { px(x + 1, 1); px(x + 2, 2); }
    x += rows[0].length + 1;
  }
  return c;
}
