// Glossario consultabile (tasto G, Menu → Studio, Cartella dello studente): un tema alla volta, i termini già
// incontrati nei libri con la loro definizione; per gli altri dice quale libro leggere e in quale Biblioteca.
import { choose, modal, esc } from './core';
import { GLOSSARY, type Term } from '../data/glossary';
import { BOOK_BY_ID, TOPIC_LABEL } from '../data/books';
import { trackTopics } from '../data/quiz/build';
import { townForTopic } from '../data/quiz/hint';
import { S } from '../systems/state';
import { COMMON_TOPICS, ACADEMY_TOPICS } from '../systems/quiz';
import type { QuizTopic } from '../types';
import { T } from '../i18n';

/** Temi del glossario per questo giocatore: quelli del suo percorso più quelli comuni a tutti. */
export function glossaryTopics(): QuizTopic[] {
  const mine = new Set<QuizTopic>([...trackTopics(S.track, S.mixedClasses, 8), ...COMMON_TOPICS, ...(S.flags.champion ? ACADEMY_TOPICS : [])]);
  const order: QuizTopic[] = [];
  for (const t of GLOSSARY) { const tp = BOOK_BY_ID[t.book]?.topic; if (tp && mine.has(tp) && !order.includes(tp)) order.push(tp); }
  return order;
}

const termsOf = (topic: QuizTopic) => GLOSSARY.filter((t) => BOOK_BY_ID[t.book]?.topic === topic);
const known = (t: Term) => S.booksRead.includes(t.book);

export async function openGlossary(): Promise<void> {
  const topics = glossaryTopics();
  for (;;) {
    const label = (tp: QuizTopic) => { const ts = termsOf(tp); return `${TOPIC_LABEL[tp]} (${ts.filter(known).length}/${ts.length})`; };
    const tot = GLOSSARY.filter((t) => topics.includes(BOOK_BY_ID[t.book]?.topic)), k = tot.filter(known).length;
    const c = await choose([...topics.map(label), T('Chiudi')], { cancel: true, title: T`GLOSSARIO · ${k}/${tot.length}`, prompt: T('Ogni termine si sblocca leggendo il libro che lo spiega.') });
    if (c < 0 || c >= topics.length) return;
    await showTopic(topics[c]);
  }
}

async function showTopic(topic: QuizTopic) {
  const ts = termsOf(topic);
  await modal(TOPIC_LABEL[topic], ({ body, button, close }) => {
    const town = townForTopic(topic);
    const where = ACADEMY_TOPICS.includes(topic) ? T("all'Accademia di Wall Street") : town ? T`nella Biblioteca di ${town}` : T('in ogni Biblioteca');
    body.innerHTML = `<dl class="gloss">${ts.map((t) => known(t)
      ? `<dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd>`
      : `<dt class="muted">???</dt><dd class="muted small">${esc(T`Leggi «${BOOK_BY_ID[t.book]?.title ?? ''}» ${where}.`)}</dd>`).join('')}</dl>`;
    body.tabIndex = 0;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}
