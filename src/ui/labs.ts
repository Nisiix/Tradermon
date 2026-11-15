// Laboratori della Banca: tre esperimenti con i cursori, per vedere un'idea muoversi invece di leggerla soltanto.
// Il gioco fa i conti, il giocatore sposta i cursori e guarda la forma: niente quiz, niente premi, nessun consiglio.
// - Interesse composto e costi: lo stesso rendimento con costi annui diversi, anno dopo anno.
// - Diversificazione: quanto oscilla un portafoglio di titoli simili, secondo quanti sono e quanto si muovono insieme.
// - Drawdown e recupero: dopo una perdita, quanto deve salire il prezzo per tornare al punto di partenza.
// I cursori sono controlli nativi: si spostano con le frecce (Tab per passare dall'uno all'altro).
import { modal, choose, el } from './core';
import { T, LOCALE } from '../i18n';

const pct = (v: number, d = 0) => `${(v * 100).toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const money = (v: number) => `${Math.round(v).toLocaleString(LOCALE)} $`;

const W = 320, H = 150, X0 = 34, Y0 = 125, X1 = 310, Y1 = 12;
const svg = (inner: string, label: string) => `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label.replace(/"/g, '&quot;')}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const axis = `<line class="fig-ax" x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}"/><line class="fig-ax" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}"/>`;
const t = (x: number, y: number, s: string, anchor = 'middle', cls = 'fig-t') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const poly = (pts: [number, number][], cls: string) => `<polyline class="${cls}" points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/>`;

interface Slider { key: string; label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string }

/** Una finestra con cursori, un grafico e una frase che si aggiornano insieme. */
function lab(title: string, intro: string, sliders: Slider[], draw: (v: Record<string, number>) => { svg: string; text: string }): Promise<void> {
  return modal(title, ({ body, button, close }) => {
    body.appendChild(el('p', 'small', intro));
    const vals: Record<string, number> = Object.fromEntries(sliders.map((s) => [s.key, s.value]));
    const out = el('div', 'lab-out');
    const note = el('p', 'small lab-note');
    const inputs: HTMLInputElement[] = [];
    const render = () => { const r = draw(vals); out.innerHTML = r.svg; note.textContent = r.text; };
    for (const s of sliders) {
      const row = el('label', 'lab-row');
      const name = el('span', 'lab-name', s.label);
      const val = el('b', 'lab-val', s.fmt(s.value));
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = String(s.min); inp.max = String(s.max); inp.step = String(s.step); inp.value = String(s.value);
      inp.setAttribute('aria-label', s.label);
      inp.addEventListener('input', () => { vals[s.key] = Number(inp.value); val.textContent = s.fmt(vals[s.key]); render(); });
      row.append(name, inp, val);
      body.appendChild(row);
      inputs.push(inp);
    }
    body.append(out, note);
    render();
    button(T('Chiudi'), () => close(), 'primary');
    setTimeout(() => inputs[0]?.focus(), 30);
  }, { wide: true, cls: 'lab' });
}

/** Valore anno per anno di 10.000 $ investiti con un rendimento lordo e un costo annuo. */
export function compoundPath(gross: number, cost: number, years: number, start = 10000): number[] {
  const out = [start];
  for (let y = 1; y <= years; y++) out.push(out[y - 1] * (1 + gross - cost));
  return out;
}

function compoundLab() {
  return lab(T('Laboratorio: interesse composto e costi'), T('Diecimila dollari investiti, nessun versamento in più. Sposta i cursori e guarda come cambia la curva: quella tratteggiata non ha costi, quella continua paga ogni anno il costo scelto.'), [
    { key: 'r', label: T('Rendimento lordo annuo'), min: 0, max: 10, step: 0.5, value: 6, fmt: (v) => pct(v / 100, 1) },
    { key: 'c', label: T('Costi annui'), min: 0, max: 3, step: 0.1, value: 1.5, fmt: (v) => pct(v / 100, 1) },
    { key: 'y', label: T('Anni'), min: 5, max: 40, step: 1, value: 30, fmt: (v) => T`${v} anni` },
  ], (v) => {
    const free = compoundPath(v.r / 100, 0, v.y), net = compoundPath(v.r / 100, v.c / 100, v.y);
    const top = Math.max(...free) * 1.05;
    const xy = (i: number, val: number): [number, number] => [X0 + (i / v.y) * (X1 - X0), Y0 - (val / top) * (Y0 - Y1)];
    const lost = free[v.y] - net[v.y];
    const svgs = svg(axis + poly(free.map((x, i) => xy(i, x)), 'fig-l fig-soft') + poly(net.map((x, i) => xy(i, x)), 'fig-l')
      + t(X0 + 8, Y1 + 8, T`senza costi: ${money(free[v.y])}`, 'start') + t(X0 + 8, Y1 + 24, T`con i costi: ${money(net[v.y])}`, 'start', 'fig-t bad')
      + t(X0 + 4, Y0 + 14, T('oggi'), 'start') + t(X1, Y0 + 14, T`tra ${v.y} anni`, 'end'), T('Interesse composto con e senza costi'));
    return { svg: svgs, text: lost > 0 ? T`Con costi del ${pct(v.c / 100, 1)} l'anno, dopo ${v.y} anni mancano ${money(lost)}: il ${pct(lost / free[v.y])} di ciò che avresti avuto senza costi. I costi si compongono come i rendimenti.` : T('Senza costi le due curve coincidono.') };
  });
}

