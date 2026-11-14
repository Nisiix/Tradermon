// Grotte: guide all'ingresso, reperti, ostriche, gallerie delle promesse e incisioni. I dati stanno in world/caves.ts.
// Regole: dentro le grotte non si guadagna mai denaro (solo Conoscenza, titoli e arredi), ogni concetto che viene
// chiesto è spiegato prima dal taccuino della guida e dalle incisioni, e le domande sono quelle riservate alla grotta.
import { HERMITS, type NpcDef, type Sign } from '../maps';
import { S, save } from '../../systems/state';
import { say, choose, toast } from '../../ui/core';
import { runDuel } from '../../ui/battle';
import { pickCaveQuestions, targetDiff, storyStage, studiedTopics } from '../../systems/quiz';
import { BOOK_BY_ID } from '../../data/books';
import { REWARD } from '../../systems/balance';
import { jingle } from '../../systems/music';
import { CAVES, RELICS, RELIC_BY_ID, relicFlag, relicsOf, relicsFound, TRAPS, trapFlag, signFlag, OYSTER_LEVEL, oysterRelic, CAVE_XP, type CaveKey } from '../caves';
import { reward, type WorldApi } from './common';
import { hermitDuel, HERMIT_LINES } from './duels';
import { secretHint } from '../secrets';
import { T } from '../../i18n';

export function relicTaken(id: string): boolean { return !!S.flags[relicFlag(id)]; }

/** Argomenti del percorso del giocatore: riempiono un duello di grotta solo quando le domande della grotta sono finite. */
function ownTopics() { return studiedTopics(); }

// ---------------- Reperti ----------------

/** Raccoglie un reperto: Conoscenza, la sua riga di lezione e, al terzo della grotta, titolo e arredo (dai traguardi). */
async function gainRelic(id: string, w: WorldApi) {
  const r = RELIC_BY_ID[id];
  if (!r || relicTaken(id)) return;
  const cave = CAVES[r.cave];
  S.flags[relicFlag(id)] = true;
  jingle('quest');
  // l'evento controlla i traguardi: il flag va messo prima
  reward({ xp: CAVE_XP.relic, event: 'relic', save: false });
  w.refresh();
  const n = relicsFound(S.flags, r.cave), tot = relicsOf(r.cave).length;
  await say([T`Hai trovato: ${r.name}!`, ...r.text], cave.name);
  if (n < tot) await say(T`Reperti della grotta: ${n} su ${tot}. +${CAVE_XP.relic} punti Conoscenza.`, cave.name);
  else {
    S.stats.xp += CAVE_XP.set;
    const all = relicsFound(S.flags) >= RELICS.length;
    await say([
      T`Hai trovato tutti e ${tot} i reperti di questa grotta! +${CAVE_XP.relic + CAVE_XP.set} punti Conoscenza.`,
      T('Hai sbloccato un nuovo titolo e un oggetto per la casa: lo trovi a Borgo Semina.'),
      ...(all ? [T('E con questo le hai esplorate tutte e tre: nove reperti su nove. La Lanterna d\'oro ti aspetta a casa.')] : []),
    ], cave.name);
  }
  save();
}

export async function relic(n: NpcDef, w: WorldApi) {
  return gainRelic(String(n.data?.relic ?? ''), w);
}

// ---------------- Grotta delle Perle: le tre ostriche ----------------

