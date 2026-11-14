// Duelli di conoscenza e missioni: allenatori, allievi, Whale, Wall Street, Torre, eremiti, duelli condivisi e del giorno.
import { recordMission, mirrorEpilogue } from '../../systems/mirror';
import { getMap, townOf, type NpcDef } from '../maps';
import { S, save, slots, addRep, card, learnBias, clampStat, classes, newGamePlus } from '../../systems/state';
import { say, choose, modal } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { runSim } from '../../ui/timemachine';
import { runPick } from '../../ui/pick';
import { pickQuestions, pickCaveQuestions, studiedTopics, SHARED_TOPICS, dailyQuestion, todayKey, reviewQueue, targetDiff, storyStage, STAGE_LEAGUE, endgameDiff, MAX_DIFF } from '../../systems/quiz';
import { mentorTopics, trackTopics, LEAGUE_TOPICS } from '../../data/quiz/build';
import { mentor, LEAGUE, antagonist, TOWNS, TRAINER_TIPS } from '../../data/story';
import { mentorBooks, booksFor, TOPIC_LABEL, BOOK_BY_ID } from '../../data/books';
import { DUEL, REWARD, TRAIT_HIGH } from '../../systems/balance';
import { errorsAllowed, errorsLeft } from '../../systems/duelLife';
import { mentorCharacterLine, epilogue } from '../../systems/character';
import { mentorMission, processReview, leagueMission, LEGENDS, SANDBOX, type Mission } from '../../data/missions';
import { unlockedAssets } from '../../data/assets';
import { TEMPTATIONS, BIAS_INFO } from '../../data/events';
import { PAL } from '../../art/art';
import { beep } from '../../systems/audio';
import { pick, shuffle, mulberry32 } from '../../systems/rng';
import { track } from '../../systems/progress';
import { LESSONS } from '../../data/lessons';
import { jingle } from '../../systems/music';
import { ABILITY, SWIM_BADGE, TRANSFER_BADGE } from '../travel';
import { HERMITS } from '../maps';
import { reward, routeStage, afterDuel, defeatRespawn, lockRetry, clearRetry, retryUnlocked, withPreviousMistakes } from './common';
import type { WorldApi } from './common';
import { credits } from './places';
import * as Acc from '../../systems/account';
import { requireAccount, nextSealLine, chooseDifficulty, applyDifficulty } from '../../ui/broker';
import { leagueTrial, runTrial, type Trial } from '../../systems/trials';
import { bossMenu } from '../../ui/boss';
import { trade } from '../../ui/clinic';
import { STAGE_TOOL } from '../../systems/balance';
import { tick } from '../../systems/account';
import { CAVES, CAVE_TIPS, caveOf } from '../caves';
import type { Arena } from '../../ui/arena';
import type { Question, QuizTopic } from '../../types';
import { T } from '../../i18n';

export async function trainer(n: NpcDef, w: WorldApi) {
  // una sfida sola: battuto, l'investitore non ti viene più incontro e ti parla solo del posto in cui siete
  if (S.defeated.includes(n.id)) return placeTalk(n.name, T('La nostra sfida l\'abbiamo già fatta.'));
  await say(n.lines ?? [T('Sfida!')], n.name);
  // lungo la strada si chiede solo ciò che è già stato spiegato: Whale battute e argomenti già aperti in Biblioteca
  const topics = studiedTopics();
  const target = targetDiff(routeStage(n));
  // in grotta gli sfidanti chiedono le cose della grotta, e prima di tutto quelle che non hai ancora visto
  const cave = caveOf(S.map);
  // sfidanti della grotta ancora da battere (questo compreso): le domande mai viste si dividono tra loro
  const left = cave ? CAVES[cave].maps.flatMap((m) => getMap(m).npcs).filter((x) => x.kind === 'trainer' && !S.defeated.includes(x.id)).length : 1;
  const qs = cave ? pickCaveQuestions(CAVES[cave].quiz, DUEL.trainer.n, target, topics, Math.random, left) : pickQuestions(topics, DUEL.trainer.n, { preferReview: true, target });
  const r = await runDuel({ foeName: n.name, foeTitle: cave ? CAVES[cave].name : undefined, foePal: n.pal, questions: qs, ...DUEL.trainer, ...(cave ? { arena: 'grotta' as const } : {}) });
  await afterDuel(r.win, n.id, REWARD.rep.trainer, w, n.name, cave ? pick(CAVE_TIPS[cave]) : undefined);
}

/**
 * Dopo il primo incontro con uno speculatore il gioco spiega come si riconosce una truffa: le due lezioni su regole e
 * truffe vengono lette lì, una volta sola. Da quel momento gli speculatori possono interrogare anche su quelle.
 */
async function scamLesson() {
  const ls = LESSONS.filter((l) => l.topic === 'regole' && !S.lessonsRead.includes(l.id));
  if (!ls.length || S.flags.scamLesson) return;
  S.flags.scamLesson = true;
  await say([T('Da questo incontro impari qualcosa che vale più di un guadagno facile: come si riconosce una truffa.'), ...ls.flatMap((l) => l.body), T('Le ritrovi tra le Lezioni di ogni Biblioteca, e nello scaffale «Regole e truffe» ci sono i libri per approfondire.')], T('Narratore'));
  for (const l of ls) { S.lessonsRead.push(l.id); S.stats.xp += 5; }
  track('lesson');
}

