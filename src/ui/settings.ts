// Opzioni: un solo pannello, uguale in ogni schermata (accesso, titolo, presentazione, partita).
// Si apre con ⚙ in alto a destra, con il tasto Opzioni (Esc di default) e dalla voce "Opzioni" del menu di gioco.
// Le voci sono sempre le stesse e nello stesso ordine; quelle legate alla partita restano visibili ma spente
// finché una partita non è caricata. Ogni regolazione vale subito: niente pulsante "Applica".
import { fullscreenSupported, isFullscreen, enterFullscreen, exitFullscreen } from './mobile';
import { modal, el, esc, getStage, toast, say, choose } from './core';
import { captureNextKey, onSettingsKey, press } from './input';
import { controlsTutorial } from './tutorial';
import {
  ACTIONS, MAX_KEYS, keysOf, bindKey, unbindKey, resetBindings, keyName, prefs, setMasterVolume, setTouchMode,
  onPrefsChange, isTouchDevice, type Action, type TouchMode,
} from '../systems/controls';
import { S, save, exportSave } from '../systems/state';
import { setVolume, beep } from '../systems/audio';
import { setMusicVolume } from '../systems/music';
import { goHome as leaveToHome } from '../systems/home';
import { T, LANG, setLang, type Lang } from '../i18n';
import * as Acc from '../systems/account';
import { cloudPlayer, flush, clearLocal } from '../systems/sync';
import { logout } from '../systems/cloud';
import { deletePlayerForm, PRIVACY_URL } from './account';
import { busy } from './loading';
import { download } from './clinic';
import { safariAtRisk, SAFARI_TEXT } from './storageNotice';
import { SOURCES } from '../data/sources';

export type Phase = 'title' | 'onboarding' | 'game';
let phase: Phase = 'title';
/** Dove si trova il giocatore: decide quali voci delle Opzioni sono attive e cosa fa "Esci dal gioco". */
export function setPhase(p: Phase) { phase = p; }

/** Applica il volume: generale (dispositivo) × musica/effetti (partita). */
export function applyAudio() {
  const o = S?.options ?? { volume: 0.5, music: 0.5 };
  setVolume(o.volume * prefs.volume);
  setMusicVolume(o.music * prefs.volume);
}

/** Applica le opzioni della partita (testo, contrasto, audio, effetti della resa 2.5D). */
export function applyOptions() {
  if (!S) return;
  document.documentElement.style.setProperty('--fs-scale', String(S.options.fontScale));
  document.body.classList.toggle('contrast', S.options.contrast);
  applyAudio();
  // la scena del mondo ascolta e aggiorna gli effetti della resa 2.5D senza ricaricare
  window.dispatchEvent(new CustomEvent('tradermon:options'));
}

export const mark = (body: HTMLElement) => body.closest('.modal-wrap')?.classList.add('settings-wrap');
let open = false;

