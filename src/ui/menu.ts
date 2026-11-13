import { g, gtext } from '../systems/gender';
import { revealedProfile } from '../systems/mirror';
import { S, save, level, xpToNext, cardLevel, slots, exportSave } from '../systems/state';
import { choose, modal, esc, say, el, toast, bar } from './core';
import { ASSETS, SECTOR_LABEL, SECTOR_COLOR, classesOf } from '../data/assets';
import { LESSONS, lessonsFor } from '../data/lessons';
import { trackTopics } from '../data/quiz/build';
import { SOURCES } from '../data/sources';
import { BIAS_INFO } from '../data/events';
import { mentor, TOWNS } from '../data/story';
import { checkupHtml, download } from './clinic';
import { apiKeysMenu, stageScreen } from './broker';
import { asOfLabel } from '../systems/realdata';
import { DIFFICULTY } from '../systems/balance';
import * as Acc from '../systems/account';
import { mastery } from '../systems/quiz';
import { marketClock, CLIMATE_LABEL } from '../systems/market';
import { applyAudio, openControls } from './settings';
import { prefs } from '../systems/controls';
import { availableTitles, track } from '../systems/progress';
import { openAgenda } from './agenda';
import { openJournal } from './journal';
import { openStudentFolder } from './student';
import { headlines, weekSummary } from '../systems/gazette';
import type { QuizTopic, BiasId } from '../types';
import { ALL_RESIDENTS, HOUSEHOLDS } from '../data/residents';
import { safariAtRisk, SAFARI_TEXT } from './storageNotice';
import { cloudPlayer, flush, clearLocal } from '../systems/sync';
import { logout } from '../systems/cloud';
import { deletePlayerForm, PRIVACY_URL } from './account';
import { busy } from './loading';
import { openRegionMap } from './regionmap';
import { ABILITY, canSwim, canTransfer } from '../world/travel';
import { T } from '../i18n';

export async function pauseMenu(onTravel: (id: string) => void | Promise<void>) {
  for (;;) {
    const pending = S.agenda.daily.filter((t) => !t.done).length + S.agenda.weekly.filter((t) => !t.done).length;
    const opts = ['Investidex', T('Portafoglio'), T`Agenda e traguardi${pending ? ` (${pending})` : ''}`, T('Diario'), T('Giornale dei Mercati'), T('Cartella dello studente'), T('Profilo'), T('Medaglie e Tecniche'), T('Tappe, Prove e Sigilli'), T('Chiavi API'), T('Lezioni'), T('Mappa della Regione'), T('Salva'), T('Opzioni'), T('Chiudi')];
    const c = await choose(opts, { cancel: true, title: 'MENU' });
    if (c < 0 || c === opts.length - 1) return;
    const o = opts[c];
    if (o === 'Investidex') await openInvestidex();
    else if (o === T('Portafoglio')) await modal(T('Portafoglio'), ({ body, button, close }) => { body.innerHTML = checkupHtml(); button(T('Chiudi'), () => close(), 'primary'); }, { wide: true });
    else if (c === 2) await openAgenda();
    else if (o === T('Diario')) await openJournal();
    else if (o === T('Giornale dei Mercati')) await openGazette();
    else if (o === T('Tappe, Prove e Sigilli')) await stageScreen();
    else if (o === T('Chiavi API')) await apiKeysMenu();
    else if (o === T('Cartella dello studente')) await openStudentFolder();
    else if (o === T('Profilo')) await profile();
    else if (o === T('Medaglie e Tecniche')) await badges();
    else if (o === T('Lezioni')) await openLessons();
    else if (o === T('Mappa della Regione')) {
      const dest = await openRegionMap();
      if (dest) { await onTravel(dest); return; }
    }
    else if (o === T('Salva')) { toast(save() ? T('Partita salvata.') : T('Salvataggio non riuscito.')); }
    else if (o === T('Opzioni')) await options();
  }
}

