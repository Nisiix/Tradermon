// Preparazione del mondo in sottofondo, mentre il giocatore è sul titolo: il foglio dei personaggi e (con gli
// effetti alti) la sua mappa delle normali si calcolano in un worker, su un altro core del telefono. Quando il
// giocatore preme Continua il lavoro più pesante dell'avvio del mondo è già fatto. Se il worker non parte
// (browser vecchio, regole della pagina) il gioco calcola tutto da sé come prima.
import { adoptCharacterPixels, charactersReady } from '../art/art';
import { adoptNormalPixels } from '../render3d/normals';
import { SAVE_KEY } from './state';
import { no3dStored } from './bootGuard';

let job: Promise<void> | undefined;

/** Con gli effetti alti serve anche la mappa delle normali: si legge dal salvataggio senza caricarlo. */
function wantsNormals(): boolean {
  if (no3dStored()) return false;
  try { return (JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as { options?: { fx?: string } } | null)?.options?.fx !== 'bassi'; } catch { return true; }
}

/** Avvia (una volta) la preparazione; la promessa si chiude quando è finita, o fallita in silenzio. */
export function prewarmCharacters(): Promise<void> {
  if (job) return job;
  job = new Promise<void>((resolve) => {
    if (charactersReady() || typeof Worker === 'undefined') { resolve(); return; }
    let w: Worker;
    try { w = new Worker(new URL('../render3d/prep.worker.ts', import.meta.url), { type: 'module' }); } catch { resolve(); return; }
    let over = false;
    const done = () => { if (over) return; over = true; clearTimeout(limit); w.terminate(); resolve(); };
    // un worker che non risponde non deve fermare l'avvio: dopo un po' il gioco fa da sé
    const limit = window.setTimeout(done, 20000);
    w.onmessage = (e: MessageEvent<{ px: Uint32Array; w: number; h: number; normal?: Uint8ClampedArray }>) => {
      const d = e.data;
      if (adoptCharacterPixels(d.px, d.w, d.h) && d.normal) adoptNormalPixels(d.normal, d.w, d.h);
      done();
    };
    w.onerror = () => done();
    w.postMessage({ normals: wantsNormals() });
  });
  return job;
}
