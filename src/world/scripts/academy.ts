// Accademia di Wall Street: si sale dalla Torre delle Sfide, quindi solo da Campione. Tre scaffali (derivati e opzioni,
// come funziona il mercato, il mestiere del trader) e tre Tutor. Un Tutor sfida solo chi ha aperto i libri del suo
// tema (la regola di sempre: si chiede solo ciò che è stato spiegato), a livello del fine gioco, senza perdere Fiducia.
import type { NpcDef } from '../maps';
import type { QuizTopic } from '../../types';
import { S, save } from '../../systems/state';
import { say, choose, toast } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { pickQuestions, endgameDiff, topicOpened, ACADEMY_TOPICS } from '../../systems/quiz';
import { booksFor, TOPIC_LABEL } from '../../data/books';
import { DUEL, REWARD } from '../../systems/balance';
import { beep } from '../../systems/audio';
import { pick } from '../../systems/rng';
import { reward, lockRetry, clearRetry, retryUnlocked, withPreviousMistakes, type WorldApi } from './common';
import { T } from '../../i18n';

/** Flag del Tutor battuto: `academy_<tema>`. */
export const academyFlag = (t: QuizTopic) => `academy_${t}`;
export const academyDone = () => ACADEMY_TOPICS.every((t) => !!S.flags[academyFlag(t)]);

const LINES: Record<string, string> = {
  derivati: T('Opzioni e future sono strumenti potenti e pericolosi: prima si capisce come funzionano, poi si decide se usarli. Spesso la risposta è no.'),
  mercato: T('Dietro ogni prezzo c\'è un libro di ordini, qualcuno che compra e qualcuno che vende. Chi lo capisce sa che cosa paga davvero.'),
  trading: T('Il mestiere del trader non è indovinare: è decidere prima quanto rischiare, e rispettarlo quando fa male.'),
};

export async function tutor(n: NpcDef, w: WorldApi) {
  const topic = String(n.data?.topic) as QuizTopic;
  const who = n.name;
  const label = TOPIC_LABEL[topic];
  const flag = academyFlag(topic);
  if (S.flags[flag]) {
    const pages = booksFor([topic]).flatMap((b) => b.pages);
    return say([T('La mia prova l\'hai già superata. Un appunto da rileggere, però, te lo lascio volentieri:'), pick(pages)], who);
  }
  if (!topicOpened(topic)) {
    return say([LINES[topic] ?? '', T`Qui si discute di «${label}». I libri sono sullo scaffale qui vicino: leggine almeno uno, poi torna da me.`, T('In Accademia vale la regola di sempre: si chiede solo ciò che è stato spiegato.')], who);
  }
  const key = `tutor_${topic}`;
  if (!retryUnlocked(key)) return say([T('Prima di riprovare, ripassa.'), T`Rileggi i libri di «${label}» sullo scaffale: le domande che hai sbagliato torneranno.`], who);
  const c = await choose([T('Accetto la prova'), T('Non ancora')], { cancel: true, prompt: T`${LINES[topic] ?? ''} Otto domande su «${label}», al livello del fine gioco. Qui non perdi Fiducia: se sbagli, rileggi e torni.`, who });
  if (c !== 0) return;
  const P = DUEL.tutor;
  const qs = withPreviousMistakes(key, pickQuestions([topic], P.n, { target: endgameDiff() }));
  const r = await runDuel({ foeName: who, foeTitle: T('Tutor dell\'Accademia'), foePal: n.pal, questions: qs, ...P, arena: 'biblioteca' });
  if (!r.win) {
    lockRetry(key, r.wrong);
    await say([T('Non ancora. Non ti dico le risposte: le trovi nei libri.'), T`Rileggi «${label}» sullo scaffale e torna quando vuoi.`], who);
    w.refresh();
    return;
  }
  clearRetry(key);
  reward({ flag, rep: REWARD.rep.academy, xp: REWARD.xp.academy, event: 'lesson', save: false });
  beep('win');
  await say([T`Prova superata: «${label}» non ha più segreti per te.`, T('Ricorda però che saperlo spiegare non vuol dire doverlo usare.')], who);
  if (academyDone()) {
    S.flags.academyAll = true;
    beep('badge');
    toast(T('Accademia di Wall Street completata!'));
    await say([T('Hai superato tutti e tre i Tutor dell\'Accademia.'), T('Da oggi puoi fregiarti del titolo di Accademico: lo trovi tra i titoli della tua scheda.')], T('Rettrice dell\'Accademia'));
  }
  w.refresh();
  save();
}

/** La Rettrice all'ingresso: spiega l'Accademia e dice a che punto sei. */
export async function rector(_n: NpcDef) {
  const done = ACADEMY_TOPICS.filter((t) => S.flags[academyFlag(t)]).length;
  await say([
    T('Benvenut{o|a} all\'Accademia di Wall Street. Qui si studia ciò che va oltre l\'investimento di tutti i giorni: derivati, meccanica del mercato e mestiere del trader.'),
    T('Ogni scaffale ha i suoi libri; accanto a ogni scaffale c\'è un Tutor. Leggi, poi mettiti alla prova: niente Fiducia in gioco.'),
    T`Prove superate: ${done} su ${ACADEMY_TOPICS.length}.`,
    T('Ricorda: qui si impara a capire questi strumenti, non a usarli. Gli avvisi dei broker lo dicono chiaro: la maggior parte dei piccoli investitori che usa i CFD perde denaro.'),
  ], T('Rettrice dell\'Accademia'));
}
