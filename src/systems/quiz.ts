import type { Question, QuizTopic } from '../types';
import { QUESTIONS, byTopic, trackTopics } from '../data/quiz/build';
import { S } from './state';
import { hashString, mulberry32, shuffle } from './rng';

export function pickQuestions(topics: QuizTopic[], n: number, opts: { minDiff?: number; maxDiff?: number; preferReview?: boolean; rng?: () => number } = {}): Question[] {
  const rng = opts.rng ?? Math.random;
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
  const pool = topics.flatMap((t) => byTopic(t));
  const rng = mulberry32(hashString(todayKey() + S.name));
  return pool[Math.floor(rng() * pool.length)];
}

export function mastery(): number {
  const known = Object.values(S.review).filter((b) => b >= 2).length;
  return known / QUESTIONS.length;
}