export function initSettings() {
  const b = el('button', 'gear-btn', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 1h2l.4 2 1.3.6 1.7-1.2 1.4 1.4-1.2 1.7.6 1.3 2 .4v2l-2 .4-.6 1.3 1.2 1.7-1.4 1.4-1.7-1.2-1.3.6L9 15H7l-.4-2-1.3-.6-1.7 1.2-1.4-1.4 1.2-1.7L2.8 9.2 1 9V7l2-.4.6-1.3-1.2-1.7 1.4-1.4 1.7 1.2 1.3-.6z M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" fill-rule="evenodd"/></svg>');
  const tip = () => { b.title = T`Opzioni (${keysOf('settings')[0] ?? '⚙'})`; };
  tip();
  onPrefsChange(tip);
  b.setAttribute('aria-label', T('Opzioni'));
  b.addEventListener('click', () => { void openSettings(); });
  getStage().appendChild(b);
  // il tasto Opzioni (Esc di default) apre il pannello e, se è già aperto, chiude la finestra in cima
  onSettingsKey(() => { if (open) press('b'); else void openSettings(); });
  onPrefsChange(applyAudio);
  applyAudio();
}

// ---------------- Pannello delle Opzioni ----------------

type Next = 'controls' | 'credits' | 'exit' | 'leave' | 'delete' | undefined;

/** Pannello unico delle Opzioni. Le sottofinestre (Comandi, Crediti) riportano qui quando si chiudono. */
export async function openSettings() {
  if (open) return;
  open = true;
  window.dispatchEvent(new Event('tradermon:settings'));
  try {
    for (;;) {
      const { next, after } = await optionsPanel();
      if (after) await say(after);
      if (next === 'controls') { await openControls(); continue; }
      if (next === 'credits') { await credits(); continue; }
      if (next === 'exit') { if (await exitGame()) return; continue; }
      if (next === 'leave') { await leavePlayer(); continue; }
      if (next === 'delete') { await deletePlayer(); continue; }
      return;
    }
  } finally { open = false; }
}

const seg = (cls: string, items: [string, string][], label: string) =>
  `<div class="seg ${cls}" role="group" aria-label="${esc(label)}">${items.map(([v, l]) => `<button type="button" class="btn" data-v="${v}">${l}</button>`).join('')}</div>`;
const stepper = (cls: string, label: string, mute = false) =>
  `<div class="stepper ${cls}" role="group" aria-label="${esc(label)}"><button type="button" class="btn dn" aria-label="${T('Abbassa')}">−</button><span class="val"></span><button type="button" class="btn up" aria-label="${T('Alza')}">+</button>${mute ? '<button type="button" class="btn mute"></button>' : ''}</div>`;
const row = (title: string, help: string, ctl: string, extra = '') =>
  `<div class="set-row${extra}"><div class="set-txt"><b>${title}</b>${help ? `<p class="small muted">${help}</p>` : ''}</div><div class="set-ctl">${ctl}</div></div>`;
const sec = (title: string, rows: string) => `<section class="set-sec"><h4>${title}</h4>${rows}</section>`;

function optionsPanel(): Promise<{ next: Next; after: string }> {
  let after = '';
  return modal<Next>(T('Opzioni'), ({ body, button, close }) => {
    mark(body);
    body.classList.add('opt-panel');
    const game = !!S;                      // opzioni della partita: esistono da quando una partita è caricata o iniziata
    const live = phase === 'game' && game; // partita vera e propria (non la presentazione)
    const player = cloudPlayer();
    // una sola nota in cima spiega le voci in grigio
    const note = !game ? T('Le voci in grigio si regolano dopo aver caricato o iniziato una partita.') : !live ? T('Le voci in grigio si regolano durante la partita.') : '';
    const other = LANG === 'it' ? 'en' : 'it';
    body.innerHTML = (note ? `<p class="small muted set-note">${note}</p>` : '')
      + sec(T('Lingua'), row(`${T('Lingua')} <span class="small muted" lang="${other}">· ${LANG === 'it' ? 'Language' : 'Lingua'}</span>`, T('Vale anche per la pagina principale. Il gioco salva e si ricarica.'),
        `<div class="seg lang-ctl" role="group" aria-label="Language / Lingua"><button type="button" class="btn" data-lang="en" lang="en">English</button><button type="button" class="btn" data-lang="it" lang="it">Italiano</button></div>`))
      + sec(T('Audio'),
        row(T('Volume generale'), T('Vale su questo dispositivo. A zero toglie musica ed effetti.'), stepper('mv', T('Volume generale'), true))
        + row(T('Musica'), '', stepper('mus', T('Musica')), game ? '' : ' off')
        + row(T('Effetti sonori'), '', stepper('vol', T('Effetti sonori')), game ? '' : ' off'))
      + sec(T('Schermo e testo'),
        (fullscreenSupported() ? row(T('Schermo intero'), T('Nasconde le barre del browser; sul telefono blocca anche lo schermo in orizzontale.'), `<button type="button" class="btn fsb">${isFullscreen() ? T('Esci') : T('Attiva')}</button>`) : '')
        + row(T('Effetti grafici'), T('Bassi per computer e telefoni meno potenti.'), seg('fx', [['alti', T('Alti')], ['bassi', T('Bassi')]], T('Effetti grafici')), game ? '' : ' off')
        + row(T('Dimensione del testo'), '', seg('fs', [['0.9', T('Piccola')], ['1', T('Normale')], ['1.2', T('Grande')], ['1.4', T('Molto grande')]], T('Dimensione del testo')), game ? '' : ' off')
        + row(T('Velocità del testo'), '', seg('ts', [['0', T('Lenta')], ['1', T('Normale')], ['2', T('Veloce')], ['3', T('Istantanea')]], T('Velocità del testo')), game ? '' : ' off')
        + row(T('Contrasto alto'), '', '<input type="checkbox" class="hc">', game ? '' : ' off'))
      + sec(T('Comandi'), row(T('Tasti e comandi touch'), T('Cambia i tasti della tastiera, scegli se usare i comandi touch, rivedi la guida.'), `<button type="button" class="btn ctl">${T('Personalizza')}</button>`))
      + sec(T('Partita'),
        row(T('Modalità Studio'), T('Nessun timer nei quiz, Reputazione dimezzata nei duelli.'), '<input type="checkbox" class="sm">', game ? '' : ' off')
        + row(T('Prove sul conto: prosegui anche se vanno male'),
          T`Se una Prova sul conto viene annullata (vendita, stop, vendita forzata della leva, bancarotta) il risultato viene ignorato e prosegui lo stesso. Non salta la Prova: va comunque affrontata.${live && !Acc.ignoreAllowed() ? T(' (solo in Apprendista e Investitore)') : ''} <span class="bad">${esc(Acc.IGNORE_WARNING)}</span>`,
          '<input type="checkbox" class="ig">', live && Acc.ignoreAllowed() ? '' : ' off'))
      + sec(T('Salvataggio e giocatore'),
        row(T('Esporta salvataggio'), `${player ? T`Giocatore <b>${esc(player.name)}</b>: la partita è salvata online e la ritrovi su qualsiasi dispositivo entrando con nome e password. Le chiavi Alpaca non sono mai nel salvataggio: restano solo su questo dispositivo, cifrate con la tua password.` : T('Nessun giocatore collegato: il salvataggio resta solo in questo browser.')} ${T('Puoi sempre esportarne una copia come file.')}`,
          `<button type="button" class="btn exp">${T('Esporta')}</button>`, live ? '' : ' off')
        + (player ? row(T('Esci dal giocatore'), T('La partita resta salvata online: per riprenderla rientri con nome e password.'), `<button type="button" class="btn lv">${T('Esci')}</button>`)
          + row(T('Elimina il mio giocatore'), T('Cancella per sempre il giocatore e la sua partita.'), `<button type="button" class="btn danger del">${T('Elimina')}</button>`) : '')
        + (safariAtRisk() ? `<p class="small">${SAFARI_TEXT}</p>` : ''))
      + sec(T('Informazioni'),
        row(T('Crediti e fonti'), '', `<button type="button" class="btn cred">${T('Apri')}</button>`)
        + row(T('Privacy'), '', `<button type="button" class="btn priv">${T('Apri')}</button>`));

    const q = <E extends HTMLElement>(s: string) => body.querySelector(s) as E | null;
    // le voci spente restano visibili ma non si possono usare
    body.querySelectorAll<HTMLElement>('.set-row.off').forEach((r) => r.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach((c) => { c.disabled = true; }));

    // lingua
    body.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
      const l = b.dataset.lang as Lang;
      b.setAttribute('aria-pressed', String(l === LANG));
      if (l === LANG) b.classList.add('primary');
      b.addEventListener('click', () => setLang(l, () => { if (live) save(); }));
    });

    // pulsanti a scelta singola
    const wireSeg = (cls: string, get: () => string, set: (v: string) => void) => {
      const box = q(`.seg.${cls}`);
      if (!box) return;
      const show = () => box.querySelectorAll<HTMLButtonElement>('button').forEach((b) => { const on = b.dataset.v === get(); b.classList.toggle('primary', on); b.setAttribute('aria-pressed', String(on)); });
      box.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { set(b.dataset.v!); show(); beep('tick'); }));
      show();
    };
    // regolatori − valore +
    const wireStep = (cls: string, get: () => number, set: (v: number) => void, step: number, mute = false) => {
      const box = q(`.stepper.${cls}`);
      if (!box) return;
      let before = get() || 0.8;
      const show = () => {
        const v = Math.round(get() * 100);
        box.querySelector('.val')!.textContent = v === 0 ? T('Muto') : `${v}%`;
        const m = box.querySelector('.mute');
        if (m) m.textContent = v === 0 ? T('🔈 Riattiva') : T('🔇 Muto');
      };
      const put = (v: number) => { v = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100; if (v > 0) before = v; set(v); show(); if (v > 0) beep('tick'); };
      box.querySelector('.dn')!.addEventListener('click', () => put(get() - step));
      box.querySelector('.up')!.addEventListener('click', () => put(get() + step));
      box.querySelector('.mute')?.addEventListener('click', () => put(get() > 0 ? 0 : before));
      show();
    };

    wireStep('mv', () => prefs.volume, (v) => setMasterVolume(v), 0.1, true);
    if (game) {
      const o = S.options;
      wireStep('mus', () => o.music, (v) => { o.music = v; applyAudio(); }, 0.1);
      wireStep('vol', () => o.volume, (v) => { o.volume = v; applyAudio(); }, 0.1);
      wireSeg('fx', () => o.fx, (v) => { o.fx = v as 'alti' | 'bassi'; applyOptions(); });
      wireSeg('fs', () => String(o.fontScale), (v) => { o.fontScale = Number(v); applyOptions(); });
      wireSeg('ts', () => String(o.textSpeed), (v) => { o.textSpeed = Number(v); });
      const hc = q<HTMLInputElement>('.hc')!; hc.checked = o.contrast;
      hc.addEventListener('change', () => { o.contrast = hc.checked; applyOptions(); });
      const sm = q<HTMLInputElement>('.sm')!; sm.checked = o.studyMode;
      sm.addEventListener('change', () => { o.studyMode = sm.checked; });
    } else {
      // prima della partita i regolatori mostrano i valori di partenza, spenti
      for (const c of ['mus', 'vol']) { const v = q(`.stepper.${c} .val`); if (v) v.textContent = '—'; }
    }
    const ig = q<HTMLInputElement>('.ig')!;
    ig.checked = live && Acc.ignoreOn();
    ig.addEventListener('change', () => { if (live) after = Acc.setIgnore(ig.checked); });

    q('.fsb')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      if (isFullscreen()) await exitFullscreen(); else await enterFullscreen();
      b.textContent = isFullscreen() ? T('Esci') : T('Attiva');
    });
    q('.ctl')!.addEventListener('click', () => close('controls'));
    q('.exp')!.addEventListener('click', () => download(`tradermon-${S.name}.json`, exportSave()));
    q('.lv')?.addEventListener('click', () => close('leave'));
    q('.del')?.addEventListener('click', () => close('delete'));
    q('.cred')!.addEventListener('click', () => close('credits'));
    q('.priv')!.addEventListener('click', () => { window.open(PRIVACY_URL, '_blank', 'noopener'); });

    button(T('Esci dal gioco'), () => close('exit'));
    button(T('Chiudi'), () => close(), 'primary');
  }).then((next) => {
    // una sola scrittura alla chiusura, non a ogni tocco
    if (phase === 'game' && S) save();
    return { next, after };
  });
}

