// Traduzione delle pagine HTML statiche (landing, privacy, pagina del gioco).
// Le chiavi sono il contenuto HTML degli elementi "di testo" (senza blocchi al loro interno), con gli spazi
// compressi: lo stesso criterio di textKeys() serve sia a estrarle sia a tradurle.
import { LANG, tr, markDocument, setLang, type Lang } from './index';

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

/** Traduce la pagina nella lingua scelta e la rende visibile. */
export function translateDom(root: Document = document) {
  markDocument();
  if (LANG !== 'it') {
    const done = new Set<Element>();
    root.querySelectorAll(TEXT).forEach((el) => {
      if (!inlineOnly(el) || [...done].some((d) => d.contains(el))) return;
      const k = norm(el.innerHTML), t = tr(k);
      if (t !== k) { el.innerHTML = t; done.add(el); }
    });
    root.querySelectorAll('*').forEach((el) => {
      if (![...done].some((d) => d.contains(el))) el.childNodes.forEach((n) => {
        if (n.nodeType !== 3) return;
        const raw = n.textContent ?? '', k = norm(raw);
        if (!k) return;
        const t = tr(k);
        if (t !== k) n.textContent = (/^\s*/.exec(raw)?.[0] ?? '') + t + (/\s*$/.exec(raw)?.[0] ?? '');
      });
      for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const t = tr(norm(v)); if (t !== norm(v)) el.setAttribute(a, t); } }
    });
    root.querySelectorAll('meta[name=description]').forEach((m) => { const v = m.getAttribute('content'); if (v) m.setAttribute('content', tr(norm(v))); });
  }
  root.documentElement.classList.add('i18n-ready');
}

/** Collega i pulsanti [data-lang] (interruttore EN/IT della landing). */
export function wireLangSwitch(root: Document = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
    const l = b.dataset.lang as Lang;
    b.setAttribute('aria-pressed', String(l === LANG));
    b.title = l === 'en' ? 'English' : 'Italiano';
    b.addEventListener('click', () => setLang(l));
  });
}
