import { g, gtext } from '../systems/gender';
import { revealedProfile, profileName } from '../systems/mirror';
import { S, save, level, xpToNext, cardLevel, slots } from '../systems/state';
import { choose, modal, esc, say, el, toast, bar } from './core';
import { ASSETS, SECTOR_LABEL, SECTOR_COLOR, classesOf } from '../data/assets';
import { LESSONS, lessonsFor } from '../data/lessons';
import { trackTopics } from '../data/quiz/build';
import { BIAS_INFO } from '../data/events';
import { mentor, TOWNS } from '../data/story';
import { checkupHtml } from './clinic';
import { apiKeysMenu, stageScreen } from './broker';
import { asOfLabel } from '../systems/realdata';
import { DIFFICULTY } from '../systems/balance';
import { mastery } from '../systems/quiz';
import { marketClock, CLIMATE_LABEL } from '../systems/market';
import { openSettings, exitGame, applyOptions } from './settings';
import { availableTitles, track } from '../systems/progress';
import { openAgenda } from './agenda';
import { openJournal } from './journal';
import { openStudentFolder } from './student';
import { headlines, weekSummary } from '../systems/gazette';
import type { QuizTopic, BiasId } from '../types';
import { ALL_RESIDENTS, HOUSEHOLDS } from '../data/residents';
import { openRegionMap } from './regionmap';
import { ABILITY, canSwim, canTransfer } from '../world/travel';
import { T } from '../i18n';

/** Voci del menu di gioco, nell'ordine in cui compaiono. Un solo elenco: menu, guida e comandi ne parlano allo stesso modo. */
type Entry = { id: string; label: () => string };
const ENTRIES: Entry[] = [
  { id: 'dex', label: () => 'Investidex' },
  { id: 'portfolio', label: () => T('Portafoglio') },
  { id: 'agenda', label: () => { const n = S.agenda.daily.filter((t) => !t.done).length + S.agenda.weekly.filter((t) => !t.done).length; return T`Agenda e traguardi${n ? ` (${n})` : ''}`; } },
  { id: 'journal', label: () => T('Diario') },
  { id: 'gazette', label: () => T('Giornale dei Mercati') },
  { id: 'student', label: () => T('Cartella dello studente') },
  { id: 'profile', label: () => T('Profilo') },
  { id: 'badges', label: () => T('Attestati e Tecniche') },
  { id: 'stages', label: () => T('Tappe, Prove e Sigilli') },
  { id: 'keys', label: () => T('Chiavi API') },
  { id: 'map', label: () => T('Mappa della Regione') },
  { id: 'options', label: () => T('Opzioni') },
  { id: 'save', label: () => T('Salva') },
  { id: 'exit', label: () => T('Esci dal gioco') },
];

export async function pauseMenu(onTravel: (id: string) => void | Promise<void>) {
  let sel = 0;
  for (;;) {
    const c = await choose(ENTRIES.map((e) => e.label()), { cancel: true, title: 'MENU', start: sel });
    if (c < 0) return;
    sel = c;
    switch (ENTRIES[c].id) {
      case 'dex': await openInvestidex(); break;
      case 'portfolio': await modal(T('Portafoglio'), ({ body, button, close }) => { body.innerHTML = checkupHtml(); button(T('Chiudi'), () => close(), 'primary'); }, { wide: true }); break;
      case 'agenda': await openAgenda(); break;
      case 'journal': await openJournal(); break;
      case 'gazette': await openGazette(); break;
      case 'student': await openStudentFolder(); break;
      case 'profile': await profile(); break;
      case 'badges': await badges(); break;
      case 'stages': await stageScreen(); break;
      case 'keys': await apiKeysMenu(); break;
      case 'map': { const dest = await openRegionMap(); if (dest) { await onTravel(dest); return; } break; }
      case 'options': await openSettings(); break;
      case 'save': toast(save() ? T('Partita salvata.') : T('Salvataggio non riuscito.')); break;
      case 'exit': if (await exitGame()) return; break;
    }
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
    body.innerHTML = `<p class="small">${esc(weekSummary())}</p>` + (hs.length ? hs.map((h) => `<div style="margin:6px 0"><b class="${h.tone === 'su' ? 'good' : h.tone === 'giu' ? 'bad' : ''}">${T`Giorno ${h.day}`} · ${esc(h.title)}</b>${h.body ? `<br><span class="small">${esc(h.body)}</span>` : ''}</div>`).join('') : T('<p class="muted">Nessuna notizia ancora.</p>'));
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
        Profilo dichiarato: <b>${profileName(S.profile)}</b> · rivelato dalle missioni: <b>${((r) => (r ? profileName(r) : '—'))(revealedProfile())}</b> · Orizzonte: ${esc(S.horizon ? T(S.horizon) : '—')}<br>
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
  await modal(T('Attestati e Tecniche'), ({ body, button, close }) => {
    let h = '<div class="cards">';
    for (let i = 1; i <= 8; i++) {
      const m = mentor(i, S.track);
      const got = S.badges >= i;
      const seal = S.seals >= i;
      h += `<div class="card ${got && seal ? 'gold' : got ? '' : 'locked'}"><b>${got && seal ? '🏅' : got ? '📜' : '○'} ${esc(m.badge)}</b> <span class="small">${got ? (seal ? T('Attestato e Sigillo') : T('Attestato · manca il Sigillo pratico')) : ''}</span><br><span class="small">${esc(m.name)} · ${TOWNS[i].name}</span><br><span class="small">${got ? T`Tecnica: <b>${esc(m.technique)}</b>. ${esc(m.techDesc)}` : T('Non ancora ottenuto')}</span></div>`;
    }
    h += '</div>';
    const ab = [{ a: ABILITY.swim, ok: canSwim() }, { a: ABILITY.cut, ok: S.badges >= ABILITY.cut.badge }, { a: ABILITY.transfer, ok: canTransfer() }, { a: ABILITY.dark, ok: S.badges >= ABILITY.dark.badge }, { a: ABILITY.cold, ok: S.badges >= 7 }];
    h += T`<h4>Abilità di esplorazione</h4>${ab.map(({ a, ok }) => `<p class="small" style="margin:3px 0">${ok ? '✓' : '🔒'} <b>${esc(a.name)}</b> (${T`Attestato ${a.badge}`}): ${ok ? esc(gtext(a.desc)) : T('non ancora ottenuta.')}</p>`).join('')}`;
    if (S.flags.champion) h += T`<p class="good"><b>${g(T('Campione'), T('Campionessa'))} di Wall Street</b></p>`;
    if (S.legends.length) h += T`<p>Crisi leggendarie superate: ${S.legends.length}/5</p>`;
    if (S.boss.beaten.length) h += T`<p>Boss dei Mercati battuti: ${S.boss.beaten.length}/3</p>`;
    h += T('<p class="small muted">Ogni Whale assegna due riconoscimenti: l\'Attestato (il duello con la Whale) apre la strada e la Tecnica; il Sigillo pratico (la Prova sul conto) lo completa. Per Wall Street servono tutti e otto gli Attestati, ognuno con il suo Sigillo.</p>');
    body.innerHTML = h;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}

export { applyOptions };
