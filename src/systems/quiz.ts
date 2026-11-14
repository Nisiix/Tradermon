import type { Difficulty, Question, QuizTopic } from '../types';
import { QUESTIONS, OPEN_QUESTIONS, byTopic, mentorTopics, caveQuestions } from '../data/quiz/build';
import { LESSONS } from '../data/lessons';
import { BOOKS } from '../data/books';
import { generate, templatesFor, isGenerated } from '../data/quiz/generated';
import { ASSET_BY_ID } from '../data/assets';
import { S } from './state';
import { hashString, mulberry32, shuffle } from './rng';

/**
 * Difficoltà delle domande lungo la storia.
 * Livelli: 1 base, 2 intermedio, 3 avanzato, 4 esperto.
 * Tappe: 0 = nessuna medaglia, 1..8 = medaglie ottenute, 9..12 = i quattro Superiori di Wall Street.
 * Fino all'ottava Whale ogni tappa alza la media di un quarto di livello (da 1 a 3); a Wall Street di un ottavo
 * (fino a 3,5). Sopra c'è solo il fine gioco (Boss dei Mercati, Torre, rivincite di Wall Street): vedi endgameDiff().
 * La difficoltà scelta a inizio partita sposta tutta la curva (QUIZ_SHIFT), e la Nuova Partita+ la alza ancora.
 */
export const MAX_DIFF = 4;
export const STAGE_LEAGUE = 9;
/** Tetto della storia fino al Campione: resta sempre almeno un quarto di livello sotto il fine gioco. */
export const STORY_MAX = 3.75;
/** Quanto il fine gioco sta sopra l'ultimo duello di Wall Street (se il livello 4 lo permette). */
export const ENDGAME_STEP = 0.5;

/**
 * Spostamento della curva per difficoltà: chi parte da zero ha domande più semplici. Leggenda si gioca solo in
 * Nuova Partita+, quindi è già più difficile di Stratega grazie a ngBoost().
 */
export const QUIZ_SHIFT: Record<Difficulty, number> = { apprendista: -0.5, investitore: -0.25, stratega: 0, leggenda: 0 };

function quizShift(): number { return QUIZ_SHIFT[S?.difficulty ?? 'stratega'] ?? 0; }

/** Ultima tappa della storia (quarto Superiore e Campione di Wall Street). */
export const STAGE_TOP = STAGE_LEAGUE + 3;

export function targetDiff(stage: number): number {
  const base = 1 + Math.min(stage, 8) * 0.25 + Math.max(0, stage - 8) * 0.125;
  // lo spostamento della difficoltà cresce con la storia: all'inizio tutti partono dalle domande base
  // (e i livelli bassi hanno domande a sufficienza), a Wall Street vale per intero
  const shift = quizShift() * Math.min(1, Math.max(0, stage) / STAGE_TOP);
  // arrotondata a un ottavo di livello: con 8 domande è il passo più piccolo che un duello riesce a rispettare
  return Math.max(1, Math.min(STORY_MAX, Math.round((base + shift + ngBoost()) * 8) / 8));
}

/** Difficoltà del fine gioco: sopra l'ultimo duello di Wall Street della stessa partita, fino al livello esperto. */
export function endgameDiff(): number {
  return Math.min(MAX_DIFF, targetDiff(STAGE_TOP) + ENDGAME_STEP);
}

/** Nuova Partita+: ogni giro alza la difficoltà media di mezzo livello (le domande da esperto compaiono già dalle Whale). */
export function ngBoost(): number {
  return 0.5 * Math.min(2, S?.ngPlus ?? 0);
}

/** Argomenti di Wall Street: non hanno una Whale, i loro libri stanno negli scaffali comuni di ogni Biblioteca (Regole e truffe, Economia e analisi). */
export const WALL_STREET_TOPICS: QuizTopic[] = ['macro', 'analisi', 'regole'];

/** Il giocatore ha già aperto l'argomento: ha letto almeno una sua lezione o un suo libro. */
export function topicOpened(t: QuizTopic): boolean {
  return LESSONS.some((l) => l.topic === t && S.lessonsRead.includes(l.id)) || BOOKS.some((b) => b.topic === t && S.booksRead.includes(b.id));
}

