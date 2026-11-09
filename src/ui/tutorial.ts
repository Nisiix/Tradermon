import { pushHandler, popHandler, type Key } from './input';
import { el, getStage } from './core';
import { beep } from '../systems/audio';

/** true se il giocatore usa uno schermo touch senza mouse (telefono, tablet). */
export function isTouchDevice(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const fine = window.matchMedia?.('(pointer: fine)').matches;
  return !!coarse || (navigator.maxTouchPoints > 0 && !fine);
}

const SEEN = 'tradermon.controlsSeen';
export function controlsSeen(): boolean { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } }

interface Step { want: Key[]; title: string; desk: string; touch: string; hint: Key }

const STEPS: Step[] = [
  { want: ['up', 'down', 'left', 'right'], hint: 'up', title: 'Muoversi',
    desk: 'Premi le <kbd>Frecce</kbd> oppure <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Tieni premuto per camminare.',
    touch: 'Tocca la <b>croce direzionale</b> in basso a sinistra. Tieni premuto per camminare.' },
  { want: ['a'], hint: 'a', title: 'Parlare e confermare',
    desk: 'Premi <kbd>Z</kbd>, <kbd>Invio</kbd> o <kbd>Spazio</kbd>. Guarda una persona o un cartello e premi per parlare. Nei menu conferma la scelta.',
    touch: 'Tocca il pulsante <b>A</b> a destra. Guarda una persona o un cartello e tocca A per parlare. Nei menu conferma la scelta.' },
  { want: ['b'], hint: 'b', title: 'Tornare indietro',
    desk: 'Premi <kbd>X</kbd> o <kbd>Esc</kbd> per chiudere una finestra o annullare.',
    touch: 'Tocca il pulsante <b>B</b> per chiudere una finestra o annullare.' },
  { want: ['menu'], hint: 'menu', title: 'Aprire il menu',
    desk: 'Premi <kbd>M</kbd> per il menu: Investidex, Portafoglio, Lezioni, Salva e Opzioni.',
    touch: 'Tocca <b>MENU</b> per Investidex, Portafoglio, Lezioni, Salva e Opzioni.' },
];

/** Mini tutorial interattivo sui comandi, diverso per tastiera e touch. */
export function controlsTutorial(): Promise<void> {
  return new Promise((resolve) => {
    let touch = isTouchDevice();
    let i = 0;
    const wrap = el('div', 'tutorial');
    const box = el('div', 'box tut-box');
    wrap.appendChild(box);
    getStage().appendChild(wrap);
    const clearHints = () => document.querySelectorAll('.touch button.hint').forEach((b) => b.classList.remove('hint'));
    const render = () => {
      clearHints();
      const done = i >= STEPS.length;
      const s = STEPS[Math.min(i, STEPS.length - 1)];
      const dots = STEPS.map((_, j) => `<i class="${j < i ? 'ok' : j === i ? 'cur' : ''}"></i>`).join('');
      box.innerHTML = `
        <div class="tut-head"><span>COMANDI · ${touch ? 'TOUCH' : 'TASTIERA'}</span><span class="dots">${dots}</span></div>
        ${done
          ? `<h3>Perfetto!</h3><p>Hai provato tutti i comandi. Puoi rivederli quando vuoi da <b>Menu → Opzioni</b>.</p><p class="tut-try">${touch ? 'Tocca <b>A</b>' : 'Premi <kbd>Z</kbd>'} per iniziare l'avventura.</p>`
          : `<h3>${i + 1}. ${s.title}</h3>${touch ? touchPad(s.hint) : keyboard(s.hint)}<p>${touch ? s.touch : s.desk}</p><p class="tut-try">Prova adesso!</p>`}
        <div class="tut-foot"><button class="btn sw">${touch ? 'Uso la tastiera' : 'Uso il touch'}</button><button class="btn skip">${done ? 'Inizia' : 'Salta'}</button></div>`;
      box.querySelector('.sw')!.addEventListener('click', () => { touch = !touch; render(); });
      box.querySelector('.skip')!.addEventListener('click', finish);
      if (touch && !done) document.querySelector(`.touch button[data-k="${s.hint}"]`)?.classList.add('hint');
    };
    const finish = () => {
      popHandler(h); clearHints(); wrap.remove();
      try { localStorage.setItem(SEEN, '1'); } catch { /* storage non disponibile */ }
      resolve();
    };
    const h = (k: Key) => {
      if (i >= STEPS.length) { if (k === 'a') finish(); return true; }
      if (STEPS[i].want.includes(k)) {
        beep('ok');
        box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
        i++;
        setTimeout(render, 220);
      }
      return true;
    };
    pushHandler(h);
    render();
  });
}

function keyboard(hint: Key): string {
  const k = (label: string, key: Key | '', wide = '') => `<span class="kb ${wide} ${key === hint || (hint === 'up' && ['up', 'down', 'left', 'right'].includes(key)) ? 'on' : ''}">${label}</span>`;
  return `<div class="kbd-map">
    <div class="arrows">${k('▲', 'up')}<div>${k('◀', 'left')}${k('▼', 'down')}${k('▶', 'right')}</div></div>
    <div class="keys">${k('Z', 'a')}${k('X', 'b')}${k('M', 'menu')}${k('Invio', 'a', 'w')}${k('Esc', 'b', 'w')}</div>
  </div>`;
}

function touchPad(hint: Key): string {
  const on = (key: Key) => (key === hint || (hint === 'up' && ['up', 'down', 'left', 'right'].includes(key)) ? 'on' : '');
  return `<div class="pad-map">
    <div class="cross"><span class="${on('up')} u">▲</span><span class="${on('left')} l">◀</span><span class="${on('right')} r">▶</span><span class="${on('down')} d">▼</span></div>
    <div class="abm"><span class="pill ${on('menu')}">MENU</span><span class="round ${on('b')}">B</span><span class="round ${on('a')}">A</span></div>
  </div>`;
}
