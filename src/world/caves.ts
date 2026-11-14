// Le tre grotte (Miniera dei Lingotti, Galleria del Dark Pool, Grotta delle Perle): dati puri, senza dipendenze dallo
// stato, così le mappe e i test possono usarli. La logica sta in scripts/caves.ts e nella scena del mondo.
//
// Ogni grotta ha: una luce di Lanterna (il raggio che si vede intorno al giocatore), cristalli luminosi di un colore,
// una musica sua, due livelli collegati da una scala, tre reperti da collezionare (mai denaro: Conoscenza, titoli e
// arredi), un Masso delle Commissioni interno che chiude una stanza laterale e un enigma a tema:
// - Miniera: i bivi delle promesse. Le gallerie "garantite" girano su sé stesse e riportano all'ingresso.
// - Dark Pool: gli sfidanti (e gli ordini nascosti) si vedono solo quando ti sono addosso.
// - Perle: tre ostriche, tre domande sul valore nascosto, da aprire in ordine.
import { T } from '../i18n';

export type CaveKey = 'gold' | 'dp' | 'pearl';

export interface CaveMeta {
  key: CaveKey;
  name: string;
  /** Mappe della grotta: livello d'ingresso e livello inferiore. */
  maps: string[];
  /** Raggio (in caselle) della luce della Lanterna. */
  light: number;
  /** Distanza entro cui compaiono sfidanti e reperti. Nel Dark Pool è molto più corta della luce. */
  reveal: number;
  /** Colore dei cristalli luminosi. */
  glow: number;
  /** Prefisso delle domande riservate alla grotta (grotte_<prefisso>_N) e del suo taccuino. */
  quiz: 'oro' | 'ombra' | 'perle';
  /** Chi spiega la grotta all'ingresso, e il suo taccuino (un libro di data/books.ts). */
  guide: string;
  book: string;
  /** Nome dei reperti, al plurale, per i messaggi. */
  relics: string;
}

export const CAVES: Record<CaveKey, CaveMeta> = {
  gold: { key: 'gold', name: T('Miniera dei Lingotti'), maps: ['cave_gold', 'cave_gold_b1'], light: 4.4, reveal: 4.4, glow: 0xffc860, quiz: 'oro', guide: T('Vecchio Minatore'), book: 'b_grotte_oro', relics: T('lingotti') },
  dp: { key: 'dp', name: T('Galleria del Dark Pool'), maps: ['cave_dp', 'cave_dp_b1'], light: 3.3, reveal: 1.5, glow: 0xb48cff, quiz: 'ombra', guide: T('Custode dell\'Ombra'), book: 'b_grotte_ombra', relics: T('ordini nascosti') },
  pearl: { key: 'pearl', name: T('Grotta delle Perle'), maps: ['cave_pearl', 'cave_pearl_b1'], light: 4.0, reveal: 4.0, glow: 0x7ce8e0, quiz: 'perle', guide: T('Pescatore di Perle'), book: 'b_grotte_perle', relics: T('perle') },
};

/** Grotta a cui appartiene una mappa (anche il livello inferiore), oppure undefined. */
export function caveOf(mapId: string): CaveKey | undefined {
  if (!mapId.startsWith('cave_')) return undefined;
  return (Object.keys(CAVES) as CaveKey[]).find((k) => CAVES[k].maps.includes(mapId));
}

