import { describe, it, expect, beforeEach } from 'vitest';
import { QUESTIONS, BY_ID } from '../src/data/quiz/build';
import { TEMPLATES, generate, isGenerated } from '../src/data/quiz/generated';
import { SOURCES } from '../src/data/sources';
import { newGame, S } from '../src/systems/state';
import { pickQuestions, generatedCount, recordAnswer, targetDiff } from '../src/systems/quiz';
import { mentorTopics } from '../src/data/quiz/build';
import { mulberry32 } from '../src/systems/rng';
import { studyHint } from '../src/data/quiz/hint';

const lens = (o: string[]) => o.map((x) => x.length);
const longest = (o: string[]) => { const l = lens(o); return l[0] > Math.max(l[1], l[2], l[3]); };

describe('qualità delle domande: la forma non tradisce la risposta', () => {
  it('id unici, quattro opzioni distinte, spiegazione e fonte presenti', () => {
    expect(Object.keys(BY_ID).length).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.explain.length, q.id).toBeGreaterThan(20);
      expect(SOURCES[q.source], `${q.id}: fonte ${q.source}`).toBeTruthy();
    }
  });

  it('almeno 12 domande per argomento', () => {
    const by: Record<string, number> = {};
    for (const q of QUESTIONS) by[q.topic] = (by[q.topic] ?? 0) + 1;
    for (const [t, n] of Object.entries(by)) expect(n, t).toBeGreaterThanOrEqual(12);
  });

  it('la risposta giusta non è mai molto più lunga delle sbagliate', () => {
    for (const q of QUESTIONS) {
      const l = lens(q.options);
      if (l[0] <= 8) continue; // numeri e sigle: la lunghezza non dice nulla
      expect(l[0], `${q.id}: la giusta è troppo più lunga`).toBeLessThanOrEqual(Math.max(l[1], l[2], l[3]) * 1.25);
    }
  });

  it('in nessun argomento "scegli la più lunga" funziona più di metà delle volte', () => {
    const by: Record<string, { n: number; long: number }> = {};
    for (const q of QUESTIONS) {
      const t = (by[q.topic] ??= { n: 0, long: 0 });
      t.n++;
      if (longest(q.options)) t.long++;
    }
    for (const [t, v] of Object.entries(by)) expect(v.long / v.n, `${t}: ${v.long}/${v.n}`).toBeLessThanOrEqual(0.5);
    const tot = Object.values(by).reduce((a, v) => ({ n: a.n + v.n, long: a.long + v.long }), { n: 0, long: 0 });
    expect(tot.long / tot.n).toBeLessThanOrEqual(0.45);
  });
});

describe('domande generate con numeri nuovi', () => {
  beforeEach(() => { newGame('Test', 0, 'stocks', 'equilibrato'); });

  it('ogni modello produce domande valide e bilanciate su molti semi', () => {
    for (const t of TEMPLATES) {
      let made = 0, long = 0;
      const texts = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) {
        const q = generate(t, t.topics[0], mulberry32(seed));
        if (!q) continue;
        made++;
        texts.add(q.q);
        expect(new Set(q.options).size, `${t.id} seme ${seed}`).toBe(4);
        expect(q.answer).toBe(0);
        expect(q.explain.length).toBeGreaterThan(20);
        expect(SOURCES[q.source]).toBeTruthy();
        if (longest(q.options) && q.options[0].length > 8) long++;
      }
      expect(made, t.id).toBeGreaterThanOrEqual(45);
      expect(texts.size, `${t.id}: numeri sempre uguali`).toBeGreaterThanOrEqual(8);
      expect(long / made, `${t.id}: la giusta è la più lunga troppo spesso`).toBeLessThanOrEqual(0.5);
    }
  });

  it('un duello ha fino a una domanda generata ogni tre, senza cambiare il mix di difficoltà', () => {
    for (const [track, mixed] of [['stocks', []], ['etf', []], ['crypto', []], ['mixed', ['stocks', 'etf', 'crypto']]] as const) for (let m = 1; m <= 8; m++) {
      const topics = mentorTopics(m, track, [...mixed]);
      const target = targetDiff(m - 1);
      const qs = pickQuestions(topics, 8, { target, rng: mulberry32(m) });
      const gen = qs.filter((q) => isGenerated(q.id));
      expect(gen.length, `${track} Mentore ${m}`).toBeGreaterThanOrEqual(1);
      expect(gen.length, `${track} Mentore ${m}`).toBeLessThanOrEqual(generatedCount(8));
      expect(qs.reduce((s, q) => s + q.diff, 0) / 8).toBeCloseTo(target, 1);
      for (const g of gen) expect(topics, `${g.id} fuori argomento`).toContain(g.topic);
    }
    expect(generatedCount(3)).toBe(1);
    expect(generatedCount(12)).toBe(4);
  });

  it('una sfida condivisa dà le stesse domande e gli stessi numeri a tutti', () => {
    const a = pickQuestions(['rischio', 'ordini', 'costi'], 5, { rng: mulberry32(42), shared: true });
    const b = pickQuestions(['rischio', 'ordini', 'costi'], 5, { rng: mulberry32(42), shared: true });
    expect(a.map((q) => q.q)).toEqual(b.map((q) => q.q));
    expect(a.some((q) => isGenerated(q.id))).toBe(true);
  });

  it('le generate non entrano nel ripasso ma danno Conoscenza; noGenerated le esclude', () => {
    const q = generate(TEMPLATES[0], 'rischio', mulberry32(3))!;
    const xp = S.stats.xp;
    recordAnswer(q, true);
    expect(S.stats.xp).toBeGreaterThan(xp);
    expect(S.review[q.id]).toBeUndefined();
    expect(S.answered[q.id]).toBeUndefined();
    const qs = pickQuestions(['rischio'], 6, { target: 1.5, noGenerated: true });
    expect(qs.some((x) => isGenerated(x.id))).toBe(false);
  });

  it('dopo un errore il suggerimento rimanda a un libro della Biblioteca o a una fonte', () => {
    const withBook = QUESTIONS.find((q) => q.topic === 'rischio')!;
    expect(studyHint(withBook)).toContain('Rileggi');
    expect(studyHint(withBook)).toContain('Ponte Cedola');
    const league = QUESTIONS.find((q) => q.topic === 'macro')!;
    expect(studyHint(league).length).toBeGreaterThan(0);
  });
});
