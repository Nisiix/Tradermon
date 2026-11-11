import { S, SAVE_KEY } from './state';

/** Tempo di gioco complessivo (S.playMs): conta solo mentre il gioco è in primo piano e
 *  viene scritto nel salvataggio anche senza "Salva", così sopravvive alla chiusura del browser. */

/** Oltre questo intervallo fra due fotogrammi il gioco era in pausa (scheda nascosta, PC sospeso): non si conta. */
const MAX_FRAME_MS = 1000;

export function addPlayTime(elapsed: number): void {
  if (!S || !(elapsed > 0)) return;
  S.playMs += Math.min(elapsed, MAX_FRAME_MS);
}

/** 3725000 → "01:02:05"; le ore superano 99 senza troncare. */
export function formatPlayTime(ms: number): string {
  const t = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Aggiorna solo il tempo di gioco del salvataggio già su disco, se appartiene alla partita in corso.
 *  Il resto dei progressi resta quello dell'ultimo salvataggio fatto dal giocatore. */
export function persistPlayTime(): void {
  if (!S) return;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || d.createdAt !== S.createdAt || (d.playMs ?? 0) >= S.playMs) return;
    d.playMs = Math.floor(S.playMs);
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch { /* spazio pieno o storage bloccato: si riprova al prossimo giro */ }
}

let started = false;
/** Salva il tempo ogni 15 s e quando la pagina viene nascosta o chiusa. */
export function startPlayTimeAutosave(): void {
  if (started) return;
  started = true;
  setInterval(persistPlayTime, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistPlayTime(); });
  window.addEventListener('pagehide', persistPlayTime);
}
