import type { Question, QuizTopic } from '../types';
import { QUESTIONS, byTopic, trackTopics } from '../data/quiz/build';
import { S } from './state';
import { hashString, mulberry32, shuffle } from './rng';

/**
 * Difficoltà delle domande lungo la storia.
 * Livelli: 1 base, 2 intermedio, 3 avanzato, 4 esperto (Lega).
 * Tappe: 0 = nessuna medaglia, 1..8 = medaglie ottenute, 9..12 = i quattro Superiori della Lega.
 * Ogni tappa alza la difficoltà media di un quarto di livello: da 1 (primo Mentore) a 4 (fine Lega).
 */
export const MAX_DIFF = 4;
export const STAGE_LEAGUE = 9;

export function targetDiff(stage: number): number {
  return Math.max(1, Math.min(MAX_DIFF, 1 + stage * 0.25));
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
}

/** Ordina per priorità: prima le domande da ripassare (se richiesto), poi quelle viste meno spesso. */
function prioritized(pool: Question[], rng: () => number, preferReview: boolean): Question[] {
  const seen = (q: Question) => S.answered[q.id] ?? 0;
  const review = preferReview ? shuffle(pool.filter((q) => S.review[q.id] === 1), rng) : [];
  const rest = shuffle(pool.filter((q) => !review.includes(q)), rng).sort((a, b) => seen(a) - seen(b));
  return [...review, ...rest];
}

export function pickQuestions(topics: QuizTopic[], n: number, opts: PickOpts = {}): Question[] {
  const rng = opts.rng ?? Math.random;
  if (opts.target !== undefined) return pickByTarget(topics, n, opts.target, rng, !!opts.preferReview);
  let pool = topics.flatMap((t) => byTopic(t)).filter((q) => q.diff >= (opts.minDiff ?? 1) && q.diff <= (opts.maxDiff ?? 3));
  if (pool.length < n) pool = topics.flatMap((t) => byTopic(t));
  // se gli argomenti non bastano, completa con altre domande: il numero richiesto è sempre rispettato
  if (pool.length < n) pool = [...pool, ...QUESTIONS.filter((q) => !pool.includes(q))];
  const review = opts.preferReview ? shuffle(pool.filter((q) => S.review[q.id] === 1), rng) : [];
  // preferisci le domande mai viste o viste meno spesso
  const rest = shuffle(pool.filter((q) => !review.includes(q)), rng).sort((a, b) => (S.answered[a.id] ?? 0) - (S.answered[b.id] ?? 0));
  const out = [...review.slice(0, Math.ceil(n / 2)), ...rest].slice(0, n);
  return shuffle(out, rng);
}

/**
 * Sceglie n domande la cui difficoltà media è `target`: per esempio 1,5 → metà livello 1 e metà livello 2.
 * Se un livello non ha abbastanza domande, completa con quelle del livello più vicino (a parità, la più facile),
 * e solo se gli argomenti non bastano prende domande di altri argomenti.
 */
function pickByTarget(topics: QuizTopic[], n: number, target: number, rng: () => number, preferReview: boolean): Question[] {
  const pool = topics.flatMap((t) => byTopic(t));
  const out: Question[] = [];
  for (const [level, k] of diffMix(n, target)) out.push(...prioritized(pool.filter((q) => q.diff === level), rng, preferReview).slice(0, k));
  const closest = (list: Question[]) => prioritized(list.filter((q) => !out.includes(q)), rng, preferReview)
    .sort((a, b) => Math.abs(a.diff - target) - Math.abs(b.diff - target) || a.diff - b.diff);
  if (out.length < n) out.push(...closest(pool).slice(0, n - out.length));
  if (out.length < n) out.push(...closest(QUESTIONS).slice(0, n - out.length));
  return shuffle(out, rng);
}

/** Registra la risposta: scatole di Leitner (1 = da ripassare, 3 = imparata). */
export function recordAnswer(q: Question, correct: boolean) {
  S.answered[q.id] = (S.answered[q.id] ?? 0) + 1;
  const box = S.review[q.id] ?? 0;
  S.review[q.id] = correct ? Math.min(3, Math.max(1, box) + 1) : 1;
  if (correct) S.stats.xp += q.diff * 5;
}

export function reviewQueue(): Question[] {
  return QUESTIONS.filter((q) => S.review[q.id] === 1);
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
  const list = pool.length ? pool : all;
  const rng = mulberry32(hashString(todayKey() + S.name));
  return list[Math.floor(rng() * list.length)];
}

export function mastery(): number {
  const known = Object.values(S.review).filter((b) => b >= 2).length;
  return known / QUESTIONS.length;
}
