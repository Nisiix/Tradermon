import type { Track, AssetClass } from '../types';
import { T } from '../i18n';

export interface TownDef {
  id: string;
  name: string;
  sub: Record<Track, string>;
  mentor: number; // 0 = nessuno, 9 = Wall Street
  special?: 'simzone' | 'casino' | 'archive' | 'tower' | 'lab';
}

export const TOWNS: TownDef[] = [
  { id: 't0', name: T('Borgo Semina'), mentor: 0, special: 'lab', sub: { listed: T('dove nascono le idee'), crypto: T('dove nascono i blocchi'), mixed: T('dove nasce tutto') } },
  { id: 't1', name: T('Ponte Cedola'), mentor: 1, sub: { listed: T('città delle botteghe'), crypto: T('città dei nodi'), mixed: T('città dei crocevia') } },
  { id: 't2', name: T('Porto Ordini'), mentor: 2, sub: { listed: T('porto dei mercanti'), crypto: T('porto 24 ore su 24'), mixed: T('porto di tutte le rotte') } },
  { id: 't3', name: T('Diversia'), mentor: 3, special: 'simzone', sub: { listed: T('città dei mille settori'), crypto: T('città delle reti'), mixed: T('città dei colori') } },
  { id: 't4', name: T('Interessa'), mentor: 4, special: 'casino', sub: { listed: T('città della spirale'), crypto: T('città delle commissioni'), mixed: T('città del tempo') } },
  { id: 't5', name: T('Bilancia'), mentor: 5, special: 'archive', sub: { listed: T('città dei bilanci'), crypto: T('città delle chiavi'), mixed: T('città delle proporzioni') } },
  { id: 't6', name: T('Valdividendo'), mentor: 6, sub: { listed: T('città del raccolto'), crypto: T('città dell\'ancora'), mixed: T('città delle stagioni') } },
  { id: 't7', name: T('Mentelucida'), mentor: 7, sub: { listed: T('città degli specchi'), crypto: T('città senza rumore'), mixed: T('città della mente') } },
  { id: 't8', name: T('Rocca Rischio'), mentor: 8, sub: { listed: T('fortezza dello scudo'), crypto: T('fortezza delle mura'), mixed: T('fortezza dell\'equilibrio') } },
  { id: 't9', name: T('Wall Street'), mentor: 9, special: 'tower', sub: { listed: T('la piazza degli investitori'), crypto: T('la piazza degli investitori'), mixed: T('la piazza degli investitori') } },
];

export interface MentorDef {
  n: number;
  name: string;
  badge: string;
  technique: string;
  techDesc: string;
  intro: string;
  win: string;
  palette: number;
}

const COMMON: Record<number, Omit<MentorDef, 'name' | 'technique' | 'techDesc'> & { name?: string; technique?: string; techDesc?: string }> = {
  1: { n: 1, name: T('Gaia Primo'), badge: T('Attestato Seme'), technique: T('Lettura del Ticker'), techDesc: T('L\'Investidex mostra i fondamentali delle carte (livello 2).'), intro: T('Ogni grande albero è stato un seme. Vediamo se sai cosa stai piantando.'), win: T('Hai radici solide. Ora vediamo se crescono anche sul mercato vero.'), palette: 2 },
  2: { n: 2, name: T('Orazio Limite'), badge: T('Attestato Ordine'), technique: T('Ordine Limite'), techDesc: T('Puoi usare ordini limite veri in Banca e nella Macchina del Tempo.'), intro: T('Al porto chi non sa dare ordini precisi affonda. Mostrami la tua rotta!'), win: T('Ordini chiari, rotta sicura. Il treno ora ti aspetta.'), palette: 3 },
  3: { n: 3, name: T('Vera Varia'), badge: T('Attestato Mosaico'), technique: T('Ribilanciamento'), techDesc: T('La Banca calcola quanto il conto si è allontanato dalla tua allocazione obiettivo. Gli ordini li scegli tu.'), intro: T('Un mosaico con un solo colore è solo un muro. Sei pront{o|a} a diversificare?'), win: T('Che bel mosaico! Porta con te l\'arte del ribilanciamento.'), palette: 4 },
  4: { n: 4, name: T('Cosimo Composto'), badge: T('Attestato Spirale'), technique: T('Piano di Accumulo'), techDesc: T('Acquisti mensili nella Macchina del Tempo e nella Zona Simulazione. Sul conto di gioco il tuo piano di accumulo sono le rate di tappa.'), intro: T('Il tempo è il mio alleato e i costi il mio nemico. E i tuoi?'), win: T('Hai capito la spirale del composto. Piano piano, si va lontano.'), palette: 5 },
  7: { n: 7, name: T('Serena Bias'), badge: T('Attestato Specchio'), technique: T('Mente Fredda'), techDesc: T('Le notizie urlate non ti smuovono più: puoi attraversare il Muro del Rumore sul Percorso 7.'), intro: T('Il nemico più pericoloso dell\'investitore lo vedi ogni mattina allo specchio.'), win: T('Hai guardato le tue emozioni senza farti guidare. Mente fredda, cuore caldo.'), palette: 6 },
  8: { n: 8, name: T('Rocco Rischio'), badge: T('Attestato Scudo'), technique: T('Stop Loss'), techDesc: T('Puoi usare ordini stop veri in Banca e nella Macchina del Tempo.'), intro: T('Nessuno vince sempre. Vince chi sa quanto può perdere. Lo sai tu?'), win: T('Il tuo scudo è pronto. Wall Street ti aspetta.'), palette: 7 },
};

