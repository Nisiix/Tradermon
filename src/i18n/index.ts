// Lingua del gioco e della landing: inglese (predefinito) o italiano.
// I testi sono scritti in italiano nel codice e passano da T(): T('Ciao') o T`Hai ${n} punti`.
// In inglese T() cerca la traduzione nel dizionario (src/i18n/en/*.json, chiave = testo italiano con
// {0}, {1}… al posto dei valori); se manca, mostra l'italiano. La scelta vale per il dispositivo
// (localStorage, condivisa da landing e gioco) e cambiarla ricarica la pagina: molti testi sono
// costanti calcolate all'avvio.
import EN from '#i18n-en';
import { hashKey } from './hash';

export type Lang = 'en' | 'it';
export const LANG_KEY = 'tradermon.lang';

function detect(): Lang {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (v === 'en' || v === 'it') return v;
    // chi ha già una partita su questo dispositivo l'ha giocata in italiano: resta così finché non sceglie
    if (typeof localStorage !== 'undefined' && localStorage.getItem('tradermon.save.v1')) return 'it';
  } catch { /* storage non disponibile */ }
  // nei test (Vitest) e negli script fuori dal browser (docs:content) i testi restano quelli scritti nel codice
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return 'it';
  return 'en';
}

export const LANG: Lang = detect();
/** Formato di numeri e date della lingua scelta. */
export const LOCALE = LANG === 'en' ? 'en-US' : 'it-IT';

const dict = EN as Record<string, string>;

/** Traduzione di una chiave (testo italiano con {0}, {1}… per i valori). */
export function tr(key: string): string {
  if (LANG === 'it') return key;
  return dict[hashKey(key)] ?? key;
}

function put(s: string, vals: readonly unknown[]): string {
  return vals.length ? s.replace(/\{(\d+)\}/g, (m, i: string) => (+i < vals.length ? String(vals[+i]) : m)) : s;
}

/** Testo visibile al giocatore: T('Salva') oppure T`Hai ${n} punti`. */
export function T(s: string): string;
export function T(strings: TemplateStringsArray, ...vals: unknown[]): string;
export function T(s: string | TemplateStringsArray, ...vals: unknown[]): string {
  if (typeof s === 'string') return tr(s);
  let key = s[0];
  for (let i = 1; i < s.length; i++) key += `{${i - 1}}` + s[i];
  return put(tr(key), vals);
}

/** Salva la lingua scelta e ricarica la pagina (dopo aver eseguito `before`, per esempio un salvataggio). */
export function setLang(l: Lang, before?: () => void) {
  if (l === LANG) return;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* resta per questa pagina */ }
  try { before?.(); } catch { /* si ricarica comunque */ }
  location.reload();
}

/** Applica la lingua alla pagina (attributo lang di <html>). */
export function markDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = LANG;
}
