import type { AssetDef, AssetClass, Sector, Track } from '../types';
import { T } from '../i18n';

// Vetrina dei titoli REALI di Tradermon: azioni ed ETF quotati negli Stati Uniti e cripto, tutti
// negoziabili su Alpaca. L'id è il simbolo Alpaca (per le cripto "BTC/USD"). Nessun asset di prova:
// prezzi, grafici e missioni arrivano dai dati veri di Alpaca.
//
// La vetrina è in ordine alfabetico dentro ogni gruppo e non è una raccomandazione: serve a imparare
// a confrontare settori, costi e rischi. I valori di rischio (1-5), volatilità tipica, dividendo e
// TER sono INDICATIVI (ordini di grandezza storici, non dati in tempo reale): le schede lo dicono e
// rimandano al documento ufficiale (KID, prospetto, bilancio) per i numeri aggiornati.

export const SECTOR_LABEL: Record<Sector, string> = {
  tech: T('Tecnologia'), finance: T('Finanza'), energy: T('Energia'), health: T('Salute'), consumer: T('Consumi'),
  utility: T('Utility'), bond: T('Obbligazioni'), gold: T('Oro'), crypto: T('Cripto'), stable: T('Stablecoin'), world: T('Globale'),
};

export const SECTOR_COLOR: Record<Sector, string> = {
  tech: '#5b8cff', finance: '#3bb273', energy: '#f2a541', health: '#e5546b', consumer: '#b06ad9',
  utility: '#5fc9c9', bond: '#9aa5b1', gold: '#e8c547', crypto: '#ff7b39', stable: '#7fd1ae', world: '#4fa3e0',
};

const A = (a: Omit<AssetDef, 'mu'> & { mu?: number }): AssetDef => ({ mu: 0, ...a });

