import { getMap, townOf, type NpcDef } from './maps';
import type { AssetClass, AssetDef, Question, Sector } from '../types';
import { S, save, slots, addRep, card, learnBias, clampStat, advanceDays, level, TECH, hasTech, classes, LIVE_LIMITS, newGamePlus } from '../systems/state';
import { say, choose, modal, toast, esc, wait } from '../ui/core';
import { runDuel } from '../ui/battle';
import { runSim } from '../ui/timemachine';
import { runPick } from '../ui/pick';
import { openClinic, trade } from '../ui/clinic';
import { portfolioSetup } from '../ui/setup';
import { openInvestidex, openLessons } from '../ui/menu';
import { pickQuestions, dailyQuestion, todayKey, reviewQueue } from '../systems/quiz';
import { mentorTopics, trackTopics, LEAGUE_TOPICS, byTopic } from '../data/quiz/build';
import { mentor, LEAGUE, antagonist, TOWNS, TRAINER_TIPS } from '../data/story';
import { mentorMission, leagueMission, LEGENDS, SANDBOX, HISTORY, type Mission } from '../data/missions';
import { weeklyChallenge } from '../ui/challenge';
import { ASSETS, ASSET_BY_ID, starterFor, unlockedAssets, SECTOR_LABEL } from '../data/assets';
import { TEMPTATIONS, BIAS_INFO } from '../data/events';
import { metrics, startPrice, marketClock } from '../systems/market';
import { PAL } from '../art/art';
import { beep } from '../systems/audio';
import { pick, shuffle, mulberry32 } from '../systems/rng';
import * as A from '../systems/alpaca';
import { RESIDENT_BY_ID, ALL_RESIDENTS } from '../data/residents';
import { track, rematchReady, scheduleRematch } from '../systems/progress';
import { questTalk } from './quests';
import { playMinigame } from '../ui/minigames';
import { jingle } from '../systems/music';

export interface WorldApi {
  warp(map: string, x: number, y: number, dir?: 0 | 1 | 2 | 3): void;
  refresh(): void;
  player(): { x: number; y: number };
  approach(npcId: string): Promise<void>;
  exclaim(npcId: string): Promise<void>;
  bumpBack(): void;
  town(): number;
}

const TRACK_LABEL: Record<string, string> = { stocks: 'Sentiero dei Titoli', etf: 'Sentiero degli Indici', crypto: 'Sentiero Cripto', mixed: 'Sentiero Misto' };

/** NPC visibile? (es. guardie sparite dopo la Medaglia, avversari già battuti) */
const KID_ROLES = new Set(['bambino', 'bambina', 'ragazzo', 'ragazza', 'studente']);
export function npcVisible(n: NpcDef): boolean {
  const night = marketClock().night;
  // orari della giornata: di notte i bambini dormono e i piccoli della piazza sono a casa
  if (night && n.kind === 'resident' && KID_ROLES.has(RESIDENT_BY_ID[String(n.data?.rid)]?.role ?? '')) return false;
  if (night && n.kind === 'talk' && /^Bambin|^Ragazz/.test(n.name)) return false;
  switch (n.kind) {
    case 'guard': return S.badges < (n.data?.badge as number);
    case 'aide': return !S.flags.starter;
    case 'rival': {
      const k = n.data?.n as number;
      if (k === 1) return !!S.flags.starter && !S.defeated.includes('rival_1');
      if (k === 4) return S.badges >= 8 && !S.defeated.includes('rival_4');
      return !S.defeated.includes(`rival_${k}`);
    }
    case 'case': return !S.flags.starter;
    case 'league': return !S.defeated.includes(`league_${n.data?.i}`);
    case 'speculator': return !S.defeated.includes(n.id);
    default: return true;
  }
}

export async function interact(n: NpcDef, w: WorldApi): Promise<void> {
  switch (n.kind) {
    case 'talk': return say(n.lines ?? ['...'], n.name);
    case 'mom': return mom();
    case 'resident': return resident(n);
    case 'aide': return say(['Aspetta! Non puoi partire senza una Valigetta.', 'Il Professore ti aspetta al Laboratorio, l\'edificio viola.'], 'Assistente');
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
    case 'librarian': return librarian();
    case 'daily': return daily();
    case 'station': return station(w);
    case 'simop': return simzone();
    case 'croupier': return casino();
    case 'archivist': return archivist();
    case 'league': return league(n.data?.i as number, w);
    case 'towerop': return tower();
    case 'legend': return legend();
    case 'sage': return say([pick(TRAINER_TIPS), `Il tuo livello di Conoscenza è ${level()}. Continua così!`], n.name);
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
    toast(`Consiglio annotato nell'Investidex (${S.tipsHeard.length}/${ALL_RESIDENTS.length})`);
    track('tip');
    return;
  }
  // dialoghi che ricordano: la seconda volta ripete, dalla terza commenta i tuoi progressi
  const extra = memoryLine(r.id, visits);
  await say(extra ? [extra, 'Comunque, te lo ripeto volentieri:', ...r.lines] : ['Ti ripeto volentieri quello che ti ho detto:', ...r.lines], who);
}

/** Una frase che dipende da quante volte ci siamo parlati e da cosa è successo nel frattempo. */
function memoryLine(id: string, visits: number): string {
  const seen = S.npcMemory[`${id}_b`] ?? 0;
  if (S.badges > seen) { S.npcMemory[`${id}_b`] = S.badges; if (visits > 0) return S.badges === 1 ? 'Ho saputo della tua prima Medaglia. Complimenti!' : `Ho saputo che hai già ${S.badges} Medaglie. Che strada hai fatto!`; }
  if (visits === 1) return 'Di nuovo tu! Sei tornato a trovarmi.';
  if (S.title && visits % 3 === 2) return `Dicono che ora ti chiamano «${S.title}».`;
  if (S.daily.streak >= 3 && visits % 3 === 0) return `Ho sentito che rispondi alla domanda del giorno da ${S.daily.streak} giorni di fila. Bravo!`;
  if (visits >= 4) return `Ci siamo già parlati ${visits} volte, non te lo dimenticare!`;
  return '';
}

