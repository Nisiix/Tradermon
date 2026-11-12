import { lookPal } from '../art/art';
import { poolFor } from '../art/looks';
// Abitanti delle case: ogni persona insegna un concetto diverso (campo `topic`, unico in tutto il gioco).
// I temi seguono la progressione delle città: basi → ordini → diversificazione → costi → analisi →
// dividendi e obbligazioni → bias → gestione del rischio, con qualche tema di macroeconomia e sicurezza.

export interface Resident {
  id: string;
  name: string;
  role: string;
  pal: number;
  topic: string;
  lines: string[];
  source: string; // chiave in SOURCES
}

export type HouseholdKind = 'single' | 'couple' | 'family';

export interface Household {
  id: string;
  name: string; // nome mostrato all'ingresso
  kind: HouseholdKind;
  people: Resident[];
}

type R = [id: string, name: string, role: string, pal: number, topic: string, source: string, lines: string[]];
// L'aspetto di ogni abitante è generato dal suo id (pelle, capelli, occhi, vestiti: src/art/looks.ts);
// il numero di palette scritto nei dati qui sotto non viene più usato. Nella stessa casa nessuno si somiglia.
function residentPal(pid: string, role: string, taken: Set<number>): number {
  const pool = poolFor(role);
  let pal = lookPal(pid, pool);
  for (let b = 1; taken.has(pal) && b < 16; b++) pal = lookPal(pid, pool, b);
  taken.add(pal);
  return pal;
}
const hh = (id: string, name: string, kind: HouseholdKind, people: R[]): Household => {
  const taken = new Set<number>();
  return { id, name, kind, people: people.map(([pid, n, role, , topic, source, lines]) => ({ id: pid, name: n, role, pal: residentPal(pid, role, taken), topic, source, lines })) };
};

