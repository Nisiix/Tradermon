// Pulsante Salva (icona del dischetto in alto a destra, accanto a ⚙) e salvataggi automatici.
// Il gioco salva da solo quando entri o esci da un edificio e dopo ogni sfida a quiz con un personaggio
// (vinta o persa); il pulsante salva in qualsiasi momento in cui non sei in un dialogo o in una sfida.
import { el, getStage, toast } from './core';
import { save } from '../systems/state';

let guard: () => boolean = () => false;

/** La scena del mondo dice quando è sicuro salvare (nessun dialogo, sfida o spostamento in corso). */
export function setSaveGuard(g: () => boolean): void { guard = g; }

let duelDone = false;
/** Segnala che una sfida a quiz è finita: lo script in corso salverà alla sua chiusura. */
export function markDuelDone(): void { duelDone = true; }
/** Legge e azzera il segnale. */
export function takeDuelDone(): boolean { const d = duelDone; duelDone = false; return d; }

export function quickSave(): boolean {
  if (!guard()) { toast('Puoi salvare appena finisce il dialogo o la sfida in corso.'); return false; }
  const ok = save();
  toast(ok ? 'Partita salvata.' : 'Salvataggio non riuscito: lo spazio del browser potrebbe essere pieno.');
  return ok;
}

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1h10l3 3v11H1V1h1zm2 1v4h7V2H4zm5 1h1v2H9V3zM3 9v5h10V9H3z"/></svg>';

export function initSaveButton(): void {
  if (document.querySelector('.save-btn')) return;
  const b = el('button', 'save-btn', ICON);
  b.title = 'Salva la partita';
  b.setAttribute('aria-label', 'Salva la partita');
  b.addEventListener('click', () => { quickSave(); (b as HTMLButtonElement).blur(); });
  getStage().appendChild(b);
}
