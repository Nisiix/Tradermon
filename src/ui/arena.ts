/**
 * Scenografie delle sfide e transizione d'ingresso, disegnate a mano in codice.
 * Ogni sfida si svolge in un luogo del mondo della finanza (piazza delle quotazioni, aula, sala dei monitor,
 * tetto della città, fossa degli speculatori, salone di Wall Street, torre, biblioteca): niente prati né pedane ovali.
 * Lo sfondo è dipinto su una tela a bassa risoluzione e ingrandito a pixel, come il resto del gioco.
 */
import { getStage, el } from './core';
import { beep } from '../systems/audio';
import { T } from '../i18n';

export type Arena = 'piazza' | 'aula' | 'sala' | 'tetto' | 'fossa' | 'lega' | 'torre' | 'biblioteca' | 'borsa';

/** Colore d'accento di ogni luogo: tinge la transizione, la targhetta dello sfidante e il nastro. */
export const ARENA_ACCENT: Record<Arena, string> = {
  piazza: '#3fa7d6', aula: '#6fbf73', sala: '#d6a64a', tetto: '#f08a4b',
  fossa: '#e04848', lega: '#e6c35a', torre: '#9a8cf6', biblioteca: '#d09050', borsa: '#4fd6c8',
};

/** Parole del nastro scorrevole in alto: concetti del gioco, mai prezzi o titoli reali. */
export const ARENA_TAPE: Record<Arena, string[]> = {
  piazza: ['DOMANDA ▲', 'OFFERTA ▼', T('LIQUIDITÀ ▲'), 'SPREAD ▼', 'VOLUMI ▲', 'PREZZO ▲'],
  aula: ['DIVERSIFICARE ▲', T('INTERESSE COMPOSTO ▲'), 'COSTI ▼', 'ORIZZONTE ▲', T('FONDO EMERGENZE ▲')],
  sala: ['PIANO ▲', 'STOP ▲', 'RISCHIO ▼', 'DISCIPLINA ▲', 'PAZIENZA ▲', 'IMPULSO ▼'],
  tetto: [T('RIVALITÀ ▲'), 'CONFRONTO ▲', 'FRETTA ▼', 'METODO ▲', 'COSTANZA ▲'],
  fossa: ['LEVA ▼', 'PANICO ▼', 'VOCI ▼', 'FOMO ▼', 'PROMESSE ▼', T('SANGUE FREDDO ▲')],
  lega: ['ESPERIENZA ▲', 'METODO ▲', 'PROCESSO ▲', 'ALLOCAZIONE ▲', 'CALMA ▲'],
  torre: [T('PIANO SUCCESSIVO ▲'), 'RESISTENZA ▲', 'CONCENTRAZIONE ▲', 'FIDUCIA ▲'],
  biblioteca: ['RIPASSO ▲', 'APPUNTI ▲', T('CURIOSITÀ ▲'), 'DUBBI ▼', 'STUDIO ▲'],
  borsa: ['INGRESSO ▲', 'STOP ▲', 'OBIETTIVO ▲', 'SCADENZA ▲', 'ESITO ▲', 'PROCESSO ▲'],
};

type Ctx = CanvasRenderingContext2D;

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/** Fasce di colore orizzontali (cielo o parete) senza sfumature morbide. */
function bands(c: Ctx, y0: number, y1: number, W: number, cols: string[]) {
  const h = (y1 - y0) / cols.length;
  cols.forEach((col, i) => R(c, 0, y0 + i * h, W, h + 1, col));
}

