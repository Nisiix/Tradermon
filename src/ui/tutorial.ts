import { pushHandler, popHandler, type Key } from './input';
import { el, esc, getStage } from './core';
import { beep } from '../systems/audio';
import { openControls } from './settings';
import { keysOf, onPrefsChange, touchActive, isTouchDevice as touchDevice, type Action } from '../systems/controls';

/** true se il giocatore usa uno schermo touch senza mouse (telefono, tablet). */
export const isTouchDevice = touchDevice;

const SEEN = 'tradermon.controlsSeen';
export function controlsSeen(): boolean { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } }

const kbd = (a: Action) => keysOf(a).map((k) => `<kbd>${esc(k)}</kbd>`).join(' ') || '<i>nessun tasto</i>';
const moveKeys = () => {
  const [u, d, l, r] = (['up', 'down', 'left', 'right'] as Action[]).map(keysOf);
  const rows: string[] = [];
  for (let i = 0; i < Math.max(u.length, d.length, l.length, r.length); i++) {
    rows.push([u[i], l[i], d[i], r[i]].filter(Boolean).map((k) => `<kbd>${esc(k!)}</kbd>`).join(''));
  }
  return rows.join(' oppure ');
};

interface Step { want: Action[]; title: string; desk: () => string; touch: string; hint: Action }

const STEPS: Step[] = [
  { want: ['up', 'down', 'left', 'right'], hint: 'up', title: 'Muoversi',
    desk: () => `Premi ${moveKeys()}. Tieni premuto per camminare.`,
    touch: 'Tocca la <b>croce direzionale</b> in basso a sinistra. Tieni premuto per camminare.' },
  { want: ['a'], hint: 'a', title: 'Parlare e confermare',
    desk: () => `Premi ${kbd('a')}. Guarda una persona o un cartello e premi per parlare. Nei menu conferma la scelta.`,
    touch: 'Tocca il pulsante <b>A</b> a destra. Guarda una persona o un cartello e tocca A per parlare. Nei menu conferma la scelta.' },
  { want: ['b'], hint: 'b', title: 'Tornare indietro',
    desk: () => `Premi ${kbd('b')} per chiudere una finestra o annullare.`,
    touch: 'Tocca il pulsante <b>B</b> per chiudere una finestra o annullare.' },
  { want: ['menu'], hint: 'menu', title: 'Aprire il menu',
    desk: () => `Premi ${kbd('menu')} per il menu: Investidex, Portafoglio, Lezioni, Salva e Opzioni.`,
    touch: 'Tocca <b>MENU</b> per Investidex, Portafoglio, Lezioni, Salva e Opzioni.' },
  { want: ['settings'], hint: 'settings', title: 'Impostazioni',
    desk: () => `Premi ${kbd('settings')} (oppure clicca ⚙ in alto a destra) per aprire le impostazioni, anche mentre esplori il mondo: comandi, touch, volume e ritorno alla home. Premilo di nuovo per chiuderle.`,
    touch: 'Tocca l\'icona <b>⚙</b> in alto a destra per aprire le impostazioni: comandi, touch, volume e ritorno alla home. Chiudile con ✕.' },
];

/** Legenda: a cosa serve ciascun tasto (tastiera) o pulsante (touch). */
function legend(touch: boolean, hint: Action | null): string {
  const rows: [Action[], string, string][] = touch
    ? [
      [['up', 'down', 'left', 'right'], '<span class="lg-pad">✚</span>', 'Croce: cammini nel mondo e scorri le voci dei menu.'],
      [['a'], '<span class="lg-round">A</span>', 'Parli con le persone, leggi i cartelli, confermi e fai scorrere i dialoghi.'],
      [['b'], '<span class="lg-round">B</span>', 'Chiudi una finestra, annulli una scelta, torni indietro.'],
      [['menu'], '<span class="lg-pill">MENU</span>', 'Apri il menu di gioco (Investidex, Portafoglio, Agenda, Salva, Opzioni).'],
      [['settings'], '<span class="lg-pill">⚙</span>', 'In alto a destra: comandi, modalità touch, volume e ritorno alla home.'],
    ]
    : [
      [['up', 'down', 'left', 'right'], moveKeys(), 'Cammini nel mondo; nei menu e nelle finestre sposti la selezione.'],
      [['a'], kbd('a'), 'Parli con chi hai davanti, leggi i cartelli, confermi e fai scorrere i dialoghi.'],
      [['b'], kbd('b'), 'Chiudi la finestra aperta, annulli una scelta, torni indietro.'],
      [['menu'], kbd('menu'), 'Apri il menu di gioco (Investidex, Portafoglio, Agenda, Diario, Lezioni, Salva, Opzioni).'],
      [['settings'], kbd('settings'), 'Apri e chiudi le impostazioni ⚙, anche nel mondo (o clicca l\'icona in alto a destra): comandi, touch, volume, home.'],
    ];
  return `<div class="tut-legend"><div class="lg-title">Cosa fa ogni ${touch ? 'pulsante' : 'tasto'}</div>${rows.map(([ks, keys, use]) =>
    `<div class="lg-row${hint && ks.includes(hint) ? ' on' : ''}"><span class="lg-keys">${keys}</span><span class="lg-use">${use}</span></div>`).join('')}</div>`;
}