/** Un'ostrica si apre con una domanda sul valore nascosto, in ordine (1, 2, 3). Sbagliare non costa nulla: si riprova con un'altra domanda. */
export async function oyster(n: NpcDef, w: WorldApi) {
  const k = Number(n.data?.n ?? 1);
  const cave = CAVES.pearl;
  if (relicTaken(oysterRelic(k))) return say(T('L\'ostrica è aperta e vuota: la sua perla l\'hai già presa.'), cave.name);
  if (k > 1 && !relicTaken(oysterRelic(k - 1))) {
    return say([T('L\'ostrica resta chiusa, stretta come un pugno.'), T`Sul guscio è inciso il numero ${k}: le ostriche si aprono in ordine. Prima ti serve la perla dell'ostrica ${k - 1}.`], cave.name);
  }
  const who = HERMITS.perle.name;
  await say([T`Sul guscio è inciso il numero ${k}. Dentro, qualcosa brilla.`, T('Da lontano arriva la voce del Pescatore, portata dall\'eco:')], cave.name);
  await say(S.flags.oysterRule ? T('«Pront{o|a}? Una domanda sul valore nascosto. Se sbagli non perdi nulla: l\'ostrica si richiude e ne riparliamo.»') : [T('«Ogni ostrica si apre con una domanda sul valore nascosto. Te la faccio io da qui.»'), T('«Se sbagli non perdi nulla: l\'ostrica si richiude, tu rileggi il mio Quaderno e riprovi con un\'altra domanda.»')], who);
  S.flags.oysterRule = true;
  const qs = pickCaveQuestions(cave.quiz, 1, OYSTER_LEVEL[k - 1] ?? 2, ownTopics());
  const prevFid = S.stats.fiducia;
  const r = await runDuel({ foeName: who, foeTitle: T`Ostrica ${k} di 3`, foePal: HERMITS.perle.pal, questions: qs, need: 1, damage: 0, arena: 'grotta' });
  S.stats.fiducia = prevFid;
  if (!r.win) {
    await say(T('L\'ostrica si richiude di scatto.'), cave.name);
    return say(T('«Niente di grave. Rileggi il Quaderno e riprova: la domanda sarà un\'altra.»'), who);
  }
  await gainRelic(oysterRelic(k), w);
}

// ---------------- Guide all'ingresso ----------------

const GUIDE_INTRO: Record<CaveKey, string[]> = {
  gold: [
    T('Ferm{o|a} lì, e tieni alta la Lanterna! Questa è la Miniera dei Lingotti: sbuca a Valdividendo, ma non è una passeggiata.'),
    T('Ci sono tre bivi, e a ogni bivio un\'incisione. Leggila prima di scegliere: le gallerie che promettono troppo girano su sé stesse e ti riportano all\'ingresso.'),
    T('Qui sotto sono rimasti tre lingotti. Non valgono denaro: vale quello che c\'è inciso sotto. Uno è in fondo alla vena incerta, due al livello inferiore.'),
    T('Gli altri minatori ti faranno domande su oro, beni rifugio e promesse: cose che fuori non ti ha ancora chiesto nessuno. Nel mio taccuino c\'è scritto tutto.'),
  ],
  dp: [
    T('Parla piano. Questa è la Galleria del Dark Pool: porta a Mentelucida.'),
    T('Qui la tua Lanterna illumina meno, e chi ti sfida lo vedi bene solo quando ti è addosso. Prima è un\'ombra appena più scura del buio: guarda con attenzione.'),
    T('È come per gli ordini che si scambiano al buio: nessuno li vede prima che siano eseguiti.'),
    T('Tre ordini nascosti sono rimasti qui dentro: uno nella sala dei pilastri, due al livello inferiore. Ti chiederanno di dark pool, ordini iceberg e formazione del prezzo: prima leggi il mio registro.'),
  ],
  pearl: [
    HERMIT_LINES.perle.intro[0],
    T('Qui ci sono tre ostriche, e si aprono in ordine. La prima è sulla sporgenza oltre il laghetto: ti serve la zattera. Le altre due sono giù, sul Fondale: la scala è qui accanto.'),
    T('Ogni ostrica si apre con una domanda sul valore nascosto. Te la faccio io: qui dentro l\'eco porta la voce ovunque.'),
    T('Quando avrai le tre perle torna da me per la sfida vera. Intanto leggi il mio quaderno: le domande vengono da lì.'),
  ],
};

const GUIDE_DONE: Record<CaveKey, string> = {
  gold: T('Tre lingotti su tre. Hai letto le incisioni invece di credere ai cartelli: è tutto quello che c\'è da sapere, qui sotto e là fuori.'),
  dp: T('Tre ordini su tre. Adesso sai che cosa succede al buio, e perché dopo deve arrivare la luce.'),
  pearl: T('Tre perle su tre. Hai aperto i gusci invece di giudicarli da fuori.'),
};

