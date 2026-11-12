// Preferenze del dispositivo (non del salvataggio): tasti personalizzati, modalità touch e volume generale.
// Restano valide anche nella schermata iniziale, prima di caricare una partita.

import { T } from '../i18n';
export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu' | 'settings';
export type TouchMode = 'auto' | 'on' | 'off';

export interface ActionInfo { id: Action; name: string; use: string }

/** Ogni comando con il suo uso, nell'ordine in cui compare nella guida e nelle impostazioni. */
export const ACTIONS: ActionInfo[] = [
  { id: 'up', name: 'Su', use: T('Cammina verso l\'alto; nei menu sale di una voce.') },
  { id: 'down', name: T('Giù'), use: T('Cammina verso il basso; nei menu scende di una voce.') },
  { id: 'left', name: T('Sinistra'), use: T('Cammina a sinistra; nelle finestre passa al pulsante precedente.') },
  { id: 'right', name: T('Destra'), use: T('Cammina a destra; nelle finestre passa al pulsante successivo.') },
  { id: 'a', name: T('Conferma (A)'), use: T('Parla con chi hai davanti, legge i cartelli, conferma una scelta e fa scorrere i dialoghi.') },
  { id: 'b', name: T('Indietro (B)'), use: T('Chiude la finestra aperta, annulla una scelta e torna al passo precedente.') },
  { id: 'menu', name: T('Menu'), use: T('Apre il menu di gioco: Investidex, Portafoglio, Agenda, Diario, Lezioni, Salva e Opzioni.') },
  { id: 'settings', name: T('Impostazioni'), use: T('Apre e chiude il pannello ⚙ (anche nel mondo): comandi, touch, volume e ritorno alla home.') },
];

export const MAX_KEYS = 3;

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  a: ['KeyZ', 'Enter', 'Space'],
  b: ['KeyX', 'Backspace'],
  menu: ['KeyM'],
  settings: ['Escape'],
};

export interface Prefs { keys: Record<Action, string[]>; touch: TouchMode; volume: number }

const PREFS = 'tradermon.prefs';

function defaults(): Prefs {
  return { keys: cloneBindings(DEFAULT_BINDINGS), touch: 'auto', volume: 1 };
}

function cloneBindings(b: Record<Action, string[]>): Record<Action, string[]> {
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as Record<Action, string[]>;
}

function read(): Prefs {
  const d = defaults();
  try {
    const raw = localStorage.getItem(PREFS);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Prefs>;
    const keys = cloneBindings(d.keys);
    for (const a of ACTIONS) {
      const v = p.keys?.[a.id];
      if (Array.isArray(v) && v.every((c) => typeof c === 'string')) keys[a.id] = v.slice(0, MAX_KEYS);
    }
    // prima versione: Impostazioni su O ed Esc su Indietro → passa ai nuovi predefiniti (Esc = Impostazioni)
    if (keys.settings.length === 1 && keys.settings[0] === 'KeyO') {
      keys.settings = ['Escape'];
      keys.b = keys.b.filter((c) => c !== 'Escape');
    }
    return {
      keys,
      touch: p.touch === 'on' || p.touch === 'off' ? p.touch : 'auto',
      volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : 1,
    };
  } catch { return d; }
}

export const prefs: Prefs = read();
let codeMap = buildMap();
const listeners = new Set<() => void>();

function buildMap(): Map<string, Action> {
  const m = new Map<string, Action>();
  for (const a of ACTIONS) for (const c of prefs.keys[a.id]) if (!m.has(c)) m.set(c, a.id);
  return m;
}

export function savePrefs() {
  codeMap = buildMap();
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* storage non disponibile */ }
  listeners.forEach((f) => f());
}

/** Avvisa quando cambiano le preferenze (per aggiornare guida, touch e audio). */
export function onPrefsChange(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

export function actionFor(code: string): Action | undefined { return codeMap.get(code); }

/**
 * Assegna un tasto a un comando nella posizione indicata (sostituisce o aggiunge).
 * Se il tasto era usato da un altro comando, lo toglie da lì. Restituisce il comando che l'ha perso.
 */
export function bindKey(action: Action, slot: number, code: string): Action | undefined {
  let stolen: Action | undefined;
  for (const a of ACTIONS) {
    if (a.id === action) continue;
    const i = prefs.keys[a.id].indexOf(code);
    if (i >= 0) { prefs.keys[a.id].splice(i, 1); stolen = a.id; }
  }
  const list = prefs.keys[action].filter((c, i) => c !== code || i === slot);
  if (slot < list.length) list[slot] = code; else list.push(code);
  prefs.keys[action] = [...new Set(list)].slice(0, MAX_KEYS);
  savePrefs();
  return stolen;
}

export function unbindKey(action: Action, slot: number) {
  prefs.keys[action].splice(slot, 1);
  savePrefs();
}

export function resetBindings() {
  prefs.keys = cloneBindings(DEFAULT_BINDINGS);
  savePrefs();
}

const NAMES: Record<string, string> = {
  ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶',
  Enter: T('Invio'), Space: T('Spazio'), Escape: 'Esc', Backspace: '⌫', Tab: 'Tab',
  ShiftLeft: T('Maiusc'), ShiftRight: T('Maiusc D'), ControlLeft: T('Ctrl'), ControlRight: T('Ctrl D'), AltLeft: 'Alt', AltRight: 'AltGr',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '\\',
};

/** Nome leggibile di un tasto (codice KeyboardEvent.code). */
export function keyName(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** Tasti assegnati a un comando, già in forma leggibile. */
export function keysOf(action: Action): string[] { return prefs.keys[action].map(keyName); }

/** Volume generale (0 = muto) applicato sopra le regolazioni di musica ed effetti delle Opzioni. */
export function setMasterVolume(v: number) {
  prefs.volume = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  savePrefs();
}

export function setTouchMode(m: TouchMode) {
  prefs.touch = m;
  savePrefs();
}

/** true se lo schermo è touch senza mouse (telefono, tablet). */
export function isTouchDevice(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const fine = window.matchMedia?.('(pointer: fine)').matches;
  return !!coarse || (navigator.maxTouchPoints > 0 && !fine);
}

/** true se i comandi touch sono visibili, secondo la scelta del giocatore. */
export function touchActive(): boolean {
  return prefs.touch === 'on' || (prefs.touch === 'auto' && isTouchDevice());
}
