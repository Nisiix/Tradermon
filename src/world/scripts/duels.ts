// Duelli di conoscenza e missioni: allenatori, allievi, Mentori, Lega, Torre, eremiti, duelli condivisi e del giorno.
import { recordMission, mirrorEpilogue } from '../../systems/mirror';
import { getMap, type NpcDef } from '../maps';
import { S, save, slots, addRep, card, learnBias, clampStat, classes, newGamePlus } from '../../systems/state';
import { say, choose, modal } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { runSim } from '../../ui/timemachine';
import { runPick } from '../../ui/pick';
import { pickQuestions, SHARED_TOPICS, dailyQuestion, todayKey, reviewQueue, targetDiff, storyStage, STAGE_LEAGUE } from '../../systems/quiz';
import { mentorTopics, trackTopics, LEAGUE_TOPICS } from '../../data/quiz/build';
import { mentor, LEAGUE, antagonist, TOWNS, TRAINER_TIPS } from '../../data/story';
import { mentorBooks, TOPIC_LABEL } from '../../data/books';
import { DUEL, REWARD, TRAIT_HIGH } from '../../systems/balance';
import { errorsAllowed, errorsLeft } from '../../systems/duelLife';
import { repTier, mentorCharacterLine, epilogue, TIER_MENTOR_REMATCH } from '../../systems/character';
import { mentorMission, processReview, leagueMission, LEGENDS, SANDBOX, type Mission } from '../../data/missions';
import { unlockedAssets } from '../../data/assets';
import { TEMPTATIONS, BIAS_INFO } from '../../data/events';
import { PAL } from '../../art/art';
import { beep } from '../../systems/audio';
import { pick, shuffle, mulberry32 } from '../../systems/rng';
import { track, rematchReady, scheduleRematch } from '../../systems/progress';
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

export async function trainer(n: NpcDef, w: WorldApi) {
  if (S.defeated.includes(n.id)) {
    if (!rematchReady(n.id)) return say(pick(TRAINER_TIPS), n.name);
    // rivincita: domande più difficili, anche quelle che hai sbagliato
    await say(['Rieccoti! Ho studiato dall\'ultima volta.', 'Rivincita: stavolta le domande sono più toste!'], n.name);
    const rq = pickQuestions(trackTopics(S.track, S.mixedClasses, S.badges), DUEL.rematch.n, { preferReview: true, target: targetDiff(routeStage(n) + 2) });
    const rr = await runDuel({ foeName: n.name, foeTitle: 'Rivincita', foePal: n.pal, questions: rq, ...DUEL.rematch });
    tick();
    if (rr.win) { reward({ rep: REWARD.rep.rematch, xp: REWARD.xp.rematch, event: 'rematch' }); scheduleRematch(n.id); await say(['Battuto di nuovo! Ci rivediamo tra qualche giorno.', pick(TRAINER_TIPS)], n.name); }
    else { await say('Stavolta ho vinto io! Torna quando vuoi.', n.name); scheduleRematch(n.id); await defeatRespawn(w); }
    w.refresh();
    return;
  }
  await say(n.lines ?? ['Sfida!'], n.name);
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, S.badges), DUEL.trainer.n, { preferReview: true, target: targetDiff(routeStage(n)) });
  const r = await runDuel({ foeName: n.name, foePal: n.pal, questions: qs, ...DUEL.trainer });
  if (r.win) scheduleRematch(n.id);
  await afterDuel(r.win, n.id, REWARD.rep.trainer, w, n.name);
}

export async function speculator(n: NpcDef, w: WorldApi) {
  const ant = antagonist(S.track);
  if (n.data?.boss) {
    await say([`Così sei tu che ostacoli ${ant.team}!`, `Io sono ${ant.boss}. Ti offro un affare: unisciti a noi e guadagnerai senza studiare.`], ant.boss);
    const c = await choose(['Mai!', 'Dimmi di più...'], { prompt: 'Cosa rispondi?' });
    if (c === 1) { clampStat('disciplina', -10); await say('Ah ah! Ti piacerebbe, eh? Ma prima dovrai battermi.', ant.boss); }
    const qs = pickQuestions(['regole', 'gestione', 'bias'], DUEL.boss.n, { target: targetDiff(routeStage(n) + 1) });
    const r = await runDuel({ foeName: ant.boss, foeTitle: `Capo di ${ant.team}`, foePal: PAL.SPEC, questions: qs, ...DUEL.boss });
    if (r.win) {
      reward({ defeated: n.id, rep: REWARD.rep.boss }); clampStat('disciplina', 10);
      await say(['Impossibile... Le scorciatoie non funzionano con te.', `${ant.team} si ritira. Per ora.`], ant.boss);
    } else await defeatRespawn(w);
    w.refresh();
    return;
  }
  const t = pick(TEMPTATIONS);
  await say([`Psst! Faccio parte de${ant.team.startsWith('gli') ? 'gli' : ant.team.startsWith('i ') ? 'i' : 'lla'} ${ant.team.replace(/^(gli|i|la|l') ?/, '')}.`, t.text], 'Speculatore');
  // con Disciplina alta si riconosce la trappola e la si smaschera davanti a tutti
  const unmask = S.stats.disciplina >= TRAIT_HIGH;
  const c = await choose(unmask ? ['Rifiuto', 'Accetto', 'Smaschero la truffa (Disciplina)'] : ['Rifiuto', 'Accetto'], { prompt: 'Cosa fai?' });
  if (c === 2) {
    learnBias(t.bias); reward({ rep: REWARD.rep.temptation });
    await say([`Conosco questo trucco: punta sulla ${BIAS_INFO[t.bias].name}. ${BIAS_INFO[t.bias].effect}`, 'Chi ti promette guadagni facili sta vendendo a te, non per te.'], 'Tu');
    await say('Uff... Hai la testa fredda, eh? Vediamo se sai anche rispondere!', 'Speculatore');
  } else if (c === 0) { clampStat('disciplina', 5); await say(t.refuse, 'Tu'); }
  else {
    // nessuna perdita applicata al conto: è una lezione, non una penalità sul patrimonio
    clampStat('disciplina', -8);
    learnBias(t.bias);
    await say([t.accept, `Nella realtà avresti potuto perdere circa il ${Math.round(t.loss * 100)}% della liquidità. Questa trappola si chiama ${BIAS_INFO[t.bias].name}: ${BIAS_INFO[t.bias].effect}`], 'Narratore');
  }
  if (c !== 2) await say('Grr! Allora vediamo se sai anche rispondere!', 'Speculatore');
  const qs = pickQuestions(['regole', ...trackTopics(S.track, S.mixedClasses, S.badges)], DUEL.speculator.n, { target: targetDiff(routeStage(n)) });
  const r = await runDuel({ foeName: 'Speculatore', foeTitle: ant.team, foePal: PAL.SPEC, questions: qs, ...DUEL.speculator });
  await afterDuel(r.win, n.id, REWARD.rep.speculator, w, 'Speculatore');
}

