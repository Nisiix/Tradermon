// Script dei PNG: dispatcher delle interazioni e abitanti. Le altre parti sono in story.ts, duels.ts, places.ts, common.ts.
import { type NpcDef } from '../maps';
import type { Question } from '../../types';
import { S, level, TECH, hasTech } from '../../systems/state';
import { say, toast } from '../../ui/core';
import { openClinic } from '../../ui/clinic';
import { openInvestidex } from '../../ui/menu';
import { byTopic } from '../../data/quiz/build';
import { mentor, TRAINER_TIPS } from '../../data/story';
import { repTier, repGreeting } from '../../systems/character';
import { marketClock } from '../../systems/market';
import { pick } from '../../systems/rng';
import { RESIDENT_BY_ID, ALL_RESIDENTS } from '../../data/residents';
import { track } from '../../systems/progress';
import { questTalk } from '../quests';
import { secretVisible, secretTalk, secretHint } from '../secrets';
import type { WorldApi } from './common';
import { prof, chooseCase, rival, mom } from './story';
import { trainer, speculator, student, mentorBattle, guard, league, tower, hermit, legend, daily } from './duels';
import { librarian, station, simzone, casino, archivist } from './places';
import { T } from '../../i18n';

/** NPC visibile? (es. guardie sparite dopo la Medaglia, avversari già battuti) */
const KID_ROLES = new Set(['bambino', 'bambina', 'ragazzo', 'ragazza', 'studente']);

export function npcVisible(n: NpcDef): boolean {
  const night = marketClock().night;
  // orari della giornata: di notte i bambini dormono e i piccoli della piazza sono a casa
  if (night && n.kind === 'resident' && KID_ROLES.has(RESIDENT_BY_ID[String(n.data?.rid)]?.role ?? '')) return false;
  if (night && n.kind === 'talk' && /^Bambin|^Ragazz/.test(n.name)) return false;
  switch (n.kind) {
    // le guardie dei Percorsi si spostano con l'Attestato; quella di Wall Street solo con tutti e otto i Sigilli pratici
    case 'guard': return n.data?.league ? S.seals < 8 : S.badges < (n.data?.badge as number);
    case 'aide': return !S.flags.starter;
    case 'rival': {
      const k = n.data?.n as number;
      if (k === 1) return !!S.flags.starter && !S.defeated.includes('rival_1');
      if (k === 4) return S.badges >= 8 && !S.defeated.includes('rival_4');
      return !S.defeated.includes(`rival_${k}`);
    }
    case 'case': return !S.flags.starter;
    // Wall Street è l'unico posto in cui le sfide si rifanno: da Campione i Superiori tornano al loro posto
    case 'league': return !!S.flags.champion || !S.defeated.includes(`league_${n.data?.i}`);
    case 'speculator': return !S.defeated.includes(n.id);
    case 'secret': return secretVisible(n);
    default: return true;
  }
}

export async function interact(n: NpcDef, w: WorldApi): Promise<void> {
  switch (n.kind) {
    case 'talk': return say([...(n.lines ?? ['...']), ...secretHint(n.id)], n.name);
    case 'mom': return mom();
    case 'resident': return resident(n);
    case 'aide': return say([T('Aspetta! Non puoi partire senza una Valigetta.'), T('Il Professore ti aspetta al Laboratorio, l\'edificio viola.')], T('Assistente'));
    case 'prof': return prof(w);
    case 'case': return chooseCase(n, w);
    case 'rival': return rival(n, w);
    case 'trainer': return trainer(n, w);
    case 'speculator': return speculator(n, w);
    case 'student': return student(n, w);
    case 'mentor': return mentorBattle(n.data?.n as number, w);
    case 'guard': return guard(n, w);
    case 'nurse': return openClinic(w.town());
    case 'pc': return openInvestidex();
    case 'librarian': return librarian(n);
    case 'daily': return daily();
    case 'station': return station(w);
    case 'simop': return simzone();
    case 'croupier': return casino();
    case 'archivist': return archivist();
    case 'league': return league(n.data?.i as number, w);
    case 'towerop': return tower();
    case 'legend': return legend();
    case 'hermit': return hermit(n);
    case 'secret': return secretTalk(n);
    case 'sage': return say([pick(TRAINER_TIPS), T`Il tuo livello di Conoscenza è ${level()}. Continua così!`], n.name);
  }
}

async function resident(n: NpcDef) {
  const r = RESIDENT_BY_ID[String(n.data?.rid)];
  if (!r) return say('...', n.name);
  const who = `${r.name} · ${r.role}`;
  const first = !S.tipsHeard.includes(r.id);
  const visits = S.npcMemory[r.id] ?? 0;
  S.npcMemory[r.id] = visits + 1;
  // storie a tappe: se l'abitante ha una richiesta in corso, viene prima del consiglio
  if (await questTalk(r.id, who)) return;
  if (first) {
    await say(r.lines, who);
    S.tipsHeard.push(r.id);
    S.stats.xp += 5;
    toast(T`Lezione annotata nell'Investidex (${S.tipsHeard.length}/${ALL_RESIDENTS.length})`);
    track('tip');
    return;
  }
  // dialoghi che ricordano: la seconda volta ripete, dalla terza commenta i tuoi progressi
  const extra = memoryLine(r.id, visits);
  await say(extra ? [extra, T('Comunque, te lo ripeto volentieri:'), ...r.lines] : [T('Ti ripeto volentieri quello che ti ho detto:'), ...r.lines], who);
}

/** Una frase che dipende da quante volte ci siamo parlati e da cosa è successo nel frattempo. */
function memoryLine(id: string, visits: number): string {
  const seen = S.npcMemory[`${id}_b`] ?? 0;
  if (S.badges > seen) { S.npcMemory[`${id}_b`] = S.badges; if (visits > 0) return S.badges === 1 ? T('Ho saputo della tua prima Medaglia. Complimenti!') : T`Ho saputo che hai già ${S.badges} Medaglie. Che strada hai fatto!`; }
  // il grado di Reputazione cambia il saluto: la prima volta che ti vedono con un grado nuovo, lo notano
  const tier = repTier().index;
  if (tier > (S.npcMemory[`${id}_t`] ?? 0)) { S.npcMemory[`${id}_t`] = tier; if (visits > 0) return repGreeting(); }
  if (visits === 1) return T('Di nuovo tu! Sei tornat{o|a} a trovarmi.');
  if (S.title && visits % 3 === 2) return T`Dicono che ora ti chiamano «${T(S.title)}».`;
  if (S.daily.streak >= 3 && visits % 3 === 0) return T`Ho sentito che rispondi alla domanda del giorno da ${S.daily.streak} giorni di fila. Brav{o|a}!`;
  if (visits >= 4) return T`Ci siamo già parlati ${visits} volte, non te lo dimenticare!`;
  return '';
}

export function questionsFor(topic: Parameters<typeof byTopic>[0]): Question[] { return byTopic(topic); }
export { hasTech, TECH };

export type { WorldApi } from './common';
export { retryUnlocked } from './common';
export { allStudentsBeaten } from './duels';
export { librarySection, travelTo, onEnterTown } from './places';
export { momIntro } from './story';
