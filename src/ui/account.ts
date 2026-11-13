// Schermata del giocatore (prima del titolo e del tutorial): crea un giocatore con nome univoco e password,
// oppure entra con uno esistente. Con la password si apre anche la cassaforte delle chiavi Alpaca.
import { modal, el, esc } from './core';
import * as C from '../systems/cloud';
import { formatPlayTime } from '../systems/playtime';
import { forgetPlayerOnDevice, type LegacyChoice } from '../systems/sync';
import { busy } from './loading';
import { T } from '../i18n';

const PRIVACY = T('La partita viene salvata online, legata al tuo giocatore: puoi continuarla da qualsiasi browser o dispositivo entrando con nome e password. Le chiavi Alpaca, se le colleghi, restano solo su questo dispositivo, cifrate con la tua password: non vanno online e non entrano nel salvataggio.');
export const PRIVACY_URL = '../privacy/';
const PRIVACY_LINK = T`<a href="${PRIVACY_URL}" target="_blank" rel="noopener">Informativa sulla privacy</a>`;
const NO_RESET = T('Non c\'è un\'email collegata, quindi la password <b>non si può recuperare</b>: scegline una che ricorderai.');

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
const DELETED = 'tradermon.deleted';
/** Il giocatore è appena stato cancellato da questo browser? (si legge una volta sola) */
function justDeleted(): boolean {
  try { const v = sessionStorage.getItem(DELETED) === '1'; sessionStorage.removeItem(DELETED); return v; } catch { return false; }
}

export async function accountScreen(): Promise<C.Player> {
  let gone = justDeleted();
  for (;;) {
    const mode = await modal<'new' | 'login'>(T('Il tuo giocatore'), ({ body, button, close }) => {
      body.innerHTML = T`${gone ? T('<p class="good">Il giocatore è stato cancellato, online e da questo browser.</p>') : ''}<p>Ti diamo il benvenuto in Tradermon! Per salvare i progressi serve un <b>giocatore</b>: un nome unico (nessun altro potrà usarlo) e una password.</p><p class="small muted">${PRIVACY} ${PRIVACY_LINK}.</p>`;
      button(T('Nuovo giocatore'), () => close('new'), 'primary');
      button(T('Ho già un giocatore'), () => close('login'));
    }, { closable: false });
    gone = false;
    const p = mode === 'login' ? await loginForm() : await registerForm();
    if (p) return p;
  }
}

function registerForm(): Promise<C.Player | null> {
  return modal<C.Player | null>(T('Nuovo giocatore'), ({ body, button, close }) => {
    body.innerHTML = T`<p>Scegli il nome con cui ti conosceranno a Capitalia e una password.</p>`;
    const name = field(T`Nome giocatore (${C.NAME_MIN}-${C.NAME_MAX} caratteri)`, 'text', C.NAME_MAX, 'username');
    const pw = field(T`Password (almeno ${C.PASSWORD_MIN} caratteri)`, 'password', C.PASSWORD_MAX, 'new-password');
    const pw2 = field(T('Ripeti la password'), 'password', C.PASSWORD_MAX, 'new-password');
    const nameMsg = el('p', 'small');
    const msg = el('p', 'msg small');
    const age = el('label', 'small') as HTMLLabelElement;
    age.style.display = 'block';
    age.style.marginTop = '8px';
    age.innerHTML = T('<input type="checkbox" class="age"> Ho almeno 14 anni, oppure un genitore mi ha dato il permesso.');
    const ageBox = age.querySelector('input') as HTMLInputElement;
    body.append(name.wrap, nameMsg, pw.wrap, pw2.wrap, el('p', 'small muted', NO_RESET), age, msg);
    let checkSeq = 0;
    const checkName = async () => {
      const v = name.input.value;
      const bad = C.nameProblem(v);
      if (!v.trim()) { nameMsg.textContent = ''; return; }
      if (bad) { nameMsg.innerHTML = `<span class="bad">${esc(bad)}</span>`; return; }
      const seq = ++checkSeq;
      nameMsg.textContent = T('Controllo il nome...');
      try {
        const free = await C.isNameFree(v);
        if (seq === checkSeq) nameMsg.innerHTML = free ? T('<span class="good">Nome libero.</span>') : T('<span class="bad">Questo nome è già usato da un altro giocatore.</span>');
      } catch (e) { if (seq === checkSeq) nameMsg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; }
    };
    let t = 0;
    name.input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => void checkName(), 400); });
    const go = async () => {
      const bad = C.nameProblem(name.input.value) ?? C.passwordProblem(pw.input.value) ?? (pw.input.value !== pw2.input.value ? T('Le due password non coincidono.') : null) ?? (!ageBox.checked ? T('Conferma l\'età per creare il giocatore.') : null);
      if (bad) { msg.innerHTML = `<span class="bad">${esc(bad)}</span>`; return; }
      b.disabled = true;
      msg.textContent = T('Creo il giocatore...');
      try {
        const p = await busy(T('Creo il giocatore'), C.register(name.input.value, pw.input.value));
        pw.input.value = pw2.input.value = '';
        close(p);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    for (const i of [name.input, pw.input, pw2.input]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button(T('Crea giocatore'), () => void go(), 'primary');
    button(T('Indietro'), () => close(null));
    setTimeout(() => name.input.focus(), 30);
  }, { closable: false }).then((v) => v ?? null);
}