/** Nessuno salta gli allievi: il Mentore si sfida solo dopo averli battuti tutti. */
export function allStudentsBeaten(m: number): boolean {
  return getMap(`academy_${m}`).npcs.filter((x) => x.kind === 'student').every((x) => S.defeated.includes(x.id));
}

export async function student(n: NpcDef, w: WorldApi) {
  const m = n.data?.n as number;
  if (S.defeated.includes(n.id)) return say(['Il Mentore è là in fondo. Buona fortuna!', pick(TRAINER_TIPS)], n.name);
  await say('Prima di arrivare al Mentore devi superare me!', n.name);
  // gli allievi sono un gradino sotto il loro Mentore
  const qs = pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.student.n, { target: targetDiff(m - 1) - 0.25 });
  const r = await runDuel({ foeName: n.name, foeTitle: 'Allievo dell\'Accademia', foePal: n.pal, questions: qs, ...DUEL.student });
  tick();
  if (r.win) { reward({ defeated: n.id, rep: REWARD.rep.student }); await say('Bravo! Sei pronto per il Mentore.', n.name); }
  else { await say('Studia in Biblioteca e torna!', n.name); await defeatRespawn(w); }
}

// ---------------- Mentori ----------------

/** Medaglia già vinta: dal grado "Rinomato" il Mentore accetta una rivincita con domande di livello esperto. */
async function mentorRematch(m: number, md: ReturnType<typeof mentor>) {
  if (repTier().index < TIER_MENTOR_REMATCH) return say([`Hai già la ${md.badge}.`, md.win, 'Quando la tua Reputazione sarà da "Rinomato" ti concederò una rivincita da esperto.'], md.name);
  const done = !!S.flags[`m${m}_rematch`];
  const c = await choose(['Rivincita da esperto', 'Un\'altra volta'], { cancel: true, prompt: done ? 'Hai già vinto la mia rivincita. Vuoi rigiocarla?' : 'Sei diventato famoso. Accetti una rivincita con le domande più difficili?', who: md.name });
  if (c !== 0) return;
  const qs = pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.mentorRematch.n, { target: 3.5 });
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: md.name, foeTitle: `Mentore ${m} · rivincita`, foePal: md.palette, questions: qs, ...DUEL.mentorRematch });
  S.stats.fiducia = Math.max(prevFid, S.stats.fiducia);
  if (r.win && !done) reward({ flag: `m${m}_rematch`, rep: REWARD.rep.mentorRematch, xp: REWARD.xp.mentorRematch });
  await say(r.win ? ['Da esperto a esperto: complimenti.', mentorCharacterLine()] : 'Le domande da esperto non perdonano. Torna quando vuoi.', md.name);
}

