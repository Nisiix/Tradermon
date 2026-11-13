// Agenda del giorno e della settimana, rivincite di Wall Street, traguardi e oggetti della casa.
import { S } from '../systems/state';
import { modal, esc, bar } from './core';
import { refreshAgenda, taskDef, ACHIEVEMENTS, DECOR_INFO } from '../systems/progress';
import type { AgendaTask } from '../types';
import { activeQuests, QUESTS } from '../world/quests';
import { RESIDENT_BY_ID } from '../data/residents';
import { T } from '../i18n';

function taskHtml(t: AgendaTask): string {
  const d = taskDef(t.id);
  // titolo in alto, barra e numeri sempre sul fondo: così le card di una riga si leggono alla stessa altezza
  return `<div class="card stack ${t.done ? 'gold' : ''}"><b>${t.done ? '✓ ' : ''}${esc(d?.text ?? t.id)}</b><div class="card-foot">${bar((t.got / t.need) * 100)}<div class="card-meta"><span>${t.got}/${t.need}</span><span class="muted">${T`+${d?.xp ?? 20} Conoscenza`}</span></div></div></div>`;
}

export async function openAgenda() {
  refreshAgenda();
  await modal(T('Agenda e traguardi'), ({ body, button, close }) => {
    const got = ACHIEVEMENTS.filter((a) => S.achievements.includes(a.id));
    body.innerHTML = T`
      <h4 style="margin:0 0 4px">Oggi <span class="small muted">(${S.agenda.day})</span></h4>
      <div class="cards tasks">${S.agenda.daily.map(taskHtml).join('')}</div>
      ${S.agenda.daily.length && S.agenda.daily.every((t) => t.done) ? T('<p class="good small">Agenda del giorno completata: +25 Conoscenza extra.</p>') : ''}
      <h4 style="margin:8px 0 4px">Questa settimana <span class="small muted">(${S.agenda.week})</span></h4>
      <div class="cards tasks">${S.agenda.weekly.map(taskHtml).join('')}</div>
      <h4 style="margin:8px 0 4px">Storie degli abitanti <span class="small muted">${QUESTS.filter((q) => S.quests[q.id] >= q.steps.length).length}/${QUESTS.length} completate</span></h4>
      ${activeQuests().length ? '<div class="cards tasks">' + activeQuests().map(({ quest, step, i }) => `<div class="card stack"><b>${esc(quest.title)}</b><span class="small">${esc(step.say[0])}</span><div class="card-foot card-meta"><span>${T('tappa ')}${i + 1}/${quest.steps.length}</span><span class="muted">${esc(RESIDENT_BY_ID[quest.giver]?.name ?? '')}</span></div></div>`).join('') + '</div>' : T('<p class="small muted">Parla una seconda volta con gli abitanti: alcuni hanno un favore da chiederti.</p>')}
      <h4 style="margin:8px 0 4px">Rivincite</h4>
      ${S.flags.champion ? T`<p class="small">Wall Street è aperta: i Superiori e il Campione si possono risfidare in ordine, con domande più difficili. Giro attuale: ${Number(S.flags.wsRound ?? 0)}/5.</p>` : T('<p class="small muted">Ogni sfidante si affronta una volta sola. Solo Wall Street, dopo che l\'avrai vinta, si potrà rifare.</p>')}
      <h4 style="margin:8px 0 4px">Traguardi <span class="small muted">${got.length}/${ACHIEVEMENTS.length}</span></h4>
      <div class="cards">${ACHIEVEMENTS.map((a) => { const ok = S.achievements.includes(a.id); if (a.secret && !ok) return T('<div class="card stack locked"><b>○ ???</b><span class="small">Un segreto ancora da scoprire.</span></div>'); const prize = `${a.title ? T`<span>Titolo: ${esc(T(a.title))}</span>` : ''}${a.decor ? T`<span>Oggetto: ${esc(DECOR_INFO[a.decor]?.name ?? a.decor)}</span>` : ''}`; return `<div class="card stack ${ok ? 'gold' : 'locked'}"><b>${ok ? '🏆' : '○'} ${esc(a.name)}</b><span class="small">${esc(a.desc)}</span>${prize ? `<div class="card-foot card-prize small muted">${prize}</div>` : ''}</div>`; }).join('')}</div>
      <h4 style="margin:8px 0 4px">Oggetti per la casa <span class="small muted">${S.decor.length}/${Object.keys(DECOR_INFO).length}</span></h4>
      <p class="small">${S.decor.length ? S.decor.map((d) => esc(DECOR_INFO[d]?.name ?? d)).join(' · ') + T('. Li trovi a casa tua, a Borgo Semina.') : T('Sblocca traguardi per arredare la tua casa a Borgo Semina.')}</p>`;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}
