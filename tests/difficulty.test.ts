import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { pickQuestions, targetDiff, diffMix, STAGE_LEAGUE, endgameDiff, STORY_MAX } from '../src/systems/quiz';
import { BOSSES } from '../src/systems/boss';
import { DIFFICULTIES } from '../src/systems/balance';
import { mentorTopics, LEAGUE_TOPICS, byTopic, trackTopics } from '../src/data/quiz/build';
import type { AssetClass, QuizTopic, Track } from '../src/types';

const TRACKS: [Track, AssetClass[]][] = [['listed', []], ['crypto', []], ['mixed', []]];
const avg = (xs: { diff: number }[]) => xs.reduce((s, q) => s + q.diff, 0) / xs.length;
const count = (topics: QuizTopic[], d: number) => topics.flatMap((t) => byTopic(t)).filter((q) => q.diff === d).length;

/** Gli 8 duelli dei Mentori + i 4 Superiori + il Campione, in ordine di storia. */
function storyDuels(track: Track, mixed: AssetClass[]) {
  const out: { name: string; topics: QuizTopic[]; n: number; target: number }[] = [];
  for (let m = 1; m <= 8; m++) out.push({ name: `Mentore ${m}`, topics: mentorTopics(m, track, mixed), n: 8, target: targetDiff(m - 1) });
  LEAGUE_TOPICS.forEach((topics, i) => out.push({ name: `Superiore ${i + 1}`, topics, n: 10, target: targetDiff(STAGE_LEAGUE + i) }));
  out.push({ name: 'Campione', topics: trackTopics(track, mixed, 8), n: 12, target: targetDiff(STAGE_LEAGUE + 3) });
  return out;
}

describe('difficoltà progressiva delle domande', () => {
  beforeEach(() => { newGame(); S.difficulty = 'stratega'; });

  it('la difficoltà bersaglio sale lungo la storia: 1 alla prima Whale, 3 dopo l\'ottava, 3,5 al Campione', () => {
    expect(targetDiff(0)).toBe(1);
    expect(targetDiff(8)).toBe(3);
    expect(targetDiff(STAGE_LEAGUE + 3)).toBe(3.5);
    for (let s = 1; s <= 12; s++) expect(targetDiff(s)).toBeGreaterThan(targetDiff(s - 1));
  });

  it('la difficoltà scelta sposta la curva: uguale all\'inizio, più bassa o più alta a Wall Street', () => {
    const top: number[] = [];
    // Leggenda si gioca solo in Nuova Partita+: la si misura con un giro di NG+
    for (const d of DIFFICULTIES) {
      S.difficulty = d; S.ngPlus = d === 'leggenda' ? 1 : 0;
      if (d !== 'leggenda') expect(targetDiff(0), d).toBe(1);
      top.push(targetDiff(STAGE_LEAGUE + 3));
    }
    for (let k = 1; k < top.length; k++) expect(top[k]).toBeGreaterThan(top[k - 1]);
  });

  it('il fine gioco è sempre più difficile dell\'ultimo duello di Wall Street, per ogni difficoltà e Nuova Partita+', () => {
    for (const d of DIFFICULTIES) for (const ng of [0, 1, 2]) {
      S.difficulty = d; S.ngPlus = ng;
      expect(targetDiff(STAGE_LEAGUE + 3), `${d} NG+${ng}`).toBeLessThanOrEqual(STORY_MAX);
      expect(endgameDiff(), `${d} NG+${ng}`).toBeGreaterThan(targetDiff(STAGE_LEAGUE + 3));
    }
  });

  it('il mix di livelli rispetta il numero di domande e la media', () => {
    const mix = diffMix(8, 1.75);
    expect(mix.get(1)).toBe(2);
    expect(mix.get(2)).toBe(6);
    expect(diffMix(10, 4).get(4)).toBe(10);
  });

  it('ogni Whale, Superiore, il Campione e i Boss hanno abbastanza domande al livello giusto, per ogni difficoltà (nessun ripiego)', () => {
    for (const diff of DIFFICULTIES) {
      S.difficulty = diff;
      for (const [t, mixed] of TRACKS) {
        const duels = [...storyDuels(t, mixed), ...BOSSES.map((b) => ({ name: b.name, topics: b.topics, n: 8, target: endgameDiff() }))];
        for (const d of duels) for (const [level, k] of diffMix(d.n, d.target)) expect(count(d.topics, level), `${diff} ${t}/${mixed.join('+')} ${d.name}: livello ${level}`).toBeGreaterThanOrEqual(k);
      }
    }
  });

  it('le Whale restano a 8 domande e la media segue il bersaglio, che sale fino a Wall Street', () => {
    for (const diff of DIFFICULTIES) {
      S.difficulty = diff;
      for (const [t, mixed] of TRACKS) {
        let prev = 0;
        for (const d of storyDuels(t, mixed)) {
          const qs = pickQuestions(d.topics, d.n, { target: d.target });
          expect(qs.length, d.name).toBe(d.n);
          expect(new Set(qs.map((q) => q.id)).size, d.name).toBe(d.n);
          expect(avg(qs), `${diff} ${t} ${d.name}`).toBeCloseTo(d.target, 1);
          expect(d.target, `${diff} ${t} ${d.name}`).toBeGreaterThanOrEqual(prev);
          prev = d.target;
        }
      }
    }
  });

  it('la prima Whale fa solo domande base; il quiz dei Boss ha una media più alta del Campione', () => {
    const first = pickQuestions(mentorTopics(1, 'listed', []), 8, { target: targetDiff(0) });
    expect(first.every((q) => q.diff === 1)).toBe(true);
    for (const diff of DIFFICULTIES) {
      S.difficulty = diff;
      const champ = avg(pickQuestions(trackTopics('crypto', [], 8), 12, { target: targetDiff(STAGE_LEAGUE + 3) }));
      for (const b of BOSSES) expect(avg(pickQuestions(b.topics, 8, { target: endgameDiff() })), `${diff} ${b.id}`).toBeGreaterThan(champ);
    }
    S.difficulty = 'stratega';
    for (const b of BOSSES) expect(pickQuestions(b.topics, 8, { target: endgameDiff() }).every((q) => q.diff === 4)).toBe(true);
  });

  it('le domande da esperto (livello 4) non compaiono nei duelli delle Whale', () => {
    for (const diff of DIFFICULTIES) {
      S.difficulty = diff;
      for (const [t, mixed] of TRACKS) for (let m = 1; m <= 8; m++) {
        const qs = pickQuestions(mentorTopics(m, t, mixed), 8, { target: targetDiff(m - 1) });
        expect(qs.some((q) => q.diff === 4), `${diff} ${t} M${m}`).toBe(false);
      }
    }
  });
});
