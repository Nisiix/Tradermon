// Leo a Ponte Cedola: al primo arrivo nella prima città con l'Exchange ti viene incontro, racconta di aver già battuto
// la prima Whale e spiega gli edifici. Nessuna sfida, una volta sola, salvato nello stato.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const said: string[][] = [];
vi.mock('../src/ui/core', async (orig) => ({
  ...(await orig<typeof import('../src/ui/core')>()),
  say: vi.fn(async (lines: string | string[]) => { said.push(Array.isArray(lines) ? lines : [lines]); }),
}));

import { newGame, S } from '../src/systems/state';
import { getMap } from '../src/world/maps';
import { npcVisible, interact, leoTourPending, leoTour, type WorldApi } from '../src/world/scripts';
import { mentor } from '../src/data/story';

const api = (): WorldApi & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, warp: () => {}, refresh: () => {}, player: () => ({ x: S.x, y: S.y }), approach: async (id) => { calls.push(`approach:${id}`); }, exclaim: async (id) => { calls.push(`exclaim:${id}`); }, bumpBack: () => {}, town: () => 1 };
};
const leo = () => getMap('t1').npcs.find((n) => n.id === 't1_leo')!;

describe('Leo a Ponte Cedola', () => {
  beforeEach(() => { said.length = 0; newGame(); S.flags.starter = 'AAPL'; S.map = 't1'; });

  it('Ponte Cedola è la prima città con l\'Exchange e Leo aspetta sulla strada principale', () => {
    expect(getMap('t0').warps.some((w) => w.to.startsWith('academy_'))).toBe(false);
    expect(getMap('t1').warps.some((w) => w.to === 'academy_1')).toBe(true);
    const n = leo();
    expect(n.kind).toBe('rival');
    expect(getMap('t1').tiles[n.y][n.x]).toBe(getMap('t1').tiles[9][1]); // strada, come l'ingresso dal Percorso 1
  });

  it('parte solo la prima volta, dopo la Valigetta e prima del primo Attestato', () => {
    expect(leoTourPending('t1')).toBe(true);
    expect(leoTourPending('t2')).toBe(false);
    S.flags.starter = false; expect(leoTourPending('t1')).toBe(false); expect(npcVisible(leo())).toBe(false);
    S.flags.starter = 'AAPL'; S.badges = 1; expect(leoTourPending('t1')).toBe(false); expect(npcVisible(leo())).toBe(false);
  });

  it('racconta la prima Whale, spiega gli edifici, non sfida e non si ripete', async () => {
    const w = api();
    expect(npcVisible(leo())).toBe(true);
    await leoTour(w);
    expect(w.calls).toEqual(['exclaim:t1_leo', 'approach:t1_leo']);
    const all = said.flat().join(' ');
    expect(all).toContain(mentor(1, S.track).name);
    for (const b of ['Banca del Portafoglio', 'Biblioteca', 'Exchange', 'Guardia della Borsa', 'case', 'stazione']) expect(all).toContain(b);
    expect(S.defeated.some((d) => d.startsWith('rival_'))).toBe(false);
    expect(S.flags.leoTourT1).toBe(true);
    expect(npcVisible(leo())).toBe(false);
    expect(npcVisible(getMap('lab').npcs.find((n) => n.id === 'lab_rival')!)).toBe(false); // è andato avanti, non è anche nel Laboratorio
    expect(leoTourPending('t1')).toBe(false);
    said.length = 0;
    await interact(leo(), w); // parlargli di nuovo (per esempio da un vecchio salvataggio) non riapre nulla
    expect(said.length).toBe(0);
  });
});
