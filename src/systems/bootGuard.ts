// Ponte verso il guardiano dell'avvio (public/boot.js, caricato prima del gioco): toglie "Caricamento…"
// quando la prima schermata c'è e gli passa i problemi seri trovati dopo l'avvio, che mostra in una striscia.
type Boot = {
  alive?(): void; ready(): void; step?(p: number | undefined, text?: string, to?: number, ms?: number): void; show?(text: string, limitMs?: number): void; visible?(): boolean;
  report(e: unknown): void; note(e: unknown): void; details(): string;
};
const boot = (): Boot | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { __tradermonBoot?: Boot }).__tradermonBoot);

/** La prima schermata del gioco è visibile: via la schermata di caricamento. */
export function bootReady() { boot()?.ready(); }
/** Il codice del gioco è partito: il guardiano smette di contare (la schermata di caricamento resta). */
export function bootAlive() { const b = boot(); if (b?.alive) b.alive(); }
/**
 * Avanzamento della schermata di caricamento (0..1) con il passo in corso. `to` e `ms`: se il passo dura, la barra
 * avanza da sola fino a `to` in `ms` (anche mentre il passo tiene occupata la pagina).
 */
export function bootStep(p: number | undefined, text?: string, to?: number, ms?: number) { boot()?.step?.(p, text, to, ms); }
/** Rimette la schermata di caricamento (preparazione del mondo dopo il titolo). */
export function bootShow(text: string, limitMs?: number) { boot()?.show?.(text, limitMs); }
/** La schermata di caricamento è visibile adesso? */
export function bootVisible(): boolean { return !!boot()?.visible?.(); }
/** Lascia al browser il tempo di mostrare l'avanzamento prima del prossimo passo pesante (due fotogrammi). */
export function nextPaint(): Promise<void> {
  return new Promise((r) => {
    let done = false;
    const go = () => { if (!done) { done = true; r(); } };
    // la pagina nascosta non disegna fotogrammi: allora basta un attimo
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 120);
  });
}
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

const FX_AUTO = 'tradermon.fxAuto';
/** La fluidità con gli effetti alti è già stata misurata su questo dispositivo (si misura una volta sola). */
export function fxAutoDone(): boolean { try { return localStorage.getItem(FX_AUTO) === '1'; } catch { return true; } }
export function setFxAutoDone() { try { localStorage.setItem(FX_AUTO, '1'); } catch { /* niente */ } }
