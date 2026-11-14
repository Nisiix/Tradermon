// Luoghi: Biblioteche, stazioni, Zona Simulazione, Archivio, casinò, titoli di coda.
import { type NpcDef } from '../maps';
import type { AssetClass, AssetDef, QuizTopic, Sector } from '../../types';
import { S, addRep, card, level } from '../../systems/state';
import { say, choose, modal, toast, esc } from '../../ui/core';
import { runSim } from '../../ui/timemachine';
import { openLessons } from '../../ui/menu';
import { mentorTopics } from '../../data/quiz/build';
import { TOWNS } from '../../data/story';
import { booksFor, TOPIC_LABEL, type Book } from '../../data/books';
import { REP_TIERS, REWARD } from '../../systems/balance';
import { repTier, TIER_ARCHIVE } from '../../systems/character';
import type { Section } from '../maps';
import { LEGENDS, SANDBOX, HISTORY } from '../../data/missions';
import { weeklyChallenge } from '../../ui/challenge';
import { beep } from '../../systems/audio';
import * as A from '../../systems/alpaca';
import { track } from '../../systems/progress';
import { topicOpened } from '../../systems/quiz';
import { playMinigame } from '../../ui/minigames';
import { reward, type WorldApi } from './common';
import { linkDuel, missionDesk } from './duels';
import { tick } from '../../systems/account';
import { T } from '../../i18n';

export async function librarian(n: NpcDef) {
  const town = Number(n.data?.town ?? 0);
  if (town && !S.flags[`lib_intro_${town}`]) {
    S.flags[`lib_intro_${town}`] = true;
    await say([
      T('Benvenut{o|a} in Biblioteca! Qui si studia: ogni libro spiega un piccolo argomento, in poche pagine.'),
      T`In alto a sinistra ci sono i temi di ${TOWNS[town]?.name ?? T('questa città')}: ${cityTopics(town).map((t) => `«${TOPIC_LABEL[t]}»`).join(T(' e '))}. Sono gli argomenti di cui si discute qui, dentro e fuori dall'Exchange.`,
      T('A destra i temi delle città che hai già attraversato: lungo i Percorsi tornano spesso. In basso le regole contro le truffe e, a destra, macroeconomia e analisi.'),
      T('Avvicinati a uno scaffale e premi il tasto di conferma.'),
    ], T('Bibliotecaria'));
  }
  const shelves = librarySections(town);
  const opts = [...shelves.map((x) => x.label), T('Lezioni'), T('Niente, grazie')];
  const c = await choose(opts, { cancel: true, prompt: T('Benvenut{o|a} in Biblioteca! Quale scaffale vuoi consultare?'), who: T('Bibliotecaria') });
  if (c >= 0 && c < shelves.length) return shelves[c].open();
  if (c === shelves.length) return openLessons();
}

/** Temi della città n: quelli dell'Exchange e della sua Whale, gli stessi degli sfidanti incontrati fin lì. */
function cityTopics(n: number): QuizTopic[] {
  return n ? mentorTopics(n, S.track, S.mixedClasses) : [];
}

/** Temi delle città prima della n, senza ripetere quelli della città: lungo i Percorsi si ripassa anche questo. */
function pastTopics(n: number): { topic: QuizTopic; town: number }[] {
  const own = cityTopics(n), out: { topic: QuizTopic; town: number }[] = [];
  for (let i = 1; i < n; i++) for (const t of cityTopics(i)) if (!own.includes(t) && !out.some((x) => x.topic === t)) out.push({ topic: t, town: i });
  return out;
}

const readCount = (t: QuizTopic) => { const bs = booksFor([t]); return `${bs.filter((b) => S.booksRead.includes(b.id)).length}/${bs.length}`; };

/** Gli scaffali della Biblioteca della città n, nello stesso ordine in cui stanno nella stanza. */
function librarySections(n: number): { kind: Section['kind']; label: string; open: () => Promise<void> }[] {
  return [
    { kind: 'city', label: T`Temi di ${TOWNS[n]?.name ?? T('questa città')}`, open: () => cityShelf(n) },
    { kind: 'past', label: T('Città già attraversate'), open: () => pastShelf(n) },
    { kind: 'rules', label: T('Regole e truffe'), open: () => topicShelf('regole') },
    { kind: 'economy', label: T('Economia e analisi'), open: () => pickTopic(T('ECONOMIA E ANALISI'), ['macro', 'analisi'].map((t) => ({ topic: t as QuizTopic }))) },
  ];
}