/** Candele a passeggiata casuale dentro un riquadro: il motivo grafico di tutto il gioco. */
function candles(c: Ctx, x: number, y: number, w: number, h: number, n: number, rnd: () => number, up: string, dn: string, drift = 0) {
  const vals: number[] = [];
  let v = 0.5;
  for (let i = 0; i <= n; i++) { vals.push(v); v = Math.min(0.92, Math.max(0.08, v + (rnd() - 0.5 + drift) * 0.22)); }
  const slot = w / n, bw = Math.max(1, Math.floor(slot * 0.55));
  for (let i = 0; i < n; i++) {
    const o = vals[i], cl = vals[i + 1];
    const hi = Math.max(o, cl) + rnd() * 0.06, lo = Math.min(o, cl) - rnd() * 0.06;
    const col = cl >= o ? up : dn;
    const cx = x + i * slot + (slot - bw) / 2;
    R(c, cx + Math.floor(bw / 2), y + h - hi * h, 1, (hi - lo) * h, col);
    R(c, cx, y + h - Math.max(o, cl) * h, bw, Math.max(1, Math.abs(cl - o) * h), col);
  }
}

/** Profilo di palazzi con finestre accese. */
function skyline(c: Ctx, base: number, W: number, rnd: () => number, body: string, win: string, minH: number, maxH: number, winRate = 0.35) {
  let x = -4;
  while (x < W) {
    const w = 14 + Math.floor(rnd() * 22), h = minH + Math.floor(rnd() * (maxH - minH));
    R(c, x, base - h, w, h, body);
    if (rnd() < 0.3) R(c, x + Math.floor(w / 2) - 1, base - h - 6, 2, 6, body);
    for (let wy = base - h + 4; wy < base - 3; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (rnd() < winRate) R(c, wx, wy, 2, 2, win);
    x += w + Math.floor(rnd() * 3);
  }
}

/** Pavimento in prospettiva: fasce che si infittiscono verso l'orizzonte e linee di fuga. */
function floor(c: Ctx, y0: number, W: number, H: number, a: string, b: string, lines?: string) {
  let y = y0, step = 2, i = 0;
  while (y < H) { R(c, 0, y, W, step + 1, i++ % 2 ? a : b); y += step; step = Math.min(14, step + 1.4); }
  if (lines) {
    c.strokeStyle = lines; c.lineWidth = 1;
    for (let k = -8; k <= 8; k++) { c.beginPath(); c.moveTo(W / 2 + k * 9, y0); c.lineTo(W / 2 + k * 60, H); c.stroke(); }
  }
}

function screen(c: Ctx, x: number, y: number, w: number, h: number, rnd: () => number, frame: string, bg: string, up: string, dn: string, drift = 0) {
  R(c, x - 2, y - 2, w + 4, h + 4, frame);
  R(c, x, y, w, h, bg);
  for (let gy = y + h / 4; gy < y + h; gy += h / 4) R(c, x, gy, w, 1, 'rgba(255,255,255,.07)');
  candles(c, x + 2, y + 3, w - 4, h - 6, Math.max(5, Math.floor(w / 4)), rnd, up, dn, drift);
}

const PAINT: Record<Arena, (c: Ctx, W: number, H: number, rnd: () => number) => void> = {
  // Sala grande della Borsa, di notte: un unico schermo gigante e file di postazioni accese (i Boss del dopo-Wall Street)
  borsa(c, W, H, rnd) {
    const hz = H * 0.62;
    bands(c, 0, hz, W, ['#071418', '#0a1c22', '#0e242c']);
    for (let x = 6; x < W; x += 22) R(c, x, 0, 2, hz, '#0c2028');
    const sw = W * 0.62, sx = (W - sw) / 2;
    screen(c, sx, 10, sw, hz - 44, rnd, '#1c3a40', '#06121a', '#4fd6c8', '#e8705a', 0.02);
    R(c, sx, 10 + (hz - 44) * 0.4, sw, 1, 'rgba(242,211,107,.6)');
    for (let row = 0; row < 2; row++) {
      const y = hz - 22 + row * 10;
      for (let x = 4 + row * 9; x < W; x += 18) { R(c, x, y, 14, 6, '#13262c'); R(c, x + 3, y - 5, 8, 5, rnd() < 0.5 ? '#2e8a80' : '#8a4a3e'); }
    }
    floor(c, hz, W, H, '#10242a', '#0c1e24', 'rgba(79,214,200,.12)');
  },
  // Piazza delle quotazioni: cielo, palazzi lontani, tabellone e bancarelle con tende a righe
  piazza(c, W, H, rnd) {
    const hz = H * 0.62;
    bands(c, 0, hz, W, ['#9fd3ea', '#b0dbee', '#c2e3f1', '#d4ebf3', '#e2f0f2']);
    skyline(c, hz, W, rnd, '#a9c3cf', '#d7e6ec', 18, 46, 0.25);
    const bw = W * 0.42, bx = (W - bw) / 2, by = hz - 62;
    R(c, bx + 6, by + 40, 3, 22, '#4a5a68'); R(c, bx + bw - 9, by + 40, 3, 22, '#4a5a68');
    R(c, bx - 3, by - 3, bw + 6, 46, '#2d3a48'); R(c, bx, by, bw, 40, '#122030');
    for (let r = 0; r < 5; r++) { const ry = by + 4 + r * 7; R(c, bx + 4, ry, 22 + Math.floor(rnd() * 14), 3, '#f2d36b'); R(c, bx + bw - 22, ry, 16, 3, rnd() < 0.55 ? '#48d07a' : '#e85a4a'); }
    for (const sx of [0, W - 64]) {
      R(c, sx + 4, hz - 30, 2, 30, '#6b4a2e'); R(c, sx + 58, hz - 30, 2, 30, '#6b4a2e');
      for (let k = 0; k < 8; k++) R(c, sx + k * 8, hz - 36, 8, 8, k % 2 ? '#f4f0e6' : (sx ? '#3fa7d6' : '#48b878'));
      R(c, sx, hz - 28, 64, 2, 'rgba(0,0,0,.18)');
      R(c, sx + 6, hz - 14, 52, 14, '#8a6440'); R(c, sx + 6, hz - 14, 52, 2, '#a88058');
    }
    floor(c, hz, W, H, '#d8cdb8', '#cbbfa8', 'rgba(120,100,80,.18)');
  },
  // Aula dell'Exchange: lavagna con il grafico a gesso, finestre luminose, pavimento in legno
  aula(c, W, H, rnd) {
    const hz = H * 0.64;
    bands(c, 0, hz, W, ['#e6dcbc', '#e2d7b4', '#ddd1ac']);
    R(c, 0, hz - 18, W, 18, '#9c7448'); R(c, 0, hz - 18, W, 2, '#b88c5c');
    for (const wx of [10, W - 52]) { R(c, wx - 2, 14, 46, 62, '#8a6844'); R(c, wx, 16, 42, 58, '#cfeaf6'); R(c, wx + 20, 16, 2, 58, '#8a6844'); R(c, wx, 44, 42, 2, '#8a6844'); R(c, wx + 4, 20, 6, 18, 'rgba(255,255,255,.6)'); }
    const bw = W * 0.5, bx = (W - bw) / 2;
    R(c, bx - 4, 12, bw + 8, 74, '#7a5634'); R(c, bx, 16, bw, 66, '#2e4c3c');
    R(c, bx + 6, 22, 30, 2, '#e8efe6'); R(c, bx + 6, 26, 20, 2, '#c8d4c8');
    candles(c, bx + 6, 32, bw - 12, 44, 14, rnd, '#e8efe6', '#f2b8b0', 0.08);
    c.strokeStyle = '#f2e48a'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx + 8, 74); c.lineTo(bx + bw - 8, 36); c.stroke();
    R(c, bx + 10, 86, bw - 20, 3, '#5c4028'); R(c, bx + 20, 84, 8, 2, '#f4f4f4');
    floor(c, hz, W, H, '#b88a58', '#a87a4a');
  },
  // Sala della Whale: parete di monitor, legno scuro, moquette
  sala(c, W, H, rnd) {
    const hz = H * 0.64;
    bands(c, 0, hz, W, ['#2a1e1a', '#33251f', '#3c2b23']);
    for (let x = 0; x < W; x += 24) R(c, x, 0, 1, hz, '#22180f');
    for (let x = 0; x < W; x += 40) { R(c, x + 14, 0, 12, 3, '#f6e2a8'); R(c, x + 10, 3, 20, 2, 'rgba(246,226,168,.25)'); }
    const cols = 4, rows = 2, sw = 46, sh = 28, gap = 8, gx = (W - (cols * sw + (cols - 1) * gap)) / 2;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) screen(c, gx + k * (sw + gap), 16 + r * (sh + gap), sw, sh, rnd, '#141010', '#0d1a2c', '#56d88a', '#e86452', (rnd() - 0.5) * 0.1);
    R(c, 0, hz - 10, W, 10, '#4a3426'); R(c, 0, hz - 10, W, 2, '#d6a64a');
    floor(c, hz, W, H, '#244a46', '#1e403c');
  },
  // Tetto della città al tramonto: il luogo del confronto con il rivale
  tetto(c, W, H, rnd) {
    const hz = H * 0.66;
    bands(c, 0, hz, W, ['#3a2a5c', '#5c3466', '#8a3e66', '#c4566a', '#ec8a62', '#f6b46a']);
    R(c, W * 0.7, hz - 30, 22, 22, '#ffe2a0'); R(c, W * 0.7 - 3, hz - 22, 28, 8, '#ffe2a0');
    skyline(c, hz, W, rnd, '#3c2440', '#ffcf7a', 20, 62, 0.3);
    skyline(c, hz, W, rnd, '#25162c', '#f6a85a', 8, 34, 0.18);
    const bx = W * 0.14, by = hz - 74;
    R(c, bx, by, 70, 18, '#160e1a'); R(c, bx + 3, by + 3, 64, 12, '#2a1a24');
    for (let k = 0; k < 9; k++) R(c, bx + 6 + k * 7, by + 7, 4, 4, k % 3 === 2 ? '#e85a4a' : '#48d07a');
    R(c, bx + 10, by + 18, 2, 12, '#160e1a'); R(c, bx + 58, by + 18, 2, 12, '#160e1a');
    floor(c, hz, W, H, '#6c6070', '#5e5262');
    R(c, 0, hz, W, 3, '#3a3040');
    for (let x = 4; x < W; x += 16) R(c, x, hz - 12, 2, 12, '#2a2030');
    R(c, 0, hz - 13, W, 2, '#2a2030');
  },
  // Fossa degli speculatori: luci d'allarme, candele rosse che precipitano, strisce di pericolo
  fossa(c, W, H, rnd) {
    const hz = H * 0.64;
    bands(c, 0, hz, W, ['#120a0e', '#1a0d12', '#220f16', '#2c1119']);
    for (const lx of [W * 0.2, W * 0.8]) { c.fillStyle = 'rgba(232,64,64,.12)'; c.beginPath(); c.moveTo(lx - 4, 0); c.lineTo(lx + 4, 0); c.lineTo(lx + 40, hz); c.lineTo(lx - 40, hz); c.fill(); R(c, lx - 5, 0, 10, 4, '#ff5a4a'); }
    candles(c, 8, 10, W - 16, hz - 26, 22, rnd, '#5a3038', '#c83a3a', -0.12);
    screen(c, W / 2 - 34, 14, 68, 34, rnd, '#2a0c10', '#160608', '#7a3a3a', '#ff4a3a', -0.15);
    R(c, 0, hz - 8, W, 8, '#1a1014');
    for (let x = -8; x < W; x += 12) { c.fillStyle = '#e0b020'; c.beginPath(); c.moveTo(x, hz); c.lineTo(x + 6, hz); c.lineTo(x + 12, hz - 8); c.lineTo(x + 6, hz - 8); c.fill(); }
    floor(c, hz, W, H, '#2a1a1e', '#22141a', 'rgba(224,72,72,.12)');
  },
  // Salone di Wall Street: marmo, colonne dorate, grande tabellone dell'indice, tappeto
  lega(c, W, H, rnd) {
    const hz = H * 0.64;
    bands(c, 0, hz, W, ['#efe9dc', '#e8e1d2', '#e1d9c8']);
    for (let k = 0; k < 18; k++) { c.strokeStyle = 'rgba(160,150,130,.25)'; c.beginPath(); const x = rnd() * W, y = rnd() * hz; c.moveTo(x, y); c.lineTo(x + 10 + rnd() * 20, y + 4 + rnd() * 10); c.stroke(); }
    for (const px of [W * 0.06, W * 0.94 - 14, W * 0.27 - 7, W * 0.73 - 7]) { R(c, px - 2, 6, 18, 5, '#c89a30'); R(c, px, 11, 14, hz - 22, '#e6c35a'); R(c, px + 3, 11, 2, hz - 22, '#f6e2a0'); R(c, px + 10, 11, 2, hz - 22, '#b88a2a'); R(c, px - 2, hz - 11, 18, 5, '#c89a30'); }
    const bw = W * 0.34, bx = (W - bw) / 2;
    R(c, bx - 3, 16, bw + 6, 56, '#b88a2a'); R(c, bx, 19, bw, 50, '#14202e');
    candles(c, bx + 4, 24, bw - 8, 40, 12, rnd, '#e6c35a', '#9a8a70', 0.1);
    R(c, 0, hz - 6, W, 6, '#c8bfa8');
    floor(c, hz, W, H, '#d6cfbf', '#cbc3b1');
    c.fillStyle = '#9a2a32'; c.beginPath(); c.moveTo(W * 0.42, hz); c.lineTo(W * 0.58, hz); c.lineTo(W * 0.8, H); c.lineTo(W * 0.2, H); c.fill();
    R(c, W * 0.2, H - 1, W * 0.6, 1, '#e6c35a');
  },
  // Torre delle Sfide: notte vista dall'alto, vetrate con montanti, pavimento lucido
  torre(c, W, H, rnd) {
    const hz = H * 0.66;
    bands(c, 0, hz, W, ['#0e1030', '#141640', '#1c1c50', '#262460']);
    for (let k = 0; k < 40; k++) R(c, rnd() * W, rnd() * hz * 0.6, 1, 1, rnd() < 0.3 ? '#fff6c8' : '#9aa0e0');
    skyline(c, hz, W, rnd, '#1a1840', '#f6d878', 6, 22, 0.45);
    for (let x = 0; x < W; x += W / 6) R(c, x, 0, 3, hz, '#2c2a5a');
    R(c, 0, hz * 0.35, W, 2, '#2c2a5a');
    floor(c, hz, W, H, '#2a2848', '#24223e', 'rgba(154,140,246,.15)');
  },
  // Biblioteca: scaffali di libri colorati, lampade calde
  biblioteca(c, W, H, rnd) {
    const hz = H * 0.64;
    bands(c, 0, hz, W, ['#4a2e1c', '#523420']);
    const spines = ['#a83a32', '#2e5a8a', '#3a7a4a', '#c8a040', '#6a3a7a', '#d8d0c0', '#8a5030'];
    for (let sy = 8; sy < hz - 20; sy += 24) {
      R(c, 0, sy + 20, W, 4, '#2c1a10');
      let x = 2;
      while (x < W - 2) { const w = 3 + Math.floor(rnd() * 4), h = 13 + Math.floor(rnd() * 7); R(c, x, sy + 20 - h, w, h, spines[Math.floor(rnd() * spines.length)]); if (rnd() < 0.3) R(c, x, sy + 22 - h, w, 1, '#f2d36b'); x += w + (rnd() < 0.1 ? 6 : 1); }
    }
    for (const lx of [W * 0.25, W * 0.75]) { c.fillStyle = 'rgba(255,214,140,.14)'; c.beginPath(); c.arc(lx, 12, 46, 0, Math.PI * 2); c.fill(); R(c, lx - 6, 6, 12, 6, '#f6d88a'); }
    floor(c, hz, W, H, '#7a5232', '#6c4628');
  },
};

