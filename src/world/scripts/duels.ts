// Duelli di conoscenza e missioni: allenatori, allievi, Mentori, Lega, Torre, eremiti, duelli condivisi e del giorno.
import { getMap, type NpcDef } from '../maps';
import { S, save, slots, addRep, card, learnBias, clampStat, advanceDays, classes, LIVE_LIMITS, newGamePlus } from '../../systems/state';
import { say, choose, modal } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { runSim } from '../../ui/timemachine';
import { runPick } from '../../ui/pick';
import { pickQuestions, SHARED_TOPICS, dailyQuestion, todayKey, reviewQueue, targetDiff, storyStage, STAGE_LEAGUE } from '../../systems/quiz';
import { mentorTopics, trackTopics, LEAGUE_TOPICS } from '../../data/quiz/build';
import { mentor, LEAGUE, antagonist, TOWNS, TRAINER_TIPS } from '../../data/story';
import { mentorBooks, TOPIC_LABEL } from '../../data/books';
import { DUEL, REWARD, TRAIT_HIGH } from '../../systems/balance';
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

export async function trainer(n: NpcDef, w: WorldApi) {
  if (S.defeated.includes(n.id)) {
    if (!rematchReady(n.id)) return say(pick(TRAINER_TIPS), n.name);
    // rivincita: domande più difficili, anche quelle che hai sbagliato
    await say(['Rieccoti! Ho studiato dall\'ultima volta.', 'Rivincita: stavolta le domande sono più toste!'], n.name);
    const rq = pickQuestions(trackTopics(S.track, S.mixedClasses, S.badges), DUEL.rematch.n, { preferReview: true, target: targetDiff(routeStage(n) + 2) });
    const rr = await runDuel({ foeName: n.name, foeTitle: 'Rivincita', foePal: n.pal, questions: rq, ...DUEL.rematch });
    advanceDays(1);
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
  advanceDays(1);
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
  const done = S.badges >= m;
  if (done) return mentorRematch(m, md);
  if (S.badges < m - 1) return say(['Sei arrivato qui troppo presto!', `Prima ti serve la Medaglia del Mentore ${S.badges + 1}.`], md.name);
  if (!allStudentsBeaten(m)) return say(['Benvenuto nella mia Accademia.', 'Prima di sfidarmi devi battere tutti i miei allievi.'], md.name);
  if (!S.flags[`m${m}_p1`]) {
    await say([md.intro, 'La sfida ha due fasi: un duello di conoscenza e una missione pratica nella Macchina del Tempo.'], md.name);
    const unread = mentorBooks(m, S.track, S.mixedClasses).filter((b) => !S.booksRead.includes(b.id)).length;
    if (unread) await say([`Un consiglio da Mentore: nella Biblioteca di ${TOWNS[m]?.name ?? 'questa città'} c'è la mia sezione, con i libri su ${mentorTopics(m, S.track, S.mixedClasses).map((t) => `«${TOPIC_LABEL[t]}»`).join(' e ')}.`, 'Le domande del duello vengono da lì.'], md.name);
    // dopo una sconfitta si torna solo dopo aver studiato: un libro della sezione o un ripasso in Biblioteca
    if (!retryUnlocked(`m${m}`)) return say(['Sei tornato presto. Prima di riprovare, studia.', `Leggi un libro della mia sezione nella Biblioteca di ${TOWNS[m]?.name ?? 'questa città'}, oppure fai il Ripasso: le domande che hai sbagliato sono lì ad aspettarti.`], md.name);
    if (S.stats.fiducia < 50) await say([`La tua Fiducia è a ${S.stats.fiducia}. Se arriva a zero durante il duello vai in tilt.`, 'Puoi riposare in Clinica prima di iniziare.'], md.name);
    const ok = (await choose(['Sono pronto!', 'Non ancora'], { prompt: 'Iniziamo?' })) === 0;
    if (!ok) return;
    // il Mentore m si affronta con m − 1 medaglie: dal livello 1 (Mentore 1) a quasi 3 (Mentore 8)
    const qs = withPreviousMistakes(`m${m}`, pickQuestions(mentorTopics(m, S.track, S.mixedClasses), DUEL.mentor.n, { target: targetDiff(m - 1) }));
    const r = await runDuel({ foeName: md.name, foeTitle: `Mentore ${m}`, foePal: md.palette, questions: qs, ...DUEL.mentor, intro: md.intro });
    advanceDays(1);
    if (!r.win) { lockRetry(`m${m}`, r.wrong); await say(['Non ancora. Ripassa e torna: ti aspetto.', 'Le domande che hai sbagliato torneranno nel prossimo duello.'], md.name); return defeatRespawn(w); }
    clearRetry(`m${m}`);
    S.flags[`m${m}_p1`] = true;
    S.flags[`m${m}_perfect`] = r.perfect;
    await say(['Ottimo duello! Ora la parte pratica.'], md.name);
  } else {
    await say(['Hai già superato il duello. Riproviamo la missione pratica?'], md.name);
  }
  const mission = mentorMission(m, S.track, S.profile);
  const res = await runMission(mission);
  if (!res) return say('Missione interrotta. Torna quando vuoi.', md.name);
  if (!res.ok) return say(['La missione non è riuscita: ' + res.detail, 'Riprova quando vuoi: ripeterai solo la missione.'], md.name);
  track('mission');
  await winBadge(m, w);
}

async function runMission(m: Mission): Promise<{ ok: boolean; detail: string } | null> {
  if (m.kind === 'pick') return runPick(m);
  await say(['Benvenuto nella Macchina del Tempo!', 'Usa il pulsante ▶ per far scorrere i giorni, compra e vendi quando vuoi. Gli asset sono quelli didattici della missione.'], 'Macchina del Tempo');
  const r = await runSim({ mission: m });
  if (!r) return null;
  if (r.ok && r.lossSales === 0 && r.orders > 0) S.flags.missionNoLossSale = true;
  // il processo conta anche se l'obiettivo non è raggiunto: le stelle danno Conoscenza e restano nella Cartella
  const pr = processReview(r);
  const prev = Number(S.flags[`${m.id}_stars`] ?? 0);
  if (pr.stars > prev) { S.flags[`${m.id}_stars`] = pr.stars; reward({ xp: (pr.stars - prev) * REWARD.xp.processStar, save: false }); }
  if (pr.stars === 3) { clampStat('disciplina', 3); clampStat('pazienza', 2); }
  return { ok: r.ok, detail: r.detail };
}

async function winBadge(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  S.badges = m;
  if (!S.techniques.includes(md.technique)) S.techniques.push(md.technique);
  reward({ rep: REWARD.rep.badge, xp: REWARD.xp.badge, save: false });
  // nuove carte sbloccate
  const newCards = unlockedAssets(S.track, S.mixedClasses, m).filter((a) => !S.cards[a.id]);
  newCards.forEach((a) => card(a.id));
  if (m === 1) S.license = S.license === 'apprendista' ? 'esame' : S.license;
  if (S.flags[`m${m}_perfect`]) {
    for (const p of S.portfolio.positions) { const c = card(p.id); if (c.xp >= 80) c.gold = true; }
  }
  if (S.license === 'investitore') {
    const L = LIVE_LIMITS[m];
    await say(`I tuoi limiti massimi per il conto reale salgono a ${L.order} $ per ordine e ${L.month} $ al mese. I tuoi limiti attuali restano quelli che hai scelto: puoi alzarli dalla Clinica.`, 'Dott.ssa Ratio');
  }
  beep('badge');
  jingle('badge');
  track('badge');
  await say([md.win, mentorCharacterLine(), `Hai ottenuto la ${md.badge}!`, `Nuova Tecnica: ${md.technique}. ${md.techDesc}`, `Slot di portafoglio: ${slots()}.`, newCards.length ? `Nuove Asset Card: ${newCards.map((a) => a.name).join(', ')}.` : ''].filter(Boolean), md.name);
  const extra: string[] = [];
  if (m === 1) extra.push('Ora puoi sostenere l\'Esame di Abilitazione per il conto reale, dalla Clinica (voce "Conto Alpaca"). È facoltativo.');
  if (m === 2) extra.push('Con l\'abbonamento al treno puoi viaggiare tra le città visitate dalle stazioni.');
  if (m === 5) extra.push('L\'Archivio di Bilancia ora è aperto.');
  if (m === SWIM_BADGE) extra.push(`Nuova abilità: ${ABILITY.swim.name}. Cammina verso l'acqua e la attraverserai su una zattera. Sui Percorsi 3, 5 e 7 ci sono isole da raggiungere.`);
  if (m === ABILITY.cut.badge) extra.push(`Nuova abilità: ${ABILITY.cut.name}. Ora puoi frantumare i Massi delle Commissioni: prova la Galleria del Dark Pool sul Percorso 2.`);
  if (m === ABILITY.dark.badge) extra.push(`Nuova abilità: ${ABILITY.dark.name}. Le grotte buie non ti fermano più: la Miniera dei Lingotti sul Percorso 5 porta dritta a Valdividendo.`);
  if (m === TRANSFER_BADGE) extra.push(`Nuova abilità: ${ABILITY.transfer.name}. Apri il menu, scegli "Mappa della Regione" e trasferisciti in una città già visitata.`);
  if (m === 8) extra.push('La Guardia della Lega ora ti lascerà passare. L\'Altopiano è oltre il Percorso 9.');
  if (extra.length) await say(extra, 'Prof. Saldi (messaggio)');
  w.refresh();
  save();
}

export async function guard(n: NpcDef, w: WorldApi) {
  const b = n.data?.badge as number;
  if (n.data?.league) await say(['Alt! Solo chi possiede tutte e otto le Medaglie può entrare nella Lega.'], n.name);
  else await say([`Alt! Per proseguire serve la ${mentor(b, S.track).badge}.`, `La consegna il Mentore dell'Accademia di ${TOWNS[b].name}.`], n.name);
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
  await runDuel({ foeName: 'Ripasso', foeTitle: 'Biblioteca', foePal: PAL.LIB, questions: qs, need: qs.length, damage: 0 });
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
  const c = await choose(['Genera un codice sfida', 'Inserisci il codice di un amico', 'Annulla'], { cancel: true, prompt: 'Duello con codice: tu e un amico giocate lo stesso scenario e lo stesso quiz, qualunque sia il vostro percorso.', who: 'Operatrice' });
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
  const q = await runDuel({ foeName: 'Duello con codice', foePal: 16, questions: qs, need: 5, damage: 0 });
  S.stats.fiducia = prevFid;
  const r = await runSim({ scenario: SANDBOX[0], seed, sandbox: true, classes: ['stocks', 'etf', 'crypto'] });
  const score = Math.round(q.correct * 100 + (r ? r.sharpe * 200 - r.mdd * 300 : 0));
  await say([`Risultato del duello ${code}: ${q.correct}/5 risposte, Sharpe ${r ? r.sharpe.toFixed(2) : '—'}, drawdown ${r ? (r.mdd * 100).toFixed(1) : '—'}%.`, `Punteggio: ${score}. Confrontalo con quello del tuo amico!`], 'Operatrice');
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
  const res = await runMission(leagueMission(i));
  if (!res || !res.ok) return say(['La prova pratica non è riuscita.' + (res ? ' ' + res.detail : ''), 'Riprova quando vuoi: ripeterai solo la prova pratica.'], L.name);
  reward({ defeated: `league_${i}`, rep: REWARD.rep.league, save: false });
  beep('win');
  await say(i === 4 ? ['Incredibile. Hai battuto il Campione!', `${S.name}, da oggi sei il nuovo Campione della Lega degli Investitori!`] : ['Hai superato la mia prova. Prosegui!'], L.name);
  if (i === 4) {
    S.flags.champion = true;
    await say(['Congratulazioni, Campione!', 'Il titolo non ti rende infallibile: i mercati cambiano, e chi smette di imparare torna principiante.', 'Ora alla Torre delle Sfide ti aspettano le crisi leggendarie e i piani infiniti.', 'E se vuoi, puoi iniziare una Nuova Partita+ in un altro percorso, conservando avatar, record e carte dorate.'], 'Prof. Saldi');
    await say(epilogue(), 'Epilogo');
    await credits();
  }
  w.refresh();
  save();
}

export async function tower() {
  const opts = ['Torre delle Sfide (piani infiniti)', ...LEGENDS.map((l) => `Crisi leggendaria: ${l.title}${S.legends.includes(l.id) ? ' ✓' : ''}`), 'Nuova Partita+', 'Esci'];
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
    const r = await runSim({ mission: l });
    if (r?.ok && !S.legends.includes(l.id)) { S.legends.push(l.id); reward({ rep: REWARD.rep.legend, event: 'legend', save: false }); beep('badge'); await say(`Hai superato ${l.title}! Carta leggendaria ottenuta (cosmetica).`, 'Custode della Torre'); save(); }
    return;
  }
  if (opts[c] === 'Nuova Partita+') {
    const t = await choose(['Sentiero dei Titoli', 'Sentiero degli Indici', 'Sentiero Cripto', 'Sentiero Misto (tutte le classi)', 'Annulla'], { cancel: true, prompt: 'Ricomincerai dall\'inizio in un altro percorso, conservando avatar, record e carte dorate. Sicuro?' });
    if (t < 0 || t === 4) return;
    newGamePlus((['stocks', 'etf', 'crypto', 'mixed'] as const)[t]);
    if (t === 3) S.mixedClasses = ['stocks', 'etf', 'crypto'];
    await say(['Nuova Partita+: i Mentori faranno domande più difficili e una domanda su due avrà numeri nuovi.', 'Le carte dorate, i record della Torre e le Leggende restano con te.'], 'Custode della Torre');
    S.flags.starter = false;
    save();
    location.reload();
  }
}

const HERMIT_LINES: Record<string, { intro: string[]; win: string; again: string }> = {
  r3: { intro: ['Sei arrivato fin qui sull\'acqua? Allora la liquidità la sai usare.', 'Io compro e tengo per decenni. Vediamo se reggi le mie domande.'], win: 'Hai la pazienza del cassettista. Tieni questo studio extra, ti servirà.', again: 'Compra bene e dimentica di guardare ogni giorno. Funziona anche con le isole.' },
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
