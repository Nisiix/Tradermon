import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getMap } from '../src/world/maps';
import { TILE, SOLID } from '../src/art/art';

// Casa iniziale: due letti affiancati contro la parete di fondo, non uno sopra l'altro.
describe('casa iniziale', () => {
  const m = getMap('home');
  const beds: [number, number][] = [];
  m.tiles.forEach((row, y) => row.forEach((t, x) => { if (t === TILE.BED) beds.push([x, y]); }));

  it('ha due letti sulla stessa fila, uno accanto all\'altro, contro la parete', () => {
    expect(beds).toHaveLength(2);
    expect(beds[0][1]).toBe(beds[1][1]);
    expect(Math.abs(beds[0][0] - beds[1][0])).toBe(1);
    expect(m.tiles[beds[0][1] - 1][beds[0][0]]).toBe(TILE.IWALL);
  });

  it('i posti per gli arredi sbloccati sono pavimento libero, lontano dalla porta e dalla Mamma', () => {
    const src = readFileSync('src/world/decor.ts', 'utf8');
    const list = /FLOOR_SPOTS[^=]*=\s*(\[\[.*?\]\]);/.exec(src)![1];
    const spots = JSON.parse(list) as [number, number][];
    const entry = m.warps[0];
    const mom = m.npcs.find((n) => n.kind === 'mom')!;
    for (const [x, y] of spots) {
      expect(m.tiles[y][x], `${x},${y}`).toBe(TILE.FLOOR);
      expect(SOLID.has(m.tiles[y][x])).toBe(false);
      expect(x === entry.x && y === entry.y - 1, `${x},${y}`).toBe(false);
      expect(x === mom.x && y === mom.y, `${x},${y}`).toBe(false);
    }
  });
});
