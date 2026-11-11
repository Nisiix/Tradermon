// Landing page di Tradermon: niente Phaser, solo canvas 2D e CSS. Riusa la pixel art e i dati del gioco.
import '@fontsource/press-start-2p/400.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './landing.css';
import qrcode from 'qrcode-generator';
import { portrait, drawCharacters, drawTileRaw, CHAR_PER_ROW, CW, CH, RS, PAL } from '../src/art/art';
import { marketClock } from '../src/systems/market';
import { mentor, TOWNS } from '../src/data/story';
import type { Track } from '../src/types';
import donazioni from './config/donazioni.json';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---------------- Barra in alto ----------------

function market() {
  const el = $('#market');
  const m = marketClock();
  el.textContent = m.label;
  el.classList.toggle('open', m.open);
}
market();
setInterval(market, 60_000);

const burger = $('.burger');
burger.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => {
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
}));

const bubble = $('#wallet-bubble');
$('#wallet').addEventListener('click', (e) => {
  e.stopPropagation();
  bubble.hidden = !bubble.hidden;
});
document.addEventListener('click', () => { bubble.hidden = true; });

// Transizione a tendine verso il gioco
document.querySelectorAll<HTMLAnchorElement>('[data-play]').forEach((a) => a.addEventListener('click', (e) => {
  if (reduced || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  const c = $('#curtain');
  c.classList.add('go');
  setTimeout(() => { location.href = a.href; }, 650);
}));
// Tornando indietro dalla cache del browser la tendina non deve restare chiusa
addEventListener('pageshow', () => $('#curtain').classList.remove('go'));

// ---------------- Hero: cielo, skyline e grafico ----------------

function hero() {
  const cv = $<HTMLCanvasElement>('#sky');
  const c = cv.getContext('2d')!;
  const W = 320, H = 180; // risoluzione logica, ingrandita senza sfocare via CSS
  cv.width = W; cv.height = H;
  const h = new Date().getHours();
  const night = h >= 20 || h < 6;
  const dusk = !night && (h >= 17 || h < 8);
  const sky = night ? ['#0c1030', '#1c2050', '#302a60'] : dusk ? ['#2a2060', '#a04870', '#f0a050'] : ['#4878d0', '#78a8e8', '#b8d8f0'];
  // grattacieli deterministici
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blds: { x: number; w: number; h: number; win: boolean[] }[] = [];
  for (let x = -4; x < W;) {
    const w = 14 + Math.floor(rnd() * 22), hh = 40 + Math.floor(rnd() * 70);
    const cols = Math.floor((w - 4) / 4), rows = Math.floor((hh - 6) / 6);
    blds.push({ x, w, h: hh, win: Array.from({ length: cols * rows }, () => rnd() < (night ? 0.45 : 0.15)) });
    x += w + 1 + Math.floor(rnd() * 3);
  }
  // linea del grafico: passeggiata casuale che sale
  const pts: number[] = [];
  let y = 120;
  for (let i = 0; i <= 64; i++) { pts.push(y); y += (rnd() - 0.62) * 9; y = Math.max(40, Math.min(140, y)); }
  const stars = Array.from({ length: 40 }, () => [Math.floor(rnd() * W), Math.floor(rnd() * 80)]);
  let t0 = performance.now();

  const draw = (now: number) => {
    const t = reduced ? 1e9 : now - t0;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (night) { c.fillStyle = '#e8e8ff'; for (const [sx, sy] of stars) if ((sx + Math.floor(t / 400)) % 5) c.fillRect(sx, sy, 1, 1); }
    // sole o luna
    c.fillStyle = night ? '#f0f0d0' : '#f8d860';
    c.beginPath(); c.arc(250, night ? 34 : dusk ? 112 : 30, 12, 0, Math.PI * 2); c.fill();
    // skyline
    for (const b of blds) {
      const top = H - 30 - b.h;
      c.fillStyle = night ? '#1a1838' : dusk ? '#3a2858' : '#506090';
      c.fillRect(b.x, top, b.w, b.h);
      c.fillStyle = night ? '#24204a' : dusk ? '#4a3468' : '#6070a0';
      c.fillRect(b.x, top, 2, b.h);
      const cols = Math.floor((b.w - 4) / 4);
      b.win.forEach((on, i) => {
        const flick = !reduced && ((i * 31 + Math.floor(t / 1500)) % 97 === 0);
        if (on !== flick) { c.fillStyle = '#f8d870'; c.fillRect(b.x + 3 + (i % cols) * 4, top + 4 + Math.floor(i / cols) * 6, 2, 3); }
      });
    }
    // grafico verde che si disegna da solo
    const n = Math.min(pts.length - 1, Math.floor(t / 45));
    c.strokeStyle = '#183818'; c.lineWidth = 4; c.lineJoin = 'round';
    const path = () => { c.beginPath(); for (let i = 0; i <= n; i++) { const px = 10 + i * 4.6; i ? c.lineTo(px, pts[i]) : c.moveTo(px, pts[i]); } };
    path(); c.stroke();
    c.strokeStyle = '#48e070'; c.lineWidth = 2; path(); c.stroke();
    if (n === pts.length - 1) { // freccia
      const ax = 10 + n * 4.6, ay = pts[n];
      c.fillStyle = '#48e070'; c.beginPath(); c.moveTo(ax + 7, ay - 4); c.lineTo(ax - 2, ay - 6); c.lineTo(ax + 3, ay + 3); c.fill();
    }
    // prato
    c.fillStyle = '#48a048'; c.fillRect(0, H - 30, W, 30);
    c.fillStyle = '#58b858'; for (let x = 0; x < W; x += 6) c.fillRect(x + ((x / 6) % 2) * 2, H - 30, 2, 2);
    c.fillStyle = '#307830'; c.fillRect(0, H - 4, W, 4);
    if (!reduced && document.visibilityState === 'visible') requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !reduced) { t0 = performance.now() - 1e6; requestAnimationFrame(draw); } });
}
hero();