/** Se lo scaffale ha più temi si sceglie il tema, poi il piccolo argomento. */
async function pickTopic(title: string, topics: { topic: QuizTopic; town?: number }[], allRead?: () => Promise<void>) {
  if (topics.length === 1) return topicShelf(topics[0].topic, allRead);
  for (;;) {
    const label = (x: { topic: QuizTopic; town?: number }) => `${TOPIC_LABEL[x.topic]}${x.town ? ` · ${TOWNS[x.town]?.name ?? ''}` : ''} (${readCount(x.topic)})`;
    const c = await choose([...topics.map(label), T('Rimetto a posto')], { cancel: true, title });
    if (c < 0 || c === topics.length) return;
    await topicShelf(topics[c].topic, allRead);
  }
}

/** Un ripiano: i piccoli argomenti di un tema. Si sceglie un libro, lo si legge, la prima lettura dà Conoscenza. In fondo, le lezioni sullo stesso tema. */
async function topicShelf(topic: QuizTopic, allRead?: () => Promise<void>) {
  const books = booksFor([topic]);
  for (;;) {
    const read = (b: Book) => S.booksRead.includes(b.id);
    const c = await choose([...books.map((b) => `${read(b) ? '✓ ' : '• '}${b.title}`), T('Lezioni su questo tema'), T('Rimetto a posto')], { cancel: true, title: TOPIC_LABEL[topic].toUpperCase() });
    if (c < 0 || c === books.length + 1) return;
    if (c === books.length) { await openLessons([topic]); continue; }
    const b = books[c];
    await say(b.pages, b.title);
    if (!read(b)) {
      S.booksRead.push(b.id); reward({ xp: REWARD.xp.book, event: 'lesson', save: false });
      await allRead?.();
    }
  }
}

/** Scaffale dei temi della città: chi ne legge tutti i libri guadagna Reputazione, una volta sola. */
async function cityShelf(n: number) {
  if (!n) return say(T('Questa Biblioteca non ha temi di una città.'), T('Bibliotecaria'));
  const topics = cityTopics(n);
  return pickTopic(T`TEMI DI ${(TOWNS[n]?.name ?? '').toUpperCase()}`, topics.map((topic) => ({ topic })), async () => {
    if (S.flags[`shelf_${n}`] || !booksFor(topics).every((b) => S.booksRead.includes(b.id))) return;
    S.flags[`shelf_${n}`] = true;
    reward({ rep: REWARD.rep.bookSection, save: false });
    await say(T`Hai letto tutti i libri sui temi di ${TOWNS[n]?.name ?? T('questa città')}. Reputazione +10.`, T('Bibliotecaria'));
  });
}

async function pastShelf(n: number) {
  const past = pastTopics(n);
  if (!past.length) return say([T('Qui finiscono i temi delle città che hai già attraversato.'), T('Questa è la prima città del viaggio: lo scaffale si riempirà strada facendo.')], T('Bibliotecaria'));
  return pickTopic(T('CITTÀ GIÀ ATTRAVERSATE'), past);
}

/**
 * Avviso sulla porta di un Exchange (o di Wall Street) per chi sta per entrare senza aver mai aperto i libri dei suoi
 * temi: dice di che cosa si discute lì dentro e dove lo si studia. Compare una volta sola e non blocca: al passo
 * successivo si entra. Restituisce le righe da mostrare, oppure null se non c'è nulla da dire.
 */
export function doorNotice(to: string): string[] | null {
  const m = Number(/^academy_(\d+)$/.exec(to)?.[1] ?? 0);
  if (m) {
    const topics = cityTopics(m);
    if (S.badges !== m - 1 || S.flags[`doorNotice_${m}`] || topics.some(topicOpened)) return null;
    S.flags[`doorNotice_${m}`] = true;
    return [
      T`Sulla porta dell'Exchange c'è un avviso: «Qui si discute di ${topics.map((t) => TOPIC_LABEL[t]).join(', ')}. Allievi e Whale non fanno sconti: chi sbaglia perde Fiducia.»`,
      T`«I libri su questi temi sono nella Biblioteca di ${TOWNS[m]?.name ?? T('questa città')}, sullo scaffale in alto a sinistra. Chi li ha letti entra preparato.»`,
      T('Quei libri non li hai ancora aperti. La porta non è chiusa: decidi tu quando entrare.'),
    ];
  }
  if (to === 'league') {
    if (S.badges < 8 || S.flags.doorNotice_league || topicOpened('macro') || topicOpened('analisi')) return null;
    S.flags.doorNotice_league = true;
    return [
      T`Sulla porta di Wall Street c'è un avviso: «Qui si discute di ${TOPIC_LABEL.macro}, ${TOPIC_LABEL.analisi} e ${TOPIC_LABEL.regole}, poi di tutto ciò che hai studiato finora.»`,
      T('«I libri su questi temi sono negli scaffali Economia e analisi e Regole e truffe, in ogni Biblioteca.»'),
      T('Quei libri non li hai ancora aperti. La porta non è chiusa: decidi tu quando entrare.'),
    ];
  }
  return null;
}

