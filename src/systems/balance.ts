import type { Difficulty } from '../types';

// Tabella unica di bilanciamento: duelli (domande, risposte richieste, danno alla Fiducia) e ricompense.
// Cambiare qui un numero cambia il gioco ovunque: niente valori sparsi negli script.

export interface DuelPreset {
  /** Numero di domande. */
  n: number;
  /** Risposte giuste richieste per vincere. */
  need: number;
  /** Fiducia persa per ogni errore (0 = sfida senza rischio, la Fiducia resta com'era). */
  damage: number;
  /** Sfida a numero fisso: si rispondono tutte le domande (Mentori, Lega), ma a Fiducia zero si va in tilt. */
  fixed?: boolean;
}

/** Fiducia recuperata con ogni risposta giusta nei duelli con danno: studiare tiene in piedi. */
export const FIDUCIA_PER_CORRECT = 4;

export const DUEL = {
  trainer: { n: 3, need: 2, damage: 25 },
  rematch: { n: 3, need: 2, damage: 25 },
  student: { n: 4, need: 3, damage: 20 },
  rivalFirst: { n: 5, need: 3, damage: 20 },
  rival: { n: 5, need: 4, damage: 20 },
  speculator: { n: 3, need: 2, damage: 20 },
  boss: { n: 6, need: 5, damage: 18 },
  mentor: { n: 8, need: 6, damage: 15, fixed: true },
  mentorRematch: { n: 8, need: 7, damage: 15, fixed: true },
  league: { n: 10, need: 8, damage: 12, fixed: true },
  champion: { n: 12, need: 10, damage: 10, fixed: true },
  tower: { n: 3, need: 3, damage: 34 },
  quest: { n: 3, need: 2, damage: 5 },
  hermit: { n: 5, need: 4, damage: 0 },
  legend: { n: 5, need: 4, damage: 0 },
  review: { n: 5, need: 5, damage: 0 },
} satisfies Record<string, DuelPreset>;

export const REWARD = {
  /** Reputazione per vittoria. */
  rep: { trainer: 20, rematch: 15, student: 25, rival: 40, speculator: 30, boss: 150, badge: 200, league: 300, legend: 250, bookSection: 10, mentorRematch: 120, temptation: 20 },
  /** Punti Conoscenza. */
  xp: { badge: 100, rematch: 20, book: 5, tip: 5, hermit: 120, legend: 200, mentorRematch: 80, processStar: 15, daily: 10, dailyStreak: 5, dailyStreakMax: 50, casinoLesson: 30, archive: 50 },
} as const;

/** Gradi della Reputazione: ogni grado apre qualcosa (vedi systems/character.ts). */
export const REP_TIERS = [
  { min: 0, name: 'Sconosciuto' },
  { min: 300, name: 'Conosciuto' },
  { min: 900, name: 'Stimato' },
  { min: 2000, name: 'Rinomato' },
  { min: 4000, name: 'Leggenda' },
] as const;

/** Soglia di Disciplina e Pazienza oltre la quale si aprono nuove risposte nei dialoghi. */
export const TRAIT_HIGH = 70;
export const TRAIT_LOW = 30;

/** Tempo per rispondere, uguale per tutti i profili di rischio (la Modalità Studio lo toglie). */
export const ANSWER_SECONDS = 25;

// ---------------- Difficoltà, capitale e rate di tappa ----------------


