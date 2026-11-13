import { describe, it, expect } from 'vitest';
import { QUESTIONS, mentorTopics, LEAGUE_TOPICS, byTopic } from '../src/data/quiz/build';
import { SOURCES } from '../src/data/sources';
import { LESSONS } from '../src/data/lessons';
import { ASSETS } from '../src/data/assets';
import type { AssetClass, Track } from '../src/types';

describe('quiz', () => {
  it('ogni domanda è ben formata e cita una fonte esistente', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options).size, `${q.id} ha opzioni duplicate`).toBe(q.options.length);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.explain.length, q.id).toBeGreaterThan(10);
      expect(SOURCES[q.source], `${q.id}: fonte ${q.source}`).toBeDefined();
    }
  });
  it('id delle domande unici e testi non ripetuti', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(new Set(QUESTIONS.map((q) => q.q)).size).toBe(QUESTIONS.length);
  });
  it('ogni Mentore di ogni percorso ha abbastanza domande per un duello da 8', () => {
    const tracks: [Track, AssetClass[]][] = [['listed', []], ['crypto', []], ['mixed', []]];
    for (const [t, mixed] of tracks) for (let m = 1; m <= 8; m++) {
      const n = mentorTopics(m, t, mixed).reduce((s, top) => s + byTopic(top).length, 0);
      expect(n, `${t} M${m}`).toBeGreaterThanOrEqual(8);
    }
    for (const topics of LEAGUE_TOPICS) expect(topics.reduce((s, t) => s + byTopic(t).length, 0)).toBeGreaterThanOrEqual(8);
  });
});

describe('contenuti', () => {
  it('le lezioni citano fonti esistenti', () => {
    for (const l of LESSONS) expect(SOURCES[l.source], l.id).toBeDefined();
  });
  it('le fonti sono https', () => {
    for (const s of Object.values(SOURCES)) expect(s.url).toMatch(/^https:\/\//);
  });
  it('asset con id unici e parametri plausibili', () => {
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length);
    for (const a of ASSETS) { expect(a.sigma).toBeGreaterThan(0); expect(a.sigma).toBeLessThan(2); expect(a.risk).toBeGreaterThanOrEqual(1); }
  });
});
