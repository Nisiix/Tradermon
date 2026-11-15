// Collegamento tra domande e libri: per ogni domanda il libro (e la pagina) che ne spiega la risposta.
// Serve a tre cose: dopo un errore il duello indica il libro e la pagina da rileggere (la risposta giusta non viene
// mai mostrata), a fine lettura si fanno un paio di domande proprio su quel libro, e ogni libro ha un livello
// (Base, Intermedio, Avanzato) che è la difficoltà media delle domande che spiega.
import type { Question, QuizTopic } from '../types';
import { QUESTIONS } from './quiz/build';
import { BOOKS, booksFor, type Book } from './books';
import { isGenerated } from './quiz/generated';
import { T } from '../i18n';

const words = (s: string) => s.toLowerCase().split(/[^a-zà-ù0-9/&]+/).filter((w) => w.length >= 5);

/** Il piccolo argomento e la pagina che spiegano una domanda (pagina contata da 0). */
export interface BookPage { book: Book; page: number }

/**
 * Sceglie il libro dell'argomento con più parole in comune con la domanda, dando più peso alla risposta giusta
 * (è quella che il libro deve spiegare), poi la pagina di quel libro che ne contiene di più.
 */
export function bookPageFor(q: Pick<Question, 'topic' | 'q' | 'options' | 'answer' | 'explain'>, pool: Book[] = booksFor([q.topic])): BookPage | undefined {
  if (!pool.length) return undefined;
  const ans = new Set(words(q.options[q.answer] ?? ''));
  const rest = new Set([...words(q.q), ...words(q.explain)].filter((w) => !ans.has(w)));
  const score = (text: string) => {
    const tw = new Set(words(text));
    let s = 0;
    ans.forEach((w) => { if (tw.has(w)) s += 3; });
    rest.forEach((w) => { if (tw.has(w)) s += 1; });
    return s;
  };
  let best = pool[0], top = -1;
  for (const b of pool) {
    const s = score([b.title, ...b.pages].join(' '));
    if (s > top) { top = s; best = b; }
  }
  let page = 0, ps = -1;
  best.pages.forEach((p, i) => { const s = score(p); if (s > ps) { ps = s; page = i; } });
  return { book: best, page };
}

let cache: Map<string, string[]> | null = null;
/** Domande (non generate, non delle grotte) spiegate da ciascun libro. */
function byBook(): Map<string, string[]> {
  if (cache) return cache;
  cache = new Map();
  for (const q of QUESTIONS) {
    if (q.topic === 'grotte' || isGenerated(q.id)) continue;
    const bp = bookPageFor(q);
    if (!bp) continue;
    (cache.get(bp.book.id) ?? cache.set(bp.book.id, []).get(bp.book.id)!).push(q.id);
  }
  return cache;
}

const QBY = new Map(QUESTIONS.map((q) => [q.id, q]));
export function questionsForBook(bookId: string): Question[] {
  return (byBook().get(bookId) ?? []).map((id) => QBY.get(id)!).filter(Boolean);
}

export type BookLevel = 1 | 2 | 3;
export const LEVEL_LABEL: Record<BookLevel, string> = { 1: T('Base'), 2: T('Intermedio'), 3: T('Avanzato') };

/**
 * Livello di un libro: la difficoltà media delle domande che spiega (livello 1 Base, 2 Intermedio, da 2,5 in su
 * Avanzato). Un libro senza domande è Base. I libri delle grotte e le storie hanno un livello fisso.
 */
export function bookLevel(book: Book): BookLevel {
  if (book.level) return book.level;
  const qs = questionsForBook(book.id);
  if (!qs.length) return 1;
  const avg = qs.reduce((s, q) => s + q.diff, 0) / qs.length;
  return avg >= 2.5 ? 3 : avg >= 1.6 ? 2 : 1;
}

/** Libri di un argomento ordinati dal più semplice al più avanzato (a parità, nell'ordine dello scaffale). */
export function booksByLevel(topic: QuizTopic): Book[] {
  return booksFor([topic]).map((b, i) => ({ b, i, l: bookLevel(b) })).sort((x, y) => x.l - y.l || x.i - y.i).map((x) => x.b);
}

/** Per i test: tutti i libri con almeno una domanda collegata. */
export function booksWithQuestions(): string[] {
  return BOOKS.filter((b) => questionsForBook(b.id).length).map((b) => b.id);
}
