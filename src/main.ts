// Ingresso del gioco: prima il dizionario inglese, solo se serve, poi il gioco.
// In italiano il dizionario (centinaia di kB) non si scarica nemmeno. In inglese va registrato PRIMA che partano i
// moduli con testi calcolati all'avvio (settori, città, Whale…): per questo il gioco (app.ts) si carica solo dopo.
import { LANG } from './i18n';

void (LANG === 'en' ? import('./i18n/full') : Promise.resolve()).then(() => import('./app'));
