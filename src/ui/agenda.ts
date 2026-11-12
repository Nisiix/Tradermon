// Agenda del giorno e della settimana, rivincite pronte, traguardi e oggetti della casa.
import { S } from '../systems/state';
import { modal, esc, bar } from './core';
import { refreshAgenda, taskDef, rematchesReady, ACHIEVEMENTS, DECOR_INFO } from '../systems/progress';
import { allMapIds, getMap } from '../world/maps';
import type { AgendaTask } from '../types';
import { activeQuests, QUESTS } from '../world/quests';
import { RESIDENT_BY_ID } from '../data/residents';
import { T } from '../i18n';

function npcName(id: string): string {
  for (const m of allMapIds()) { const n = getMap(m).npcs.find((x) => x.id === id); if (n) return `${n.name} (${getMap(m).name})`; }
  return id;
}

function taskHtml(t: AgendaTask): string {
  const d = taskDef(t.id);
  return `<div class="card ${t.done ? 'gold' : ''}"><b>${t.done ? '✓ ' : ''}${esc(d?.text ?? t.id)}</b> <span class="small muted">${T`+${d?.xp ?? 20} Conoscenza`}</span>${bar((t.got / t.need) * 100)}<span class="small">${t.got}/${t.need}</span></div>`;
}

export async function openAgenda() {
  refreshAgenda();
  await modal(T('Agenda e traguardi'), ({ body, button, close }) => {
    const rem = rematchesReady();
    const got = ACHIEVEMENTS.filter((a) => S.achievements.includes(a.id));
    body.innerHTML = T`
      <h4 style="margin:0 0 4px">Oggi <span class="small muted">(${S.agenda.day})</span></h4>
      <div class="cards">${S.agenda.daily.map(taskHtml).join('')}</div>
      ${S.agenda.daily.length && S.agenda.daily.every((t) => t.done) ? T('<p class="good small">Agenda del giorno completata: +25 Conoscenza extra.</p>') : ''}
      <h4 style="margin:8px 0 4px">Questa settimana <span class="small muted">(${S.agenda.week})</span></h4>
      <div class="cards">${S.agenda.weekly.map(taskHtml).join('')}</div>
      <h4 style="margin:8px 0 4px">Storie degli abitanti <span class="small muted">${QUESTS.filter((q) => S.quests[q.id] >= q.steps.length).length}/${QUESTS.length} completate</span></h4>
      ${activeQuests().length ? activeQuests().map(({ quest, step, i }) => `<div class="card"><b>${esc(quest.title)}</b> <span class="small muted">${T('tappa ')}${i + 1}/${quest.steps.length} · ${esc(RESIDENT_BY_ID[quest.giver]?.name ?? '')}</span><br><span class="small">${esc(step.say[0])}</span></div>`).join('') : T('<p class="small muted">Parla una seconda volta con gli abitanti: alcuni hanno un favore da chiederti.</p>')}
      <h4 style="margin:8px 0 4px">Rivincite pronte</h4>
      ${rem.length ? `<ul class="small" style="margin:0 0 0 16px">${rem.map((id) => `<li>${esc(npcName(id))}</li>`).join('')}</ul>` : T('<p class="small muted">Nessuna. Gli investitori battuti chiedono la rivincita dopo 3 giorni, con domande più difficili.</p>')}
      <h4 style="margin:8px 0 4px">Traguardi <span class="small muted">${got.length}/${ACHIEVEMENTS.length}</span></h4>
      <div class="cards">${ACHIEVEMENTS.map((a) => { const ok = S.achievements.includes(a.id); if (a.secret && !ok) return T('<div class="card locked"><b>○ ???</b><br><span class="small">Un segreto ancora da scoprire.</span></div>'); return `<div class="card ${ok ? 'gold' : 'locked'}"><b>${ok ? '🏆' : '○'} ${esc(a.name)}</b><br><span class="small">${esc(a.desc)}</span>${a.title ? T`<br><span class="small muted">Titolo: ${esc(T(a.title))}</span>` : ''}${a.decor ? T`<br><span class="small muted">Oggetto: ${esc(DECOR_INFO[a.decor]?.name ?? a.decor)}</span>` : ''}</div>`; }).join('')}</div>
      <h4 style="margin:8px 0 4px">Oggetti per la casa <span class="small muted">${S.decor.length}/${Object.keys(DECOR_INFO).length}</span></h4>
      <p class="small">${S.decor.length ? S.decor.map((d) => esc(DECOR_INFO[d]?.name ?? d)).join(' · ') + T('. Li trovi a casa tua, a Borgo Semina.') : T('Sblocca traguardi per arredare la tua casa a Borgo Semina.')}</p>`;
    button(T('Chiudi'), () => close(), 'primary');
  }, { wide: true });
}
