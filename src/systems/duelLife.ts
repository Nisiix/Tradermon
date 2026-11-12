// Vita del giocatore nei duelli a quiz, speculare alla Convinzione dell'avversario.
// L'avversario perde 100 / (risposte giuste richieste) a ogni risposta giusta e arriva a zero con l'ultima che serve.
// Il giocatore perde 100 / (errori concessi + 1) a ogni errore: arriva a zero con l'errore che rende la vittoria
// impossibile, cioè quando le risposte giuste ancora possibili non bastano più.

/** Errori che si possono fare senza perdere: domande − risposte giuste richieste. */
export function errorsAllowed(questions: number, need: number): number {
  return Math.max(0, questions - need);
}

/** Vita persa per ogni errore, su 100. */
export function lifeStep(questions: number, need: number): number {
  return 100 / (errorsAllowed(questions, need) + 1);
}

/**
 * Vita dopo un errore. `wrongs` conta anche l'errore appena fatto.
 * Oltre gli errori concessi la sfida è persa e la barra va a zero anche se partiva sotto il massimo o era risalita.
 */
export function lifeAfterWrong(life: number, wrongs: number, questions: number, need: number): number {
  if (wrongs > errorsAllowed(questions, need)) return 0;
  return Math.max(0, life - lifeStep(questions, need));
}

/** Valore intero da mostrare e salvare: arrotondato per eccesso, così lo zero compare solo a sfida persa. */
export function lifeShown(life: number): number {
  return life <= 0 ? 0 : Math.min(100, Math.ceil(life - 1e-9));
}

/**
 * Errori che si possono ancora fare senza perdere: i concessi rimasti, ma meno se la vita (la Fiducia di partenza)
 * finisce prima. Così l'etichetta sotto la barra dice sempre il vero.
 */
export function errorsLeft(life: number, wrongs: number, questions: number, need: number): number {
  const byRule = Math.max(0, errorsAllowed(questions, need) - wrongs);
  if (lifeShown(life) <= 0) return 0;
  const byLife = Math.ceil(life / lifeStep(questions, need) - 1e-9) - 1;
  return Math.max(0, Math.min(byRule, byLife));
}
