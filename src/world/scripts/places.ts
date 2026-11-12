// Luoghi: Biblioteche, stazioni, Zona Simulazione, Archivio, casinò, titoli di coda.
import { type NpcDef } from '../maps';
import type { AssetClass, AssetDef, Sector } from '../../types';
import { S, addRep, card, level } from '../../systems/state';
import { say, choose, modal, toast, esc } from '../../ui/core';
import { runSim } from '../../ui/timemachine';
import { openInvestidex, openLessons } from '../../ui/menu';
import { mentorTopics } from '../../data/quiz/build';
import { mentor, TOWNS } from '../../data/story';
import { mentorBooks, TOPIC_LABEL, type Book } from '../../data/books';
import { REP_TIERS, REWARD } from '../../systems/balance';
import { repTier, TIER_ARCHIVE } from '../../systems/character';
import type { Section } from '../maps';
import { LEGENDS, SANDBOX, HISTORY } from '../../data/missions';
import { weeklyChallenge } from '../../ui/challenge';
import { beep } from '../../systems/audio';
import * as A from '../../systems/alpaca';
import { track } from '../../systems/progress';
import { playMinigame } from '../../ui/minigames';
import { reward, type WorldApi } from './common';
import { linkDuel, reviewDuel, missionDesk } from './duels';
import { tick } from '../../systems/account';

export async function librarian(n: NpcDef) {
  const town = Number(n.data?.town ?? 0);
  if (town && !S.flags[`lib_intro_${town}`]) {
    S.flags[`lib_intro_${town}`] = true;
    const md = mentor(town, S.track);
    await say(['Benvenut{o|a} in Biblioteca! Qui si studia prima di sfidare il Mentore.', `Gli scaffali in alto a sinistra sono la Sezione del Mentore: i libri su ${mentorTopics(town, S.track, S.mixedClasses).map((t) => `«${TOPIC_LABEL[t]}»`).join(' e ')}, l'argomento del duello con ${md.name}.`, 'A destra le lezioni generali; in basso l\'archivio delle domande sbagliate e l\'Investidex. Avvicinati a uno scaffale e premi il tasto di conferma.'], 'Bibliotecaria');
  }
  const c = await choose(['Sezione del Mentore (libri)', 'Lezioni', 'Ripasso (domande in scadenza)', 'Minigiochi didattici', 'Investidex', 'Niente, grazie'], { cancel: true, prompt: 'Benvenut{o|a} in Biblioteca! Cosa vuoi fare?', who: 'Bibliotecaria' });
  if (c === 0) return mentorShelf(town);
  if (c === 1) return openLessons();
  if (c === 3) return playMinigame('Bibliotecaria');
  if (c === 4) return openInvestidex();
  if (c === 2) return reviewDuel();
}

/** Scaffale della Sezione del Mentore: guida alla sfida, libri di contesto e di materia, con le lezioni sugli stessi temi. */
async function mentorShelf(n: number) {
  if (!n) return say('Questa Biblioteca non ha un Mentore di riferimento.', 'Bibliotecaria');
  const md = mentor(n, S.track);
  const topics = mentorTopics(n, S.track, S.mixedClasses);
  const books: Book[] = mentorBooks(n, S.track, S.mixedClasses);
  for (;;) {
    const read = (b: Book) => S.booksRead.includes(b.id);
    const c = await choose([...books.map((b) => `${read(b) ? '✓ ' : '• '}${b.title}`), 'Lezioni su questi temi', 'Rimetto a posto'], { cancel: true, title: `SEZIONE DEL MENTORE · ${topics.map((t) => TOPIC_LABEL[t]).join(', ')}` });
    if (c < 0 || c === books.length + 1) return;
    if (c === books.length) { await openLessons(topics); continue; }
    const b = books[c];
    await say(b.pages, b.title);
    if (!read(b)) {
      S.booksRead.push(b.id); reward({ xp: REWARD.xp.book, event: 'lesson', save: false });
      if (books.every(read)) { reward({ rep: REWARD.rep.bookSection, save: false }); await say([`Hai letto tutta la sezione di ${md.name}. Reputazione +10.`, 'Ora sai cosa ti aspetta nel duello: in bocca al lupo!'], 'Bibliotecaria'); }
    }
  }
}

/** Interazione con uno scaffale della Biblioteca (vedi Section in maps.ts). */
export async function librarySection(sec: Section, town: number) {
  switch (sec.kind) {
    case 'mentor': return mentorShelf(town);
    case 'general': await say(`${sec.label}: i volumi di tutti i Mentori incontrati finora.`); return openLessons();
    case 'review': return reviewDuel();
    case 'index': await say(`${sec.label}: le schede delle Asset Card che hai raccolto.`); return openInvestidex();
  }
}

