// Domande sulle nozioni della Mamma (BASICS in world/scripts/story.ts): sono le sole che si chiedono dove non c'è
// ancora una Biblioteca, cioè nel Laboratorio con Leo e sul Percorso 1 prima di Ponte Cedola.
// Il numero è il gruppo di BASICS che spiega la domanda: 0 Le parole del viaggio, 1 Rischio, 2 Azioni ed ETF, 3 Cripto.
import { T } from '../../i18n';

/** Titoli dei gruppi di nozioni della Mamma, gli stessi di BASICS. */
export const MOM_GROUPS = () => [T('Le parole del viaggio'), T('Rischio'), T('Azioni ed ETF'), T('Cripto')];

// Chi aggiunge una domanda qui deve trovarne la spiegazione nelle righe della Mamma (vedi tests/domande-citta.test.ts).
export const MOM_QUESTIONS: Record<string, number> = {
  rischio_7: 0,
  rischio_1: 1, rischio_2: 1, rischio_19: 1, rischio_23: 1, rischio_9: 1, mixed_base_1: 1, mixed_base_13: 1,
  stocks_base_1: 2, stocks_base_2: 2, stocks_base_5: 2, stocks_base_9: 2, stocks_base_11: 2,
  etf_base_1: 2, etf_base_2: 2, etf_base_5: 2, etf_base_9: 2, etf_base_13: 2,
  crypto_base_1: 3, crypto_base_9: 3, crypto_base_5: 3, crypto_base_2: 3,
};

/**
 * Coppie di domande che chiedono la stessa cosa con parole quasi uguali (stessa risposta): per chi gioca sono la
 * stessa domanda. Non finiscono mai nello stesso duello e, vista una, l'altra conta come già vista.
 */
export const TWINS: [string, string][] = [
  ['ordini_4', 'etf_base_11'],
  ['analisi_7', 'stocks_base_11'],
  ['gestione_22', 'trading_1'],
  ['gestione_24', 'trading_2'],
  ['regole_29', 'grotte_ombra_9'],
];
const TWIN_OF: Record<string, string> = Object.fromEntries(TWINS.flatMap(([a, b]) => [[a, b], [b, a]]));
export const twinOf = (id: string): string | undefined => TWIN_OF[id];
