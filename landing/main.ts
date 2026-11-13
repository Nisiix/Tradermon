// Landing page di Tradermon: niente Phaser, solo canvas 2D e CSS. Riusa la pixel art e i dati del gioco.
// Primo import: il dizionario inglese della sola landing. Le costanti dei moduli del gioco (città, Whale) restano
// chiavi italiane e si traducono qui al momento di mostrarle, così la lingua cambia sul posto senza ricaricare.
import '../src/i18n/landing';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './landing.css';
import qrcode from 'qrcode-generator';
import { portrait, drawCharacters, drawTileRaw, CHAR_PER_ROW, CW, CH, RS, PAL } from '../src/art/art';
import { mentor, TOWNS } from '../src/data/story';
import type { Track } from '../src/types';
import donazioni from './config/donazioni.json';
import segnalazioni from './config/segnalazioni.json';
import { T, keepKeys } from '../src/i18n';
import { translateDom, wireLangSwitch } from '../src/i18n/dom';
import { playInShell } from './play';

keepKeys(false);
translateDom();
// Cambio lingua: i testi della pagina cambiano subito, le parti disegnate dal codice al fotogramma dopo
wireLangSwitch(document, () => { for (const f of relang) f(); });
/** Parti della pagina scritte dal codice, da riscrivere quando cambia la lingua. */
const relang: (() => void)[] = [];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---------------- Barra in alto ----------------

const burger = $('.burger');
burger.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => {
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
}));

// Transizione a tendine verso il gioco
document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => a.addEventListener('click', (e) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  // telefono e tablet: il gioco parte a schermo intero e in orizzontale
  if (playInShell(a.href)) { e.preventDefault(); return; }
  if (reduced) return;
  e.preventDefault();
  const c = $('#curtain');
  c.classList.add('go');
  setTimeout(() => { location.href = a.href; }, 650);
}));
// Tornando indietro dalla cache del browser la tendina non deve restare chiusa
addEventListener('pageshow', () => $('#curtain').classList.remove('go'));

// ---------------- Hero: la città della Borsa ----------------
// Scena vettoriale disegnata alla risoluzione dello schermo (niente pixel ingranditi): cielo, grafico a candele
// che sale dietro i grattacieli, tre file di palazzi e il porto del Mare della Liquidità che riflette le luci.
// Un solo momento animato all'apertura (le candele salgono una dopo l'altra), poi solo stelle e finestre.

type Phase = 'day' | 'dusk' | 'night';
interface Theme { sky: string[]; glow: string; orb: string; far: string; mid: string; near: string; edge: string; win: string; winOn: number; water: string[] }
const THEMES: Record<Phase, Theme> = {
  night: { sky: ['#070b22', '#151c4a', '#33296a'], glow: '#7a4a9a', orb: '#f4efd2', far: '#232659', mid: '#181a40', near: '#0d0f28', edge: '#2e3170', win: '#ffd98a', winOn: 0.42, water: ['#121638', '#070918'] },
  dusk: { sky: ['#1d1a52', '#7a3f78', '#f09a5a'], glow: '#ffb070', orb: '#ffd27a', far: '#6a3f74', mid: '#3d2a5c', near: '#1f1838', edge: '#8a5a88', win: '#ffe0a0', winOn: 0.28, water: ['#3a2a5a', '#120e24'] },
  day: { sky: ['#3d6fd0', '#79a9ec', '#cfe6f8'], glow: '#ffffff', orb: '#fff2b0', far: '#9db6e0', mid: '#6d86bd', near: '#465a92', edge: '#b8cbea', win: '#e8f2ff', winOn: 0.12, water: ['#5b84c8', '#2e4c8a'] },
};

