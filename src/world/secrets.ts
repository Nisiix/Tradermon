// Segreti della seconda parte: pagine invisibili, la Sala del Nastro, la Balena del fine settimana,
// il rituale delle Mani di Diamante e il Sussurratore del Casinò. Si risvegliano dalla Medaglia 4.
// Ricompense: solo Conoscenza, titoli e oggetti per la casa (mai Crediti).
import { S, save, card, clampStat } from '../systems/state';
import { say, toast } from '../ui/core';
import { runDuel } from '../ui/battle';
import { pickQuestions } from '../systems/quiz';
import { trackTopics } from '../data/quiz/build';
import { track } from '../systems/progress';
import { jingle } from '../systems/music';
import type { NpcDef } from './maps';
import {
  SECRET_BADGE, SECRET_HINTS, LEDGER_PAGES, pageAt, pageFlag, TAPE_SHELF, HODL_STONE, SECRET_FLAGS, isWeekend, type LedgerPage,
} from './secretsData';

export function secretsAwake(): boolean { return !!S && S.badges >= SECRET_BADGE; }

export function pagesFound(): number { return LEDGER_PAGES.filter((p) => !!S.flags[pageFlag(p.id)]).length; }

/** Segreti principali scoperti (Libro Mastro completo, Sala del Nastro, Balena, Mani di Diamante). */
export function secretsFound(): number {
  return [pagesFound() === LEDGER_PAGES.length, !!S.flags[SECRET_FLAGS.tape], !!S.flags[SECRET_FLAGS.whale], !!S.flags[SECRET_FLAGS.hodl]].filter(Boolean).length;
}

/** Indizio vago che un personaggio secondario aggiunge alle sue frasi (vuoto se il segreto è già scoperto o non è ancora tempo). */
export function secretHint(npcId: string): string[] {
  const h = SECRET_HINTS[npcId];
  if (!h || !secretsAwake()) return [];
  const done = { pages: pagesFound() === LEDGER_PAGES.length, tape: !!S.flags[SECRET_FLAGS.tapeOpen], whale: !!S.flags[SECRET_FLAGS.whale], hodl: !!S.flags[SECRET_FLAGS.hodl], rumors: (S.counters.rumor ?? 0) > 0 }[h.about];
  return done ? [] : [h.line];
}

// ---------------- Pagine del Libro Mastro Perduto ----------------

/** Pagina invisibile davanti al giocatore, se c'è e non è già stata raccolta. */
export function hiddenPage(map: string, x: number, y: number): LedgerPage | undefined {
  if (!secretsAwake()) return undefined;
  const p = pageAt(map, x, y);
  return p && !S.flags[pageFlag(p.id)] ? p : undefined;
}

export async function findPage(p: LedgerPage) {
  S.flags[pageFlag(p.id)] = true;
  jingle('secret');
  S.stats.xp += 60;
  const n = pagesFound();
  await say([`Hai trovato qualcosa per terra... una pagina strappata!`, `Libro Mastro di Mastro Ventura, pagina ${p.roman}.`]);
  await say(p.text, `Pagina ${p.roman}`);
  const next = LEDGER_PAGES.find((q) => !S.flags[pageFlag(q.id)]);
  if (next) await say([`In fondo alla pagina, una nota a matita: "La pagina ${next.roman} l'ho lasciata ${next.clue}."`, `Pagine raccolte: ${n}/${LEDGER_PAGES.length}. +60 punti Conoscenza.`]);
  else await say(['Le sei pagine combaciano: il Libro Mastro Perduto è di nuovo intero.', 'Sulla copertina interna c\'è scritto: "A chi ha avuto la pazienza di cercare. Ora sai tutto quello che sapevo io."', '+60 punti Conoscenza. Il Libro Mastro rilegato ti aspetta a casa.']);
  track('secret');
  save();
}

// ---------------- Sala del Nastro ----------------

export function isTapeShelf(map: string, x: number, y: number): boolean {
  return map === TAPE_SHELF.map && x === TAPE_SHELF.x && y === TAPE_SHELF.y;
}

