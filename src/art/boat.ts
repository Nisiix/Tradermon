/**
 * Barchetta del Flusso di Liquidità: disegno procedurale 2D e moto condiviso con la vista 2.5D.
 *
 * Il personaggio sta in piedi dentro la barca: la parte "dietro" (interno, bordo lontano, bandierina) va sotto lo
 * sprite, la parte "davanti" (fiancata vicina) sopra, così copre le gambe fino al ginocchio.
 * Coordinate in pixel del gioco (u = RS) con l'origine ai piedi del personaggio.
 */

/** Direzioni come nella scena: 0 giù, 1 su, 2 sinistra, 3 destra. */
export type BoatDir = 0 | 1 | 2 | 3;

/** Moto della barca nel tempo (ms): galleggia piano e rolla un po' di più quando avanza. */
export function boatMotion(t: number, moving: boolean) {
  const bob = Math.sin(t / 430) * 0.75 + Math.sin(t / 190 + 1.3) * (moving ? 0.35 : 0.12);
  const roll = Math.sin(t / 610 + 0.6) * (moving ? 0.06 : 0.035);
  const pitch = moving ? 0.05 + Math.sin(t / 240) * 0.02 : 0;
  return { bob: Math.max(-1, Math.min(1, bob)), roll, pitch };
}

/** Colori della barca (vernice da porto, bordo di legno chiaro, interno scuro, bandierina verde in salita). */
export const BOAT_COLORS = {
  hull: 0x2f8f9a, hullDark: 0x1f5f6a, stripe: 0xf2efe4, rim: 0xd8a860, rimDark: 0x8a5828,
  floor: 0x6a4020, floorDark: 0x4a2a14, pole: 0x5a3418, flag: 0x48c070, foam: 0xe8f4ff,
} as const;

/** Superficie di disegno minima (Phaser.GameObjects.Graphics la soddisfa). */
export interface BoatPen {
  clear(): unknown;
  fillStyle(color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, w: number, h: number): unknown;
}

/** Riga di pixel da x0 a x1 compresi (in unità u), eventualmente specchiata. */
function row(g: BoatPen, u: number, flip: boolean, y: number, x0: number, x1: number) {
  const a = flip ? -x1 : x0, b = flip ? -x0 : x1;
  g.fillRect(a * u, y * u, (b - a + 1) * u, u);
}

/**
 * Disegna una delle due metà della barca.
 * Di lato (2/3) la prua guarda la direzione di marcia; di fronte/schiena (0/1) la barca è lunga in verticale.
 */
