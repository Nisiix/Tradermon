// Storie a tappe degli abitanti: piccole missioni che insegnano un concetto attraverso le persone del posto.
// Le ricompense sono punti Conoscenza e oggetti per la casa: mai Crediti.
import { S, save } from '../systems/state';
import { say, choose, toast } from '../ui/core';
import { track } from '../systems/progress';
import { jingle } from '../systems/music';
import { runDuel } from '../ui/battle';
import { pickQuestions, targetDiff, storyStage } from '../systems/quiz';
import { RESIDENT_BY_ID } from '../data/residents';
import { LESSONS } from '../data/lessons';
import type { GameEvent } from '../systems/progress';
import type { QuizTopic } from '../types';
import { T } from '../i18n';

export interface QuestStep {
  /** Cosa dice chi dà la missione quando la tappa inizia (e se torni senza averla finita). */
  say: string[];
  kind: 'talk' | 'lesson' | 'event' | 'badge' | 'duel';
  target?: string;
  need?: number;
  /** Frase che dice l'abitante da cercare, al posto del suo consiglio. */
  targetLine?: string[];
  topics?: QuizTopic[];
  done: string[];
}
export interface Quest { id: string; giver: string; title: string; steps: QuestStep[]; xp: number; decor?: string }

export const QUESTS: Quest[] = [
  {
    id: 'q_fondo', giver: 'eleonora', title: T('Il fondo di Pasquale'), xp: 80, decor: 'radio',
    steps: [
      { kind: 'talk', target: 'pasquale', say: [T('Posso chiederti una mano? Mio marito Pasquale vuole investire anche i soldi del nostro fondo di emergenza.'), T('A me non dà retta. Potresti parlargli tu? È qui in casa.')],
        targetLine: [T('Ti manda Eleonora, vero? Lo so, lo so: il fondo di emergenza resta sul conto.'), T('Dille che investirò solo quello che avanza, un po\' alla volta.')],
        done: [T('Gli hai parlato? Grazie di cuore. Da te lo accetta, da me no!')] },
      { kind: 'event', target: 'checkup', need: 1, say: [T('Ora fammi un altro favore: vai in Banca e fai un check-up del tuo portafoglio.'), T('Guarda quanta liquidità tieni da parte: quella è la tua rete di sicurezza.')],
        done: [T('Visto? Tenere liquidità non è pigrizia, è sicurezza.')] },
      { kind: 'lesson', target: 'l_rischio_1', say: [T('Ultima cosa: leggi la lezione "Rischio e rendimento", in Biblioteca o dal menu.'), T('Così capirai perché il fondo di emergenza viene prima di tutto.')],
        done: [T('Perfetto. Adesso sai che si investe solo ciò che non serve nei prossimi mesi.'), T('Tieni, questa vecchia radio: la ascoltavo quando mettevo da parte i primi risparmi.')] },
    ],
  },
  {
    id: 'q_azione', giver: 'noemi', title: T('Cos\'è davvero un\'azione'), xp: 60,
    steps: [
      { kind: 'event', target: 'tip', need: 3, say: [T('Tu sai cosa fanno i grandi con i soldi? Io voglio capirlo!'), T('Vai a chiedere a tre vicini cosa fanno con i loro risparmi, poi torna a raccontarmelo.')],
        done: [T('Quindi ognuno fa una cosa diversa? Che confusione... ma che bello!')] },
      { kind: 'duel', topics: ['regole', 'rischio'], say: [T('Adesso ti faccio io tre domande, come fanno i grandi. Pront{o|a}?')],
        done: [T('Sei bravissim{o|a}! Quando sarò grande voglio capire i mercati come te.')] },
    ],
  },
  {
    id: 'q_liquidita', giver: 'gennaro', title: T('La barca di Gennaro'), xp: 100, decor: 'aquarium',
    steps: [
      { kind: 'talk', target: 'rosa', say: [T('Devo cambiare il motore della barca e mi servono i soldi tra due settimane.'), T('Rosa dice che non dovrei vendere le azioni in fretta. Chiedile perché, io non ho capito.')],
        targetLine: [T('Gennaro ti ha mandato per il motore? Guarda: vendere di fretta vuol dire accettare il prezzo che c\'è, non quello che vorresti.'), T('Le spese che sai già di avere vanno tenute in liquidità, non in azioni.')],
        done: [T('Ah, ecco: le spese programmate vanno tenute liquide. Rosa ha sempre ragione.')] },
      { kind: 'event', target: 'checkup', need: 1, say: [T('Fammi vedere come fai tu: vai in Banca e controlla quanta liquidità hai per le spese dei prossimi mesi.')],
        done: [T('Brav{o|a}. Chi pesca sa che il mare non si comanda: nemmeno il mercato.')] },
      { kind: 'badge', need: 2, say: [T('Torna a trovarmi quando avrai due Medaglie: voglio vedere se la lezione ti è rimasta.')],
        done: [T('Due Medaglie! Tieni, l\'acquario del mio vecchio negozio: ricorda che i pesci, come i risparmi, vanno tenuti nell\'acqua giusta.')] },
    ],
  },
  {
    id: 'q_pac', giver: 'giorgio', title: T('Il piano di Giorgio'), xp: 100,
    steps: [
      { kind: 'talk', target: 'annalisa', say: [T('Ogni mese metto 100 $ nel mio piano di accumulo, ma non so quanto diventeranno.'), T('Annalisa, la maestra qui accanto, conosce un trucco per calcolarlo. Chiediglielo per me.')],
        targetLine: [T('Giorgio vuole sapere del raddoppio? Regola del 72: dividi 72 per il rendimento annuo e ottieni gli anni per raddoppiare.'), T('Al 6% servono circa 12 anni. Diglielo tu, a me non crede!')],
        done: [T('Dodici anni per raddoppiare al 6%? Quindi più presto comincio, meglio è.')] },
      { kind: 'event', target: 'minigame', need: 1, say: [T('Fammi un favore: prova il minigioco "Corsa dell\'interesse composto" in Biblioteca o nella Zona Simulazione.'), T('Voglio sapere se i conti di Annalisa tornano davvero.')],
        done: [T('Tornano! Allora continuo con il mio piano, un mese alla volta. Grazie.')] },
    ],
  },
  {
    id: 'q_diario', giver: 'gloria', title: T('Il quaderno di Gloria'), xp: 120,
    steps: [
      { kind: 'event', target: 'journal', need: 2, say: [T('Io annoto il perché di ogni operazione in un quaderno. Prova anche tu: dopo due operazioni scrivi il motivo nel Diario.'), T('Vale anche per il conto di prova: conta il metodo, non i soldi.')],
        done: [T('Due righe scritte? Rileggile tra 30 giorni: lì si impara davvero.')] },
      { kind: 'lesson', target: 'l_bias_2', say: [T('Ora leggi "FOMO, gregge ed eccesso di fiducia": sono i tre motivi più frequenti nel mio quaderno... purtroppo.')],
        done: [T('Ecco: la prossima volta che ti viene voglia di comprare perché "sale", riconoscerai il nome dell\'emozione.')] },
      { kind: 'duel', topics: ['bias'], say: [T('Ultima prova: tre domande sui bias. Se le superi, il quaderno ti ha insegnato qualcosa.')],
        done: [T('Promoss{o|a} a pieni voti! Il quaderno è la medicina più economica che esista.')] },
    ],
  },
  {
    id: 'q_bolle', giver: 'ottavio', title: T('Le bolle di nonno Ottavio'), xp: 150, decor: 'painting',
    steps: [
      { kind: 'talk', target: 'ornella', say: [T('Ho visto tre bolle scoppiare in vita mia. La gente dice sempre "stavolta è diverso".'), T('Vai a parlare con Ornella, a Interessa, la quarta città: lei ha provato a indovinare il momento giusto, e ti racconterà com\'è andata.')],
        targetLine: [T('Ti manda Ottavio? Sì, ho provato per anni a entrare e uscire dal mercato al momento giusto.'), T('Risultato: ho perso i giorni migliori, che arrivano quasi sempre subito dopo i peggiori. Diglielo al vecchio brontolone.')],
        done: [T('Vedi? Nemmeno un\'ex croupier riesce a indovinare il tempo del mercato.')] },
      { kind: 'talk', target: 'livio', say: [T('Ora cerca Livio, qui in città. Lui ha usato la leva durante l\'ultima bolla.')],
        targetLine: [T('Ottavio ti ha raccontato delle bolle? Io ci ho messo la leva sopra: con i CFD ho perso in due mesi ciò che avevo messo via in sei anni.'), T('La leva moltiplica le perdite esattamente come i guadagni. Non dimenticarlo.')],
        done: [T('La leva nelle bolle: benzina sul fuoco. Hai imparato più tu in un pomeriggio che molti in dieci anni.')] },
      { kind: 'event', target: 'legend', need: 1, say: [T('Ora vai alla Torre delle Sfide di Wall Street e supera una crisi leggendaria. Poi torna a raccontarmela.')],
        done: [T('Ce l\'hai fatta. Tieni questo quadro: l\'ho dipinto dopo la crisi del 2008, per ricordarmi che dopo la tempesta torna il sole.')] },
    ],
  },
];

