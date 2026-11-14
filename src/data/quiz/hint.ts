// Suggerimento di studio dopo un errore: il libro della Biblioteca che spiega l'argomento (e in quale città),
// altrimenti la fonte esterna. Così ogni errore dice dove andare a rileggere, non solo "sbagliato".
import type { Question, QuizTopic } from '../../types';
import { booksFor, TOPIC_LABEL } from '../books';
import { mentorTopics } from './build';
import { TOWNS } from '../story';
import { sourceLabel } from '../sources';
import { S } from '../../systems/state';
import { CAVES } from '../../world/caves';
import { BOOK_BY_ID } from '../books';
import { T } from '../../i18n';

/** Città della Sezione della Whale che tratta l'argomento (1..8), oppure undefined per gli argomenti di Wall Street. */
export function townForTopic(topic: QuizTopic): string | undefined {
  for (let n = 1; n <= 8; n++) if (mentorTopics(n, S.track, S.mixedClasses).includes(topic)) return TOWNS[n]?.name;
  return undefined;
}

export function studyHint(q: Question): string {
  // domande delle grotte: il libro è il taccuino della guida all'ingresso, non uno scaffale della Biblioteca
  if (q.topic === 'grotte') {
    const cave = Object.values(CAVES).find((c) => q.id.startsWith(`grotte_${c.quiz}_`));
    const book = cave && BOOK_BY_ID[cave.book];
    return book && cave ? T`📖 Rileggi «${book.title}»: te lo presta la guida all'ingresso della ${cave.name}.` : '';
  }
  const book = booksFor([q.topic]).find((b) => !b.id.endsWith('_ctx'));
  if (book) {
    const town = townForTopic(q.topic);
    return T`📖 Rileggi «${book.title}»${town ? T` nella Biblioteca di ${town}` : T(' in Biblioteca')} (sezione ${TOPIC_LABEL[q.topic]}).`;
  }
  const src = sourceLabel(q.source);
  return src ? T`📚 Per approfondire: ${src} (Archivio delle Fonti).` : '';
}