export async function mentorBattle(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  // vecchi salvataggi: il duello era già vinto ma la Medaglia arrivava solo dopo la missione
  if (S.badges === m - 1 && S.flags[`m${m}_p1`]) { await say('Il duello l\'avevi già vinto: l\'Attestato è tuo.', md.name); await winBadge(m, w); }
  if (S.badges >= m) {
    if (S.seals >= m) return mentorRematch(m, md);
    return sealChallenge(m, w);
  }
  if (S.badges < m - 1) return say(['Sei arrivato qui troppo presto!', `Prima ti serve l'Attestato del Mentore ${S.badges + 1}.`], md.name);
  if (!allStudentsBeaten(m)) return say(['Benvenuto nella mia Accademia.', 'Prima di sfidarmi devi battere tutti i miei allievi.'], md.name);
  // la regola della Medaglia la spiega il primo Mentore, quando serve; gli altri non la ripetono
  await say([md.intro, ...(m > 1 || S.flags.medalRule ? [] : ['La mia Medaglia ha due metà. L\'Attestato si vince qui, con un duello di conoscenza, e ti apre la strada verso la città successiva.', 'Il Sigillo pratico si guadagna dopo, con la Prova sul conto: ordini veri sul mercato di oggi, dal tuo conto di gioco, usando ciò che ti ho appena insegnato. Puoi viaggiare con i soli Attestati, ma entri nella Lega degli Investitori solo se hai tutti e otto i Sigilli.'])], md.name);
  S.flags.medalRule = true;
  const unread = mentorBooks(m, S.track, S.mixedClasses).filter((b) => !S.booksRead.includes(b.id)).length;
  if (unread) await say([`Un consiglio da Mentore: nella Biblioteca di ${TOWNS[m]?.name ?? 'questa città'} c'è la mia sezione, con i libri su ${mentorTopics(m, S.track, S.mixedClasses).map((t) => `«${TOPIC_LABEL[t]}»`).join(' e ')}.`, 'Le domande del duello vengono da lì.'], md.name);
  // dopo una sconfitta si torna solo dopo aver studiato: un libro della sezione o un ripasso in Biblioteca
  if (!retryUnlocked(`m${m}`)) return say(['Sei tornato presto. Prima di riprovare, studia.', `Leggi un libro della mia sezione nella Biblioteca di ${TOWNS[m]?.name ?? 'questa città'}, oppure fai il Ripasso: le domande che hai sbagliato sono lì ad aspettarti.`], md.name);
  {
    const conc = errorsAllowed(DUEL.mentor.n, DUEL.mentor.need), left = errorsLeft(S.stats.fiducia, 0, DUEL.mentor.n, DUEL.mentor.need);
    if (left < conc) await say([`La tua Fiducia è a ${S.stats.fiducia}: ti basta per ${left === 1 ? 'un solo errore' : left === 0 ? 'nessun errore' : `${left} errori`} invece dei ${conc} concessi. Se arriva a zero durante il duello vai in tilt.`, 'Puoi riposare in Clinica prima di iniziare.'], md.name);
  }
  const ok = (await choose(['Sono pronto!', 'Non ancora'], { prompt: 'Iniziamo?' })) === 0;
  if (!ok) return;
  // il Mentore m si affronta con m − 1 Attestati: dal livello 1 (Mentore 1) a quasi 3 (Mentore 8)
  const qs = withPreviousMistakes(`m${m}`, pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.mentor.n, { target: targetDiff(m - 1) }));
  const r = await runDuel({ foeName: md.name, foeTitle: `Mentore ${m}`, foePal: md.palette, questions: qs, ...DUEL.mentor, intro: md.intro });
  tick();
  if (!r.win) { lockRetry(`m${m}`, r.wrong); await say(['Non ancora. Ripassa e torna: ti aspetto.', 'Le domande che hai sbagliato torneranno nel prossimo duello.'], md.name); return defeatRespawn(w); }
  clearRetry(`m${m}`);
  S.flags[`m${m}_p1`] = true;
  S.flags[`m${m}_perfect`] = r.perfect;
  await winBadge(m, w);
  const go = await choose(['Vediamo la Prova sul conto', 'Più tardi'], { prompt: 'Ottimo duello! Vuoi vedere adesso la parte pratica per il Sigillo?', who: md.name });
  if (go === 0) await sealChallenge(m, w);
}

/**
 * Parte pratica della Medaglia: la Prova sul conto, cioè l'esercizio di tappa fatto con ordini veri sul mercato di oggi.
 * I Mentori non propongono replay: i periodi del passato si rivivono solo nella Macchina del Tempo (Zona Simulazione).
 */
/** Promemoria delle sfide sul conto: se con un titolo non ci si arriva, si può vendere e puntare su un altro. */
export const SWITCH_LINE = 'Se con un titolo non riesci ad arrivare all\'obiettivo della Prova puoi venderlo da "Compra / Vendi" e puntare su un altro. Decidere di vendere, anche solo una parte, annulla la Prova: prima della vendita ti viene chiesto di confermare che vendi per annullarla, poi la quota della tappa riparte da zero e la rifai con un altro titolo. Una vendita in perdita resta una perdita vera sul conto di gioco.';
/** Nelle verifiche della Lega si guarda il conto com'è: non c'è un titolo della prova, quindi una vendita non annulla nulla. */
export const LEAGUE_SWITCH_LINE = 'Se un titolo non ti porta dove serve puoi venderlo, anche solo in parte, da "Compra / Vendi" e puntare su un altro: qui guardo il conto com\'è, quindi la verifica si rifà semplicemente da capo. Una vendita in perdita resta una perdita vera sul conto di gioco.';

