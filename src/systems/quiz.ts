import type { Question, QuizTopic } from '../types';
import { QUESTIONS, byTopic, trackTopics } from '../data/quiz/build';
import { generate, templatesFor, isGenerated } from '../data/quiz/generated';
import { ASSET_BY_ID } from '../data/assets';
import { S } from './state';
import { hashString, mulberry32, shuffle } from './rng';

/**
 * Difficoltà delle domande lungo la storia.
 * Livelli: 1 base, 2 intermedio, 3 avanzato, 4 esperto (Wall Street).
 * Tappe: 0 = nessuna medaglia, 1..8 = medaglie ottenute, 9..12 = i quattro Superiori di Wall Street.
 * Ogni tappa alza la difficoltà media di un quarto di livello: da 1 (prima Whale) a 4 (fine Wall Street).
 */
export const MAX_DIFF = 4;
export const STAGE_LEAGUE = 9;

export function targetDiff(stage: number): number {
  return Math.max(1, Math.min(MAX_DIFF, 1 + stage * 0.25 + ngBoost()));
}

/** Nuova Partita+: ogni giro alza la difficoltà media di mezzo livello (le domande da esperto compaiono già dalle Whale). */
export function ngBoost(): number {
  return 0.5 * Math.min(2, S?.ngPlus ?? 0);
}

/** Tappa della storia raggiunta dal giocatore. */
export function storyStage(): number {
  return S.badges;
}

/** Quante domande per livello servono per avere in media la difficoltà `target`. */
export function diffMix(n: number, target: number): Map<number, number> {
  const t = Math.max(1, Math.min(MAX_DIFF, target));
  const lo = Math.floor(t);
  const hi = Math.min(MAX_DIFF, lo + 1);
  const nHi = lo === hi ? 0 : Math.round(n * (t - lo));
  const mix = new Map<number, number>([[lo, n - nHi]]);
  if (nHi > 0) mix.set(hi, nHi);
  return mix;
}

export interface PickOpts {
  minDiff?: number;
  maxDiff?: number;
  /** Difficoltà media desiderata (1..4): vedi targetDiff(). Se c'è, minDiff/maxDiff sono ignorati. */
  target?: number;
  preferReview?: boolean;
  rng?: () => number;
  /** Quiz condiviso (sfida della settimana, duello con codice): stesso seme = stesse domande per tutti,
   *  senza tenere conto della cronologia del giocatore. */
  shared?: boolean;
  /** Senza domande generate (es. ripasso e domanda del giorno, che devono restare nelle scatole di Leitner). */
  noGenerated?: boolean;
}

/** Quante domande del duello sono generate con numeri nuovi: una ogni tre (3 → 1, 8 → 2, 12 → 4). */
export function generatedCount(n: number): number { return Math.floor(n / ((S?.ngPlus ?? 0) > 0 ? 2 : 3)); }

/**
 * Sostituisce una domanda ogni tre con una generata sugli stessi argomenti e alla stessa difficoltà:
 * chi ha imparato le risposte a memoria deve comunque rifare il calcolo. Le sfide condivise usano il seme,
 * quindi tutti i partecipanti ricevono gli stessi numeri.
 */
function withGenerated(out: Question[], topics: QuizTopic[], target: number, rng: () => number, shared: boolean): Question[] {
  const k = Math.min(generatedCount(out.length), out.length);
  if (k === 0) return out;
  const ctx = shared ? {} : { portfolio: S.portfolio, prices: S.market.prices, names: Object.fromEntries(Object.values(ASSET_BY_ID).map((a) => [a.id, a.name])) };
  // solo modelli dello stesso livello delle domande scelte: ogni generata sostituisce una statica di pari livello,
  // così la media di difficoltà del duello non cambia
  const levels = new Set(out.map((q) => q.diff));
  const cands = shuffle(templatesFor(topics, target).filter((c) => levels.has(c.t.diff)), rng)
    .sort((a, b) => Math.abs(a.t.diff - target) - Math.abs(b.t.diff - target));
  const keep = [...out];
  const gen: Question[] = [];
  for (const c of cands) {
    if (gen.length >= k) break;
    const i = keep.findIndex((q) => q.diff === c.t.diff);
    if (i < 0) continue;
    const q = generate(c.t, c.topic, rng, ctx);
    if (!q) continue;
    keep.splice(i, 1);
    gen.push(q);
  }
  return [...keep, ...gen];
}

/** Argomenti comuni a tutti i percorsi: le sfide condivise usano solo questi, così il quiz è identico per tutti. */
export const SHARED_TOPICS: QuizTopic[] = ['rischio', 'ordini', 'diversificazione', 'costi', 'bias', 'gestione', 'macro', 'regole'];

/** Ordina per priorità: prima le domande da ripassare (se richiesto), poi quelle viste meno spesso. */
function prioritized(pool: Question[], rng: () => number, preferReview: boolean, shared = false): Question[] {
  if (shared) return shuffle([...pool].sort((a, b) => (a.id < b.id ? -1 : 1)), rng);
  const seen = (q: Question) => S.answered[q.id] ?? 0;
  const review = preferReview ? shuffle(pool.filter((q) => isDue(q.id)), rng) : [];
  const rest = shuffle(pool.filter((q) => !review.includes(q)), rng).sort((a, b) => seen(a) - seen(b));
  return [...review, ...rest];
}

