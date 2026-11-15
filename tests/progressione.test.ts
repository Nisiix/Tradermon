// Regola del mondo (utente, 15/11): le domande seguono il viaggio. Nessun duello chiede un concetto prima della città
// in cui il viaggio lo insegna (leva a Rocca Rischio, pool e DeFi a Valdividendo, spread a Porto Ordini...), e il
// livello cresce con la storia. Vale per tutti i Sentieri: azioni ed ETF, cripto, misto.
import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { pickQuestions, targetDiff, studiedTopics, recordAnswer, progressCity, dailyQuestion } from '../src/systems/quiz';
import { QUESTIONS, mentorTopics } from '../src/data/quiz/build';
import { questionCity, conceptCity } from '../src/data/quiz/progress';
import { BOOKS } from '../src/data/books';
import { mulberry32 } from '../src/systems/rng';
import type { AssetClass, Track } from '../src/types';

const TRACKS: [Track, AssetClass[]][] = [['listed', []], ['crypto', []], ['mixed', ['stocks', 'crypto']]];
const asks = (text: string, w: string) => new RegExp(`(^|[^a-zà-ù])${w}([^a-zà-ù]|$)`, 'i').test(text);

describe('le domande seguono il viaggio', () => {
  beforeEach(() => { newGame(); });

  it('leva, pool, DeFi, dividendi, spread e correlazione non si chiedono prima della loro città', () => {
    const rules: [string, number][] = [['leva', 8], ['pool', 6], ['defi', 6], ['dividendo', 6], ['spread', 2], ['correlazione', 3], ['stop loss', 2], ['ter', 4]];
    for (const q of QUESTIONS) {
      const text = `${q.q} ${q.options[q.answer]}`;
      for (const [w, city] of rules) if (asks(text, w)) expect(conceptCity(q), `${q.id}: ${w}`).toBeGreaterThanOrEqual(city);
    }
    expect(questionCity(QUESTIONS.find((q) => q.id === 'etf_base_8')!, 'listed')).toBe(8);
    expect(questionCity(QUESTIONS.find((q) => q.id === 'crypto_stable_15')!, 'crypto')).toBe(6);
  });

  it('lungo tutto il viaggio, per ogni Sentiero, nessun duello va oltre la città raggiunta né oltre il livello della storia', () => {
    for (const [track, mixed] of TRACKS) {
      newGame(); S.track = track; S.mixedClasses = [...mixed];
      S.booksRead.push(...BOOKS.map((b) => b.id)); // caso peggiore: ogni libro già aperto
      for (let b = 0; b < 8; b++) {
        S.badges = b;
        const city = progressCity();
        expect(city).toBe(b + 1);
        const check = (qs: ReturnType<typeof pickQuestions>, target: number) => {
          for (const q of qs) {
            expect(questionCity(q, track, mixed), `${track} città ${city}: ${q.id}`).toBeLessThanOrEqual(city);
            expect(q.diff, `${track} città ${city}: ${q.id}`).toBeLessThanOrEqual(Math.max(2, Math.ceil(target)));
            recordAnswer(q, true);
          }
        };
        for (let k = 0; k < 8; k++) check(pickQuestions(studiedTopics(), 3, { target: targetDiff(b), rng: mulberry32(b * 10 + k) }), targetDiff(b));
        check(pickQuestions(mentorTopics(b + 1, track, mixed), 8, { target: targetDiff(b), city: b + 1, rng: mulberry32(b) }), targetDiff(b));
        expect(questionCity(dailyQuestion(), track, mixed)).toBeLessThanOrEqual(city);
      }
    }
  });

  it('ogni città ha domande nuove: i concetti si distribuiscono lungo il viaggio, non tutti all\'inizio', () => {
    for (const [track, mixed] of TRACKS) {
      const cities = QUESTIONS.filter((q) => q.topic !== 'grotte').map((q) => questionCity(q, track, mixed));
      for (let c = 1; c <= 8; c++) expect(cities.filter((x) => x === c).length, `${track} città ${c}`).toBeGreaterThan(5);
    }
  });
});
