// Suggerimento di studio dopo un errore: il libro della Biblioteca che spiega l'argomento (e in quale città),
// altrimenti la fonte esterna. Così ogni errore dice dove andare a rileggere, non solo "sbagliato".
import type { Question, QuizTopic } from '../../types';
import { booksFor, TOPIC_LABEL } from '../books';
import { mentorTopics } from './build';
import { TOWNS } from '../story';
import { sourceLabel } from '../sources';
import { S } from '../../systems/state';
import { T } from '../../i18n';

/** Città della Sezione della Whale che tratta l'argomento (1..8), oppure undefined per gli argomenti di Wall Street. */
export function townForTopic(topic: QuizTopic): string | undefined {
  for (let n = 1; n <= 8; n++) if (mentorTopics(n, S.track, S.mixedClasses).includes(topic)) return TOWNS[n]?.name;
  return undefined;
}

export function studyHint(q: Question): string {
  const book = booksFor([q.topic]).find((b) => !b.id.endsWith('_ctx'));
  if (book) {
    const town = townForTopic(q.topic);
    return T`📖 Rileggi «${book.title}»${town ? T` nella Biblioteca di ${town}` : T(' in Biblioteca')} (sezione ${TOPIC_LABEL[q.topic]}).`;
  }
  const src = sourceLabel(q.source);
  return src ? T`📚 Per approfondire: ${src} (Archivio delle Fonti).` : '';
}