function hero() {
  const cv = $<HTMLCanvasElement>('#sky');
  const c = cv.getContext('2d')!;
  const h = new Date().getHours();
  const phase: Phase = h >= 20 || h < 6 ? 'night' : h >= 17 || h < 8 ? 'dusk' : 'day';
  const TH = THEMES[phase];
  document.body.dataset.sky = phase;

  // dati deterministici: la stessa città a ogni visita
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const candles: { o: number; c: number; hi: number; lo: number }[] = [];
  let v = 0.22;
  for (let i = 0; i < 34; i++) {
    const o = v; v = Math.max(0.12, Math.min(0.95, v + (rnd() - 0.36) * 0.09));
    candles.push({ o, c: v, hi: Math.max(o, v) + rnd() * 0.04, lo: Math.min(o, v) - rnd() * 0.04 });
  }
  const layer = (n: number, minH: number, maxH: number) => {
    const out: { x: number; w: number; h: number; spire: number; win: number[] }[] = [];
    for (let x = -0.02; x < 1.02;) {
      const w = 0.035 + rnd() * 0.05, hh = minH + rnd() * (maxH - minH);
      out.push({ x, w, h: hh, spire: rnd() < 0.18 ? 0.02 + rnd() * 0.04 : 0, win: Array.from({ length: 80 }, () => rnd()) });
      x += w + rnd() * 0.01 * n;
    }
    return out;
  };
  const far = layer(1, 0.18, 0.38), mid = layer(2, 0.14, 0.32), near = layer(3, 0.08, 0.22);
  const stars = Array.from({ length: 90 }, () => [rnd(), rnd() * 0.55, rnd() * 1.2 + 0.4, rnd() * 6.28]);

  let W = 0, H = 0, dpr = 1, horizon = 0;
  const back = document.createElement('canvas'), front = document.createElement('canvas');

  const drawCity = (g: CanvasRenderingContext2D, list: typeof far, color: string, base: number, scale: number, lit: number, winSize: number) => {
    for (const b of list) {
      const x = b.x * W, w = b.w * W, hh = b.h * H * scale, top = base - hh;
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(top), Math.ceil(w), Math.ceil(hh) + 1);
      if (b.spire) { g.fillRect(Math.round(x + w / 2 - 1.5 * dpr), Math.round(top - b.spire * H), Math.ceil(3 * dpr), Math.ceil(b.spire * H)); }
      g.fillStyle = TH.edge; g.globalAlpha = 0.35; g.fillRect(Math.round(x), Math.round(top), Math.ceil(2 * dpr), Math.ceil(hh)); g.globalAlpha = 1;
      if (!lit) continue;
      const sx = winSize * 2.2, sy = winSize * 2.6;
      const cols = Math.max(1, Math.floor((w - winSize * 2) / sx)), rows = Math.max(1, Math.floor((hh - winSize * 3) / sy));
      const ox = x + (w - cols * sx + (sx - winSize)) / 2;
      g.fillStyle = TH.win;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        if (b.win[(r * cols + k) % 80] > lit) continue;
        g.globalAlpha = 0.55 + b.win[(r * 7 + k) % 80] * 0.45;
        g.fillRect(Math.round(ox + k * sx), Math.round(top + winSize * 2 + r * sy), Math.ceil(winSize), Math.ceil(winSize * 1.3));
      }
      g.globalAlpha = 1;
    }
  };

  const build = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.round(cv.clientWidth * dpr); H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    for (const k of [cv, back, front]) { k.width = W; k.height = H; }
    horizon = H * 0.84;
    // sfondo: cielo, bagliore all'orizzonte, luna o sole
    const b = back.getContext('2d')!;
    const sky = b.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.6, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    const glow = b.createRadialGradient(W * 0.62, horizon, 0, W * 0.62, horizon, W * 0.7);
    glow.addColorStop(0, TH.glow + '66'); glow.addColorStop(1, TH.glow + '00');
    b.fillStyle = glow; b.fillRect(0, 0, W, H);
    const ox = W * (W / dpr > 900 ? 0.86 : 0.8), oy = phase === 'dusk' ? horizon * 0.62 : H * (W / dpr > 900 ? 0.2 : 0.15), r = Math.max(26, Math.min(W, H) * 0.06);
    const halo = b.createRadialGradient(ox, oy, r * 0.8, ox, oy, r * 4);
    halo.addColorStop(0, TH.orb + '55'); halo.addColorStop(1, TH.orb + '00');
    b.fillStyle = halo; b.fillRect(0, 0, W, H);
    b.fillStyle = TH.orb; b.beginPath(); b.arc(ox, oy, r, 0, Math.PI * 2); b.fill();
    if (phase === 'night') { b.fillStyle = '#00000018'; b.beginPath(); b.arc(ox - r * 0.3, oy - r * 0.2, r * 0.25, 0, 7); b.arc(ox + r * 0.35, oy + r * 0.3, r * 0.16, 0, 7); b.fill(); }
    // primo piano: tre file di palazzi e il porto
    const f = front.getContext('2d')!;
    f.clearRect(0, 0, W, H);
    const haze = (col: string, a: number) => { f.fillStyle = col; f.globalAlpha = a; f.fillRect(0, 0, W, horizon); f.globalAlpha = 1; };
    drawCity(f, far, TH.far, horizon, 1.15, TH.winOn * 0.5, 2 * dpr);
    haze(TH.sky[2], 0.12);
    drawCity(f, mid, TH.mid, horizon, 1, TH.winOn * 0.8, 3 * dpr);
    drawCity(f, near, TH.near, horizon, 0.9, TH.winOn, 3.5 * dpr);
    const water = f.createLinearGradient(0, horizon, 0, H);
    water.addColorStop(0, TH.water[0]); water.addColorStop(1, TH.water[1]);
    f.fillStyle = water; f.fillRect(0, horizon, W, H - horizon);
    f.fillStyle = TH.edge; f.globalAlpha = 0.6; f.fillRect(0, horizon, W, Math.ceil(2 * dpr)); f.globalAlpha = 1;
  };

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  // su schermi larghi il grafico sale a destra del riquadro del titolo; su quelli stretti sta in alto, sopra il riquadro
  const chartBox = () => W / dpr > 900
    ? { x0: W * 0.58, x1: W * 0.97, top: H * 0.14, bottom: horizon - H * 0.12 }
    : { x0: W * 0.06, x1: W * 0.94, top: H * 0.12, bottom: H * 0.4 };
  const drawChart = (t: number) => {
    const { x0, x1, top, bottom } = chartBox();
    const step = (x1 - x0) / candles.length, bw = Math.max(3 * dpr, step * 0.56);
    const yOf = (p: number) => bottom - p * (bottom - top);
    c.save();
    c.globalAlpha = phase === 'day' ? 0.5 : 0.62;
    candles.forEach((k, i) => {
      const p = ease((t - i * 55) / 420);
      if (p <= 0) return;
      const up = k.c >= k.o, cx = x0 + i * step + step / 2;
      c.strokeStyle = c.fillStyle = up ? '#48e070' : '#ff6b6b';
      const mid = (k.o + k.c) / 2, grow = (q: number) => yOf(mid + (q - mid) * p);
      c.lineWidth = Math.max(1, 1.5 * dpr);
      c.beginPath(); c.moveTo(cx, grow(k.hi)); c.lineTo(cx, grow(k.lo)); c.stroke();
      const y1 = grow(Math.max(k.o, k.c)), y2 = grow(Math.min(k.o, k.c));
      c.fillRect(cx - bw / 2, y1, bw, Math.max(2 * dpr, y2 - y1));
    });
    // media mobile: si traccia dietro le candele
    const n = Math.min(candles.length, (t - 300) / 55);
    if (n > 1) {
      c.globalAlpha = 0.95; c.strokeStyle = '#f8d860'; c.lineWidth = 2.5 * dpr; c.lineJoin = 'round'; c.shadowColor = '#f8d860'; c.shadowBlur = 10 * dpr;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = candles.slice(Math.max(0, i - 4), i + 1), avg = a.reduce((s, k) => s + k.c, 0) / a.length;
        const px = x0 + i * step + step / 2, py = yOf(avg);
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
    }
    c.restore();
  };

  let start = performance.now(), last = 0, parallax = 0;
  const INTRO = 34 * 55 + 700;
  const frame = (now: number) => {
    if (!W) return;
    const t = reduced ? 1e9 : now - start;
    c.drawImage(back, 0, 0);
    if (phase !== 'day') {
      c.fillStyle = '#ffffff';
      for (const [sx, sy, sr, ph] of stars) {
        c.globalAlpha = reduced ? 0.7 : 0.45 + 0.4 * Math.sin(now / 900 + ph);
        c.beginPath(); c.arc(sx * W, sy * horizon, sr * dpr, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
    c.save(); c.translate(0, -parallax * 0.35 * dpr); drawChart(t); c.restore();
    c.drawImage(front, 0, 0);
    // riflessi delle luci sull'acqua
    c.fillStyle = TH.win;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 0.0383 + 0.02) % 1) * W, y = horizon + (6 + (i % 5) * 9) * dpr * (H / 900 + 0.6);
      c.globalAlpha = 0.18 + 0.14 * Math.sin(now / 700 + i);
      c.fillRect(x + Math.sin(now / 1100 + i) * 4 * dpr, y, (14 + (i % 4) * 8) * dpr, 1.5 * dpr);
    }
    c.globalAlpha = 1;
  };
  const loop = (now: number) => {
    // dopo l'apertura bastano pochi fotogrammi al secondo: stelle e riflessi si muovono piano
    if (now - start < INTRO || now - last > 66) { frame(now); last = now; }
    if (!reduced && document.visibilityState === 'visible' && heroVisible) requestAnimationFrame(loop);
  };
  let heroVisible = true;
  build();
  requestAnimationFrame(loop);
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { build(); frame(performance.now()); }, 120); });
  addEventListener('scroll', () => { parallax = Math.min(scrollY, innerHeight); }, { passive: true });
  const restart = () => { if (!reduced && document.visibilityState === 'visible' && heroVisible) requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', restart);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { const was = heroVisible; heroVisible = e.isIntersecting; if (!was && heroVisible) restart(); }).observe(cv);
}
hero();