/** Interazione con uno scaffale della Biblioteca (vedi Section in maps.ts). */
export async function librarySection(sec: Section, town: number) {
  return librarySections(town).find((x) => x.kind === sec.kind)?.open();
}

export async function station(w: WorldApi) {
  if (S.badges < 2) return say([T('Stazione di Capitalia.'), T('L\'abbonamento al treno lo avrai con il secondo Attestato.')], T('Capostazione'));
  const dests = TOWNS.filter((t) => S.visited.includes(t.id) && t.id !== `t${w.town()}`);
  if (!dests.length) return say(T('Non ci sono altre città visitate.'), T('Capostazione'));
  const c = await choose([...dests.map((t) => t.name), T('Annulla')], { cancel: true, prompt: T('Dove vuoi andare?'), who: T('Capostazione') });
  if (c < 0 || c >= dests.length) return;
  tick();
  travelTo(dests[c].id, w);
}

export function travelTo(id: string, w: WorldApi) {
  const n = Number(id.slice(1));
  if (n === 0) w.warp('t0', 11, 10, 0);
  else if (n === 9) w.warp('t9', 5, 12, 0);
  else w.warp(id, 26, 10, 0);
}

export async function simzone() {
  const legendsBeaten = LEGENDS.filter((l) => S.legends.includes(l.id));
  const opts = [T('Missioni della Macchina del Tempo'), ...SANDBOX.map((s) => s.name), ...legendsBeaten.map((l) => `Leggenda: ${l.title}`), T('Crisi storiche (cosa successe davvero)'), T('Minigiochi didattici'), T('Sfida della settimana'), T('Dati reali Alpaca (un simbolo a scelta)'), T('Duello con codice (cavo link)'), T('Esci')];
  const c = await choose(opts, { cancel: true, prompt: T('Zona Simulazione, la casa della Macchina del Tempo: qui si rivivono periodi veri di mercato. Sigilli e Wall Street si guadagnano invece sul conto, con il mercato di oggi. Che cosa vuoi fare?'), who: T('Operatrice') });
  if (c < 0 || c === opts.length - 1) return;
  if (c === 0) return missionDesk();
  if (c - 1 < SANDBOX.length) { await runSim({ scenario: SANDBOX[c - 1], sandbox: true }); return; }
  if (c - 1 < SANDBOX.length + legendsBeaten.length) { await runSim({ scenario: legendsBeaten[c - 1 - SANDBOX.length].scenario, sandbox: true, classes: ['stocks', 'etf', 'crypto'] }); return; }
  if (opts[c] === T('Crisi storiche (cosa successe davvero)')) return historical();
  if (opts[c] === T('Minigiochi didattici')) return playMinigame(T('Operatrice'));
  if (opts[c] === T('Sfida della settimana')) return weeklyChallenge();
  if (opts[c] === T('Dati reali Alpaca (un simbolo a scelta)')) return realReplay();
  return linkDuel();
}

