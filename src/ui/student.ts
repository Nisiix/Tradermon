// Cartella dello studente: cosa sai, cosa no e dove andare a studiare. Riunisce ripasso, missioni, duelli,
// Diario e carattere in una pagina sola, con un suggerimento concreto per il prossimo passo.
import { modal, esc, bar } from './core';
import { S } from '../systems/state';
import { byTopic, trackTopics } from '../data/quiz/build';
import { TOPIC_LABEL, booksFor } from '../data/books';
import { townForTopic } from '../data/quiz/hint';
import { isDue, COMMON_TOPICS, ACADEMY_TOPICS } from '../systems/quiz';
import { bookLevel, LEVEL_LABEL, type BookLevel } from '../data/bookmap';
import { openGlossary } from './glossary';
import { repTier } from '../systems/character';
import { mentorMission } from '../data/missions';
import { mentor, TOWNS } from '../data/story';
import type { QuizTopic } from '../types';
import { T } from '../i18n';

export interface TopicCard { topic: QuizTopic; known: number; total: number; due: number; wrong: number; booksRead: number; books: number; level: BookLevel | 0 }

/** Stato di ogni argomento del percorso: domande padroneggiate (scatola ≥ 3), in scadenza, sbagliate di recente. */
export function topicCards(): TopicCard[] {
  const topics: QuizTopic[] = [...trackTopics(S.track, S.mixedClasses, 8), ...COMMON_TOPICS, ...(S.flags.champion ? ACADEMY_TOPICS : [])];
  // le domande delle grotte entrano nella Cartella solo dopo che ne hai incontrata una
  if (byTopic('grotte').some((q) => S.answered[q.id])) topics.push('grotte');
  return [...new Set(topics)].map((topic) => {
    const qs = byTopic(topic);
    const bs = topic === 'grotte' ? [] : booksFor([topic]);
    const read = bs.filter((b) => S.booksRead.includes(b.id));
    return {
      topic,
      booksRead: read.length,
      books: bs.length,
      // livello raggiunto nello studio: il più alto tra i libri letti (Base, Intermedio, Avanzato)
      level: read.reduce<BookLevel | 0>((m, b) => Math.max(m, bookLevel(b)) as BookLevel, 0),
      total: qs.length,
      known: qs.filter((q) => (S.review[q.id] ?? 0) >= 3).length,
      due: qs.filter((q) => isDue(q.id)).length,
      wrong: qs.filter((q) => S.review[q.id] === 1).length,
    };
  });
}

/** I tre argomenti più deboli tra quelli già incontrati (almeno una risposta data). */
export function weakest(cards: TopicCard[]): TopicCard[] {
  return cards.filter((c) => c.known + c.wrong + c.due > 0 || byTopic(c.topic).some((q) => S.answered[q.id]))
    .sort((a, b) => (a.known / a.total) - (b.known / b.total) || b.wrong - a.wrong).slice(0, 3);
}

/** Stelle di processo per missione; le missioni "a scelta" (m5) non hanno stelle (`sim: false`). */
export function missionStars(): { id: string; title: string; stars: number; done: boolean; sim: boolean }[] {
  const out = [];
  for (let m = 1; m <= 8; m++) {
    const ms = mentorMission(m, S.track, S.profile);
    // le missioni sono facoltative (Zona Simulazione): «fatta» vuol dire riuscita, non «Attestato ottenuto»
    out.push({ id: ms.id, title: ms.title, stars: Number(S.flags[`${ms.id}_stars`] ?? 0), done: !!S.flags[`m${m}_mission`], sim: ms.kind === 'sim' });
  }
  return out;
}

export function nextStep(cards: TopicCard[]): string {
  const due = cards.reduce((s, c) => s + c.due, 0);
  if (due >= 3) return T`Hai ${due} domande in scadenza: il ripasso della Professoressa del giorno, alla Banca, le rimette in ordine.`;
  const w = weakest(cards)[0];
  if (w && w.known / w.total < 0.5) {
    if (w.topic === 'grotte') return T`L'argomento più debole è «${TOPIC_LABEL[w.topic]}»: rileggi i taccuini delle guide, all'ingresso delle grotte.`;
    const book = booksFor([w.topic])[0];
    const town = townForTopic(w.topic);
    return book ? T`L'argomento più debole è «${TOPIC_LABEL[w.topic]}»: rileggi «${book.title}»${town ? T` nella Biblioteca di ${town}` : ''}, poi sfida gli allievi.` : T`L'argomento più debole è «${TOPIC_LABEL[w.topic]}»: le Lezioni in Biblioteca lo coprono.`;
  }
  const ms = missionStars().find((m) => m.sim && m.done && m.stars < 3);
  if (ms) return T`La missione «${ms.title}» ha ${ms.stars}/3 stelle di processo: puoi ripeterla nella Zona Simulazione di ${TOWNS[3].name} per migliorarle.`;
  if (S.badges < 8) return T`Prossima Whale: ${mentor(S.badges + 1, S.track).name}. Prima leggi i libri sui temi della sua città, in Biblioteca.`;
  return T('Percorso completo: Wall Street e la Torre delle Sfide ti aspettano. Rileggi il Diario per allenare il senno di poi.');
}