async function sealChallenge(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  if (S.flags.bankrupt) return say(['Dopo la bancarotta la parte pratica di questa partita è chiusa.', 'Il tuo Attestato resta valido, e la strada è aperta.'], md.name);
  for (;;) {
    const got = Acc.grantSeals();
    if (got.includes(m)) {
      beep('badge'); jingle('badge');
      await say([`Prova sul conto superata: ecco il Sigillo pratico. La ${md.badge} adesso è completa!`, m === 8 ? 'Con tutti e otto i Sigilli la Guardia della Lega ti lascerà passare.' : `Sigilli pratici: ${S.seals}/8.`], md.name);
      w.refresh(); save();
      return;
    }
    if (S.seals >= m) return;
    const ex = Acc.exercise();
    const lines = S.seals < m - 1 || ex.stage < m
      ? [`I Sigilli si prendono in ordine: prima ti serve ${ex.stage === 0 ? 'l\'esercizio della Valigetta' : `la Prova sul conto della tappa ${ex.stage}`}.`, nextSealLine()]
      : [
        `Prova sul conto, tappa ${m}: ${STAGE_TOOL[m].text}`,
        `In tutto servono ${Acc.exNeed(m).toFixed(0)} $ di acquisti sul tuo conto (finora ${ex.got.toFixed(0)} $). È il minimo: se vuoi investire di più, sei libero di farlo.`,
        // la spiegazione completa alla prima Prova; dopo basta il promemoria breve
        ...(S.flags.provaRules ? ['Se vendi il titolo della Prova, anche solo una parte, la Prova si annulla e la rifai con un altro titolo.'] : ['Sono ordini veri sul mercato di oggi: nessuno ti chiede un rendimento, si guarda il metodo. A mercato chiuso l\'ordine vale quando Alpaca lo accetta e si esegue all\'apertura.', SWITCH_LINE]),
      ];
    if (!(S.seals < m - 1 || ex.stage < m)) S.flags.provaRules = true;
    const c = await choose(['Opero adesso', 'Più tardi'], { cancel: true, prompt: lines.join(' '), who: md.name });
    if (c !== 0) return say('Si fa anche da qualsiasi Clinica: il Sigillo arriva da solo, non serve tornare qui.', md.name);
    if (!(await trade())) return;
  }
}

/**
 * Missioni della Macchina del Tempo: i periodi veri del passato legati agli argomenti dei Mentori, con i nomi dei
 * titoli nascosti. Si giocano solo qui, nella Zona Simulazione: sono facoltative, non servono né per i Sigilli né
 * per la Lega, e non toccano il conto. Si sbloccano con l'Attestato del Mentore corrispondente.
 */
export async function missionDesk(who = 'Operatrice') {
  if (S.badges < 1) return say(['Le missioni della Macchina del Tempo si sbloccano una alla volta, con gli Attestati dei Mentori.', 'Torna dopo il primo Attestato.'], who);
  for (;;) {
    const ms = Array.from({ length: S.badges }, (_, k) => ({ m: k + 1, mission: mentorMission(k + 1, S.track, S.profile) }));
    const label = (x: { m: number; mission: Mission }) => `${x.m}. ${x.mission.title}${S.flags[`m${x.m}_mission`] ? ' ✓' : ''}${x.mission.kind === 'sim' && S.flags[`${x.mission.id}_stars`] ? ' ' + '★'.repeat(Number(S.flags[`${x.mission.id}_stars`])) : ''}`;
    const c = await choose([...ms.map(label), 'Indietro'], { cancel: true, prompt: 'Missioni facoltative su periodi veri del passato. Non valgono per Sigilli e Lega e non toccano il tuo conto: qui si sbaglia senza conseguenze.', who });
    if (c < 0 || c >= ms.length) return;
    const { m, mission } = ms[c];
    if (mission.kind === 'sim' && !(await requireAccount('i dati reali della Macchina del Tempo', who))) continue;
    const res = await runMission(mission);
    if (!res) { await say('Missione interrotta. Torna quando vuoi.', who); continue; }
    if (!res.ok) { await say(['Stavolta non è riuscita: ' + res.detail, 'Nessun problema: la Macchina del Tempo serve proprio a questo.'], who); continue; }
    if (!S.flags[`m${m}_mission`]) { track('mission'); reward({ flag: `m${m}_mission`, xp: REWARD.xp.badge / 4 }); }
    await say('Missione riuscita. Sul conto Paper il passato non si conosce: lì conta lo stesso metodo, sul mercato di oggi.', who);
  }
}

/** Periodo reale di riserva per le prove che chiedono di reggere un calo; per le altre vale un anno tranquillo. */
const ALT_PERIOD: Record<string, string> = { m6: 'sb_bear', m8: 'sb_storm' };