async function mom() {
  if (!S.flags.starter) return say([`${S.name}, finalmente sei sveglio!`, 'Il Professor Saldi ti aspetta al Laboratorio, qui a Borgo Semina.', 'E ricorda: i soldi che servono per l\'affitto non si investono!'], 'Zia Mara');
  S.stats.fiducia = 100;
  beep('heal');
  return say(['Riposati un po\'. Ecco, la tua Fiducia è tornata al massimo.', 'Tuo zio diceva sempre: "Il mercato può restare irrazionale più a lungo di quanto tu resti solvibile".'], 'Zia Mara');
}

// ---------------- Prologo ----------------

async function prof(w: WorldApi) {
  if (!S.flags.starter) {
    if (!S.flags.profIntro) {
      await say(['Eccoti! Benvenuto nel mio Laboratorio.', 'Su quel tavolo ci sono tre Valigette. Ognuna contiene la prima Asset Card di un percorso diverso.', 'Blu: il Sentiero dei Titoli, le azioni delle aziende.', 'Verde: il Sentiero degli Indici, gli ETF.', 'Arancione: il Sentiero Cripto, la frontiera più rischiosa.', 'Avvicinati a una Valigetta per leggere la scheda. Oppure parla con me se vuoi un percorso misto.'], 'Prof. Saldi');
      S.flags.profIntro = true;
    }
    const c = await choose(['Guardo le Valigette', 'Vorrei il Sentiero Misto', 'Cos\'è la Licenza?'], { cancel: true, prompt: 'Allora, hai deciso?', who: 'Prof. Saldi' });
    if (c === 2) return licenseTalk();
    if (c !== 1) return;
    await say(['Il Sentiero Misto! Combinerai due o tre classi di attivo.', 'I Mentori 5 e 6 ti parleranno di asset allocation. Scegli le classi.'], 'Prof. Saldi');
    const sets: AssetClass[][] = [['stocks', 'etf'], ['stocks', 'crypto'], ['etf', 'crypto'], ['stocks', 'etf', 'crypto']];
    const s = await choose(['Titoli + ETF', 'Titoli + Cripto', 'ETF + Cripto', 'Titoli + ETF + Cripto', 'Ci ripenso'], { cancel: true });
    if (s < 0 || s === 4) return;
    S.mixedClasses = sets[s];
    return startTrack('mixed', w);
  }
  if (S.badges >= 8 && S.defeated.includes('league_4')) return say(['Campione! Sono fiero di te.', 'Alla Torre delle Sfide trovi le crisi leggendarie. E se vuoi, dalla Torre puoi iniziare una Nuova Partita+ in un altro percorso.'], 'Prof. Saldi');
  return say([`Il tuo percorso: ${TRACK_LABEL[S.track]}. Medaglie: ${S.badges}/8.`, S.badges === 0 ? 'Il primo Mentore, Gaia Primo, è a Ponte Cedola, oltre il Percorso 1.' : 'Continua così, e ricorda di passare dalle Cliniche.', 'E non fidarti di chi ti promette guadagni garantiti!'], 'Prof. Saldi');
}

async function licenseTalk() {
  await say(['Per ora giocherai con monete di prova: denaro finto, lezioni vere.', 'Batti il primo Mentore e potrai sostenere l\'Esame di Abilitazione per la Licenza di Investitore.', 'Con la Licenza potrai collegare il tuo vero wallet digitale, se lo vorrai, con limiti che crescono insieme alle tue Medaglie.', 'Ma potrai anche restare in prova per sempre: la storia non cambia.'], 'Prof. Saldi');
}

async function chooseCase(n: NpcDef, w: WorldApi) {
  const cls = n.data?.cls as AssetClass;
  const a = ASSET_BY_ID[starterFor(cls)];
  const info = {
    stocks: { stars: 3, vol: '15-30% annuo per i grandi indici, molto di più per i singoli titoli', dd: 'circa −57% (S&P 500, 2007-2009)', tone: 'Imprenditori, bilanci, aziende da conoscere' },
    etf: { stars: 2, vol: '15-18% annuo per un ETF azionario globale', dd: 'circa −50% nelle grandi crisi', tone: 'Pazienza, lungo termine, costi' },
    crypto: { stars: 5, vol: 'spesso sopra il 60% annuo', dd: 'circa −77% (Bitcoin, 2021-2022)', tone: 'Tecnologia, volatilità, truffe da evitare' },
  }[cls];
  const ok = await modal<boolean>(n.name, ({ body, button, close }) => {
    body.innerHTML = `<p><b>${TRACK_LABEL[cls]}</b></p>
      <p>Asset Card iniziale: <b>${esc(a.name)} (${a.ticker})</b> · ${SECTOR_LABEL[a.sector]}<br><span class="small">${esc(a.desc)}</span></p>
      <table class="t"><tr><td>Rischio della classe</td><td>${'★'.repeat(info.stars)}${'☆'.repeat(5 - info.stars)}</td></tr>
      <tr><td>Volatilità tipica</td><td>${info.vol}</td></tr><tr><td>Esempio di caduta storica</td><td>${info.dd}</td></tr>
      <tr><td>Antagonisti</td><td>${antagonist(cls).team}</td></tr><tr><td>Tono della storia</td><td>${info.tone}</td></tr></table>
      <p class="small muted">Il percorso non si cambia a metà partita: dopo la Lega potrai iniziare una Nuova Partita+ in un altro percorso.</p>`;
    button('Scelgo questa Valigetta', () => close(true), 'primary');
    button('Ci penso ancora', () => close(false));
  });
  if (!ok) return;
  await startTrack(cls, w);
}

