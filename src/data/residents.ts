import { lookPal } from '../art/art';
import { poolFor } from '../art/looks';
import { T } from '../i18n';
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
    hh('h0_fontana', T('Casa Fontana'), 'family', [
      ['eleonora', 'Eleonora Fontana', 'infermiera', 24, 'fondo-emergenza', 'bdi', [
        T('Prima di investire ho messo da parte da 3 a 6 mesi di spese su un conto da cui posso prelevare subito.'),
        T('Così, se arriva un imprevisto, non sono costretta a vendere gli investimenti nel momento peggiore.')]],
      ['pasquale', 'Pasquale Fontana', 'idraulico', 25, 'debiti-prima', 'bdi', [
        T('Avevo una carta revolving con un tasso sopra il 15%. Nessun investimento prudente rende così tanto in modo sicuro.'),
        T('Così ho estinto prima i debiti più cari e solo dopo ho cominciato a investire.')]],
      ['noemi', 'Noemi Fontana', 'bambina', 21, 'cosa-e-azione', 'ip_stock', [
        T('Ho chiesto alla mamma cos\'è un\'azione: è un pezzettino di un\'azienda!'),
        T('Se l\'azienda guadagna e cresce, anche il pezzettino può valere di più. Se va male, vale di meno.')]],
    ]),
  ],
  // 1 · Ponte Cedola
  [
    hh('h1_moretti', T('Casa Moretti'), 'family', [
      ['lorenzo', 'Lorenzo Moretti', 'insegnante', 26, 'orizzonte-temporale', 'ig_allocation', [
        T('I soldi che mi servono tra un anno non li metto in azioni: in dodici mesi possono perdere anche il 30%.'),
        T('Per ogni obiettivo scelgo l\'orizzonte: breve termine liquidità, lungo termine anche azioni.')]],
      ['sara', 'Sara Moretti', 'farmacista', 27, 'rischio-rendimento', 'consob', [
        T('Non esiste un rendimento alto senza un rischio alto.'),
        T('Quando qualcuno mi propone il contrario, chiedo subito: "Dov\'è il rischio che non mi stai dicendo?"')]],
      ['tommaso', 'Tommaso Moretti', 'studente', 22, 'interesse-composto-numeri', 'ig_compound', [
        T('A scuola abbiamo calcolato l\'interesse composto: 1.000 euro al 5% l\'anno diventano circa 1.629 in 10 anni.'),
        T('In 20 anni diventano circa 2.653. Il tempo lavora per chi comincia presto!')]],
    ]),
    hh('h1_battista', T('Casa di Battista'), 'single', [
      ['battista', 'Battista', 'pensionato', 19, 'rendimento-reale', 'ip_inflation', [
        T('Se il conto rende l\'1% e i prezzi salgono del 3%, in realtà perdo il 2% di potere d\'acquisto ogni anno.'),
        T('Guardo sempre il rendimento reale, cioè al netto dell\'inflazione, non quello scritto sul contratto.')]],
    ]),
    hh('h1_galli', T('Casa Galli'), 'couple', [
      ['marco', 'Marco Galli', 'ingegnere', 28, 'volatilita-sopportabile', 'ip_volatility', [
        T('La volatilità misura quanto oscilla un prezzo.'),
        T('Scegli investimenti con oscillazioni che riesci a sopportare: altrimenti venderai nel panico proprio sul fondo.')]],
      ['giada', 'Giada Galli', 'grafica', 29, 'questionario-adeguatezza', 'ip_mifid', [
        T('In banca mi hanno fatto il questionario di adeguatezza previsto dalle regole europee MiFID.'),
        T('Non è burocrazia: serve a non farti vendere prodotti troppo complessi o rischiosi per te. Rispondi con sincerità.')]],
    ]),
    hh('h1_ilaria', T('Casa di Ilaria'), 'single', [
      ['ilaria', 'Ilaria', 'commessa', 30, 'garanzia-depositi', 'bdi', [
        T('I depositi bancari in Italia sono protetti dal Fondo Interbancario fino a 100.000 euro per depositante e per banca.'),
        T('Azioni, ETF e obbligazioni invece non sono garantiti: restano tuoi anche se il broker fallisce, ma il loro valore può scendere.')]],
    ]),
  ],
  // 2 · Porto Ordini
  [
    hh('h2_ferri', T('Casa Ferri'), 'couple', [
      ['fulvio', 'Fulvio Ferri', 'portuale', 16, 'spread-costo-nascosto', 'ip_spread', [
        T('Su un titolo poco scambiato la differenza tra prezzo di acquisto e di vendita può essere ampia.'),
        T('Quello spread è un costo nascosto: lo paghi ogni volta che entri ed esci.')]],
      ['lucia', 'Lucia Ferri', 'contabile', 31, 'gap-apertura-stop', 'ig_stop_order', [
        T('La Borsa USA apre alle 15:30 italiane. Le notizie della notte arrivano tutte all\'apertura.'),
        T('Il prezzo può "saltare" oltre il tuo stop: lo stop garantisce l\'invio dell\'ordine, non il prezzo di esecuzione.')]],
    ]),
    hh('h2_ettore', T('Casa di Ettore e Wanda'), 'couple', [
      ['ettore', 'Ettore', T('trader in pensione'), 19, 'limite-vs-mercato', 'ig_order_types', [
        T('Con un ordine a mercato compri subito, ma non sai esattamente a che prezzo.'),
        T('Con un ordine limite fissi il prezzo massimo, ma potresti non comprare affatto. Sui titoli poco liquidi uso sempre il limite.')]],
      ['wanda', 'Wanda', T('ex cambiavalute'), 24, 'rischio-cambio', 'cfa', [
        T('Se compro azioni americane e il dollaro perde il 10% sull\'euro, perdo il 10% anche se l\'azione resta ferma.'),
        T('Sugli investimenti in valuta estera il rischio di cambio c\'è sempre, nel bene e nel male.')]],
    ]),
    hh('h2_esposito', T('Casa Esposito'), 'family', [
      ['gennaro', 'Gennaro Esposito', 'pescatore', 17, 'liquidita-vendere', 'ip_liquidity', [
        T('Il pesce fresco si vende in un attimo, una barca no.'),
        T('Anche un investimento poco liquido può richiedere tempo, o uno sconto sul prezzo, per essere venduto.')]],
      ['rosa', 'Rosa Esposito', 'impiegata', 25, 'ordini-dimenticati', 'ig_order_types', [
        T('Un ordine "valido fino a revoca" può restare aperto per settimane. Io me n\'ero dimenticata e si è eseguito quando non lo volevo più.'),
        T('Ora controllo gli ordini aperti ogni settimana.')]],
      ['salvatore', 'Salvatore Esposito', 'ragazzo', 22, 'frazioni-azioni', 'ip_stock', [
        T('Con le frazioni di azione posso comprare un pezzo di un titolo che costa 500 dollari anche con 20 dollari.'),
        T('Alcuni broker lo permettono, altri no: controlla prima di aprire il conto.')]],
    ]),
    hh('h2_vittoria', T('Casa di Vittoria'), 'single', [
      ['vittoria', 'Vittoria', 'broker', 27, 'overtrading-costi', 'cfa', [
        T('Dieci operazioni al giorno, tra commissioni e spread, fanno centinaia di euro al mese.'),
        T('Più operi, più il conto deve correre solo per restare fermo.')]],
    ]),
  ],
  // 3 · Diversia
  [
    hh('h3_bianchi', T('Casa Bianchi'), 'family', [
      ['andrea', 'Andrea Bianchi', 'analista', 28, 'correlazioni-crisi', 'ip_correlation', [
        T('In tempi normali molti titoli si muovono in modo diverso. Nelle crisi le correlazioni salgono e scendono quasi tutti insieme.'),
        T('Per questo diversifico anche tra classi di attivo, come azioni e obbligazioni, non solo tra titoli.')]],
      ['chiara', 'Chiara Bianchi', 'architetta', 29, 'home-bias', 'ig_diversify', [
        T('Molti investono quasi tutto nel proprio Paese perché lo conoscono meglio.'),
        T('Ma l\'Italia è una piccola parte dell\'economia mondiale: diversificare per area geografica riduce la dipendenza da un solo Paese.')]],
      ['matilde', 'Matilde Bianchi', 'bambina', 21, 'etf-mondiale', 'ip_index_fund', [
        T('Il papà dice che un ETF su un indice mondiale contiene migliaia di aziende di tanti Paesi diversi.'),
        T('Con una sola quota sei già diversificat{o|a}. Che furbata!')]],
    ]),
    hh('h3_lombardi', T('Casa Lombardi'), 'couple', [
      ['filippo', 'Filippo Lombardi', 'cuoco', 26, 'azioni-datore-lavoro', 'ig_diversify', [
        T('Avevo investito tutto nelle azioni dell\'azienda dove lavoravo. Quando è andata in crisi ho perso lavoro e risparmi insieme.'),
        T('Mai legare stipendio e investimenti alla stessa azienda.')]],
      ['mirella', 'Mirella Lombardi', 'pediatra', 30, 'ribilanciamento-bande', 'ip_rebalancing', [
        T('Ribilancio solo quando una classe di attivo si allontana di più di 5 punti dal mio obiettivo.'),
        T('Così non opero troppo spesso e, senza pensarci, vendo un po\' di ciò che è salito e compro ciò che è sceso.')]],
    ]),
    hh('h3_umberto', T('Casa di Umberto'), 'single', [
      ['umberto', 'Umberto', 'statistico', 18, 'rischio-specifico-sistematico', 'cfa', [
        T('Con 20-30 titoli di settori diversi si elimina buona parte del rischio legato alle singole aziende.'),
        T('Il rischio del mercato nel suo insieme però resta: quello non si diversifica, si gestisce con l\'allocazione.')]],
    ]),
  ],
  // 4 · Interessa
  [
    hh('h4_conti', T('Casa Conti'), 'couple', [
      ['roberto', 'Roberto Conti', 'bancario', 16, 'costi-lungo-periodo', 'ip_ter', [
        T('Un costo annuo dell\'1,5% invece dello 0,2% sembra poca cosa.'),
        T('Su 30 anni, con un rendimento lordo del 6%, può portarsi via circa un terzo del capitale finale.')]],
      ['annalisa', 'Annalisa Conti', 'maestra', 31, 'regola-72', 'ip_compound', [
        T('Per sapere in quanti anni raddoppia un capitale divido 72 per il rendimento annuo: al 6% servono circa 12 anni.'),
        T('Vale anche per l\'inflazione: al 3% i prezzi raddoppiano in circa 24 anni.')]],
    ]),
    hh('h4_marino', T('Casa Marino'), 'family', [
      ['giorgio', 'Giorgio Marino', 'operaio', 17, 'pac-quote', 'ip_dca', [
        T('Investo la stessa cifra ogni mese, che il mercato salga o scenda.'),
        T('Quando i prezzi sono bassi la stessa cifra compra più quote: non devo indovinare il momento giusto.')]],
      ['laura', 'Laura Marino', 'avvocata', 24, 'tasse-italia', 'bdi', [
        T('In Italia le plusvalenze finanziarie sono tassate di norma al 26%, i titoli di Stato al 12,5%.'),
        T('Con il regime amministrato ci pensa l\'intermediario; con il dichiarativo devi indicarle tu nella dichiarazione dei redditi.')]],
      ['leo', T('Tobia Marino'), 'bambino', 22, 'cominciare-presto', 'bdi', [
        T('Ho messo da parte 1 euro al giorno per un anno: 365 euro!'),
        T('Il papà dice che il segreto non è la cifra, ma cominciare presto e non smettere.')]],
    ]),
    hh('h4_ornella', T('Casa di Ornella'), 'single', [
      ['ornella', 'Ornella', T('ex croupier'), 15, 'market-timing', 'cfa', [
        T('Tenevo tutto in liquidità "aspettando il momento giusto". Intanto il mercato saliva senza di me.'),
        T('I giorni di rialzo più forti arrivano spesso vicino a quelli peggiori: chi esce e rientra rischia di perderli.')]],
    ]),
  ],
  // 5 · Bilancia
  [
    hh('h5_ada', T('Casa di Ada e Kevin'), 'couple', [
      ['ada', 'Ada', T('revisora dei conti'), 30, 'flusso-di-cassa', 'ip_fundamental', [
        T('Gli utili si possono "abbellire" con la contabilità, la cassa molto meno.'),
        T('Guardo sempre il flusso di cassa operativo: se gli utili crescono e la cassa no, faccio domande.')]],
      ['kevin', 'Kevin', T('tecnico informatico'), 28, 'phishing-chiavi', 'ip_phishing', [
        T('Nessuna banca, broker o exchange serio ti chiederà mai password, codici o le parole di recupero del tuo portafoglio.'),
        T('Chi te le chiede, anche con un messaggio che sembra ufficiale, sta cercando di rubarti i fondi.')]],
    ]),
    hh('h5_rinaldi', T('Casa Rinaldi'), 'couple', [
      ['piero', 'Piero Rinaldi', 'imprenditore', 19, 'pe-contesto', 'ip_pe', [
        T('Un rapporto prezzo/utili di 40 non è "caro" di per sé, e uno di 8 non è per forza "economico".'),
        T('Va confrontato con la crescita attesa e con le aziende dello stesso settore.')]],
      ['silvia', 'Silvia Rinaldi', 'notaia', 27, 'kid-documento', 'consob', [
        T('Prima di comprare un fondo o un ETF leggo il KID: poche pagine con l\'indicatore di rischio da 1 a 7, i costi e gli scenari.'),
        T('Se non capisco un prodotto, non lo compro.')]],
    ]),
    hh('h5_greco', T('Casa Greco'), 'family', [
      ['nicola', 'Nicola Greco', 'ingegnere', 26, 'debito-aziende', 'ip_de', [
        T('Un\'azienda molto indebitata soffre quando i tassi salgono: gli interessi si mangiano gli utili.'),
        T('Guardo il rapporto tra debiti e patrimonio e quanto l\'azienda spende ogni anno in interessi.')]],
      ['teresa', 'Teresa Greco', 'giornalista', 31, 'trimestrali-attese', 'ip_eps', [
        T('Ogni trimestre le aziende quotate pubblicano i conti.'),
        T('Il prezzo spesso non si muove sui numeri in sé, ma su quanto si discostano dalle attese degli analisti.')]],
      ['bice', 'Bice Greco', 'ragazza', 21, 'whitepaper-cripto', 'ip_rugpull', [
        T('Mio fratello dice che di una cripto bisogna leggere il whitepaper: chi l\'ha creata, a cosa serve, quanti token esistono e chi li possiede.'),
        T('Se il documento non c\'è, o se i creatori sono anonimi e tengono quasi tutti i token, è un brutto segno.')]],
    ]),
  ],
  // 6 · Valdividendo
  [
    hh('h6_ricci', T('Casa Ricci'), 'family', [
      ['fernando', 'Fernando Ricci', 'agricoltore', 17, 'trappola-dividendo', 'ip_payout', [
        T('Un rendimento da dividendo altissimo a volte è una trappola: il prezzo è crollato perché il mercato si aspetta un taglio.'),
        T('Controllo se gli utili coprono davvero il dividendo, cioè il payout ratio.')]],
      ['paola', 'Paola Ricci', 'cassiera', 25, 'stacco-dividendo', 'ig_dividend', [
        T('Il giorno dello stacco il prezzo del titolo scende più o meno dell\'importo del dividendo.'),
        T('Comprare il giorno prima solo per incassarlo non è un guadagno gratis, e in più sul dividendo paghi le tasse.')]],
      ['pietro', 'Pietro Ricci', 'ragazzo', 22, 'etf-accumulo-distribuzione', 'ip_etf', [
        T('Gli ETF ad accumulazione reinvestono da soli i dividendi; quelli a distribuzione te li pagano.'),
        T('Se non ti servono entrate periodiche, l\'accumulo rimanda le tasse alla vendita.')]],
    ]),
    hh('h6_villa', T('Casa Villa'), 'couple', [
      ['alberto', 'Alberto Villa', T('ex bancario'), 19, 'duration-tassi', 'ip_duration', [
        T('La duration dice quanto soffre un\'obbligazione se i tassi salgono: con duration 7, un rialzo dell\'1% fa perdere circa il 7%.'),
        T('Nel 2022 molti l\'hanno scoperto a caro prezzo.')]],
      ['caterina', 'Caterina Villa', 'sarta', 24, 'curva-invertita', 'ip_yield_curve', [
        T('Quando i tassi a breve superano quelli a lungo termine, la curva dei rendimenti si "inverte".'),
        T('In passato è spesso arrivata prima di una recessione, ma non dice quando, e a volte si è sbagliata.')]],
    ]),
    hh('h6_gino', T('Casa di Gino e Gina'), 'couple', [
      ['gino', 'Gino', 'pescatore', 16, 'titoli-indicizzati', 'ip_bond', [
        T('I titoli indicizzati all\'inflazione, come i BTP Italia, adeguano capitale o cedole all\'aumento dei prezzi.'),
        T('Proteggono dall\'inflazione, ma il loro prezzo si muove comunque con i tassi d\'interesse.')]],
      ['gina', 'Gina', 'economista', 30, 'banca-centrale-tassi', 'ip_central_bank', [
        T('Quando la banca centrale alza i tassi per frenare l\'inflazione, mutui e prestiti costano di più.'),
        T('Famiglie e aziende spendono e investono meno, e spesso le borse ne risentono.')]],
    ]),
    hh('h6_neri', T('Casa Neri'), 'couple', [
      ['davide', 'Davide Neri', 'informatico', 28, 'riserve-stablecoin', 'ip_stablecoin', [
        T('Una stablecoin è stabile solo quanto le sue riserve.'),
        T('Chiedo sempre: cosa c\'è dietro, chi lo certifica e cosa succede se tutti chiedono il rimborso nello stesso momento.')]],
      ['elisa', 'Elisa Neri', 'insegnante', 29, 'rating-credito', 'ip_bond', [
        T('Più è basso il rating di chi emette un\'obbligazione, più è alto il rendimento promesso.'),
        T('Quel rendimento in più è il compenso per il rischio di non essere rimborsati.')]],
    ]),
  ],
  // 7 · Mentelucida
  [
    hh('h7_raffaele', T('Casa di Raffaele'), 'single', [
      ['raffaele', 'Raffaele', 'psicologo', 18, 'bias-conferma', 'cfa', [
        T('Quando possiedo un titolo tendo a leggere solo le notizie che mi danno ragione: è il bias di conferma.'),
        T('Ora, prima di comprare, scrivo tre motivi per cui potrei sbagliarmi.')]],
    ]),
    hh('h7_costa', T('Casa Costa'), 'couple', [
      ['simone', 'Simone Costa', 'musicista', 26, 'effetto-disposizione', 'ip_loss_aversion', [
        T('Vendevo subito i titoli in guadagno e tenevo quelli in perdita "finché non tornano su".'),
        T('Così tagliavo i fiori e annaffiavo le erbacce. Ora decido guardando al futuro, non al prezzo a cui ho comprato.')]],
      ['alice', 'Alice Costa', 'medico', 31, 'costi-affondati', 'ip_anchoring', [
        T('I soldi già persi non tornano cercando di "rifarsi" sullo stesso titolo.'),
        T('La domanda giusta è: lo comprerei oggi, a questo prezzo? Se la risposta è no, perché lo tengo?')]],
    ]),
    hh('h7_gallo', T('Casa Gallo'), 'family', [
      ['stefano', 'Stefano Gallo', 'autista', 17, 'bias-recenza', 'cfa', [
        T('Dopo tre anni di rialzi mi sembrava che la borsa salisse sempre. Dopo un crollo mi sembrava che scendesse sempre.'),
        T('Il passato recente pesa troppo nella nostra testa: guardo periodi lunghi prima di decidere.')]],
      ['gloria', 'Gloria Gallo', 'impiegata', 25, 'diario-trading', 'cfa', [
        T('Tengo un diario di ogni operazione: perché entro, dove esco e cosa provavo in quel momento.'),
        T('Rileggerlo ogni mese mi mostra gli errori che continuo a ripetere.')]],
      ['enea', 'Enea Gallo', 'ragazzo', 22, 'hype-social', 'ig_pump', [
        T('Su internet uno diceva che una moneta sarebbe salita del 1000%.'),
        T('Il papà mi ha spiegato che spesso chi lo dice l\'ha già comprata e vuole rivenderla a te a un prezzo più alto.')]],
    ]),
    hh('h7_marisa', T('Casa di Marisa'), 'single', [
      ['marisa', 'Marisa', 'pensionata', 19, 'contabilita-mentale', 'cfa', [
        T('Trattavo i soldi di una vincita come "soldi del gioco" e li rischiavo molto di più.'),
        T('Ma un euro è un euro, da qualunque parte arrivi: va trattato con le stesse regole.')]],
    ]),
  ],
  // 8 · Rocca Rischio
  [
    hh('h8_serra', T('Casa Serra'), 'couple', [
      ['claudio', 'Claudio Serra', 'alpinista', 26, 'dimensione-posizione', 'ip_position_sizing', [
        T('Su ogni operazione rischio al massimo l\'1-2% del capitale: dalla distanza tra prezzo di entrata e stop calcolo quante quote comprare.'),
        T('Così anche dieci errori di fila non mi fanno cadere dalla montagna.')]],
      ['monica', 'Monica Serra', 'ingegnera', 30, 'rapporto-rischio-rendimento', 'cfa', [
        T('Prima di entrare guardo il rapporto rischio/rendimento. Se rischio 1 per guadagnare 2, mi basta avere ragione 4 volte su 10 per restare in attivo, al netto dei costi.'),
        T('Senza questo conto, anche molte operazioni giuste possono lasciarti in perdita.')]],
    ]),
    hh('h8_rota', T('Casa Rota'), 'family', [
      ['massimo', 'Massimo Rota', T('vigile del fuoco'), 17, 'leva-azzeramento', 'ip_leverage', [
        T('Con una leva di 10 volte, un calo del 10% azzera il capitale.'),
        T('La leva amplifica gli errori quanto i successi, e il mercato non aspetta che tu abbia ragione.')]],
      ['federica', 'Federica Rota', 'commercialista', 24, 'sequenza-rendimenti', 'ip_asset_alloc', [
        T('Per chi preleva dal portafoglio, come un pensionato, un crollo nei primi anni fa molto più danno dello stesso crollo più avanti.'),
        T('Per questo, avvicinandosi all\'obiettivo, si riduce gradualmente il rischio.')]],
      ['gemma', 'Gemma Rota', 'bambina', 21, 'stop-deciso-prima', 'ip_stoploss', [
        T('Ho imparato che lo stop loss si decide prima di comprare, quando sei calm{o|a}.'),
        T('Non quando il prezzo sta già crollando e hai il cuore che batte forte!')]],
    ]),
    hh('h8_livio', T('Casa di Livio'), 'single', [
      ['livio', 'Livio', T('ex trader giornaliero'), 15, 'cfd-perdite', 'esma', [
        T('Gli avvisi obbligatori dei broker europei sui CFD dicono che la maggior parte dei conti dei piccoli investitori perde denaro.'),
        T('Ci ho provato per due anni. Oggi investo a lungo termine e dormo molto meglio.')]],
    ]),
    hh('h8_leone', T('Casa Leone'), 'family', [
      ['ivan', 'Ivan Leone', 'pilota', 28, 'backtest-overfitting', 'ip_paper', [
        T('Una strategia che sui dati passati sembra perfetta spesso è solo cucita addosso al caso.'),
        T('La provo su periodi che non ho usato per costruirla e poi in simulazione, prima di metterci soldi veri.')]],
      ['nadia', 'Nadia Leone', 'ricercatrice', 31, 'piano-scritto', 'cfa', [
        T('Il mio piano ha regole scritte: cosa compro, quando entro, dove esco e quanto rischio.'),
        T('Una regola che non è scritta, nel panico, la cambierò.')]],
      ['ottavio', 'Ottavio Leone', 'nonno', 19, 'bolle-storia', 'ip_bear', [
        T('Ho visto la bolla delle dot-com nel 2000: aziende senza utili valevano miliardi, poi molte sono sparite.'),
        T('Quando senti dire "stavolta è diverso", tieni stretto il portafoglio.')]],
    ]),
  ],
];

export const ALL_RESIDENTS: Resident[] = HOUSEHOLDS.flat().flatMap((h) => h.people);
export const RESIDENT_BY_ID: Record<string, Resident> = Object.fromEntries(ALL_RESIDENTS.map((r) => [r.id, r]));
