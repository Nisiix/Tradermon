// Pannello impostazioni ⚙ (in alto a destra, o tasto Impostazioni: Esc di default): comandi e touch, volume, ritorno alla home.
import { modal, el, esc, getStage, toast } from './core';
import { captureNextKey, onSettingsKey, press } from './input';
import { controlsTutorial } from './tutorial';
import {
  ACTIONS, MAX_KEYS, keysOf, bindKey, unbindKey, resetBindings, keyName, prefs, setMasterVolume, setTouchMode,
  onPrefsChange, isTouchDevice, type Action, type TouchMode,
} from '../systems/controls';
import { S, save } from '../systems/state';
import { setVolume, beep } from '../systems/audio';
import { setMusicVolume } from '../systems/music';
import { homeUrl } from '../systems/home';

export type Phase = 'title' | 'onboarding' | 'game';
let phase: Phase = 'title';
/** Dove si trova il giocatore: decide cosa offre "Torna alla home". */
export function setPhase(p: Phase) { phase = p; }


/** Applica il volume: generale (⚙) × musica/effetti (Menu → Opzioni). */
export function applyAudio() {
  const o = S?.options ?? { volume: 0.5, music: 0.5 };
  setVolume(o.volume * prefs.volume);
  setMusicVolume(o.music * prefs.volume);
}

const mark = (body: HTMLElement) => body.closest('.modal-wrap')?.classList.add('settings-wrap');
let open = false;