/** Dipinge lo sfondo di un luogo su una tela (la tela viene ridimensionata alla risoluzione interna). */
export function paintArena(cv: HTMLCanvasElement, theme: Arena, seed: string, aspect: number) {
  const W = 320, H = Math.max(160, Math.round(W / Math.max(0.8, aspect)));
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  PAINT[theme](c, W, H, rng(theme + ':' + seed));
}

/** Monta e mantiene lo sfondo dentro un contenitore, ridisegnandolo se cambiano le proporzioni. */
export function mountArena(host: HTMLElement, theme: Arena, seed: string): () => void {
  const cv = el('canvas', 'arena-bg');
  host.prepend(cv);
  let last = 0;
  const draw = () => {
    const a = (host.clientWidth || 3) / (host.clientHeight || 2);
    if (Math.abs(a - last) < 0.05) return;
    last = a;
    paintArena(cv, theme, seed, a);
  };
  draw();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
  ro?.observe(host);
  return () => ro?.disconnect();
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Transizione "Campanella d'apertura": una linea di prezzo attraversa lo schermo e dietro di lei
 * crescono le candele fino a coprirlo; poi il grafico si apre lungo la linea e compare il luogo della sfida.
 */
export async function arenaTransition(theme: Arena): Promise<void> {
  const stage = getStage();
  const wrap = el('div', 'bt-trans');
  const cv = el('canvas');
  wrap.appendChild(cv);
  stage.appendChild(wrap);
  beep('alert');
  const acc = ARENA_ACCENT[theme];
  const W = 160, H = Math.max(80, Math.round(W / Math.max(0.8, (stage.clientWidth || 3) / (stage.clientHeight || 2))));
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const rnd = rng(theme + Date.now());
  const cols = 20, cw = W / cols;
  const pts: number[] = [];
  let v = H / 2;
  for (let i = 0; i <= cols; i++) { pts.push(v); v = Math.min(H * 0.75, Math.max(H * 0.25, v + (rnd() - 0.5) * H * 0.3)); }
  const total = reduced() ? 260 : 1000;
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / total);
      c.clearRect(0, 0, W, H);
      c.fillStyle = `rgba(10,18,32,${Math.min(0.92, t * 2.2)})`; c.fillRect(0, 0, W, H);
      const head = Math.min(1, t / 0.55) * cols;
      for (let i = 0; i < cols; i++) {
        const age = (head - i) / 6;
        if (age <= 0) break;
        const g = Math.min(1, age), mid = (pts[i] + pts[i + 1]) / 2, upc = pts[i + 1] <= pts[i];
        const top = mid - g * (mid + 1), bot = mid + g * (H - mid + 1);
        c.fillStyle = upc ? '#1e6a46' : '#7a2830';
        c.fillRect(Math.floor(i * cw) + 1, Math.floor(top), Math.ceil(cw) - 2, Math.ceil(bot - top));
        c.fillStyle = upc ? '#48d07a' : '#e85a4a';
        c.fillRect(Math.floor(i * cw) + 1, Math.floor(Math.min(pts[i], pts[i + 1])), Math.ceil(cw) - 2, Math.max(2, Math.abs(pts[i + 1] - pts[i])));
      }
      c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= Math.floor(head); i++) { const x = i * cw, y = pts[i]; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      const fi = Math.floor(head), fr = head - fi;
      const hx = Math.min(W, (fi + fr) * cw), hy = fi < cols ? pts[fi] + (pts[fi + 1] - pts[fi]) * fr : pts[cols];
      c.lineTo(hx, hy); c.stroke();
      if (t < 0.6) { c.fillStyle = '#fff'; c.fillRect(hx - 2, hy - 2, 4, 4); }
      if (t < 1) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  });
  // apertura lungo la linea di prezzo: il sipario si divide in alto e in basso
  const y = Math.round((pts[cols] / H) * 100), url = cv.toDataURL();
  wrap.innerHTML = `<b class="half top" style="background-image:url(${url});clip-path:inset(0 0 ${100 - y}% 0)"></b><b class="half bot" style="background-image:url(${url});clip-path:inset(${y}% 0 0 0)"></b>`;
  void wrap.offsetWidth;
  wrap.classList.add('out');
  setTimeout(() => wrap.remove(), 560);
}