export async function speculator(n: NpcDef, w: WorldApi) {
  const ant = antagonist(S.track);
  if (n.data?.boss) {
    await say([T`Così sei tu che ostacoli ${ant.team}!`, T`Io sono ${ant.boss}. Ti offro un affare: unisciti a noi e guadagnerai senza studiare.`], ant.boss);
    const c = await choose([T('Mai!'), T('Dimmi di più...')], { prompt: T('Cosa rispondi?') });
    if (c === 1) { clampStat('disciplina', -10); await say(T('Ah ah! Ti piacerebbe, eh? Ma prima dovrai battermi.'), ant.boss); }
    await scamLesson();
    // la gestione del rischio è della Whale successiva: entra solo se è già stata aperta in Biblioteca
    const studied = studiedTopics();
    const qs = pickQuestions((['regole', 'gestione', 'bias'] as QuizTopic[]).filter((t) => studied.includes(t)), DUEL.boss.n, { target: targetDiff(routeStage(n) + 1) });
    const r = await runDuel({ foeName: ant.boss, foeTitle: T`Capo ${ant.of}`, foePal: PAL.SPEC, questions: qs, ...DUEL.boss, arena: 'fossa' });
    if (r.win) {
      reward({ defeated: n.id, rep: REWARD.rep.boss }); clampStat('disciplina', 10);
      await say([T('Impossibile... Le scorciatoie non funzionano con te.'), T('Ci ritiriamo. Per ora.')], ant.boss);
    } else await defeatRespawn(w);
    w.refresh();
    return;
  }
  const t = pick(TEMPTATIONS);
  await say([T`Psst! Faccio parte ${ant.of}.`, t.text], T('Speculatore'));
  // con Disciplina alta si riconosce la trappola e la si smaschera davanti a tutti
  const unmask = S.stats.disciplina >= TRAIT_HIGH;
  const c = await choose(unmask ? [T('Rifiuto'), T('Accetto'), T('Smaschero la truffa (Disciplina)')] : [T('Rifiuto'), T('Accetto')], { prompt: T('Cosa fai?') });
  if (c === 2) {
    learnBias(t.bias); reward({ rep: REWARD.rep.temptation });
    await say([T`Conosco questo trucco: fa leva sul bias «${BIAS_INFO[t.bias].name}». ${BIAS_INFO[t.bias].effect}`, T('Chi ti promette guadagni facili sta vendendo a te, non per te.')], 'Tu');
    await say(T('Uff... Hai la testa fredda, eh? Vediamo se sai anche rispondere!'), T('Speculatore'));
  } else if (c === 0) { clampStat('disciplina', 5); await say(t.refuse, 'Tu'); }
  else {
    // nessuna perdita applicata al conto: è una lezione, non una penalità sul patrimonio
    clampStat('disciplina', -8);
    learnBias(t.bias);
    await say([t.accept, T`Nella realtà avresti potuto perdere circa il ${Math.round(t.loss * 100)}% della liquidità. Questa trappola si chiama ${BIAS_INFO[t.bias].name}: ${BIAS_INFO[t.bias].effect}`], T('Narratore'));
  }
  await scamLesson();
  if (c !== 2) await say(T('Grr! Allora vediamo se sai anche rispondere!'), T('Speculatore'));
  const qs = pickQuestions(studiedTopics(), DUEL.speculator.n, { target: targetDiff(routeStage(n)) });
  const r = await runDuel({ foeName: T('Speculatore'), foeTitle: ant.name, foePal: PAL.SPEC, questions: qs, ...DUEL.speculator, arena: 'fossa' });
  await afterDuel(r.win, n.id, REWARD.rep.speculator, w, T('Speculatore'));
}

/** Nessuno salta gli allievi: la Whale si sfida solo dopo averli battuti tutti. */
export function allStudentsBeaten(m: number): boolean {
  return getMap(`academy_${m}`).npcs.filter((x) => x.kind === 'student').every((x) => S.defeated.includes(x.id));
}

export async function student(n: NpcDef, w: WorldApi) {
  const m = n.data?.n as number;
  if (S.defeated.includes(n.id)) return placeTalk(n.name, S.badges >= m ? T('La nostra sfida l\'abbiamo già fatta.') : T('La nostra sfida l\'abbiamo già fatta. La Whale è là in fondo: buona fortuna!'));
  await say(T('Prima di arrivare alla Whale devi superare me!'), n.name);
  // gli allievi sono un gradino sotto la loro Whale
  const qs = pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.student.n, { target: targetDiff(m - 1) - 0.25 });
  const r = await runDuel({ foeName: n.name, foeTitle: T('Allievo dell\'Exchange'), foePal: n.pal, questions: qs, ...DUEL.student, arena: 'aula' });
  tick();
  if (r.win) { reward({ defeated: n.id, rep: REWARD.rep.student }); await say(T('Brav{o|a}! Sei pront{o|a} per la Whale.'), n.name); }
  else { await say(T('Studia in Biblioteca e torna!'), n.name); await defeatRespawn(w); }
}

// ---------------- Whale ----------------

export async function mentorBattle(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  // vecchi salvataggi: il duello era già vinto ma la Medaglia arrivava solo dopo la missione
  if (S.badges === m - 1 && S.flags[`m${m}_p1`]) { await say(T('Il duello l\'avevi già vinto: l\'Attestato è tuo.'), md.name); await winBadge(m, w); }
  if (S.badges >= m) {
    // Medaglia completa: la Whale non si risfida, ti parla dell'argomento del suo Exchange
    if (S.seals >= m) return placeTalk(md.name, T`Hai già la ${md.badge}, Attestato e Sigillo.`);
    return sealChallenge(m, w);
  }
  if (S.badges < m - 1) return say([T('Sei arrivat{o|a} qui troppo presto!'), T`Prima ti serve l'Attestato della Whale ${S.badges + 1}.`], md.name);
  if (!allStudentsBeaten(m)) return say([T('Benvenut{o|a} nel mio Exchange.'), T('Prima di sfidarmi devi battere tutti i miei allievi.')], md.name);
  // la regola della Medaglia la spiega la prima Whale, quando serve; gli altri non la ripetono
  await say([md.intro, ...(m > 1 || S.flags.medalRule ? [] : [T('Da me si guadagnano due cose. L\'Attestato si vince qui, con un duello di conoscenza, e ti apre la strada verso la città successiva.'), T('Il Sigillo pratico si guadagna dopo, con la Prova sul conto: ordini veri sul mercato di oggi, dal tuo conto di gioco, usando ciò che ti ho appena insegnato. Puoi viaggiare con i soli Attestati, ma entri a Wall Street solo se hai tutti e otto i Sigilli.')])], md.name);
  S.flags.medalRule = true;
  const unread = mentorBooks(m, S.track, S.mixedClasses).filter((b) => !S.booksRead.includes(b.id)).length;
  if (unread) await say([T`Un consiglio da Whale: nella Biblioteca di ${TOWNS[m]?.name ?? T('questa città')} c'è la mia sezione, con i libri su ${mentorTopics(m, S.track, S.mixedClasses).map((t) => `«${TOPIC_LABEL[t]}»`).join(' e ')}.`, T('Le domande del duello vengono da lì.')], md.name);
  // dopo una sconfitta si torna solo dopo aver studiato: un libro della sezione o un ripasso in Biblioteca
  if (!retryUnlocked(`m${m}`)) return say([T('Sei tornat{o|a} presto. Prima di riprovare, studia.'), T`Leggi un libro della mia sezione nella Biblioteca di ${TOWNS[m]?.name ?? T('questa città')}, oppure fai il Ripasso: le domande che hai sbagliato sono lì ad aspettarti.`], md.name);
  {
    const conc = errorsAllowed(DUEL.mentor.n, DUEL.mentor.need), left = errorsLeft(S.stats.fiducia, 0, DUEL.mentor.n, DUEL.mentor.need);
    if (left < conc) await say([T`La tua Fiducia è a ${S.stats.fiducia}: ti basta per ${left === 1 ? T('un solo errore') : left === 0 ? T('nessun errore') : `${left} errori`} invece dei ${conc} concessi. Se arriva a zero durante il duello vai in tilt.`, T('In Banca puoi ricaricare il credito di Fiducia prima di iniziare.')], md.name);
  }
  const ok = (await choose([T('Sono pront{o|a}!'), T('Non ancora')], { prompt: T('Iniziamo?') })) === 0;
  if (!ok) return;
  // la Whale m si affronta con m − 1 Attestati: dal livello 1 (Whale 1) a quasi 3 (Whale 8)
  const qs = withPreviousMistakes(`m${m}`, pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.mentor.n, { target: targetDiff(m - 1) }));
  const r = await runDuel({ foeName: md.name, foeTitle: T`Whale ${m}`, foePal: md.palette, questions: qs, ...DUEL.mentor, intro: md.intro, arena: 'sala' });
  tick();
  if (!r.win) { lockRetry(`m${m}`, r.wrong); await say([T('Non ancora. Ripassa e torna: ti aspetto.'), T('Le domande che hai sbagliato torneranno nel prossimo duello.')], md.name); return defeatRespawn(w); }
  clearRetry(`m${m}`);
  S.flags[`m${m}_p1`] = true;
  S.flags[`m${m}_perfect`] = r.perfect;
  await winBadge(m, w);
  const go = await choose([T('Vediamo la Prova sul conto'), T('Più tardi')], { prompt: T('Ottimo duello! Vuoi vedere adesso la parte pratica per il Sigillo?'), who: md.name });
  if (go === 0) await sealChallenge(m, w);
}