export async function openStudentFolder() {
  const cards = topicCards();
  const weak = weakest(cards);
  const ms = missionStars();
  const c = (k: string) => S.counters[k] ?? 0;
  const reviewed = S.journal.filter((e) => e.reviewed);
  const coherent = reviewed.filter((e) => e.note.includes('Rilettura: coerente')).length;
  const emotional = reviewed.filter((e) => e.note.includes('Rilettura: emotiva')).length;
  const tier = repTier();
  const r = await modal<string>(T('Cartella dello studente'), ({ body, button, close }) => {
    body.innerHTML = T`
      <p><b>Prossimo passo:</b> ${esc(nextStep(cards))}</p>
      <div class="grid2">
        <div>
          <h4 style="margin:4px 0">Mappa delle competenze</h4>
          <p class="small muted" style="margin:0 0 4px">Per ogni tema: libri letti, livello di studio raggiunto e domande padroneggiate.</p>
          ${cards.map((k) => `<div class="small comp-row"><b>${esc(TOPIC_LABEL[k.topic])}</b> <span class="muted">${k.books ? `📖 ${k.booksRead}/${k.books} · ` : ''}${k.level ? esc(LEVEL_LABEL[k.level]) : T('da iniziare')} · ✓ ${k.known}/${k.total}</span>${k.due ? T` <span class="bad">· ${k.due} da ripassare</span>` : ''}${bar((k.known / k.total) * 100)}</div>`).join('')}
        </div>
        <div>
          <h4 style="margin:4px 0">Da rafforzare</h4>
          ${weak.length ? weak.map((k) => { const b = k.topic === 'grotte' ? undefined : booksFor([k.topic])[0]; const t = townForTopic(k.topic); return `<div class="small"><b>${esc(TOPIC_LABEL[k.topic])}</b>${k.wrong ? T` · ${k.wrong} sbagliate` : ''}${k.topic === 'grotte' ? T`<br><span class="muted">📖 Taccuini delle guide, all'ingresso delle grotte</span>` : ''}${b ? `<br><span class="muted">📖 «${esc(b.title)}»${t ? T`, Biblioteca di ${esc(t)}` : ''}</span>` : ''}</div>`; }).join('') : T('<p class="small muted">Ancora nessun duello: tutto da scoprire.</p>')}
          <h4 style="margin:8px 0 4px">Missioni (stelle di processo)</h4>
          ${ms.map((m) => `<div class="small">${m.done ? '🏅' : '○'} ${esc(m.title)} <span class="${m.stars === 3 ? 'good' : 'muted'}">${m.sim ? '★'.repeat(m.stars) + '☆'.repeat(3 - m.stars) : T('(a scelta, senza stelle)')}</span></div>`).join('')}
          <h4 style="margin:8px 0 4px">Duelli e Diario</h4>
          <div class="small">Duelli vinti ${c('duel_win')} · persi ${c('duel_loss')} · perfetti ${c('duel_perfect')}</div>
          <div class="small">Operazioni annotate ${S.journal.length} · rilette ${reviewed.length} (coerenti ${coherent}, emotive ${emotional})</div>
          <h4 style="margin:8px 0 4px">Carattere</h4>
          <div class="small">Disciplina ${S.stats.disciplina} · Pazienza ${S.stats.pazienza} · Reputazione ${S.stats.reputazione} (${esc(tier.name)}${tier.next ? T`, prossimo grado a ${tier.next}` : ''})</div>
        </div>
      </div>
      <p class="small muted">Le stelle di processo premiano come hai investito (diversificazione, niente vendite nel panico, poche operazioni), non quanto hai guadagnato. Le domande sbagliate tornano nel Ripasso, alla Banca.</p>`;
    button(T('Glossario'), () => close('glossary'));
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
  if (r === 'glossary') await openGlossary();
}
