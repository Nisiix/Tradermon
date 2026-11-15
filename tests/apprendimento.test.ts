import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S } from '../src/systems/state';
import { compoundPath, portfolioVol, recoveryNeeded } from '../src/ui/labs';
import { readGrace, READ_GRACE } from '../src/systems/balance';
import { BOOKS, BOOK_BY_ID, STORY_BOOKS } from '../src/data/books';
import { GLOSSARY } from '../src/data/glossary';
import { FIGURES } from '../src/ui/figures';
import { ACADEMY_TOPICS, studiedTopics, OPEN_ANYTIME } from '../src/systems/quiz';
import { getMap, ACADEMY_MAP } from '../src/world/maps';
import { GROUPS, ENTRIES } from '../src/ui/menu';
import { HISTORY } from '../src/data/missions';

// Percorso di apprendimento (proposte A, B, C, I): laboratori, tempo di lettura, libri, Accademia, menu.
describe('apprendimento', () => {
  beforeEach(() => { newGame(); });

  it('laboratori: i conti seguono le formule', () => {
    const p = compoundPath(0.06, 0.015, 30);
    expect(p).toHaveLength(31);
    expect(p[30]).toBeCloseTo(10000 * 1.045 ** 30, 6);
    expect(compoundPath(0.06, 0, 10)[10]).toBeGreaterThan(compoundPath(0.06, 0.01, 10)[10]);
    expect(portfolioVol(1, 0.3, 0.3)).toBeCloseTo(0.3, 9);
    expect(portfolioVol(50, 0.3, 0.3)).toBeLessThan(portfolioVol(5, 0.3, 0.3));
    expect(portfolioVol(1e9, 0.3, 0)).toBeCloseTo(0, 3);
    expect(recoveryNeeded(0.5)).toBeCloseTo(1, 9);
    expect(recoveryNeeded(0.3)).toBeGreaterThan(0.3);
    expect(recoveryNeeded(1)).toBe(Infinity);
  });

  it('il tempo di lettura del duello resta tra il minimo e il massimo', () => {
    expect(readGrace(0)).toBe(READ_GRACE.min);
    expect(readGrace(10000)).toBe(READ_GRACE.max);
    expect(readGrace(240)).toBe(4);
  });

  it('ogni parola del glossario rimanda a un libro che esiste, e ogni figura dei libri esiste', () => {
    for (const g of GLOSSARY) expect(BOOK_BY_ID[g.book], g.id).toBeTruthy();
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    for (const b of BOOKS) for (const f of Object.values(b.figs ?? {})) expect(FIGURES[f], `${b.id}:${f}`).toBeTruthy();
  });

  it('le Storie dei mercati coprono tutte le crisi storiche e non entrano nelle Lezioni', () => {
    expect(STORY_BOOKS.length).toBe(Object.keys(HISTORY).length);
    for (const s of STORY_BOOKS) {
      expect(BOOK_BY_ID[s.id]).toBe(s);
      expect(BOOKS.includes(s)).toBe(false);
    }
  });

  it('i temi dell\'Accademia non si aprono prima del titolo di Campione e non entrano nei duelli normali', () => {
    S.badges = 8;
    for (const t of ACADEMY_TOPICS) S.booksRead.push(...BOOKS.filter((b) => b.topic === t).map((b) => b.id));
    const st = studiedTopics();
    for (const t of ACADEMY_TOPICS) expect(st).not.toContain(t);
  });

  it('regole, finanza personale e tassi si aprono leggendo, a qualsiasi tappa', () => {
    S.badges = 0;
    expect(studiedTopics().some((t) => OPEN_ANYTIME.includes(t))).toBe(false);
    S.booksRead.push(BOOKS.find((b) => b.topic === 'personale')!.id);
    expect(studiedTopics()).toContain('personale');
  });

  it('l\'Accademia ha tre Tutor, uno per tema, e la Rettrice', () => {
    const m = getMap(ACADEMY_MAP);
    const tutors = m.npcs.filter((n) => n.kind === 'tutor').map((n) => n.data?.topic);
    expect(tutors.sort()).toEqual([...ACADEMY_TOPICS].sort());
    expect(m.npcs.some((n) => n.kind === 'rector')).toBe(true);
  });

  it('il menu a gruppi contiene ogni voce una volta sola, Glossario compreso', () => {
    const ids = ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GROUPS.map((g) => g.entries.length).every((n) => n > 0 && n <= 5)).toBe(true);
    expect(ids).toContain('glossary');
  });
});
