import { describe, it, expect } from 'vitest';
import { BOOKS, mentorBooks, booksFor, TOPIC_LABEL } from '../src/data/books';
import { mentorTopics } from '../src/data/quiz/build';
import { getMap } from '../src/world/maps';
import { TILE } from '../src/art/art';
import type { AssetClass, Track } from '../src/types';

const TRACKS: [Track, AssetClass[]][] = [['listed', []], ['crypto', []], ['mixed', []]];

describe('Biblioteche: libri dei Mentori', () => {
  it('ogni argomento dei Mentori ha almeno due libri (contesto e materia)', () => {
    for (const [track, mixed] of TRACKS) for (let n = 1; n <= 8; n++) {
      for (const t of mentorTopics(n, track, mixed)) expect(booksFor([t]).length, `${track} mentore ${n} tema ${t}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('la Sezione del Mentore ha la guida più i libri dei suoi temi, con id unici', () => {
    const ids = BOOKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [track, mixed] of TRACKS) for (let n = 1; n <= 8; n++) {
      const bs = mentorBooks(n, track, mixed);
      expect(bs[0].id).toBe(`b_guide_${n}`);
      expect(bs[0].pages.join(' ')).toContain(TOPIC_LABEL[mentorTopics(n, track, mixed)[0]]);
      expect(bs.length).toBeGreaterThanOrEqual(3);
      for (const b of bs) expect(b.pages.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('ogni Biblioteca (città 1-8) ha le quattro sezioni su scaffali veri', () => {
    for (let n = 1; n <= 8; n++) {
      const m = getMap(`library_${n}`);
      const secs = m.sections ?? [];
      expect(secs.map((s) => s.kind).sort()).toEqual(['general', 'index', 'mentor', 'review']);
      for (const s of secs) for (let x = s.x; x < s.x + s.w; x++) expect(m.tiles[s.y][x], `${m.id} ${s.kind} ${x},${s.y}`).toBe(TILE.SHELF);
      // davanti a ogni sezione si può stare in piedi
      for (const s of secs) expect(m.tiles[s.y + 1][s.x]).toBe(TILE.FLOOR);
    }
  });
});
