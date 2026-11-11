// Boss dei Mercati (endgame): prima un quiz, poi UNA sola decisione su un grafico vero, che dura minuti,
// giorni o settimane e continua anche a gioco chiuso. Si vince togliendo energia al boss con tre cose:
// quello che sai (quiz), come hai costruito il piano (qualità) e come è andata davvero (esito).
// Quiz e piano fatti bene bastano da soli: l'esito è reale, quindi non è mai l'unica via per vincere.
// Alla sconfitta si rifà tutto il boss, quiz compreso. Nessun ordine viene inviato: il piano è un mandato
// valutato sulle barre reali di Alpaca.
import type { BossPlan, BossState, QuizTopic } from '../types';
import type { BarTimeframe } from './alpaca';

export interface BossDef {
  id: string;
  name: string;
  title: string;
  /** Barre usate per valutare il piano e durata del mandato. */
  tf: BarTimeframe;
  durationMs: number;
  durationLabel: string;
  topics: QuizTopic[];
  intro: string[];
  /** Solo cripto: il mandato dura meno di una seduta e deve poter partire a qualsiasi ora. */
  cryptoOnlyWhenClosed: boolean;
  pal: number;
}

const H = 3600_000, D = 24 * H;

export const BOSSES: BossDef[] = [
  { id: 'fulmine', name: 'Il Fulmine', title: 'Boss dell\'intraday', tf: '5Min', durationMs: 2 * H, durationLabel: '2 ore, candele da 5 minuti', topics: ['ordini', 'analisi', 'bias'], cryptoOnlyWhenClosed: true, pal: 13,
    intro: ['Io vivo in un pomeriggio. Due ore, candele da cinque minuti: qui chi esita ha già perso, e chi corre senza piano perde di più.', 'Prima le domande. Poi un solo piano: ingresso, stop, obiettivo. Non potrai toccarlo.'] },
  { id: 'marea', name: 'La Marea', title: 'Boss dello swing', tf: '1Hour', durationMs: 3 * D, durationLabel: '3 giorni, candele da 1 ora', topics: ['analisi', 'gestione', 'macro'], cryptoOnlyWhenClosed: false, pal: 14,
    intro: ['Io salgo e scendo in tre giorni. Chi mi guarda ogni ora impazzisce; chi ha deciso prima dorme.', 'Prima le domande. Poi un solo piano, e tre giorni per vedere se regge.'] },
  { id: 'ghiacciaio', name: 'Il Ghiacciaio', title: 'Boss della posizione', tf: '1Day', durationMs: 28 * D, durationLabel: '4 settimane, candele da 1 giorno', topics: ['macro', 'gestione', 'diversificazione'], cryptoOnlyWhenClosed: false, pal: 16,
    intro: ['Io mi muovo in settimane. La fretta con me non serve: serve un piano che sopravviva a quattro settimane di notizie.', 'Prima le domande. Poi un solo piano. Torna tra un mese.'] },
];

export const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

/** Domande del quiz, risposte giuste minime per poter presentare il piano, energia del boss e soglia di vittoria. */
export const BOSS_RULES = { quizN: 8, quizMin: 5, energy: 100, win: 70, quizMax: 40, planMax: 30, outcomeMax: 30, riskMin: 0.005, riskMax: 0.05, evalDelayMs: 15 * 60_000 } as const;

export interface PlanScore { points: number; rr: number; notes: { ok: boolean; text: string }[] }

/** Controlli formali del piano: prezzi coerenti e rischio dentro i limiti. Restituisce l'errore, o '' se va bene. */
export function planError(p: Pick<BossPlan, 'entry' | 'stop' | 'target' | 'risk'>): string {
  if (!(p.entry > 0 && p.stop > 0 && p.target > 0)) return 'Indica stop e obiettivo.';
  if (p.stop >= p.entry) return 'Lo stop va sotto il prezzo di ingresso: è il punto in cui ammetti di avere torto.';
  if (p.target <= p.entry) return 'L\'obiettivo va sopra il prezzo di ingresso.';
  if (p.risk < BOSS_RULES.riskMin || p.risk > BOSS_RULES.riskMax) return `Il rischio va tra ${BOSS_RULES.riskMin * 100}% e ${BOSS_RULES.riskMax * 100}% del capitale della sfida.`;
  return '';
}

/**
 * Qualità del piano (fino a 30 punti): si giudica prima di sapere come va a finire.
 * `vol` è l'ampiezza media recente delle candele del boss, in rapporto al prezzo (per esempio 0,004 = 0,4%).
 */