export const ASSETS: AssetDef[] = [
  // --- Azioni (scelta iniziale: una per settore) ---
  A({ id: 'AAPL', ticker: 'AAPL', name: 'Apple', cls: 'stocks', sector: 'tech', risk: 3, sigma: 0.28, beta: 1.2, dividend: 0.005,
    desc: T('Smartphone, computer e servizi digitali. Una delle aziende più grandi del mondo per capitalizzazione.'), facts: [T('Grande capitalizzazione · dividendo modesto e riacquisti di azioni proprie'), T('Ricavi molto legati a un prodotto principale'), T('Dati aggiornati: bilancio annuale (modulo 10-K) sul sito dell\'azienda')], unlock: 'starter' }),
  A({ id: 'JNJ', ticker: 'JNJ', name: 'Johnson & Johnson', cls: 'stocks', sector: 'health', risk: 2, sigma: 0.18, beta: 0.6, dividend: 0.03,
    desc: T('Farmaci e dispositivi medici. Settore considerato difensivo: la domanda cambia poco con l\'economia.'), facts: [T('Dividendo pagato e aumentato per decenni'), T('Rischi tipici: cause legali e scadenza dei brevetti'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'starter' }),
  A({ id: 'JPM', ticker: 'JPM', name: 'JPMorgan Chase', cls: 'stocks', sector: 'finance', risk: 3, sigma: 0.26, beta: 1.1, dividend: 0.02,
    desc: T('La più grande banca degli Stati Uniti. Guadagna con prestiti, gestione del risparmio e investment banking.'), facts: [T('Utili sensibili ai tassi d\'interesse e al credito'), T('Le banche soffrono più del mercato nelle crisi finanziarie'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'starter' }),
  A({ id: 'KO', ticker: 'KO', name: 'Coca-Cola', cls: 'stocks', sector: 'consumer', risk: 2, sigma: 0.17, beta: 0.6, dividend: 0.03,
    desc: T('Bevande vendute in quasi tutti i Paesi. Marchio forte, crescita lenta e regolare.'), facts: [T('Dividendo storico e costante'), T('Crescita bassa: il prezzo dipende molto dal dividendo'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'starter' }),
  A({ id: 'NEE', ticker: 'NEE', name: 'NextEra Energy', cls: 'stocks', sector: 'utility', risk: 2, sigma: 0.22, beta: 0.7, dividend: 0.03,
    desc: T('Elettricità regolata in Florida e grandi impianti eolici e solari. Utility: ricavi stabili, molto debito.'), facts: [T('Sensibile ai tassi: il debito costa di più quando salgono'), T('Dividendo regolare'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'starter' }),
  A({ id: 'XOM', ticker: 'XOM', name: 'Exxon Mobil', cls: 'stocks', sector: 'energy', risk: 3, sigma: 0.27, beta: 0.9, dividend: 0.035,
    desc: T('Petrolio e gas, dall\'estrazione alla raffinazione. Gli utili seguono il prezzo del greggio.'), facts: [T('Ciclico: utili alti quando il petrolio è caro, bassi quando crolla'), T('Dividendo elevato'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'starter' }),
  // --- Azioni sbloccate dalle Medaglie ---
  A({ id: 'MSFT', ticker: 'MSFT', name: 'Microsoft', cls: 'stocks', sector: 'tech', risk: 3, sigma: 0.27, beta: 1.1, dividend: 0.008,
    desc: T('Software, cloud e videogiochi. Ricavi in gran parte ricorrenti da abbonamenti.'), facts: [T('Grande capitalizzazione · dividendo basso'), T('Il cloud è il motore della crescita'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:1' }),
  A({ id: 'PG', ticker: 'PG', name: 'Procter & Gamble', cls: 'stocks', sector: 'consumer', risk: 2, sigma: 0.17, beta: 0.5, dividend: 0.025,
    desc: T('Prodotti per la casa e la persona. Beni che si comprano anche in recessione.'), facts: [T('Difensivo: cala meno del mercato nelle crisi'), T('Dividendo pagato da oltre un secolo'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:2' }),
  A({ id: 'NVDA', ticker: 'NVDA', name: 'NVIDIA', cls: 'stocks', sector: 'tech', risk: 5, sigma: 0.50, beta: 1.7, dividend: 0,
    desc: T('Processori grafici per videogiochi, data center e intelligenza artificiale. Crescita fortissima e prezzo molto volatile.'), facts: [T('Valutazione alta: il prezzo sconta molta crescita futura'), T('Ha avuto cali di oltre il 50% più volte'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:3' }),
  A({ id: 'UNH', ticker: 'UNH', name: 'UnitedHealth', cls: 'stocks', sector: 'health', risk: 3, sigma: 0.24, beta: 0.7, dividend: 0.015,
    desc: T('Assicurazioni sanitarie e servizi medici negli Stati Uniti.'), facts: [T('Rischio regolatorio: dipende dalle regole della sanità USA'), T('Dividendo in crescita'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:4' }),
  A({ id: 'V', ticker: 'V', name: 'Visa', cls: 'stocks', sector: 'finance', risk: 3, sigma: 0.22, beta: 1.0, dividend: 0.008,
    desc: T('Rete di pagamento con carta: guadagna una piccola commissione su moltissime transazioni.'), facts: [T('Non presta denaro: rischio di credito basso'), T('Margini molto alti'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:5' }),
  A({ id: 'DUK', ticker: 'DUK', name: 'Duke Energy', cls: 'stocks', sector: 'utility', risk: 2, sigma: 0.19, beta: 0.5, dividend: 0.04,
    desc: T('Elettricità e gas regolati nel sud-est degli Stati Uniti.'), facts: [T('Ricavi stabili · molto debito'), T('Dividendo elevato'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:6' }),
  A({ id: 'TSLA', ticker: 'TSLA', name: 'Tesla', cls: 'stocks', sector: 'consumer', risk: 5, sigma: 0.60, beta: 2.0, dividend: 0,
    desc: T('Auto elettriche e batterie. Prezzo guidato da aspettative e notizie: uno dei titoli più volatili tra i grandi.'), facts: [T('Valutazione molto alta rispetto agli utili'), T('Ha avuto cali di oltre il 60%'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:7' }),
  A({ id: 'CVX', ticker: 'CVX', name: 'Chevron', cls: 'stocks', sector: 'energy', risk: 3, sigma: 0.26, beta: 0.9, dividend: 0.04,
    desc: T('Petrolio e gas integrati. Simile a Exxon: utili legati al prezzo del greggio.'), facts: [T('Ciclico'), T('Dividendo elevato'), T('Dati aggiornati: bilancio annuale (10-K)')], unlock: 'badge:8' }),
  // --- ETF (scelta iniziale: tre indici azionari ampi) ---
  A({ id: 'SPY', ticker: 'SPY', name: 'SPDR S&P 500 ETF', cls: 'etf', sector: 'world', risk: 3, sigma: 0.17, beta: 1.0, dividend: 0.013, ter: 0.00095,
    desc: T('Replica l\'indice S&P 500: le circa 500 maggiori aziende degli Stati Uniti. Il più antico e scambiato ETF del mondo.'), facts: [T('Costo annuo (TER) indicativo circa 0,09%'), T('Solo Stati Uniti: diversificato per azienda, non per Paese'), T('Dati aggiornati: prospetto e scheda dell\'emittente')], unlock: 'starter' }),
  A({ id: 'VGK', ticker: 'VGK', name: 'Vanguard FTSE Europe ETF', cls: 'etf', sector: 'world', risk: 3, sigma: 0.18, beta: 1.0, dividend: 0.03, ter: 0.0006,
    desc: T('Azioni delle grandi e medie aziende europee, Italia compresa.'), facts: [T('TER indicativo circa 0,06%'), T('Quotato in dollari: aggiunge il rischio di cambio euro/dollaro'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'starter' }),
  A({ id: 'VT', ticker: 'VT', name: 'Vanguard Total World Stock ETF', cls: 'etf', sector: 'world', risk: 3, sigma: 0.16, beta: 1.0, dividend: 0.02, ter: 0.0006,
    desc: T('Azioni di tutto il mondo, migliaia di aziende di decine di Paesi, sviluppati ed emergenti.'), facts: [T('TER indicativo circa 0,06%'), T('La diversificazione più ampia in un solo strumento'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'starter' }),
  // --- ETF sbloccati dalle Medaglie ---
  A({ id: 'EEM', ticker: 'EEM', name: 'iShares MSCI Emerging Markets ETF', cls: 'etf', sector: 'world', risk: 4, sigma: 0.22, beta: 1.1, dividend: 0.025, ter: 0.007,
    desc: T('Azioni dei Paesi emergenti: Cina, India, Taiwan, Brasile e altri.'), facts: [T('TER indicativo circa 0,70%: uno dei più cari della vetrina'), T('Rischi politici e valutari più alti'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:1' }),
  A({ id: 'SHY', ticker: 'SHY', name: 'iShares 1-3 Year Treasury Bond ETF', cls: 'etf', sector: 'bond', risk: 1, sigma: 0.02, beta: 0, dividend: 0.035, ter: 0.0015,
    desc: T('Titoli di Stato USA che scadono tra 1 e 3 anni. Duration bassa: poco sensibile ai tassi.'), facts: [T('TER indicativo circa 0,15%'), T('Il più vicino alla liquidità nella vetrina'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:2' }),
  A({ id: 'LQD', ticker: 'LQD', name: 'iShares iBoxx Investment Grade Corporate Bond ETF', cls: 'etf', sector: 'bond', risk: 2, sigma: 0.09, beta: 0.2, dividend: 0.04, ter: 0.0014,
    desc: T('Obbligazioni di grandi aziende con buon rating. Rendono più dei titoli di Stato, con un po\' di rischio di credito.'), facts: [T('TER indicativo circa 0,14%'), T('Duration media-lunga: soffre quando i tassi salgono'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:3' }),
  A({ id: 'GLD', ticker: 'GLD', name: 'SPDR Gold Shares', cls: 'etf', sector: 'gold', risk: 3, sigma: 0.15, beta: 0.1, dividend: 0, ter: 0.004,
    desc: T('Segue il prezzo dell\'oro fisico custodito in caveau.'), facts: [T('TER indicativo circa 0,40%'), T('Nessun dividendo: l\'oro non produce flussi di cassa'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:4' }),
  A({ id: 'QQQ', ticker: 'QQQ', name: 'Invesco QQQ Trust', cls: 'etf', sector: 'tech', risk: 4, sigma: 0.23, beta: 1.2, dividend: 0.006, ter: 0.002,
    desc: T('Le 100 maggiori aziende non finanziarie del Nasdaq: molta tecnologia, poche aziende pesano tanto.'), facts: [T('TER indicativo circa 0,20%'), T('Concentrato: i primi titoli pesano una parte grande'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:5' }),
  A({ id: 'IEF', ticker: 'IEF', name: 'iShares 7-10 Year Treasury Bond ETF', cls: 'etf', sector: 'bond', risk: 2, sigma: 0.07, beta: 0, dividend: 0.035, ter: 0.0015,
    desc: T('Titoli di Stato USA a 7-10 anni. Più sensibili ai tassi di quelli a breve.'), facts: [T('TER indicativo circa 0,15%'), T('Nel 2022 ha perso più del 15%: anche i titoli di Stato possono scendere'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:6' }),
  A({ id: 'AOR', ticker: 'AOR', name: 'iShares Core Growth Allocation ETF', cls: 'etf', sector: 'world', risk: 2, sigma: 0.11, beta: 0.6, dividend: 0.025, ter: 0.0015,
    desc: T('Portafoglio già pronto: circa 60% azioni e 40% obbligazioni, ribilanciato dall\'emittente.'), facts: [T('TER indicativo circa 0,15%'), T('Ribilanciamento incluso'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:7' }),
  A({ id: 'EWI', ticker: 'EWI', name: 'iShares MSCI Italy ETF', cls: 'etf', sector: 'world', risk: 4, sigma: 0.24, beta: 1.1, dividend: 0.035, ter: 0.005,
    desc: T('Le principali aziende italiane: molte banche, energia e utility.'), facts: [T('TER indicativo circa 0,50%'), T('Un solo Paese: diversificazione bassa'), T('Dati aggiornati: prospetto dell\'emittente')], unlock: 'badge:8' }),
  // --- Cripto (scelta iniziale: le due principali) ---
  A({ id: 'BTC/USD', ticker: 'BTC', name: 'Bitcoin', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 0.60, beta: 1.5, dividend: 0,
    desc: T('La prima criptovaluta: offerta massima fissa e rete proof-of-work. Volatilità estrema.'), facts: [T('Nessun flusso di cassa: il prezzo dipende solo da domanda e offerta'), T('Ha perso oltre il 70% più volte dal massimo'), T('Si scambia 24 ore su 24, 7 giorni su 7')], unlock: 'starter' }),
  A({ id: 'ETH/USD', ticker: 'ETH', name: 'Ethereum', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 0.75, beta: 1.7, dividend: 0,
    desc: T('Piattaforma per smart contract e applicazioni decentralizzate, proof-of-stake.'), facts: [T('Molti token e stablecoin sono costruiti sulla sua rete'), T('Più volatile di Bitcoin'), T('Si scambia 24 ore su 24')], unlock: 'starter' }),
  // --- Cripto sbloccate dalle Medaglie ---
  A({ id: 'SOL/USD', ticker: 'SOL', name: 'Solana', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 0.95, beta: 1.9, dividend: 0,
    desc: T('Blockchain veloce e a basso costo. Rete più giovane, con alcuni blocchi del servizio nella sua storia.'), facts: [T('Nel 2022 ha perso oltre il 90% dal massimo'), T('Validatori più concentrati di Bitcoin ed Ethereum'), T('Si scambia 24 ore su 24')], unlock: 'badge:1' }),
  A({ id: 'USDC/USD', ticker: 'USDC', name: 'USD Coin', cls: 'crypto', sector: 'stable', risk: 1, sigma: 0.01, beta: 0, dividend: 0,
    desc: T('Stablecoin agganciata al dollaro, con riserve in liquidità e titoli di Stato a breve e attestazioni periodiche.'), facts: [T('Nel marzo 2023 ha perso brevemente l\'aggancio per una banca in crisi'), T('Non è un deposito bancario: nessuna garanzia pubblica'), T('Rischio dell\'emittente, non del mercato')], unlock: 'badge:2' }),
  A({ id: 'LTC/USD', ticker: 'LTC', name: 'Litecoin', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 0.75, beta: 1.5, dividend: 0,
    desc: T('Una delle cripto più vecchie, nata come variante più veloce di Bitcoin.'), facts: [T('Proof-of-work'), T('Molto meno usata di Bitcoin'), T('Si scambia 24 ore su 24')], unlock: 'badge:4' }),
  A({ id: 'DOGE/USD', ticker: 'DOGE', name: 'Dogecoin', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 1.1, beta: 2.0, dividend: 0,
    desc: T('Meme coin nata per scherzo nel 2013. Il prezzo segue soprattutto mode e messaggi sui social.'), facts: [T('Nessuna offerta massima'), T('Rialzi e crolli estremi legati al passaparola'), T('Si scambia 24 ore su 24')], unlock: 'badge:6' }),
  A({ id: 'LINK/USD', ticker: 'LINK', name: 'Chainlink', cls: 'crypto', sector: 'crypto', risk: 5, sigma: 0.9, beta: 1.8, dividend: 0,
    desc: T('Rete di "oracoli" che porta dati esterni (per esempio i prezzi) dentro gli smart contract.'), facts: [T('Token usato per pagare i servizi della rete'), T('Volatilità molto alta'), T('Si scambia 24 ore su 24')], unlock: 'badge:8' }),
];

export const ASSET_BY_ID: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));

export function classesOf(track: Track, mixed: AssetClass[]): AssetClass[] {
  return track === 'mixed' ? mixed : [track];
}

/** Titoli reali tra cui scegliere nella Valigetta, per classe (in ordine alfabetico). */
export function starterOptions(cls: AssetClass): AssetDef[] {
  return ASSETS.filter((a) => a.cls === cls && a.unlock === 'starter');
}

/** Titolo iniziale predefinito di una classe (il primo della vetrina): usato solo se il giocatore non ha ancora scelto. */
export function starterFor(cls: AssetClass): string {
  return starterOptions(cls)[0].id;
}

/** Asset disponibili nel percorso con il numero di Medaglie dato. */
export function unlockedAssets(track: Track, mixed: AssetClass[], badges: number, extra: string[] = []): AssetDef[] {
  const cls = classesOf(track, mixed);
  return ASSETS.filter((a) => {
    if (!cls.includes(a.cls)) return false;
    if (extra.includes(a.id)) return true;
    if (a.unlock === 'starter') return badges >= 1;
    const m = /^badge:(\d)$/.exec(a.unlock);
    return m ? badges >= Number(m[1]) : false;
  });
}

/** Classifica un asset come rischioso, difensivo per l'allocazione obiettivo. */
export function isDefensive(a: AssetDef | undefined): boolean {
  if (!a) return false;
  return a.sector === 'bond' || a.sector === 'stable' || a.sector === 'gold' || a.risk <= 2;
}

/** Descrizione generica degli ETF e delle cripto particolari, usata nei replay storici dove i nomi sono nascosti. */
const ANON_KIND: Record<string, string> = {
  SPY: T('ETF azioni Stati Uniti'), VGK: T('ETF azioni Europa'), VT: T('ETF azioni mondo'), EEM: T('ETF Paesi emergenti'), SHY: T('ETF titoli di Stato a breve'),
  LQD: T('ETF obbligazioni societarie'), GLD: T('ETF oro'), QQQ: T('ETF tecnologia Stati Uniti'), IEF: T('ETF titoli di Stato a 7-10 anni'), AOR: T('ETF bilanciato 60/40'),
  EWI: T('ETF azioni Italia'), 'USDC/USD': T('Stablecoin con riserve'),
};

/**
 * Versione anonima degli asset per i replay storici: il nome vero e il prezzo rivelerebbero il periodo
 * (e quindi come va a finire). Gli ETF restano riconoscibili per categoria, perché la categoria è la lezione;
 * azioni e cripto diventano "Tecnologia A", "Cripto B". Gli id non cambiano: servono a ritrovare i prezzi.
 */
export function anonymous(assets: AssetDef[]): AssetDef[] {
  const count: Record<string, number> = {};
  return assets.map((a) => {
    const kind = ANON_KIND[a.id];
    if (kind) return { ...a, ticker: kind.replace(/^ETF /, '').slice(0, 14), name: kind, desc: a.cls === 'etf' ? a.desc : T('Stablecoin agganciata al dollaro.'), facts: [] };
    const base = a.cls === 'crypto' ? T('Cripto') : SECTOR_LABEL[a.sector];
    const n = (count[base] = (count[base] ?? 0) + 1);
    const letter = String.fromCharCode(64 + n);
    return { ...a, ticker: `${base.slice(0, 4).toUpperCase()}-${letter}`, name: `${base} ${letter}`, desc: T`${a.cls === 'crypto' ? T('Una cripto-attività') : T('Un\'azienda del settore ') + base.toLowerCase()}: il nome è nascosto fino alla fine del replay.`, facts: [] };
  });
}

/** Simbolo per i dati di Alpaca: le cripto vanno con la classe "crypto". */
export function dataClass(a: AssetDef): 'stocks' | 'crypto' {
  return a.cls === 'crypto' ? 'crypto' : 'stocks';
}