/** Il libro al contrario: prima della Medaglia 4 è solo un libro, dopo si può tirare. Restituisce true se lo scaffale si è aperto. */
export async function tapeShelf(choose: (prompt: string) => Promise<boolean>): Promise<boolean> {
  if (S.flags[SECRET_FLAGS.tapeOpen]) return false;
  if (!secretsAwake()) {
    await say(['Uno dei libri è messo al contrario: "Il Nastro delle Quotazioni".', 'Lo raddrizzi. Chissà perché qualcuno l\'aveva girato.']);
    return false;
  }
  await say(['Uno dei libri è messo al contrario: "Il Nastro delle Quotazioni".', 'Non si sfila: sembra agganciato a qualcosa dietro lo scaffale.']);
  if (!(await choose('Tirare il libro?'))) return false;
  S.flags[SECRET_FLAGS.tapeOpen] = true;
  jingle('secret');
  toast('Clic! Lo scaffale scorre di lato: dietro c\'è un passaggio.');
  save();
  return true;
}

// ---------------- Personaggi segreti ----------------

export function secretVisible(n: NpcDef): boolean {
  switch (n.data?.key) {
    case 'whale': return secretsAwake() && isWeekend();
    case 'rumors': return secretsAwake();
    default: return true;
  }
}

export async function secretTalk(n: NpcDef) {
  switch (n.data?.key) {
    case 'tape': return tapeLady(n);
    case 'whale': return whale(n);
    case 'rumors': return rumors(n);
    default: return say('...', n.name);
  }
}

async function tapeLady(n: NpcDef) {
  const who = n.name;
  if (S.flags[SECRET_FLAGS.tape]) return say(['Oggi i nastri sono diventati schermi e gli schermi algoritmi.', 'Non batterai mai una macchina in velocità. Ma lei non sa aspettare: tu sì.'], who);
  await say([
    'Oh! Qualcuno ha tirato il libro giusto. Erano anni che non scendeva nessuno.',
    'Prima degli schermi, i prezzi arrivavano su un nastro di carta che usciva da queste macchine, un ticchettio dopo l\'altro.',
    'I vecchi operatori "leggevano il nastro": dal ritmo degli scambi capivano chi comprava e chi vendeva.',
    'Vediamo se tu sai leggere tra le righe. Cinque domande, ne voglio quattro giuste.',
  ], who);
  const qs = pickQuestions(trackTopics(S.track, S.mixedClasses, Math.max(5, S.badges)), 5, { minDiff: 2 });
  const prevFid = S.stats.fiducia;
  const res = await runDuel({ foeName: who, foePal: n.pal, questions: qs, need: 4, damage: 0 });
  S.stats.fiducia = prevFid;
  if (!res.win) return say('Il nastro non aspetta nessuno, ma io sì. Torna quando vuoi.', who);
  S.flags[SECRET_FLAGS.tape] = true;
  S.stats.xp += 150;
  Object.keys(S.cards).forEach((id) => (card(id).xp += 25));
  jingle('secret');
  await say(['Sai leggere il nastro! Tieni questo pezzo: è dell\'ultimo giorno in cui le macchine hanno funzionato.', '+150 punti Conoscenza, studio extra per le tue carte e il Nastro incorniciato per casa.'], who);
  track('secret');
  save();
}

async function whale(n: NpcDef) {
  const who = n.name;
  if (S.flags[SECRET_FLAGS.whale]) return say(['Lunedì la Borsa riapre e io torno sott\'acqua.', 'Ricorda: quando il mercato è sottile, chi è grande decide il prezzo. Non farti trovare dall\'altra parte.'], who);
  await say([
    'Mi hai trovato. Mi chiamano la Balena: in settimana non mi vede nessuno.',
    'Il sabato e la domenica la Borsa dorme, ma le cripto si scambiano ventiquattro ore su ventiquattro.',
    'Con pochi scambi in giro, il mercato è "sottile": un ordine grande come il mio sposta il prezzo da solo. Si chiama slittamento, o slippage.',
    'Se vedi un balzo improvviso alle tre di notte di domenica, chiediti chi c\'è dietro. E usa ordini limite, non ordini al mercato.',
  ], who);
  S.flags[SECRET_FLAGS.whale] = true;
  S.stats.xp += 120;
  jingle('secret');
  await say('Hai avvistato la Balena! +120 punti Conoscenza e un nuovo titolo.', who);
  track('secret');
  save();
}

