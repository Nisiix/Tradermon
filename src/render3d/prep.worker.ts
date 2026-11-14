// Worker che prepara il foglio dei personaggi (e la sua mappa delle normali per gli effetti alti) mentre il
// giocatore è sul titolo: lavoro puro sui pixel che nella pagina, su un telefono, la bloccherebbe per secondi.
import { characterSheetPixels } from '../art/art';
import { normalMapPixels } from './normals';

self.onmessage = (e: MessageEvent<{ normals: boolean }>) => {
  const s = characterSheetPixels();
  const normal = e.data.normals ? normalMapPixels(new Uint8ClampedArray(s.px.buffer, s.px.byteOffset, s.px.length * 4), s.w, s.h) : undefined;
  const transfer: Transferable[] = [s.px.buffer as ArrayBuffer];
  if (normal) transfer.push(normal.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ px: s.px, w: s.w, h: s.h, normal }, transfer);
};
