// Domande dei duelli coerenti con il posto (regole dell'utente, 15/11):
// - nel Laboratorio e sul Percorso 1 prima di Ponte Cedola si chiede solo ciò che ha spiegato la Mamma;
// - nelle città si chiede ciò che la Biblioteca della città spiega, e dopo un errore si rimanda a quella Biblioteca;
// - ogni sfidante fa domande nuove (anche le "gemelle", che chiedono la stessa cosa, contano come la stessa domanda).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { newGame, S } from '../src/systems/state';
import { pickQuestions, pickMomQuestions, recordAnswer, studiedTopics, targetDiff, timesSeen } from '../src/systems/quiz';
import { QUESTIONS, mentorTopics } from '../src/data/quiz/build';
import { MOM_QUESTIONS, MOM_GROUPS, TWINS, twinOf } from '../src/data/quiz/mom';
import { studyHint } from '../src/data/quiz/hint';
import { studyTown, localTopics, libraryTopics, momPlace } from '../src/world/studyplace';
import { mulberry32 } from '../src/systems/rng';

const story = readFileSync('src/world/scripts/story.ts', 'utf8');
const basics = story.slice(story.indexOf('const BASICS'), story.indexOf('export async function momIntro')).toLowerCase();

/** Per ogni domanda della Mamma, le parole che le sue nozioni devono contenere perché la risposta sia spiegata. */
const MOM_WORDS: Record<string, string[]> = {
  rischio_7: ['paper trading', 'denaro finto'],
  rischio_1: ['rischio e rendimento vanno insieme'], rischio_2: ['volatilità', 'su e giù'], rischio_19: ['tolleranza al rischio', 'reggere'],
  rischio_23: ['rischio di concentrazione', 'un solo titolo'], rischio_9: ['vendere in fretta', 'crollare il prezzo'],
  mixed_base_1: ['classi di attivo', 'obbligazioni', 'alternativi'], mixed_base_13: ['inflazione rosicchia'],
  stocks_base_1: ['pezzetto di proprietà'], stocks_base_2: ['domanda e offerta'], stocks_base_5: ['indice è un paniere'],
  stocks_base_9: ['growth', 'reinvestono gli utili'], stocks_base_11: ['capitalizzazione', 'moltiplicato per il numero di azioni'],
  etf_base_1: ['fondo quotato', 'replica'], etf_base_2: ['diversificazione immediata', 'costi bassi'], etf_base_5: ['s&p 500', '500 grandi aziende'],
  etf_base_9: ['orario di borsa'], etf_base_13: ['ucits'],
  crypto_base_1: ['blockchain', 'registro condiviso'], crypto_base_9: ['token'], crypto_base_5: ['giorno e notte'], crypto_base_2: ['oscillano molto più'],
};

