// Caricamento a tema: mentre il gioco aspetta il servizio dei salvataggi (accesso, nuovo giocatore, partita,
// uscita, cancellazione) sopra lo schermo compare un piccolo grafico a candele che si disegna da solo.
// Compare solo se l'attesa supera un attimo (niente lampi per le risposte veloci), resta visibile almeno
// un momento quando compare, e per tutta l'attesa blocca tasti, tocchi e campi di testo sotto.
import { el, esc, getStage } from './core';
import { pushHandler, popHandler } from './input';
import { T } from '../i18n';

/** Dopo quanto compare (ms): sotto questa soglia l'attesa non si nota. */
export const SHOW_AFTER = 220;
/** Quanto resta almeno, una volta comparso (ms): evita un lampo illeggibile. */
export const MIN_VISIBLE = 520;
/** Dopo quanto l'attesa è lunga (ms): sotto il grafico compare un avviso sulla connessione. */
export const SLOW_AFTER = 10_000;

// Andamento delle candele (dal basso: apertura, chiusura; min e max per lo stoppino), in unità della griglia 0-12.
// Sale con una correzione a metà: il grafico di chi aspetta con pazienza.
const CANDLES: [number, number, number, number][] = [
  [3, 5, 2, 6], [5, 4, 3, 6], [4, 7, 4, 8], [7, 6, 5, 8], [6, 9, 5, 10], [9, 8, 7, 10], [8, 11, 8, 12],
];

interface Job { label: string }
const jobs: Job[] = [];
let wrap: HTMLElement | null = null;
let labelEl: HTMLElement | null = null;
let slowEl: HTMLElement | null = null;
let slowTimer = 0;
let showTimer = 0;
let shownAt = 0;
let restoreFocus: HTMLElement | null = null;
const swallow = () => true;
let paused = 0;

// Finché si aspetta nessun tasto arriva al gioco, ai campi di testo o alle impostazioni (Esc):
// si intercetta prima di tutti gli altri ascoltatori. Restano liberi solo i tasti di sistema del browser.
function blockKeys(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
function lock(): void { pushHandler(swallow); window.addEventListener('keydown', blockKeys, true); }
function unlock(): void { popHandler(swallow); window.removeEventListener('keydown', blockKeys, true); }

function chart(): string {
  const cs = CANDLES.map(([o, c, lo, hi], i) => {
    const up = c >= o;
    const body0 = Math.min(o, c), body1 = Math.max(o, c);
    // posizioni in percentuale dell'altezza del riquadro (12 unità)
    const v = (n: number) => `${(n / 12) * 100}%`;
    return `<i class="cdl ${up ? 'up' : 'dn'}" style="--i:${i};--lo:${v(lo)};--hi:${v(hi)};--b0:${v(body0)};--b1:${v(body1 === body0 ? body0 + 0.5 : body1)}"></i>`;
  }).join('');
  return `<div class="ld-screen" aria-hidden="true"><div class="ld-grid"></div>${cs}</div>`;
}

function mount(): void {
  const stage = getStage();
  if (!stage || wrap) return;
  wrap = el('div', 'loading-wrap');
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-live', 'polite');
  wrap.tabIndex = -1;
  const box = el('div', 'box loading', chart());
  labelEl = el('p', 'ld-label');
  slowEl = el('p', 'ld-slow small muted', T('Ci vuole più del solito: controlla la connessione.'));
  slowEl.hidden = true;
  box.append(labelEl, slowEl);
  slowTimer = window.setTimeout(() => { if (slowEl) slowEl.hidden = false; }, SLOW_AFTER - SHOW_AFTER);
  wrap.appendChild(box);
  // nessun tocco o clic deve arrivare alla finestra sotto
  for (const ev of ['click', 'pointerdown', 'touchstart'] as const) wrap.addEventListener(ev, (e) => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
  stage.appendChild(wrap);
  shownAt = performance.now();
  render();
  // il campo di testo attivo perde il fuoco: Invio non può ripartire una seconda richiesta
  const act = document.activeElement as HTMLElement | null;
  restoreFocus = act && act !== document.body ? act : null;
  wrap.focus({ preventScroll: true });
}

function unmount(): void {
  if (!wrap) return;
  clearTimeout(slowTimer);
  wrap.remove();
  wrap = labelEl = slowEl = null;
  const f = restoreFocus;
  restoreFocus = null;
  if (f && f.isConnected) f.focus({ preventScroll: true });
}

function render(): void {
  if (!labelEl) return;
  const top = jobs[jobs.length - 1];
  labelEl.innerHTML = top ? `${esc(top.label)}<span class="ld-dots"></span>` : '';
}

/** Il caricamento è visibile adesso? (per i test) */
export function loadingVisible(): boolean { return !!wrap; }

/**
 * Esegue `work` mostrando il caricamento con `label` se l'attesa si allunga.
 * Le attese annidate condividono lo stesso riquadro; si chiude quando finisce l'ultima.
 */
export async function busy<T>(label: string, work: Promise<T> | (() => Promise<T>)): Promise<T> {
  const job: Job = { label };
  jobs.push(job);
  if (jobs.length === 1) {
    lock();
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => { if (jobs.length && !paused) mount(); }, SHOW_AFTER);
  } else render();
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    const i = jobs.lastIndexOf(job);
    if (i >= 0) jobs.splice(i, 1);
    if (!jobs.length) {
      clearTimeout(showTimer);
      unlock();
      if (wrap) {
        const left = MIN_VISIBLE - (performance.now() - shownAt);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
        if (!jobs.length) unmount();
      }
    } else render();
  }
}

/**
 * Durante un caricamento serve una scelta del giocatore (per esempio quale partita tenere):
 * il riquadro si toglie, la domanda si usa normalmente, poi il caricamento riprende.
 */
export async function pauseBusy<T>(ask: () => Promise<T>): Promise<T> {
  const active = jobs.length > 0;
  paused++;
  if (active) { clearTimeout(showTimer); unlock(); unmount(); }
  try { return await ask(); } finally {
    paused--;
    if (active && jobs.length && !paused) { lock(); showTimer = window.setTimeout(() => { if (jobs.length && !paused) mount(); }, SHOW_AFTER); }
  }
}
