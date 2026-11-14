// Ponte verso il guardiano dell'avvio (public/boot.js, caricato prima del gioco): toglie "Caricamento…"
// quando la prima schermata c'è e gli passa i problemi seri trovati dopo l'avvio, che mostra in una striscia.
type Boot = { ready(): void; report(e: unknown): void; note(e: unknown): void; details(): string };
const boot = (): Boot | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { __tradermonBoot?: Boot }).__tradermonBoot);

/** La prima schermata del gioco è visibile. */
export function bootReady() { boot()?.ready(); }
/** Segnala un problema serio (resta leggibile sullo schermo del telefono). */
export function reportProblem(e: unknown) { console.error(e); boot()?.report(e); }
/** Annota un problema che il gioco ha già risolto da solo (niente striscia: basta l'avviso del gioco). */
export function noteProblem(e: unknown) { console.warn(e); boot()?.note(e); }

const NO3D = 'tradermon.no3d';
/** La resa 2.5D ha già dato schermo nero su questo dispositivo (o il giocatore ha scelto la grafica semplificata). */
export function no3dStored(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('gfx');
    if (q === '2d') return true;
    if (q === '3d') return false;
    return localStorage.getItem(NO3D) === '1';
  } catch { return false; }
}
export function setNo3dStored(on: boolean) {
  try { if (on) localStorage.setItem(NO3D, '1'); else localStorage.removeItem(NO3D); } catch { /* niente */ }
}
