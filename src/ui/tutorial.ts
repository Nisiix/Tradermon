import { pushHandler, popHandler, type Key } from './input';
import { el, esc, getStage } from './core';
import { beep } from '../systems/audio';
import { openControls } from './settings';
import { keysOf, onPrefsChange, touchActive, isTouchDevice as touchDevice, type Action } from '../systems/controls';
import { T } from '../i18n';

/** true se il giocatore usa uno schermo touch senza mouse (telefono, tablet). */
export const isTouchDevice = touchDevice;

const SEEN = 'tradermon.controlsSeen';
export function controlsSeen(): boolean { try { return localStorage.getItem(SEEN) === '1'; } catch { return true; } }

const kbd = (a: Action) => keysOf(a).map((k) => `<kbd>${esc(k)}</kbd>`).join(' ') || T('<i>nessun tasto</i>');
const moveKeys = () => {
  const [u, d, l, r] = (['up', 'down', 'left', 'right'] as Action[]).map(keysOf);
  const rows: string[] = [];
  for (let i = 0; i < Math.max(u.length, d.length, l.length, r.length); i++) {
    rows.push([u[i], l[i], d[i], r[i]].filter(Boolean).map((k) => `<kbd>${esc(k!)}</kbd>`).join(''));
  }
  return rows.join(T(' oppure '));
};

interface Step { want: Action[]; title: string; desk: () => string; touch: string; hint: Action }

const STEPS: Step[] = [
  { want: ['up', 'down', 'left', 'right'], hint: 'up', title: T('Muoversi'),
    desk: () => T`Premi ${moveKeys()}. Tieni premuto per camminare.`,
    touch: T('Tocca la <b>croce direzionale</b> in basso a sinistra e tieni premuto per camminare, oppure tocca un punto della mappa per andarci.') },
  { want: ['a'], hint: 'a', title: T('Parlare e confermare'),
    desk: () => T`Premi ${kbd('a')} davanti a una persona o a un cartello per parlare; nei menu confermi.`,
    touch: T('Tocca <b>A</b> davanti a una persona o a un cartello per parlare; nei menu confermi.') },
  { want: ['b'], hint: 'b', title: T('Tornare indietro'),
    desk: () => T`Premi ${kbd('b')} per chiudere una finestra o annullare.`,
    touch: T('Tocca il pulsante <b>B</b> per chiudere una finestra o annullare.') },
  { want: ['menu'], hint: 'menu', title: T('Aprire il menu'),
    desk: () => T`Premi ${kbd('menu')} per aprire il menu di gioco.`,
    touch: T('Tocca <b>MENU</b> per aprire il menu di gioco.') },
  { want: ['settings'], hint: 'settings', title: T('Opzioni'),
    desk: () => T`Premi ${kbd('settings')} (oppure clicca ⚙ in alto a destra) per aprire le Opzioni. Premilo di nuovo per chiuderle.`,
    touch: T('Tocca l\'icona <b>⚙</b> in alto a destra per aprire le Opzioni. Chiudile con ✕.') },
];

/** Le voci del menu di gioco, come in MENU_USE (systems/controls.ts). */
const menuUse = () => T('Apri il menu di gioco: Investidex, Portafoglio, Agenda, Diario, Profilo, Mappa, Chiavi API, Opzioni, Salva ed Esci dal gioco.');