export function drawBoatPart(g: BoatPen, part: 'back' | 'front', dir: BoatDir, u: number) {
  const C = BOAT_COLORS;
  g.clear();
  if (dir === 2 || dir === 3) {
    const f = dir === 2; // verso sinistra: prua a sinistra
    if (part === 'back') {
      // bandierina a poppa
      g.fillStyle(C.pole, 1); row(g, u, f, -18, -9, -9);
      for (let y = -17; y <= -10; y++) row(g, u, f, y, -9, -9);
      g.fillStyle(C.flag, 1); row(g, u, f, -18, -8, -4); row(g, u, f, -17, -8, -5); row(g, u, f, -16, -8, -6); row(g, u, f, -15, -8, -7);
      // bordo lontano e interno
      g.fillStyle(C.rimDark, 1); row(g, u, f, -10, -9, 9); row(g, u, f, -11, 10, 11); row(g, u, f, -12, 11, 12);
      g.fillStyle(C.rim, 1); row(g, u, f, -10, -8, 8);
      g.fillStyle(C.floorDark, 1); row(g, u, f, -9, -10, 10);
      g.fillStyle(C.floor, 1); row(g, u, f, -8, -10, 11); row(g, u, f, -7, -10, 11);
      g.fillStyle(C.floorDark, 1); for (let x = -7; x <= 8; x += 5) row(g, u, f, -8, x, x);
      return;
    }
    // ombra sull'acqua
    g.fillStyle(0x0a3050, 0.35); row(g, u, f, 1, -9, 10); row(g, u, f, 2, -6, 7);
    // prua che sale
    g.fillStyle(C.hull, 1); row(g, u, f, -9, 12, 13); row(g, u, f, -8, 12, 14); row(g, u, f, -7, 13, 14);
    g.fillStyle(C.rim, 1); row(g, u, f, -10, 12, 13);
    // bordo vicino
    g.fillStyle(C.rim, 1); row(g, u, f, -6, -11, 12);
    g.fillStyle(C.rimDark, 1); row(g, u, f, -6, -11, -11); row(g, u, f, -7, 11, 12);
    // fiancata con la riga bianca
    g.fillStyle(C.hull, 1); row(g, u, f, -5, -11, 13); row(g, u, f, -4, -11, 13); row(g, u, f, -2, -10, 11); row(g, u, f, -1, -9, 10);
    g.fillStyle(C.stripe, 1); row(g, u, f, -3, -10, 12);
    g.fillStyle(C.hullDark, 1); row(g, u, f, 0, -8, 9); row(g, u, f, -1, -9, -9);
    // riflesso sulla vernice e schiuma alle estremità
    g.fillStyle(0xffffff, 0.35); row(g, u, f, -5, -7, -2);
    g.fillStyle(C.foam, 0.85); row(g, u, f, 0, -11, -10); row(g, u, f, 0, 10, 12); row(g, u, f, -1, 12, 13);
    return;
  }
  // di fronte (0) o di schiena (1): la barca è lunga in verticale, l'estremità lontana spunta sopra la testa
  const up = dir === 1; // di schiena: la prua (a punta) è lontana, sopra; di fronte la prua è vicina, sotto
  if (part === 'back') {
    g.fillStyle(C.rimDark, 1);
    if (up) { row(g, u, false, -21, -1, 0); row(g, u, false, -20, -2, 1); row(g, u, false, -19, -3, 2); row(g, u, false, -18, -4, 3); }
    else { row(g, u, false, -19, -4, 3); row(g, u, false, -18, -5, 4); }
    g.fillStyle(C.rim, 1);
    if (up) { row(g, u, false, -20, -1, 0); row(g, u, false, -19, -2, 1); }
    else row(g, u, false, -19, -3, 2);
    for (let y = -18; y <= -4; y++) { row(g, u, false, y, -6, -5); row(g, u, false, y, 4, 5); }
    g.fillStyle(C.rimDark, 1); for (let y = -18; y <= -4; y++) { row(g, u, false, y, -7, -7); row(g, u, false, y, 6, 6); }
    // interno con le assi
    g.fillStyle(C.floor, 1); for (let y = -17; y <= -4; y++) row(g, u, false, y, -4, 3);
    g.fillStyle(C.floorDark, 1); row(g, u, false, -17, -4, 3); row(g, u, false, -12, -4, 3); row(g, u, false, -7, -4, 3);
    if (up) { g.fillStyle(C.floor, 1); row(g, u, false, -18, -3, 2); }
    // bandierina a poppa (di fronte la poppa è lontana)
    if (!up) {
      g.fillStyle(C.pole, 1); for (let y = -27; y <= -18; y++) row(g, u, false, y, 4, 4);
      g.fillStyle(C.flag, 1); row(g, u, false, -27, 5, 9); row(g, u, false, -26, 5, 8); row(g, u, false, -25, 5, 7); row(g, u, false, -24, 5, 6);
    }
    return;
  }
  // parte vicina: bordi laterali, estremità e fiancata visibile sotto
  g.fillStyle(0x0a3050, 0.35); row(g, u, false, 3, -6, 5); row(g, u, false, 4, -4, 3);
  g.fillStyle(C.rimDark, 1); for (let y = -4; y <= -1; y++) { row(g, u, false, y, -7, -7); row(g, u, false, y, 6, 6); }
  g.fillStyle(C.rim, 1); for (let y = -4; y <= -1; y++) { row(g, u, false, y, -6, -5); row(g, u, false, y, 4, 5); }
  g.fillStyle(C.floor, 1); row(g, u, false, -2, -4, 3); row(g, u, false, -1, -4, 3);
  if (!up) {
    // prua a punta verso chi guarda
    g.fillStyle(C.rim, 1); row(g, u, false, 0, -6, 5); row(g, u, false, 1, -4, 3); row(g, u, false, 2, -2, 1);
    g.fillStyle(C.hull, 1); row(g, u, false, 1, -6, -5); row(g, u, false, 1, 4, 5); row(g, u, false, 2, -5, -3); row(g, u, false, 2, 2, 4); row(g, u, false, 3, -3, 2);
    g.fillStyle(C.stripe, 1); row(g, u, false, 2, -2, 1);
    g.fillStyle(C.hullDark, 1); row(g, u, false, 4, -1, 0);
  } else {
    // poppa piatta verso chi guarda
    g.fillStyle(C.rim, 1); row(g, u, false, 0, -7, 6);
    g.fillStyle(C.hull, 1); row(g, u, false, 1, -7, 6); row(g, u, false, 3, -6, 5);
    g.fillStyle(C.stripe, 1); row(g, u, false, 2, -7, 6);
    g.fillStyle(C.hullDark, 1); row(g, u, false, 4, -5, 4);
  }
  g.fillStyle(C.foam, 0.85); row(g, u, false, 3, -8, -7); row(g, u, false, 3, 6, 7);
}

/** Punto della poppa (dietro alla barca rispetto al moto), in unità u, per la scia. */
export function boatStern(dir: BoatDir): [number, number] {
  return dir === 3 ? [-12, 0] : dir === 2 ? [12, 0] : dir === 0 ? [0, -16] : [0, 5];
}