function baseKey(q: Quest, i: number) { return `qb_${q.id}_${i}`; }
function talkKey(q: Quest, i: number) { return `qt_${q.id}_${i}`; }

function startStep(q: Quest, i: number) {
  const st = q.steps[i];
  if (st.kind === 'event') S.flags[baseKey(q, i)] = S.counters[st.target as GameEvent] ?? 0;
}

function stepDone(q: Quest, i: number): boolean {
  const st = q.steps[i];
  switch (st.kind) {
    case 'talk': return !!S.flags[talkKey(q, i)];
    case 'lesson': return S.lessonsRead.includes(st.target!);
    case 'event': return ((S.counters[st.target as GameEvent] ?? 0) - Number(S.flags[baseKey(q, i)] ?? 0)) >= (st.need ?? 1);
    case 'badge': return S.badges >= (st.need ?? 1);
    default: return false;
  }
}

/** Testo "dove siamo" per l'agenda e il profilo. */
export function activeQuests(): { quest: Quest; step: QuestStep; i: number }[] {
  return QUESTS.filter((q) => S.quests[q.id] !== undefined && S.quests[q.id] < q.steps.length).map((q) => ({ quest: q, step: q.steps[S.quests[q.id]], i: S.quests[q.id] }));
}

/**
 * Chiamata quando parli con un abitante. Restituisce true se il dialogo della storia ha sostituito quello normale.
 * - Se l'abitante è il bersaglio di una tappa in corso, dice la sua frase e la tappa è fatta (poi segue il consiglio normale).
 * - Se è chi dà la storia, la avvia o la porta avanti.
 */
