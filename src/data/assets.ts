import type { AssetDef, AssetClass, Sector, Track } from '../types';

// Asset di fantasia della "Borsa di Capitalia". Servono come esempi didattici:
// nessuno corrisponde a un titolo reale e non sono raccomandazioni.
// mu = rendimento annuo atteso didattico, sigma = volatilità annua.

export const SECTOR_LABEL: Record<Sector, string> = {
  tech: 'Tecnologia', finance: 'Finanza', energy: 'Energia', health: 'Salute', consumer: 'Consumi',
  utility: 'Utility', bond: 'Obbligazioni', gold: 'Oro', crypto: 'Cripto', stable: 'Stablecoin', world: 'Globale',
};

export const SECTOR_COLOR: Record<Sector, string> = {
  tech: '#5b8cff', finance: '#3bb273', energy: '#f2a541', health: '#e5546b', consumer: '#b06ad9',
  utility: '#5fc9c9', bond: '#9aa5b1', gold: '#e8c547', crypto: '#ff7b39', stable: '#7fd1ae', world: '#4fa3e0',
};

const A = (a: AssetDef) => a;

export const ASSETS: AssetDef[] = [
  // --- Azioni ---
  A({ id: 'SLR', ticker: 'SLR', name: 'Solaria Energia', cls: 'stocks', sector: 'energy', risk: 3, mu: 0.08, sigma: 0.28, beta: 0.9, dividend: 0.02,
    desc: 'Produce pannelli solari e gestisce parchi eolici. Cresce con la domanda di energia pulita, soffre quando i tassi salgono.',
    facts: ['Utile per azione 2,10 · P/E 18 · dividendo 2%', 'Volatilità 28% · beta 0,9 · peggior calo simulato −45%', 'Nata in un garage di Borgo Semina: il primo pannello alimentava una lampadina.'], unlock: 'starter' }),
  A({ id: 'BYT', ticker: 'BYT', name: 'Bytefonte', cls: 'stocks', sector: 'tech', risk: 4, mu: 0.12, sigma: 0.35, beta: 1.3, dividend: 0,
    desc: 'Software in cloud per le aziende. Crescita rapida, nessun dividendo: reinveste tutto.', facts: ['P/E 45 · ricavi +30% annuo · nessun dividendo', 'Volatilità 35% · beta 1,3 · peggior calo simulato −70%', 'I suoi server sono raffreddati con l\'acqua del lago di Diversia.'], unlock: 'badge:1' }),
  A({ id: 'CDB', ticker: 'CDB', name: 'Credito di Borgo', cls: 'stocks', sector: 'finance', risk: 3, mu: 0.07, sigma: 0.25, beta: 1.1, dividend: 0.045,
    desc: 'Banca regionale. Guadagna di più quando i tassi salgono, soffre nelle recessioni.', facts: ['P/E 9 · dividendo 4,5% · debito/patrimonio tipico di una banca', 'Volatilità 25% · beta 1,1 · peggior calo simulato −60%', 'Il caveau è nella vecchia torre dell\'orologio.'], unlock: 'badge:2' }),
  A({ id: 'VTL', ticker: 'VTL', name: 'Vitalis Farmaci', cls: 'stocks', sector: 'health', risk: 2, mu: 0.07, sigma: 0.18, beta: 0.7, dividend: 0.025,
    desc: 'Farmaci generici e vaccini. Settore difensivo: la domanda regge anche nelle crisi.', facts: ['P/E 16 · dividendo 2,5% · debito basso', 'Volatilità 18% · beta 0,7 · peggior calo simulato −30%', 'Ha un laboratorio aperto ai visitatori a Mentelucida.'], unlock: 'badge:3' }),
  A({ id: 'PNE', ticker: 'PNE', name: 'Pane & Co.', cls: 'stocks', sector: 'consumer', risk: 2, mu: 0.06, sigma: 0.16, beta: 0.6, dividend: 0.035,
    desc: 'Alimentari e beni di prima necessità. Cresce piano, ma con pochi scossoni.', facts: ['P/E 20 · dividendo 3,5% · payout 70%', 'Volatilità 16% · beta 0,6 · peggior calo simulato −25%', 'Il suo forno più antico è a Valdividendo.'], unlock: 'badge:4' }),
  A({ id: 'ACQ', ticker: 'ACQ', name: 'Acquedotti Uniti', cls: 'stocks', sector: 'utility', risk: 2, mu: 0.055, sigma: 0.15, beta: 0.5, dividend: 0.045,
    desc: 'Gestisce reti idriche ed elettriche. Ricavi regolati e stabili, sensibile ai tassi.', facts: ['P/E 17 · dividendo 4,5% · debito alto ma stabile', 'Volatilità 15% · beta 0,5 · peggior calo simulato −30%', 'Ogni fontana di Capitalia è collegata alla sua rete.'], unlock: 'badge:5' }),
  A({ id: 'RZM', ticker: 'RZM', name: 'Razzomania', cls: 'stocks', sector: 'tech', risk: 5, mu: 0.05, sigma: 0.65, beta: 1.8, dividend: 0,
    desc: 'Start-up di "taxi spaziali". Ancora senza ricavi, tantissima attenzione sui social.', facts: ['P/E non disponibile (in perdita) · debiti in crescita', 'Volatilità 65% · beta 1,8 · peggior calo simulato −90%', 'Non ha ancora lanciato nulla.'], unlock: 'badge:6' }),
  A({ id: 'MCN', ticker: 'MCN', name: 'Meccanica Nord', cls: 'stocks', sector: 'consumer', risk: 3, mu: 0.075, sigma: 0.24, beta: 1.1, dividend: 0.02,
    desc: 'Macchinari industriali. Ciclica: va bene quando l\'economia cresce.', facts: ['P/E 13 · dividendo 2% · ordini in crescita', 'Volatilità 24% · beta 1,1 · peggior calo simulato −55%', 'Ha costruito i treni che collegano le città.'], unlock: 'badge:7' }),
  A({ id: 'ORX', ticker: 'ORX', name: 'Oryx Petroli', cls: 'stocks', sector: 'energy', risk: 3, mu: 0.06, sigma: 0.30, beta: 1.0, dividend: 0.05,
    desc: 'Estrazione e raffinazione. Segue il prezzo del petrolio.', facts: ['P/E 8 · dividendo 5% · utili molto variabili', 'Volatilità 30% · beta 1,0 · peggior calo simulato −65%', 'Si sta convertendo lentamente alle rinnovabili.'], unlock: 'badge:8' }),
  // --- ETF ---
  A({ id: 'GLB', ticker: 'GLB', name: 'Globo Mondo ETF', cls: 'etf', sector: 'world', risk: 3, mu: 0.07, sigma: 0.16, beta: 1.0, dividend: 0.018, ter: 0.002,
    desc: 'Replica fisica di un indice azionario globale con oltre 1.500 aziende di 23 Paesi.', facts: ['TER 0,20% · replica fisica · ad accumulazione nel gioco', 'Volatilità 16% · peggior calo simulato −50%', 'Il primo ETF quotato alla Borsa di Capitalia.'], unlock: 'starter' }),
  A({ id: 'USX', ticker: 'USX', name: 'Stelle Unite 500 ETF', cls: 'etf', sector: 'world', risk: 3, mu: 0.08, sigma: 0.17, beta: 1.05, dividend: 0.014, ter: 0.0007,
    desc: 'Le 500 maggiori aziende del grande mercato d\'oltreoceano. Molto peso sulla tecnologia.', facts: ['TER 0,07% · replica fisica · rischio di cambio', 'Volatilità 17% · peggior calo simulato −55%', 'Le prime 10 aziende pesano circa un terzo.'], unlock: 'badge:1' }),
  A({ id: 'EUR', ticker: 'EUR', name: 'Continente ETF', cls: 'etf', sector: 'world', risk: 3, mu: 0.06, sigma: 0.17, beta: 0.95, dividend: 0.028, ter: 0.0012,
    desc: 'Grandi e medie aziende europee. Più banche e industria, meno tecnologia.', facts: ['TER 0,12% · replica fisica', 'Volatilità 17% · peggior calo simulato −55%', 'Distribuisce i dividendi due volte l\'anno.'], unlock: 'badge:2' }),
  A({ id: 'EMG', ticker: 'EMG', name: 'Emergenti ETF', cls: 'etf', sector: 'world', risk: 4, mu: 0.075, sigma: 0.22, beta: 1.1, dividend: 0.025, ter: 0.0018,
    desc: 'Aziende dei Paesi emergenti. Più crescita potenziale, più rischi politici e di cambio.', facts: ['TER 0,18% · replica a campione', 'Volatilità 22% · peggior calo simulato −60%', 'Copre 24 Paesi.'], unlock: 'badge:3' }),
  A({ id: 'GOV', ticker: 'GOV', name: 'Titoli di Stato ETF', cls: 'etf', sector: 'bond', risk: 1, mu: 0.03, sigma: 0.05, beta: 0.05, dividend: 0.028, ter: 0.0009,
    desc: 'Obbligazioni governative di alta qualità, duration media 7.', facts: ['TER 0,09% · duration 7 · rating medio AA', 'Volatilità 5% · peggior calo simulato −17% (tassi in salita)', 'Se i tassi salgono dell\'1%, perde circa il 7%.'], unlock: 'badge:4' }),
  A({ id: 'CRP', ticker: 'CRP', name: 'Obbligazioni Aziendali ETF', cls: 'etf', sector: 'bond', risk: 2, mu: 0.04, sigma: 0.07, beta: 0.2, dividend: 0.04, ter: 0.0014,
    desc: 'Obbligazioni di grandi aziende con buon rating.', facts: ['TER 0,14% · duration 5', 'Volatilità 7% · peggior calo simulato −20%', 'Rende di più dei titoli di Stato per compensare il rischio di credito.'], unlock: 'badge:5' }),
  A({ id: 'ORO', ticker: 'ORO', name: 'Lingotto ETC', cls: 'etf', sector: 'gold', risk: 3, mu: 0.04, sigma: 0.15, beta: 0.0, dividend: 0, ter: 0.0025,
    desc: 'Segue il prezzo dell\'oro fisico custodito in caveau.', facts: ['TER 0,25% · nessun flusso di cassa', 'Volatilità 15% · beta circa 0', 'Tende a salire nei momenti di paura.'], unlock: 'badge:6' }),
  A({ id: 'TKE', ticker: 'TKE', name: 'Tecno Settore ETF', cls: 'etf', sector: 'tech', risk: 4, mu: 0.09, sigma: 0.25, beta: 1.25, dividend: 0.006, ter: 0.0035,
    desc: 'Solo aziende tecnologiche: meno diversificato di un ETF globale.', facts: ['TER 0,35% · settoriale', 'Volatilità 25% · peggior calo simulato −75%', 'Un ETF non è automaticamente diversificato.'], unlock: 'badge:7' }),
  A({ id: 'BIL', ticker: 'BIL', name: 'Bilanciato 60/40 ETF', cls: 'etf', sector: 'world', risk: 2, mu: 0.055, sigma: 0.10, beta: 0.6, dividend: 0.02, ter: 0.0025,
    desc: '60% azioni globali e 40% obbligazioni, ribilanciato automaticamente.', facts: ['TER 0,25% · multi-asset', 'Volatilità 10% · peggior calo simulato −30%', 'Ribilancia ogni trimestre.'], unlock: 'badge:8' }),
  // --- Cripto ---
  A({ id: 'GRN', ticker: 'GRN', name: 'Granito', cls: 'crypto', sector: 'crypto', risk: 5, mu: 0.15, sigma: 0.70, beta: 1.5, dividend: 0,
    desc: 'La prima cripto di Capitalia, offerta limitata e rete proof-of-work. Volatilità estrema.', facts: ['Offerta massima fissa · nessun flusso di cassa', 'Volatilità 70% · peggior calo simulato −80%', 'Il primo blocco contiene un proverbio di Borgo Semina.'], unlock: 'starter' }),
  A({ id: 'LMN', ticker: 'LMN', name: 'Lumen', cls: 'crypto', sector: 'crypto', risk: 5, mu: 0.15, sigma: 0.80, beta: 1.7, dividend: 0,
    desc: 'Piattaforma per smart contract e applicazioni DeFi, proof-of-stake.', facts: ['Proof-of-stake · ricompense di staking variabili', 'Volatilità 80% · peggior calo simulato −85%', 'Molti token di Capitalia sono costruiti sulla sua rete.'], unlock: 'badge:1' }),
  A({ id: 'ANC', ticker: 'ANC', name: 'Ancora USD', cls: 'crypto', sector: 'stable', risk: 2, mu: 0.0, sigma: 0.01, beta: 0.0, dividend: 0,
    desc: 'Stablecoin garantita da riserve in titoli di Stato a breve, con attestazioni mensili.', facts: ['Aggancio 1:1 · riserve verificate', 'Volatilità quasi nulla · rischio emittente', 'Non è un deposito bancario: nessuna garanzia pubblica.'], unlock: 'badge:2' }),
  A({ id: 'FLX', ticker: 'FLX', name: 'Flusso', cls: 'crypto', sector: 'crypto', risk: 5, mu: 0.10, sigma: 0.95, beta: 1.9, dividend: 0,
    desc: 'Blockchain veloce per pagamenti. Ha avuto diversi blocchi della rete.', facts: ['Rete giovane · validatori concentrati', 'Volatilità 95% · peggior calo simulato −90%', 'Si è fermata 4 volte in un anno.'], unlock: 'badge:4' }),
  A({ id: 'MEM', ticker: 'MEM', name: 'Gattomoneta', cls: 'crypto', sector: 'crypto', risk: 5, mu: -0.10, sigma: 1.30, beta: 2.0, dividend: 0,
    desc: 'Meme coin nata per scherzo. Nessuna utilità, solo passaparola.', facts: ['Nessuna utilità dichiarata', 'Volatilità 130% · peggior calo simulato −95%', 'Il logo è un gatto con gli occhiali da sole.'], unlock: 'badge:6' }),
  A({ id: 'ORT', ticker: 'ORT', name: 'Oro Tokenizzato', cls: 'crypto', sector: 'gold', risk: 3, mu: 0.04, sigma: 0.16, beta: 0.0, dividend: 0,
    desc: 'Token garantito da oro fisico. Unisce rischio dell\'oro e rischio dell\'emittente.', facts: ['1 token = 1 grammo d\'oro in caveau', 'Volatilità 16%', 'Si può riscattare il lingotto sopra una soglia minima.'], unlock: 'badge:8' }),
];

export const ASSET_BY_ID: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export function classesOf(track: Track, mixed: AssetClass[]): AssetClass[] {
  return track === 'mixed' ? mixed : [track];
}

export function starterFor(cls: AssetClass): string {
  return cls === 'stocks' ? 'SLR' : cls === 'etf' ? 'GLB' : 'GRN';
}

/** Asset disponibili nel percorso con il numero di Medaglie dato. */
export function unlockedAssets(track: Track, mixed: AssetClass[], badges: number, extra: string[] = []): AssetDef[] {
  const cls = classesOf(track, mixed);
  return ASSETS.filter((a) => {
    if (!cls.includes(a.cls)) return false;
    if (extra.includes(a.id)) return true;
    if (a.unlock === 'starter') return a.id === starterFor(cls[0]) || badges >= 1;
    const m = /^badge:(\d)$/.exec(a.unlock);
    return m ? badges >= Number(m[1]) : false;
  });
}

/** Classifica un asset come rischioso, difensivo per l'allocazione obiettivo. */
export function isDefensive(a: AssetDef): boolean {
  return a.sector === 'bond' || a.sector === 'stable' || a.sector === 'gold' || a.risk <= 2;
}
