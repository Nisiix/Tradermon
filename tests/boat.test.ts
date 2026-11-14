import { describe, it, expect } from 'vitest';
import { boatMotion, drawBoatPart, boatStern, type BoatDir, type BoatPen } from '../src/art/boat';

/** Penna finta: raccoglie i rettangoli disegnati, in unità u = 1. */
function pen() {
  const rects: [number, number, number, number][] = [];
  const g: BoatPen = { clear: () => { rects.length = 0; }, fillStyle: () => undefined, fillRect: (x, y, w, h) => { rects.push([x, y, w, h]); } };
  return { g, rects };
}

describe('Barchetta del Flusso di Liquidità', () => {
  it('il galleggiamento resta piccolo e limitato', () => {
    for (let t = 0; t < 20000; t += 37) for (const mv of [false, true]) {
      const m = boatMotion(t, mv);
      expect(Math.abs(m.bob)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.roll)).toBeLessThan(0.08);
      expect(Math.abs(m.pitch)).toBeLessThan(0.08);
    }
  });

  it('la parte davanti copre le gambe in ogni direzione, la parte dietro sta dietro il personaggio', () => {
    for (const dir of [0, 1, 2, 3] as BoatDir[]) {
      const f = pen(); drawBoatPart(f.g, 'front', dir, 1);
      const b = pen(); drawBoatPart(b.g, 'back', dir, 1);
      expect(f.rects.length).toBeGreaterThan(5);
      expect(b.rects.length).toBeGreaterThan(5);
      // qualcosa davanti all'altezza delle caviglie (piedi a y = 0), al centro dello sprite
      expect(f.rects.some(([x, y, w, h]) => x <= 0 && x + w >= 1 && y <= -2 && y + h >= -1)).toBe(true);
      // nulla davanti sopra le ginocchia: la parte alta del personaggio resta visibile
      expect(f.rects.every(([x, y, w]) => y >= -12 || x + w < -6 || x > 6)).toBe(true);
    }
  });

  it('di lato la barca è specchiata tra sinistra e destra', () => {
    const l = pen(); drawBoatPart(l.g, 'front', 2, 1);
    const r = pen(); drawBoatPart(r.g, 'front', 3, 1);
    const mirror = l.rects.map(([x, y, w, h]) => `${-(x + w - 1)},${y},${w},${h}`).sort();
    expect(mirror).toEqual(r.rects.map((q) => q.join(',')).sort());
  });

  it('la scia parte da dietro rispetto al moto', () => {
    expect(boatStern(3)[0]).toBeLessThan(0);
    expect(boatStern(2)[0]).toBeGreaterThan(0);
    expect(boatStern(0)[1]).toBeLessThan(0);
    expect(boatStern(1)[1]).toBeGreaterThan(0);
  });
});