/**
 * Parte pratica della Medaglia: la Prova sul conto, cioè l'esercizio di tappa fatto con ordini veri sul mercato di oggi.
 * Le Whale non propongono replay: i periodi del passato si rivivono solo nella Macchina del Tempo (Zona Simulazione).
 */
/** Promemoria delle sfide sul conto: se con un titolo non ci si arriva, si può vendere e puntare su un altro. */
export const SWITCH_LINE = T('Se con un titolo non riesci ad arrivare all\'obiettivo della Prova puoi venderlo da "Compra / Vendi" e puntare su un altro. Decidere di vendere, anche solo una parte, annulla la Prova: prima della vendita ti viene chiesto di confermare che vendi per annullarla, poi la quota della tappa riparte da zero e la rifai con un altro titolo. Una vendita in perdita resta una perdita vera sul conto di gioco.');
/** Nelle verifiche di Wall Street si guarda il conto com'è: non c'è un titolo della prova, quindi una vendita non annulla nulla. */
export const LEAGUE_SWITCH_LINE = T('Se un titolo non ti porta dove serve puoi venderlo, anche solo in parte, da "Compra / Vendi" e puntare su un altro: qui guardo il conto com\'è, quindi la verifica si rifà semplicemente da capo. Una vendita in perdita resta una perdita vera sul conto di gioco.');

async function sealChallenge(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  if (S.flags.bankrupt) return say([T('Dopo la bancarotta la parte pratica di questa partita è chiusa.'), T('Il tuo Attestato resta valido, e la strada è aperta.')], md.name);
  for (;;) {
    const got = Acc.grantSeals();
    if (got.includes(m)) {
      beep('badge'); jingle('badge');
      await say([T`Prova sul conto superata: ecco il Sigillo pratico. La ${md.badge} adesso è completa!`, m === 8 ? T('Con tutti e otto i Sigilli la Guardia di Wall Street ti lascerà passare.') : T`Sigilli pratici: ${S.seals}/8.`], md.name);
      w.refresh(); save();
      return;
    }
    if (S.seals >= m) return;
    const ex = Acc.exercise();
    const lines = S.seals < m - 1 || ex.stage < m
      ? [T`I Sigilli si prendono in ordine: prima ti serve ${ex.stage === 0 ? T('l\'esercizio della Valigetta') : T`la Prova sul conto della tappa ${ex.stage}`}.`, nextSealLine()]
      : [
        T`Prova sul conto, tappa ${m}: ${STAGE_TOOL[m].text}`,
        T`In tutto servono ${Acc.exNeed(m).toFixed(0)} $ di acquisti sul tuo conto (finora ${ex.got.toFixed(0)} $). È il minimo: se vuoi investire di più, sei liber{o|a} di farlo.`,
        // la spiegazione completa alla prima Prova; dopo basta il promemoria breve
        ...(S.flags.provaRules ? [T('Se vendi il titolo della Prova, anche solo una parte, la Prova si annulla e la rifai con un altro titolo.')] : [T('Sono ordini veri sul mercato di oggi: nessuno ti chiede un rendimento, si guarda il metodo. A mercato chiuso l\'ordine vale quando Alpaca lo accetta e si esegue all\'apertura.'), SWITCH_LINE]),
      ];
    if (!(S.seals < m - 1 || ex.stage < m)) S.flags.provaRules = true;
    const c = await choose([T('Opero adesso'), T('Più tardi')], { cancel: true, prompt: lines.join(' '), who: md.name });
    if (c !== 0) return say(T('Si fa anche da qualsiasi Banca: il Sigillo arriva da solo, non serve tornare qui.'), md.name);
    if (!(await trade())) return;
  }
}

/**
 * Missioni della Macchina del Tempo: i periodi veri del passato legati agli argomenti delle Whale, con i nomi dei
 * titoli nascosti. Si giocano solo qui, nella Zona Simulazione: sono facoltative, non servono né per i Sigilli né
 * per Wall Street, e non toccano il conto. Si sbloccano con l'Attestato della Whale corrispondente.
 */