export async function questTalk(rid: string, who: string): Promise<boolean> {
  for (const q of QUESTS) {
    const i = S.quests[q.id];
    if (i === undefined || i >= q.steps.length) continue;
    const st = q.steps[i];
    if (st.kind === 'talk' && st.target === rid && !S.flags[talkKey(q, i)]) {
      S.flags[talkKey(q, i)] = true;
      await say(st.targetLine ?? ['...'], who);
      toast(T`Storia "${q.title}": torna da ${RESIDENT_BY_ID[q.giver]?.name ?? q.giver}.`);
      save();
      return false;
    }
  }
  const q = QUESTS.find((x) => x.giver === rid);
  if (!q) return false;
  const i = S.quests[q.id];
  if (i === undefined) {
    if (!S.tipsHeard.includes(rid)) return false; // prima il consiglio, poi la storia
    const ok = (await choose([T('Volentieri'), T('Un\'altra volta')], { prompt: T`${RESIDENT_BY_ID[rid]?.name ?? who} vorrebbe chiederti un favore. Lo ascolti?`, who })) === 0;
    if (!ok) return true;
    S.quests[q.id] = 0;
    startStep(q, 0);
    await say(q.steps[0].say, who);
    toast(T`Nuova storia: "${q.title}". La trovi nell'Agenda.`);
    save();
    return true;
  }
  if (i >= q.steps.length) return false;
  const st = q.steps[i];
  let done = stepDone(q, i);
  if (st.kind === 'duel') {
    const ok = (await choose([T('Sono pront{o|a}'), T('Più tardi')], { prompt: st.say[0], who })) === 0;
    if (!ok) return true;
    const qs = pickQuestions(st.topics ?? ['regole'], 3, { target: Math.min(2.5, targetDiff(storyStage())) });
    const prevFid = S.stats.fiducia;
    const r = await runDuel({ foeName: RESIDENT_BY_ID[rid]?.name ?? who, foeTitle: q.title, foePal: RESIDENT_BY_ID[rid]?.pal ?? 0, questions: qs, need: 2, damage: 1 });
    S.stats.fiducia = prevFid;
    done = r.win;
    if (!done) { await say(T('Quasi! Ripassa un po\' e torna da me.'), who); return true; }
  }
  if (!done) {
    const hint = st.kind === 'lesson' ? T` (lezione: "${LESSONS.find((l) => l.id === st.target)?.title ?? st.target}")` : '';
    await say([...st.say, T`Ci sei quasi?${hint}`].slice(0, 3), who);
    return true;
  }
  await say(st.done, who);
  const next = i + 1;
  S.quests[q.id] = next;
  if (next < q.steps.length) {
    startStep(q, next);
    await say(q.steps[next].say, who);
  } else {
    S.stats.xp += q.xp;
    if (q.decor && !S.decor.includes(q.decor)) S.decor.push(q.decor);
    jingle('quest');
    toast(T`Storia completata: "${q.title}" · +${q.xp} Conoscenza${q.decor ? T(' · nuovo oggetto per la casa') : ''}`);
    track('quest');
  }
  save();
  return true;
}
