// Lingua del gioco e della landing: inglese (predefinito) o italiano.
// I testi sono scritti in italiano nel codice e passano da T(): T('Ciao') o T`Hai ${n} punti`.
// In inglese T() cerca la traduzione nel dizionario (src/i18n/en/*.json, chiave = testo italiano con
// {0}, {1}… al posto dei valori); se manca, mostra l'italiano. La scelta vale per il dispositivo
// (localStorage, condivisa da landing e gioco).
// Il dizionario non è importato qui: ogni pagina registra il suo con addDictionary() come primo import
// (src/i18n/full.ts per il gioco, src/i18n/landing.ts per landing e privacy, molto più piccolo).
// Nel gioco cambiare lingua ricarica la pagina (molti testi sono costanti calcolate all'avvio); nella landing
// la lingua cambia sul posto con switchLang().
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

export let LANG: Lang = detect();
/** Formato di numeri e date della lingua scelta. */
export let LOCALE = LANG === 'en' ? 'en-US' : 'it-IT';

const dict: Record<string, string> = {};
/** Aggiunge traduzioni inglesi già compilate (chiave = hashKey del testo italiano). */
export function addDictionary(d: Record<string, string>) { Object.assign(dict, d); }

/** Finché è attivo, T() restituisce il testo italiano (la chiave): serve alla landing per tenere le chiavi delle costanti. */
let keysOnly = false;
export function keepKeys(on: boolean) { keysOnly = on; }

/** Traduzione inglese di una chiave, se c'è (indipendente dalla lingua scelta). */
export function lookup(key: string): string | undefined { return dict[hashKey(key)]; }

/** Traduzione di una chiave (testo italiano con {0}, {1}… per i valori). */
export function tr(key: string): string {
  if (LANG === 'it' || keysOnly) return key;
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

function store(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* resta per questa pagina */ }
}

/** Salva la lingua scelta e ricarica la pagina (dopo aver eseguito `before`, per esempio un salvataggio). */
export function setLang(l: Lang, before?: () => void) {
  if (l === LANG) return;
  store(l);
  try { before?.(); } catch { /* si ricarica comunque */ }
  location.reload();
}

/** Cambia lingua senza ricaricare (landing e privacy): chi mostra testi ascolta l'evento 'tradermon:lang'. */
export function switchLang(l: Lang) {
  if (l === LANG) return;
  store(l);
  LANG = l;
  LOCALE = l === 'en' ? 'en-US' : 'it-IT';
  markDocument();
  if (typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('tradermon:lang', { detail: l }));
}

/** Applica la lingua alla pagina (attributo lang di <html>). */
export function markDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = LANG;
}