async function runMission(m: Mission): Promise<{ ok: boolean; detail: string } | null> {
  if (m.kind === 'pick') return runPick(m);
  await say(['Benvenuto nella Macchina del Tempo!', 'Usa il pulsante ▶ per far scorrere i giorni, compra e vendi quando vuoi. I prezzi sono quelli veri di quel periodo, riportati a base 100; i nomi li scoprirai alla fine.'], 'Macchina del Tempo');
  // dopo tre tentativi falliti sullo stesso periodo si può provare la stessa missione su un altro periodo reale
  const failKey = `${m.id}_fails`;
  let mission = m;
  if (Number(S.flags[failKey] ?? 0) >= 3) {
    const alt = SANDBOX.find((x) => x.id === (ALT_PERIOD[m.id] ?? 'sb_normal'))!;
    const c = await choose(['Provo su un altro periodo', 'Resto su questo'], { prompt: 'Hai già tentato tre volte su questo periodo. La stessa prova, con le stesse regole, si può fare su un altro periodo vero di mercato.', who: 'Macchina del Tempo' });
    if (c === 0) mission = { ...m, scenario: { ...m.scenario, window: alt.window, news: undefined }, brief: `${m.brief} (Periodo alternativo: le notizie non sono annunciate.)` };
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

/** Attestato del Mentore: apre il mondo (guardie, Tecnica, carte, abilità) e la Prova sul conto della tappa. */
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
  await say([md.win, mentorCharacterLine(), `Hai ottenuto l'Attestato della ${md.badge}!`, `Nuova Tecnica: ${md.technique}. ${md.techDesc}`, `Slot di portafoglio: ${slots()}.`, newCards.length ? `Nuove Asset Card: ${newCards.map((a) => a.name).join(', ')}.` : '',
    S.flags.bankrupt ? '' : `Si apre la Prova sul conto della tappa ${m}, quella che vale il Sigillo.`].filter(Boolean), md.name);
  const extra: string[] = [];
  if (m === 2) extra.push('Con l\'abbonamento al treno puoi viaggiare tra le città visitate dalle stazioni.');
  if (m === 5) extra.push('L\'Archivio di Bilancia ora è aperto. E in Clinica puoi sostenere l\'Esame della Leva: per ora vale solo nei replay.');
  if (m === SWIM_BADGE) extra.push(`Nuova abilità: ${ABILITY.swim.name}. Cammina verso l'acqua e la attraverserai su una zattera. Sui Percorsi 3, 5 e 7 ci sono isole da raggiungere.`);
  if (m === ABILITY.cut.badge) extra.push(`Nuova abilità: ${ABILITY.cut.name}. Ora puoi frantumare i Massi delle Commissioni: prova la Galleria del Dark Pool sul Percorso 2.`);
  if (m === ABILITY.dark.badge) extra.push(`Nuova abilità: ${ABILITY.dark.name}. Le grotte buie non ti fermano più: la Miniera dei Lingotti sul Percorso 5 porta dritta a Valdividendo.`);
  if (m === TRANSFER_BADGE) extra.push(`Nuova abilità: ${ABILITY.transfer.name}. Apri il menu, scegli "Mappa della Regione" e trasferisciti in una città già visitata.`);
  if (m === 8) extra.push('L\'Altopiano della Lega è oltre il Percorso 9. La Guardia fa passare solo chi ha tutti e otto i Sigilli pratici. Con l\'ottavo Attestato, se hai superato l\'Esame della Leva, la leva si apre anche sul conto di gioco.');
  if (extra.length) await say(extra, 'Prof. Saldi (messaggio)');
  w.refresh();
  save();
}

export async function guard(n: NpcDef, w: WorldApi) {
  const b = n.data?.badge as number;
  if (n.data?.league) await say(['Alt! Nella Lega entra solo chi ha completato tutte e otto le Medaglie: Attestato e Sigillo pratico.', `Hai ${S.seals} Sigilli su 8. ${nextSealLine()}`, 'Nella Lega i Superiori guardano il tuo conto com\'è, sul mercato di oggi: per questo serve aver fatto pratica con ordini veri.'], n.name);
  else await say([`Alt! Per proseguire serve l'Attestato della ${mentor(b, S.track).badge}.`, `Lo consegna il Mentore dell'Accademia di ${TOWNS[b].name}, a chi vince il suo duello.`], n.name);
  w.bumpBack();
}

// ---------------- Edifici ----------------

/** Quando torneranno le prossime domande del ripasso. */
function nextReviewLine(): string {
  const next = Object.values(S.reviewDue).filter((d) => d > todayKey()).sort()[0];
  return next ? `La prossima domanda torna nel ripasso il ${next.split('-').reverse().join('/')}.` : 'Rispondi ai duelli: le domande che incontri entreranno nel ripasso.';
}

export async function reviewDuel() {
  const q = reviewQueue();
  if (!q.length) return say(['Oggi non hai domande in scadenza. Ottimo lavoro!', nextReviewLine()], 'Bibliotecaria');
  const qs = shuffle(q.slice(0, 12)).slice(0, DUEL.review.n);
  const prevFid = S.stats.fiducia;
  await runDuel({ foeName: 'Ripasso', foeTitle: 'Biblioteca', foePal: PAL.LIB, questions: qs, need: qs.length, damage: 0, practice: true });
  S.stats.fiducia = prevFid;
  track('review');
  return say(['Ogni domanda giusta torna più avanti: dopo 1, 3, 7 e poi 21 giorni. Quelle sbagliate tornano subito.', 'Rivedere al momento giusto è il modo migliore per ricordare.'], 'Bibliotecaria');
}

export async function daily() {
  const today = todayKey();
  if (S.daily.lastDate === today) return say([`Hai già risposto alla domanda di oggi. Serie attuale: ${S.daily.streak} giorni.`, 'Torna domani!'], 'Professoressa del giorno');
  await say('Ecco la domanda del giorno!', 'Professoressa del giorno');
  const q = dailyQuestion();
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: 'Domanda del giorno', foePal: 18, questions: [q], need: 1, damage: 0 });
  S.stats.fiducia = prevFid;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.daily.streak = r.win ? (S.daily.lastDate === todayKey(y) ? S.daily.streak + 1 : 1) : 0;
  S.daily.lastDate = today;
  if (r.win) reward({ xp: REWARD.xp.daily + Math.min(REWARD.xp.dailyStreakMax, S.daily.streak * REWARD.xp.dailyStreak), event: 'daily_q', save: false });
  await say(r.win ? `Serie di ${S.daily.streak} giorni! Bonus di esperienza.` : 'La serie riparte da zero. Domani andrà meglio!', 'Professoressa del giorno');
  save();
}