async function startTrack(track: S_Track, w: WorldApi) {
  S.track = track;
  S.flags.starter = true;
  const first = track === 'mixed' ? S.mixedClasses[0] : (track as AssetClass);
  card(starterFor(first));
  beep('badge');
  await say([`Hai scelto il ${TRACK_LABEL[track]}!`, `Ricevi la Asset Card ${ASSET_BY_ID[starterFor(first)].name}. È entrata nel tuo Investidex.`], 'Prof. Saldi');
  await say(['Ah, eccola. La Dott.ssa Ratio è passata per aprirti il conto.'], 'Prof. Saldi');
  await portfolioSetup();
  await say(['Facciamo subito il primo acquisto, così vedi come funziona.', 'Un consiglio: non investire tutto in una volta, e guarda il riepilogo.'], 'Dott.ssa Ratio');
  await trade(true);
  await licenseTalk();
  await say(['Ah, e prendi questa: la Licenza da Apprendista. La trovi nel menu (tasto M), insieme all\'Investidex e al tuo Profilo.'], 'Prof. Saldi');
  save();
  w.refresh();
  await wait(200);
  await rivalIntro(w);
}

type S_Track = 'stocks' | 'etf' | 'crypto' | 'mixed';

// ---------------- Rivale ----------------

async function rivalIntro(w: WorldApi) {
  await w.approach('lab_rival');
  const style = S.profile === 'prudente' ? 'audace' : 'prudente';
  S.flags.rivalStyle = style;
  await say([`Ehi ${S.name}! Anch'io ho preso una Valigetta.`, style === 'audace' ? 'Io punto in alto: niente noiosa diversificazione, solo i titoli che salgono di più!' : 'Io vado sul sicuro: tengo quasi tutto liquido. Zero rischi!', 'Vediamo chi ne sa di più. Sfida!'], S.rival);
  await rivalDuel(1, w);
}

async function rival(n: NpcDef, w: WorldApi) {
  const k = n.data?.n as number;
  const lines: Record<number, string[]> = {
    2: [`${S.name}! Ti stavo aspettando.`, 'Ho guadagnato un sacco questa settimana. E tu?', 'Confrontiamo le nostre conoscenze... e i nostri portafogli!'],
    3: ['Anche tu a Diversia?', 'Qui tutti parlano di correlazioni. Io preferisco i risultati!'],
    4: ['Sapevo che saresti arrivato fin qui.', 'Prima della Lega, un\'ultima sfida tra noi due. Niente sconti!'],
  };
  await say(lines[k] ?? ['Sfida!'], S.rival);
  await rivalDuel(k, w);
}

async function rivalDuel(k: number, w: WorldApi) {
  const topics = trackTopics(S.track, S.mixedClasses, S.badges);
  const qs = pickQuestions(topics, 5, { maxDiff: k === 1 ? 1 : 3, preferReview: true });
  const r = await runDuel({ foeName: S.rival, foeTitle: 'Rivale', foePal: PAL.RIVAL, questions: qs, need: k === 1 ? 3 : 4, damage: 15 });
  if (!r.win) { await say(['Ah! Te l\'avevo detto.', 'Ripassa un po\' e riprova.'], S.rival); return defeatRespawn(w); }
  S.defeated.push(`rival_${k}`);
  addRep(40);
  beep('win');
  await say(['Uff, sai il fatto tuo...', k === 1 ? 'Ma il mercato vero è un\'altra cosa. Ci vediamo sul Percorso 2!' : 'Ma vediamo i portafogli!'], S.rival);
  if (k > 1) await comparePortfolios();
  w.refresh();
  save();
}