// ---------------- Logo nella barra ----------------
// Il titolo grande sta nell'hero: il logo della barra compare solo quando l'hero esce dallo schermo.
const heroEl = $('#home');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => document.body.classList.toggle('past-hero', !e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(heroEl.querySelector('h1')!);
} else document.body.classList.add('past-hero');

// ---------------- Percorsi ----------------

const TRACKS: { id: Track; name: () => string; color: string; desc: () => string }[] = [
  { id: 'listed', name: () => T('Sentiero Azioni ed ETF'), color: 'blue', desc: () => T('Azioni ed ETF: bilanci, panieri, costi bassi e pazienza.') },
  { id: 'crypto', name: () => T('Sentiero Cripto'), color: 'orange', desc: () => T('La frontiera più rischiosa: reti, chiavi, volatilità.') },
  { id: 'mixed', name: () => T('Sentiero Misto'), color: 'purple', desc: () => T('Azioni, ETF e cripto insieme: l\'arte delle proporzioni.') },
];
// i ritratti si disegnano una volta sola: al cambio di lingua cambiano solo le scritte
const portraits = new Map<number, string>();
const face = (pal: number) => { let p = portraits.get(pal); if (!p) { p = portrait(pal); portraits.set(pal, p); } return p; };
const cards = $('#cards');
function renderCards() {
  const flipped = [...cards.children].map((c) => c.classList.contains('flip'));
  cards.replaceChildren();
  TRACKS.forEach((t, i) => {
    const m5 = mentor(5, t.id);
    const name = t.name(), desc = t.desc(), who = T(m5.name), tech = T(m5.technique);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card ${t.color}${flipped[i] ? ' flip' : ''}`;
    card.setAttribute('aria-label', T`${name}: ${desc} Whale della quinta città: ${who}, Tecnica ${tech}.`);
    card.innerHTML = `<span class="inner"><span class="front"><span class="case"></span><b>${name}</b><span>${desc}</span></span>`
      + T`<span class="back"><img alt="" width="64" height="96" src="${face(m5.palette)}"><b>${who}</b><span>Whale di ${T(TOWNS[5].name)}</span><span class="tech">${tech}</span></span></span>`;
    card.addEventListener('click', () => card.classList.toggle('flip'));
    cards.append(card);
  });
}
renderCards();
relang.push(renderCards);

// ---------------- Medaglie ----------------

const badges = $('#badges');
function renderBadges() {
  badges.replaceChildren();
  for (let n = 1; n <= 8; n++) {
    const m = mentor(n, 'listed');
    const name = n === 5 || n === 6 ? (n === 5 ? T('La Whale del percorso') : T('La Whale del Raccolto')) : T(m.name);
    const el = document.createElement('div');
    el.className = 'badge';
    el.innerHTML = `<span class="medal m${n}" aria-hidden="true"></span><b>${T(m.badge)}</b><span>${T(TOWNS[n].name)}</span><span class="small">${name}</span>`;
    badges.append(el);
  }
  const league = document.createElement('div');
  league.className = 'badge league';
  league.innerHTML = T`<span class="medal ml" aria-hidden="true"></span><b>Wall Street</b><span>la Borsa finale</span><span class="small">4 Superiori e il Campione</span>`;
  badges.append(league);
}
renderBadges();
relang.push(renderBadges);

// ---------------- Donazioni: PayPal e crypto ----------------
// Tutto da config/donazioni.json: link PayPal (paypal.me o paypal.com) e/o indirizzi crypto. Se manca tutto, l'invito non compare.

const paypal = String((donazioni as { paypal?: string }).paypal ?? '').trim();
if (/^https:\/\/(www\.)?(paypal\.me|paypal\.com)\//i.test(paypal)) {
  const a = $<HTMLAnchorElement>('#dona-paypal');
  a.href = paypal;
  a.hidden = false;
  $('#dona').hidden = false;
}

interface Indirizzo { rete: string; valute?: string; indirizzo: string }
const list = ((donazioni as { indirizzi?: Indirizzo[] }).indirizzi ?? []).filter((d) => d && d.rete && d.indirizzo && d.indirizzo.trim());
if (list.length) {
  $('#dona').hidden = false;
  $('#dona-crypto').hidden = false;
  const box = $<HTMLDialogElement>('#donate-box');
  const tabs = $('#donate-tabs');
  const body = $('#donate-body');
  const show = (i: number) => {
    const d = list[i];
    tabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    const qr = qrcode(0, 'M');
    qr.addData(d.indirizzo.trim());
    qr.make();
    body.innerHTML = `<p><b>${esc(d.rete)}</b>${d.valute ? ` · ${esc(d.valute)}` : ''}</p>`
      + `<div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>`
      + `<p class="addr"><code>${esc(d.indirizzo.trim())}</code></p>`
      + T`<p><button type="button" class="btn btn-blue" id="copy">Copia indirizzo</button></p><p class="bubble-ok" id="copied" role="status"></p>`;
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(d.indirizzo.trim()); $('#copied').textContent = T('Indirizzo copiato, grazie allenatore!'); }
      catch { $('#copied').textContent = T('Copia non riuscita: seleziona l\'indirizzo a mano.'); }
    });
  };
  list.forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = d.rete;
    b.addEventListener('click', () => { current = i; show(i); });
    tabs.append(b);
  });
  tabs.hidden = list.length < 2;
  let current = 0;
  const open = (e: Event) => { e.preventDefault(); current = 0; show(0); box.showModal(); };
  relang.push(() => { if (box.open) show(current); });
  document.querySelectorAll('[data-donate]').forEach((b) => b.addEventListener('click', open));
}
function esc(s: string): string { return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`); }

// ---------------- Segnala un problema ----------------
// Il modulo prepara un'email verso l'indirizzo scelto in config/segnalazioni.json e la apre nel programma di posta:
// la pagina non spedisce nulla da sola (sito statico, nessun server).

const reportTo = String((segnalazioni as { email?: string }).email ?? '').trim();
if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reportTo)) {
  const link = $<HTMLAnchorElement>('#report-link');
  const box = $<HTMLDialogElement>('#report-box');
  const form = $<HTMLFormElement>('#report-form');
  const err = $('#report-error');
  link.hidden = false;
  link.addEventListener('click', (e) => { e.preventDefault(); err.textContent = ''; box.showModal(); });
  $('#report-close').addEventListener('click', () => box.close());
  $('#report-address').textContent = reportTo;
  form.querySelector('textarea')!.addEventListener('input', () => { err.textContent = ''; });
  relang.push(() => { err.textContent = ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const testo = String(data.get('testo') ?? '').trim();
    if (testo.length < 10) { err.textContent = T('Scrivi almeno una frase su cosa è successo.'); form.querySelector('textarea')!.focus(); return; }
    err.textContent = '';
    const tipo = String(data.get('tipo') ?? T('Altro'));
    const info = data.get('info') ? T`\n\n---\nBrowser: ${navigator.userAgent}\nSchermo: ${innerWidth}×${innerHeight}\nPagina: ${location.href.split('#')[0]}` : '';
    location.href = `mailto:${reportTo}?subject=${encodeURIComponent(`[Tradermon] ${tipo}`)}&body=${encodeURIComponent(testo + info)}`;
    $('#report-fallback').hidden = false;
  });
}