// ---------------- Logo nella barra ----------------
// Il titolo grande sta nell'hero: il logo della barra compare solo quando l'hero esce dallo schermo.
const heroEl = $('#home');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => document.body.classList.toggle('past-hero', !e.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe(heroEl.querySelector('h1')!);
} else document.body.classList.add('past-hero');

// ---------------- Percorsi ----------------

const TRACKS: { id: Track; name: string; color: string; desc: string }[] = [
  { id: 'stocks', name: 'Sentiero dei Titoli', color: 'blue', desc: 'Le azioni delle aziende: bilanci, settori, scelte.' },
  { id: 'etf', name: 'Sentiero degli Indici', color: 'green', desc: 'Gli ETF: panieri, costi bassi, pazienza.' },
  { id: 'crypto', name: 'Sentiero Cripto', color: 'orange', desc: 'La frontiera più rischiosa: reti, chiavi, volatilità.' },
  { id: 'mixed', name: 'Sentiero Misto', color: 'purple', desc: 'Due o tre classi insieme: l\'arte delle proporzioni.' },
];
const cards = $('#cards');
for (const t of TRACKS) {
  const m5 = mentor(5, t.id);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `card ${t.color}`;
  card.setAttribute('aria-label', `${t.name}: ${t.desc} Mentore della quinta città: ${m5.name}, Tecnica ${m5.technique}.`);
  card.innerHTML = `<span class="inner"><span class="front"><span class="case"></span><b>${t.name}</b><span>${t.desc}</span></span>`
    + `<span class="back"><img alt="" width="64" height="96" src="${portrait(m5.palette)}"><b>${m5.name}</b><span>Mentore di ${TOWNS[5].name}</span><span class="tech">${m5.technique}</span></span></span>`;
  card.addEventListener('click', () => card.classList.toggle('flip'));
  cards.append(card);
}

// ---------------- Medaglie ----------------

const badges = $('#badges');
for (let n = 1; n <= 8; n++) {
  const m = mentor(n, 'stocks');
  const name = n === 5 || n === 6 ? (n === 5 ? 'Il Mentore del percorso' : 'Il Mentore del Raccolto') : m.name;
  const el = document.createElement('div');
  el.className = 'badge';
  el.innerHTML = `<span class="medal m${n}" aria-hidden="true"></span><b>${m.badge}</b><span>${TOWNS[n].name}</span><span class="small">${name}</span>`;
  badges.append(el);
}
const league = document.createElement('div');
league.className = 'badge league';
league.innerHTML = `<span class="medal ml" aria-hidden="true"></span><b>Lega degli Investitori</b><span>Altopiano</span><span class="small">4 Superiori e il Campione</span>`;
badges.append(league);

// ---------------- Donazioni in crypto ----------------

interface Indirizzo { rete: string; valute?: string; indirizzo: string }
const list = ((donazioni as { indirizzi?: Indirizzo[] }).indirizzi ?? []).filter((d) => d && d.rete && d.indirizzo && d.indirizzo.trim());
if (list.length) {
  $('#dona').hidden = false;
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
      + `<p><button type="button" class="btn btn-blue" id="copy">Copia indirizzo</button></p><p class="bubble-ok" id="copied" role="status"></p>`;
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(d.indirizzo.trim()); $('#copied').textContent = 'Indirizzo copiato, grazie allenatore!'; }
      catch { $('#copied').textContent = 'Copia non riuscita: seleziona l\'indirizzo a mano.'; }
    });
  };
  list.forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = d.rete;
    b.addEventListener('click', () => show(i));
    tabs.append(b);
  });
  tabs.hidden = list.length < 2;
  const open = (e: Event) => { e.preventDefault(); show(0); box.showModal(); };
  document.querySelectorAll('[data-donate]').forEach((b) => b.addEventListener('click', open));
}
function esc(s: string): string { return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`); }

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
walkers();

// La Guida si apre anche da un link diretto (#guida) arrivando dal gioco: porta il focus sulla sezione
if (location.hash === '#guida') $('#guida').focus({ preventScroll: true });

// Service worker condiviso con il gioco (stesso file alla radice)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}