const M5: Record<Track, Partial<MentorDef>> = {
  listed: { name: T('Bianca Bilanci'), technique: T('Lettura del Bilancio'), techDesc: T('Livello 3 delle carte. Apre l\'Archivio di Bilancia.'), intro: T('Dietro ogni azione c\'è un bilancio, dietro ogni ETF un prospetto. Li sai leggere?') },
  crypto: { name: T('Nina Nodo'), technique: T('Custodia Sicura'), techDesc: T('Livello 3 delle carte. Apre l\'Archivio di Bilancia.'), intro: T('Le chiavi del tuo regno digitale: le sai custodire?') },
  mixed: { name: T('Alba Allocazione'), technique: T('Visione d\'Insieme'), techDesc: T('Livello 3 delle carte. Apre l\'Archivio di Bilancia.'), intro: T('Il segreto non è il singolo pezzo, ma le proporzioni.') },
};
const M6: Record<Track, Partial<MentorDef>> = {
  listed: { name: T('Dario Dividendi'), intro: T('Dividendi e cedole si seminano, si aspettano, si raccolgono. Conosci il ciclo, anche quando i tassi salgono?') },
  crypto: { name: T('Stella Stabile'), intro: T('Non tutto ciò che si dice stabile lo è davvero.') },
  mixed: { name: T('Teo Tassi'), intro: T('Azioni, obbligazioni, cripto: ognuna ha la sua stagione.') },
};

export function mentor(n: number, track: Track): MentorDef {
  if (n === 5) return { n, badge: T('Attestato Lente'), palette: 8, win: T('Ora vedi oltre la superficie. L\'Archivio di questa città è aperto per te.'), ...(M5[track] as Partial<MentorDef>) } as MentorDef;
  if (n === 6) return { n, badge: T('Attestato Raccolto'), palette: 9, technique: T('Reinvestimento'), techDesc: T('Sai leggere il rendimento da dividendo: in Banca la voce «Dividendi» mostra quali dei tuoi titoli ne pagano. (Il conto Paper non li simula: li vedi all\'opera nella missione.)'), win: T('Il raccolto è tuo. Ricorda: reinvestire è seminare di nuovo.'), ...(M6[track] as Partial<MentorDef>) } as MentorDef;
  return COMMON[n] as MentorDef;
}

export const LEAGUE = [
  { name: T('Marta Macro'), title: T('Superiore della Macroeconomia'), intro: T('Tassi, inflazione, cicli: il mondo intero muove il tuo portafoglio.'), palette: 10 },
  { name: T('Tito Tecnico'), title: T('Superiore dell\'Analisi'), intro: T('Grafici e bilanci sono mappe. Sai leggerle senza perderti?'), palette: 11 },
  { name: T('Giulia Garante'), title: T('Superiore delle Regole'), intro: T('Truffatori, abusivi, tasse: conosci le regole del gioco vero?'), palette: 12 },
  { name: T('Fabio Freddo'), title: T('Superiore della Psicologia'), intro: T('Il mercato prova a farti perdere la testa. Io ti metto alla prova.'), palette: 13 },
  { name: T('Aurelio Capitale'), title: T('Campione di Wall Street'), intro: T('Sono arrivato qui con pazienza e disciplina. Mostrami le tue.'), palette: 14 },
];

/** team con l'articolo ("gli Speculatori"), of con la preposizione ("degli Speculatori"), name senza articolo. */
export function antagonist(track: Track): { team: string; of: string; name: string; boss: string } {
  switch (track) {
    case 'listed': return { team: T('gli Speculatori'), of: T('degli Speculatori'), name: T('Speculatori'), boss: T('Max Leva') };
    case 'crypto': return { team: T('la Banda del Rug Pull'), of: T('della Banda del Rug Pull'), name: T('Banda del Rug Pull'), boss: T('il Re Tappeto') };
    default: return { team: T('l\'Alleanza degli Speculatori'), of: T('dell\'Alleanza degli Speculatori'), name: T('Alleanza degli Speculatori'), boss: T('Max Leva') };
  }
}

export const TRAINER_NAMES = [
  T('Investitrice Anna'), T('Risparmiatore Bruno'), T('Studentessa Carla'), T('Pensionato Dino'), T('Analista Elena'), T('Cassiere Franco'),
  T('Ingegnera Greta'), T('Barista Hugo'), T('Contabile Irene'), T('Pescatore Luca'), T('Maestra Marta'), T('Ciclista Nico'),
  T('Medica Olga'), T('Fornaio Paolo'), T('Architetta Rina'), T('Musicista Sergio'), T('Giardiniera Tina'), T('Postino Ugo'),
  T('Pilota Viola'), T('Cuoco Walter'), T('Sarta Zoe'), T('Guida Alpina Aldo'), T('Farmacista Bea'), T('Tassista Ciro'),
  T('Notaio Dante'), T('Fotografa Ester'), T('Meccanico Fausto'),
];

export const TRAINER_LINES = [
  T('Ehi! Scommetto che non sai rispondere a questa!'),
  T('Investire è facile, dicono. Vediamo!'),
  T('Ho letto un libro intero sulla borsa. Sfida!'),
  T('I miei risparmi sono al sicuro... e le tue risposte?'),
  T('Facciamo un ripasso veloce?'),
  T('Fermo lì! Domanda a sorpresa!'),
];

export const TRAINER_TIPS = [
  T('Consiglio: leggi sempre le spiegazioni, anche delle risposte giuste.'),
  T('Alla Banca la Professoressa del giorno ti fa ripassare le domande che hai sbagliato.'),
  T('Le Zone di Mercato pescano prima le domande che sbagli più spesso.'),
  T('In Banca la Dott.ssa Ratio smonta i bias con una riflessione: non servono scorciatoie.'),
  T('Il rendimento senza rischio non esiste. Diffida di chi lo promette.'),
  T('Un portafoglio con settori diversi soffre meno negli eventi di settore.'),
];
