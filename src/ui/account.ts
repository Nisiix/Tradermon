// Schermata del giocatore (prima del titolo e del tutorial): crea un giocatore con nome univoco e password,
// oppure entra con uno esistente. Con la password si apre anche la cassaforte delle chiavi Alpaca.
import { modal, el, esc } from './core';
import * as C from '../systems/cloud';
import { formatPlayTime } from '../systems/playtime';
import type { LegacyChoice } from '../systems/sync';

const PRIVACY = 'La partita viene salvata su Supabase, legata al tuo giocatore: puoi continuarla da qualsiasi browser o dispositivo entrando con nome e password. Le chiavi Alpaca, se le colleghi, sono cifrate qui nel browser con la tua password: sul server arrivano solo in forma illeggibile.';
const NO_RESET = 'Non c\'è un\'email collegata, quindi la password <b>non si può recuperare</b>: scegline una che ricorderai.';

function field(label: string, type: 'text' | 'password', max: number, auto: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = el('label', 'acc-field');
  wrap.style.display = 'block';
  wrap.style.marginTop = '8px';
  wrap.innerHTML = `<span>${esc(label)}</span>`;
  const input = el('input', 'tx') as HTMLInputElement;
  input.type = type;
  input.maxLength = max;
  input.setAttribute('autocomplete', auto);
  input.spellcheck = false;
  input.style.display = 'block';
  input.style.width = '100%';
  wrap.appendChild(input);
  return { wrap, input };
}

/** Mostra la scelta Nuovo giocatore / Accedi finché il giocatore non è dentro. */
export async function accountScreen(): Promise<C.Player> {
  for (;;) {
    const mode = await modal<'new' | 'login'>('Il tuo giocatore', ({ body, button, close }) => {
      body.innerHTML = `<p>Benvenuto in Tradermon! Per salvare i progressi serve un <b>giocatore</b>: un nome unico (nessun altro potrà usarlo) e una password.</p><p class="small muted">${PRIVACY}</p>`;
      button('Nuovo giocatore', () => close('new'), 'primary');
      button('Ho già un giocatore', () => close('login'));
    }, { closable: false });
    const p = mode === 'login' ? await loginForm() : await registerForm();
    if (p) return p;
  }
}

