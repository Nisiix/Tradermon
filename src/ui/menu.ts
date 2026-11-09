import { S, save, level, xpToNext, cardLevel, slots, exportSave, LIVE_LIMITS } from '../systems/state';
import { choose, modal, esc, say, el, toast, bar } from './core';
import { ASSETS, SECTOR_LABEL, SECTOR_COLOR, classesOf } from '../data/assets';
import { LESSONS, lessonsFor } from '../data/lessons';
import { trackTopics } from '../data/quiz/build';
import { SOURCES } from '../data/sources';
import { BIAS_INFO } from '../data/events';
import { mentor, TOWNS } from '../data/story';
import { checkupHtml, download } from './clinic';
import { mastery } from '../systems/quiz';
import { marketClock, CLIMATE_LABEL } from '../systems/market';
import { setVolume } from '../systems/audio';
import type { BiasId } from '../types';
import { ALL_RESIDENTS, HOUSEHOLDS } from '../data/residents';

export async function pauseMenu(onTravel: (id: string) => void) {
  for (;;) {
    const opts = ['Investidex', 'Portafoglio', 'Profilo e Licenza', 'Medaglie e Tecniche', 'Lezioni', 'Viaggio rapido', 'Salva', 'Opzioni', 'Chiudi'];
    const dis = opts.map((o) => o === 'Viaggio rapido' && S.badges < 6);
    const c = await choose(opts, { cancel: true, title: 'MENU', disabled: dis });
    if (c < 0 || c === 8) return;
    if (c === 0) await openInvestidex();
    if (c === 1) await modal('Portafoglio', ({ body, button, close }) => { body.innerHTML = checkupHtml(); button('Chiudi', () => close(), 'primary'); }, { wide: true });
    if (c === 2) await profile();
    if (c === 3) await badges();
    if (c === 4) await openLessons();
    if (c === 5) {
      const d = TOWNS.filter((t) => S.visited.includes(t.id));
      const k = await choose([...d.map((t) => t.name), 'Annulla'], { cancel: true, title: 'VIAGGIO RAPIDO' });
      if (k >= 0 && k < d.length) { onTravel(d[k].id); return; }
    }
    if (c === 6) { toast(save() ? 'Partita salvata.' : 'Salvataggio non riuscito.'); }
    if (c === 7) await options();
  }
}