/**
 * Argomenti su cui si viene interrogati fuori dagli Exchange (Percorsi, rivale, speculatori, eremiti, domanda del
 * giorno): solo ciò che il gioco ha già spiegato. Quindi gli argomenti delle Whale già battute e, in più, quelli che il
 * giocatore ha aperto da sé in Biblioteca (un libro o una lezione): della Whale successiva, delle regole e di Wall Street.
 * Prima del primo Attestato valgono gli argomenti della prima Whale: li introduce la sfida di prova con il rivale.
 */
export function studiedTopics(): QuizTopic[] {
  const out = new Set<QuizTopic>();
  const b = Math.min(8, S.badges);
  for (let i = 1; i <= Math.max(1, b); i++) mentorTopics(i, S.track, S.mixedClasses).forEach((t) => out.add(t));
  if (b >= 1 && b < 8) mentorTopics(b + 1, S.track, S.mixedClasses).filter(topicOpened).forEach((t) => out.add(t));
  WALL_STREET_TOPICS.filter((t) => (t === 'regole' || b >= 8) && topicOpened(t)).forEach((t) => out.add(t));
  return [...out];
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
  if (pool.length < n) pool = [...pool, ...OPEN_QUESTIONS.filter((q) => !pool.includes(q))];
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
  if (out.length < n) out.push(...closest(OPEN_QUESTIONS).slice(0, n - out.length));
  return shuffle(noGenerated ? out : withGenerated(out, topics, target, rng, shared), rng);
}

/**
 * Domande di una grotta (sfidanti, ostriche, eremita): per ogni livello chiesto da `target` si prendono prima le
 * domande della grotta che il giocatore non ha mai visto; finite quelle, domande mai viste degli argomenti del suo
 * percorso (`fallback`); solo dopo si ripetono quelle viste meno spesso. Niente domande generate e niente ripasso:
 * in grotta si trovano cose nuove, e ciò che si sbaglia torna poi nel Ripasso (alla Banca, dalla Professoressa del giorno).
 * `duelsLeft`: quanti duelli della grotta restano da fare, questo compreso. Le domande mai viste di un livello vengono
 * divise tra i duelli rimasti, così l'ultimo sfidante non resta con le sole domande più difficili.
 */
export function pickCaveQuestions(prefix: string, n: number, target: number, fallback: QuizTopic[] = [], rng: () => number = Math.random, duelsLeft = 1): Question[] {
  const seen = (q: Question) => S.answered[q.id] ?? 0;
  const own = caveQuestions(prefix);
  const other = fallback.flatMap((t) => byTopic(t));
  const out: Question[] = [];
  const take = (list: Question[], k: number): number => { for (const q of list) { if (k <= 0) break; if (!out.includes(q)) { out.push(q); k--; } } return k; };
  const fresh = (list: Question[]) => shuffle(list.filter((q) => !seen(q)), rng);
  const least = (list: Question[]) => shuffle(list, rng).sort((a, b) => seen(a) - seen(b));
  /** Dal livello più vicino a quello cercato; a parità, prima il più facile. */
  const near = (list: Question[], level: number) => [...list].sort((a, b) => Math.abs(a.diff - level) - Math.abs(b.diff - level) || a.diff - b.diff);
  const missing: number[] = [];
  // 1) domande della grotta mai viste, del livello giusto
  for (const [level, k] of diffMix(n, target)) {
    const at = fresh(own.filter((q) => q.diff === level));
    const share = Math.min(k, Math.ceil(at.length / Math.max(1, duelsLeft)));
    const left = k - share + take(at, share);
    for (let i = 0; i < left; i++) missing.push(level);
  }
  for (const level of missing) {
    // 2) ancora della grotta e mai viste, del livello più vicino (poi la parte lasciata agli altri duelli);
    // 3) mai viste degli argomenti del giocatore, del livello giusto;
    // 4) della grotta già viste (prima le meno viste); 5) qualsiasi altra del giocatore
    if (!take(near(fresh(own).filter((q) => q.diff !== level), level), 1)) continue;
    if (!take(fresh(own), 1)) continue;
    if (!take(fresh(other.filter((q) => q.diff === level)), 1)) continue;
    if (!take(near(least(own), level).sort((a, b) => seen(a) - seen(b)), 1)) continue;
    take(near(least(other), level), 1);
  }
  return shuffle(out, rng);
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
  const topics = studiedTopics();
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