export async function missionDesk(who = T('Operatrice')) {
  if (S.badges < 1) return say([T('Le missioni della Macchina del Tempo si sbloccano una alla volta, con gli Attestati delle Whale.'), T('Torna dopo il primo Attestato.')], who);
  for (;;) {
    const ms = Array.from({ length: S.badges }, (_, k) => ({ m: k + 1, mission: mentorMission(k + 1, S.track, S.profile) }));
    const label = (x: { m: number; mission: Mission }) => `${x.m}. ${x.mission.title}${S.flags[`m${x.m}_mission`] ? ' ✓' : ''}${x.mission.kind === 'sim' && S.flags[`${x.mission.id}_stars`] ? ' ' + '★'.repeat(Number(S.flags[`${x.mission.id}_stars`])) : ''}`;
    const c = await choose([...ms.map(label), T('Indietro')], { cancel: true, prompt: T('Missioni facoltative su periodi veri del passato. Non valgono per Sigilli e Wall Street e non toccano il tuo conto: qui si sbaglia senza conseguenze.'), who });
    if (c < 0 || c >= ms.length) return;
    const { m, mission } = ms[c];
    if (mission.kind === 'sim' && !(await requireAccount(T('i dati reali della Macchina del Tempo'), who))) continue;
    const res = await runMission(mission);
    if (!res) { await say(T('Missione interrotta. Torna quando vuoi.'), who); continue; }
    if (!res.ok) { await say([T('Stavolta non è riuscita: ') + res.detail, T('Nessun problema: la Macchina del Tempo serve proprio a questo.')], who); continue; }
    if (!S.flags[`m${m}_mission`]) { track('mission'); reward({ flag: `m${m}_mission`, xp: REWARD.xp.badge / 4 }); }
    await say(T('Missione riuscita. Sul conto Paper il passato non si conosce: lì conta lo stesso metodo, sul mercato di oggi.'), who);
  }
}

/** Periodo reale di riserva per le prove che chiedono di reggere un calo; per le altre vale un anno tranquillo. */
const ALT_PERIOD: Record<string, string> = { m6: 'sb_bear', m8: 'sb_storm' };

async function runMission(m: Mission): Promise<{ ok: boolean; detail: string } | null> {
  if (m.kind === 'pick') return runPick(m);
  await say([T('Benvenut{o|a} nella Macchina del Tempo!'), T('Usa il pulsante ▶ per far scorrere i giorni, compra e vendi quando vuoi. I prezzi sono quelli veri di quel periodo, riportati a base 100; i nomi li scoprirai alla fine.')], T('Macchina del Tempo'));
  // dopo tre tentativi falliti sullo stesso periodo si può provare la stessa missione su un altro periodo reale
  const failKey = `${m.id}_fails`;
  let mission = m;
  if (Number(S.flags[failKey] ?? 0) >= 3) {
    const alt = SANDBOX.find((x) => x.id === (ALT_PERIOD[m.id] ?? 'sb_normal'))!;
    const c = await choose([T('Provo su un altro periodo'), T('Resto su questo')], { prompt: T('Hai già tentato tre volte su questo periodo. La stessa prova, con le stesse regole, si può fare su un altro periodo vero di mercato.'), who: T('Macchina del Tempo') });
    if (c === 0) mission = { ...m, scenario: { ...m.scenario, window: alt.window, news: undefined }, brief: T`${m.brief} (Periodo alternativo: le notizie non sono annunciate.)` };
  }
  const r = await runSim({ mission });
  if (!r) return null;
  S.flags[failKey] = r.ok ? 0 : Number(S.flags[failKey] ?? 0) + 1;
  recordMission(m.id, r);
  if (r.ok && r.lossSales === 0 && r.orders > 0) S.flags.missionNoLossSale = true;
  // il processo conta anche se l'obiettivo non è raggiunto: le stelle danno Conoscenza e restano nella Cartella
  const pr = processReview(r);
  const prev = Number(S.flags[`${m.id}_stars`] ?? 0);
  if (pr.stars > prev) { S.flags[`${m.id}_stars`] = pr.stars; reward({ xp: (pr.stars - prev) * REWARD.xp.processStar, save: false }); }
  if (pr.stars === 3) { clampStat('disciplina', 3); clampStat('pazienza', 2); }
  return { ok: r.ok, detail: r.detail };
}

/** Attestato della Whale: apre il mondo (guardie, Tecnica, carte, abilità) e la Prova sul conto della tappa. */
async function winBadge(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  S.badges = m;
  if (!S.techniques.includes(md.technique)) S.techniques.push(md.technique);
  reward({ rep: REWARD.rep.badge, xp: REWARD.xp.badge, save: false });
  // nuove carte sbloccate
  const newCards = unlockedAssets(S.track, S.mixedClasses, m).filter((a) => !S.cards[a.id]);
  newCards.forEach((a) => card(a.id));
  if (S.flags[`m${m}_perfect`]) {
    for (const p of S.portfolio.positions) { const c = card(p.id); if (c.xp >= 80) c.gold = true; }
  }
  beep('badge');
  jingle('badge');
  track('badge');
  await say([md.win, mentorCharacterLine(), T`Hai ottenuto l'Attestato della ${md.badge}!`, T`Nuova Tecnica: ${md.technique}. ${md.techDesc}`, T`Slot di portafoglio: ${slots()}.`, newCards.length ? T`Nuove Asset Card: ${newCards.map((a) => a.name).join(', ')}.` : '',
    S.flags.bankrupt ? '' : T`Si apre la Prova sul conto della tappa ${m}, quella che vale il Sigillo.`].filter(Boolean), md.name);
  const extra: string[] = [];
  if (m === 2) extra.push(T('Con l\'abbonamento al treno puoi viaggiare tra le città visitate dalle stazioni.'));
  if (m === 5) extra.push(T('L\'Archivio di Bilancia ora è aperto. E in Banca puoi sostenere l\'Esame della Leva: per ora vale solo nei replay.'));
  if (m === SWIM_BADGE) extra.push(T`Nuova abilità: ${ABILITY.swim.name}. Cammina verso l'acqua e la attraverserai su una zattera. Sui Percorsi 3, 5 e 7 ci sono isole da raggiungere.`);
  if (m === ABILITY.cut.badge) extra.push(T`Nuova abilità: ${ABILITY.cut.name}. Ora puoi frantumare i Massi delle Commissioni: il primo è sul Percorso 5, davanti al Cippo dei Costi. Più avanti ne troverai altri, anche in fondo alle grotte.`);
  if (m === ABILITY.dark.badge) extra.push(T`Nuova abilità: ${ABILITY.dark.name}. Le grotte buie non ti fermano più: la prima è la Miniera dei Lingotti, a metà del Percorso 6. All'ingresso di ogni grotta c'è una guida: fatti spiegare la grotta e leggi il suo taccuino prima di addentrarti.`);
  if (m === TRANSFER_BADGE) extra.push(T`Nuova abilità: ${ABILITY.transfer.name}. Apri il menu, scegli "Mappa della Regione" e trasferisciti in una città già visitata.`);
  if (m === 8) extra.push(T('Wall Street è oltre il Percorso 9. La Guardia ti fa passare solo se hai tutti e otto i Sigilli pratici. Con l\'ottavo Attestato, se hai superato l\'Esame della Leva, la leva si apre anche sul conto di gioco.'), T('I Superiori di Wall Street interrogano su macroeconomia, analisi e regole: da oggi in ogni Biblioteca trovi la Sezione di Wall Street, con i libri su cui prepararti.'));
  if (extra.length) await say(extra, T('Prof. Saldi (messaggio)'));
  w.refresh();
  save();
}

