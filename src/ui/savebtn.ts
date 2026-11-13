// Salvataggi automatici: il gioco salva da solo quando entri o esci da un edificio e dopo ogni sfida a quiz
// con un personaggio (vinta o persa). A mano si salva dal menu di gioco, voce "Salva".

let duelDone = false;
/** Segnala che una sfida a quiz è finita: lo script in corso salverà alla sua chiusura. */
export function markDuelDone(): void { duelDone = true; }
/** Legge e azzera il segnale. */
export function takeDuelDone(): boolean { const d = duelDone; duelDone = false; return d; }
