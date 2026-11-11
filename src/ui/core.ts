import { pushHandler, popHandler, type Key } from './input';
import { beep } from '../systems/audio';
import { S } from '../systems/state';

let stage: HTMLElement;

export function initUI(): HTMLElement {
  stage = document.getElementById('stage') as HTMLElement;
  return stage;
}
export function getStage() { return stage; }

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Sostituisce i segnaposto {nome}, {rivale} nei testi. */
export function fill(s: string): string {
  return s.replace(/\{nome\}/g, S?.name ?? '').replace(/\{rivale\}/g, S?.rival ?? '');
}

// ---------------- Dialoghi ----------------

export function say(lines: string | string[], who?: string): Promise<void> {
  const arr = (Array.isArray(lines) ? lines : [lines]).map(fill);
  return new Promise((resolve) => {
    const box = el('div', 'box dialog');
    const whoEl = who ? el('div', 'who', esc(who)) : null;
    const txt = el('div');
    const more = el('div', 'more', '▼');
    if (whoEl) box.appendChild(whoEl);
    box.append(txt, more);
    stage.appendChild(box);
    let i = 0;
    let typing = false;
    let timer = 0;
    const speed = [40, 22, 10, 0][S?.options?.textSpeed ?? 2] ?? 10;
    const show = () => {
      const full = arr[i];
      more.style.visibility = 'hidden';
      if (speed === 0) { txt.textContent = full; typing = false; more.style.visibility = 'visible'; return; }
      typing = true;
      let n = 0;
      clearInterval(timer);
      timer = window.setInterval(() => {
        n += 2;
        txt.textContent = full.slice(0, n);
        if (n >= full.length) { clearInterval(timer); typing = false; more.style.visibility = 'visible'; }
      }, speed);
    };
    const next = () => {
      if (typing) { clearInterval(timer); txt.textContent = arr[i]; typing = false; more.style.visibility = 'visible'; return; }
      beep('tick');
      i++;
      if (i >= arr.length) { popHandler(h); box.remove(); resolve(); return; }
      show();
    };
    const h = (k: Key) => { if (k === 'a' || k === 'b') next(); };
    box.addEventListener('click', next);
    pushHandler(h);
    show();
  });
}

// ---------------- Menu di scelta ----------------

export interface ChooseOpts { cancel?: boolean; title?: string; disabled?: boolean[]; pos?: 'right' | 'center'; prompt?: string; who?: string; onMove?: (i: number) => void }

export async function choose(options: string[], opts: ChooseOpts = {}): Promise<number> {
  let promptBox: HTMLElement | null = null;
  if (opts.prompt) {
    promptBox = el('div', 'box dialog');
    if (opts.who) promptBox.appendChild(el('div', 'who', esc(opts.who)));
    promptBox.appendChild(el('div', '', esc(fill(opts.prompt))));
    stage.appendChild(promptBox);
  }
  return new Promise((resolve) => {
    const m = el('div', 'box menu');
    if (opts.title) m.appendChild(el('div', 'title', esc(opts.title)));
    const items = options.map((o, i) => {
      const it = el('div', 'opt' + (opts.disabled?.[i] ? ' dis' : ''), esc(fill(o)));
      it.addEventListener('click', () => { sel = i; pick(); });
      it.addEventListener('mouseenter', () => { sel = i; render(); });
      m.appendChild(it);
      return it;
    });
    if (opts.pos === 'center') { m.style.left = '50%'; m.style.top = '50%'; m.style.transform = 'translate(-50%,-50%)'; }
    else { m.style.right = '10px'; m.style.bottom = promptBox ? '118px' : '10px'; }
    stage.appendChild(m);
    let sel = 0;
    const render = () => { items.forEach((it, i) => it.classList.toggle('sel', i === sel)); opts.onMove?.(sel); };
    const done = (v: number) => { popHandler(h); m.remove(); promptBox?.remove(); resolve(v); };
    const pick = () => { if (opts.disabled?.[sel]) { beep('bad'); return; } beep('ok'); done(sel); };
    const h = (k: Key) => {
      if (k === 'up') { sel = (sel + options.length - 1) % options.length; beep('tick'); render(); }
      else if (k === 'down') { sel = (sel + 1) % options.length; beep('tick'); render(); }
      else if (k === 'a') pick();
      else if (k === 'b' && opts.cancel) done(-1);
    };
    pushHandler(h);
    render();
  });
}

export async function confirm(prompt: string, who?: string): Promise<boolean> {
  return (await choose(['Sì', 'No'], { prompt, who, cancel: true })) === 0;
}

// ---------------- Finestre modali ----------------