const RUMORS: { lines: string[]; real?: 'pages' | 'tape' | 'whale' | 'hodl' }[] = [
  { real: 'pages', lines: ['Dicono che il vecchio Mastro Ventura abbia strappato il suo Libro Mastro e nascosto le pagine dove nessuno guarda.', 'Angoli vuoti, rive, fiori, fondi di grotta... Ti basta stare davanti al punto giusto e premere A.'] },
  { lines: ['Ho sentito che un\'azione raddoppierà domani. Chi l\'ha detto? Uno che lo ha sentito da un altro.', 'Ah, vuoi la lezione? Una voce senza fonte è rumore. E se la fonte fosse davvero un dirigente, usarla sarebbe insider trading: illegale.'] },
  { real: 'tape', lines: ['Nella Biblioteca di Bilancia c\'è un libro messo al contrario. Nessuno l\'ha mai tirato.', 'Dicono che dietro si senta ancora un ticchettio...'] },
  { lines: ['Un tizio giura che se premi A sulla roulette mille volte di fila, vinci.', 'L\'ho provato. Il banco vince sempre, anche contro la pazienza. Quella usala altrove.'] },
  { real: 'whale', lines: ['I marinai di Porto Ordini raccontano di una Balena che affiora vicino al Relitto.', 'Però solo quando la Borsa è chiusa per il fine settimana. In settimana, niente.'] },
  { lines: ['"Compra sulla voce, vendi sulla notizia", dicono qui.', 'Il problema è che quando la voce arriva a me, l\'hanno già comprata tutti. E quando arriva a te...'] },
  { real: 'hodl', lines: ['Sul Percorso 6, a nord-est, c\'è una pietra con due mani scolpite.', 'Chi le resta davanti un minuto intero senza muovere un dito... beh, prova. Io non ci riesco mai.'] },
  { lines: ['Una nuova moneta promette il 1000% entro il mese. Il sito è nato ieri e il fondatore non ha un nome.', 'Questa non è una voce: è un allarme. Rendimenti garantiti e fretta sono i segni classici di una truffa.'] },
];

async function rumors(n: NpcDef) {
  const who = n.name;
  if (secretsFound() >= 4) return say(['Hai scoperto tutto quello che sussurravo, e anche di più.', 'Ora le voci le racconti tu. Mi raccomando: solo quelle vere.'], who);
  const i = (S.counters.rumor ?? 0) % RUMORS.length;
  S.counters.rumor = (S.counters.rumor ?? 0) + 1;
  const r = RUMORS[i];
  const done = r.real === 'pages' ? pagesFound() === LEDGER_PAGES.length : r.real ? !!S.flags[{ tape: SECRET_FLAGS.tape, whale: SECRET_FLAGS.whale, hodl: SECRET_FLAGS.hodl }[r.real]] : false;
  await say(['Psst... vuoi sentire una voce di corridoio?', ...r.lines, ...(done ? ['...ma tu questa la sai già, vero? Te lo leggo in faccia.'] : [])], who);
  save();
}

// ---------------- Rituale delle Mani di Diamante ----------------

/** Il giocatore è nel punto del rituale, rivolto verso la pietra, e il rituale è ancora da compiere? */
export function atHodlStone(): boolean {
  return secretsAwake() && !S.flags[SECRET_FLAGS.hodl] && S.map === HODL_STONE.map && S.x === HODL_STONE.standX && S.y === HODL_STONE.standY && S.facing === HODL_STONE.facing;
}

export async function hodlRitual() {
  S.flags[SECRET_FLAGS.hodl] = true;
  jingle('secret');
  await say(['Un minuto intero senza muovere un dito...', 'Le mani di pietra si aprono lentamente. Dentro brilla una piccola gemma intagliata.']);
  await say([
    'Una voce antica, come da sotto terra: "Hai resistito alla voglia di fare qualcosa. È la più difficile."',
    '"Ma ricorda: tenere con una tesi è pazienza. Tenere senza una tesi, solo per orgoglio, è testardaggine."',
    '"Le mani di diamante servono a non vendere nel panico, non a ignorare quando ti sei sbagliato."',
  ], 'Pietra delle Mani');
  S.stats.xp += 150;
  clampStat('pazienza', 10);
  await say('+150 punti Conoscenza, +10 Pazienza e il titolo "Mani di Diamante".');
  track('secret');
  save();
}