export async function station(w: WorldApi) {
  if (S.badges < 2) return say(['Stazione di Capitalia.', 'L\'abbonamento al treno lo avrai con il secondo Attestato.'], 'Capostazione');
  const dests = TOWNS.filter((t) => S.visited.includes(t.id) && t.id !== `t${w.town()}`);
  if (!dests.length) return say('Non ci sono altre città visitate.', 'Capostazione');
  const c = await choose([...dests.map((t) => t.name), 'Annulla'], { cancel: true, prompt: 'Dove vuoi andare?', who: 'Capostazione' });
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
  const opts = ['Missioni della Macchina del Tempo', ...SANDBOX.map((s) => s.name), ...legendsBeaten.map((l) => `Leggenda: ${l.title}`), 'Crisi storiche (cosa successe davvero)', 'Minigiochi didattici', 'Sfida della settimana', 'Dati reali Alpaca (un simbolo a scelta)', 'Duello con codice (cavo link)', 'Esci'];
  const c = await choose(opts, { cancel: true, prompt: 'Zona Simulazione, la casa della Macchina del Tempo: qui si rivivono periodi veri di mercato. Sigilli e Lega si guadagnano invece sul conto, con il mercato di oggi. Che cosa vuoi fare?', who: 'Operatrice' });
  if (c < 0 || c === opts.length - 1) return;
  if (c === 0) return missionDesk();
  if (c - 1 < SANDBOX.length) { await runSim({ scenario: SANDBOX[c - 1], sandbox: true }); return; }
  if (c - 1 < SANDBOX.length + legendsBeaten.length) { await runSim({ scenario: legendsBeaten[c - 1 - SANDBOX.length].scenario, sandbox: true, classes: ['stocks', 'etf', 'crypto'] }); return; }
  if (opts[c].startsWith('Crisi storiche')) return historical();
  if (opts[c].startsWith('Minigiochi')) return playMinigame('Operatrice');
  if (opts[c].startsWith('Sfida della settimana')) return weeklyChallenge();
  if (opts[c].startsWith('Dati reali')) return realReplay();
  return linkDuel();
}

/** Crisi storiche: cosa successe davvero e perché. Quelle dal 2016 in poi si possono rivivere sui dati reali. */
async function historical() {
  const ids = Object.keys(HISTORY);
  const TITLES: Record<string, string> = { leg1929: 'Il Grande Crollo (1929)', leg2000: 'La bolla dot-com (2000)', leg2008: 'La crisi finanziaria (2008)' };
  for (;;) {
    const title = (id: string) => LEGENDS.find((l) => l.id === id)?.title ?? TITLES[id] ?? id;
    const c = await choose([...ids.map(title), 'Esci'], { cancel: true, prompt: 'Quale crisi vuoi capire?', who: 'Operatrice' });
    if (c < 0 || c === ids.length) return;
    const id = ids[c];
    const l = LEGENDS.find((x) => x.id === id);
    const h = HISTORY[id];
    const go = await modal<boolean>(title(id), ({ body, button, close }) => {
      body.innerHTML = `<p class="small muted">${esc(h.when)}${l?.scenario.historical ? ' · ' + esc(l.scenario.historical) : ''}</p><h4 style="margin:6px 0 2px">Cosa successe</h4><p>${esc(h.cause)}</p><h4 style="margin:6px 0 2px">La lezione</h4><p class="good">${esc(h.lesson)}</p><p class="small muted">${l ? 'Il replay usa i prezzi reali di quel periodo, scaricati da Alpaca con il tuo conto.' : 'Questa crisi è raccontata ma non si può rivivere: lo storico dei dati di Alpaca parte dal 2016 e il gioco non ricostruisce prezzi.'} Le cifre nel racconto sono arrotondate.</p>`;
      if (l) button('Rivivi sui dati reali', () => close(true), 'primary');
      button('Indietro', () => close(false));
    }, { wide: true });
    S.flags[`hist_${id}`] = true;
    if (go && l) await runSim({ scenario: l.scenario, sandbox: true, classes: ['stocks', 'etf', 'crypto'] });
  }
}