export async function linkDuel() {
  const c = await choose(['Genera un codice sfida', 'Inserisci il codice di un amico', 'Annulla'], { cancel: true, prompt: 'Duello con codice: tu e un amico giocate lo stesso periodo reale di mercato e lo stesso quiz, qualunque sia il vostro percorso.', who: 'Operatrice' });
  if (c < 0 || c === 2) return;
  let code = '';
  if (c === 0) { code = `TM-${S.track.slice(0, 1).toUpperCase()}${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`; await say([`Il tuo codice è ${code}. Condividilo con un amico: il quiz è uguale per tutti i percorsi.`, 'Ora gioca tu.'], 'Operatrice'); }
  else {
    const res = await modal<string>('Codice sfida', ({ body, button, close }) => { body.innerHTML = '<input class="tx c" placeholder="TM-S123456">'; button('Ok', () => close((body.querySelector('.c') as HTMLInputElement).value.trim().toUpperCase()), 'primary'); });
    if (!res) return; code = res;
  }
  const seed = Number(code.replace(/\D/g, '')) || 1;
  const rng = mulberry32(seed);
  const qs = pickQuestions(SHARED_TOPICS, 5, { rng, shared: true });
  const prevFid = S.stats.fiducia;
  const q = await runDuel({ foeName: 'Duello con codice', foePal: 16, questions: qs, need: 5, damage: 0, practice: true });
  S.stats.fiducia = prevFid;
  // stesso periodo reale per tutti: i dati sono gli stessi qualunque conto li scarichi
  const r = await runSim({ scenario: SANDBOX[0], sandbox: true, classes: ['stocks', 'etf'] });
  const score = Math.round(q.correct * 100 + (r ? r.sharpe * 200 - r.mdd * 300 : 0));
  await say([`Risultato del duello ${code}: ${q.correct}/5 risposte, Sharpe ${r ? r.sharpe.toFixed(2) : '—'}, drawdown ${r ? (r.mdd * 100).toFixed(1) : '—'}%.`, `Punteggio: ${score}. Confrontalo con quello del tuo amico!`], 'Operatrice');
}

/**
 * Prova pratica sul conto di gioco: il Superiore guarda il conto com'è adesso, sul mercato di oggi.
 * Chi non la supera opera (ordini veri sul conto Paper) e chiede una nuova verifica, senza rifare il duello.
 */
async function accountTrial(t: Trial, who: string): Promise<boolean> {
  if (!(await requireAccount('la prova pratica della Lega', who))) return false;
  await say([`${t.title}. ${t.brief}`, 'Guardo il tuo conto di gioco com\'è adesso, sul mercato di oggi. Non ti chiedo un rendimento: quello non lo controlla nessuno. Ti chiedo metodo.'], who);
  for (;;) {
    await Acc.sync(true).catch(() => []);
    const r = runTrial(t);
    const lines = r.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label} (ora: ${c.now})`);
    if (r.ok) { await say(['Controllo il conto…', ...lines, 'Tutto in ordine.'], who); return true; }
    lines.push(LEAGUE_SWITCH_LINE);
    if (r.waiting) lines.push(`Hai ${r.waiting === 1 ? 'un acquisto' : `${r.waiting} acquisti`} in coda: per questa prova contano gli ordini eseguiti. A mercato chiuso torna dopo l'apertura.`);
    const lenient = Acc.ignoreOn();
    const c = await choose(['Opero adesso', 'Controlla di nuovo', ...(lenient ? ['Proseguo lo stesso (esito ignorato)'] : []), 'Torno più tardi'], { cancel: true, prompt: lines.join(' · '), who });
    if (c === 0) { await trade(); continue; }
    if (c === 1) continue;
    if (lenient && c === 2) {
      await say(['Hai attivato "Prosegui anche se la Prova va male": ignoro l\'esito negativo di questa verifica e ti lascio passare.', Acc.IGNORE_WARNING], who);
      return true;
    }
    await say('Il duello l\'hai già vinto: quando torni ripeterai solo questa verifica.', who);
    return false;
  }
}

