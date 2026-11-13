// Le tre Valigette: Azioni + ETF, Cripto, Misto (Azioni + ETF + Cripto). Il percorso misto si sceglie solo dalla
// Valigetta, non dal Professore; i salvataggi dei vecchi quattro percorsi passano ai tre nuovi.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const said: string[][] = [];
const asked: string[][] = [];
vi.mock('../src/ui/core', async (orig) => ({
  ...(await orig<typeof import('../src/ui/core')>()),
  say: vi.fn(async (lines: string | string[]) => { said.push(Array.isArray(lines) ? lines : [lines]); }),
  choose: vi.fn(async (opts: string[]) => { asked.push(opts); return -1; }),
}));

import type { SaveData, Track } from '../src/types';
import { newGame, migrate, S, classes, SAVE_VERSION } from '../src/systems/state';
import { classesOf, starterOptions, unlockedAssets, TRACK_CLASSES } from '../src/data/assets';
import { mentorTopics, byTopic } from '../src/data/quiz/build';
import { mentor, antagonist } from '../src/data/story';
import { mentorMission } from '../src/data/missions';
import { getMap } from '../src/world/maps';
import { interact, type WorldApi } from '../src/world/scripts';
import { TRACK_LABEL } from '../src/world/scripts/common';

const api = (): WorldApi => ({ warp: () => {}, refresh: () => {}, player: () => ({ x: S.x, y: S.y }), approach: async () => {}, exclaim: async () => {}, bumpBack: () => {}, town: () => 0 });
const TRACKS: Track[] = ['listed', 'crypto', 'mixed'];

describe('le tre Valigette', () => {
  beforeEach(() => { said.length = 0; asked.length = 0; newGame(); });

  it('sul tavolo del Laboratorio ci sono Azioni + ETF, Cripto e Misto, in quest\'ordine', () => {
    const cases = getMap('lab').npcs.filter((n) => n.kind === 'case').sort((a, b) => a.x - b.x);
    expect(cases.map((n) => n.data?.track)).toEqual(['listed', 'crypto', 'mixed']);
    expect(TRACK_CLASSES).toEqual({ listed: ['stocks', 'etf'], crypto: ['crypto'], mixed: ['stocks', 'etf', 'crypto'] });
    for (const t of TRACKS) expect(TRACK_LABEL[t], t).toBeTruthy();
  });

  it('ogni Valigetta ha i titoli della vetrina e dell\'Investidex di tutte le sue classi', () => {
    for (const t of TRACKS) {
      const cls = classesOf(t);
      const starters = starterOptions(cls);
      for (const c of cls) expect(starters.some((a) => a.cls === c), `${t}: vetrina senza ${c}`).toBe(true);
      expect(starters.every((a) => cls.includes(a.cls))).toBe(true);
      const all = unlockedAssets(t, [], 8);
      expect(new Set(all.map((a) => a.cls))).toEqual(new Set(cls));
    }
    S.track = 'listed'; expect(classes()).toEqual(['stocks', 'etf']);
    S.track = 'mixed'; expect(classes()).toEqual(['stocks', 'etf', 'crypto']);
  });

  it('Azioni + ETF: le Whale interrogano su entrambe le classi e hanno domande a sufficienza', () => {
    expect(mentorTopics(1, 'listed', [])).toEqual(['stocks_base', 'etf_base', 'rischio']);
    expect(mentorTopics(5, 'listed', [])).toEqual(['stocks_bilanci', 'etf_replica']);
    expect(mentorTopics(6, 'listed', [])).toEqual(['stocks_dividendi', 'etf_obbligazioni']);
    for (let m = 1; m <= 8; m++) for (const top of mentorTopics(m, 'listed', [])) expect(byTopic(top).length, top).toBeGreaterThan(0);
    expect(mentor(5, 'listed').name).toBeTruthy();
    expect(mentor(6, 'listed').name).toBeTruthy();
    expect(mentor(5, 'listed').name).not.toBe(mentor(5, 'mixed').name);
    expect(antagonist('listed').boss).toBeTruthy();
    const m5 = mentorMission(5, 'listed', 'equilibrato');
    expect(m5.kind).toBe('pick');
    if (m5.kind === 'pick') { expect(m5.rounds).toHaveLength(4); expect(m5.need).toBe(3); }
  });

  it('il Sentiero Misto ha sempre tutte e tre le classi', () => {
    expect(mentorTopics(1, 'mixed', [])).toEqual(['mixed_base', 'rischio']);
    expect(mentorTopics(5, 'mixed', [])).toEqual(['mixed_allocazione']);
    expect(mentorTopics(6, 'mixed', [])).toEqual(expect.arrayContaining(['stocks_dividendi', 'etf_obbligazioni', 'crypto_stable']));
  });

  it('il Professore presenta le tre Valigette e non propone più il percorso misto', async () => {
    const prof = getMap('lab').npcs.find((n) => n.kind === 'prof')!;
    await interact(prof, api());
    const intro = said.flat().join(' ');
    for (const word of ['Blu', 'Arancione', 'Viola']) expect(intro).toContain(word);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(2); // guardo le Valigette, si usano soldi veri?
    expect(asked.flat().join(' ')).not.toMatch(/Misto|Mixed/);
    expect(S.flags.starter).toBeFalsy();
  });

  it('i salvataggi dei vecchi percorsi passano ai tre nuovi senza perdere nulla', () => {
    const old = (track: string, mixedClasses: string[] = []) => {
      const s = JSON.parse(JSON.stringify(newGame())) as Record<string, unknown>;
      s.flags = { starter: true }; s.cards = { AAPL: { xp: 90, gold: true, flawless: true, seen: 3 } };
      s.version = 3; s.track = track; s.mixedClasses = mixedClasses; s.badges = 5; s.techniques = ['Analisi del Prospetto', 'Ordine Limite'];
      return migrate(s as unknown as SaveData);
    };
    expect(old('stocks').track).toBe('listed');
    expect(old('etf').track).toBe('listed');
    expect(old('etf').techniques).toEqual(['Lettura del Bilancio', 'Ordine Limite']);
    expect(old('crypto').track).toBe('crypto');
    // chi era sui soli Titoli trova subito nell'Investidex anche gli ETF già alla sua portata, senza perdere le carte che aveva
    const st = old('stocks');
    expect(st.cards.AAPL.xp).toBe(90);
    expect(st.cards.SPY).toBeTruthy();
    expect(Object.keys(st.cards).some((id) => id.includes('/'))).toBe(false);
    expect(old('mixed', ['stocks', 'etf']).track).toBe('listed');
    const mx = (() => { const s = JSON.parse(JSON.stringify(newGame())) as Record<string, unknown>; s.version = 3; s.track = 'mixed'; s.mixedClasses = ['stocks', 'etf']; s.techniques = ['Visione d\'Insieme']; return migrate(s as unknown as SaveData); })();
    expect(mx.techniques).toEqual(['Lettura del Bilancio']);
    expect(old('mixed', ['etf', 'crypto']).track).toBe('mixed');
    expect(old('mixed', ['stocks', 'etf', 'crypto']).track).toBe('mixed');
    const m = old('mixed', ['stocks', 'crypto']);
    expect(m.mixedClasses).toEqual([]);
    expect(m.badges).toBe(5);
    expect(m.version).toBe(SAVE_VERSION);
    expect(classesOf(m.track, m.mixedClasses)).toEqual(['stocks', 'etf', 'crypto']);
  });
});