async function realReplay() {
  const st = await A.serverStatus();
  if (!st) return say(A.noServerLines('il replay di dati reali'), 'Operatrice');
  if (!st.paper.configured) return say(['Per i prezzi veri serve il conto Alpaca Paper collegato.', 'Collegalo dal menu, voce "Chiavi API".'], 'Operatrice');
  const res = await modal<{ sym: string; start: string; end: string }>('Replay di dati reali', ({ body, button, close }) => {
    const y = new Date().getFullYear();
    body.innerHTML = `<p class="small">Riproduci le barre giornaliere reali di un simbolo scelto da te (dati Alpaca, dal 2016). Qui nulla è nascosto: sei tu a scegliere che cosa guardare. Nessun consiglio: è solo un esercizio.</p>
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
    await runSim({ scenario: { id: 'real', name: `${res.sym} ${res.start} → ${res.end}`, desc: 'Barre giornaliere reali da Alpaca. I rendimenti passati non garantiscono quelli futuri.', window: { start: res.start, end: res.end } }, sandbox: true, dividends: false, custom: { assets: [{ ...def }], prices: { REAL: bars.map((b) => b.c) }, labels: bars.map((b) => b.t) } });
  } catch (e) { await say(`Errore: ${(e as Error).message}`, 'Operatrice'); }
}

export async function casino() {
  await say(['Benvenut{o|a} al Casinò dello Speculatore! Qui le fiches sono finte, ma la matematica è vera.', 'La roulette ha 37 caselle: 18 rosse, 18 nere e lo zero. Se punti sul rosso vinci 1:1, ma la probabilità è 18/37.', 'Il vantaggio del banco è del 2,7% su ogni puntata. È scritto qui sul tavolo.'], 'Croupier Speculatore');
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
    await say([`Partenza: 1.000 fiches, puntata base 10, raddoppio dopo ogni perdita.`, `Giri giocati: ${rounds}. Massimo raggiunto: ${maxBank}. Finale: ${bank} fiches.`, ruin ? `Una serie di sconfitte ha richiesto una puntata di ${bet} fiches: non potevi più coprirla. Rovina!` : 'Sei sopravvissut{o|a} questa volta, ma il rischio di rovina cresce a ogni giro: basta una serie di 7 sconfitte per perdere 1.270 fiches.', 'Lezione: piccoli guadagni frequenti e perdite rare ma enormi. È la martingala, ed è la stessa logica di molte strategie a leva.'], 'Croupier Speculatore');
    if (!S.flags.casinoLesson) { reward({ flag: 'casinoLesson', xp: REWARD.xp.casinoLesson, save: false }); toast('Investidex: nuova voce "Azzardo vs investimento"'); }
  }
}

export async function archivist() {
  await say(['Benvenut{o|a} nell\'Archivio di Bilancia. Qui custodiamo i fascicoli di tutte le Asset Card.', 'Studiarli fa crescere il livello delle tue carte.'], 'Archivista');
  if (!S.flags.archiveBonus) {
    S.flags.archiveBonus = true;
    Object.keys(S.cards).forEach((id) => (card(id).xp += 40));
    reward({ xp: REWARD.xp.archive, save: false });
    beep('coin');
    await say('Ho aggiunto 40 punti di studio a tutte le tue carte sbloccate.', 'Archivista');
  }
  // Fascicoli riservati: solo per chi ha una Reputazione da "Stimato" in su
  if (repTier().index >= TIER_ARCHIVE) {
    const c = await choose(['Fascicoli riservati', 'Lezioni', 'Esco'], { cancel: true, prompt: 'La tua fama ti precede: posso aprirti i fascicoli riservati.', who: 'Archivista' });
    if (c === 0) {
      const ids = Object.keys(S.cards).filter((id) => card(id).xp < 150);
      ids.forEach((id) => { card(id).xp = 150; });
      await say(ids.length ? ['Ecco i fascicoli completi: bilanci storici, rischi e curiosità di ogni carta.', `${ids.length} carte mostrano ora tutte le informazioni (livello 4) nell'Investidex, se hai la Tecnica per leggerle.`] : 'I fascicoli delle tue carte sono già completi. Torna quando ne sblocchi di nuove.', 'Archivista');
      return;
    }
    if (c !== 1) return;
  } else if (repTier().next) await say(`Con una Reputazione da "${REP_TIERS[TIER_ARCHIVE].name}" (${REP_TIERS[TIER_ARCHIVE].min} punti) ti aprirei i fascicoli riservati.`, 'Archivista');
  await openLessons();
}

// ---------------- Lega ----------------

export async function credits() {
  await modal('Tradermon · Titoli di coda', ({ body, button, close }) => {
    body.innerHTML = `<p><b>Grazie per aver giocato!</b></p><p>Attestati: ${S.badges}/8 · Sigilli pratici: ${S.seals}/8 · Livello di Conoscenza: ${level()} · Reputazione: ${S.stats.reputazione}<br>Domande risposte: ${Object.values(S.answered).reduce((a, b) => a + b, 0)} · Tempo di gioco: ${Math.round(S.playMs / 60000)} minuti</p>
      <p class="small">Contenuti didattici basati su fonti pubbliche: SEC Investor.gov, Investopedia, Consob, Banca d'Italia (L'economia per tutti), CFA Institute, ESMA. Mondo, personaggi, grafica e suoni originali. Titoli, prezzi e grafici reali forniti da Alpaca per il tuo uso personale.</p>
      <p class="small muted">Tradermon è un gioco educativo e non fornisce consulenza finanziaria.</p>`;
    button('Continua', () => close(), 'primary');
  }, { closable: false });
}

export async function onEnterTown(id: string) {
  if (!S.visited.includes(id)) S.visited.push(id);
}