// ---------------- Uscite ----------------

/**
 * "Esci dal gioco", uguale nel menu di gioco e nelle Opzioni. In partita salva (anche online) e torna alla pagina
 * principale; durante la presentazione avvisa che si ricomincia; dal titolo esce subito.
 */
export async function exitGame(): Promise<boolean> {
  if (phase === 'title') { leaveToHome(); return true; }
  if (phase === 'onboarding') {
    const c = await choose([T('Esci'), T('Resta')], { prompt: T('La nuova partita non è ancora iniziata: se esci ora dovrai ricominciare la presentazione.'), cancel: true });
    if (c !== 0) return false;
    leaveToHome();
    return true;
  }
  if (!save()) { toast(T('Salvataggio non riuscito: resto qui.')); return false; }
  if (cloudPlayer() && !(await busy(T('Salvo la partita'), flush()))) {
    const c = await choose([T('Esci lo stesso'), T('Resta')], { prompt: T('La partita è salvata su questo dispositivo, ma il servizio dei salvataggi non è raggiungibile: verrà inviata online la prossima volta che apri il gioco da qui. Uscire lo stesso?'), cancel: true });
    if (c !== 0) return false;
  }
  leaveToHome();
  return true;
}

/** Esce dal giocatore su questo dispositivo: la partita resta online, la copia locale e la chiave della cassaforte si cancellano. */
async function leavePlayer() {
  let sent = true;
  if (phase === 'game' && S) { save(); sent = await busy(T('Salvo la partita'), flush()); }
  const ask = sent
    ? T('Uscire dal giocatore su questo dispositivo? La partita resta salvata online: per riprenderla basta rientrare con nome e password.')
    : T('Il servizio dei salvataggi non è raggiungibile e gli ultimi progressi non sono ancora stati inviati: uscendo adesso li perderesti. Uscire lo stesso?');
  const c = await choose([T('Esci'), T('Resta')], { prompt: ask, cancel: true });
  if (c !== 0) return;
  await busy(T('Esco dal giocatore'), logout());
  clearLocal();
  location.reload();
}