export function initSettings() {
  const b = el('button', 'gear-btn', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2l.4 2 1.3.6 1.7-1.2 1.4 1.4-1.2 1.7.6 1.3 2 .4v2l-2 .4-.6 1.3 1.2 1.7-1.4 1.4-1.7-1.2-1.3.6L9 15H7l-.4-2-1.3-.6-1.7 1.2-1.4-1.4 1.2-1.7L2.8 9.2 1 9V7l2-.4.6-1.3-1.2-1.7 1.4-1.4 1.7 1.2 1.3-.6z M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" fill-rule="evenodd"/></svg>');
  const tip = () => { b.title = `Impostazioni (${keysOf('settings')[0] ?? '⚙'})`; };
  tip();
  onPrefsChange(tip);
  b.setAttribute('aria-label', 'Impostazioni');
  b.addEventListener('click', () => { void openSettings(); });
  getStage().appendChild(b);
  // il tasto Impostazioni (Esc di default) apre il pannello e, se è già aperto, chiude la finestra in cima
  onSettingsKey(() => { if (open) press('b'); else void openSettings(); });
  onPrefsChange(applyAudio);
  applyAudio();
}

/** Menu principale delle impostazioni: comandi e touch, volume, home. */
export async function openSettings() {
  if (open) return;
  open = true;
  window.dispatchEvent(new Event('tradermon:settings'));
  try {
    const r = await modal<'controls' | 'home'>('⚙ Impostazioni', ({ body, button, close }) => {
      mark(body);
      body.innerHTML = `
        <div class="set-row"><div><b>1. Comandi</b><p class="small muted">Cambia i tasti della tastiera e scegli se usare i comandi touch.</p></div><button class="btn ctl">Personalizza</button></div>
        <div class="set-row vol-row"><div style="flex:1"><b>2. Volume</b> <span class="vol-val"></span>
          <div class="vol-ctl"><button class="btn vmin" aria-label="Abbassa">−</button><input class="vrange" type="range" min="0" max="100" step="5" aria-label="Volume generale"><button class="btn vplus" aria-label="Alza">+</button><button class="btn vmute"></button></div>
          <p class="small muted">Portalo a zero per togliere musica ed effetti. Il bilanciamento tra musica ed effetti è in Menu → Opzioni.</p></div></div>
        <div class="set-row"><div><b>3. Home</b><p class="small muted">Esci dal gioco e torna alla pagina principale di Tradermon.</p></div><button class="btn home">Torna alla home</button></div>`;
      const q = <T extends HTMLElement>(s: string) => body.querySelector(s) as T;
      let before = prefs.volume || 0.8;
      const show = () => {
        const v = Math.round(prefs.volume * 100);
        q<HTMLInputElement>('.vrange').value = String(v);
        q('.vol-val').textContent = v === 0 ? '· Muto' : `· ${v}%`;
        q('.vmute').textContent = v === 0 ? '🔈 Riattiva' : '🔇 Muto';
      };
      const setV = (v: number) => { if (v > 0) before = v; setMasterVolume(v); show(); if (v > 0) beep('tick'); };
      q('.vrange').addEventListener('input', (e) => setV(Number((e.target as HTMLInputElement).value) / 100));
      q('.vmin').addEventListener('click', () => setV(Math.max(0, prefs.volume - 0.1)));
      q('.vplus').addEventListener('click', () => setV(Math.min(1, prefs.volume + 0.1)));
      q('.vmute').addEventListener('click', () => setV(prefs.volume > 0 ? 0 : before));
      q('.ctl').addEventListener('click', () => close('controls'));
      q('.home').addEventListener('click', () => close('home'));
      show();
      button('Chiudi', () => close(), 'primary');
    });
    if (r === 'controls') await openControls();
    else if (r === 'home') await goHome();
  } finally { open = false; }
}

/** Personalizzazione dei tasti e modalità touch. */
export async function openControls() {
  await modal('Comandi', ({ body, button, close }) => {
    mark(body);
    const render = () => {
      const modes: [TouchMode, string][] = [['auto', `Automatico${isTouchDevice() ? ' (touch rilevato)' : ''}`], ['on', 'Sempre attivi'], ['off', 'Disattivati']];
      body.innerHTML = `
        <p><b>Comandi touch</b> <span class="small muted">croce direzionale e pulsanti A, B e MENU sullo schermo</span></p>
        <div class="row touch-modes">${modes.map(([m, l]) => `<button class="btn tm-${m} ${prefs.touch === m ? 'primary' : ''}" data-m="${m}">${prefs.touch === m ? '● ' : ''}${l}</button>`).join('')}</div>
        <p style="margin-top:10px"><b>Tasti della tastiera</b> <span class="small muted">clicca un tasto (o selezionalo e premi A) e poi premi il nuovo tasto; ✕ lo toglie</span></p>
        <table class="t keys-t">${ACTIONS.map((a) => `<tr><td><b>${esc(a.name)}</b><div class="small muted">${esc(a.use)}</div></td><td class="kcell">${
          prefs.keys[a.id].map((c, i) => `<span class="kchip"><button class="btn kb-b" data-a="${a.id}" data-i="${i}">${esc(keyName(c))}</button>${prefs.keys[a.id].length > 1 ? `<button class="btn kx" data-a="${a.id}" data-i="${i}" aria-label="Togli ${esc(keyName(c))}">✕</button>` : ''}</span>`).join('')
        }${prefs.keys[a.id].length < MAX_KEYS ? `<button class="btn kb-b add" data-a="${a.id}" data-i="${prefs.keys[a.id].length}">＋</button>` : ''}</td></tr>`).join('')}</table>`;
      body.querySelectorAll<HTMLButtonElement>('.touch-modes button').forEach((b) => b.addEventListener('click', () => { setTouchMode(b.dataset.m as TouchMode); render(); body.querySelector<HTMLButtonElement>(`.tm-${b.dataset.m}`)?.focus(); }));
      body.querySelectorAll<HTMLButtonElement>('.kb-b').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a as Action; const i = Number(b.dataset.i);
        b.textContent = 'Premi un tasto…';
        b.classList.add('wait');
        captureNextKey((code) => {
          const stolen = bindKey(a, i, code);
          if (stolen) toast(`${keyName(code)} tolto da "${ACTIONS.find((x) => x.id === stolen)!.name}".`);
          if (prefs.keys.a.length === 0 || prefs.keys.b.length === 0) toast('Attento: Conferma e Indietro devono avere almeno un tasto.');
          render();
          body.querySelector<HTMLButtonElement>(`.kb-b[data-a="${a}"][data-i="${Math.min(i, prefs.keys[a].length - 1)}"]`)?.focus();
        });
      }));
      body.querySelectorAll<HTMLButtonElement>('.kx').forEach((b) => b.addEventListener('click', () => {
        unbindKey(b.dataset.a as Action, Number(b.dataset.i));
        render();
      }));
    };
    render();
    button('Rivedi la guida', () => { close(); if (!document.querySelector('.tutorial')) void controlsTutorial(); });
    button('Ripristina predefiniti', () => { resetBindings(); render(); toast('Tasti predefiniti ripristinati.'); });
    button('Fatto', () => close(), 'primary');
  }, { wide: true });
  captureNextKey(null);
}

async function goHome() {
  if (phase === 'title') { location.href = homeUrl(); return; }
  const r = await modal<'save' | 'leave'>('Torna alla home', ({ body, button, close }) => {
    mark(body);
    body.innerHTML = phase === 'game'
      ? '<p>Vuoi uscire dal gioco e tornare alla home? I progressi dall\'ultimo salvataggio andranno persi se non salvi.</p>'
      : '<p>La nuova partita non è ancora iniziata: se esci ora dovrai ricominciare la presentazione.</p>';
    if (phase === 'game') button('Salva e torna', () => close('save'), 'primary');
    button(phase === 'game' ? 'Torna senza salvare' : 'Torna alla home', () => close('leave'), phase === 'game' ? 'danger' : 'primary');
    button('Annulla', () => close());
  });
  if (!r) return;
  if (r === 'save' && !save()) { toast('Salvataggio non riuscito: resto qui.'); return; }
  location.href = homeUrl();
}