async function comparePortfolios() {
  const style = (S.flags.rivalStyle as string) ?? 'audace';
  const n = 120;
  const hist = S.market.history;
  const pool = ASSETS.filter((a) => classes().includes(a.cls));
  const picks = style === 'audace' ? pool.filter((a) => a.risk >= 4).slice(0, 2) : pool.filter((a) => a.risk <= 2).slice(0, 1);
  const chosen = picks.length ? picks : pool.slice(0, 1);
  const investedShare = style === 'audace' ? 1 : 0.25;
  const rv: number[] = [];
  for (let i = 0; i < n; i++) {
    let growth = 0;
    for (const a of chosen) { const h = hist[a.id].slice(-n); growth += (h[i] ?? h[h.length - 1]) / h[0] / chosen.length; }
    rv.push(10000 * (1 - investedShare + investedShare * growth));
  }
  const me = metrics(S.portfolio.valueHistory.slice(-n));
  const rm = metrics(rv);
  const row = (l: string, a: string, b: string) => `<tr><td>${l}</td><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  await modal('Confronto dei portafogli', ({ body, button, close }) => {
    body.innerHTML = `<p>Ultimi ${n} giorni di mercato. ${S.rival} ha uno stile <b>${style}</b>.</p>
      <table class="t"><tr><th></th><th class="n">${esc(S.name)}</th><th class="n">${esc(S.rival)}</th></tr>
      ${row('Rendimento', (me.ret * 100).toFixed(1) + '%', (rm.ret * 100).toFixed(1) + '%')}
      ${row('Volatilità', (me.vol * 100).toFixed(1) + '%', (rm.vol * 100).toFixed(1) + '%')}
      ${row('Max drawdown', '−' + (me.mdd * 100).toFixed(1) + '%', '−' + (rm.mdd * 100).toFixed(1) + '%')}
      ${row('Sharpe', me.sharpe.toFixed(2), rm.sharpe.toFixed(2))}</table>
      <p>${me.sharpe >= rm.sharpe ? 'Il tuo rendimento corretto per il rischio è migliore.' : `${esc(S.rival)} ha uno Sharpe migliore in questo periodo.`} ${rm.ret > me.ret && rm.vol > me.vol ? 'Ha guadagnato di più, ma con molte più oscillazioni: in un periodo diverso avrebbe potuto perdere molto.' : ''}</p>
      <p class="small muted">Lo Sharpe divide il rendimento per la volatilità: confronta in modo equo stili diversi.</p>`;
    button('Ok', () => close(), 'primary');
  });
}

// ---------------- Avversari ----------------

async function trainer(n: NpcDef, w: WorldApi) {
  if (S.defeated.includes(n.id)) {
    if (!rematchReady(n.id)) return say(pick(TRAINER_TIPS), n.name);
    // rivincita: domande più difficili, anche quelle che hai sbagliato
    await say(['Rieccoti! Ho studiato dall\'ultima volta.', 'Rivincita: stavolta le domande sono più toste!'], n.name);
    const rq = pickQuestions(trackTopics(S.track, S.mixedClasses, S.badges), 3, { preferReview: true, minDiff: 2, maxDiff: 3 });
    const rr = await runDuel({ foeName: n.name, foeTitle: 'Rivincita', foePal: n.pal, questions: rq, need: 2, damage: 12 });
    advanceDays(1);
    if (rr.win) { addRep(15); S.stats.xp += 20; track('rematch'); scheduleRematch(n.id); await say(['Battuto di nuovo! Ci rivediamo tra qualche giorno.', pick(TRAINER_TIPS)], n.name); }
    else { await say('Stavolta ho vinto io! Torna quando vuoi.', n.name); scheduleRematch(n.id); await defeatRespawn(w); }
    w.refresh();
    return;
  }
  await say(n.lines ?? ['Sfida!'], n.name);
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, S.badges), 3, { preferReview: true, maxDiff: Math.min(3, 1 + Math.floor((n.data?.r as number ?? 1) / 3)) });
  const r = await runDuel({ foeName: n.name, foePal: n.pal, questions: qs, need: 2, damage: 10 });
  if (r.win) scheduleRematch(n.id);
  await afterDuel(r.win, n.id, 20, w, n.name);
}

async function afterDuel(win: boolean, id: string, rep: number, w: WorldApi, who: string) {
  advanceDays(1);
  if (win) {
    S.defeated.push(id);
    addRep(rep);
    await say(['Complimenti, sei preparato!', pick(TRAINER_TIPS)], who);
  } else {
    await say('Ah! Ripassa e riprova.', who);
    await defeatRespawn(w);
  }
  w.refresh();
}

/**
 * Sconfitta in un duello: come nei classici, il giocatore si risveglia nella Clinica della città in cui si trova
 * (sui Percorsi, nell'ultima Clinica visitata; a casa se non ne ha ancora visitata una) con la Fiducia al massimo.
 */
async function defeatRespawn(w: WorldApi) {
  beep('lose');
  const tilt = S.stats.fiducia <= 0;
  const town = townOf(S.map);
  const dest = town !== undefined ? { map: `clinic_${town}`, x: 5, y: 4 } : S.lastClinic;
  const atHome = !dest.map.startsWith('clinic_');
  await say([
    tilt ? `${S.name} ha perso tutta la Fiducia ed è andato in tilt!` : `${S.name} non è riuscito a rispondere alle domande e ha perso la sfida.`,
    atHome ? 'Torni di corsa a casa per riprenderti.' : town !== undefined ? 'Torni di corsa alla Clinica della città per riprenderti.' : 'Torni di corsa all\'ultima Clinica visitata per riprenderti.',
  ], 'Sistema');
  if (tilt) S.stats.reputazione = Math.round(S.stats.reputazione * 0.95);
  S.stats.fiducia = 100;
  S.lastClinic = { ...dest };
  w.warp(dest.map, dest.x, dest.y, atHome ? 0 : 1);
  save();
  if (!atHome) await say(['Ecco fatto: la tua Fiducia è tornata al massimo.', 'Ripassa con calma e ritenta la sfida quando vuoi!'], 'Dott.ssa Ratio');
}

async function speculator(n: NpcDef, w: WorldApi) {
  const ant = antagonist(S.track);
  if (n.data?.boss) {
    await say([`Così sei tu che ostacoli ${ant.team}!`, `Io sono ${ant.boss}. Ti offro un affare: unisciti a noi e guadagnerai senza studiare.`], ant.boss);
    const c = await choose(['Mai!', 'Dimmi di più...'], { prompt: 'Cosa rispondi?' });
    if (c === 1) { clampStat('disciplina', -10); await say('Ah ah! Ti piacerebbe, eh? Ma prima dovrai battermi.', ant.boss); }
    const qs = pickQuestions(['regole', 'gestione', 'bias'], 6);
    const r = await runDuel({ foeName: ant.boss, foeTitle: `Capo di ${ant.team}`, foePal: PAL.SPEC, questions: qs, need: 5, damage: 15 });
    if (r.win) {
      S.defeated.push(n.id); addRep(150); clampStat('disciplina', 10);
      await say(['Impossibile... Le scorciatoie non funzionano con te.', `${ant.team} si ritira. Per ora.`], ant.boss);
    } else await defeatRespawn(w);
    w.refresh();
    return;
  }
  const t = pick(TEMPTATIONS);
  await say([`Psst! Faccio parte de${ant.team.startsWith('gli') ? 'gli' : ant.team.startsWith('i ') ? 'i' : 'lla'} ${ant.team.replace(/^(gli|i|la|l') ?/, '')}.`, t.text], 'Speculatore');
  const c = await choose(['Rifiuto', 'Accetto'], { prompt: 'Cosa fai?' });
  if (c === 0) { clampStat('disciplina', 5); await say(t.refuse, 'Tu'); }
  else {
    // nessuna perdita applicata al conto: è una lezione, non una penalità sul patrimonio
    clampStat('disciplina', -8);
    learnBias(t.bias);
    await say([t.accept, `Nella realtà avresti potuto perdere circa il ${Math.round(t.loss * 100)}% della liquidità. Questa trappola si chiama ${BIAS_INFO[t.bias].name}: ${BIAS_INFO[t.bias].effect}`], 'Narratore');
  }
  await say('Grr! Allora vediamo se sai anche rispondere!', 'Speculatore');
  const qs = pickQuestions(['regole', ...trackTopics(S.track, S.mixedClasses, S.badges)], 3);
  const r = await runDuel({ foeName: 'Speculatore', foeTitle: ant.team, foePal: PAL.SPEC, questions: qs, need: 2, damage: 10 });
  await afterDuel(r.win, n.id, 30, w, 'Speculatore');
}

/** Nessuno salta gli allievi: il Mentore si sfida solo dopo averli battuti tutti. */
export function allStudentsBeaten(m: number): boolean {
  return getMap(`academy_${m}`).npcs.filter((x) => x.kind === 'student').every((x) => S.defeated.includes(x.id));
}

async function student(n: NpcDef, w: WorldApi) {
  const m = n.data?.n as number;
  if (S.defeated.includes(n.id)) return say(['Il Mentore è là in fondo. Buona fortuna!', pick(TRAINER_TIPS)], n.name);
  await say('Prima di arrivare al Mentore devi superare me!', n.name);
  const qs = pickQuestions(mentorTopics(m, S.track, S.mixedClasses), 4, { maxDiff: 2 });
  const r = await runDuel({ foeName: n.name, foeTitle: 'Allievo dell\'Accademia', foePal: n.pal, questions: qs, need: 3, damage: 10 });
  advanceDays(1);
  if (r.win) { S.defeated.push(n.id); addRep(25); await say('Bravo! Sei pronto per il Mentore.', n.name); }
  else { await say('Studia in Biblioteca e torna!', n.name); await defeatRespawn(w); }
}

// ---------------- Mentori ----------------

async function mentorBattle(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  const done = S.badges >= m;
  if (done) return say([`Hai già la ${md.badge}.`, md.win], md.name);
  if (S.badges < m - 1) return say(['Sei arrivato qui troppo presto!', `Prima ti serve la Medaglia del Mentore ${S.badges + 1}.`], md.name);
  if (!allStudentsBeaten(m)) return say(['Benvenuto nella mia Accademia.', 'Prima di sfidarmi devi battere tutti i miei allievi.'], md.name);
  if (!S.flags[`m${m}_p1`]) {
    await say([md.intro, 'La sfida ha due fasi: un duello di conoscenza e una missione pratica nella Macchina del Tempo.'], md.name);
    const ok = (await choose(['Sono pronto!', 'Non ancora'], { prompt: 'Iniziamo?' })) === 0;
    if (!ok) return;
    const qs = pickQuestions(mentorTopics(m, S.track, S.mixedClasses), 8, { minDiff: m >= 4 ? 2 : 1 });
    const r = await runDuel({ foeName: md.name, foeTitle: `Mentore ${m}`, foePal: md.palette, questions: qs, need: 6, damage: 15, intro: md.intro, fixed: true });
    advanceDays(1);
    if (!r.win) { await say('Non ancora. Ripassa e torna: ti aspetto.', md.name); return defeatRespawn(w); }
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
  if (r?.ok && r.lossSales === 0 && r.orders > 0) S.flags.missionNoLossSale = true;
  return r ? { ok: r.ok, detail: r.detail } : null;
}

async function winBadge(m: number, w: WorldApi) {
  const md = mentor(m, S.track);
  S.badges = m;
  if (!S.techniques.includes(md.technique)) S.techniques.push(md.technique);
  addRep(200);
  S.stats.xp += 100;
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
  await say([md.win, `Hai ottenuto la ${md.badge}!`, `Nuova Tecnica: ${md.technique}. ${md.techDesc}`, `Slot di portafoglio: ${slots()}.`, newCards.length ? `Nuove Asset Card: ${newCards.map((a) => a.name).join(', ')}.` : ''].filter(Boolean), md.name);
  const extra: string[] = [];
  if (m === 1) extra.push('Ora puoi sostenere l\'Esame di Abilitazione per il conto reale, dalla Clinica (voce "Conto Alpaca"). È facoltativo.');
  if (m === 2) extra.push('Con l\'abbonamento al treno puoi viaggiare tra le città visitate dalle stazioni.');
  if (m === 5) extra.push('L\'Archivio di Bilancia ora è aperto.');
  if (m === 6) extra.push('Viaggio rapido sbloccato: lo trovi nel menu.');
  if (m === 8) extra.push('La Guardia della Lega ora ti lascerà passare. L\'Altopiano è oltre il Percorso 9.');
  if (extra.length) await say(extra, 'Prof. Saldi (messaggio)');
  w.refresh();
  save();
}

async function guard(n: NpcDef, w: WorldApi) {
  const b = n.data?.badge as number;
  if (n.data?.league) await say(['Alt! Solo chi possiede tutte e otto le Medaglie può entrare nella Lega.'], n.name);
  else await say([`Alt! Per proseguire serve la ${mentor(b, S.track).badge}.`, `La consegna il Mentore dell'Accademia di ${TOWNS[b].name}.`], n.name);
  w.bumpBack();
}

// ---------------- Edifici ----------------

async function librarian() {
  const c = await choose(['Lezioni', 'Ripasso delle domande sbagliate', 'Minigiochi didattici', 'Investidex', 'Niente, grazie'], { cancel: true, prompt: 'Benvenuto in Biblioteca! Cosa vuoi fare?', who: 'Bibliotecaria' });
  if (c === 0) return openLessons();
  if (c === 2) return playMinigame('Bibliotecaria');
  if (c === 3) return openInvestidex();
  if (c === 1) {
    const q = reviewQueue();
    if (!q.length) return say('Non hai domande da ripassare. Ottimo lavoro!', 'Bibliotecaria');
    const qs = shuffle(q).slice(0, 5);
    const prevFid = S.stats.fiducia;
    await runDuel({ foeName: 'Ripasso', foeTitle: 'Biblioteca', foePal: PAL.LIB, questions: qs, need: qs.length, damage: 0 });
    S.stats.fiducia = prevFid;
    track('review');
    return say('Il ripasso dilazionato è il modo migliore per ricordare.', 'Bibliotecaria');
  }
}

async function daily() {
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
  if (r.win) { S.stats.xp += 10 + Math.min(50, S.daily.streak * 5); track('daily_q'); }
  await say(r.win ? `Serie di ${S.daily.streak} giorni! Bonus di esperienza.` : 'La serie riparte da zero. Domani andrà meglio!', 'Professoressa del giorno');
  save();
}

async function station(w: WorldApi) {
  if (S.badges < 2) return say(['Stazione di Capitalia.', 'L\'abbonamento al treno si ottiene con la seconda Medaglia.'], 'Capostazione');
  const dests = TOWNS.filter((t) => S.visited.includes(t.id) && t.id !== `t${w.town()}`);
  if (!dests.length) return say('Non ci sono altre città visitate.', 'Capostazione');
  const c = await choose([...dests.map((t) => t.name), 'Annulla'], { cancel: true, prompt: 'Dove vuoi andare?', who: 'Capostazione' });
  if (c < 0 || c >= dests.length) return;
  advanceDays(1);
  travelTo(dests[c].id, w);
}

export function travelTo(id: string, w: WorldApi) {
  const n = Number(id.slice(1));
  if (n === 0) w.warp('t0', 11, 10, 0);
  else if (n === 9) w.warp('t9', 5, 12, 0);
  else w.warp(id, 26, 10, 0);
}

async function simzone() {
  const legendsBeaten = LEGENDS.filter((l) => S.legends.includes(l.id));
  const opts = [...SANDBOX.map((s) => s.name), ...legendsBeaten.map((l) => `Leggenda: ${l.title}`), 'Scenari storici (cosa successe davvero)', 'Minigiochi didattici', 'Sfida della settimana', 'Dati reali Alpaca (un simbolo)', 'Duello con codice (cavo link)', 'Esci'];
  const c = await choose(opts, { cancel: true, prompt: 'Zona Simulazione: sperimenta senza punteggio. Quale scenario?', who: 'Operatrice' });
  if (c < 0 || c === opts.length - 1) return;
  if (c < SANDBOX.length) { await runSim({ scenario: SANDBOX[c], sandbox: true }); return; }
  if (c < SANDBOX.length + legendsBeaten.length) { await runSim({ scenario: legendsBeaten[c - SANDBOX.length].scenario, sandbox: true }); return; }
  if (opts[c].startsWith('Scenari storici')) return historical();
  if (opts[c].startsWith('Minigiochi')) return playMinigame('Operatrice');
  if (opts[c].startsWith('Sfida della settimana')) return weeklyChallenge();
  if (opts[c].startsWith('Dati reali')) return realReplay();
  return linkDuel();
}

/** Scenari storici: cosa successe davvero e perché, poi la possibilità di riviverli senza punteggio. */
async function historical() {
  for (;;) {
    const c = await choose([...LEGENDS.map((l) => l.title), 'Esci'], { cancel: true, prompt: 'Quale crisi vuoi capire?', who: 'Operatrice' });
    if (c < 0 || c === LEGENDS.length) return;
    const l = LEGENDS[c];
    const h = HISTORY[l.id];
    const go = await modal<boolean>(l.title, ({ body, button, close }) => {
      body.innerHTML = `<p class="small muted">${esc(h.when)} · ${esc(l.scenario.historical ?? '')}</p><h4 style="margin:6px 0 2px">Cosa successe</h4><p>${esc(h.cause)}</p><h4 style="margin:6px 0 2px">La lezione</h4><p class="good">${esc(h.lesson)}</p><p class="small muted">Ricostruzione semplificata a scopo didattico: le cifre sono arrotondate e lo scenario nel gioco è una simulazione, non i prezzi reali.</p>`;
      button('Rivivi lo scenario', () => close(true), 'primary');
      button('Indietro', () => close(false));
    }, { wide: true });
    if (go) { S.flags[`hist_${l.id}`] = true; await runSim({ scenario: l.scenario, sandbox: true }); }
  }
}

async function realReplay() {
  const st = await A.serverStatus();
  if (!st || (!st.paper.configured && !st.live.configured)) return say(['Per i dati reali serve il server locale con le chiavi Alpaca (anche solo Paper).', 'Collegale dalla Clinica, voce "Conto Alpaca".'], 'Operatrice');
  const res = await modal<{ sym: string; start: string; end: string }>('Replay di dati reali', ({ body, button, close }) => {
    const y = new Date().getFullYear();
    body.innerHTML = `<p class="small">Riproduci le barre giornaliere reali di un simbolo scelto da te (dati Alpaca). Nessun consiglio: è solo un esercizio.</p>
      <label>Simbolo (es. un ticker USA o BTC/USD)<input class="tx s"></label>
      <div class="grid2"><label>Dal<input class="tx a" type="date" value="${y - 3}-01-01"></label><label>Al<input class="tx b" type="date" value="${y - 1}-12-31"></label></div>`;
    button('Avvia', () => close({ sym: (body.querySelector('.s') as HTMLInputElement).value.trim().toUpperCase(), start: (body.querySelector('.a') as HTMLInputElement).value, end: (body.querySelector('.b') as HTMLInputElement).value }), 'primary');
  });
  if (!res || !res.sym) return;
  try {
    const cls = res.sym.includes('/') ? 'crypto' : 'stocks';
    const { bars } = await A.bars(res.sym, cls, res.start, res.end);
    if (!bars || bars.length < 20) return say('Dati insufficienti per questo simbolo o periodo.', 'Operatrice');
    const def = { id: 'REAL', ticker: res.sym, name: res.sym, cls: (cls === 'crypto' ? 'crypto' : 'stocks') as AssetClass, sector: (cls === 'crypto' ? 'crypto' : 'world') as Sector, risk: 3 as const, mu: 0, sigma: 0.2, beta: 1, dividend: 0, desc: 'Dati reali', facts: [] as string[], unlock: 'real' } as AssetDef;
    await runSim({ scenario: { id: 'real', name: `${res.sym} ${res.start} → ${res.end}`, desc: 'Barre giornaliere reali da Alpaca. I rendimenti passati non garantiscono quelli futuri.', days: bars.length - 1, phases: [{ until: 9999, drift: 0, vol: 0 }], shocks: [] }, sandbox: true, dividends: false, custom: { assets: [{ ...def }], prices: { REAL: bars.map((b) => b.c) } } });
  } catch (e) { await say(`Errore: ${(e as Error).message}`, 'Operatrice'); }
}

async function linkDuel() {
  const c = await choose(['Genera un codice sfida', 'Inserisci il codice di un amico', 'Annulla'], { cancel: true, prompt: 'Duello con codice: tu e un amico giocate lo stesso scenario e lo stesso quiz.', who: 'Operatrice' });
  if (c < 0 || c === 2) return;
  let code = '';
  if (c === 0) { code = `TM-${S.track.slice(0, 1).toUpperCase()}${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`; await say([`Il tuo codice è ${code}. Condividilo con un amico che gioca lo stesso percorso.`, 'Ora gioca tu.'], 'Operatrice'); }
  else {
    const res = await modal<string>('Codice sfida', ({ body, button, close }) => { body.innerHTML = '<input class="tx c" placeholder="TM-S123456">'; button('Ok', () => close((body.querySelector('.c') as HTMLInputElement).value.trim().toUpperCase()), 'primary'); });
    if (!res) return; code = res;
  }
  const seed = Number(code.replace(/\D/g, '')) || 1;
  const rng = mulberry32(seed);
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, 8), 5, { rng });
  const prevFid = S.stats.fiducia;
  const q = await runDuel({ foeName: 'Duello con codice', foePal: 16, questions: qs, need: 5, damage: 0 });
  S.stats.fiducia = prevFid;
  const r = await runSim({ scenario: SANDBOX[0], seed, sandbox: true });
  const score = Math.round(q.correct * 100 + (r ? r.sharpe * 200 - r.mdd * 300 : 0));
  await say([`Risultato del duello ${code}: ${q.correct}/5 risposte, Sharpe ${r ? r.sharpe.toFixed(2) : '—'}, drawdown ${r ? (r.mdd * 100).toFixed(1) : '—'}%.`, `Punteggio: ${score}. Confrontalo con quello del tuo amico!`], 'Operatrice');
}

async function casino() {
  await say(['Benvenuto al Casinò dello Speculatore! Qui le fiches sono finte, ma la matematica è vera.', 'La roulette ha 37 caselle: 18 rosse, 18 nere e lo zero. Se punti sul rosso vinci 1:1, ma la probabilità è 18/37.', 'Il vantaggio del banco è del 2,7% su ogni puntata. È scritto qui sul tavolo.'], 'Croupier Speculatore');
  const c = await choose(['Prova il "Sistema Martingala" (simulazione di 200 giri)', 'Una puntata singola sul rosso', 'No, grazie'], { cancel: true, prompt: 'Cosa vuoi fare?', who: 'Croupier Speculatore' });
  if (c === 1) {
    const win = Math.random() < 18 / 37;
    await say(win ? 'Rosso! Hai vinto 10 fiches. Fortuna... per questa volta.' : 'Nero! Hai perso 10 fiches. Il banco ringrazia.', 'Croupier Speculatore');
  }
  if (c === 0) {
    let bank = 1000, bet = 10, maxBank = 1000, rounds = 0;
    const path: number[] = [bank];
    while (rounds < 200 && bank >= bet) {
      rounds++;
      if (Math.random() < 18 / 37) { bank += bet; bet = 10; } else { bank -= bet; bet *= 2; }
      maxBank = Math.max(maxBank, bank);
      path.push(bank);
    }
    const ruin = bank < bet;
    await say([`Partenza: 1.000 fiches, puntata base 10, raddoppio dopo ogni perdita.`, `Giri giocati: ${rounds}. Massimo raggiunto: ${maxBank}. Finale: ${bank} fiches.`, ruin ? `Una serie di sconfitte ha richiesto una puntata di ${bet} fiches: non potevi più coprirla. Rovina!` : 'Sei sopravvissuto questa volta, ma il rischio di rovina cresce a ogni giro: basta una serie di 7 sconfitte per perdere 1.270 fiches.', 'Lezione: piccoli guadagni frequenti e perdite rare ma enormi. È la martingala, ed è la stessa logica di molte strategie a leva.'], 'Croupier Speculatore');
    if (!S.flags.casinoLesson) { S.flags.casinoLesson = true; S.stats.xp += 30; toast('Investidex: nuova voce "Azzardo vs investimento"'); }
  }
}

async function archivist() {
  await say(['Benvenuto nell\'Archivio di Bilancia. Qui custodiamo i fascicoli di tutte le Asset Card.', 'Studiarli fa crescere il livello delle tue carte.'], 'Archivista');
  if (!S.flags.archiveBonus) {
    S.flags.archiveBonus = true;
    Object.keys(S.cards).forEach((id) => (card(id).xp += 40));
    S.stats.xp += 50;
    beep('coin');
    await say('Ho aggiunto 40 punti di studio a tutte le tue carte sbloccate.', 'Archivista');
  }
  await openLessons();
}

// ---------------- Lega ----------------

async function league(i: number, w: WorldApi) {
  const L = LEAGUE[i];
  if (i > 0 && !S.defeated.includes(`league_${i - 1}`)) return say('Devi prima superare il Superiore precedente.', L.name);
  await say([L.intro, i === 4 ? 'Sono il Campione. La prova finale: tutto ciò che hai imparato.' : `Sono ${L.title.toLowerCase()}.`], L.name);
  const topics = i < 4 ? LEAGUE_TOPICS[i] : trackTopics(S.track, S.mixedClasses, 8);
  const qs = pickQuestions(topics, i === 4 ? 12 : 10, { minDiff: 2 });
  if (!S.flags[`league_${i}_p1`]) {
    const r = await runDuel({ foeName: L.name, foeTitle: L.title, foePal: L.palette, questions: qs, need: i === 4 ? 10 : 8, damage: 15, fixed: true });
    if (!r.win) { await say('Non sei ancora pronto. Torna dopo aver ripassato.', L.name); return defeatRespawn(w); }
    S.flags[`league_${i}_p1`] = true;
  }
  const res = await runMission(leagueMission(i));
  if (!res || !res.ok) return say(['La prova pratica non è riuscita.' + (res ? ' ' + res.detail : ''), 'Riprova quando vuoi: ripeterai solo la prova pratica.'], L.name);
  S.defeated.push(`league_${i}`);
  addRep(300);
  beep('win');
  await say(i === 4 ? ['Incredibile. Hai battuto il Campione!', `${S.name}, da oggi sei il nuovo Campione della Lega degli Investitori!`] : ['Hai superato la mia prova. Prosegui!'], L.name);
  if (i === 4) {
    S.flags.champion = true;
    await say(['Congratulazioni, Campione!', 'Il titolo non ti rende infallibile: i mercati cambiano, e chi smette di imparare torna principiante.', 'Ora alla Torre delle Sfide ti aspettano le crisi leggendarie e i piani infiniti.', 'E se vuoi, puoi iniziare una Nuova Partita+ in un altro percorso, conservando avatar, record e carte dorate.'], 'Prof. Saldi');
    await credits();
  }
  w.refresh();
  save();
}

async function credits() {
  await modal('Tradermon · Titoli di coda', ({ body, button, close }) => {
    body.innerHTML = `<p><b>Grazie per aver giocato!</b></p><p>Medaglie: ${S.badges}/8 · Livello di Conoscenza: ${level()} · Reputazione: ${S.stats.reputazione}<br>Domande risposte: ${Object.values(S.answered).reduce((a, b) => a + b, 0)} · Tempo di gioco: ${Math.round(S.playMs / 60000)} minuti</p>
      <p class="small">Contenuti didattici basati su fonti pubbliche: SEC Investor.gov, Investopedia, Consob, Banca d'Italia (L'economia per tutti), CFA Institute, ESMA. Mondo, personaggi, grafica e suoni originali.</p>
      <p class="small muted">Tradermon è un gioco educativo e non fornisce consulenza finanziaria.</p>`;
    button('Continua', () => close(), 'primary');
  }, { closable: false });
}

async function tower() {
  const opts = ['Torre delle Sfide (piani infiniti)', ...LEGENDS.map((l) => `Crisi leggendaria: ${l.title}${S.legends.includes(l.id) ? ' ✓' : ''}`), 'Nuova Partita+', 'Esci'];
  const c = await choose(opts, { cancel: true, prompt: `Record personale: piano ${S.tower.best}.`, who: 'Custode della Torre' });
  if (c < 0 || c === opts.length - 1) return;
  if (c === 0) {
    let floor = 0;
    const prevFid = S.stats.fiducia;
    S.stats.fiducia = 100;
    for (;;) {
      const diff = Math.min(3, 1 + Math.floor(floor / 3)) as 1 | 2 | 3;
      const pool = trackTopics(S.track, S.mixedClasses, 8).concat(['macro', 'analisi', 'regole']);
      const qs = pickQuestions(pool, 3, { minDiff: diff, maxDiff: diff });
      const r = await runDuel({ foeName: `Piano ${floor + 1}`, foeTitle: 'Torre delle Sfide', foePal: 13, questions: qs, need: 3, damage: 34 });
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
    if (r?.ok && !S.legends.includes(l.id)) { S.legends.push(l.id); addRep(250); track('legend'); beep('badge'); await say(`Hai superato ${l.title}! Carta leggendaria ottenuta (cosmetica).`, 'Custode della Torre'); save(); }
    return;
  }
  if (opts[c] === 'Nuova Partita+') {
    const t = await choose(['Sentiero dei Titoli', 'Sentiero degli Indici', 'Sentiero Cripto', 'Annulla'], { cancel: true, prompt: 'Ricomincerai dall\'inizio in un altro percorso, conservando avatar, record e carte dorate. Sicuro?' });
    if (t < 0 || t === 3) return;
    newGamePlus((['stocks', 'etf', 'crypto'] as const)[t]);
    S.flags.starter = false;
    save();
    location.reload();
  }
}

async function legend() {
  if (S.flags.legendMet) return say('La mente fredda vede ciò che il rumore nasconde. Torna quando vuoi.', 'Investitrice Leggendaria');
  await say(['Hai attraversato il Muro del Rumore. Pochi ci riescono.', 'Ti faccio cinque domande difficili. Se rispondi bene, ti lascio un dono di conoscenza.'], 'Investitrice Leggendaria');
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, 8), 5, { minDiff: 3 });
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: 'Investitrice Leggendaria', foePal: 14, questions: qs, need: 4, damage: 0 });
  S.stats.fiducia = prevFid;
  if (r.win) {
    S.flags.legendMet = true;
    S.stats.xp += 200;
    Object.keys(S.cards).forEach((id) => (card(id).xp += 30));
    await say(['Eccellente. +200 punti Conoscenza e studio extra per tutte le tue carte.', 'Ricorda: la conoscenza è l\'unico vantaggio che nessuno può portarti via.'], 'Investitrice Leggendaria');
  } else await say('Non ancora. La conoscenza richiede tempo.', 'Investitrice Leggendaria');
}

export async function onEnterTown(id: string) {
  if (!S.visited.includes(id)) S.visited.push(id);
}

export function questionsFor(topic: Parameters<typeof byTopic>[0]): Question[] { return byTopic(topic); }
export { startPrice, hasTech, TECH };