export async function openInvestidex() {
  await modal('Investidex', ({ body, button, close }) => {
    const cls = classesOf(S.track, S.mixedClasses);
    const assets = ASSETS.filter((a) => cls.includes(a.cls));
    const unlocked = assets.filter((a) => S.cards[a.id]).length;
    const concepts = LESSONS.filter((l) => S.lessonsRead.includes(l.id)).length;
    body.innerHTML = T`<p>Asset: <b>${unlocked}/${assets.length}</b> · Concetti: <b>${concepts}/${lessonsFor(trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole'])).length}</b> · Bias incontrati: <b>${S.biasSeen.length}/4</b> · Lezioni degli abitanti: <b>${S.tipsHeard.length}/${ALL_RESIDENTS.length}</b> · Padronanza quiz: <b>${Math.round(mastery() * 100)}%</b></p>`;
    const grid = el('div', 'cards');
    for (const a of assets) {
      const c = S.cards[a.id];
      const lv = c ? cardLevel(a.id) : 0;
      const d = el('div', 'card' + (c ? '' : ' locked') + (c?.gold ? ' gold' : ''));
      d.innerHTML = c
        ? T`<span class="sector" style="background:${SECTOR_COLOR[a.sector]}">${SECTOR_LABEL[a.sector]}</span> ${c.gold ? '★' : ''}<br><b>${esc(a.name)}</b> <span class="muted">${a.ticker}</span><br><span class="small">Livello ${lv}/4 · rischio ${'★'.repeat(a.risk)}</span><p class="small" style="margin:4px 0">${esc(a.desc)}</p>${a.facts.slice(0, Math.max(0, lv - 1)).map((f) => `<p class="small" style="margin:2px 0">• ${esc(f)}</p>`).join('')}${lv < 4 ? T`<div class="small muted">Studio: ${c.xp} pt</div>` : ''}`
        : T`<b>???</b><br><span class="small muted">Si sblocca ${a.unlock.startsWith('badge:') ? T`con l'Attestato ${a.unlock.slice(6)}` : T('più avanti')}.</span>`;
      grid.appendChild(d);
    }
    body.appendChild(grid);
    if (S.biasSeen.length) body.appendChild(el('div', '', T`<h4>Bias</h4>${S.biasSeen.map((b: BiasId) => `<p class="small"><b>${BIAS_INFO[b].name}</b>: ${BIAS_INFO[b].effect}</p>`).join('')}`));
    if (S.tipsHeard.length) {
      const items = HOUSEHOLDS.flatMap((town, ti) => town.flatMap((h) => h.people.filter((r) => S.tipsHeard.includes(r.id)).map((r) =>
        `<p class="small"><b>${esc(r.name)}</b> <span class="muted">(${esc(h.name)}, ${esc(TOWNS[ti].name)})</span>: ${esc(r.lines.join(' '))}</p>`)));
      body.appendChild(el('div', '', T`<h4>Lezioni degli abitanti</h4>${items.join('')}`));
    }
    if (S.flags.casinoLesson) body.appendChild(el('p', 'small', T('<b>Azzardo vs investimento</b>: nel gioco d\'azzardo il banco ha un vantaggio strutturale (2,7% alla roulette europea); la martingala porta prima o poi alla rovina.')));
    body.appendChild(el('p', 'small muted', T('Livelli: 2 con la tecnica "Lettura del Ticker" (Whale 1), 3-4 dall\'Attestato 5. Lo studio sale con quiz, missioni, possesso e Archivio.')));
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

export async function openLessons(only?: QuizTopic[]) {
  const topics = only ?? trackTopics(S.track, S.mixedClasses, S.badges).concat(S.badges >= 8 ? ['macro', 'analisi', 'regole'] : []);
  const ls = lessonsFor(topics);
  for (;;) {
    const c = await choose([...ls.map((l) => `${S.lessonsRead.includes(l.id) ? '✓ ' : '• '}${l.title}`), T('Fine')], { cancel: true, title: T('LEZIONI') });
    if (c < 0 || c >= ls.length) return;
    const l = ls[c];
    await say(l.body, l.title);
    if (!S.lessonsRead.includes(l.id)) { S.lessonsRead.push(l.id); S.stats.xp += 5; track('lesson'); }
  }
}

async function openGazette() {
  await modal(T('Giornale dei Mercati'), ({ body, button, close }) => {
    const hs = headlines();
    body.innerHTML = `<p class="small">${esc(weekSummary())}</p>` + (hs.length ? hs.map((h) => `<div style="margin:6px 0"><b class="${h.tone === 'su' ? 'good' : h.tone === 'giu' ? 'bad' : ''}">Giorno ${h.day} · ${esc(h.title)}</b>${h.body ? `<br><span class="small">${esc(h.body)}</span>` : ''}</div>`).join('') : T('<p class="muted">Nessuna notizia ancora.</p>'));
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

async function profile() {
  const { cur, need } = xpToNext();
  const clk = marketClock();
  const r = await modal<string>(T('Profilo'), ({ body, button, close }) => {
    body.innerHTML = T`
      <div class="grid2">
        <div><b>${esc(S.name)}</b>${S.title ? ` <span class="muted">«${esc(T(S.title))}»</span>` : ''} · ${({ listed: T('Sentiero Azioni ed ETF'), crypto: T('Sentiero Cripto'), mixed: T('Sentiero Misto') } as Record<string, string>)[S.track]}${S.ngPlus ? T` · Nuova Partita+ ${S.ngPlus}` : ''}<br>
        Profilo dichiarato: <b>${S.profile}</b> · rivelato dalle missioni: <b>${revealedProfile() ?? '—'}</b> · Orizzonte: ${esc(S.horizon ? T(S.horizon) : '—')}<br>
        Livello di Conoscenza <b>${level()}</b> (${cur}/${need} XP)${bar((cur / need) * 100)}
        Fiducia ${S.stats.fiducia}/100 ${bar(S.stats.fiducia)}
        Disciplina ${S.stats.disciplina} · Pazienza ${S.stats.pazienza} · Reputazione ${S.stats.reputazione}<br>
        Slot di portafoglio ${slots()}<br>
        Serie della domanda del giorno: ${S.daily.streak} · Torre: piano ${S.tower.best}</div>
        <div><b>Difficoltà:</b> ${DIFFICULTY[S.difficulty].name} · <b>Attestati</b> ${S.badges}/8${S.badges ? T` · <b>Sigilli</b> ${S.seals}/8` : ''}${S.levExam ? T(' · Esame della Leva superato') : ''}<br>
        <span class="small muted">Conto di gioco: Alpaca Paper, denaro finto. Tradermon non usa mai soldi reali.</span><br>
        <b>Orologio di mercato:</b> ${clk.label}<br><b>Clima dei mercati:</b> ${CLIMATE_LABEL[S.market.climate]} <span class="small muted">(${asOfLabel()})</span><br>
        <b>Giorni di mercato dall'inizio:</b> ${S.market.day}<br>
        <b>Traguardi:</b> ${S.achievements.length} · <b>Titoli sbloccati:</b> ${availableTitles().length}</div>
      </div>`;
    if (availableTitles().length) button(T('Scegli titolo'), () => close('title'));
    button(T('Chiudi'), () => close(), 'primary');
  });
  if (r === 'title') await pickTitle();
}

/** Il titolo compare nel profilo e sulla targhetta dei duelli. */
async function pickTitle() {
  const ts = availableTitles();
  const c = await choose([...ts.map((t) => `${S.title === t ? '✓ ' : ''}${T(t)}`), T('Nessun titolo'), T('Annulla')], { cancel: true, title: T('TITOLO') });
  if (c < 0 || c === ts.length + 1) return;
  S.title = c < ts.length ? ts[c] : '';
  save();
  toast(S.title ? T`Titolo scelto: ${T(S.title)}` : T('Nessun titolo.'));
}

async function badges() {
  await modal(T('Medaglie e Tecniche'), ({ body, button, close }) => {
    let h = '<div class="cards">';
    for (let i = 1; i <= 8; i++) {
      const m = mentor(i, S.track);
      const got = S.badges >= i;
      const seal = S.seals >= i;
      h += `<div class="card ${got && seal ? 'gold' : got ? '' : 'locked'}"><b>${got && seal ? '🏅' : got ? '📜' : '○'} ${esc(m.badge)}</b> <span class="small">${got ? (seal ? T('Attestato e Sigillo') : T('Attestato · manca il Sigillo pratico')) : ''}</span><br><span class="small">${esc(m.name)} · ${TOWNS[i].name}</span><br><span class="small">${got ? `Tecnica: <b>${esc(m.technique)}</b>. ${esc(m.techDesc)}` : T('Non ancora ottenuta')}</span></div>`;
    }
    h += '</div>';
    const ab = [{ a: ABILITY.swim, ok: canSwim() }, { a: ABILITY.cut, ok: S.badges >= ABILITY.cut.badge }, { a: ABILITY.transfer, ok: canTransfer() }, { a: ABILITY.dark, ok: S.badges >= ABILITY.dark.badge }, { a: ABILITY.cold, ok: S.badges >= 7 }];
    h += T`<h4>Abilità di esplorazione</h4>${ab.map(({ a, ok }) => `<p class="small" style="margin:3px 0">${ok ? '✓' : '🔒'} <b>${esc(a.name)}</b> (${T`Attestato ${a.badge}`}): ${ok ? esc(gtext(a.desc)) : T('non ancora ottenuta.')}</p>`).join('')}`;
    if (S.flags.champion) h += T`<p class="good"><b>${g(T('Campione'), T('Campionessa'))} di Wall Street</b></p>`;
    if (S.legends.length) h += T`<p>Crisi leggendarie superate: ${S.legends.length}/5</p>`;
    if (S.boss.beaten.length) h += T`<p>Boss dei Mercati battuti: ${S.boss.beaten.length}/3</p>`;
    h += T('<p class="small muted">Ogni Medaglia ha due metà: l\'Attestato (il duello con la Whale) apre la strada e la Tecnica; il Sigillo pratico (missione su dati reali ed esercizio sul conto) la completa. Per Wall Street servono otto Medaglie complete.</p>');
    body.innerHTML = h;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

async function options() {
  await modal(T('Opzioni'), ({ body, button, close }) => {
    body.innerHTML = T`
      <label style="display:block;margin-bottom:6px">Protagonista <select class="tx gd"><option value="m">Ragazzo</option><option value="f">Ragazza</option></select></label>
      <label>Velocità del testo <select class="tx ts"><option value="0">Lenta</option><option value="1">Normale</option><option value="2">Veloce</option><option value="3">Istantanea</option></select></label>
      <label style="display:block;margin-top:6px">Dimensione del testo <select class="tx fs"><option value="0.9">Piccola</option><option value="1">Normale</option><option value="1.2">Grande</option><option value="1.4">Molto grande</option></select></label>
      <label style="display:block;margin-top:6px">Effetti sonori <input class="vol" type="range" min="0" max="1" step="0.1" style="width:100%"></label>
      <label style="display:block;margin-top:6px">Musica <input class="mus" type="range" min="0" max="1" step="0.1" style="width:100%"></label>
      <p class="small muted" style="margin:4px 0 0">Volume generale: <b>${prefs.volume === 0 ? T('muto') : Math.round(prefs.volume * 100) + '%'}</b> (si regola dall'icona ⚙ in alto a destra).</p>
      <label style="display:block;margin-top:6px">Grafica <select class="tx gfx"><option value="3d">2.5D (diorama con luci e ombre)</option><option value="2d">2D classica</option></select></label>
      <label style="display:block;margin-top:6px">Effetti 2.5D <select class="tx fx"><option value="alti">Alti (occlusione, tilt-shift, alta risoluzione)</option><option value="bassi">Bassi (per computer meno potenti)</option></select></label>
      <label style="display:block;margin-top:6px"><input type="checkbox" class="hc"> Contrasto alto</label>
      <label style="display:block;margin-top:6px"><input type="checkbox" class="sm"> Modalità Studio (nessun timer nei quiz, Reputazione dimezzata nei duelli)</label>
      <label style="display:block;margin-top:6px"><input type="checkbox" class="ig"${Acc.ignoreAllowed() ? '' : ' disabled'}> Prove sul conto: prosegui anche se vanno male${Acc.ignoreAllowed() ? '' : T(' (solo in Apprendista e Investitore)')}</label>
      <p class="small muted" style="margin:2px 0 0">Se una Prova sul conto viene annullata (vendita, stop, vendita forzata della leva, bancarotta) il risultato viene ignorato e prosegui lo stesso. Non salta la Prova: va comunque affrontata. <span class="bad">${esc(Acc.IGNORE_WARNING)}</span></p>
      <p class="small muted">${cloudPlayer() ? T`Giocatore <b>${esc(cloudPlayer()!.name)}</b>: la partita è salvata online e la ritrovi su qualsiasi dispositivo entrando con nome e password. Le chiavi Alpaca non sono mai nel salvataggio: restano solo su questo dispositivo, cifrate con la tua password.` : T('Nessun giocatore collegato: il salvataggio resta solo in questo browser.')} Puoi sempre esportarne una copia come file.</p>${safariAtRisk() ? `<p class="small">${SAFARI_TEXT}</p>` : ''}`;
    const q = <T extends HTMLElement>(s: string) => body.querySelector(s) as T;
    q<HTMLSelectElement>('.gd').value = S.gender ?? 'm';
    q<HTMLSelectElement>('.ts').value = String(S.options.textSpeed);
    q<HTMLSelectElement>('.fs').value = String(S.options.fontScale);
    q<HTMLInputElement>('.vol').value = String(S.options.volume);
    q<HTMLInputElement>('.mus').value = String(S.options.music);
    q<HTMLSelectElement>('.gfx').value = S.options.gfx;
    q<HTMLSelectElement>('.fx').value = S.options.fx;
    q<HTMLInputElement>('.hc').checked = S.options.contrast;
    q<HTMLInputElement>('.sm').checked = S.options.studyMode;
    q<HTMLInputElement>('.ig').checked = Acc.ignoreOn();
    button(T('Comandi'), () => { close(); void openControls(); });
    button(T('Chiavi API'), () => { close(); void apiKeysMenu(); });
    button(T('Crediti e fonti'), () => { close(); void credits(); });
    button(T('Esporta salvataggio'), () => download(`tradermon-${S.name}.json`, exportSave()));
    if (cloudPlayer()) button(T('Esci dal giocatore'), () => { close(); void leavePlayer(); });
    if (cloudPlayer()) button(T('Elimina il mio giocatore'), () => { close(); void deletePlayer(); });
    button(T('Privacy'), () => { window.open(PRIVACY_URL, '_blank', 'noopener'); });
    button(T('Applica'), () => {
      S.gender = q<HTMLSelectElement>('.gd').value === 'f' ? 'f' : 'm';
      S.options.textSpeed = Number(q<HTMLSelectElement>('.ts').value);
      S.options.fontScale = Number(q<HTMLSelectElement>('.fs').value);
      S.options.volume = Number(q<HTMLInputElement>('.vol').value);
      S.options.music = Number(q<HTMLInputElement>('.mus').value);
      S.options.gfx = q<HTMLSelectElement>('.gfx').value as '2d' | '3d';
      S.options.fx = q<HTMLSelectElement>('.fx').value as 'alti' | 'bassi';
      S.options.contrast = q<HTMLInputElement>('.hc').checked;
      S.options.studyMode = q<HTMLInputElement>('.sm').checked;
      const want = q<HTMLInputElement>('.ig').checked;
      const ignMsg = want !== Acc.ignoreOn() ? Acc.setIgnore(want) : '';
      applyOptions();
      save();
      close();
      if (ignMsg) void say(ignMsg);
    }, 'primary');
  });
}

/** Esce dal giocatore su questo dispositivo: la partita resta su Supabase, la copia locale e la chiave della cassaforte si cancellano. */
async function leavePlayer() {
  save();
  const sent = await busy(T('Salvo la partita'), flush());
  const ask = sent
    ? T('Uscire dal giocatore su questo dispositivo? La partita resta salvata online: per riprenderla basta rientrare con nome e password.')
    : T('Il servizio dei salvataggi non è raggiungibile e gli ultimi progressi non sono ancora stati inviati: uscendo adesso li perderesti. Uscire lo stesso?');
  const c = await choose([T('Esci'), T('Resta')], { prompt: ask, cancel: true });
  if (c !== 0) return;
  await busy(T('Esco dal giocatore'), logout());
  clearLocal();
  location.reload();
}

/** Cancella il giocatore da Supabase e da questo dispositivo, poi riparte dalla schermata del giocatore. */
async function deletePlayer() {
  const p = cloudPlayer();
  if (!p) return;
  // si ricarica subito, prima che un salvataggio automatico possa riscrivere la partita appena tolta
  if (await deletePlayerForm(p)) location.reload();
}

/** Crediti: le fonti didattiche non compaiono durante il gioco, ma restano tutte elencate qui (e in docs/02-CONTENUTI-E-FONTI.md). */
async function credits() {
  const byPublisher = new Map<string, { title: string; url: string }[]>();
  for (const s of Object.values(SOURCES)) {
    if (!byPublisher.has(s.publisher)) byPublisher.set(s.publisher, []);
    byPublisher.get(s.publisher)!.push(s);
  }
  await modal(T('Crediti e fonti'), ({ body, button, close }) => {
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

export function applyOptions() {
  document.documentElement.style.setProperty('--fs-scale', String(S.options.fontScale));
  document.body.classList.toggle('contrast', S.options.contrast);
  applyAudio();
  // la scena del mondo ascolta e cambia resa (2D / 2.5D) senza ricaricare
  window.dispatchEvent(new CustomEvent('tradermon:options'));
}
