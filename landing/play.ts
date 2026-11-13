// "Gioca" sul telefono: il gioco si apre in una cornice a schermo intero bloccata in orizzontale.
// Lo schermo intero si perde cambiando pagina, quindi su telefono e tablet la landing non naviga verso
// /gioca/ ma lo carica in un iframe dentro un elemento già a schermo intero (il gesto è il tocco su "Gioca").
// Il gioco riconosce la cornice (.play-shell) e la usa per rientrare a schermo intero e per uscire alla home
// (src/ui/mobile.ts, src/systems/home.ts). Dove lo schermo intero non c'è (iPhone) si naviga normalmente.

type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
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
  const frame = document.createElement('iframe');
  frame.title = 'Tradermon';
  frame.allow = 'fullscreen; autoplay; screen-wake-lock';
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#101018;';
  shell.appendChild(frame);
  document.body.appendChild(shell);
  // la richiesta va fatta subito, prima di qualunque attesa, altrimenti il browser non vede più il tocco
  const req = shell.requestFullscreen ? shell.requestFullscreen({ navigationUI: 'hide' }) : shell.webkitRequestFullscreen?.();
  Promise.resolve(req).then(async () => {
    try { await (screen.orientation as OrientationLock).lock?.('landscape'); } catch { /* non supportato */ }
    document.documentElement.style.overflow = 'hidden';
    frame.addEventListener('load', () => frame.focus(), { once: true });
    frame.src = href;
  }, () => {
    // schermo intero rifiutato: si va al gioco come una pagina normale (lì il primo tocco ci riprova)
    shell.remove();
    location.href = href;
  });
  return true;
}