describe('domande coerenti con il posto e uniche per sfidante', () => {
  beforeEach(() => { newGame(); S.track = 'listed'; S.mixedClasses = []; S.badges = 0; });

  it('ogni domanda della Mamma esiste ed è spiegata nelle sue nozioni, nel gruppo indicato', () => {
    expect(Object.keys(MOM_WORDS).sort()).toEqual(Object.keys(MOM_QUESTIONS).sort());
    for (const [id, words] of Object.entries(MOM_WORDS)) {
      expect(QUESTIONS.find((q) => q.id === id), id).toBeTruthy();
      for (const w of words) expect(basics, `${id}: ${w}`).toContain(w);
    }
    for (const g of MOM_GROUPS()) expect(story).toContain(`label: T('${g}')`);
  });

  it('Laboratorio e Percorso 1 (prima di Ponte Cedola) sono posti senza Biblioteca; dopo, il Percorso 1 vale per Ponte Cedola', () => {
    for (const m of ['lab', 'home', 't0', 'r1']) expect(momPlace(m), m).toBe(true);
    S.visited.push('t1');
    expect(studyTown('r1')).toBe(1);
    expect(studyTown('academy_1')).toBe(1);
    expect(studyTown('r3')).toBe(2);
    S.visited.push('t3');
    expect(studyTown('r3')).toBe(3);
  });

  it('Leo nel Laboratorio fa solo domande della Mamma, tutte diverse, e dopo un errore rimanda alla Mamma', () => {
    S.map = 'lab';
    const qs = pickMomQuestions(5, mulberry32(3));
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
    for (const q of qs) {
      expect(q.id in MOM_QUESTIONS).toBe(true);
      expect(studyHint(q)).toContain('Mamma');
    }
    expect(story).toContain('const qs = pickMomQuestions(P.n);');
  });

  it('Leo e gli sfidanti del Percorso 1 non si ripetono: 11 domande tutte diverse', () => {
    S.map = 'r1';
    const seen = new Set<string>();
    for (const n of [5, 3, 3]) for (const q of pickMomQuestions(n, mulberry32(n))) { expect(seen.has(q.id), q.id).toBe(false); seen.add(q.id); recordAnswer(q, false); }
  });

  it('in città il rimando dopo un errore è alla Biblioteca di quella città, con lo scaffale giusto', () => {
    S.badges = 3; S.visited.push('t1', 't2', 't3', 't4'); S.map = 'library_4';
    const q = QUESTIONS.find((x) => x.topic === 'rischio' && x.diff === 2)!;
    const h = studyHint(q);
    expect(h).toContain('Biblioteca di Interessa');
    expect(h).toContain('Città già attraversate');
    S.map = 'academy_3';
    const d = QUESTIONS.find((x) => x.topic === 'diversificazione')!;
    expect(studyHint(d)).toContain('Biblioteca di Diversia');
    expect(studyHint(d)).toContain('Temi di Diversia');
  });

  it('chi torna in una città già attraversata trova domande solo sui temi della sua Biblioteca', () => {
    S.badges = 5; S.visited.push('t1', 't2', 't3', 't4', 't5', 't6'); S.map = 't2';
    const topics = localTopics(studiedTopics());
    expect(topics.every((t) => libraryTopics(2).includes(t))).toBe(true);
    expect(topics).not.toContain(mentorTopics(4, 'listed', [])[0]);
    for (let i = 0; i < 30; i++) for (const q of pickQuestions(topics, 3, { target: targetDiff(5), rng: mulberry32(i) })) expect(libraryTopics(2), q.id).toContain(q.topic);
  });

  it('ogni sfidante di una tappa fa domande che nessun altro sfidante ha già fatto, finché ce ne sono', () => {
    S.visited.push('t1'); S.map = 'academy_1';
    const topics = mentorTopics(1, 'listed', []);
    const all = QUESTIONS.filter((q) => topics.includes(q.topic)).length;
    const seen = new Set<string>();
    let asked = 0;
    // due allievi e la Whale della prima città, più il rivale: 4 + 4 + 8 + 5 domande
    for (const [i, n] of [4, 4, 8, 5].entries()) {
      for (const q of pickQuestions(topics, n, { target: targetDiff(0), rng: mulberry32(i + 7), noGenerated: true })) {
        expect(seen.has(q.id) || seen.has(twinOf(q.id) ?? ''), q.id).toBe(false);
        seen.add(q.id); recordAnswer(q, i % 2 === 0); asked++;
      }
    }
    expect(asked).toBeLessThanOrEqual(all);
  });

  it('le domande gemelle non stanno mai nello stesso duello e, vista una, l\'altra conta come vista', () => {
    for (const [a, b] of TWINS) {
      expect(QUESTIONS.find((q) => q.id === a), a).toBeTruthy();
      expect(QUESTIONS.find((q) => q.id === b), b).toBeTruthy();
    }
    S.answered.ordini_4 = 1;
    expect(timesSeen('etf_base_11')).toBe(1);
    const topics = ['ordini', 'etf_base'] as const;
    for (let i = 0; i < 200; i++) {
      const ids = pickQuestions([...topics], 10, { target: 2, rng: mulberry32(i), noGenerated: true }).map((q) => q.id);
      expect(ids.includes('ordini_4') && ids.includes('etf_base_11')).toBe(false);
    }
  });

  it('nessuna domanda ha opzioni ripetute e nessuna risposta giusta compare uguale in due domande', () => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const q of QUESTIONS) expect(new Set(q.options.map(norm)).size, q.id).toBe(q.options.length);
    const answers = QUESTIONS.map((q) => norm(q.options[q.answer]));
    expect(new Set(answers).size).toBe(answers.length);
    const texts = QUESTIONS.map((q) => norm(q.q));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('Sentiero Cripto: Leo, Percorso 1, allievi e Whale di Ponte Cedola senza una domanda ripetuta', () => {
    S.track = 'crypto';
    const seen = new Set<string>();
    const ask = (qs: { id: string }[]) => { for (const q of qs) { expect(seen.has(q.id), q.id).toBe(false); seen.add(q.id); recordAnswer(q as never, true); } };
    S.map = 'lab'; ask(pickMomQuestions(5, mulberry32(1)));
    S.map = 'r1'; ask(pickMomQuestions(3, mulberry32(2))); ask(pickMomQuestions(3, mulberry32(3)));
    S.visited.push('t1'); S.map = 'academy_1';
    for (const [i, n] of [4, 4, 8].entries()) ask(pickQuestions(mentorTopics(1, 'crypto', []), n, { target: targetDiff(0), rng: mulberry32(10 + i), noGenerated: true }));
    // le cripto della prima città spiegano anche exchange centralizzati e decentralizzati, nodi, hash, layer 2 e fork
    expect(QUESTIONS.filter((q) => q.topic === 'crypto_base' && q.diff === 1).length).toBeGreaterThanOrEqual(12);
  });
});