function registerForm(): Promise<C.Player | null> {
  return modal<C.Player | null>('Nuovo giocatore', ({ body, button, close }) => {
    body.innerHTML = `<p>Scegli il nome con cui ti conosceranno a Capitalia e una password.</p>`;
    const name = field(`Nome giocatore (${C.NAME_MIN}-${C.NAME_MAX} caratteri)`, 'text', C.NAME_MAX, 'username');
    const pw = field(`Password (almeno ${C.PASSWORD_MIN} caratteri)`, 'password', C.PASSWORD_MAX, 'new-password');
    const pw2 = field('Ripeti la password', 'password', C.PASSWORD_MAX, 'new-password');
    const nameMsg = el('p', 'small');
    const msg = el('p', 'msg small');
    body.append(name.wrap, nameMsg, pw.wrap, pw2.wrap, el('p', 'small muted', NO_RESET), msg);
    let checkSeq = 0;
    const checkName = async () => {
      const v = name.input.value;
      const bad = C.nameProblem(v);
      if (!v.trim()) { nameMsg.textContent = ''; return; }
      if (bad) { nameMsg.innerHTML = `<span class="bad">${esc(bad)}</span>`; return; }
      const seq = ++checkSeq;
      nameMsg.textContent = 'Controllo il nome...';
      try {
        const free = await C.isNameFree(v);
        if (seq === checkSeq) nameMsg.innerHTML = free ? '<span class="good">Nome libero.</span>' : '<span class="bad">Questo nome è già usato da un altro giocatore.</span>';
      } catch (e) { if (seq === checkSeq) nameMsg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
    };
    let t = 0;
    name.input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => void checkName(), 400); });
    const go = async () => {
      const bad = C.nameProblem(name.input.value) ?? C.passwordProblem(pw.input.value) ?? (pw.input.value !== pw2.input.value ? 'Le due password non coincidono.' : null);
      if (bad) { msg.innerHTML = `<span class="bad">${esc(bad)}</span>`; return; }
      b.disabled = true;
      msg.textContent = 'Creo il giocatore...';
      try {
        const p = await C.register(name.input.value, pw.input.value);
        pw.input.value = pw2.input.value = '';
        close(p);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    for (const i of [name.input, pw.input, pw2.input]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button('Crea giocatore', () => void go(), 'primary');
    button('Indietro', () => close(null));
    setTimeout(() => name.input.focus(), 30);
  }, { closable: false }).then((v) => v ?? null);
}

function loginForm(): Promise<C.Player | null> {
  return modal<C.Player | null>('Accedi', ({ body, button, close }) => {
    body.innerHTML = '<p>Entra con il nome giocatore e la password che hai scelto.</p>';
    const name = field('Nome giocatore', 'text', C.NAME_MAX, 'username');
    const pw = field('Password', 'password', C.PASSWORD_MAX, 'current-password');
    const msg = el('p', 'msg small');
    body.append(name.wrap, pw.wrap, msg);
    const go = async () => {
      if (!name.input.value.trim() || !pw.input.value) { msg.textContent = 'Compila nome e password.'; return; }
      b.disabled = true;
      msg.textContent = 'Accesso in corso...';
      try {
        const p = await C.login(name.input.value, pw.input.value);
        pw.input.value = '';
        close(p);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    for (const i of [name.input, pw.input]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button('Entra', () => void go(), 'primary');
    button('Indietro', () => close(null));
    setTimeout(() => name.input.focus(), 30);
  }, { closable: false }).then((v) => v ?? null);
}

/** Chiede la password per sbloccare la cassaforte delle chiavi su questo dispositivo. */
export function unlockForm(why: string): Promise<boolean> {
  return modal<boolean>('Sblocca le chiavi', ({ body, button, close }) => {
    body.innerHTML = `<p>${esc(why)}</p><p class="small muted">Le chiavi Alpaca sono cifrate con la tua password: serve per aprirle su questo dispositivo (una volta sola).</p>`;
    const pw = field('Password del giocatore', 'password', C.PASSWORD_MAX, 'current-password');
    const msg = el('p', 'msg small');
    body.append(pw.wrap, msg);
    const go = async () => {
      b.disabled = true;
      msg.textContent = 'Apro la cassaforte...';
      try { await C.unlockVault(pw.input.value); pw.input.value = ''; close(true); }
      catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    pw.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button('Sblocca', () => void go(), 'primary');
    button('Annulla', () => close(false));
    setTimeout(() => pw.input.focus(), 30);
  }).then((v) => !!v);
}

/** Una partita di questo browser senza giocatore (fatta prima degli account): portarla nel giocatore? */
export function legacyPrompt(c: LegacyChoice): Promise<boolean> {
  const l = c.local as unknown as { name: string; playMs: number; badges: number };
  return modal<boolean>('Partita trovata in questo browser', ({ body, button, close }) => {
    body.innerHTML = `<p>In questo browser c'è la partita di <b>${esc(l.name)}</b> (${formatPlayTime(l.playMs)}, ${l.badges} medaglie), salvata prima che esistessero i giocatori.</p>
      ${c.cloud ? `<p>Il tuo giocatore ha già una partita su Supabase (${formatPlayTime(c.cloud.playMs)}). Se porti quella del browser, sostituisce quella online.</p>` : '<p>Vuoi portarla nel tuo giocatore? Da ora in poi sarà salvata su Supabase.</p>'}
      <p class="small muted">Se non la porti, ne resta comunque una copia di riserva in questo browser.</p>`;
    button('Porta questa partita', () => close(true), 'primary');
    button(c.cloud ? 'Tieni quella online' : 'No, ricomincia', () => close(false));
  }, { closable: false }).then((v) => !!v);
}
