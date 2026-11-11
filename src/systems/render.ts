// Protezione contro lo "schermo nero" su alcuni telefoni.
// Alcune GPU mobili non riescono a disegnare con i filtri WebGL della camera (vignetta, colori) o
// perdono il contesto WebGL: la mappa resta nera mentre l'interfaccia HTML funziona.
// Dopo l'avvio controlliamo qualche pixel al centro dello schermo: se è tutto nero togliamo i filtri,
// e se non basta ricarichiamo il gioco col renderer Canvas 2D (più semplice, sempre disponibile).
import Phaser from 'phaser';

const KEY = 'tradermon.renderer';
type Mode = 'webgl' | 'canvas';

function stored(): Mode | null {
  const q = new URLSearchParams(location.search).get('renderer');
  if (q === 'canvas' || q === 'webgl') return q;
  try { const v = localStorage.getItem(KEY); return v === 'canvas' ? 'canvas' : null; } catch { return null; }
}

/** Tipo di renderer da passare a Phaser: Canvas se in passato WebGL ha dato schermo nero. */
export function rendererType(): number {
  return stored() === 'canvas' ? Phaser.CANVAS : Phaser.AUTO;
}

/** Media della luminosità massima nell'area centrale del canvas (0..255), o -1 se non leggibile. */
function centerBrightness(game: Phaser.Game): Promise<number> {
  return new Promise((resolve) => {
    const w = game.scale.width, h = game.scale.height;
    const done = (img: unknown) => {
      try {
        const src = img as CanvasImageSource & { width: number; height: number };
        const c = document.createElement('canvas'); c.width = 48; c.height = 32;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (!g || !src || !src.width) { resolve(-1); return; }
        g.drawImage(src, 0, 0, 48, 32);
        const d = g.getImageData(0, 0, 48, 32).data;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) max = Math.max(max, d[i], d[i + 1], d[i + 2]);
        resolve(max);
      } catch { resolve(-1); }
    };
    const t = window.setTimeout(() => resolve(-1), 3000);
    try {
      game.renderer.snapshotArea(Math.round(w / 4), Math.round(h / 4), Math.round(w / 2), Math.round(h / 2), (img) => {
        clearTimeout(t);
        // in WebGL arriva un <img> che va prima caricato
        const im = img as HTMLImageElement;
        if (im instanceof HTMLImageElement && !im.complete) im.onload = () => done(im);
        else done(img);
      });
    } catch { clearTimeout(t); resolve(-1); }
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Avvia i controlli sul gioco appena creato. `world` è la scena della mappa. */
export function guardRendering(game: Phaser.Game, sceneKey: string) {
  if (game.renderer.type !== Phaser.WEBGL) return;
  const fallback = () => {
    try { localStorage.setItem(KEY, 'canvas'); } catch { /* niente */ }
    location.reload();
  };
  const isBlack = async () => {
    // due letture a distanza: una dissolvenza tra mappe non basta a far scattare il ripiego
    for (let i = 0; i < 2; i++) {
      const v = await centerBrightness(game);
      if (v < 0 || v > 24) return false;
      await wait(1200);
    }
    return true;
  };
  const check = async () => {
    await wait(2500);
    if (!(await isBlack())) return;
    try { game.scene.getScene(sceneKey)?.cameras.main.filters.internal.clear(); } catch { /* niente */ }
    await wait(600);
    if (await isBlack()) fallback();
  };
  void check();
  // contesto WebGL perso (succede su telefono quando la memoria scarseggia): se non torna, si ricarica
  let lostTimer = 0;
  game.canvas.addEventListener('webglcontextlost', () => { lostTimer = window.setTimeout(() => location.reload(), 4000); });
  game.canvas.addEventListener('webglcontextrestored', () => { clearTimeout(lostTimer); void check(); });
}