export async function guard(n: NpcDef, w: WorldApi) {
  const b = n.data?.badge as number;
  if (n.data?.league) await say([T('Alt! Entri a Wall Street solo se hai tutti e otto gli Attestati, ognuno con il suo Sigillo pratico.'), T`Hai ${S.seals} Sigilli su 8. ${nextSealLine()}`, T('A Wall Street i Superiori guardano il tuo conto com\'è, sul mercato di oggi: per questo serve aver fatto pratica con ordini veri.')], n.name);
  else await say([T`Alt! Per proseguire serve l'Attestato della ${mentor(b, S.track).badge}.`, T`Te lo consegna la Whale dell'Exchange di ${TOWNS[b].name}, se vinci il suo duello.`], n.name);
  w.bumpBack();
}

// ---------------- Edifici ----------------

/** Quando torneranno le prossime domande del ripasso. */
function nextReviewLine(): string {
  const next = Object.values(S.reviewDue).filter((d) => d > todayKey()).sort()[0];
  return next ? T`La prossima domanda torna nel ripasso il ${next.split('-').reverse().join('/')}.` : T('Rispondi ai duelli: le domande che incontri entreranno nel ripasso.');
}

export async function reviewDuel() {
  const q = reviewQueue();
  if (!q.length) return say([T('Oggi non hai domande in scadenza. Ottimo lavoro!'), nextReviewLine()], T('Bibliotecaria'));
  const qs = shuffle(q.slice(0, 12)).slice(0, DUEL.review.n);
  const prevFid = S.stats.fiducia;
  await runDuel({ foeName: T('Ripasso'), foeTitle: T('Biblioteca'), foePal: PAL.LIB, questions: qs, need: qs.length, damage: 0, practice: true, arena: 'biblioteca' });
  S.stats.fiducia = prevFid;
  track('review');
  return say([T('Ogni domanda giusta torna più avanti: dopo 1, 3, 7 e poi 21 giorni. Quelle sbagliate tornano subito.'), T('Rivedere al momento giusto è il modo migliore per ricordare.')], T('Bibliotecaria'));
}

export async function daily() {
  const today = todayKey();
  if (S.daily.lastDate === today) return say([T`Hai già risposto alla domanda di oggi. Serie attuale: ${S.daily.streak} giorni.`, T('Torna domani!')], T('Professoressa del giorno'));
  await say(T('Ecco la domanda del giorno!'), T('Professoressa del giorno'));
  const q = dailyQuestion();
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: T('Domanda del giorno'), foePal: 18, questions: [q], need: 1, damage: 0 });
  S.stats.fiducia = prevFid;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.daily.streak = r.win ? (S.daily.lastDate === todayKey(y) ? S.daily.streak + 1 : 1) : 0;
  S.daily.lastDate = today;
  if (r.win) reward({ xp: REWARD.xp.daily + Math.min(REWARD.xp.dailyStreakMax, S.daily.streak * REWARD.xp.dailyStreak), event: 'daily_q', save: false });
  await say(r.win ? T`Serie di ${S.daily.streak} giorni! Bonus di esperienza.` : T('La serie riparte da zero. Domani andrà meglio!'), T('Professoressa del giorno'));
  save();
}

export async function linkDuel() {
  const c = await choose([T('Genera un codice sfida'), T('Inserisci il codice di un amico'), T('Annulla')], { cancel: true, prompt: T('Duello con codice: tu e un amico giocate lo stesso periodo reale di mercato e lo stesso quiz, qualunque sia il vostro percorso.'), who: T('Operatrice') });
  if (c < 0 || c === 2) return;
  let code = '';
  if (c === 0) { code = `TM-${S.track.slice(0, 1).toUpperCase()}${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`; await say([T`Il tuo codice è ${code}. Condividilo con un amico: il quiz è uguale per tutti i percorsi.`, T('Ora gioca tu.')], T('Operatrice')); }
  else {
    const res = await modal<string>(T('Codice sfida'), ({ body, button, close }) => { body.innerHTML = '<input class="tx c" placeholder="TM-L123456">'; button('Ok', () => close((body.querySelector('.c') as HTMLInputElement).value.trim().toUpperCase()), 'primary'); });
    if (!res) return; code = res;
  }
  const seed = Number(code.replace(/\D/g, '')) || 1;
  const rng = mulberry32(seed);
  const qs = pickQuestions(SHARED_TOPICS, 5, { rng, shared: true });
  const prevFid = S.stats.fiducia;
  const q = await runDuel({ foeName: T('Duello con codice'), foePal: 16, questions: qs, need: 5, damage: 0, practice: true });
  S.stats.fiducia = prevFid;
  // stesso periodo reale per tutti: i dati sono gli stessi qualunque conto li scarichi
  const r = await runSim({ scenario: SANDBOX[0], sandbox: true, classes: ['stocks', 'etf'] });
  const score = Math.round(q.correct * 100 + (r ? r.sharpe * 200 - r.mdd * 300 : 0));
  await say([T`Risultato del duello ${code}: ${q.correct}/5 risposte, Sharpe ${r ? r.sharpe.toFixed(2) : '—'}, drawdown ${r ? (r.mdd * 100).toFixed(1) : '—'}%.`, T`Punteggio: ${score}. Confrontalo con quello del tuo amico!`], T('Operatrice'));
}

