import { describe, it, expect, beforeEach } from 'vitest';
import { newGame } from '../src/systems/state';
import { pickQuestions, targetDiff, diffMix, STAGE_LEAGUE } from '../src/systems/quiz';
import { mentorTopics, LEAGUE_TOPICS, byTopic, trackTopics } from '../src/data/quiz/build';
import type { AssetClass, QuizTopic, Track } from '../src/types';

const TRACKS: [Track, AssetClass[]][] = [['stocks', []], ['etf', []], ['crypto', []], ['mixed', ['stocks', 'etf']], ['mixed', ['etf', 'crypto']], ['mixed', ['stocks', 'etf', 'crypto']]];
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
  beforeEach(() => { newGame('Test', 0, 'stocks', 'equilibrato'); });

  it('la difficoltà bersaglio sale di un quarto di livello a ogni tappa, da 1 a 4', () => {
    expect(targetDiff(0)).toBe(1);
    expect(targetDiff(8)).toBe(3);
    expect(targetDiff(STAGE_LEAGUE + 3)).toBe(4);
    for (let s = 1; s <= 12; s++) expect(targetDiff(s)).toBeGreaterThan(targetDiff(s - 1));
  });

  it('il mix di livelli rispetta il numero di domande e la media', () => {
    const mix = diffMix(8, 1.75);
    expect(mix.get(1)).toBe(2);
    expect(mix.get(2)).toBe(6);
    expect(diffMix(10, 4).get(4)).toBe(10);
  });

  it('ogni Mentore, Superiore e il Campione hanno abbastanza domande al livello giusto (nessun ripiego)', () => {
    for (const [t, mixed] of TRACKS) for (const d of storyDuels(t, mixed)) {
      for (const [level, k] of diffMix(d.n, d.target)) expect(count(d.topics, level), `${t}/${mixed.join('+')} ${d.name}: livello ${level}`).toBeGreaterThanOrEqual(k);
    }
  });

  it('i Mentori restano a 8 domande e la media sale lungo la storia fino alla Lega', () => {
    for (const [t, mixed] of TRACKS) {
      let prev = 0;
      for (const d of storyDuels(t, mixed)) {
        const qs = pickQuestions(d.topics, d.n, { target: d.target });
        expect(qs.length, d.name).toBe(d.n);
        expect(new Set(qs.map((q) => q.id)).size, d.name).toBe(d.n);
        const a = avg(qs);
        expect(a, `${t} ${d.name}`).toBeCloseTo(d.target, 1);
        expect(a, `${t} ${d.name}`).toBeGreaterThanOrEqual(prev);
        prev = a;
      }
    }
  });

  it('il primo Mentore fa solo domande base, il Campione solo domande da esperto', () => {
    const first = pickQuestions(mentorTopics(1, 'etf', []), 8, { target: targetDiff(0) });
    expect(first.every((q) => q.diff === 1)).toBe(true);
    const champ = pickQuestions(trackTopics('crypto', [], 8), 12, { target: targetDiff(STAGE_LEAGUE + 3) });
    expect(champ.every((q) => q.diff === 4)).toBe(true);
  });

  it('le domande da esperto (livello 4) compaiono solo nella Lega, non nei duelli delle Accademie', () => {
    for (const [t, mixed] of TRACKS) for (let m = 1; m <= 8; m++) {
      const qs = pickQuestions(mentorTopics(m, t, mixed), 8, { target: targetDiff(m - 1) });
      expect(qs.some((q) => q.diff === 4), `${t} M${m}`).toBe(false);
    }
  });
});