export async function openInvestidex() {
  await modal('Investidex', ({ body, button, close }) => {
    const cls = classesOf(S.track, S.mixedClasses);
    const assets = ASSETS.filter((a) => cls.includes(a.cls));
    const unlocked = assets.filter((a) => S.cards[a.id]).length;
    const concepts = LESSONS.filter((l) => S.lessonsRead.includes(l.id)).length;
    body.innerHTML = `<p>Asset: <b>${unlocked}/${assets.length}</b> · Concetti: <b>${concepts}/${lessonsFor(trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole'])).length}</b> · Bias incontrati: <b>${S.biasSeen.length}/4</b> · Consigli degli abitanti: <b>${S.tipsHeard.length}/${ALL_RESIDENTS.length}</b> · Padronanza quiz: <b>${Math.round(mastery() * 100)}%</b></p>`;
    const grid = el('div', 'cards');
    for (const a of assets) {
      const c = S.cards[a.id];
      const lv = c ? cardLevel(a.id) : 0;
      const d = el('div', 'card' + (c ? '' : ' locked') + (c?.gold ? ' gold' : ''));
      d.innerHTML = c
        ? `<span class="sector" style="background:${SECTOR_COLOR[a.sector]}">${SECTOR_LABEL[a.sector]}</span> ${c.gold ? '★' : ''}<br><b>${esc(a.name)}</b> <span class="muted">${a.ticker}</span><br><span class="small">Livello ${lv}/4 · rischio ${'★'.repeat(a.risk)}</span><p class="small" style="margin:4px 0">${esc(a.desc)}</p>${a.facts.slice(0, Math.max(0, lv - 1)).map((f) => `<p class="small" style="margin:2px 0">• ${esc(f)}</p>`).join('')}${lv < 4 ? `<div class="small muted">Studio: ${c.xp} pt</div>` : ''}`
        : `<b>???</b><br><span class="small muted">Si sblocca ${a.unlock.startsWith('badge:') ? `con la Medaglia ${a.unlock.slice(6)}` : 'più avanti'}.</span>`;
      grid.appendChild(d);
    }
    body.appendChild(grid);
    if (S.biasSeen.length) body.appendChild(el('div', '', `<h4>Bias</h4>${S.biasSeen.map((b: BiasId) => `<p class="small"><b>${BIAS_INFO[b].name}</b>: ${BIAS_INFO[b].effect} <a href="${SOURCES[BIAS_INFO[b].source].url}" target="_blank" rel="noopener">Approfondisci</a></p>`).join('')}`));
    if (S.tipsHeard.length) {
      const items = HOUSEHOLDS.flatMap((town, ti) => town.flatMap((h) => h.people.filter((r) => S.tipsHeard.includes(r.id)).map((r) => {
        const src = SOURCES[r.source];
        return `<p class="small"><b>${esc(r.name)}</b> <span class="muted">(${esc(h.name)}, ${esc(TOWNS[ti].name)})</span>: ${esc(r.lines.join(' '))}${src ? ` <a href="${src.url}" target="_blank" rel="noopener">Fonte</a>` : ''}</p>`;
      })));
      body.appendChild(el('div', '', `<h4>Consigli degli abitanti</h4>${items.join('')}`));
    }
    if (S.flags.casinoLesson) body.appendChild(el('p', 'small', '<b>Azzardo vs investimento</b>: nel gioco d\'azzardo il banco ha un vantaggio strutturale (2,7% alla roulette europea); la martingala porta prima o poi alla rovina.'));
    body.appendChild(el('p', 'small muted', 'Livelli: 2 con la tecnica "Lettura del Ticker" (Mentore 1), 3-4 dalla Medaglia 5. Lo studio sale con quiz, missioni, possesso e Archivio.'));
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

export async function openLessons() {
  const topics = trackTopics(S.track, S.mixedClasses, S.badges).concat(S.badges >= 8 ? ['macro', 'analisi', 'regole'] : []);
  const ls = lessonsFor(topics);
  for (;;) {
    const c = await choose([...ls.map((l) => `${S.lessonsRead.includes(l.id) ? '✓ ' : '• '}${l.title}`), 'Fine'], { cancel: true, title: 'LEZIONI' });
    if (c < 0 || c >= ls.length) return;
    const l = ls[c];
    await say(l.body, l.title);
    const src = SOURCES[l.source];
    if (src) toast(`Fonte: ${src.publisher} – ${src.title}`);
    if (!S.lessonsRead.includes(l.id)) { S.lessonsRead.push(l.id); S.stats.xp += 5; }
  }
}

async function profile() {
  const { cur, need } = xpToNext();
  const clk = marketClock();
  const L = LIVE_LIMITS[Math.min(8, S.badges)];
  await modal('Profilo e Licenza', ({ body, button, close }) => {
    body.innerHTML = `
      <div class="grid2">
        <div><b>${esc(S.name)}</b> · ${({ stocks: 'Sentiero dei Titoli', etf: 'Sentiero degli Indici', crypto: 'Sentiero Cripto', mixed: 'Sentiero Misto' } as Record<string, string>)[S.track]}${S.ngPlus ? ` · Nuova Partita+ ${S.ngPlus}` : ''}<br>
        Profilo di rischio: <b>${S.profile}</b> · Orizzonte: ${esc(S.horizon || '—')}<br>
        Livello di Conoscenza <b>${level()}</b> (${cur}/${need} XP)${bar((cur / need) * 100)}
        Fiducia ${S.stats.fiducia}/100 ${bar(S.stats.fiducia)}
        Disciplina ${S.stats.disciplina} · Pazienza ${S.stats.pazienza} · Reputazione ${S.stats.reputazione}<br>
        Stato: ${S.bias ? `<span class="bad">${BIAS_INFO[S.bias].name}</span>` : 'nessun bias'} · Slot di portafoglio ${slots()}<br>
        Serie della domanda del giorno: ${S.daily.streak} · Torre: piano ${S.tower.best}</div>
        <div><b>Licenza:</b> ${S.license === 'apprendista' ? 'Apprendista (bloccata: serve la 1ª Medaglia)' : S.license === 'esame' ? 'Esame di Abilitazione disponibile (Clinica → Conto Alpaca)' : '<span class="good">Licenza di Investitore</span>'}<br>
        ${S.license === 'investitore' ? `Limiti scelti: ${S.liveLimits.perOrder} $/ordine, ${S.liveLimits.perMonth} $/mese (massimi del livello ${L.order}/${L.month})<br>${S.liveLimits.pauseUntil > Date.now() ? `<span class="bad">Pausa di riflessione fino al ${new Date(S.liveLimits.pauseUntil).toLocaleString('it-IT')}</span><br>` : ''}` : ''}
        <b>Orologio di mercato:</b> ${clk.label}<br><b>Clima di Capitalia:</b> ${CLIMATE_LABEL[S.market.climate]}<br>
        <b>Giorno di mercato simulato:</b> ${S.market.day}</div>
      </div>`;
    button('Chiudi', () => close(), 'primary');
  });
}

async function badges() {
  await modal('Medaglie e Tecniche', ({ body, button, close }) => {
    let h = '<div class="cards">';
    for (let i = 1; i <= 8; i++) {
      const m = mentor(i, S.track);
      const got = S.badges >= i;
      h += `<div class="card ${got ? 'gold' : 'locked'}"><b>${got ? '🏅' : '○'} ${esc(m.badge)}</b><br><span class="small">${esc(m.name)} · ${TOWNS[i].name}</span><br><span class="small">${got ? `Tecnica: <b>${esc(m.technique)}</b>. ${esc(m.techDesc)}` : 'Non ancora ottenuta'}</span></div>`;
    }
    h += '</div>';
    if (S.flags.champion) h += '<p class="good"><b>Campione della Lega degli Investitori</b></p>';
    if (S.legends.length) h += `<p>Crisi leggendarie superate: ${S.legends.length}/5</p>`;
    body.innerHTML = h;
    button('Chiudi', () => close(), 'primary');
  }, { wide: true });
}

async function options() {
  await modal('Opzioni', ({ body, button, close }) => {
    body.innerHTML = `
      <label>Velocità del testo <select class="tx ts"><option value="0">Lenta</option><option value="1">Normale</option><option value="2">Veloce</option><option value="3">Istantanea</option></select></label>
      <label style="display:block;margin-top:6px">Dimensione del testo <select class="tx fs"><option value="0.9">Piccola</option><option value="1">Normale</option><option value="1.2">Grande</option><option value="1.4">Molto grande</option></select></label>
      <label style="display:block;margin-top:6px">Volume <input class="vol" type="range" min="0" max="1" step="0.1" style="width:100%"></label>
      <label style="display:block;margin-top:6px"><input type="checkbox" class="hc"> Contrasto alto</label>
      <label style="display:block;margin-top:6px"><input type="checkbox" class="sm"> Modalità Studio (nessun timer nei quiz, Reputazione dimezzata nei duelli)</label>
      <p class="small muted">Il salvataggio è nel browser. Esportalo per sicurezza o per spostarlo su un altro dispositivo. Le chiavi Alpaca non sono mai nel salvataggio.</p>`;
    const q = <T extends HTMLElement>(s: string) => body.querySelector(s) as T;
    q<HTMLSelectElement>('.ts').value = String(S.options.textSpeed);
    q<HTMLSelectElement>('.fs').value = String(S.options.fontScale);
    q<HTMLInputElement>('.vol').value = String(S.options.volume);
    q<HTMLInputElement>('.hc').checked = S.options.contrast;
    q<HTMLInputElement>('.sm').checked = S.options.studyMode;
    button('Esporta salvataggio', () => download(`tradermon-${S.name}.json`, exportSave()));
    button('Applica', () => {
      S.options.textSpeed = Number(q<HTMLSelectElement>('.ts').value);
      S.options.fontScale = Number(q<HTMLSelectElement>('.fs').value);
      S.options.volume = Number(q<HTMLInputElement>('.vol').value);
      S.options.contrast = q<HTMLInputElement>('.hc').checked;
      S.options.studyMode = q<HTMLInputElement>('.sm').checked;
      applyOptions();
      save();
      close();
    }, 'primary');
  });
}

export function applyOptions() {
  document.documentElement.style.setProperty('--fs', `${15 * S.options.fontScale}px`);
  document.body.classList.toggle('contrast', S.options.contrast);
  setVolume(S.options.volume);
}