export interface ModalOpts { serious?: boolean; closable?: boolean; wide?: boolean }
export interface ModalCtl<T> { body: HTMLElement; foot: HTMLElement; head: HTMLElement; close: (v?: T) => void; button: (label: string, fn: () => void, cls?: string) => HTMLButtonElement }

export function modal<T = unknown>(title: string, build: (ctl: ModalCtl<T>) => void, opts: ModalOpts = {}): Promise<T | undefined> {
  return new Promise((resolve) => {
    const wrap = el('div', 'modal-wrap');
    const m = el('div', 'box modal' + (opts.serious ? ' serious' : ''));
    if (opts.wide) m.style.width = 'min(980px, 100%)';
    const head = el('div', 'head');
    head.appendChild(el('span', '', esc(title)));
    const body = el('div', 'body');
    const foot = el('div', 'foot');
    m.append(head, body, foot);
    wrap.appendChild(m);
    stage.appendChild(wrap);
    let closed = false;
    const close = (v?: T) => { if (closed) return; closed = true; popHandler(h); wrap.remove(); resolve(v); };
    // Tastiera e pulsanti A/B anche nelle finestre: A conferma il pulsante evidenziato (o il principale),
    // le frecce spostano l'evidenziazione tra i pulsanti in basso, B chiude.
    const h = (k: Key) => {
      if (k === 'b' && opts.closable !== false) { close(undefined); return true; }
      const visible = (e: HTMLElement) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null;
      const btns = ([...foot.querySelectorAll('button')] as HTMLButtonElement[]).filter(visible);
      const all = ([...body.querySelectorAll('button, input[type=checkbox], input[type=radio], [tabindex="0"]'), ...btns] as HTMLElement[]).filter(visible);
      const act = document.activeElement as HTMLElement | null;
      const inModal = !!act && m.contains(act) && act !== m;
      if (k === 'a') {
        if (inModal && all.includes(act!)) { act!.click(); return true; }
        const prim = foot.querySelector('button.primary:not([disabled])') as HTMLButtonElement | null;
        if (prim) { prim.click(); return true; }
        // pulsante principale disattivato: di solito manca una spunta, quindi la mettiamo con A
        const ck = body.querySelector('input[type=checkbox]:not(:checked)') as HTMLInputElement | null;
        if (ck) { ck.click(); const p2 = foot.querySelector('button.primary:not([disabled])') as HTMLButtonElement | null; (p2 ?? ck).focus(); return true; }
        if (btns.length) { btns[btns.length - 1].focus(); return true; }
        return false;
      }
      if ((k === 'left' || k === 'right' || k === 'up' || k === 'down') && all.length) {
        const list = k === 'left' || k === 'right' ? (btns.length ? btns : all) : all;
        const cur = inModal ? list.indexOf(act!) : -1;
        const fwd = k === 'right' || k === 'down';
        const i = cur < 0 ? Math.max(0, list.findIndex((b) => b.classList.contains('primary'))) : (cur + (fwd ? 1 : list.length - 1)) % list.length;
        list[i].focus();
        list[i].scrollIntoView({ block: 'nearest' });
        return true;
      }
      return false;
    };
    const button = (label: string, fn: () => void, cls = '') => {
      const b = el('button', 'btn ' + cls, esc(label));
      b.addEventListener('click', fn);
      foot.appendChild(b);
      return b;
    };
    if (opts.closable !== false) {
      const x = el('button', 'btn', '✕');
      x.title = 'Chiudi (X)';
      x.addEventListener('click', () => close(undefined));
      head.appendChild(x);
    }
    pushHandler(h);
    build({ body, foot, head, close, button });
    const first = foot.querySelector('button.primary') as HTMLButtonElement | null;
    if (first && !body.querySelector('input,select')) setTimeout(() => first.focus(), 30);
  });
}

export function ask(prompt: string, def = '', maxLen = 10): Promise<string | null> {
  return modal<string>(prompt, ({ body, close, button }) => {
    const i = el('input', 'tx') as HTMLInputElement;
    i.value = def;
    i.maxLength = maxLen;
    body.appendChild(i);
    body.appendChild(el('p', 'small muted', 'Scrivi e premi Invio (o tocca OK).'));
    const ok = () => close(i.value.trim() || def);
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    button('OK', ok, 'primary');
    setTimeout(() => { i.focus(); i.select(); }, 30);
  }, { closable: false }).then((v) => v ?? def);
}

let toastTimer = 0;
export function toast(msg: string) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', 'box toast', esc(msg));
  stage.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 2600);
}

export function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  return `<div class="bar ${p < 25 ? 'low' : p < 50 ? 'warn' : ''}"><i style="width:${p}%"></i></div>`;
}