/** Cancella il giocatore online e da questo dispositivo, poi riparte dalla schermata del giocatore. */
async function deletePlayer() {
  const p = cloudPlayer();
  if (!p) return;
  // si ricarica subito, prima che un salvataggio automatico possa riscrivere la partita appena tolta
  if (await deletePlayerForm(p)) location.reload();
}

// ---------------- Sottofinestre ----------------

/** Personalizzazione dei tasti e modalità touch. */
export async function openControls() {
  await modal(T('Comandi'), ({ body, button, close }) => {
    mark(body);
    const render = () => {
      const modes: [TouchMode, string][] = [['auto', T`Automatico${isTouchDevice() ? T(' (touch rilevato)') : ''}`], ['on', T('Sempre attivi')], ['off', T('Disattivati')]];
      body.innerHTML = T`
        <p><b>Comandi touch</b> <span class="small muted">croce direzionale e pulsanti A, B e MENU sullo schermo</span></p>
        <div class="row touch-modes">${modes.map(([m, l]) => `<button class="btn tm-${m} ${prefs.touch === m ? 'primary' : ''}" data-m="${m}">${prefs.touch === m ? '● ' : ''}${l}</button>`).join('')}</div>
        <p style="margin-top:10px"><b>Tasti della tastiera</b> <span class="small muted">clicca un tasto (o selezionalo e premi A) e poi premi il nuovo tasto; ✕ lo toglie</span></p>
        <table class="t keys-t">${ACTIONS.map((a) => `<tr><td><b>${esc(a.name)}</b><div class="small muted">${esc(a.use)}</div></td><td class="kcell">${
          prefs.keys[a.id].map((c, i) => `<span class="kchip"><button class="btn kb-b" data-a="${a.id}" data-i="${i}">${esc(keyName(c))}</button>${prefs.keys[a.id].length > 1 ? `<button class="btn kx" data-a="${a.id}" data-i="${i}" aria-label="Togli ${esc(keyName(c))}">✕</button>` : ''}</span>`).join('')
        }${prefs.keys[a.id].length < MAX_KEYS ? `<button class="btn kb-b add" data-a="${a.id}" data-i="${prefs.keys[a.id].length}">＋</button>` : ''}</td></tr>`).join('')}</table>`;
      body.querySelectorAll<HTMLButtonElement>('.touch-modes button').forEach((b) => b.addEventListener('click', () => { setTouchMode(b.dataset.m as TouchMode); render(); body.querySelector<HTMLButtonElement>(`.tm-${b.dataset.m}`)?.focus(); }));
      body.querySelectorAll<HTMLButtonElement>('.kb-b').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a as Action; const i = Number(b.dataset.i);
        b.textContent = T('Premi un tasto…');
        b.classList.add('wait');
        captureNextKey((code) => {
          const stolen = bindKey(a, i, code);
          if (stolen) toast(T`${keyName(code)} tolto da "${ACTIONS.find((x) => x.id === stolen)!.name}".`);
          if (prefs.keys.a.length === 0 || prefs.keys.b.length === 0) toast(T('Attent{o|a}: Conferma e Indietro devono avere almeno un tasto.'));
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
    button(T('Rivedi la guida'), () => { close(); if (!document.querySelector('.tutorial')) void controlsTutorial(); });
    button(T('Ripristina predefiniti'), () => { resetBindings(); render(); toast(T('Tasti predefiniti ripristinati.')); });
    button(T('Fatto'), () => close(), 'primary');
  }, { wide: true });
  captureNextKey(null);
}

/** Crediti: le fonti didattiche non compaiono durante il gioco, ma restano tutte elencate qui (e in docs/02-CONTENUTI-E-FONTI.md). */
async function credits() {
  const byPublisher = new Map<string, { title: string; url: string }[]>();
  for (const s of Object.values(SOURCES)) {
    if (!byPublisher.has(s.publisher)) byPublisher.set(s.publisher, []);
    byPublisher.get(s.publisher)!.push(s);
  }
  await modal(T('Crediti e fonti'), ({ body, button, close }) => {
    mark(body);
    body.innerHTML = T`
      <p class="small">Tradermon è un gioco originale. Quiz, lezioni e consigli sono scritti con parole nostre e si basano su materiale pubblico di educazione finanziaria. Le fonti non vengono mostrate durante il gioco per non interrompere il ritmo, ma sono tutte qui sotto.</p>
      <h4>Fonti didattiche</h4>
      ${[...byPublisher].map(([pub, list]) => `<p class="small"><b>${esc(pub)}</b>: ${list.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(', ')}</p>`).join('')}
      <h4>Dati di mercato</h4>
      <p class="small">Il gioco non simula alcun mercato: titoli, prezzi, grafici e periodi storici dei replay sono dati reali, scaricati da Alpaca con le chiavi del giocatore. Senza conto collegato non viene mostrato alcun prezzo. Conto, posizioni e prezzi sono forniti da Alpaca solo per il tuo uso personale e non vengono ridistribuiti.</p>
      <h4>Software e caratteri</h4>
      <p class="small">Motore Phaser (licenza MIT); resa 2.5D con Three.js (MIT) e postprocessing (Zlib). Caratteri Press Start 2P, Pixelify Sans e DotGothic16 (SIL Open Font License 1.1) tramite Fontsource. Grafica e musica generate dal gioco.</p>
      <p class="small muted">Contenuti a scopo educativo, non sono consulenza finanziaria.</p>`;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}