/** Legenda: a cosa serve ciascun tasto (tastiera) o pulsante (touch). */
function legend(touch: boolean, hint: Action | null): string {
  const rows: [Action[], string, string][] = touch
    ? [
      [['up', 'down', 'left', 'right'], '<span class="lg-pad">✚</span>', T('Croce: cammini e scorri i menu. Puoi anche toccare un punto della mappa per andarci, una persona per avvicinarti e una risposta per sceglierla.')],
      [['a'], '<span class="lg-round">A</span>', T('Parli con le persone, leggi i cartelli, confermi e fai scorrere i dialoghi.')],
      [['b'], '<span class="lg-round">B</span>', T('Chiudi una finestra, annulli una scelta, torni indietro.')],
      [['menu'], '<span class="lg-pill">MENU</span>', menuUse()],
      [['settings'], '<span class="lg-pill">⚙</span>', T('In alto a destra: apri e chiudi le Opzioni (lingua, audio, schermo e testo, comandi, partita e giocatore).')],
    ]
    : [
      [['up', 'down', 'left', 'right'], moveKeys(), T('Cammini nel mondo; nei menu e nelle finestre sposti la selezione.')],
      [['a'], kbd('a'), T('Parli con chi hai davanti, leggi i cartelli, confermi e fai scorrere i dialoghi.')],
      [['b'], kbd('b'), T('Chiudi la finestra aperta, annulli una scelta, torni indietro.')],
      [['menu'], kbd('menu'), menuUse()],
      [['map'], kbd('map'), T('Apri subito la Mappa della Regione.')],
      [['settings'], kbd('settings'), T('Apri e chiudi le Opzioni ⚙, anche nel mondo (o clicca l\'icona in alto a destra): lingua, audio, schermo e testo, comandi, partita e giocatore.')],
    ];
  return `<div class="tut-legend"><div class="lg-title">${touch ? T('Cosa fa ogni pulsante') : T('Cosa fa ogni tasto')}</div>${rows.map(([ks, keys, use]) =>
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
    let customizing = false;
    const skipped = new Set<number>();
    let unsub = () => {};
    const clearHints = () => document.querySelectorAll('.touch button.hint, .gear-btn.hint').forEach((b) => b.classList.remove('hint'));
    const render = () => {
      if (!open) return;
      const touch = touchActive();
      clearHints();
      const done = i >= STEPS.length;
      const s = STEPS[Math.min(i, STEPS.length - 1)];
      const dots = STEPS.map((_, j) => `<i class="${j < i ? (skipped.has(j) ? 'skip' : 'ok') : j === i ? 'cur' : ''}"></i>`).join('');
      const all = skipped.size === 0;
      box.innerHTML = T`
        <div class="tut-head"><span>COMANDI · ${touch ? T('TOUCH') : T('TASTIERA')}</span><span class="dots">${dots}</span></div>
        ${done
          ? T`<h3>${all ? T('Perfetto!') : T('Ecco tutti i comandi')}</h3><p>${all ? T('Hai provato tutti i comandi.') : T('Qui sotto trovi a cosa serve ogni comando, anche quelli che hai saltato.')} Questa guida si riapre da <b>⚙ → Comandi</b>.</p>${legend(touch, null)}<p class="tut-try">${touch ? T('Tocca <b>A</b>') : T`Premi ${kbd('a')}`} o <b>Prosegui</b> per iniziare l'avventura.</p>`
          : T`<h3>${i + 1}. ${s.title}</h3>${touch ? touchPad(s.hint) : keyboard(s.hint)}<p>${touch ? s.touch : s.desk()}</p><p class="tut-try">Prova adesso!</p>${legend(touch, s.hint)}`}
        <div class="tut-foot"><button class="btn custom" title="Cambia i tasti e i comandi touch">Personalizza</button>${done ? '' : T('<button class="tut-skip" type="button">Salta la guida</button>')}<button class="btn primary next">Prosegui</button></div>`;
      box.querySelector('.tut-foot .next')!.addEventListener('click', next);
      box.querySelector('.tut-foot .custom')!.addEventListener('click', () => { void customize(); });
      box.querySelector('.tut-foot .tut-skip')?.addEventListener('click', () => { if (!customizing) finish(); });
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
    /** Prosegui: passo successivo (anche senza aver provato il tasto) o, alla fine, chiude la guida. */
    const next = () => {
      if (!open || customizing) return;
      if (i >= STEPS.length) { finish(); return; }
      skipped.add(i);
      i++;
      beep('tick');
      render();
    };
    /** Personalizza: apre i comandi sopra la guida e, alla chiusura, si torna allo stesso passo. */
    const customize = async () => {
      if (customizing) return;
      customizing = true;
      try { await openControls(); } finally { customizing = false; }
      render();
    };
    const advance = (k: Action) => {
      if (customizing) return;
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
  return T`<div class="kbd-map">
    <div class="kgrp ${on('up')}"><div class="arrows"><span class="kb ${on('up')}">${first('up')}</span><div><span class="kb ${on('left')}">${first('left')}</span><span class="kb ${on('down')}">${first('down')}</span><span class="kb ${on('right')}">${first('right')}</span></div></div><small>Muoversi</small></div>
    <div class="keys">${group('a', T('Conferma'))}${group('b', T('Indietro'))}${group('menu', T('Menu'))}${group('settings', T('Opzioni'))}</div>
  </div>`;
}

function touchPad(hint: Action): string {
  const on = (key: Action) => (key === hint || (hint === 'up' && ['up', 'down', 'left', 'right'].includes(key)) ? 'on' : '');
  return `<div class="pad-map">
    <div class="cross"><span class="${on('up')} u">▲</span><span class="${on('left')} l">◀</span><span class="${on('right')} r">▶</span><span class="${on('down')} d">▼</span></div>
    <div class="abm"><span class="pill ${on('menu')}">MENU</span><span class="round ${on('b')}">B</span><span class="round ${on('a')}">A</span><span class="pill ${on('settings')}">⚙</span></div>
  </div>`;
}
