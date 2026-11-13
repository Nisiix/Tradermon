import { actionFor, onPrefsChange, touchActive } from '../systems/controls';

export type Key = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu' | 'map';

type Handler = (k: Key, ev?: KeyboardEvent) => boolean | void;
const stack: Handler[] = [];
export const held = new Set<Key>();
const worldPressed: Key[] = [];
const DIR_KEYS: Key[] = ['up', 'down', 'left', 'right'];
/** Direzioni tenute premute in ordine di pressione: l'ultima premuta ha la priorità. */
const dirOrder: Key[] = [];
/** Ultima direzione premuta (anche con un tocco rapido già rilasciato), consumata dal mondo. */
let dirTap: Key | undefined;

let settingsOpener: (() => void) | null = null;
/** Il tasto Impostazioni (O di default) apre il pannello ⚙ da qualunque schermata. */
export function onSettingsKey(fn: () => void) { settingsOpener = fn; }

/** Mentre si sceglie un nuovo tasto nelle impostazioni, la pressione va solo a chi la sta aspettando. */
let capture: ((code: string) => void) | null = null;
export function captureNextKey(fn: ((code: string) => void) | null) { capture = fn; }

function releaseAll() { held.clear(); dirOrder.length = 0; dirTap = undefined; }
/** Pressione nel mondo: le direzioni vanno in ordine di priorità, le azioni in coda. */
function worldDown(k: Key, repeat = false) {
  held.add(k);
  if (DIR_KEYS.includes(k)) {
    if (!dirOrder.includes(k)) dirOrder.push(k);
    if (!repeat) { dirOrder.splice(dirOrder.indexOf(k), 1); dirOrder.push(k); dirTap = k; }
  } else if (!repeat) worldPressed.push(k);
}
function keyUp(k: Key) {
  held.delete(k);
  const i = dirOrder.indexOf(k);
  if (i >= 0) dirOrder.splice(i, 1);
}
/** Direzione da seguire adesso: l'ultima tenuta premuta. */
export function heldDir(): Key | undefined { return dirOrder[dirOrder.length - 1]; }
/** Consuma la direzione premuta di recente (serve per i tocchi brevi rilasciati durante un passo). */
export function takeDirTap(): Key | undefined { const d = dirTap; dirTap = undefined; return d; }
export function hasWorldPress(): boolean { return worldPressed.length > 0; }

export function pushHandler(h: Handler) { stack.push(h); releaseAll(); }
export function popHandler(h: Handler) { const i = stack.lastIndexOf(h); if (i >= 0) stack.splice(i, 1); }
export function uiActive(): boolean { return stack.length > 0; }
export function takeWorldPress(): Key | undefined { return worldPressed.shift(); }
export function clearWorld() { worldPressed.length = 0; releaseAll(); }

export function press(k: Key, ev?: KeyboardEvent) {
  if (stack.length) {
    const consumed = stack[stack.length - 1](k, ev);
    if (consumed !== false && ev) ev.preventDefault();
    return;
  }
  if (DIR_KEYS.includes(k)) dirTap = k;
  else worldPressed.push(k);
}

export function initInput() {
  window.addEventListener('keydown', (ev) => {
    if (capture) { ev.preventDefault(); ev.stopImmediatePropagation(); const f = capture; capture = null; f(ev.code); return; }
    const tgt = ev.target as HTMLElement | null;
    const toggle = tgt && tgt.tagName === 'INPUT' && ['checkbox', 'radio'].includes((tgt as HTMLInputElement).type);
    const typing = tgt && !toggle && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT');
    if (typing && ev.code !== 'Escape') return;
    const isBtn = tgt && (tgt.tagName === 'BUTTON' || (toggle && ev.code === 'Space'));
    if (isBtn && (ev.code === 'Enter' || ev.code === 'Space')) return; // lascia il click nativo
    const act = actionFor(ev.code);
    if (!act) return;
    if (act === 'settings') { ev.preventDefault(); if (!ev.repeat) settingsOpener?.(); return; }
    const k: Key = act;
    if (!stack.length) {
      ev.preventDefault();
      worldDown(k, ev.repeat);
      return;
    }
    if (ev.repeat && (k === 'a' || k === 'b')) return;
    press(k, ev);
  });
  window.addEventListener('keyup', (ev) => {
    const k = actionFor(ev.code);
    if (k && k !== 'settings') keyUp(k);
  });
  window.addEventListener('blur', () => releaseAll());
}

/** Controlli touch: croce direzionale e pulsanti A/B/Menu. */
export function initTouch(root: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.className = 'touch';
  wrap.innerHTML = `
    <div class="pad">
      <button data-k="up" style="left:44px;top:0">▲</button>
      <button data-k="left" style="left:0;top:44px">◀</button>
      <button data-k="right" style="left:88px;top:44px">▶</button>
      <button data-k="down" style="left:44px;top:88px">▼</button>
    </div>
    <div class="ab">
      <button class="menu-b" data-k="menu">MENU</button>
      <button data-k="b">B</button>
      <button data-k="a" style="margin-bottom:24px">A</button>
    </div>`;
  root.appendChild(wrap);
  // la scelta tra automatico, sempre attivo e disattivato è nelle impostazioni ⚙
  const sync = () => document.body.classList.toggle('touch-on', touchActive());
  sync();
  onPrefsChange(sync);
  window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', sync);
  // Su telefono i pulsanti A/B coprirebbero quelli delle finestre: mentre una finestra è aperta
  // si toccano direttamente i suoi pulsanti e i comandi touch diventano trasparenti.
  const stageEl = document.getElementById('stage');
  if (stageEl) new MutationObserver(() => document.body.classList.toggle('has-modal', !!stageEl.querySelector('.modal-wrap, .battle, .title-screen'))).observe(stageEl, { childList: true });
  // Croce direzionale: si può far scivolare il pollice da una freccia all'altra senza staccarlo.
  const pad = wrap.querySelector('.pad') as HTMLElement;
  let padDir: Key | undefined;
  let padPointer = -1;
  const dirAt = (e: PointerEvent): Key | undefined => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return padDir; // zona morta al centro: resta la direzione attuale
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  const showDir = () => pad.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === padDir));
  const setDir = (k: Key | undefined) => {
    if (k === padDir) return;
    if (padDir) keyUp(padDir);
    padDir = k;
    if (k) { if (stack.length) press(k); else worldDown(k); }
    showDir();
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padPointer = e.pointerId;
    try { pad.setPointerCapture(e.pointerId); } catch { /* niente */ }
    setDir(dirAt(e) ?? undefined);
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padPointer) setDir(dirAt(e)); });
  const padUp = (e: PointerEvent) => { if (e.pointerId !== padPointer) return; padPointer = -1; setDir(undefined); };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  wrap.querySelectorAll('.ab button').forEach((b) => {
    const k = (b as HTMLElement).dataset.k as Key;
    const down = (e: Event) => {
      e.preventDefault();
      if (stack.length) press(k);
      else worldDown(k);
    };
    const up = (e: Event) => { e.preventDefault(); keyUp(k); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });
}