/**
 * Prova pratica sul conto di gioco: il Superiore guarda il conto com'è adesso, sul mercato di oggi.
 * Chi non la supera opera (ordini veri sul conto Paper) e chiede una nuova verifica, senza rifare il duello.
 */
async function accountTrial(t: Trial, who: string): Promise<boolean> {
  if (!(await requireAccount(T('la prova pratica di Wall Street'), who))) return false;
  await say([`${t.title}. ${t.brief}`, T('Guardo il tuo conto di gioco com\'è adesso, sul mercato di oggi. Non ti chiedo un rendimento: quello non lo controlla nessuno. Ti chiedo metodo.')], who);
  for (;;) {
    await Acc.sync(true).catch(() => []);
    const r = runTrial(t);
    const lines = r.checks.map((c) => T`${c.ok ? '✓' : '✗'} ${c.label} (ora: ${c.now})`);
    if (r.ok) { await say([T('Controllo il conto…'), ...lines, T('Tutto in ordine.')], who); return true; }
    lines.push(LEAGUE_SWITCH_LINE);
    if (r.waiting) lines.push(T`Hai ${r.waiting === 1 ? T('un acquisto') : `${r.waiting} acquisti`} in coda: per questa prova contano gli ordini eseguiti. A mercato chiuso torna dopo l'apertura.`);
    const lenient = Acc.ignoreOn();
    const c = await choose([T('Opero adesso'), T('Controlla di nuovo'), ...(lenient ? [T('Proseguo lo stesso (esito ignorato)')] : []), T('Torno più tardi')], { cancel: true, prompt: lines.join(' · '), who });
    if (c === 0) { await trade(); continue; }
    if (c === 1) continue;
    if (lenient && c === 2) {
      await say([T('Hai attivato "Prosegui anche se la Prova va male": ignoro l\'esito negativo di questa verifica e ti lascio passare.'), Acc.IGNORE_WARNING], who);
      return true;
    }
    await say(T('Il duello l\'hai già vinto: quando torni ripeterai solo questa verifica.'), who);
    return false;
  }
}

export async function league(i: number, w: WorldApi) {
  const L = LEAGUE[i];
  // dopo il titolo Wall Street resta aperta: l'unico posto in cui le sfide si rifanno
  if (S.flags.champion && S.defeated.includes(`league_${i}`)) return leagueRematch(i, w);
  if (i > 0 && !S.defeated.includes(`league_${i - 1}`)) return say(T('Devi prima superare il Superiore precedente.'), L.name);
  await say([L.intro, i === 4 ? T('Sono il Campione. La prova finale: tutto ciò che hai imparato.') : T`Sono ${L.title.toLowerCase()}.`], L.name);
  const topics = i < 4 ? LEAGUE_TOPICS[i] : trackTopics(S.track, S.mixedClasses, 8);
  // Wall Street: dal livello 3,25 del primo Superiore al livello 4 (esperto) dell'ultimo e del Campione
  const P = i === 4 ? DUEL.champion : DUEL.league;
  if (!S.flags[`league_${i}_p1`]) {
    if (!retryUnlocked(`league_${i}`)) return say([T('Prima di riprovare, ripassa.'), T('Fai il Ripasso in Biblioteca o leggi una lezione: le domande che hai sbagliato torneranno.')], L.name);
    const qs = withPreviousMistakes(`league_${i}`, pickQuestions(topics, P.n, { target: targetDiff(STAGE_LEAGUE + Math.min(i, 3)) }));
    const r = await runDuel({ foeName: L.name, foeTitle: L.title, foePal: L.palette, questions: qs, ...P, arena: 'lega' });
    if (!r.win) { lockRetry(`league_${i}`, r.wrong); await say(T('Non sei ancora pront{o|a}. Torna dopo aver ripassato.'), L.name); return defeatRespawn(w); }
    clearRetry(`league_${i}`);
    S.flags[`league_${i}_p1`] = true;
  }
  const trial = leagueTrial(i);
  if (!trial) {
    // Regole: lo sportello delle offerte, che non passa dal conto
    const res = await runMission(leagueMission(i));
    if (!res || !res.ok) return say([T('La prova pratica non è riuscita.') + (res ? ' ' + res.detail : ''), T('Riprova quando vuoi: ripeterai solo la prova pratica.')], L.name);
  } else if (!(await accountTrial(trial, L.name))) return;
  reward({ defeated: `league_${i}`, rep: REWARD.rep.league, save: false });
  beep('win');
  await say(i === 4 ? [T('Incredibile. Hai battuto il Campione!'), T`${S.name}, da oggi sei {il nuovo Campione|la nuova Campionessa} di Wall Street!`] : [T('Hai superato la mia prova. Prosegui!')], L.name);
  if (i === 4) {
    S.flags.champion = true;
    await say([T('Congratulazioni, {Campione|Campionessa}!'), T('Il titolo non ti rende infallibile: i mercati cambiano, e chi smette di imparare torna principiante.'), T('Da oggi in Banca puoi anche aumentare il capitale del conto di gioco: è il privilegio dei Campioni.'), T('Alla Torre delle Sfide ti aspettano le crisi leggendarie, i piani infiniti e i tre Boss dei Mercati, che si battono sui grafici veri.'), T('E se vuoi, puoi iniziare una Nuova Partita+: riparte tutto da zero tranne i tuoi trofei, e sblocchi la difficoltà Leggenda.')], T('Prof. Saldi'));
    const mirror = mirrorEpilogue();
    await say(mirror ? [...epilogue(), mirror] : epilogue(), T('Epilogo'));
    await credits();
  }
  w.refresh();
  save();
}

/**
 * Rivincita di Wall Street (solo da Campione): gli stessi Superiori, in ordine, con domande del fine gioco.
 * Si rifà solo il duello: la prova pratica sul conto l'hai già superata. Ogni giro completo riparte dal primo.
 */