/** Che cosa dice uno sfidante di grotta dopo aver perso: un consiglio a tema, al posto di quelli dei Percorsi. */
export const CAVE_TIPS: Record<CaveKey, string[]> = {
  gold: [
    T('L\'oro non paga cedole né dividendi: guadagni solo se qualcuno lo paga più di te.'),
    T('Bene rifugio non vuol dire garanzia: anche l\'oro ha avuto anni interi in discesa.'),
    T('Quando leggi «garantito» e «affrettati» sullo stesso cartello, cambia galleria.'),
  ],
  dp: [
    T('Al buio l\'ordine non si vede prima, ma lo scambio concluso viene poi reso pubblico.'),
    T('Un ordine iceberg mostra solo la punta: serve a non spostare il prezzo, non a ingannare.'),
    T('Il prezzo si forma dove gli ordini si vedono: per questo i mercati illuminati servono a tutti.'),
  ],
  pearl: [
    T('Il prezzo è ciò che paghi, il valore è ciò che ottieni: non confonderli mai.'),
    T('Un prezzo basso non basta: a volte è basso perché l\'azienda vale davvero poco.'),
    T('Il margine di sicurezza ti protegge dai tuoi stessi errori di stima.'),
  ],
};

// ---------------- Reperti ----------------

/** Un reperto da collezionare: lo si raccoglie una volta sola e lascia una riga di conoscenza. */
/** hint: l'indicazione che la guida della grotta dà a chi non l'ha ancora trovato. */
export interface Relic { id: string; cave: CaveKey; name: string; sprite: 'relic_ingot' | 'relic_order' | 'relic_pearl'; text: string[]; hint: string }

export const RELICS: Relic[] = [
  { id: 'gold_1', cave: 'gold', sprite: 'relic_ingot', name: T('Lingotto della Vena Incerta'),
    text: [T('Sotto il lingotto c\'è un\'incisione: «Non pago cedole né dividendi».'), T('L\'oro non produce nulla mentre lo tieni: guadagni solo se qualcuno, domani, lo paga più di te.')],
    hint: T('Il primo lingotto è al terzo bivio, a sud della sala centrale: prendi la vena incerta, verso est.') },
  { id: 'gold_2', cave: 'gold', sprite: 'relic_ingot', name: T('Lingotto del Rifugio'),
    text: [T('Sul lingotto è inciso: «Rifugio non vuol dire garanzia».'), T('Nelle crisi molti corrono all\'oro, ma il suo prezzo oscilla: ha avuto anche anni interi in discesa.')],
    hint: T('Un lingotto è al livello inferiore, nell\'angolo più lontano della sala grande. La scala è nella sala centrale.') },
  { id: 'gold_3', cave: 'gold', sprite: 'relic_ingot', name: T('Lingotto dei Costi Tagliati'),
    text: [T('Sul lingotto è inciso: «Custodirmi costa».'), T('Caveau, assicurazione e commissioni si pagano ogni anno, che il prezzo salga o no: un costo piccolo e ripetuto mangia una fetta grande.')],
    hint: T('Un lingotto è al livello inferiore, nella Camera dei Costi Tagliati: la chiude un Masso delle Commissioni.') },
  { id: 'dp_1', cave: 'dp', sprite: 'relic_order', name: T('Ordine Iceberg'),
    text: [T('Un ordine arrotolato: «Vendere 50.000 pezzi. Mostrarne 500 alla volta».'), T('Un ordine iceberg fa vedere al mercato solo la punta: il resto aspetta nascosto, per non spostare il prezzo.')],
    hint: T('Un ordine nascosto è in una nicchia a nord della Sala delle Grida Spente, quella con i pilastri.') },
  { id: 'dp_2', cave: 'dp', sprite: 'relic_order', name: T('Ordine a Blocco'),
    text: [T('Un ordine arrotolato: «Scambio di un blocco intero, a metà tra denaro e lettera».'), T('Al buio i grandi investitori si incontrano senza mostrare l\'ordine. Il prezzo, però, lo prendono dai mercati dove gli ordini si vedono.')],
    hint: T('Un ordine nascosto è al livello inferiore, nella stanza a est. La scala è a sud della sala con i pilastri.') },
  { id: 'dp_3', cave: 'dp', sprite: 'relic_order', name: T('Ordine Eseguito'),
    text: [T('Un ordine con il timbro: «Eseguito. Comunicato al mercato dopo lo scambio».'), T('La trasparenza qui arriva dopo: l\'ordine non si vede prima, ma lo scambio concluso viene reso pubblico.')],
    hint: T('Un ordine nascosto è al livello inferiore, nella Camera del Registro: la chiude un Masso delle Commissioni.') },
  { id: 'pearl_1', cave: 'pearl', sprite: 'relic_pearl', name: T('Perla del Prezzo'),
    text: [T('La prima perla. Il prezzo è ciò che paghi, il valore è ciò che ottieni: possono restare lontani a lungo.')],
    hint: T('La prima ostrica è sulla sporgenza oltre il laghetto, a nord: ci arrivi con la zattera.') },
  { id: 'pearl_2', cave: 'pearl', sprite: 'relic_pearl', name: T('Perla del Margine'),
    text: [T('La seconda perla. Si compra solo quando il prezzo sta ben sotto il valore stimato: quel margine ti protegge dagli errori di stima.')],
    hint: T('La seconda ostrica è giù, sul Fondale, nella sala in fondo alla scala.') },
  { id: 'pearl_3', cave: 'pearl', sprite: 'relic_pearl', name: T('Perla della Pazienza'),
    text: [T('La terza perla. Un prezzo basso non basta: il valore nascosto si vede nei conti, e il mercato può metterci anni a riconoscerlo.')],
    hint: T('La terza ostrica è sul Fondale, nella Nicchia della Pazienza: la chiude un Masso delle Commissioni.') },
];

