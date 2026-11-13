// Segreti della seconda parte del gioco: dati puri (posizioni e testi), senza dipendenze dallo stato,
// così le mappe e i test possono usarli. La logica sta in secrets.ts.

/** Medaglie necessarie perché i segreti si risveglino: la seconda metà del viaggio (dopo la Whale 4). */
import { T } from '../i18n';
export const SECRET_BADGE = 4;

/** Una pagina strappata del Libro Mastro di Mastro Ventura, invisibile: si trova premendo A davanti al punto giusto. */
export interface LedgerPage { id: string; map: string; x: number; y: number; roman: string; text: string[]; clue: string }

export const LEDGER_PAGES: LedgerPage[] = [
  { id: 'p1', map: 'r5', x: 42, y: 12, roman: 'I', clue: T('nell\'angolo più a sud-est del Percorso 5, dove il sentiero non arriva'),
    text: [T('"I prezzi possono restare assurdi più a lungo di quanto i tuoi risparmi riescano a resistere.'), T('Per questo non ho mai usato la leva per dimostrare di avere ragione."')] },
  { id: 'p2', map: 'r6', x: 21, y: 12, roman: 'II', clue: T('in riva al ruscello del Percorso 6, proprio dove l\'acqua tocca il bordo sud'),
    text: [T('"Ho perso più denaro cercando di recuperare una perdita che con la perdita stessa.'), T('Dopo un brutto colpo chiudo il terminale e vado a camminare. Il mercato domani c\'è ancora."')] },
  { id: 'p3', map: 'r8', x: 40, y: 1, roman: 'III', clue: T('tra i fiori dell\'angolo nord-est del Percorso 8'),
    text: [T('"Prima di ogni acquisto scrivevo qui perché compravo e quando avrei venduto.'), T('Se non ci stava in due righe, non compravo. Quasi sempre avevo ragione a non farlo."')] },
  { id: 'p4', map: 'cave_gold', x: 11, y: 2, roman: 'IV', clue: T('in fondo alla prima galleria della Miniera dei Lingotti, dove la vena finisce'),
    text: [T('"Il rendimento lo decide il mercato. Costi, tasse e rotazione li decido io.'), T('Ho sempre cominciato da ciò che potevo controllare: è l\'unico guadagno garantito."')] },
  { id: 'p5', map: 'sea', x: 4, y: 6, roman: 'V', clue: T('dietro al Faro del Mare della Liquidità, dove la Guardiana non guarda mai'),
    text: [T('"Chiavi che non custodisci, monete che non sono tue.'), T('Ho visto piattaforme sparire in una notte con i depositi di tutti. Tieni fuori dagli exchange ciò che non ti serve per operare."')] },
  { id: 'p6', map: 'secret_tape', x: 1, y: 5, roman: 'VI', clue: T('in una stanza che nessuna mappa riporta. Al Casinò di Interessa qualcuno sussurra dove sia'),
    text: [T('"L\'ultima pagina, la più corta.'), T('Il mio vantaggio non è mai stato sapere di più degli altri. È stato aspettare più degli altri."')] },
];

export function pageAt(map: string, x: number, y: number): LedgerPage | undefined {
  return LEDGER_PAGES.find((p) => p.map === map && p.x === x && p.y === y);
}

/** Scaffale della Biblioteca di Bilancia con il libro al contrario: nasconde il passaggio per la Sala del Nastro. */
export const TAPE_SHELF = { map: 'library_5', x: 9, y: 2 } as const;
export const TAPE_ROOM = 'secret_tape';

/** Pietra delle Mani di Diamante sul Percorso 6: il giocatore deve starle davanti, rivolto verso di lei. */
export const HODL_STONE = { map: 'r6', x: 40, y: 2, standX: 40, standY: 3, facing: 'up' as const };
/** Quanto restare immobili davanti alla pietra (millisecondi di gioco reali). */
export const HODL_MS = 60_000;

/** Lo Squalo compare sull'Isola del Relitto solo nel fine settimana (giorni locali del giocatore). */
export const WHALE = { map: 'sea', x: 36, y: 7 } as const;
export function isWeekend(d = new Date()): boolean { const g = d.getDay(); return g === 0 || g === 6; }

/** Chiavi dei segreti principali (flag nel salvataggio). */
export const SECRET_FLAGS = {
  tapeOpen: 'secret_tape_open',
  tape: 'secret_tape_won',
  whale: 'secret_whale',
  hodl: 'secret_hodl',
} as const;
export const pageFlag = (id: string) => `secret_page_${id}`;

/**
 * Indizi vaghi sparsi tra i personaggi secondari: compaiono in coda alle loro frasi solo dalla Medaglia 4
 * e finché il segreto a cui alludono non è stato scoperto. Volutamente imprecisi: indicano una zona o
 * un'abitudine, mai la casella esatta.
 */
export type SecretKind = 'pages' | 'tape' | 'whale' | 'hodl' | 'rumors';
export const SECRET_HINTS: Record<string, { about: SecretKind; line: string }> = {
  t5_npc1: { about: 'pages', line: T('Ultimamente trovo fogli di un vecchio libro contabile portati dal vento. Chissà da dove arrivano... di certo non dalle strade battute.') },
  t6_npc2: { about: 'pages', line: T('Mio nonno diceva che i tesori veri stanno negli angoli dove nessuno si ferma. Lui si fermava sempre a guardare per terra.') },
  cave_gold_s: { about: 'pages', line: T('Una volta, laggiù in fondo dove la vena si esaurisce, ho visto un foglio di carta. Che ci faceva della carta in miniera?') },
  sea_sailor: { about: 'pages', line: T('La Guardiana del Faro guarda sempre il mare. Mai quello che le sta alle spalle.') },
  t5_npc2: { about: 'tape', line: T('Nella nostra Biblioteca c\'è un libro che nessuno legge nel verso giusto. La Bibliotecaria fa finta di niente.') },
  sea_wreck: { about: 'whale', line: T('I pescatori giurano che, nei giorni in cui la Borsa riposa, qualcosa di enorme si avvicina a quest\'isola.') },
  t2_npc2: { about: 'whale', line: T('Le cripto non chiudono mai, sai? Nel fine settimana al largo si vedono movimenti strani. Grossi.') },
  t7_npc1: { about: 'hodl', line: T('Qui a Mentelucida si dice che certe pietre parlino solo a chi sa restare fermo. Non un attimo: a lungo.') },
  t8_npc1: { about: 'hodl', line: T('Sul percorso che porta a Valdividendo, in alto tra i fiori, c\'è una pietra che nessuno sa leggere. Io ci ho provato, ma mi annoio subito.') },
  t6_npc1: { about: 'rumors', line: T('Al Casinò di Interessa c\'è uno che sussurra voci a chiunque. Metà sono fandonie... l\'altra metà no.') },
  t8_npc2: { about: 'rumors', line: T('Da quando hai metà degli Attestati la gente ti racconta cose strane, vero? Ascolta bene chi parla a bassa voce.') },
};
