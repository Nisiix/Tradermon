import { describe, it, expect } from 'vitest';
import { BOOKS, mentorBooks, booksFor, bookForText, migrateBooksRead, LEGACY_BOOKS } from '../src/data/books';
import { mentorTopics } from '../src/data/quiz/build';
import { QUESTIONS } from '../src/data/quiz/build';
import { getMap } from '../src/world/maps';
import { TILE } from '../src/art/art';
import type { AssetClass, Track } from '../src/types';

const TRACKS: [Track, AssetClass[]][] = [['listed', []], ['crypto', []], ['mixed', ['stocks', 'crypto']]];

describe('Biblioteche: libri per piccoli argomenti', () => {
  it('ogni tema delle città ha i suoi libri, con id unici', () => {
    const ids = BOOKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [track, mixed] of TRACKS) for (let n = 1; n <= 8; n++) {
      for (const t of mentorTopics(n, track, mixed)) expect(booksFor([t]).length, `${track} città ${n} tema ${t}`).toBeGreaterThanOrEqual(4);
      expect(mentorBooks(n, track, mixed).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('ogni libro è un piccolo argomento: poche pagine, titolo breve', () => {
    for (const b of BOOKS.filter((x) => x.topic !== 'grotte')) {
      expect(b.pages.length, b.id).toBeGreaterThanOrEqual(1);
      expect(b.pages.length, b.id).toBeLessThanOrEqual(5);
      expect(b.title.length, b.id).toBeLessThanOrEqual(45);
    }
  });

  it('i libri insegnano e basta: non dicono che cosa chiederà la Whale né parlano di duelli', () => {
    const preview = /whale|superior|duell|interroga|ti chieder|domande su|nel duello|aspettati domande|preparati su/i;
    for (const b of BOOKS.filter((x) => x.topic !== 'grotte')) for (const p of [b.title, ...b.pages]) expect(p, b.id).not.toMatch(preview);
  });

  it('ogni Biblioteca (città 1-8) ha i quattro scaffali di libri, su scaffali veri, e nessuno sfidante', () => {
    for (let n = 1; n <= 8; n++) {
      const m = getMap(`library_${n}`);
      const secs = m.sections ?? [];
      expect(secs.map((s) => s.kind).sort()).toEqual(['city', 'economy', 'past', 'rules']);
      for (const s of secs) for (let x = s.x; x < s.x + s.w; x++) expect(m.tiles[s.y][x], `${m.id} ${s.kind} ${x},${s.y}`).toBe(TILE.SHELF);
      // davanti a ogni scaffale si può stare in piedi
      for (const s of secs) expect(m.tiles[s.y + 1][s.x]).toBe(TILE.FLOOR);
      // in Biblioteca si studia: solo la Bibliotecaria, niente domanda del giorno né ripasso a duello
      expect(m.npcs.map((x) => x.kind)).toEqual(['librarian']);
      // la Professoressa del giorno (domanda del giorno, ripasso, minigiochi) sta alla Banca
      expect(getMap(`clinic_${n}`).npcs.some((x) => x.kind === 'daily')).toBe(true);
    }
  });

  it('il suggerimento dopo un errore rimanda al piccolo argomento giusto', () => {
    const q = QUESTIONS.find((x) => x.topic === 'ordini' && /slippage/i.test(x.q + x.explain));
    if (q) expect(bookForText('ordini', [q.q, q.options[q.answer], q.explain].join(' '))?.id).toBe('b_o_spread');
    expect(bookForText('rischio', 'drawdown volatilità oscillazioni')?.id).toBe('b_r_volatilita');
  });

  it('i libri letti con le versioni precedenti restano letti', () => {
    expect(migrateBooksRead(['b_ordini_1', 'b_guide_2', 'b_o_spread'])).toEqual(expect.arrayContaining(['b_o_tipi', 'b_o_validita', 'b_o_spread']));
    expect(migrateBooksRead(['b_guide_2'])).toEqual([]);
    for (const ids of Object.values(LEGACY_BOOKS)) for (const id of ids) expect(BOOKS.some((b) => b.id === id), id).toBe(true);
  });
});
