// Telefoni e tablet: il gioco si usa solo in orizzontale e a schermo intero.
// - In verticale un pannello copre lo schermo e chiede di ruotare il telefono (solo CSS: vedi .rotate-ov).
// - Dalla landing, "Gioca" su un telefono apre il gioco in una cornice a schermo intero già bloccata in
//   orizzontale (src/shell.ts): il gioco lo riconosce e usa la cornice per entrare e uscire dallo schermo intero.
// - Entrando direttamente nel gioco, ogni tocco mentre non si è a schermo intero ci riporta lo schermo
//   (Screen Orientation API: funziona su Android/Chrome; su iPhone resta il pannello "ruota"), a meno che il
//   giocatore non sia uscito di proposito dalle impostazioni ⚙.
// - Quando cambiano i comandi touch o l'orientamento, il canvas di Phaser viene riadattato.
import { el } from './core';
import { isTouchDevice, onPrefsChange } from '../systems/controls';
import { T } from '../i18n';

type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void>; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** Il giocatore è uscito di proposito dallo schermo intero: non lo si riattiva da solo fino alla prossima visita. */
const OPT_OUT = 'tradermon.fsOff';

/**
 * Documento e elemento da mettere a schermo intero: la cornice della landing se il gioco gira lì dentro
 * (stesso sito), altrimenti la pagina del gioco.
 */
function host(): { doc: FsDoc; el: FsEl; win: Window } {
  try {
    if (window.parent !== window) {
      const frame = window.frameElement as HTMLElement | null;
      const shell = frame?.closest('.play-shell') as FsEl | null;
      if (shell) return { doc: window.parent.document as FsDoc, el: shell, win: window.parent };
    }
  } catch { /* cornice di un altro sito: si usa la pagina del gioco */ }
  return { doc: document as FsDoc, el: document.documentElement as FsEl, win: window };
}

/** true se il gioco gira nella cornice a schermo intero della landing. */
export function inShell(): boolean { return host().win !== window; }

/** true se il browser permette lo schermo intero (non c'è, per esempio, su iPhone). */
export function fullscreenSupported(): boolean {
  const { doc, el: e } = host();
  return !!(e.requestFullscreen || e.webkitRequestFullscreen) && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true);
}
export function isFullscreen(): boolean {
  const { doc } = host();
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function lockLandscape(): Promise<void> {
  try { await (host().win.screen.orientation as OrientationLock | undefined)?.lock?.('landscape'); } catch { /* non supportato o non a schermo intero */ }
}

function optedOut(): boolean { try { return sessionStorage.getItem(OPT_OUT) === '1'; } catch { return false; } }
function setOptOut(on: boolean) { try { if (on) sessionStorage.setItem(OPT_OUT, '1'); else sessionStorage.removeItem(OPT_OUT); } catch { /* niente */ } }

/** Schermo intero + blocco in orizzontale. Va chiamata dentro un tocco o un clic. */
export async function enterFullscreen(): Promise<void> {
  setOptOut(false);
  const { el: e } = host();
  try {
    if (!isFullscreen()) {
      if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' });
      else await e.webkitRequestFullscreen?.();
    }
  } catch { /* rifiutato dal browser */ }
  await lockLandscape();
}

/** Uscita voluta (dalle impostazioni): il gioco smette di riattivare lo schermo intero da solo. */
export async function exitFullscreen(): Promise<void> {
  setOptOut(true);
  const { doc } = host();
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch { /* già uscito */ }
}

/** Fa ricalcolare a Phaser le dimensioni del canvas (cambiano i margini per i comandi touch). */
function refit() {
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

export function initMobile() {
  const ov = el('div', 'rotate-ov', T`
    <div class="rot-phone" aria-hidden="true"><i></i></div>
    <p><b>Ruota il telefono</b></p>
    <p class="small">Tradermon si gioca in orizzontale.</p>`);
  ov.setAttribute('role', 'alert');
  if (fullscreenSupported()) {
    const b = el('button', 'btn primary', T('Schermo intero'));
    b.addEventListener('click', () => { void enterFullscreen(); });
    ov.appendChild(b);
  }
  document.body.appendChild(ov);
  document.body.classList.toggle('is-touch', isTouchDevice());
  document.body.classList.toggle('in-shell', inShell());

  // Ogni tocco mentre non si è a schermo intero lo riattiva (il browser lo chiede dentro un gesto):
  // così basta toccare lo schermo dopo l'arrivo o dopo che il telefono ha chiuso lo schermo intero
  // (gesto "indietro", notifica, cambio app). Il tocco fa anche la sua azione normale.
  if (isTouchDevice() && fullscreenSupported()) {
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || optedOut() || isFullscreen()) return;
      void enterFullscreen();
    }, true);
  }
  // in un'app installata o già a schermo intero il blocco funziona anche senza tocco
  void lockLandscape();

  onPrefsChange(refit);
  window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', refit);
  host().doc.addEventListener('fullscreenchange', refit);
}
