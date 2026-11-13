// Movimento a tocco: si tocca un punto della mappa e il personaggio ci cammina da solo, passo per passo,
// con gli stessi passi della croce direzionale (quindi incontri, linee di vista e porte restano quelli di sempre).
// Qui c'è solo la ricerca del percorso (pura, testata in tests/tapwalk.test.ts); la scena usa il risultato.

export type Dir = 'up' | 'down' | 'left' | 'right';
const STEPS: [Dir, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];

export interface TapPath {
  /** Caselle da attraversare in ordine, esclusa quella di partenza. */
  path: [number, number][];
  /** Se il punto toccato non si può calpestare (un personaggio, un cartello): direzione verso cui girarsi all'arrivo. */
  face?: Dir;
}

/** Direzione del passo da (ax, ay) alla casella vicina (bx, by), oppure undefined se non sono vicine. */
export function stepDir(ax: number, ay: number, bx: number, by: number): Dir | undefined {
  return STEPS.find(([, dx, dy]) => ax + dx === bx && ay + dy === by)?.[0];
}

/**
 * Percorso più breve (in caselle) da (sx, sy) a (tx, ty).
 * free(x, y): la casella si può attraversare. enter(x, y): la casella si può raggiungere come ultima
 * anche se non si attraversa (porte e passaggi verso un'altra mappa). Se il punto toccato non si raggiunge,
 * si va sulla casella vicina libera più comoda e ci si gira verso di lui. null = niente percorso.
 */
export function findPath(
  w: number, h: number,
  free: (x: number, y: number) => boolean,
  sx: number, sy: number, tx: number, ty: number,
  enter: (x: number, y: number) => boolean = () => false,
  limit = 6000,
): TapPath | null {
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return null;
  if (tx === sx && ty === sy) return { path: [] };
  const direct = free(tx, ty) || enter(tx, ty);
  // casella toccata non raggiungibile: va bene una delle quattro vicine
  const goals = new Map<number, Dir | undefined>();
  if (direct) goals.set(ty * w + tx, undefined);
  else for (const [d, dx, dy] of STEPS) {
    const gx = tx - dx, gy = ty - dy; // da qui, un passo in direzione d porta sul punto toccato
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
    if ((gx === sx && gy === sy) || free(gx, gy)) goals.set(gy * w + gx, d);
  }
  if (!goals.size) return null;
  const start = sy * w + sx;
  if (goals.has(start)) return { path: [], face: goals.get(start) };
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let qi = 0; qi < queue.length && qi < limit; qi++) {
    const cur = queue[qi];
    const cx = cur % w, cy = (cur - cx) / w;
    for (const [, dx, dy] of STEPS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const id = ny * w + nx;
      if (prev.has(id)) continue;
      const isGoal = goals.has(id);
      if (!isGoal && !free(nx, ny)) continue;
      prev.set(id, cur);
      if (isGoal) {
        const path: [number, number][] = [];
        for (let p = id; p !== start; p = prev.get(p)!) path.unshift([p % w, Math.floor(p / w)]);
        return { path, face: goals.get(id) };
      }
      queue.push(id);
    }
  }
  return null;
}
