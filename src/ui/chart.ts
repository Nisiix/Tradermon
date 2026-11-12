// Grafico a candele con scelta dell'orizzonte (5m, 15m, 1h, 4h, 1g), media a 20 barre e lettura didattica.
// Si usa prima di comprare o vendere: le candele sono sempre barre reali di Alpaca.
import { modal, el, esc } from './core';
import { TIMEFRAMES, TF_LABEL, sma, reading, type Candle, type Timeframe } from '../systems/candles';
import { T } from '../i18n';

export interface ChartOpts {
  title: string;
  load: (tf: Timeframe) => Promise<Candle[]> | Candle[];
  /** Orizzonte iniziale. */
  tf?: Timeframe;
  /** Riga sotto il grafico (es. prezzo di carico). */
  note?: string;
  /** Linea orizzontale di riferimento (prezzo medio di carico, ordine limite...). */
  marker?: { price: number; label: string };
}

function draw(cv: HTMLCanvasElement, bars: Candle[], marker?: ChartOpts['marker']) {
  const c = cv.getContext('2d')!;
  const W = cv.width, H = cv.height, padR = 56, padB = 18, padT = 8;
  c.fillStyle = '#f7f3e8'; c.fillRect(0, 0, W, H);
  if (!bars.length) { c.fillStyle = '#555'; c.font = '13px sans-serif'; c.fillText(T('Nessun dato per questo orizzonte.'), 12, 24); return; }
  const hi = Math.max(...bars.map((b) => b.h), marker?.price ?? -Infinity), lo = Math.min(...bars.map((b) => b.l), marker?.price ?? Infinity);
  const span = Math.max(1e-9, hi - lo);
  const y = (p: number) => padT + ((hi - p) / span) * (H - padT - padB);
  const n = bars.length, slot = (W - padR) / n, bw = Math.max(1, slot * 0.6);
  // griglia e asse dei prezzi
  c.strokeStyle = '#e0d8c3'; c.lineWidth = 1; c.fillStyle = '#555'; c.font = '11px sans-serif'; c.textAlign = 'left';
  for (let i = 0; i <= 4; i++) {
    const p = lo + (span * i) / 4, yy = y(p);
    c.beginPath(); c.moveTo(0, yy); c.lineTo(W - padR, yy); c.stroke();
    c.fillText(p >= 1000 ? p.toFixed(0) : p >= 10 ? p.toFixed(2) : p.toFixed(4), W - padR + 4, yy + 4);
  }
  // candele
  bars.forEach((b, i) => {
    const x = i * slot + slot / 2;
    const up = b.c >= b.o;
    c.strokeStyle = c.fillStyle = up ? '#2e9e5b' : '#d14b3c';
    c.beginPath(); c.moveTo(x, y(b.h)); c.lineTo(x, y(b.l)); c.stroke();
    const top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
    c.fillRect(x - bw / 2, top, bw, Math.max(1, bot - top));
  });
  // media a 20 barre
  const m = sma(bars, 20);
  c.strokeStyle = '#3a63c4'; c.lineWidth = 1.5; c.beginPath();
  let started = false;
  m.forEach((v, i) => { if (v === null) return; const x = i * slot + slot / 2; if (!started) { c.moveTo(x, y(v)); started = true; } else c.lineTo(x, y(v)); });
  c.stroke();
  // riferimento (prezzo di carico ecc.)
  if (marker && marker.price > 0) {
    c.strokeStyle = '#8a6d1f'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(0, y(marker.price)); c.lineTo(W - padR, y(marker.price)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#8a6d1f'; c.fillText(marker.label, 4, y(marker.price) - 3);
  }
  // ultimo prezzo
  const last = bars[n - 1].c;
  c.fillStyle = '#1d1d2b'; c.font = 'bold 11px sans-serif'; c.fillText(last >= 1000 ? last.toFixed(0) : last >= 10 ? last.toFixed(2) : last.toFixed(4), W - padR + 4, y(last) + 4);
  c.fillStyle = '#3a63c4'; c.font = '11px sans-serif'; c.fillText(T('— media 20 barre'), 6, H - 5);
}

export function openChart(o: ChartOpts): Promise<void> {
  return modal<void>(`Grafico · ${o.title}`, ({ body, button, close }) => {
    let tf: Timeframe = o.tf ?? '1g';
    const cv = el('canvas') as HTMLCanvasElement;
    cv.width = 640; cv.height = 280; cv.style.width = '100%'; cv.style.maxWidth = '640px'; cv.style.imageRendering = 'auto';
    const head = el('p', 'small', '');
    const read = el('div', 'small', '');
    body.append(head, cv, o.note ? el('p', 'small muted', esc(o.note)) : el('span'), read, el('p', 'small muted', T('Lettura didattica, non un consiglio: la decisione resta tua. Il grafico racconta il passato; i fondamentali e il tuo piano decidono il futuro.')));
    const tfBtns: HTMLButtonElement[] = [];
    const show = async () => {
      head.innerHTML = T`Orizzonte: <b>${TF_LABEL[tf]}</b> <span class="muted">(frecce ← → per cambiare, A per confermare)</span>`;
      read.innerHTML = T('<span class="muted">Carico…</span>');
      tfBtns.forEach((b) => b.classList.toggle('primary', b.dataset.tf === tf));
      let bars: Candle[] = [];
      try { bars = await o.load(tf); } catch (e) { read.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; draw(cv, []); return; }
      draw(cv, bars, o.marker);
      const r = reading(bars, tf);
      read.innerHTML = T`<p style="margin:6px 0 0"><b>Lettura ${r.trend === 'su' ? '📈' : r.trend === 'giu' ? '📉' : '↔️'}</b></p>` + r.lines.map((l) => `<p style="margin:4px 0 0">${esc(l)}</p>`).join('');
    };
    for (const t of TIMEFRAMES) {
      const b = button(TF_LABEL[t], () => { tf = t; void show(); });
      b.dataset.tf = t;
      tfBtns.push(b);
    }
    button(T('Chiudi'), () => close(), '');
    void show();
  }, { wide: true }).then(() => undefined);
}
