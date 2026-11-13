// Traduzione delle pagine HTML statiche (landing, privacy, pagina del gioco).
// Le chiavi sono il contenuto HTML degli elementi "di testo" (senza blocchi al loro interno), con gli spazi
// compressi: lo stesso criterio di textKeys() serve sia a estrarle sia a tradurle.
// translateDom() legge una volta le chiavi italiane della pagina e le ricorda: così la landing può passare
// da una lingua all'altra sul posto (applyDom) senza ricaricare.
import { LANG, lookup, markDocument, switchLang, type Lang } from './index';

const TEXT = 'title,h1,h2,h3,h4,p,li,a,button,label,option,th,td,caption,span,summary,legend,dt,dd';
const BLOCK = 'div,p,ul,ol,li,table,thead,tbody,tr,select,input,textarea,h1,h2,h3,h4,article,section,header,footer,nav,form,label,button,canvas,dialog,aside,main';
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** L'elemento contiene solo testo e tag in linea (b, i, a, code, br…)? */
function inlineOnly(el: Element) { return !el.querySelector(BLOCK); }

/** Tutte le chiavi traducibili di una pagina (per l'estrazione). */
export function textKeys(root: Document): string[] {
  const out = new Set<string>();
  root.querySelectorAll(TEXT).forEach((el) => { if (inlineOnly(el)) { const k = norm(el.innerHTML); if (/[A-Za-zÀ-ú]{2}/.test(k)) out.add(k); } });
  root.querySelectorAll('*').forEach((el) => {
    if (!(el.matches(TEXT) && inlineOnly(el))) el.childNodes.forEach((n) => { if (n.nodeType === 3) { const k = norm(n.textContent ?? ''); if (/[A-Za-zÀ-ú]{2}/.test(k)) out.add(k); } });
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v && /[A-Za-zÀ-ú]{2}/.test(v)) out.add(norm(v)); }
  });
  root.querySelectorAll('meta[name=description]').forEach((m) => { const v = m.getAttribute('content'); if (v) out.add(norm(v)); });
  return [...out];
}

/** Un pezzo traducibile della pagina, con la sua chiave italiana e il modo di scriverlo. */
interface Unit { key: string; en: string; set: (s: string) => void }
const units = new WeakMap<Document, Unit[]>();

/** Legge le chiavi della pagina (in italiano, com'è scritta nell'HTML). */
function collect(root: Document): Unit[] {
  const out: Unit[] = [];
  const done = new Set<Element>();
  const inside = (n: Node) => { for (const d of done) if (d.contains(n)) return true; return false; };
  root.querySelectorAll(TEXT).forEach((el) => {
    if (!inlineOnly(el) || inside(el)) return;
    const key = norm(el.innerHTML), en = lookup(key);
    if (en !== undefined && en !== key) { out.push({ key, en, set: (s) => { el.innerHTML = s; } }); done.add(el); }
  });
  root.querySelectorAll('*').forEach((el) => {
    if (!inside(el)) el.childNodes.forEach((n) => {
      if (n.nodeType !== 3) return;
      const raw = n.textContent ?? '', key = norm(raw);
      if (!key) return;
      const en = lookup(key);
      if (en === undefined || en === key) return;
      const pre = /^\s*/.exec(raw)?.[0] ?? '', post = /\s*$/.exec(raw)?.[0] ?? '';
      out.push({ key, en, set: (s) => { n.textContent = pre + s + post; } });
    });
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v) continue;
      const key = norm(v), en = lookup(key);
      if (en !== undefined && en !== key) out.push({ key, en, set: (s) => el.setAttribute(a, s) });
    }
  });
  root.querySelectorAll('meta[name=description]').forEach((m) => {
    const v = m.getAttribute('content'); if (!v) return;
    const key = norm(v), en = lookup(key);
    if (en !== undefined && en !== key) out.push({ key, en, set: (s) => m.setAttribute('content', s) });
  });
  return out;
}

/** Scrive i testi della pagina nella lingua attuale (le chiavi le legge solo la prima volta). */
export function applyDom(root: Document = document) {
  let list = units.get(root);
  if (!list) { list = collect(root); units.set(root, list); }
  markDocument();
  for (const u of list) u.set(LANG === 'it' ? u.key : u.en);
}

/** Traduce la pagina nella lingua scelta e la rende visibile. */
export function translateDom(root: Document = document) {
  // in italiano la pagina è già giusta; le chiavi si leggono comunque se la pagina ha l'interruttore di lingua,
  // ora che l'HTML è ancora quello scritto (prima che il codice aggiunga le sue parti)
  if (LANG !== 'it') applyDom(root);
  else { markDocument(); if (root.querySelector('[data-lang]') && !units.has(root)) units.set(root, collect(root)); }
  root.documentElement.classList.add('i18n-ready');
}

/**
 * Collega i pulsanti [data-lang] (interruttore EN/IT della landing e della privacy): la lingua cambia sul posto.
 * Prima i testi della pagina, nello stesso fotogramma; poi, al fotogramma dopo, `rest` (le parti disegnate dal codice).
 */
export function wireLangSwitch(root: Document = document, rest?: () => void) {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-lang]');
  const mark = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  buttons.forEach((b) => {
    const l = b.dataset.lang as Lang;
    b.title = l === 'en' ? 'English' : 'Italiano';
    b.addEventListener('click', () => {
      if (l === LANG) return;
      switchLang(l);
      applyDom(root);
      mark();
      if (rest) requestAnimationFrame(() => rest());
    });
  });
  mark();
}