// ---------------- Abitanti che passeggiano nel footer ----------------

function walkers() {
  const cv = $<HTMLCanvasElement>('#walkers');
  const c = cv.getContext('2d')!;
  const sheet = drawCharacters();
  const grass = [drawTileRaw('grass0'), drawTileRaw('grass1'), drawTileRaw('grass2')];
  const FW = CW * RS, FH = CH * RS;
  const people = [PAL.PROF, PAL.NURSE, PAL.RIVAL, 2, 3, 4, 6, 7].map((pal, i) => ({ pal, x: i * 170 + 40, v: (i % 2 ? -1 : 1) * (0.25 + (i % 3) * 0.1) }));
  const resize = () => { cv.width = cv.clientWidth || innerWidth; cv.height = 32 * RS; };
  resize();
  addEventListener('resize', resize);
  const frame = (pal: number, dir: number, f: number) => {
    const col = (pal % CHAR_PER_ROW) * 12 + dir * 3 + f, row = Math.floor(pal / CHAR_PER_ROW);
    return [col * FW, row * FH] as const;
  };
  const P = 16 * RS;
  let t = 0;
  const draw = () => {
    t++;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i * P < cv.width; i++) c.drawImage(grass[i % 7 === 3 ? 2 : i % 3 === 1 ? 1 : 0], i * P, P, P, P);
    for (const p of people) {
      if (!reduced) p.x += p.v * RS;
      if (p.x > cv.width + 20) p.x = -FW; if (p.x < -FW) p.x = cv.width + 20;
      const f = reduced ? 0 : [0, 1, 0, 2][Math.floor(t / 10) % 4];
      const [sx, sy] = frame(p.pal, p.v > 0 ? 3 : 2, f);
      c.drawImage(sheet, sx, sy, FW, FH, Math.round(p.x), 4 * RS, FW, FH);
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  draw();
}
// Disegnare il foglio dei personaggi costa mezzo secondo su un telefono: si fa dopo, quando la pagina è già visibile
// e ferma, così i testi compaiono subito.
const later = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(() => f(), { timeout: 2500 }) : setTimeout(f, 300));
if (document.readyState === 'complete') later(walkers); else addEventListener('load', () => later(walkers), { once: true });

// La Guida si apre anche da un link diretto (#guida) arrivando dal gioco: porta il focus sulla sezione
if (location.hash === '#guida') $('#guida').focus({ preventScroll: true });

// Service worker condiviso con il gioco (stesso file alla radice)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}
