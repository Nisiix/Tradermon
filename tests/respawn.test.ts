import { describe, it, expect, beforeEach } from 'vitest';
import { getMap, allMapIds, townOf } from '../src/world/maps';
import { hasGlyphs, plaqueSize } from '../src/art/plaque';
import { FILES as EN_FILES } from '../src/i18n/en-node';
import { P, TILE } from '../src/art/art';
import { newGame } from '../src/systems/state';
import { pickQuestions } from '../src/systems/quiz';
import { mentorTopics } from '../src/data/quiz/build';

describe('rinascita in Banca', () => {
  it('ogni mappa di città (anche gli interni) ha una Banca della stessa città', () => {
    for (const id of allMapIds()) {
      const t = townOf(id);
      if (t === undefined) continue;
      const c = getMap(`clinic_${t}`);
      expect(c, `${id} → clinic_${t}`).toBeDefined();
      expect(c.npcs.some((n) => n.kind === 'nurse')).toBe(true);
    }
  });
  it('le Accademie e le case portano alla Banca della loro città; i Percorsi no', () => {
    expect(townOf('academy_3')).toBe(3);
    expect(townOf('clinic_5')).toBe(5);
    expect(townOf('home')).toBe(0);
    expect(townOf('league')).toBe(9);
    expect(townOf('r4')).toBeUndefined();
  });
});

describe('insegne degli edifici', () => {
  it('Banca ed Exchange hanno l\'insegna in ogni città, le case no', () => {
    for (let n = 1; n <= 8; n++) {
      const m = getMap(`t${n}`);
      const texts = (m.plaques ?? []).map((p) => p.text);
      expect(texts).toContain('BANCA');
      expect(texts).toContain('EXCHANGE');
      // nessuna insegna davanti alla porta di una casa abitata
      for (const w of m.warps.filter((x) => /^h\d+_/.test(x.to))) expect(m.plaques!.some((p) => p.x === w.x && p.y === w.y - 1)).toBe(false);
    }
    expect(getMap('t0').plaques!.map((p) => p.text)).toContain('BANCA');
    expect(getMap('t9').plaques!.map((p) => p.text)).toContain('BANCA');
  });
  it('negli edifici con insegna le finestre stanno nella fila bassa, mai sulla porta', () => {
    for (const id of allMapIds()) {
      const m = getMap(id);
      for (const p of m.plaques ?? []) {
        let x0 = p.x, x1 = p.x;
        while ([TILE.WALL, TILE.WINDOW].includes(m.tiles[p.y][x0 - 1])) x0--;
        while ([TILE.WALL, TILE.WINDOW].includes(m.tiles[p.y][x1 + 1])) x1++;
        const up = m.tiles[p.y].slice(x0, x1 + 1), low = m.tiles[p.y + 1].slice(x0, x1 + 1);
        expect(up.includes(TILE.WINDOW), `${id} ${p.text} fila alta`).toBe(false);
        expect(low.includes(TILE.WINDOW), `${id} ${p.text} fila bassa`).toBe(true);
        expect(m.tiles[p.y + 1][p.x], `${id} ${p.text} porta`).toBe(TILE.DOOR);
      }
    }
  });
  it('ogni insegna è disegnabile ed entra nella facciata, in italiano e in inglese', () => {
    const en: Record<string, string> = Object.assign({}, ...Object.values(EN_FILES));
    for (const id of allMapIds()) for (const p of getMap(id).plaques ?? []) {
      // nei test le mappe sono in italiano: l'insegna inglese è la traduzione della stessa chiave
      for (const text of [p.text, en[p.text]]) {
        expect(text, `${p.text}: manca la traduzione inglese`).toBeTruthy();
        expect(hasGlyphs(text), `${text}: lettere senza glifo`).toBe(true);
        expect(plaqueSize(text).w * 3, text).toBeLessThanOrEqual(5 * P);
      }
    }
  });
  it('il font delle insegne ha tutte le lettere dell\'alfabeto', () => {
    expect(hasGlyphs('ABCDEFGHIJKLMNOPQRSTUVWXYZ ÀÈÌÒÙ')).toBe(true);
  });
});

describe('sfide ai capi palestra', () => {
  beforeEach(() => { newGame(); });
  it('il Mentore pone sempre lo stesso numero di domande', () => {
    for (let m = 1; m <= 8; m++) for (let k = 0; k < 5; k++) {
      expect(pickQuestions(mentorTopics(m, 'listed', []), 8, { minDiff: m >= 4 ? 2 : 1 })).toHaveLength(8);
    }
    expect(pickQuestions(['regole'], 60)).toHaveLength(60);
  });
});