export async function league(i: number, w: WorldApi) {
  const L = LEAGUE[i];
  if (i > 0 && !S.defeated.includes(`league_${i - 1}`)) return say('Devi prima superare il Superiore precedente.', L.name);
  await say([L.intro, i === 4 ? 'Sono il Campione. La prova finale: tutto ciò che hai imparato.' : `Sono ${L.title.toLowerCase()}.`], L.name);
  const topics = i < 4 ? LEAGUE_TOPICS[i] : trackTopics(S.track, S.mixedClasses, 8);
  // Lega: dal livello 3,25 del primo Superiore al livello 4 (esperto) dell'ultimo e del Campione
  const P = i === 4 ? DUEL.champion : DUEL.league;
  if (!S.flags[`league_${i}_p1`]) {
    if (!retryUnlocked(`league_${i}`)) return say(['Prima di riprovare, ripassa.', 'Fai il Ripasso in Biblioteca o leggi una lezione: le domande che hai sbagliato torneranno.'], L.name);
    const qs = withPreviousMistakes(`league_${i}`, pickQuestions(topics, P.n, { target: targetDiff(STAGE_LEAGUE + Math.min(i, 3)) }));
    const r = await runDuel({ foeName: L.name, foeTitle: L.title, foePal: L.palette, questions: qs, ...P });
    if (!r.win) { lockRetry(`league_${i}`, r.wrong); await say('Non sei ancora pronto. Torna dopo aver ripassato.', L.name); return defeatRespawn(w); }
    clearRetry(`league_${i}`);
    S.flags[`league_${i}_p1`] = true;
  }
  const trial = leagueTrial(i);
  if (!trial) {
    // Regole: lo sportello delle offerte, che non passa dal conto
    const res = await runMission(leagueMission(i));
    if (!res || !res.ok) return say(['La prova pratica non è riuscita.' + (res ? ' ' + res.detail : ''), 'Riprova quando vuoi: ripeterai solo la prova pratica.'], L.name);
  } else if (!(await accountTrial(trial, L.name))) return;
  reward({ defeated: `league_${i}`, rep: REWARD.rep.league, save: false });
  beep('win');
  await say(i === 4 ? ['Incredibile. Hai battuto il Campione!', `${S.name}, da oggi sei il nuovo Campione della Lega degli Investitori!`] : ['Hai superato la mia prova. Prosegui!'], L.name);
  if (i === 4) {
    S.flags.champion = true;
    await say(['Congratulazioni, Campione!', 'Il titolo non ti rende infallibile: i mercati cambiano, e chi smette di imparare torna principiante.', 'Da oggi in Clinica puoi anche aumentare il capitale del conto di gioco: è il privilegio dei Campioni.', 'Alla Torre delle Sfide ti aspettano le crisi leggendarie, i piani infiniti e i tre Boss dei Mercati, che si battono sui grafici veri.', 'E se vuoi, puoi iniziare una Nuova Partita+: riparte tutto da zero tranne i tuoi trofei, e si sblocca la difficoltà Leggenda.'], 'Prof. Saldi');
    const mirror = mirrorEpilogue();
    await say(mirror ? [...epilogue(), mirror] : epilogue(), 'Epilogo');
    await credits();
  }
  w.refresh();
  save();
}

export async function tower() {
  const opts = ['Torre delle Sfide (piani infiniti)', ...LEGENDS.map((l) => `Crisi leggendaria: ${l.title}${S.legends.includes(l.id) ? ' ✓' : ''}`), `Boss dei Mercati${Acc.graduated() ? '' : ' (dopo la Lega)'}`, `Nuova Partita+${Acc.graduated() ? '' : ' (dopo la Lega)'}`, 'Esci'];
  const c = await choose(opts, { cancel: true, prompt: `Record personale: piano ${S.tower.best}.`, who: 'Custode della Torre' });
  if (c < 0 || c === opts.length - 1) return;
  if (c === 0) {
    let floor = 0;
    const prevFid = S.stats.fiducia;
    S.stats.fiducia = 100;
    for (;;) {
      const diff = Math.min(4, 1 + Math.floor(floor / 3));
      const pool = trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole']);
      const qs = pickQuestions(pool, 3, { minDiff: diff, maxDiff: diff });
      const r = await runDuel({ foeName: `Piano ${floor + 1}`, foeTitle: 'Torre delle Sfide', foePal: 13, questions: qs, ...DUEL.tower });
      if (!r.win) break;
      floor++;
      if ((await choose(['Sali ancora', 'Fermati qui'], { prompt: `Piano ${floor} superato!` })) === 1) break;
    }
    S.stats.fiducia = prevFid;
    if (floor > S.tower.best) { S.tower.best = floor; await say(`Nuovo record: piano ${floor}!`, 'Custode della Torre'); }
    else await say(`Sei arrivato al piano ${floor}.`, 'Custode della Torre');
    save();
    return;
  }
  if (c <= LEGENDS.length) {
    const l = LEGENDS[c - 1];
    // le crisi leggendarie usano tutte le classi di attivo: è lì che si vede chi protegge e chi no
    const r = await runSim({ mission: l, classes: ['stocks', 'etf', 'crypto'] });
    if (r) recordMission(l.id, r);
    if (r?.ok && !S.legends.includes(l.id)) { S.legends.push(l.id); reward({ rep: REWARD.rep.legend, event: 'legend', save: false }); beep('badge'); await say(`Hai superato ${l.title}! Carta leggendaria ottenuta (cosmetica).`, 'Custode della Torre'); save(); }
    return;
  }
  if (opts[c].startsWith('Boss dei Mercati')) {
    if (!Acc.graduated()) return say(['I Boss dei Mercati sfidano solo i Campioni della Lega.', 'Si battono con un quiz e poi con una sola decisione su un grafico vero, che può durare ore o settimane.'], 'Custode della Torre');
    return bossMenu();
  }
  if (opts[c].startsWith('Nuova Partita+')) {
    if (!Acc.graduated()) return say(['La Nuova Partita+ è per chi ha vinto la Lega.', 'Ricomincia tutto da zero tranne i trofei, e sblocca la difficoltà Leggenda.'], 'Custode della Torre');
    // il percorso (anche il Sentiero Misto) si sceglie di nuovo dal Professore, come nella prima partita
    await say([
      'La Nuova Partita+ riparte da zero: conto di gioco con capitale nuovo, Attestati, Sigilli, Prove sul conto, Esame della Leva. Anche la Torre e i Boss tornano chiusi fino alla prossima Lega.',
      'Restano con te solo i trofei: record della Torre, crisi leggendarie, Boss battuti, carte dorate, traguardi, titolo e arredi. E resta il tuo Diario.',
      'In cambio si sblocca la difficoltà più alta, Leggenda, e i Mentori faranno domande più difficili.',
      'Una cosa pratica: i titoli che hai adesso restano nel tuo conto Alpaca Paper, ma escono dal registro del gioco. Se vuoi ripartire pulito, vendili prima da una Clinica.',
    ], 'Custode della Torre');
    const t = await choose(['Sì, ricomincio da zero', 'Annulla'], { cancel: true, prompt: 'Sicuro? Non si torna indietro.', who: 'Custode della Torre' });
    if (t !== 0) return;
    newGamePlus(S.track);
    applyDifficulty(await chooseDifficulty('Custode della Torre'));
    await say(['Fatto. Il Professore ti aspetta al Laboratorio per la nuova Valigetta.'], 'Custode della Torre');
    save();
    location.reload();
  }
}

