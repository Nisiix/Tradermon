export type Key = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu';

type Handler = (k: Key, ev?: KeyboardEvent) => boolean | void;
const stack: Handler[] = [];
export const held = new Set<Key>();
const worldPressed: Key[] = [];

const MAP: Record<string, Key> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b',
  KeyM: 'menu',
};

export function pushHandler(h: Handler) { stack.push(h); held.clear(); }
export function popHandler(h: Handler) { const i = stack.lastIndexOf(h); if (i >= 0) stack.splice(i, 1); }
export function uiActive(): boolean { return stack.length > 0; }
export function takeWorldPress(): Key | undefined { return worldPressed.shift(); }
export function clearWorld() { worldPressed.length = 0; held.clear(); }

export function press(k: Key, ev?: KeyboardEvent) {
  if (stack.length) {
    const consumed = stack[stack.length - 1](k, ev);
    if (consumed !== false && ev) ev.preventDefault();
    return;
  }
  worldPressed.push(k);
}

export function initInput() {
  window.addEventListener('keydown', (ev) => {
    const tgt = ev.target as HTMLElement | null;
    const toggle = tgt && tgt.tagName === 'INPUT' && ['checkbox', 'radio'].includes((tgt as HTMLInputElement).type);
    const typing = tgt && !toggle && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT');
    if (typing && ev.code !== 'Escape') return;
    const isBtn = tgt && (tgt.tagName === 'BUTTON' || (toggle && ev.code === 'Space'));
    if (isBtn && (ev.code === 'Enter' || ev.code === 'Space')) return; // lascia il click nativo
    const k = MAP[ev.code];
    if (!k) return;
    if (!stack.length) {
      ev.preventDefault();
      if (!ev.repeat) worldPressed.push(k);
      held.add(k);
      return;
    }
    if (ev.repeat && (k === 'a' || k === 'b')) return;
    press(k, ev);
  });
  window.addEventListener('keyup', (ev) => {
    const k = MAP[ev.code];
    if (k) held.delete(k);
  });
  window.addEventListener('blur', () => held.clear());
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
  // Su telefono i pulsanti A/B coprirebbero quelli delle finestre: mentre una finestra è aperta
  // si toccano direttamente i suoi pulsanti e i comandi touch diventano trasparenti.
  const stageEl = document.getElementById('stage');
  if (stageEl) new MutationObserver(() => document.body.classList.toggle('has-modal', !!stageEl.querySelector('.modal-wrap, .battle'))).observe(stageEl, { childList: true });
  wrap.querySelectorAll('button').forEach((b) => {
    const k = (b as HTMLElement).dataset.k as Key;
    const down = (e: Event) => {
      e.preventDefault();
      if (stack.length) press(k);
      else { worldPressed.push(k); held.add(k); }
    };
    const up = (e: Event) => { e.preventDefault(); held.delete(k); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });
}
