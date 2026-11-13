import { describe, it, expect } from 'vitest';
import { findPath, stepDir } from '../src/systems/tapwalk';

// mappa 5x4: # muro, N personaggio (non calpestabile), D porta (solo meta)
const MAP = [
  '.....',
  '.###.',
  '..N..',
  '..D..',
];
const free = (x: number, y: number) => MAP[y]?.[x] === '.';
const enter = (x: number, y: number) => MAP[y]?.[x] === 'D';

describe('movimento a tocco', () => {
  it('trova il percorso più breve aggirando i muri', () => {
    const p = findPath(5, 4, free, 0, 0, 4, 2);
    expect(p?.path).toEqual([[1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2]]);
    expect(p?.face).toBeUndefined();
  });
  it('su un personaggio si ferma accanto e si gira verso di lui', () => {
    const p = findPath(5, 4, free, 0, 2, 2, 2);
    expect(p?.path).toEqual([[1, 2]]);
    expect(p?.face).toBe('right');
  });
  it('una porta si raggiunge come meta ma non si attraversa', () => {
    expect(findPath(5, 4, free, 1, 3, 2, 3, enter)?.path).toEqual([[2, 3]]);
    const around = findPath(5, 4, free, 1, 3, 3, 3, enter)!;
    expect(around.path.some(([x, y]) => x === 2 && y === 3)).toBe(false);
  });
  it('fuori mappa o irraggiungibile: niente percorso', () => {
    expect(findPath(5, 4, free, 0, 0, 9, 9)).toBeNull();
    expect(findPath(5, 4, free, 0, 0, 2, 1)?.face).toBe('down'); // muro: ci si mette sopra e lo si guarda
    expect(findPath(3, 1, (x) => x !== 1, 0, 0, 2, 0)).toBeNull();
  });
  it('stepDir', () => {
    expect(stepDir(1, 1, 1, 0)).toBe('up');
    expect(stepDir(1, 1, 3, 1)).toBeUndefined();
  });
});
