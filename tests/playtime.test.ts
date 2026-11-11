import { describe, it, expect, beforeEach } from 'vitest';
import { newGame, S, SAVE_KEY, save } from '../src/systems/state';
import { formatPlayTime, addPlayTime, persistPlayTime } from '../src/systems/playtime';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe('tempo di gioco', () => {
  beforeEach(() => { mem.clear(); newGame(); });

  it('formatta ore, minuti e secondi', () => {
    expect(formatPlayTime(0)).toBe('00:00:00');
    expect(formatPlayTime(3725000)).toBe('01:02:05');
    expect(formatPlayTime(123 * 3600000 + 59999)).toBe('123:00:59');
  });

  it('non conta le pause lunghe (scheda nascosta)', () => {
    addPlayTime(16);
    addPlayTime(60 * 60 * 1000);
    expect(S.playMs).toBe(1016);
  });

  it('aggiorna il tempo nel salvataggio della stessa partita senza toccare il resto', () => {
    save();
    S.playMs = 90000;
    S.badges = 3;
    persistPlayTime();
    const d = JSON.parse(mem.get(SAVE_KEY)!);
    expect(d.playMs).toBe(90000);
    expect(d.badges).toBe(0);
  });

  it('non scrive su un salvataggio di un\'altra partita', () => {
    save();
    const before = mem.get(SAVE_KEY);
    newGame();
    S.createdAt += 1;
    S.playMs = 5000;
    persistPlayTime();
    expect(mem.get(SAVE_KEY)).toBe(before);
  });
});
