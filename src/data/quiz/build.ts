import type { Question, QuizTopic, Track, AssetClass } from '../../types';
import * as C from './core';
import * as TR from './tracks';
import { T } from '../../i18n';
import { classesOf } from '../assets';

/** Riga di una domanda: [difficoltà, domanda, giusta, sbagliata×3, spiegazione, fonte, id?].
 *  L'id esplicito (9° elemento) tiene stabile il riferimento nei salvataggi anche se si riordinano o inseriscono righe;
 *  se manca, l'id è posizionale (`argomento_N`). */
export type QRow = [1 | 2 | 3 | 4, string, string, string, string, string, string, string, string?];

function build(topic: QuizTopic, rows: QRow[]): Question[] {
  return rows.map((r, i) => ({
    id: r[8] ?? `${topic}_${i + 1}`,
    topic,
    diff: r[0],
    q: r[1],
    options: [r[2], r[3], r[4], r[5]],
    answer: 0,
    explain: r[6],
    source: r[7],
  }));
}

const TABLE: Record<QuizTopic, QRow[]> = {
  rischio: C.RISCHIO,
  ordini: C.ORDINI,
  diversificazione: C.DIVERSIFICAZIONE,
  costi: C.COSTI,
  bias: C.BIAS,
  gestione: C.GESTIONE,
  macro: C.MACRO,
  analisi: C.ANALISI,
  regole: C.REGOLE,
  stocks_base: TR.STOCKS_BASE,
  stocks_bilanci: TR.STOCKS_BILANCI,
  stocks_dividendi: TR.STOCKS_DIVIDENDI,
  etf_base: TR.ETF_BASE,
  etf_replica: TR.ETF_REPLICA,
  etf_obbligazioni: TR.ETF_OBBLIGAZIONI,
  crypto_base: TR.CRYPTO_BASE,
  crypto_custodia: TR.CRYPTO_CUSTODIA,
  crypto_stable: TR.CRYPTO_STABLE,
  mixed_base: TR.MIXED_BASE,
  mixed_allocazione: TR.MIXED_ALLOCAZIONE,
};

export const QUESTIONS: Question[] = (Object.keys(TABLE) as QuizTopic[]).flatMap((t) => build(t, TABLE[t]));
export const BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
if (Object.keys(BY_ID).length !== QUESTIONS.length) {
  const seen = new Set<string>();
  const dup = QUESTIONS.map((q) => q.id).filter((id) => seen.size === seen.add(id).size);
  throw new Error(T`Id domanda duplicati: ${dup.join(', ')}`);
}

export function byTopic(topic: QuizTopic): Question[] {
  return QUESTIONS.filter((q) => q.topic === topic);
}

const A_TOPIC: Record<AssetClass, QuizTopic> = { stocks: 'stocks_bilanci', etf: 'etf_replica', crypto: 'crypto_custodia' };
const B_TOPIC: Record<AssetClass, QuizTopic> = { stocks: 'stocks_dividendi', etf: 'etf_obbligazioni', crypto: 'crypto_stable' };
const BASE_TOPIC: Record<AssetClass, QuizTopic> = { stocks: 'stocks_base', etf: 'etf_base', crypto: 'crypto_base' };

/** Argomenti di ciascuna Whale (1..8) in base al percorso. */
export function mentorTopics(n: number, track: Track, mixed: AssetClass[]): QuizTopic[] {
  const classes = classesOf(track, mixed);
  switch (n) {
    case 1: return track === 'mixed' ? ['mixed_base', 'rischio'] : [...classes.map((c) => BASE_TOPIC[c]), 'rischio'];
    case 2: return ['ordini'];
    case 3: return ['diversificazione'];
    case 4: return ['costi'];
    case 5: return track === 'mixed' ? ['mixed_allocazione'] : classes.map((c) => A_TOPIC[c]);
    case 6: return classes.map((c) => B_TOPIC[c]).concat(track === 'mixed' ? classes.map((c) => A_TOPIC[c]) : []);
    case 7: return ['bias'];
    case 8: return ['gestione'];
    default: return ['rischio'];
  }
}

/** Argomenti accessibili al giocatore (domande lampo, Torre, ripasso). */
export function trackTopics(track: Track, mixed: AssetClass[], badges: number): QuizTopic[] {
  const out = new Set<QuizTopic>();
  for (let i = 1; i <= Math.max(1, Math.min(8, badges + 1)); i++) mentorTopics(i, track, mixed).forEach((t) => out.add(t));
  if (badges >= 8) ['macro', 'analisi', 'regole'].forEach((t) => out.add(t as QuizTopic));
  return [...out];
}

export const LEAGUE_TOPICS: QuizTopic[][] = [['macro'], ['analisi'], ['regole'], ['bias', 'gestione']];