async function leagueRematch(i: number, w: WorldApi) {
  const L = LEAGUE[i];
  const done = Number(S.flags.wsRound ?? 0);
  if (i > done) return say([T('Le rivincite di Wall Street si fanno in ordine, come la prima volta.'), T`Prima batti di nuovo ${done === 0 ? T('il primo Superiore') : T('il Superiore precedente')}.`], L.name);
  if (i < done) return placeTalk(L.name, T('In questo giro mi hai già battuto. Prosegui con i Superiori successivi.'));
  const c = await choose([T('Rivincita'), T('Un\'altra volta')], { cancel: true, prompt: i === 4 ? T('Il Campione sei tu, ma il titolo si difende. Rifacciamo la sfida finale, con domande ancora più difficili?') : T('Wall Street si può rifare quante volte vuoi. Accetti la rivincita, con domande più difficili della prima volta?'), who: L.name });
  if (c !== 0) return;
  const topics = i < 4 ? LEAGUE_TOPICS[i] : trackTopics(S.track, S.mixedClasses, 8);
  const P = i === 4 ? DUEL.champion : DUEL.league;
  const qs = pickQuestions(topics, P.n, { target: endgameDiff() });
  const r = await runDuel({ foeName: L.name, foeTitle: T`${L.title} · rivincita`, foePal: L.palette, questions: qs, ...P, arena: 'lega' });
  tick();
  if (!r.win) { await say(T('Il titolo si difende ogni giorno. Ripassa e torna quando vuoi.'), L.name); return defeatRespawn(w); }
  S.flags.wsRound = i === 4 ? 0 : done + 1;
  reward({ rep: REWARD.rep.rematch, xp: REWARD.xp.rematch, event: 'rematch', save: false });
  beep('win');
  await say(i === 4 ? [T('Hai difeso il titolo. Wall Street riparte da capo quando vuoi.')] : [T('Rivincita vinta. Prosegui!')], L.name);
  w.refresh();
  save();
}

/** Seconda chiacchierata con chi hai già sfidato: niente duello, solo un appunto sull'argomento del posto in cui siete. */
export function placeTalk(who: string, lead: string): Promise<void> {
  // in grotta: un appunto dal taccuino della guida, cioè gli argomenti delle domande di quella grotta
  const cave = caveOf(S.map);
  if (cave) return say([lead, T('Qui sotto si impara una cosa alla volta. Questa te la ripeto volentieri:'), pick(BOOK_BY_ID[CAVES[cave].book].pages)], who);
  const topics = placeTopics();
  const pages = booksFor(topics).filter((b) => !b.id.endsWith('_ctx')).flatMap((b) => b.pages);
  const labels = topics.map((t) => `«${TOPIC_LABEL[t]}»`).join(T(' e '));
  return say(pages.length ? [lead, T`Da queste parti si parla di ${labels}. Te lo ripeto volentieri:`, pick(pages)] : [lead, pick(TRAINER_TIPS)], who);
}

/** Argomenti del luogo: l'Exchange o la città della Whale, il Percorso che porta alla città successiva, Wall Street. */
function placeTopics(): Parameters<typeof booksFor>[0] {
  const route = getMap(S.map).route;
  const n = route ?? townOf(S.map) ?? 1;
  if (n >= 9) return LEAGUE_TOPICS.flat();
  return mentorTopics(Math.max(1, n), S.track, S.mixedClasses);
}

export async function tower() {
  const opts = [T('Torre delle Sfide (piani infiniti)'), ...LEGENDS.map((l) => T`Crisi leggendaria: ${l.title}${S.legends.includes(l.id) ? ' ✓' : ''}`), T`Boss dei Mercati${Acc.graduated() ? '' : T(' (dopo Wall Street)')}`, T`Nuova Partita+${Acc.graduated() ? '' : T(' (dopo Wall Street)')}`, T('Esci')];
  const c = await choose(opts, { cancel: true, prompt: T`Record personale: piano ${S.tower.best}.`, who: T('Custode della Torre') });
  if (c < 0 || c === opts.length - 1) return;
  if (c === 0) {
    let floor = 0;
    const prevFid = S.stats.fiducia;
    S.stats.fiducia = 100;
    for (;;) {
      // la Torre parte dal livello del fine gioco e sale di un quarto di livello ogni tre piani
      const target = Math.min(MAX_DIFF, endgameDiff() + 0.25 * Math.floor(floor / 3));
      const pool = trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole']);
      const qs = pickQuestions(pool, 3, { target });
      const r = await runDuel({ foeName: T`Piano ${floor + 1}`, foeTitle: T('Torre delle Sfide'), foePal: 13, questions: qs, ...DUEL.tower, arena: 'torre' });
      if (!r.win) break;
      floor++;
      if ((await choose([T('Sali ancora'), T('Fermati qui')], { prompt: T`Piano ${floor} superato!` })) === 1) break;
    }
    S.stats.fiducia = prevFid;
    if (floor > S.tower.best) { S.tower.best = floor; await say(T`Nuovo record: piano ${floor}!`, T('Custode della Torre')); }
    else await say(T`Sei arrivat{o|a} al piano ${floor}.`, T('Custode della Torre'));
    save();
    return;
  }
  if (c <= LEGENDS.length) {
    const l = LEGENDS[c - 1];
    // le crisi leggendarie usano tutte le classi di attivo: è lì che si vede chi protegge e chi no
    const r = await runSim({ mission: l, classes: ['stocks', 'etf', 'crypto'] });
    if (r) recordMission(l.id, r);
    if (r?.ok && !S.legends.includes(l.id)) { S.legends.push(l.id); reward({ rep: REWARD.rep.legend, event: 'legend', save: false }); beep('badge'); await say(T`Hai superato ${l.title}! Carta leggendaria ottenuta (cosmetica).`, T('Custode della Torre')); save(); }
    return;
  }
  if (c === LEGENDS.length + 1) { // Boss dei Mercati
    if (!Acc.graduated()) return say([T('I Boss dei Mercati sfidano solo i Campioni di Wall Street.'), T('Si battono con un quiz e poi con una sola decisione su un grafico vero, che può durare ore o settimane.')], T('Custode della Torre'));
    return bossMenu();
  }
  if (c === LEGENDS.length + 2) { // Nuova Partita+
    if (!Acc.graduated()) return say([T('Potrai iniziare la Nuova Partita+ quando avrai vinto Wall Street.'), T('Ricomincia tutto da zero tranne i trofei, e sblocca la difficoltà Leggenda.')], T('Custode della Torre'));
    // il percorso si sceglie di nuovo con una delle tre Valigette nel Laboratorio, come nella prima partita
    await say([
      T('La Nuova Partita+ riparte da zero: conto di gioco con capitale nuovo, Attestati, Sigilli, Prove sul conto, Esame della Leva. Anche la Torre e i Boss tornano chiusi fino alla prossima Wall Street.'),
      T('Restano con te solo i trofei: record della Torre, crisi leggendarie, Boss battuti, carte dorate, traguardi, titolo e arredi. E resta il tuo Diario.'),
      T('In cambio sblocchi la difficoltà più alta, Leggenda, e le Whale faranno domande più difficili.'),
      T('Una cosa pratica: i titoli che hai adesso restano nel tuo conto Alpaca Paper, ma escono dal registro del gioco. Se vuoi ripartire pulito, vendili prima da una Banca.'),
    ], T('Custode della Torre'));
    const t = await choose([T('Sì, ricomincio da zero'), T('Annulla')], { cancel: true, prompt: T('Sicur{o|a}? Non potrai tornare indietro.'), who: T('Custode della Torre') });
    if (t !== 0) return;
    newGamePlus(S.track);
    applyDifficulty(await chooseDifficulty(T('Custode della Torre')));
    await say([T('Fatto. Il Professore ti aspetta al Laboratorio per la nuova Valigetta.')], T('Custode della Torre'));
    save();
    location.reload();
  }
}