function loginForm(): Promise<C.Player | null> {
  return modal<C.Player | null>(T('Accedi'), ({ body, button, close }) => {
    body.innerHTML = T('<p>Entra con il nome giocatore e la password che hai scelto.</p>');
    const name = field(T('Nome giocatore'), 'text', C.NAME_MAX, 'username');
    const pw = field(T('Password'), 'password', C.PASSWORD_MAX, 'current-password');
    const msg = el('p', 'msg small');
    body.append(name.wrap, pw.wrap, msg);
    const go = async () => {
      if (!name.input.value.trim() || !pw.input.value) { msg.textContent = T('Compila nome e password.'); return; }
      b.disabled = true;
      msg.textContent = T('Accesso in corso...');
      try {
        const p = await busy(T('Entro nel gioco'), C.login(name.input.value, pw.input.value));
        pw.input.value = '';
        close(p);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    for (const i of [name.input, pw.input]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button(T('Entra'), () => void go(), 'primary');
    button(T('Indietro'), () => close(null));
    setTimeout(() => name.input.focus(), 30);
  }, { closable: false }).then((v) => v ?? null);
}

/** Chiede la password per sbloccare la cassaforte delle chiavi su questo dispositivo. */
export function unlockForm(why: string): Promise<boolean> {
  return modal<boolean>(T('Sblocca le chiavi'), ({ body, button, close }) => {
    body.innerHTML = T`<p>${esc(why)}</p><p class="small muted">Le chiavi Alpaca sono cifrate con la tua password: serve per aprirle su questo dispositivo (una volta sola).</p>`;
    const pw = field(T('Password del giocatore'), 'password', C.PASSWORD_MAX, 'current-password');
    const msg = el('p', 'msg small');
    body.append(pw.wrap, msg);
    const go = async () => {
      b.disabled = true;
      msg.textContent = T('Apro la cassaforte...');
      try { await busy(T('Apro la cassaforte'), C.unlockVault(pw.input.value)); pw.input.value = ''; close(true); }
      catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    pw.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button(T('Sblocca'), () => void go(), 'primary');
    button(T('Annulla'), () => close(false));
    setTimeout(() => pw.input.focus(), 30);
  }).then((v) => !!v);
}

/** Una partita di questo browser senza giocatore (fatta prima degli account): portarla nel giocatore? */
export function legacyPrompt(c: LegacyChoice): Promise<boolean> {
  const l = c.local as unknown as { name: string; playMs: number; badges: number };
  return modal<boolean>(T('Partita trovata in questo browser'), ({ body, button, close }) => {
    body.innerHTML = T`<p>In questo browser c'è la partita di <b>${esc(l.name)}</b> (${formatPlayTime(l.playMs)}, ${l.badges} Attestati), salvata prima che esistessero i giocatori.</p>
      ${c.cloud ? T`<p>Il tuo giocatore ha già una partita online (${formatPlayTime(c.cloud.playMs)}). Se porti quella del browser, sostituisce quella online.</p>` : T('<p>Vuoi portarla nel tuo giocatore? Da ora in poi sarà salvata online.</p>')}
      <p class="small muted">Se non la porti, ne resta comunque una copia di riserva in questo browser.</p>`;
    button(T('Porta questa partita'), () => close(true), 'primary');
    button(c.cloud ? T('Tieni quella online') : T('No, ricomincia'), () => close(false));
  }, { closable: false }).then((v) => !!v);
}

/**
 * Cancella il giocatore per sempre: su Supabase (profilo, salvataggio, nome) e su questo dispositivo.
 * Restituisce true se è stato cancellato (la pagina va ricaricata).
 */
export function deletePlayerForm(player: C.Player): Promise<boolean> {
  return modal<boolean>(T('Elimina il mio giocatore'), ({ body, button, close }) => {
    body.innerHTML = T`<p>Cancelli <b>${esc(player.name)}</b> per sempre: il salvataggio della partita, il profilo e le chiavi Alpaca salvate su questo dispositivo. Il nome torna libero e la partita <b>non si potrà recuperare</b>.</p>
      <p class="small muted">Se vuoi tenerne una copia, prima usa "Esporta salvataggio". Il tuo conto su Alpaca non cambia: posizioni e denaro restano lì, e per chiuderlo si usa il sito di Alpaca. ${PRIVACY_LINK}.</p>`;
    const name = field(T`Scrivi il nome del giocatore (${player.name})`, 'text', C.NAME_MAX, 'off');
    const pw = field(T('Password del giocatore'), 'password', C.PASSWORD_MAX, 'current-password');
    const msg = el('p', 'msg small');
    body.append(name.wrap, pw.wrap, msg);
    const go = async () => {
      if (C.normName(name.input.value).toLowerCase() !== C.normName(player.name).toLowerCase()) { msg.innerHTML = T('<span class="bad">Il nome non corrisponde.</span>'); return; }
      if (!pw.input.value) { msg.innerHTML = T('<span class="bad">Inserisci la password.</span>'); return; }
      b.disabled = true;
      msg.textContent = T('Cancello il giocatore...');
      try {
        await busy(T('Cancello il giocatore'), C.deletePlayer(pw.input.value));
        pw.input.value = '';
        forgetPlayerOnDevice(player.id);
        try { sessionStorage.setItem(DELETED, '1'); } catch { /* niente */ }
        close(true);
      } catch (e) { msg.innerHTML = `<span class="bad">${esc((e as Error).message)}</span>`; b.disabled = false; }
    };
    pw.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void go(); } });
    const b = button(T('Elimina per sempre'), () => void go(), 'primary');
    button(T('Annulla'), () => close(false));
    setTimeout(() => name.input.focus(), 30);
  }).then((v) => !!v);
}