export function pickQuestions(topics: QuizTopic[], n: number, opts: PickOpts = {}): Question[] {
  const rng = opts.rng ?? Math.random;
  if (opts.target !== undefined) return pickByTarget(topics, n, opts.target, rng, !!opts.preferReview, !!opts.shared, !!opts.noGenerated);
  let pool = topics.flatMap((t) => byTopic(t)).filter((q) => q.diff >= (opts.minDiff ?? 1) && q.diff <= (opts.maxDiff ?? 3));
  if (pool.length < n) pool = topics.flatMap((t) => byTopic(t));
  // se gli argomenti non bastano, completa con altre domande: il numero richiesto è sempre rispettato
  if (pool.length < n) pool = [...pool, ...QUESTIONS.filter((q) => !pool.includes(q))];
  const mid = ((opts.minDiff ?? 1) + (opts.maxDiff ?? 3)) / 2;
  if (opts.shared) return shuffle(withGenerated(prioritized(pool, rng, false, true).slice(0, n), topics, mid, rng, true), rng);
  const review = opts.preferReview ? shuffle(pool.filter((q) => isDue(q.id)), rng) : [];
  // preferisci le domande mai viste o viste meno spesso
  const rest = shuffle(pool.filter((q) => !review.includes(q)), rng).sort((a, b) => (S.answered[a.id] ?? 0) - (S.answered[b.id] ?? 0));
  const out = [...review.slice(0, Math.ceil(n / 2)), ...rest].slice(0, n);
  return shuffle(opts.noGenerated ? out : withGenerated(out, topics, mid, rng, false), rng);
}

/**
 * Sceglie n domande la cui difficoltà media è `target`: per esempio 1,5 → metà livello 1 e metà livello 2.
 * Se un livello non ha abbastanza domande, completa con quelle del livello più vicino (a parità, la più facile),
 * e solo se gli argomenti non bastano prende domande di altri argomenti.
 */
function pickByTarget(topics: QuizTopic[], n: number, target: number, rng: () => number, preferReview: boolean, shared = false, noGenerated = false): Question[] {
  const pool = topics.flatMap((t) => byTopic(t));
  const out: Question[] = [];
  for (const [level, k] of diffMix(n, target)) out.push(...prioritized(pool.filter((q) => q.diff === level), rng, preferReview, shared).slice(0, k));
  const closest = (list: Question[]) => prioritized(list.filter((q) => !out.includes(q)), rng, preferReview, shared)
    .sort((a, b) => Math.abs(a.diff - target) - Math.abs(b.diff - target) || a.diff - b.diff);
  if (out.length < n) out.push(...closest(pool).slice(0, n - out.length));
  if (out.length < n) out.push(...closest(QUESTIONS).slice(0, n - out.length));
  return shuffle(noGenerated ? out : withGenerated(out, topics, target, rng, shared), rng);
}

/**
 * Ripetizione spaziata (scatole di Leitner con scadenze).
 * Scatola 1 = sbagliata, torna subito nel ripasso; 2 = dopo 1 giorno; 3 = dopo 3 giorni; 4 = dopo 7 giorni,
 * poi ogni 21 giorni. Una risposta sbagliata riporta la domanda nella scatola 1.
 */
export const REVIEW_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7 };
export const REVIEW_KEEP_DAYS = 21;
export const MAX_BOX = 4;

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}

/** La domanda è da ripassare oggi? (solo domande già incontrate) */
export function isDue(id: string, today = todayKey()): boolean {
  if (!S.review[id]) return false;
  return (S.reviewDue[id] ?? '') <= today;
}

/** Registra la risposta e fissa la prossima scadenza del ripasso. */
export function recordAnswer(q: Question, correct: boolean) {
  // le domande generate cambiano numeri ogni volta: danno Conoscenza ma non entrano nel ripasso
  if (isGenerated(q.id)) { if (correct) S.stats.xp += q.diff * 5; return; }
  S.answered[q.id] = (S.answered[q.id] ?? 0) + 1;
  const box = S.review[q.id] ?? 0;
  const today = todayKey();
  if (!correct) {
    S.review[q.id] = 1;
    S.reviewDue[q.id] = today;
  } else {
    // giusta al primo colpo: si rivede dopo 3 giorni; giusta in ripasso solo se era in scadenza sale di scatola
    const next = box === 0 ? 3 : isDue(q.id, today) ? Math.min(MAX_BOX, box + 1) : box;
    const wasTop = box === MAX_BOX && isDue(q.id, today);
    S.review[q.id] = next;
    if (box === 0 || isDue(q.id, today)) S.reviewDue[q.id] = addDays(today, wasTop ? REVIEW_KEEP_DAYS : REVIEW_DAYS[next]);
    S.stats.xp += q.diff * 5;
  }
}

/** Domande in scadenza oggi, prima quelle sbagliate (scatola più bassa) e le più arretrate. */
export function reviewQueue(today = todayKey()): Question[] {
  return QUESTIONS.filter((q) => isDue(q.id, today))
    .sort((a, b) => (S.review[a.id] - S.review[b.id]) || ((S.reviewDue[a.id] ?? '') < (S.reviewDue[b.id] ?? '') ? -1 : 1));
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyQuestion(): Question {
  const topics = trackTopics(S.track, S.mixedClasses, S.badges);
  const all = topics.flatMap((t) => byTopic(t));
  // la domanda del giorno non supera il livello raggiunto nella storia
  const cap = Math.ceil(targetDiff(storyStage()));
  const pool = all.filter((q) => q.diff <= cap);
  const base = pool.length ? pool : all;
  // se ci sono domande in scadenza nel ripasso, la domanda del giorno è una di quelle
  const due = base.filter((q) => isDue(q.id));
  const list = due.length ? due : base;
  const rng = mulberry32(hashString(todayKey() + S.name));
  return list[Math.floor(rng() * list.length)];
}

export function mastery(): number {
  // contano solo le domande ancora in gioco: i salvataggi possono avere id di domande tolte (es. quelle con calcoli)
  const known = QUESTIONS.filter((q) => (S.review[q.id] ?? 0) >= 3).length;
  return known / QUESTIONS.length;
}