/** Crisi storiche: cosa successe davvero e perché. Quelle dal 2016 in poi si possono rivivere sui dati reali. */
async function historical() {
  const ids = Object.keys(HISTORY);
  const TITLES: Record<string, string> = { leg1929: T('Il Grande Crollo (1929)'), leg2000: T('La bolla dot-com (2000)'), leg2008: T('La crisi finanziaria (2008)') };
  for (;;) {
    const title = (id: string) => LEGENDS.find((l) => l.id === id)?.title ?? TITLES[id] ?? id;
    const c = await choose([...ids.map(title), T('Esci')], { cancel: true, prompt: T('Quale crisi vuoi capire?'), who: T('Operatrice') });
    if (c < 0 || c === ids.length) return;
    const id = ids[c];
    const l = LEGENDS.find((x) => x.id === id);
    const h = HISTORY[id];
    const go = await modal<boolean>(title(id), ({ body, button, close }) => {
      body.innerHTML = T`<p class="small muted">${esc(h.when)}${l?.scenario.historical ? ' · ' + esc(l.scenario.historical) : ''}</p><h4 style="margin:6px 0 2px">Cosa successe</h4><p>${esc(h.cause)}</p><h4 style="margin:6px 0 2px">La lezione</h4><p class="good">${esc(h.lesson)}</p><p class="small muted">${l ? T('Il replay usa i prezzi reali di quel periodo, scaricati da Alpaca con il tuo conto.') : T('Questa crisi è raccontata ma non si può rivivere: lo storico dei dati di Alpaca parte dal 2016 e il gioco non ricostruisce prezzi.')} Le cifre nel racconto sono arrotondate.</p>`;
      if (l) button(T('Rivivi sui dati reali'), () => close(true), 'primary');
      button(T('Indietro'), () => close(false));
    }, { wide: true });
    S.flags[`hist_${id}`] = true;
    if (go && l) await runSim({ scenario: l.scenario, sandbox: true, classes: ['stocks', 'etf', 'crypto'] });
  }
}

async function realReplay() {
  const st = await A.serverStatus();
  if (!st) return say(A.noServerLines(T('il replay di dati reali')), T('Operatrice'));
  if (!st.paper.configured) return say([T('Per i prezzi veri serve il conto Alpaca Paper collegato.'), T('Collegalo dal menu, voce "Chiavi API".')], T('Operatrice'));
  const res = await modal<{ sym: string; start: string; end: string }>(T('Replay di dati reali'), ({ body, button, close }) => {
    const y = new Date().getFullYear();
    body.innerHTML = T`<p class="small">Riproduci le barre giornaliere reali di un simbolo scelto da te (dati Alpaca, dal 2016). Qui nulla è nascosto: sei tu a scegliere che cosa guardare. Nessun consiglio: è solo un esercizio.</p>
      <label>Simbolo (es. un ticker USA o BTC/USD)<input class="tx s"></label>
      <div class="grid2"><label>Dal<input class="tx a" type="date" value="${y - 3}-01-01"></label><label>Al<input class="tx b" type="date" value="${y - 1}-12-31"></label></div>`;
    button(T('Avvia'), () => close({ sym: (body.querySelector('.s') as HTMLInputElement).value.trim().toUpperCase(), start: (body.querySelector('.a') as HTMLInputElement).value, end: (body.querySelector('.b') as HTMLInputElement).value }), 'primary');
  });
  if (!res || !res.sym) return;
  try {
    const cls = res.sym.includes('/') ? 'crypto' : 'stocks';
    const { bars } = await A.bars(res.sym, cls, res.start, res.end);
    if (!bars || bars.length < 20) return say(T('Dati insufficienti per questo simbolo o periodo.'), T('Operatrice'));
    const def = { id: 'REAL', ticker: res.sym, name: res.sym, cls: (cls === 'crypto' ? 'crypto' : 'stocks') as AssetClass, sector: (cls === 'crypto' ? 'crypto' : 'world') as Sector, risk: 3 as const, mu: 0, sigma: 0.2, beta: 1, dividend: 0, desc: T('Dati reali'), facts: [] as string[], unlock: 'real' } as AssetDef;
    await runSim({ scenario: { id: 'real', name: `${res.sym} ${res.start} → ${res.end}`, desc: T('Barre giornaliere reali da Alpaca. I rendimenti passati non garantiscono quelli futuri.'), window: { start: res.start, end: res.end } }, sandbox: true, dividends: false, custom: { assets: [{ ...def }], prices: { REAL: bars.map((b) => b.c) }, labels: bars.map((b) => b.t) } });
  } catch (e) { await say(`Errore: ${(e as Error).message}`, T('Operatrice')); }
}

