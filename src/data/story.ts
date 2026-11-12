import type { Track, AssetClass } from '../types';

export interface TownDef {
  id: string;
  name: string;
  sub: Record<Track, string>;
  mentor: number; // 0 = nessuno, 9 = Wall Street
  special?: 'simzone' | 'casino' | 'archive' | 'tower' | 'lab';
}

export const TOWNS: TownDef[] = [
  { id: 't0', name: 'Borgo Semina', mentor: 0, special: 'lab', sub: { stocks: 'dove nascono le idee', etf: 'dove nascono i piani', crypto: 'dove nascono i blocchi', mixed: 'dove nasce tutto' } },
  { id: 't1', name: 'Ponte Cedola', mentor: 1, sub: { stocks: 'città delle botteghe', etf: 'città dei panieri', crypto: 'città dei nodi', mixed: 'città dei crocevia' } },
  { id: 't2', name: 'Porto Ordini', mentor: 2, sub: { stocks: 'porto dei mercanti', etf: 'porto dei convogli', crypto: 'porto 24 ore su 24', mixed: 'porto di tutte le rotte' } },
  { id: 't3', name: 'Diversia', mentor: 3, special: 'simzone', sub: { stocks: 'città dei mille settori', etf: 'città degli indici', crypto: 'città delle reti', mixed: 'città dei colori' } },
  { id: 't4', name: 'Interessa', mentor: 4, special: 'casino', sub: { stocks: 'città della spirale', etf: 'città dell\'accumulo', crypto: 'città delle commissioni', mixed: 'città del tempo' } },
  { id: 't5', name: 'Bilancia', mentor: 5, special: 'archive', sub: { stocks: 'città dei bilanci', etf: 'città dei prospetti', crypto: 'città delle chiavi', mixed: 'città delle proporzioni' } },
  { id: 't6', name: 'Valdividendo', mentor: 6, sub: { stocks: 'città del raccolto', etf: 'città delle cedole', crypto: 'città dell\'ancora', mixed: 'città delle stagioni' } },
  { id: 't7', name: 'Mentelucida', mentor: 7, sub: { stocks: 'città degli specchi', etf: 'città della calma', crypto: 'città senza rumore', mixed: 'città della mente' } },
  { id: 't8', name: 'Rocca Rischio', mentor: 8, sub: { stocks: 'fortezza dello scudo', etf: 'fortezza della prudenza', crypto: 'fortezza delle mura', mixed: 'fortezza dell\'equilibrio' } },
  { id: 't9', name: 'Wall Street', mentor: 9, special: 'tower', sub: { stocks: 'la piazza degli investitori', etf: 'la piazza degli investitori', crypto: 'la piazza degli investitori', mixed: 'la piazza degli investitori' } },
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
  1: { n: 1, name: 'Gaia Primo', badge: 'Medaglia Seme', technique: 'Lettura del Ticker', techDesc: 'L\'Investidex mostra i fondamentali delle carte (livello 2).', intro: 'Ogni grande albero è stato un seme. Vediamo se sai cosa stai piantando.', win: 'Hai radici solide. Ora vediamo se crescono anche sul mercato vero.', palette: 2 },
  2: { n: 2, name: 'Orazio Limite', badge: 'Medaglia Ordine', technique: 'Ordine Limite', techDesc: 'Puoi usare ordini limite veri in Banca e nella Macchina del Tempo.', intro: 'Al porto chi non sa dare ordini precisi affonda. Mostrami la tua rotta!', win: 'Ordini chiari, rotta sicura. Il treno ora ti aspetta.', palette: 3 },
  3: { n: 3, name: 'Vera Varia', badge: 'Medaglia Mosaico', technique: 'Ribilanciamento', techDesc: 'La Banca calcola quanto il conto si è allontanato dalla tua allocazione obiettivo. Gli ordini li scegli tu.', intro: 'Un mosaico con un solo colore è solo un muro. Sei pront{o|a} a diversificare?', win: 'Che bel mosaico! Porta con te l\'arte del ribilanciamento.', palette: 4 },
  4: { n: 4, name: 'Cosimo Composto', badge: 'Medaglia Spirale', technique: 'Piano di Accumulo', techDesc: 'Acquisti mensili nella Macchina del Tempo e nella Zona Simulazione. Sul conto di gioco il tuo piano di accumulo sono le rate di tappa.', intro: 'Il tempo è il mio alleato e i costi il mio nemico. E i tuoi?', win: 'Hai capito la spirale del composto. Piano piano, si va lontano.', palette: 5 },
  7: { n: 7, name: 'Serena Bias', badge: 'Medaglia Specchio', technique: 'Mente Fredda', techDesc: 'Le notizie urlate non ti smuovono più: puoi attraversare il Muro del Rumore sul Percorso 7.', intro: 'Il nemico più pericoloso dell\'investitore lo vedi ogni mattina allo specchio.', win: 'Hai guardato le tue emozioni senza farti guidare. Mente fredda, cuore caldo.', palette: 6 },
  8: { n: 8, name: 'Rocco Rischio', badge: 'Medaglia Scudo', technique: 'Stop Loss', techDesc: 'Puoi usare ordini stop veri in Banca e nella Macchina del Tempo.', intro: 'Nessuno vince sempre. Vince chi sa quanto può perdere. Lo sai tu?', win: 'Il tuo scudo è pronto. Wall Street ti aspetta.', palette: 7 },
};

