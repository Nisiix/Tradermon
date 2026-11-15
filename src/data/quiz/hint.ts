// Suggerimento di studio dopo un errore: il libro della Biblioteca che spiega l'argomento (e in quale città),
// altrimenti la fonte esterna. Così ogni errore dice dove andare a rileggere, non solo "sbagliato".
import type { Question, QuizTopic } from '../../types';
import { TOPIC_LABEL } from '../books';
import { bookPageFor } from '../bookmap';
import { mentorTopics, ACADEMY_TOPICS } from './build';
import { TOWNS } from '../story';
import { sourceLabel } from '../sources';
import { S } from '../../systems/state';
import { CAVES } from '../../world/caves';
import { BOOK_BY_ID } from '../books';
import { T } from '../../i18n';

/** Città la cui Biblioteca ha l'argomento tra i suoi temi (1..8), oppure undefined per gli argomenti di Wall Street. */
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
  // il piccolo argomento, e la pagina, che spiegano proprio questa domanda: dopo un errore la risposta non si vede,
  // quindi il rimando deve portare dritto al punto da rileggere
  const bp = bookPageFor(q);
  if (bp) {
    const town = townForTopic(q.topic);
    const page = bp.book.pages.length > 1 ? T`, pagina ${bp.page + 1}` : '';
    if (ACADEMY_TOPICS.includes(q.topic)) return T`📖 Rileggi «${bp.book.title}»${page}, all'Accademia di Wall Street (scaffale ${TOPIC_LABEL[q.topic]}).`;
    return T`📖 Rileggi «${bp.book.title}»${page}${town ? T` nella Biblioteca di ${town}` : T(' in Biblioteca')} (scaffale ${TOPIC_LABEL[q.topic]}).`;
  }
  const src = sourceLabel(q.source);
  return src ? T`📚 Per approfondire: ${src} (Archivio delle Fonti).` : '';
}