/** Guida di una grotta (per la Grotta delle Perle è l'eremita, che ha anche la sua sfida): spiega, presta il taccuino, indica i reperti. */
export async function caveGuide(n: NpcDef) {
  const key = (n.data?.cave ?? (n.data?.key === 'perle' ? 'pearl' : '')) as CaveKey;
  const cave = CAVES[key];
  if (!cave) return say('...', n.name);
  const who = key === 'pearl' ? HERMITS.perle.name : n.name;
  const book = BOOK_BY_ID[cave.book];
  const readBook = async () => {
    await say(book.pages, book.title);
    if (!S.booksRead.includes(book.id)) { S.booksRead.push(book.id); reward({ xp: REWARD.xp.book, event: 'lesson', save: false }); }
  };
  const introFlag = `caveGuide_${key}`;
  if (!S.flags[introFlag]) {
    S.flags[introFlag] = true;
    await say([...GUIDE_INTRO[key], ...secretHint(n.id)], who);
    if ((await choose([T('Lo leggo adesso'), T('Più tardi')], { prompt: T`Vuoi leggere «${book.title}»?`, who })) === 0) await readBook();
    save();
    return;
  }
  for (;;) {
    const found = relicsFound(S.flags, key), tot = relicsOf(key).length;
    const duel = key === 'pearl' && !S.flags.islet_perle;
    const opts = [`${S.booksRead.includes(book.id) ? '✓ ' : '• '}${book.title}`, T`Dove sono i reperti? (${found}/${tot})`, ...(duel ? [T('La tua sfida')] : []), T('Niente, grazie')];
    const c = await choose(opts, { cancel: true, prompt: T('Che cosa ti serve?'), who });
    if (c === 0) { await readBook(); continue; }
    if (c === 1) {
      const next = relicsOf(key).find((r) => !relicTaken(r.id));
      // l'indizio sul segreto la guida lo ripete solo quando i reperti sono finiti: prima indica una cosa alla volta
      await say(next ? [next.hint] : [GUIDE_DONE[key], ...(key === 'pearl' && S.flags.islet_perle ? [HERMIT_LINES.perle.again] : []), ...secretHint(n.id)], who);
      continue;
    }
    if (duel && c === 2) {
      if (found < tot) { await say([T('La mia sfida è per chi ha già aperto le tre ostriche.'), T`Finora ne hai aperte ${found} su ${tot}. Quando le avrai tutte, torna qui.`], who); continue; }
      await say([...HERMIT_LINES.perle.intro, T('Cinque domande, e te ne concedo una sola sbagliata. Non rischi la Fiducia.')], who);
      // come gli altri eremiti: due gradini sopra la tappa, ma con le domande della grotta che non hai ancora visto
      const qs = pickCaveQuestions(cave.quiz, 5, targetDiff(Math.max(3, storyStage()) + 2), ownTopics());
      await hermitDuel('perle', who, n.pal, qs, 'grotta');
      return;
    }
    return;
  }
}

// ---------------- Miniera: gallerie delle promesse ----------------

/** Dopo una galleria che gira su sé stessa: la prima volta la lezione (e un po' di Conoscenza), poi solo un promemoria. */
export async function trapFall(id: string) {
  const t = TRAPS[id];
  if (!t) return;
  if (S.flags[trapFlag(id)]) { toast(T('La galleria gira su sé stessa: sei di nuovo all\'ingresso della miniera.')); return; }
  S.flags[trapFlag(id)] = true;
  reward({ xp: CAVE_XP.trap, save: false });
  await say([...t.lesson, T`+${CAVE_XP.trap} punti Conoscenza: una lezione imparata camminando.`], CAVES.gold.name);
  save();
}

// ---------------- Incisioni ----------------

/** Cartelli e incisioni: quelli segnati `xp` danno un po' di Conoscenza alla prima lettura. */
export async function readSign(map: string, s: Sign) {
  await say(s.text);
  if (!s.xp) return;
  const f = signFlag(map, s.x, s.y);
  if (S.flags[f]) return;
  S.flags[f] = true;
  reward({ xp: CAVE_XP.sign });
  toast(T`Incisione annotata: +${CAVE_XP.sign} punti Conoscenza`);
}
