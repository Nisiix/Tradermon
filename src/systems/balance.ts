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
