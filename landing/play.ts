// "Gioca" sul telefono: il gioco si apre in una cornice a schermo intero bloccata in orizzontale.
// Lo schermo intero si perde cambiando pagina, quindi su telefono e tablet la landing non naviga verso
// /gioca/ ma lo carica in un iframe dentro un elemento già a schermo intero (il gesto è il tocco su "Gioca").
// Il gioco riconosce la cornice (.play-shell) e la usa per rientrare a schermo intero e per uscire alla home
// (src/ui/mobile.ts, src/systems/home.ts). Dove lo schermo intero non c'è (iPhone) si naviga normalmente.

import { T } from '../src/i18n';

type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type OrientationLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** Telefono o tablet: schermo touch senza mouse (come isTouchDevice nel gioco). */
export function touchDevice(): boolean {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  return coarse || (navigator.maxTouchPoints > 0 && !fine);
}

function canFullscreen(e: FsEl): boolean {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(e.requestFullscreen || e.webkitRequestFullscreen) && (d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? true);
}

/**
 * Prova ad aprire il gioco a schermo intero nella cornice. Va chiamata dentro il clic su "Gioca".
 * false = non possibile qui: il chiamante naviga normalmente.
 */
export function playInShell(href: string): boolean {
  if (!touchDevice()) return false;
  const shell = document.createElement('div') as FsEl;
  shell.className = 'play-shell';
  shell.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#101018;';
  if (!canFullscreen(shell)) return false;
  // dietro al gioco, finché non disegna la sua prima schermata: senza, il telefono mostra solo nero mentre scarica
  const wait = document.createElement('p');
  wait.className = 'play-wait';
  wait.setAttribute('role', 'status');
  wait.textContent = T('Caricamento di Tradermon…');
  wait.style.cssText = 'position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;color:#f8d860;font:14px/1.5 monospace;text-align:center;padding:16px;';
  shell.appendChild(wait);
  const frame = document.createElement('iframe');
  frame.title = 'Tradermon';
  frame.allow = 'fullscreen; autoplay; screen-wake-lock';
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:transparent;';
  shell.appendChild(frame);
  document.body.appendChild(shell);
  document.body.classList.remove('menu-open');
  // una voce nella cronologia: il gesto "indietro" chiude la cornice e riporta alla pagina, invece di lasciarla
  // ferma sopra la landing (dopo il primo "indietro", che esce dallo schermo intero, la pagina sembrava bloccata)
  try { history.pushState({ tradermonShell: 1 }, ''); } catch { /* niente */ }
  // la richiesta va fatta subito, prima di qualunque attesa, altrimenti il browser non vede più il tocco
  let req: Promise<void> | undefined;
  try { req = shell.requestFullscreen ? shell.requestFullscreen({ navigationUI: 'hide' }) : shell.webkitRequestFullscreen?.(); } catch { req = Promise.reject(); }
  // il gioco si carica subito: se il telefono non risponde mai alla richiesta di schermo intero o di rotazione,
  // la cornice non resta comunque vuota e bloccata sopra la pagina
  document.documentElement.style.overflow = 'hidden';
  frame.addEventListener('load', () => frame.focus(), { once: true });
  frame.src = href;
  Promise.resolve(req).then(() => {
    // la rotazione non si aspetta: su alcuni telefoni la promessa non si chiude mai
    try { void (screen.orientation as OrientationLock).lock?.('landscape')?.catch(() => undefined); } catch { /* non supportato */ }
  }, () => {
    // schermo intero rifiutato: si va al gioco come una pagina normale (lì il primo tocco ci riprova)
    closeShell(true);
    location.href = href;
  });
  return true;
}

/** Chiude la cornice del gioco e ridà la pagina. `back` false: toglie anche la voce aggiunta alla cronologia. */
export function closeShell(back = true): void {
  const shell = document.querySelector('.play-shell');
  if (!shell) return;
  shell.remove();
  document.documentElement.style.overflow = '';
  const d = document as FsDoc;
  try { if (d.fullscreenElement || d.webkitFullscreenElement) void (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())?.catch?.(() => undefined); } catch { /* già uscito */ }
  try { (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.(); } catch { /* non supportato */ }
  try { dispatchEvent(new Event('tradermon:shell-closed')); } catch { /* fuori dal browser */ } // la landing riprende le animazioni
  if (!back) { try { if ((history.state as { tradermonShell?: number } | null)?.tradermonShell) history.back(); } catch { /* niente */ } }
}

if (typeof addEventListener === 'function') addEventListener('popstate', () => closeShell(true));

/** true mentre il gioco è aperto nella cornice: la landing sotto smette di animarsi. */
export function shellOpen(): boolean {
  return !!document.querySelector('.play-shell');
}