/** Mini tutorial interattivo sui comandi, diverso per tastiera e touch (la modalità si sceglie da ⚙). */
export function controlsTutorial(): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const wrap = el('div', 'tutorial');
    const box = el('div', 'box tut-box');
    wrap.appendChild(box);
    getStage().appendChild(wrap);
    let open = true;
    let unsub = () => {};
    const clearHints = () => document.querySelectorAll('.touch button.hint, .gear-btn.hint').forEach((b) => b.classList.remove('hint'));
    const render = () => {
      if (!open) return;
      const touch = touchActive();
      clearHints();
      const done = i >= STEPS.length;
      const s = STEPS[Math.min(i, STEPS.length - 1)];
      const dots = STEPS.map((_, j) => `<i class="${j < i ? 'ok' : j === i ? 'cur' : ''}"></i>`).join('');
      box.innerHTML = `
        <div class="tut-head"><span>COMANDI · ${touch ? 'TOUCH' : 'TASTIERA'}</span><span class="dots">${dots}</span></div>
        ${done
          ? `<h3>Perfetto!</h3><p>Hai provato tutti i comandi. Puoi rivederli da <b>Menu → Opzioni</b> e cambiarli dall'icona <b>⚙</b> in alto a destra.</p>${legend(touch, null)}<p class="tut-try">${touch ? 'Tocca <b>A</b>' : `Premi ${kbd('a')}`} per iniziare l'avventura.</p>`
          : `<h3>${i + 1}. ${s.title}</h3>${touch ? touchPad(s.hint) : keyboard(s.hint)}<p>${touch ? s.touch : s.desk()}</p><p class="tut-try">Prova adesso!</p>${legend(touch, s.hint)}`}
        <div class="tut-foot"><button class="btn keys">Cambia tasti e touch</button><button class="btn skip">${done ? 'Inizia' : 'Salta'}</button></div>`;
      box.querySelector('.skip')!.addEventListener('click', finish);
      box.querySelector('.keys')!.addEventListener('click', () => { void openControls(); });
      if (!done && s.hint === 'settings') document.querySelector('.gear-btn')?.classList.add('hint');
      else if (touch && !done) document.querySelector(`.touch button[data-k="${s.hint}"]`)?.classList.add('hint');
    };
    const finish = () => {
      open = false;
      unsub();
      window.removeEventListener('tradermon:settings', onSettings);
      popHandler(h); clearHints(); wrap.remove();
      try { localStorage.setItem(SEEN, '1'); } catch { /* storage non disponibile */ }
      resolve();
    };
    const advance = (k: Action) => {
      if (i >= STEPS.length || !STEPS[i].want.includes(k)) return;
      beep('ok');
      box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
      i++;
      setTimeout(render, 220);
    };
    const h = (k: Key) => {
      if (i >= STEPS.length) { if (k === 'a') finish(); return true; }
      advance(k);
      return true;
    };
    // il tasto Impostazioni non passa dai gestori: il pannello avvisa quando si apre
    const onSettings = () => advance('settings');
    window.addEventListener('tradermon:settings', onSettings);
    pushHandler(h);
    unsub = onPrefsChange(render);
    render();
  });
}

function keyboard(hint: Action): string {
  const dirs: Action[] = ['up', 'down', 'left', 'right'];
  const on = (key: Action) => (key === hint || (hint === 'up' && dirs.includes(key)) ? 'on' : '');
  const first = (a: Action) => esc(keysOf(a)[0] ?? '—');
  const group = (a: Action, cap: string) => `<div class="kgrp ${on(a)}"><div>${keysOf(a).map((x) => `<span class="kb ${on(a)}">${esc(x)}</span>`).join('') || '<span class="kb">—</span>'}</div><small>${cap}</small></div>`;
  return `<div class="kbd-map">
    <div class="kgrp ${on('up')}"><div class="arrows"><span class="kb ${on('up')}">${first('up')}</span><div><span class="kb ${on('left')}">${first('left')}</span><span class="kb ${on('down')}">${first('down')}</span><span class="kb ${on('right')}">${first('right')}</span></div></div><small>Muoversi</small></div>
    <div class="keys">${group('a', 'Conferma')}${group('b', 'Indietro')}${group('menu', 'Menu')}${group('settings', 'Impostazioni')}</div>
  </div>`;
}

function touchPad(hint: Action): string {
  const on = (key: Action) => (key === hint || (hint === 'up' && ['up', 'down', 'left', 'right'].includes(key)) ? 'on' : '');
  return `<div class="pad-map">
    <div class="cross"><span class="${on('up')} u">▲</span><span class="${on('left')} l">◀</span><span class="${on('right')} r">▶</span><span class="${on('down')} d">▼</span></div>
    <div class="abm"><span class="pill ${on('menu')}">MENU</span><span class="round ${on('b')}">B</span><span class="round ${on('a')}">A</span><span class="pill ${on('settings')}">⚙</span></div>
  </div>`;
}