export async function casino() {
  await say([T('Benvenut{o|a} al Casinò dello Speculatore! Qui le fiches sono finte, ma la matematica è vera.'), T('La roulette ha 37 caselle: 18 rosse, 18 nere e lo zero. Se punti sul rosso vinci 1:1, ma la probabilità è 18/37.'), T('Il vantaggio del banco è del 2,7% su ogni puntata. È scritto qui sul tavolo.')], T('Croupier Speculatore'));
  const c = await choose([T('Prova il "Sistema Martingala" (simulazione di 200 giri)'), T('Una puntata singola sul rosso'), T('No, grazie')], { cancel: true, prompt: T('Cosa vuoi fare?'), who: T('Croupier Speculatore') });
  if (c === 1) {
    const win = Math.random() < 18 / 37;
    await say(win ? T('Rosso! Hai vinto 10 fiches. Fortuna... per questa volta.') : T('Nero! Hai perso 10 fiches. Il banco ringrazia.'), T('Croupier Speculatore'));
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
    await say([T`Partenza: 1.000 fiches, puntata base 10, raddoppio dopo ogni perdita.`, T`Giri giocati: ${rounds}. Massimo raggiunto: ${maxBank}. Finale: ${bank} fiches.`, ruin ? T`Una serie di sconfitte ha richiesto una puntata di ${bet} fiches: non potevi più coprirla. Rovina!` : T('Sei sopravvissut{o|a} questa volta, ma il rischio di rovina cresce a ogni giro: basta una serie di 7 sconfitte per perdere 1.270 fiches.'), T('Lezione: piccoli guadagni frequenti e perdite rare ma enormi. È la martingala, ed è la stessa logica di molte strategie a leva.')], T('Croupier Speculatore'));
    if (!S.flags.casinoLesson) { reward({ flag: 'casinoLesson', xp: REWARD.xp.casinoLesson, save: false }); toast(T('Investidex: nuova voce "Azzardo vs investimento"')); }
  }
}

export async function archivist() {
  await say([T('Benvenut{o|a} nell\'Archivio di Bilancia. Qui custodiamo i fascicoli di tutte le Asset Card.'), T('Studiarli fa crescere il livello delle tue carte.')], T('Archivista'));
  if (!S.flags.archiveBonus) {
    S.flags.archiveBonus = true;
    Object.keys(S.cards).forEach((id) => (card(id).xp += 40));
    reward({ xp: REWARD.xp.archive, save: false });
    beep('coin');
    await say(T('Ho aggiunto 40 punti di studio a tutte le tue carte sbloccate.'), T('Archivista'));
  }
  // Fascicoli riservati: solo per chi ha una Reputazione da "Stimato" in su
  if (repTier().index >= TIER_ARCHIVE) {
    const c = await choose([T('Fascicoli riservati'), T('Lezioni'), T('Esco')], { cancel: true, prompt: T('La tua fama ti precede: posso aprirti i fascicoli riservati.'), who: T('Archivista') });
    if (c === 0) {
      const ids = Object.keys(S.cards).filter((id) => card(id).xp < 150);
      ids.forEach((id) => { card(id).xp = 150; });
      await say(ids.length ? [T('Ecco i fascicoli completi: bilanci storici, rischi e curiosità di ogni carta.'), T`${ids.length} carte mostrano ora tutte le informazioni (livello 4) nell'Investidex, se hai la Tecnica per leggerle.`] : T('I fascicoli delle tue carte sono già completi. Torna quando ne sblocchi di nuove.'), T('Archivista'));
      return;
    }
    if (c !== 1) return;
  } else if (repTier().next) await say(T`Con una Reputazione da "${REP_TIERS[TIER_ARCHIVE].name}" (${REP_TIERS[TIER_ARCHIVE].min} punti) ti aprirei i fascicoli riservati.`, T('Archivista'));
  await openLessons();
}

// ---------------- Wall Street ----------------

export async function credits() {
  await modal(T('Tradermon · Titoli di coda'), ({ body, button, close }) => {
    body.innerHTML = T`<p><b>Grazie per aver giocato!</b></p><p>Attestati: ${S.badges}/8 · Sigilli pratici: ${S.seals}/8 · Livello di Conoscenza: ${level()} · Reputazione: ${S.stats.reputazione}<br>Domande risposte: ${Object.values(S.answered).reduce((a, b) => a + b, 0)} · Tempo di gioco: ${Math.round(S.playMs / 60000)} minuti</p>
      <p class="small">Contenuti didattici basati su fonti pubbliche: SEC Investor.gov, Investopedia, Consob, Banca d'Italia (L'economia per tutti), CFA Institute, ESMA. Mondo, personaggi, grafica e suoni originali. Titoli, prezzi e grafici reali forniti da Alpaca per il tuo uso personale.</p>
      <p class="small muted">Tradermon è un gioco educativo e non fornisce consulenza finanziaria.</p>`;
    button(T('Continua'), () => close(), 'primary');
  }, { closable: false });
}

export async function onEnterTown(id: string) {
  if (!S.visited.includes(id)) S.visited.push(id);
}