export interface DifficultyDef {
  name: string;
  /** Capitale del conto di gioco dentro il conto Alpaca Paper: fissato all'inizio, non si cambia. */
  capital: number;
  /** Costo didattico per ordine, in percentuale del controvalore (solo conto Paper, mostrato a parte). */
  fee: number;
  /**
   * Quota minima di tappa = RATE × (1 − tolerance) del capitale: è l'investimento MINIMO richiesto a ogni tappa
   * (5% / 7% / 8,5% / 9,5%). Sopra il minimo il giocatore investe quanto vuole: tutto il capitale è suo dall'inizio.
   * Più alta è la quota, più capitale resta esposto e più vicina è la bancarotta.
   */
  tolerance: number;
  /** Leva massima nei replay storici e nei boss, dopo l'Esame della Leva. */
  replayLeverage: number;
  /** Cosa succede alla bancarotta del conto di gioco. */
  bankrupt: 'riparti' | 'una-volta' | 'game-over';
  desc: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  apprendista: { name: 'Apprendista', capital: 10000, fee: 0, tolerance: 0.5, replayLeverage: 2, bankrupt: 'riparti', desc: 'Capitale ampio, nessun costo didattico. A ogni tappa devi investire almeno il 5% del capitale: molta liquidità di scorta, tanti errori concessi. Per chi parte da zero.' },
  investitore: { name: 'Investitore', capital: 5000, fee: 0.001, tolerance: 0.3, replayLeverage: 2, bankrupt: 'riparti', desc: 'Capitale medio, costo dello 0,10% per ordine. A ogni tappa devi investire almeno il 7% del capitale.' },
  stratega: { name: 'Stratega', capital: 2500, fee: 0.0025, tolerance: 0.15, replayLeverage: 3, bankrupt: 'una-volta', desc: 'Capitale ridotto, costo dello 0,25% per ordine. A ogni tappa devi investire almeno l\'8,5% del capitale: poca liquidità di scorta. Una sola ripartenza dopo una bancarotta.' },
  leggenda: { name: 'Leggenda', capital: 1000, fee: 0.005, tolerance: 0.05, replayLeverage: 4, bankrupt: 'game-over', desc: 'Capitale minimo, costo dello 0,50% per ordine. A ogni tappa devi investire almeno il 9,5% del capitale: quasi tutto resta esposto al mercato. Alla bancarotta la parte pratica finisce. Si sblocca con la Nuova Partita+.' },
};
export const DIFFICULTIES = Object.keys(DIFFICULTY) as Difficulty[];
/** Difficoltà in cui il giocatore può chiedere, dalle opzioni, di proseguire anche quando una Prova sul conto va male. */
export const PROVA_IGNORE: Difficulty[] = ['apprendista', 'investitore'];

/** Tappe: la 0 è la Valigetta, la k si apre con l'Attestato del Mentore k. Nove quote minime, ognuna una parte del 10% del capitale. */
export const STAGES = 9;
export const RATE = 0.1;

/** Attrezzo richiesto dall'esercizio di ogni tappa: è la Tecnica appena imparata, usata sul conto vero. */
export const STAGE_TOOL: { key: 'any' | 'second' | 'limit' | 'sectors' | 'stop'; text: string }[] = [
  { key: 'any', text: 'Compra il titolo della tua Valigetta.' },
  { key: 'second', text: 'Aggiungi almeno un secondo titolo: le nuove Asset Card sono in vetrina.' },
  { key: 'limit', text: 'Usa almeno un ordine limite (Tecnica di Orazio Limite).' },
  { key: 'sectors', text: 'Arriva ad almeno tre settori diversi, o tre titoli se il tuo percorso ha meno settori.' },
  { key: 'any', text: 'Investi la quota della tappa: un versamento alla volta, è un piano di accumulo.' },
  { key: 'any', text: 'Investi la quota della tappa dopo aver letto la scheda completa del titolo che scegli.' },
  { key: 'any', text: 'Investi la quota della tappa. I dividendi restano teoria: il conto Paper non li paga.' },
  { key: 'any', text: 'Investi la quota della tappa a mente fredda: scrivi il motivo nel Diario.' },
  { key: 'stop', text: 'Proteggi almeno una posizione con un ordine stop (Tecnica di Rocco Rischio).' },
];

/**
 * Leva sul conto di gioco: tetto di Alpaca oltre la giornata, interesse annuo e margine di mantenimento di Alpaca.
 * `restart`: dopo una bancarotta si riparte con questa parte del capitale di partenza.
 */
export const LEVERAGE = { max: 2, fromBadge: 8, examBadge: 5, interest: 0.065, maintenance: 0.3, callDays: 3, restart: 0.5 } as const;

/**
 * Bancarotta: quando il conto arriva a ZERO, in ogni difficoltà, sul conto di gioco e su quello reale.
 * Lo zero operativo è 1 $: sotto quella cifra Alpaca non accetta più nemmeno l'ordine minimo, quindi non si può
 * più investire nulla. Le quote di tappa sono importi fissi, calcolati sul capitale di PARTENZA della difficoltà e
 * mai sul patrimonio del momento: chi perde troppo le finanzia sempre più a fatica, chi opera bene arriva alla
 * Lega con capitale in tasca. Quanti errori sono concessi lo decide la difficoltà, con il capitale e la quota minima.
 */
export const ZERO = 1;
