// Telefoni e tablet: il gioco si usa solo in orizzontale.
// - In verticale un pannello copre lo schermo e chiede di ruotare il telefono (solo CSS: vedi .rotate-ov).
// - Al primo tocco si prova a passare a schermo intero e a bloccare l'orientamento in orizzontale
//   (Screen Orientation API: funziona su Android/Chrome; su iPhone resta il pannello "ruota").
// - Quando cambiano i comandi touch o l'orientamento, il canvas di Phaser viene riadattato.
import { el } from './core';
import { isTouchDevice, onPrefsChange } from '../systems/controls';
import { T } from '../i18n';

type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** true se il browser permette lo schermo intero (non c'è, per esempio, su iPhone). */
export function fullscreenSupported(): boolean {
  const d = document.documentElement as FsEl;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen) && (document.fullscreenEnabled ?? true);
}
export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

async function lockLandscape(): Promise<void> {
  try { await (screen.orientation as OrientationLock | undefined)?.lock?.('landscape'); } catch { /* non supportato o non a schermo intero */ }
}

/** Schermo intero + blocco in orizzontale. Va chiamata dentro un tocco o un clic. */
export async function enterFullscreen(): Promise<void> {
  const d = document.documentElement as FsEl;
  try {
    if (!isFullscreen()) {
      if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' });
      else await d.webkitRequestFullscreen?.();
    }
  } catch { /* rifiutato dal browser */ }
  await lockLandscape();
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
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

  // Al primo tocco: schermo intero e blocco in orizzontale (una sola volta, per non insistere
  // se il giocatore esce di proposito dallo schermo intero; resta il comando nelle impostazioni).
  if (isTouchDevice() && fullscreenSupported()) {
    const first = () => {
      window.removeEventListener('pointerup', first, true);
      if (!isFullscreen()) void enterFullscreen();
    };
    window.addEventListener('pointerup', first, true);
  }
  // in un'app installata o già a schermo intero il blocco funziona anche senza tocco
  void lockLandscape();

  onPrefsChange(refit);
  window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', refit);
  document.addEventListener('fullscreenchange', refit);
}