const M5: Record<AssetClass | 'mixed', Partial<MentorDef>> = {
  stocks: { name: 'Bianca Bilanci', technique: 'Lettura del Bilancio', techDesc: 'Livello 3 delle carte. Apre l\'Archivio di Bilancia.', intro: 'Dietro ogni azione c\'è un\'azienda, e dietro ogni azienda un bilancio.' },
  etf: { name: 'Ivo Indice', technique: 'Analisi del Prospetto', techDesc: 'Livello 3 delle carte. Apre l\'Archivio di Bilancia.', intro: 'Due ETF possono sembrare gemelli. Il prospetto dice la verità.' },
  crypto: { name: 'Nina Nodo', technique: 'Custodia Sicura', techDesc: 'Livello 3 delle carte. Apre l\'Archivio di Bilancia.', intro: 'Le chiavi del tuo regno digitale: le sai custodire?' },
  mixed: { name: 'Alba Allocazione', technique: 'Visione d\'Insieme', techDesc: 'Livello 3 delle carte. Apre l\'Archivio di Bilancia.', intro: 'Il segreto non è il singolo pezzo, ma le proporzioni.' },
};
const M6: Record<AssetClass | 'mixed', Partial<MentorDef>> = {
  stocks: { name: 'Dario Dividendi', intro: 'Seminare, aspettare, raccogliere, riseminare. Conosci il ciclo?' },
  etf: { name: 'Olga Obbligazioni', intro: 'Quando i tassi salgono, i prezzi scendono. Reggi l\'onda?' },
  crypto: { name: 'Stella Stabile', intro: 'Non tutto ciò che si dice stabile lo è davvero.' },
  mixed: { name: 'Teo Tassi', intro: 'Azioni, obbligazioni, cripto: ognuna ha la sua stagione.' },
};

export function mentor(n: number, track: Track): MentorDef {
  if (n === 5) return { n, badge: 'Medaglia Lente', palette: 8, win: 'Ora vedi oltre la superficie. L\'Archivio di questa città è aperto per te.', ...(M5[track] as Partial<MentorDef>) } as MentorDef;
  if (n === 6) return { n, badge: 'Medaglia Raccolto', palette: 9, technique: 'Reinvestimento', techDesc: 'Sai leggere il rendimento da dividendo: in Banca la voce «Dividendi» mostra quali dei tuoi titoli ne pagano. (Il conto Paper non li simula: li vedi all\'opera nella missione.)', win: 'Il raccolto è tuo. Ricorda: reinvestire è seminare di nuovo.', ...(M6[track] as Partial<MentorDef>) } as MentorDef;
  return COMMON[n] as MentorDef;
}

export const LEAGUE = [
  { name: 'Marta Macro', title: 'Superiore della Macroeconomia', intro: 'Tassi, inflazione, cicli: il mondo intero muove il tuo portafoglio.', palette: 10 },
  { name: 'Tito Tecnico', title: 'Superiore dell\'Analisi', intro: 'Grafici e bilanci sono mappe. Sai leggerle senza perderti?', palette: 11 },
  { name: 'Giulia Garante', title: 'Superiore delle Regole', intro: 'Truffatori, abusivi, tasse: conosci le regole del gioco vero?', palette: 12 },
  { name: 'Fabio Freddo', title: 'Superiore della Psicologia', intro: 'Il mercato prova a farti perdere la testa. Io ti metto alla prova.', palette: 13 },
  { name: 'Aurelio Capitale', title: 'Campione di Wall Street', intro: 'Sono arrivato qui con pazienza e disciplina. Mostrami le tue.', palette: 14 },
];

export function antagonist(track: Track): { team: string; boss: string } {
  switch (track) {
    case 'stocks': return { team: 'gli Speculatori', boss: 'Max Leva' };
    case 'etf': return { team: 'i Venditori di Commissioni', boss: 'Carlo Provvigione' };
    case 'crypto': return { team: 'la Banda del Rug Pull', boss: 'il Re Tappeto' };
    default: return { team: 'l\'Alleanza degli Speculatori', boss: 'Max Leva' };
  }
}

export const TRAINER_NAMES = [
  'Investitrice Anna', 'Risparmiatore Bruno', 'Studentessa Carla', 'Pensionato Dino', 'Analista Elena', 'Cassiere Franco',
  'Ingegnera Greta', 'Barista Hugo', 'Contabile Irene', 'Pescatore Luca', 'Maestra Marta', 'Ciclista Nico',
  'Medica Olga', 'Fornaio Paolo', 'Architetta Rina', 'Musicista Sergio', 'Giardiniera Tina', 'Postino Ugo',
  'Pilota Viola', 'Cuoco Walter', 'Sarta Zoe', 'Guida Alpina Aldo', 'Farmacista Bea', 'Tassista Ciro',
  'Notaio Dante', 'Fotografa Ester', 'Meccanico Fausto',
];

export const TRAINER_LINES = [
  'Ehi! Scommetto che non sai rispondere a questa!',
  'Investire è facile, dicono. Vediamo!',
  'Ho letto un libro intero sulla borsa. Sfida!',
  'I miei risparmi sono al sicuro... e le tue risposte?',
  'Facciamo un ripasso veloce?',
  'Fermo lì! Domanda a sorpresa!',
];

export const TRAINER_TIPS = [
  'Consiglio: leggi sempre le spiegazioni, anche delle risposte giuste.',
  'Alla Biblioteca puoi ripassare le domande che hai sbagliato.',
  'Le Zone di Mercato pescano prima le domande che sbagli più spesso.',
  'In Banca la Dott.ssa Ratio smonta i bias con una riflessione: non servono scorciatoie.',
  'Il rendimento senza rischio non esiste. Diffida di chi lo promette.',
  'Un portafoglio con settori diversi soffre meno negli eventi di settore.',
];