/** Case per città (indice = numero della città). L'ordine segue gli slot degli edifici nella mappa. */
export const HOUSEHOLDS: Household[][] = [
  // 0 · Borgo Semina
  [
    hh('h0_fontana', 'Casa Fontana', 'family', [
      ['eleonora', 'Eleonora Fontana', 'infermiera', 24, 'fondo-emergenza', 'bdi', [
        'Prima di investire ho messo da parte da 3 a 6 mesi di spese su un conto da cui posso prelevare subito.',
        'Così, se arriva un imprevisto, non sono costretta a vendere gli investimenti nel momento peggiore.']],
      ['pasquale', 'Pasquale Fontana', 'idraulico', 25, 'debiti-prima', 'bdi', [
        'Avevo una carta revolving con un tasso sopra il 15%. Nessun investimento prudente rende così tanto in modo sicuro.',
        'Così ho estinto prima i debiti più cari e solo dopo ho cominciato a investire.']],
      ['noemi', 'Noemi Fontana', 'bambina', 21, 'cosa-e-azione', 'ip_stock', [
        'Ho chiesto alla mamma cos\'è un\'azione: è un pezzettino di un\'azienda!',
        'Se l\'azienda guadagna e cresce, anche il pezzettino può valere di più. Se va male, vale di meno.']],
    ]),
  ],
  // 1 · Ponte Cedola
  [
    hh('h1_moretti', 'Casa Moretti', 'family', [
      ['lorenzo', 'Lorenzo Moretti', 'insegnante', 26, 'orizzonte-temporale', 'ig_allocation', [
        'I soldi che mi servono tra un anno non li metto in azioni: in dodici mesi possono perdere anche il 30%.',
        'Per ogni obiettivo scelgo l\'orizzonte: breve termine liquidità, lungo termine anche azioni.']],
      ['sara', 'Sara Moretti', 'farmacista', 27, 'rischio-rendimento', 'consob', [
        'Non esiste un rendimento alto senza un rischio alto.',
        'Quando qualcuno mi propone il contrario, chiedo subito: "Dov\'è il rischio che non mi stai dicendo?"']],
      ['tommaso', 'Tommaso Moretti', 'studente', 22, 'interesse-composto-numeri', 'ig_compound', [
        'A scuola abbiamo calcolato l\'interesse composto: 1.000 euro al 5% l\'anno diventano circa 1.629 in 10 anni.',
        'In 20 anni diventano circa 2.653. Il tempo lavora per chi comincia presto!']],
    ]),
    hh('h1_battista', 'Casa di Battista', 'single', [
      ['battista', 'Battista', 'pensionato', 19, 'rendimento-reale', 'ip_inflation', [
        'Se il conto rende l\'1% e i prezzi salgono del 3%, in realtà perdo il 2% di potere d\'acquisto ogni anno.',
        'Guardo sempre il rendimento reale, cioè al netto dell\'inflazione, non quello scritto sul contratto.']],
    ]),
    hh('h1_galli', 'Casa Galli', 'couple', [
      ['marco', 'Marco Galli', 'ingegnere', 28, 'volatilita-sopportabile', 'ip_volatility', [
        'La volatilità misura quanto oscilla un prezzo.',
        'Scegli investimenti con oscillazioni che riesci a sopportare: altrimenti venderai nel panico proprio sul fondo.']],
      ['giada', 'Giada Galli', 'grafica', 29, 'questionario-adeguatezza', 'ip_mifid', [
        'In banca mi hanno fatto il questionario di adeguatezza previsto dalle regole europee MiFID.',
        'Non è burocrazia: serve a non farti vendere prodotti troppo complessi o rischiosi per te. Rispondi con sincerità.']],
    ]),
    hh('h1_ilaria', 'Casa di Ilaria', 'single', [
      ['ilaria', 'Ilaria', 'commessa', 30, 'garanzia-depositi', 'bdi', [
        'I depositi bancari in Italia sono protetti dal Fondo Interbancario fino a 100.000 euro per depositante e per banca.',
        'Azioni, ETF e obbligazioni invece non sono garantiti: restano tuoi anche se il broker fallisce, ma il loro valore può scendere.']],
    ]),
  ],
  // 2 · Porto Ordini
  [
    hh('h2_ferri', 'Casa Ferri', 'couple', [
      ['fulvio', 'Fulvio Ferri', 'portuale', 16, 'spread-costo-nascosto', 'ip_spread', [
        'Su un titolo poco scambiato la differenza tra prezzo di acquisto e di vendita può essere ampia.',
        'Quello spread è un costo nascosto: lo paghi ogni volta che entri ed esci.']],
      ['lucia', 'Lucia Ferri', 'contabile', 31, 'gap-apertura-stop', 'ig_stop_order', [
        'La Borsa USA apre alle 15:30 italiane. Le notizie della notte arrivano tutte all\'apertura.',
        'Il prezzo può "saltare" oltre il tuo stop: lo stop garantisce l\'invio dell\'ordine, non il prezzo di esecuzione.']],
    ]),
    hh('h2_ettore', 'Casa di Ettore e Wanda', 'couple', [
      ['ettore', 'Ettore', 'trader in pensione', 19, 'limite-vs-mercato', 'ig_order_types', [
        'Con un ordine a mercato compri subito, ma non sai esattamente a che prezzo.',
        'Con un ordine limite fissi il prezzo massimo, ma potresti non comprare affatto. Sui titoli poco liquidi uso sempre il limite.']],
      ['wanda', 'Wanda', 'ex cambiavalute', 24, 'rischio-cambio', 'cfa', [
        'Se compro azioni americane e il dollaro perde il 10% sull\'euro, perdo il 10% anche se l\'azione resta ferma.',
        'Sugli investimenti in valuta estera il rischio di cambio c\'è sempre, nel bene e nel male.']],
    ]),
    hh('h2_esposito', 'Casa Esposito', 'family', [
      ['gennaro', 'Gennaro Esposito', 'pescatore', 17, 'liquidita-vendere', 'ip_liquidity', [
        'Il pesce fresco si vende in un attimo, una barca no.',
        'Anche un investimento poco liquido può richiedere tempo, o uno sconto sul prezzo, per essere venduto.']],
      ['rosa', 'Rosa Esposito', 'impiegata', 25, 'ordini-dimenticati', 'ig_order_types', [
        'Un ordine "valido fino a revoca" può restare aperto per settimane. Io me n\'ero dimenticata e si è eseguito quando non lo volevo più.',
        'Ora controllo gli ordini aperti ogni settimana.']],
      ['salvatore', 'Salvatore Esposito', 'ragazzo', 22, 'frazioni-azioni', 'ip_stock', [
        'Con le frazioni di azione posso comprare un pezzo di un titolo che costa 500 dollari anche con 20 dollari.',
        'Alcuni broker lo permettono, altri no: controlla prima di aprire il conto.']],
    ]),
    hh('h2_vittoria', 'Casa di Vittoria', 'single', [
      ['vittoria', 'Vittoria', 'broker', 27, 'overtrading-costi', 'cfa', [
        'Dieci operazioni al giorno, tra commissioni e spread, fanno centinaia di euro al mese.',
        'Più operi, più il conto deve correre solo per restare fermo.']],
    ]),
  ],
  // 3 · Diversia
  [
    hh('h3_bianchi', 'Casa Bianchi', 'family', [
      ['andrea', 'Andrea Bianchi', 'analista', 28, 'correlazioni-crisi', 'ip_correlation', [
        'In tempi normali molti titoli si muovono in modo diverso. Nelle crisi le correlazioni salgono e scendono quasi tutti insieme.',
        'Per questo diversifico anche tra classi di attivo, come azioni e obbligazioni, non solo tra titoli.']],
      ['chiara', 'Chiara Bianchi', 'architetta', 29, 'home-bias', 'ig_diversify', [
        'Molti investono quasi tutto nel proprio Paese perché lo conoscono meglio.',
        'Ma l\'Italia è una piccola parte dell\'economia mondiale: diversificare per area geografica riduce la dipendenza da un solo Paese.']],
      ['matilde', 'Matilde Bianchi', 'bambina', 21, 'etf-mondiale', 'ip_index_fund', [
        'Il papà dice che un ETF su un indice mondiale contiene migliaia di aziende di tanti Paesi diversi.',
        'Con una sola quota sei già diversificat{o|a}. Che furbata!']],
    ]),
    hh('h3_lombardi', 'Casa Lombardi', 'couple', [
      ['filippo', 'Filippo Lombardi', 'cuoco', 26, 'azioni-datore-lavoro', 'ig_diversify', [
        'Avevo investito tutto nelle azioni dell\'azienda dove lavoravo. Quando è andata in crisi ho perso lavoro e risparmi insieme.',
        'Mai legare stipendio e investimenti alla stessa azienda.']],
      ['mirella', 'Mirella Lombardi', 'pediatra', 30, 'ribilanciamento-bande', 'ip_rebalancing', [
        'Ribilancio solo quando una classe di attivo si allontana di più di 5 punti dal mio obiettivo.',
        'Così non opero troppo spesso e, senza pensarci, vendo un po\' di ciò che è salito e compro ciò che è sceso.']],
    ]),
    hh('h3_umberto', 'Casa di Umberto', 'single', [
      ['umberto', 'Umberto', 'statistico', 18, 'rischio-specifico-sistematico', 'cfa', [
        'Con 20-30 titoli di settori diversi si elimina buona parte del rischio legato alle singole aziende.',
        'Il rischio del mercato nel suo insieme però resta: quello non si diversifica, si gestisce con l\'allocazione.']],
    ]),
  ],
  // 4 · Interessa
  [
    hh('h4_conti', 'Casa Conti', 'couple', [
      ['roberto', 'Roberto Conti', 'bancario', 16, 'costi-lungo-periodo', 'ip_ter', [
        'Un costo annuo dell\'1,5% invece dello 0,2% sembra poca cosa.',
        'Su 30 anni, con un rendimento lordo del 6%, può portarsi via circa un terzo del capitale finale.']],
      ['annalisa', 'Annalisa Conti', 'maestra', 31, 'regola-72', 'ip_compound', [
        'Per sapere in quanti anni raddoppia un capitale divido 72 per il rendimento annuo: al 6% servono circa 12 anni.',
        'Vale anche per l\'inflazione: al 3% i prezzi raddoppiano in circa 24 anni.']],
    ]),
    hh('h4_marino', 'Casa Marino', 'family', [
      ['giorgio', 'Giorgio Marino', 'operaio', 17, 'pac-quote', 'ip_dca', [
        'Investo la stessa cifra ogni mese, che il mercato salga o scenda.',
        'Quando i prezzi sono bassi la stessa cifra compra più quote: non devo indovinare il momento giusto.']],
      ['laura', 'Laura Marino', 'avvocata', 24, 'tasse-italia', 'bdi', [
        'In Italia le plusvalenze finanziarie sono tassate di norma al 26%, i titoli di Stato al 12,5%.',
        'Con il regime amministrato ci pensa l\'intermediario; con il dichiarativo devi indicarle tu nella dichiarazione dei redditi.']],
      ['leo', 'Leo Marino', 'bambino', 22, 'cominciare-presto', 'bdi', [
        'Ho messo da parte 1 euro al giorno per un anno: 365 euro!',
        'Il papà dice che il segreto non è la cifra, ma cominciare presto e non smettere.']],
    ]),
    hh('h4_ornella', 'Casa di Ornella', 'single', [
      ['ornella', 'Ornella', 'ex croupier', 15, 'market-timing', 'cfa', [
        'Tenevo tutto in liquidità "aspettando il momento giusto". Intanto il mercato saliva senza di me.',
        'I giorni di rialzo più forti arrivano spesso vicino a quelli peggiori: chi esce e rientra rischia di perderli.']],
    ]),
  ],
  // 5 · Bilancia
  [
    hh('h5_ada', 'Casa di Ada e Kevin', 'couple', [
      ['ada', 'Ada', 'revisora dei conti', 30, 'flusso-di-cassa', 'ip_fundamental', [
        'Gli utili si possono "abbellire" con la contabilità, la cassa molto meno.',
        'Guardo sempre il flusso di cassa operativo: se gli utili crescono e la cassa no, faccio domande.']],
      ['kevin', 'Kevin', 'tecnico informatico', 28, 'phishing-chiavi', 'ip_phishing', [
        'Nessuna banca, broker o exchange serio ti chiederà mai password, codici o le parole di recupero del tuo portafoglio.',
        'Chi te le chiede, anche con un messaggio che sembra ufficiale, sta cercando di rubarti i fondi.']],
    ]),
    hh('h5_rinaldi', 'Casa Rinaldi', 'couple', [
      ['piero', 'Piero Rinaldi', 'imprenditore', 19, 'pe-contesto', 'ip_pe', [
        'Un rapporto prezzo/utili di 40 non è "caro" di per sé, e uno di 8 non è per forza "economico".',
        'Va confrontato con la crescita attesa e con le aziende dello stesso settore.']],
      ['silvia', 'Silvia Rinaldi', 'notaia', 27, 'kid-documento', 'consob', [
        'Prima di comprare un fondo o un ETF leggo il KID: poche pagine con l\'indicatore di rischio da 1 a 7, i costi e gli scenari.',
        'Se non capisco un prodotto, non lo compro.']],
    ]),
    hh('h5_greco', 'Casa Greco', 'family', [
      ['nicola', 'Nicola Greco', 'ingegnere', 26, 'debito-aziende', 'ip_de', [
        'Un\'azienda molto indebitata soffre quando i tassi salgono: gli interessi si mangiano gli utili.',
        'Guardo il rapporto tra debiti e patrimonio e quanto l\'azienda spende ogni anno in interessi.']],
      ['teresa', 'Teresa Greco', 'giornalista', 31, 'trimestrali-attese', 'ip_eps', [
        'Ogni trimestre le aziende quotate pubblicano i conti.',
        'Il prezzo spesso non si muove sui numeri in sé, ma su quanto si discostano dalle attese degli analisti.']],
      ['bice', 'Bice Greco', 'ragazza', 21, 'whitepaper-cripto', 'ip_rugpull', [
        'Mio fratello dice che di una cripto bisogna leggere il whitepaper: chi l\'ha creata, a cosa serve, quanti token esistono e chi li possiede.',
        'Se il documento non c\'è, o se i creatori sono anonimi e tengono quasi tutti i token, è un brutto segno.']],
    ]),
  ],
  // 6 · Valdividendo
  [
    hh('h6_ricci', 'Casa Ricci', 'family', [
      ['fernando', 'Fernando Ricci', 'agricoltore', 17, 'trappola-dividendo', 'ip_payout', [
        'Un rendimento da dividendo altissimo a volte è una trappola: il prezzo è crollato perché il mercato si aspetta un taglio.',
        'Controllo se gli utili coprono davvero il dividendo, cioè il payout ratio.']],
      ['paola', 'Paola Ricci', 'cassiera', 25, 'stacco-dividendo', 'ig_dividend', [
        'Il giorno dello stacco il prezzo del titolo scende più o meno dell\'importo del dividendo.',
        'Comprare il giorno prima solo per incassarlo non è un guadagno gratis, e in più sul dividendo paghi le tasse.']],
      ['pietro', 'Pietro Ricci', 'ragazzo', 22, 'etf-accumulo-distribuzione', 'ip_etf', [
        'Gli ETF ad accumulazione reinvestono da soli i dividendi; quelli a distribuzione te li pagano.',
        'Se non ti servono entrate periodiche, l\'accumulo rimanda le tasse alla vendita.']],
    ]),
    hh('h6_villa', 'Casa Villa', 'couple', [
      ['alberto', 'Alberto Villa', 'ex bancario', 19, 'duration-tassi', 'ip_duration', [
        'La duration dice quanto soffre un\'obbligazione se i tassi salgono: con duration 7, un rialzo dell\'1% fa perdere circa il 7%.',
        'Nel 2022 molti l\'hanno scoperto a caro prezzo.']],
      ['caterina', 'Caterina Villa', 'sarta', 24, 'curva-invertita', 'ip_yield_curve', [
        'Quando i tassi a breve superano quelli a lungo termine, la curva dei rendimenti si "inverte".',
        'In passato è spesso arrivata prima di una recessione, ma non dice quando, e a volte si è sbagliata.']],
    ]),
    hh('h6_gino', 'Casa di Gino e Gina', 'couple', [
      ['gino', 'Gino', 'pescatore', 16, 'titoli-indicizzati', 'ip_bond', [
        'I titoli indicizzati all\'inflazione, come i BTP Italia, adeguano capitale o cedole all\'aumento dei prezzi.',
        'Proteggono dall\'inflazione, ma il loro prezzo si muove comunque con i tassi d\'interesse.']],
      ['gina', 'Gina', 'economista', 30, 'banca-centrale-tassi', 'ip_central_bank', [
        'Quando la banca centrale alza i tassi per frenare l\'inflazione, mutui e prestiti costano di più.',
        'Famiglie e aziende spendono e investono meno, e spesso le borse ne risentono.']],
    ]),
    hh('h6_neri', 'Casa Neri', 'couple', [
      ['davide', 'Davide Neri', 'informatico', 28, 'riserve-stablecoin', 'ip_stablecoin', [
        'Una stablecoin è stabile solo quanto le sue riserve.',
        'Chiedo sempre: cosa c\'è dietro, chi lo certifica e cosa succede se tutti chiedono il rimborso nello stesso momento.']],
      ['elisa', 'Elisa Neri', 'insegnante', 29, 'rating-credito', 'ip_bond', [
        'Più è basso il rating di chi emette un\'obbligazione, più è alto il rendimento promesso.',
        'Quel rendimento in più è il compenso per il rischio di non essere rimborsati.']],
    ]),
  ],
  // 7 · Mentelucida
  [
    hh('h7_raffaele', 'Casa di Raffaele', 'single', [
      ['raffaele', 'Raffaele', 'psicologo', 18, 'bias-conferma', 'cfa', [
        'Quando possiedo un titolo tendo a leggere solo le notizie che mi danno ragione: è il bias di conferma.',
        'Ora, prima di comprare, scrivo tre motivi per cui potrei sbagliarmi.']],
    ]),
    hh('h7_costa', 'Casa Costa', 'couple', [
      ['simone', 'Simone Costa', 'musicista', 26, 'effetto-disposizione', 'ip_loss_aversion', [
        'Vendevo subito i titoli in guadagno e tenevo quelli in perdita "finché non tornano su".',
        'Così tagliavo i fiori e annaffiavo le erbacce. Ora decido guardando al futuro, non al prezzo a cui ho comprato.']],
      ['alice', 'Alice Costa', 'medico', 31, 'costi-affondati', 'ip_anchoring', [
        'I soldi già persi non tornano cercando di "rifarsi" sullo stesso titolo.',
        'La domanda giusta è: lo comprerei oggi, a questo prezzo? Se la risposta è no, perché lo tengo?']],
    ]),
    hh('h7_gallo', 'Casa Gallo', 'family', [
      ['stefano', 'Stefano Gallo', 'autista', 17, 'bias-recenza', 'cfa', [
        'Dopo tre anni di rialzi mi sembrava che la borsa salisse sempre. Dopo un crollo mi sembrava che scendesse sempre.',
        'Il passato recente pesa troppo nella nostra testa: guardo periodi lunghi prima di decidere.']],
      ['gloria', 'Gloria Gallo', 'impiegata', 25, 'diario-trading', 'cfa', [
        'Tengo un diario di ogni operazione: perché entro, dove esco e cosa provavo in quel momento.',
        'Rileggerlo ogni mese mi mostra gli errori che continuo a ripetere.']],
      ['enea', 'Enea Gallo', 'ragazzo', 22, 'hype-social', 'ig_pump', [
        'Su internet uno diceva che una moneta sarebbe salita del 1000%.',
        'Il papà mi ha spiegato che spesso chi lo dice l\'ha già comprata e vuole rivenderla a te a un prezzo più alto.']],
    ]),
    hh('h7_marisa', 'Casa di Marisa', 'single', [
      ['marisa', 'Marisa', 'pensionata', 19, 'contabilita-mentale', 'cfa', [
        'Trattavo i soldi di una vincita come "soldi del gioco" e li rischiavo molto di più.',
        'Ma un euro è un euro, da qualunque parte arrivi: va trattato con le stesse regole.']],
    ]),
  ],
  // 8 · Rocca Rischio
  [
    hh('h8_serra', 'Casa Serra', 'couple', [
      ['claudio', 'Claudio Serra', 'alpinista', 26, 'dimensione-posizione', 'ip_position_sizing', [
        'Su ogni operazione rischio al massimo l\'1-2% del capitale: dalla distanza tra prezzo di entrata e stop calcolo quante quote comprare.',
        'Così anche dieci errori di fila non mi fanno cadere dalla montagna.']],
      ['monica', 'Monica Serra', 'ingegnera', 30, 'rapporto-rischio-rendimento', 'cfa', [
        'Prima di entrare guardo il rapporto rischio/rendimento. Se rischio 1 per guadagnare 2, mi basta avere ragione 4 volte su 10 per restare in attivo, al netto dei costi.',
        'Senza questo conto, anche molte operazioni giuste possono lasciarti in perdita.']],
    ]),
    hh('h8_rota', 'Casa Rota', 'family', [
      ['massimo', 'Massimo Rota', 'vigile del fuoco', 17, 'leva-azzeramento', 'ip_leverage', [
        'Con una leva di 10 volte, un calo del 10% azzera il capitale.',
        'La leva amplifica gli errori quanto i successi, e il mercato non aspetta che tu abbia ragione.']],
      ['federica', 'Federica Rota', 'commercialista', 24, 'sequenza-rendimenti', 'ip_asset_alloc', [
        'Per chi preleva dal portafoglio, come un pensionato, un crollo nei primi anni fa molto più danno dello stesso crollo più avanti.',
        'Per questo, avvicinandosi all\'obiettivo, si riduce gradualmente il rischio.']],
      ['gemma', 'Gemma Rota', 'bambina', 21, 'stop-deciso-prima', 'ip_stoploss', [
        'Ho imparato che lo stop loss si decide prima di comprare, quando sei calm{o|a}.',
        'Non quando il prezzo sta già crollando e hai il cuore che batte forte!']],
    ]),
    hh('h8_livio', 'Casa di Livio', 'single', [
      ['livio', 'Livio', 'ex trader giornaliero', 15, 'cfd-perdite', 'esma', [
        'Gli avvisi obbligatori dei broker europei sui CFD dicono che la maggior parte dei conti dei piccoli investitori perde denaro.',
        'Ci ho provato per due anni. Oggi investo a lungo termine e dormo molto meglio.']],
    ]),
    hh('h8_leone', 'Casa Leone', 'family', [
      ['ivan', 'Ivan Leone', 'pilota', 28, 'backtest-overfitting', 'ip_paper', [
        'Una strategia che sui dati passati sembra perfetta spesso è solo cucita addosso al caso.',
        'La provo su periodi che non ho usato per costruirla e poi in simulazione, prima di metterci soldi veri.']],
      ['nadia', 'Nadia Leone', 'ricercatrice', 31, 'piano-scritto', 'cfa', [
        'Il mio piano ha regole scritte: cosa compro, quando entro, dove esco e quanto rischio.',
        'Una regola che non è scritta, nel panico, la cambierò.']],
      ['ottavio', 'Ottavio Leone', 'nonno', 19, 'bolle-storia', 'ip_bear', [
        'Ho visto la bolla delle dot-com nel 2000: aziende senza utili valevano miliardi, poi molte sono sparite.',
        'Quando senti dire "stavolta è diverso", tieni stretto il portafoglio.']],
    ]),
  ],
];

export const ALL_RESIDENTS: Resident[] = HOUSEHOLDS.flat().flatMap((h) => h.people);
export const RESIDENT_BY_ID: Record<string, Resident> = Object.fromEntries(ALL_RESIDENTS.map((r) => [r.id, r]));