export const HERMIT_LINES: Record<string, { intro: string[]; win: string; again: string }> = {
  r3: { intro: [T('Sei arrivat{o|a} fin qui sull\'acqua? Allora la liquidità la sai usare.'), T('Io compro e tengo per decenni. Vediamo se reggi le mie domande.')], win: T('Hai la pazienza del cassettista. Tieni questo studio extra, ti servirà.'), again: T('Chi investe per decenni non ha bisogno di guardare il prezzo ogni giorno. Funziona anche con le isole.') },
  r5: { intro: [T('Un prezzo diverso per la stessa cosa in due posti? Mi sveglio per questo.'), T('Ma le occasioni vere sono rare e veloci. Rispondi in fretta e bene!')], win: T('Preciso come un arbitraggio. Ti lascio i miei appunti.'), again: T('Quando un guadagno sembra senza rischio, cerca il rischio che non vedi.') },
  r7: { intro: [T('Custodisco le riserve: la liquidità che non si tocca quando il mercato urla.'), T('Solo chi ha mente fredda e liquidità arriva fin qui. Dimostralo.')], win: T('Riserve al sicuro, mente lucida. Sei pront{o|a} per Wall Street.'), again: T('Un fondo di emergenza vale più di qualsiasi previsione.') },
  faro: { intro: [T('Il faro non dice alle navi dove andare: mostra solo dove sono gli scogli.'), T('Un buon piano d\'investimento fa lo stesso. Vediamo se sai leggere la luce.')], win: T('Rotta sicura. Ricorda: gli scogli sono i costi, la leva e le promesse troppo belle.'), again: T('Di notte gli scogli non si spostano. Sono le onde a farti credere di sì.') },
  perle: { intro: [T('Le perle migliori stanno dove nessuno ha voglia di cercare, al buio.'), T('Ma chi si tuffa senza conoscere il fondale non torna su. Dimostrami che lo conosci.')], win: T('Hai occhio per il valore nascosto. Questa è la perla più rara: la pazienza.'), again: T('Prima di comprare, scendi sul fondo: leggi i conti, non solo il prezzo.') },
};

/** Abitante di un'Isola della Liquidità: un duello difficile una volta sola, senza perdere Fiducia. */
export async function hermit(n: NpcDef) {
  const key = String(n.data?.key ?? '');
  const h = HERMIT_LINES[key];
  const who = HERMITS[key.replace(/^r/, '')]?.name ?? n.name;
  if (!h) return say('...', who);
  if (S.flags[`islet_${key}`]) return say(h.again, who);
  await say(h.intro, who);
  const qs = pickQuestions(studiedTopics(), 5, { target: targetDiff(Math.max(3, storyStage()) + 2) });
  return hermitDuel(key, who, n.pal, qs);
}

/** Il duello di un eremita (isole, Faro, Grotta delle Perle): quattro giuste su cinque, senza rischiare la Fiducia, una volta sola. */
export async function hermitDuel(key: string, who: string, pal: number, qs: Question[], arena?: Arena) {
  const h = HERMIT_LINES[key];
  const prevFid = S.stats.fiducia;
  const res = await runDuel({ foeName: who, foePal: pal, questions: qs, need: 4, damage: 0, ...(arena ? { arena } : {}) });
  S.stats.fiducia = prevFid;
  if (!res.win) return say(arena === 'grotta' ? T('Non ancora. Torna quando vuoi: la grotta non si muove.') : T('Non ancora. Torna quando vuoi: l\'isola non si muove.'), who);
  S.flags[`islet_${key}`] = true;
  reward({ xp: REWARD.xp.hermit, save: false });
  Object.keys(S.cards).forEach((id) => (card(id).xp += 20));
  track('islet');
  await say([h.win, T('+120 punti Conoscenza e studio extra per tutte le tue carte.')], who);
  save();
}

export async function legend() {
  if (S.flags.legendMet) return say(T('La mente fredda vede ciò che il rumore nasconde. Torna quando vuoi.'), T('Investitrice Leggendaria'));
  await say([T('Hai attraversato il Muro del Rumore. Pochi ci riescono.'), T('Ti faccio cinque domande difficili. Se rispondi bene, ti lascio un dono di conoscenza.')], T('Investitrice Leggendaria'));
  // difficili, ma solo su ciò che il gioco ha già spiegato: Wall Street entra nel mazzo quando la sua sezione è stata aperta
  const qs = pickQuestions(studiedTopics(), 5, { target: targetDiff(STAGE_LEAGUE + 1) });
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: T('Investitrice Leggendaria'), foePal: 14, questions: qs, need: 4, damage: 0, arena: 'lega' });
  S.stats.fiducia = prevFid;
  if (r.win) {
    S.flags.legendMet = true;
    reward({ xp: REWARD.xp.legend, save: false });
    Object.keys(S.cards).forEach((id) => (card(id).xp += 30));
    await say([T('Eccellente. +200 punti Conoscenza e studio extra per tutte le tue carte.'), T('Ricorda: la conoscenza è l\'unico vantaggio che nessuno può portarti via.')], T('Investitrice Leggendaria'));
  } else await say(T('Non ancora. La conoscenza richiede tempo.'), T('Investitrice Leggendaria'));
}
