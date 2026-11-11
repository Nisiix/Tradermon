// Cartella dello studente: cosa sai, cosa no e dove andare a studiare. Riunisce ripasso, missioni, duelli,
// Diario e carattere in una pagina sola, con un suggerimento concreto per il prossimo passo.
import { modal, esc, bar } from './core';
import { S } from '../systems/state';
import { byTopic, trackTopics } from '../data/quiz/build';
import { TOPIC_LABEL, booksFor } from '../data/books';
import { townForTopic } from '../data/quiz/hint';
import { isDue } from '../systems/quiz';
import { repTier } from '../systems/character';
import { mentorMission } from '../data/missions';
import { mentor } from '../data/story';
import type { QuizTopic } from '../types';

export interface TopicCard { topic: QuizTopic; known: number; total: number; due: number; wrong: number }

/** Stato di ogni argomento del percorso: domande padroneggiate (scatola ≥ 3), in scadenza, sbagliate di recente. */
export function topicCards(): TopicCard[] {
  const topics = [...trackTopics(S.track, S.mixedClasses, 8), 'macro', 'analisi', 'regole'] as QuizTopic[];
  return [...new Set(topics)].map((topic) => {
    const qs = byTopic(topic);
    return {
      topic,
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
    out.push({ id: ms.id, title: ms.title, stars: Number(S.flags[`${ms.id}_stars`] ?? 0), done: S.badges >= m, sim: ms.kind === 'sim' });
  }
  return out;
}

export function nextStep(cards: TopicCard[]): string {
  const due = cards.reduce((s, c) => s + c.due, 0);
  if (due >= 3) return `Hai ${due} domande in scadenza: un ripasso in Accademia o la domanda del giorno le rimettono in ordine.`;
  const w = weakest(cards)[0];
  if (w && w.known / w.total < 0.5) {
    const book = booksFor([w.topic]).find((b) => !b.id.endsWith('_ctx'));
    const town = townForTopic(w.topic);
    return book ? `L'argomento più debole è «${TOPIC_LABEL[w.topic]}»: rileggi «${book.title}»${town ? ` nella Biblioteca di ${town}` : ''}, poi sfida gli allievi.` : `L'argomento più debole è «${TOPIC_LABEL[w.topic]}»: le Lezioni dal menu lo coprono.`;
  }
  const ms = missionStars().find((m) => m.sim && m.done && m.stars < 3);
  if (ms) return `La missione «${ms.title}» ha ${ms.stars}/3 stelle di processo: puoi ripeterla dal Mentore per migliorarle.`;
  if (S.badges < 8) return `Prossimo Mentore: ${mentor(S.badges + 1, S.track).name}. Prima passa dalla Sezione del Mentore in Biblioteca.`;
  return 'Percorso completo: la Lega e la Torre delle Sfide ti aspettano. Rileggi il Diario per allenare il senno di poi.';
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
  await modal('Cartella dello studente', ({ body, button, close }) => {
    body.innerHTML = `
      <p><b>Prossimo passo:</b> ${esc(nextStep(cards))}</p>
      <div class="grid2">
        <div>
          <h4 style="margin:4px 0">Argomenti</h4>
          ${cards.map((k) => `<div class="small">${esc(TOPIC_LABEL[k.topic])} <span class="muted">${k.known}/${k.total}</span>${k.due ? ` <span class="bad">· ${k.due} da ripassare</span>` : ''}${bar((k.known / k.total) * 100)}</div>`).join('')}
        </div>
        <div>
          <h4 style="margin:4px 0">Da rafforzare</h4>
          ${weak.length ? weak.map((k) => { const b = booksFor([k.topic]).find((x) => !x.id.endsWith('_ctx')); const t = townForTopic(k.topic); return `<div class="small"><b>${esc(TOPIC_LABEL[k.topic])}</b>${k.wrong ? ` · ${k.wrong} sbagliate` : ''}${b ? `<br><span class="muted">📖 «${esc(b.title)}»${t ? `, Biblioteca di ${esc(t)}` : ''}</span>` : ''}</div>`; }).join('') : '<p class="small muted">Ancora nessun duello: tutto da scoprire.</p>'}
          <h4 style="margin:8px 0 4px">Missioni (stelle di processo)</h4>
          ${ms.map((m) => `<div class="small">${m.done ? '🏅' : '○'} ${esc(m.title)} <span class="${m.stars === 3 ? 'good' : 'muted'}">${m.sim ? '★'.repeat(m.stars) + '☆'.repeat(3 - m.stars) : '(a scelta, senza stelle)'}</span></div>`).join('')}
          <h4 style="margin:8px 0 4px">Duelli e Diario</h4>
          <div class="small">Duelli vinti ${c('duel_win')} · persi ${c('duel_loss')} · perfetti ${c('duel_perfect')}</div>
          <div class="small">Operazioni annotate ${S.journal.length} · rilette ${reviewed.length} (coerenti ${coherent}, emotive ${emotional})</div>
          <h4 style="margin:8px 0 4px">Carattere</h4>
          <div class="small">Disciplina ${S.stats.disciplina} · Pazienza ${S.stats.pazienza} · Reputazione ${S.stats.reputazione} (${esc(tier.name)}${tier.next ? `, prossimo grado a ${tier.next}` : ''})</div>
        </div>
      </div>
      <p class="small muted">Le stelle di processo premiano come hai investito (diversificazione, niente vendite nel panico, poche operazioni), non quanto hai guadagnato.</p>`;
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}