export function planScore(p: Pick<BossPlan, 'entry' | 'stop' | 'target' | 'risk'>, vol: number): PlanScore {
  const stopDist = (p.entry - p.stop) / p.entry;
  const rr = (p.target - p.entry) / (p.entry - p.stop);
  const notes: PlanScore['notes'] = [];
  let pts = 0;
  const rrPts = rr >= 2 ? 12 : rr >= 1.5 ? 8 : rr >= 1 ? 4 : 0;
  pts += rrPts;
  notes.push({ ok: rr >= 1.5, text: `Rapporto rendimento/rischio ${rr.toFixed(1)} a 1${rr >= 2 ? ': un errore costa metà di un successo.' : rr >= 1.5 ? ': accettabile.' : ': rischi più di quanto puoi guadagnare.'}` });
  const riskPts = p.risk <= 0.02 ? 10 : p.risk <= 0.03 ? 6 : 2;
  pts += riskPts;
  notes.push({ ok: p.risk <= 0.02, text: `Rischi il ${(p.risk * 100).toFixed(1)}% del capitale${p.risk <= 0.02 ? ': dieci errori di fila non ti fermano.' : ': troppi errori così e la sfida finisce presto.'}` });
  // uno stop dentro il rumore normale viene preso per caso; uno lontanissimo non protegge
  const lo = Math.max(0.001, vol * 1), hi = Math.max(0.01, vol * 8);
  const okStop = stopDist >= lo && stopDist <= hi;
  pts += okStop ? 8 : 2;
  notes.push({ ok: okStop, text: okStop ? `Stop a ${(stopDist * 100).toFixed(1)}% dal prezzo: fuori dal rumore normale, ma abbastanza vicino da proteggere.` : stopDist < lo ? `Stop a ${(stopDist * 100).toFixed(2)}%: è dentro le oscillazioni normali, rischia di scattare per caso.` : `Stop a ${(stopDist * 100).toFixed(1)}%: è così lontano che non protegge.` });
  return { points: Math.min(BOSS_RULES.planMax, pts), rr, notes };
}

export interface Outcome { exit: number; how: 'stop' | 'obiettivo' | 'scadenza'; r: number; points: number; bars: number }

/**
 * Esito reale del piano sulle barre successive all'ingresso. Se nella stessa candela vengono toccati sia lo stop
 * sia l'obiettivo si conta lo stop: non si può sapere quale è arrivato prima, e si sceglie il caso prudente.
 * `r` è il risultato in multipli del rischio (−1 = stop pieno).
 */
export function outcome(p: Pick<BossPlan, 'entry' | 'stop' | 'target'>, bars: { h: number; l: number; c: number; o: number }[]): Outcome {
  const risk = p.entry - p.stop;
  let exit = bars.length ? bars[bars.length - 1].c : p.entry;
  let how: Outcome['how'] = 'scadenza';
  for (const b of bars) {
    // apertura sotto lo stop (gap): si esce al prezzo di apertura, peggio dello stop
    if (b.o <= p.stop) { exit = b.o; how = 'stop'; break; }
    if (b.l <= p.stop) { exit = p.stop; how = 'stop'; break; }
    if (b.h >= p.target) { exit = p.target; how = 'obiettivo'; break; }
  }
  const r = (exit - p.entry) / risk;
  // uno stop pieno non dà punti: solo quiz e piano perfetti vincono a prescindere dall'esito
  const points = r >= 1 ? BOSS_RULES.outcomeMax : r > 0 ? 20 : r >= -0.5 ? 10 : 0;
  return { exit, how, r, points, bars: bars.length };
}

/** Danno del quiz: proporzionale alle risposte giuste. */
export function quizPoints(correct: number, total: number): number {
  return Math.round((correct / Math.max(1, total)) * BOSS_RULES.quizMax);
}

export function bossWon(quiz: number, plan: number, out: number): boolean {
  return quiz + plan + out >= BOSS_RULES.win;
}

// ---------------- Vendere durante il mandato ----------------
// Se l'obiettivo non arriva il giocatore può decidere di vendere prima della scadenza. La vendita può anche essere
// parziale, ma la decisione di vendere annulla la sfida: si ripete da capo (quiz compreso) con un titolo diverso.
// Non conta come sconfitta.

/** Annulla la sfida in corso con quel Boss perché il giocatore vende. Restituisce il titolo venduto, o null se non c'è un piano in corso. */
export function sellOut(boss: BossState, id: string): string | null {
  const run = boss.runs?.[id];
  if (!run?.plan) return null;
  const asset = run.plan.asset;
  (boss.barred ??= {})[id] = asset;
  delete boss.runs![id];
  return asset;
}

/** Titoli tra cui scegliere per il piano: senza quello venduto nell'ultimo mandato annullato con questo Boss. */
export function planPool<T extends { id: string }>(pool: T[], boss: BossState, id: string): T[] {
  const out = boss.barred?.[id];
  return out ? pool.filter((a) => a.id !== out) : pool;
}

/** Chiude la sfida (vinta o persa). Se un piano era stato presentato, il titolo escluso torna disponibile. */
export function endRun(boss: BossState, id: string): void {
  const run = boss.runs?.[id];
  if (run?.plan && boss.barred) delete boss.barred[id];
  if (boss.runs) delete boss.runs[id];
}