/** Oscillazione di un portafoglio di n titoli uguali, ciascuno con volatilità sigma e correlazione media rho. */
export function portfolioVol(n: number, sigma: number, rho: number): number {
  return sigma * Math.sqrt(rho + (1 - rho) / n);
}

function diversificationLab() {
  const SIGMA = 0.3;
  return lab(T('Laboratorio: diversificazione'), T('Titoli che oscillano tutti allo stesso modo, pesi uguali. Aggiungi titoli e cambia quanto si muovono insieme: la curva mostra quanto oscilla il portafoglio intero.'), [
    { key: 'n', label: T('Numero di titoli'), min: 1, max: 50, step: 1, value: 5, fmt: (v) => String(v) },
    { key: 'rho', label: T('Quanto si muovono insieme (correlazione)'), min: 0, max: 100, step: 5, value: 30, fmt: (v) => (v / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2 }) },
  ], (v) => {
    const rho = v.rho / 100;
    const xy = (n: number, s: number): [number, number] => [X0 + ((n - 1) / 49) * (X1 - X0), Y0 - (s / SIGMA) * (Y0 - Y1)];
    const curve = Array.from({ length: 50 }, (_, i) => xy(i + 1, portfolioVol(i + 1, SIGMA, rho)));
    const floor = portfolioVol(1e9, SIGMA, rho);
    const now = portfolioVol(v.n, SIGMA, rho);
    const [cx, cy] = xy(v.n, now);
    const fy = xy(1, floor)[1];
    const svgs = svg(axis + `<line class="fig-dash" x1="${X0}" y1="${fy.toFixed(1)}" x2="${X1}" y2="${fy.toFixed(1)}"/>` + poly(curve, 'fig-l')
      + `<circle class="fig-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"/>` + t(X1, Math.min(Y0 - 4, fy + 13), T('rischio di mercato: non si toglie'), 'end', 'fig-t bad')
      + t(X0 + 4, Y0 + 14, T('1 titolo'), 'start') + t(X1, Y0 + 14, T('50 titoli'), 'end'), T('Oscillazione del portafoglio secondo il numero di titoli'));
    return { svg: svgs, text: T`Con ${v.n} titoli il portafoglio oscilla del ${pct(now)} l'anno, contro il ${pct(SIGMA)} di un titolo solo. Oltre una certa soglia aggiungere titoli serve poco: resta il rischio che li colpisce tutti insieme, più alto quanto più si muovono insieme.` };
  });
}

/** Rialzo necessario per recuperare una perdita: dopo −L serve +L/(1−L). */
export function recoveryNeeded(loss: number): number {
  return loss >= 1 ? Infinity : loss / (1 - loss);
}

function drawdownLab() {
  return lab(T('Laboratorio: drawdown e recupero'), T('Dopo una caduta, il recupero parte da più in basso: per tornare al punto di partenza serve un rialzo più grande della perdita. Sposta il cursore e guarda le due barre.'), [
    { key: 'l', label: T('Perdita'), min: 5, max: 90, step: 5, value: 30, fmt: (v) => `−${v}%` },
  ], (v) => {
    const loss = v.l / 100, need = recoveryNeeded(loss);
    const scale = (Y0 - Y1) / Math.max(1, Math.min(need, 9));
    const hL = Math.min(Y0 - Y1, loss * scale), hN = Math.min(Y0 - Y1, need * scale);
    const svgs = svg(axis + `<rect class="fig-down" x="80" y="${(Y0 - hL).toFixed(1)}" width="60" height="${hL.toFixed(1)}"/><rect class="fig-up" x="190" y="${(Y0 - hN).toFixed(1)}" width="60" height="${hN.toFixed(1)}"/>`
      + t(110, Y0 - hL - 4, `−${pct(loss)}`) + t(220, Math.max(Y1 + 10, Y0 - hN - 4), `+${pct(need)}`)
      + t(110, Y0 + 14, T('perdita')) + t(220, Y0 + 14, T('rialzo per recuperare')), T('Perdita e rialzo necessario per recuperarla'));
    return { svg: svgs, text: T`Dopo −${pct(loss)} serve +${pct(need)} per tornare dove eri. Per questo evitare le grandi cadute conta più che inseguire i grandi rialzi.` };
  });
}

/** Il bancone dei laboratori. */
export async function openLabs(who: string) {
  for (;;) {
    const c = await choose([T('Interesse composto e costi'), T('Diversificazione'), T('Drawdown e recupero'), T('Basta così')], { cancel: true, prompt: T('Tre laboratori con i cursori: il conto lo faccio io, tu guardi che forma prende l\'idea. Quale vuoi provare?'), who });
    if (c === 0) await compoundLab();
    else if (c === 1) await diversificationLab();
    else if (c === 2) await drawdownLab();
    else return;
  }
}