export const RELIC_BY_ID: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const relicFlag = (id: string) => `relic_${id}`;
export function relicsOf(cave: CaveKey): Relic[] { return RELICS.filter((r) => r.cave === cave); }
/** Reperti raccolti (di una grotta, o di tutte) dati i flag del salvataggio. */
export function relicsFound(flags: Record<string, unknown>, cave?: CaveKey): number {
  return RELICS.filter((r) => (!cave || r.cave === cave) && !!flags[relicFlag(r.id)]).length;
}

// ---------------- Miniera: gallerie delle promesse ----------------

/** Una galleria che gira su sé stessa: chi ci entra torna all'ingresso della miniera e impara perché. */
export interface Trap { id: string; lesson: string[] }

export const TRAPS: Record<string, Trap> = {
  gold_1: { id: 'gold_1', lesson: [
    T('La galleria «garantita» curva, risale, curva ancora... e sbuca all\'ingresso della miniera.'),
    T('Nessuna vena d\'oro: solo un giro su sé stessa.'),
    T('Lezione della Miniera: rendimento certo e rischio zero non stanno insieme. Chi li promette entrambi ti fa girare in tondo.'),
  ] },
  gold_2: { id: 'gold_2', lesson: [
    T('La «scorciatoia» si stringe, piega, e ti riporta all\'ingresso della miniera.'),
    T('Lezione della Miniera: «doppio in metà tempo» vuol dire rischio doppio, oppure una bugia. E la parola di un capo non è una prova.'),
  ] },
  gold_3: { id: 'gold_3', lesson: [
    T('La «vena ricca» era una galleria vuota, che torna all\'ingresso della miniera.'),
    T('Lezione della Miniera: nessuna attività onesta rende il 30% al mese. E la fretta («posti limitati!») serve a non farti pensare.'),
  ] },
};
export const trapFlag = (id: string) => `trap_${id}`;

/** Chiave del salvataggio per un'incisione già letta (la prima lettura dà Conoscenza). */
export const signFlag = (map: string, x: number, y: number) => `sign_${map}_${x}_${y}`;

// ---------------- Perle: le tre ostriche ----------------

/** Livello della domanda di ciascuna ostrica (1..3): la serie sale di difficoltà. */
export const OYSTER_LEVEL = [2, 2, 3] as const;
export const oysterRelic = (n: number) => `pearl_${n}`;

/** Conoscenza per un reperto raccolto, per la prima lettura di un'incisione e per una lezione imparata cadendo. */
export const CAVE_XP = { relic: 20, sign: 8, trap: 10, set: 40 } as const;