const HERMIT_LINES: Record<string, { intro: string[]; win: string; again: string }> = {
  r3: { intro: ['Sei arrivato fin qui sull\'acqua? Allora la liquidità la sai usare.', 'Io compro e tengo per decenni. Vediamo se reggi le mie domande.'], win: 'Hai la pazienza del cassettista. Tieni questo studio extra, ti servirà.', again: 'Chi investe per decenni non ha bisogno di guardare il prezzo ogni giorno. Funziona anche con le isole.' },
  r5: { intro: ['Un prezzo diverso per la stessa cosa in due posti? Mi sveglio per questo.', 'Ma le occasioni vere sono rare e veloci. Rispondi in fretta e bene!'], win: 'Preciso come un arbitraggio. Ti lascio i miei appunti.', again: 'Quando un guadagno sembra senza rischio, cerca il rischio che non vedi.' },
  r7: { intro: ['Custodisco le riserve: la liquidità che non si tocca quando il mercato urla.', 'Solo chi ha mente fredda e liquidità arriva fin qui. Dimostralo.'], win: 'Riserve al sicuro, mente lucida. Sei pronto per la Lega.', again: 'Un fondo di emergenza vale più di qualsiasi previsione.' },
  faro: { intro: ['Il faro non dice alle navi dove andare: mostra solo dove sono gli scogli.', 'Un buon piano d\'investimento fa lo stesso. Vediamo se sai leggere la luce.'], win: 'Rotta sicura. Ricorda: gli scogli sono i costi, la leva e le promesse troppo belle.', again: 'Di notte gli scogli non si spostano. Sono le onde a farti credere di sì.' },
  perle: { intro: ['Le perle migliori stanno dove nessuno ha voglia di cercare, al buio.', 'Ma chi si tuffa senza conoscere il fondale non torna su. Dimostrami che lo conosci.'], win: 'Hai occhio per il valore nascosto. Questa è la perla più rara: la pazienza.', again: 'Prima di comprare, scendi sul fondo: leggi i conti, non solo il prezzo.' },
};

/** Abitante di un'Isola della Liquidità: un duello difficile una volta sola, senza perdere Fiducia. */
export async function hermit(n: NpcDef) {
  const key = String(n.data?.key ?? '');
  const h = HERMIT_LINES[key];
  const who = HERMITS[key.replace(/^r/, '')]?.name ?? n.name;
  if (!h) return say('...', who);
  if (S.flags[`islet_${key}`]) return say(h.again, who);
  await say(h.intro, who);
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, Math.max(3, S.badges)), 5, { target: targetDiff(Math.max(3, storyStage()) + 2) });
  const prevFid = S.stats.fiducia;
  const res = await runDuel({ foeName: who, foePal: n.pal, questions: qs, need: 4, damage: 0 });
  S.stats.fiducia = prevFid;
  if (!res.win) return say('Non ancora. Torna quando vuoi: l\'isola non si muove.', who);
  S.flags[`islet_${key}`] = true;
  reward({ xp: REWARD.xp.hermit, save: false });
  Object.keys(S.cards).forEach((id) => (card(id).xp += 20));
  track('islet');
  await say([h.win, '+120 punti Conoscenza e studio extra per tutte le tue carte.'], who);
  save();
}

export async function legend() {
  if (S.flags.legendMet) return say('La mente fredda vede ciò che il rumore nasconde. Torna quando vuoi.', 'Investitrice Leggendaria');
  await say(['Hai attraversato il Muro del Rumore. Pochi ci riescono.', 'Ti faccio cinque domande difficili. Se rispondi bene, ti lascio un dono di conoscenza.'], 'Investitrice Leggendaria');
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole']), 5, { target: targetDiff(STAGE_LEAGUE + 1) });
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: 'Investitrice Leggendaria', foePal: 14, questions: qs, need: 4, damage: 0 });
  S.stats.fiducia = prevFid;
  if (r.win) {
    S.flags.legendMet = true;
    reward({ xp: REWARD.xp.legend, save: false });
    Object.keys(S.cards).forEach((id) => (card(id).xp += 30));
    await say(['Eccellente. +200 punti Conoscenza e studio extra per tutte le tue carte.', 'Ricorda: la conoscenza è l\'unico vantaggio che nessuno può portarti via.'], 'Investitrice Leggendaria');
  } else await say('Non ancora. La conoscenza richiede tempo.', 'Investitrice Leggendaria');
}
