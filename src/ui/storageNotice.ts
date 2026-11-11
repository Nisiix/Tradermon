import { modal } from './core';

// Safari cancella i dati dei siti (accesso, copia locale della partita, chiave della cassaforte) se il sito
// non viene aperto per circa 7 giorni. Non vale per il gioco installato sulla schermata Home.
// La partita vera è su Supabase: l'avviso spiega che basta rientrare con nome e password.
export function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edgios|edg\/|opr\/|android/i.test(ua);
}
function installedApp(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
export function safariAtRisk(): boolean { return isSafari() && !installedApp(); }

export const SAFARI_TEXT = 'Stai usando <b>Safari</b>: se non apri Tradermon per circa <b>7 giorni</b>, Safari può cancellare i dati del sito su questo dispositivo. La tua partita è al sicuro su Supabase: dovrai solo rientrare con <b>nome giocatore e password</b> (la password serve anche a sbloccare le chiavi Alpaca). Si perderebbero solo i progressi non ancora inviati perché eri senza rete.';

const SEEN = 'tradermon.safariNoticeSeen';
/** Mostra l'avviso una sola volta per browser, solo su Safari. */
export async function safariNoticeOnce(): Promise<void> {
  if (!safariAtRisk()) return;
  try { if (localStorage.getItem(SEEN) === '1') return; } catch { return; }
  await modal('Salvataggi su Safari', ({ body, button, close }) => {
    body.innerHTML = `<p>${SAFARI_TEXT}</p>`;
    button('Ho capito', () => close());
  });
  try { localStorage.setItem(SEEN, '1'); } catch { /* storage non disponibile */ }
}
