// Libri sugli scaffali delle Biblioteche: ogni città (dalla seconda) ha una "Sezione della Whale" con i volumi
// sull'argomento su cui la Whale locale interroga nel duello. Testi originali, parafrasati, senza citazioni.
import type { AssetClass, QuizTopic, Track } from '../types';
import { mentorTopics } from './quiz/build';
import { mentor, TOWNS } from './story';
import { T } from '../i18n';

export interface Book { id: string; topic: QuizTopic; title: string; pages: string[] }

export const TOPIC_LABEL: Record<QuizTopic, string> = {
  rischio: T('Rischio e rendimento'), ordini: T('Ordini di borsa'), diversificazione: T('Diversificazione'), costi: T('Costi e interesse composto'),
  bias: T('Bias e psicologia'), gestione: T('Gestione del rischio'), macro: T('Macroeconomia'), analisi: T('Analisi'), regole: T('Regole e truffe'),
  stocks_base: T('Le azioni'), stocks_bilanci: T('I bilanci'), stocks_dividendi: T('I dividendi'),
  etf_base: T('Gli ETF'), etf_replica: T('Replica e tracking'), etf_obbligazioni: T('Le obbligazioni'),
  crypto_base: T('Le cripto'), crypto_custodia: T('La custodia'), crypto_stable: T('Stablecoin e DeFi'),
  mixed_base: T('Le classi di attivo'), mixed_allocazione: T("L'asset allocation"),
};

const B = (id: string, topic: QuizTopic, title: string, ...pages: string[]): Book => ({ id, topic, title, pages });

/** Due volumi per argomento: il contesto (perché la Whale ci tiene) e la materia (ciò che chiede nel duello). */
export const BOOKS: Book[] = [
  // ---- Whale 1: rischio + basi del percorso ----
  B('b_rischio_ctx', 'rischio', T('Il seme e la tempesta'),
    T('A Ponte Cedola si dice che ogni investimento è un seme: non sai quanto crescerà, ma sai che le stagioni cambieranno.'),
    T('La Whale di questa città interroga sul rapporto tra rendimento e rischio: chi spera di raccogliere di più deve accettare annate peggiori.'),
    T('Nel duello ti chiederà cosa misura la volatilità, cos\'è un drawdown, la differenza tra rischio sistematico e specifico, e quanta oscillazione riesci a sopportare.')),
  B('b_rischio_1', 'rischio', T('Rendimento atteso e oscillazioni'),
    T('Il rendimento atteso è la media di ciò che un investimento può rendere; il rischio è quanto il risultato vero può allontanarsi da quella media.'),
    T('La volatilità misura l\'ampiezza delle oscillazioni. Due investimenti con la stessa media possono dare viaggi molto diversi: uno tranquillo, l\'altro pieno di buche.'),
    T('Il massimo drawdown è la caduta dal punto più alto al punto più basso successivo. È il numero da guardare per capire se reggeresti il viaggio senza vendere nel panico.'),
    T('Le perdite sono asimmetriche: dopo −20% serve +25%, dopo −50% serve +100%. Per questo evitare le grandi cadute conta più che inseguire i grandi rialzi.'),
    T('Il rischio sistematico (di mercato) colpisce quasi tutto e non si elimina diversificando; il rischio specifico riguarda una sola azienda. Se un titolo pesa troppo, è rischio di concentrazione; se investi in un\'altra valuta, si aggiunge il rischio di cambio.')),
  B('b_stocks_base_ctx', 'stocks_base', T('Botteghe e azionisti'),
    T('Le botteghe di Ponte Cedola nacquero così: un artigiano cercava soci, e ogni socio riceveva una quota dei profitti.'),
    T('Un\'azione è esattamente questo: una piccola fetta di proprietà di un\'azienda. La Whale vuole sapere se capisci cosa stai comprando.')),
  B('b_stocks_base_1', 'stocks_base', T('Cos\'è davvero un\'azione'),
    T('Chi possiede un\'azione possiede una parte dell\'azienda: partecipa agli utili (dividendi) e alla crescita del valore, ma anche alle perdite.'),
    T('Il prezzo di un\'azione cambia ogni giorno in base a domanda e offerta, ma nel lungo periodo segue i profitti e le prospettive dell\'azienda.'),
    T('Capitalizzazione = prezzo × numero di azioni: dice quanto vale l\'intera azienda in borsa. Un prezzo "basso" non significa un\'azione a buon mercato. Il flottante è la parte di azioni liberamente scambiata in borsa.'),
    T('Il rischio specifico è quello della singola azienda (un prodotto che fallisce, un concorrente, una frode); il rischio di mercato colpisce tutte le azioni insieme.')),
  B('b_etf_base_ctx', 'etf_base', T('Il paniere del mercato'),
    T('A Ponte Cedola i mercanti riempivano un paniere con un po\' di ogni merce, così nessuna annata storta rovinava la famiglia.'),
    T('Un ETF fa lo stesso con gli investimenti: con una sola quota compri un intero paniere. La Whale chiede se sai cosa c\'è dentro.')),
  B('b_etf_base_1', 'etf_base', T('Cos\'è un ETF'),
    T('Un ETF è un fondo quotato in borsa che replica un indice: comprando una quota possiedi, in proporzione, tutte le società dell\'indice.'),
    T('Si compra e si vende come un\'azione, durante l\'orario di mercato, e il suo valore segue da vicino il paniere che rappresenta.'),
    T('I vantaggi: diversificazione immediata, costi bassi, trasparenza. Il limite: non puoi fare meglio dell\'indice, perché sei l\'indice.'),
    T('Il TER è il costo annuo del fondo, già incluso nel prezzo: piccolo ogni anno, pesante in trent\'anni.')),
  B('b_crypto_base_ctx', 'crypto_base', T('I nodi del ponte'),
    T('I nodi di Ponte Cedola erano i punti in cui le corde si intrecciavano: nessun nodo da solo reggeva il ponte, tutti insieme sì.'),
    T('Una blockchain è una catena di nodi che tengono la stessa copia di un registro. La Whale chiede se sai cosa registra e chi lo controlla.')),
  B('b_crypto_base_1', 'crypto_base', T('Cripto e blockchain'),
    T('Una blockchain è un registro condiviso: ogni blocco contiene transazioni e il riferimento al blocco precedente, così la storia non si può riscrivere di nascosto.'),
    T('Un token è la rappresentazione digitale di un valore o di un diritto, registrata e trasferibile su una blockchain. Il prezzo delle criptovalute dipende da domanda e offerta: non ci sono utili, cedole o affitti dietro.'),
    T('Bitcoin ha un\'offerta massima di 21 milioni e ogni circa quattro anni l\'halving dimezza la ricompensa ai miner. La scarsità però non garantisce il prezzo: conta la domanda.'),
    T('La volatilità è altissima: cadute del 70-80% sono già successe più volte. Investi solo ciò che puoi permetterti di vedere dimezzato.'),
    T('Attenzione a chi promette rendimenti fissi e sicuri sulle cripto: chi garantisce il guadagno di solito sta vendendo qualcosa.')),
  B('b_mixed_base_ctx', 'mixed_base', T('Il crocevia delle classi'),
    T('Ponte Cedola è un crocevia: da qui partono le strade dei titoli, dei panieri e dei nodi. Chi sceglie il Sentiero Misto le percorre tutte.'),
    T('La Whale chiede se conosci le differenze tra azioni, ETF, obbligazioni e cripto: rendimento, rischio e cosa c\'è dietro al prezzo.')),
  B('b_mixed_base_1', 'mixed_base', T('Le classi di attivo'),
    T('Azioni: quote di aziende, rendimento legato ai profitti, oscillazioni ampie. Obbligazioni: prestiti con cedola e scadenza, più stabili.'),
    T('ETF: panieri di azioni o obbligazioni, diversificazione a basso costo. Cripto: registri digitali, nessun flusso di cassa, volatilità estrema.'),
    T('Liquidità: il denaro fermo, che non oscilla ma perde potere d\'acquisto con l\'inflazione.'),
    T('Ogni classe ha una stagione: combinarle rende il portafoglio meno dipendente dall\'umore di un solo mercato.')),

  // ---- Whale 2: ordini ----
  B('b_ordini_ctx', 'ordini', T('Il porto e i suoi ordini'),
    T('A Porto Ordini ogni nave parte solo con istruzioni precise: destinazione, prezzo del carico, cosa fare se il tempo peggiora.'),
    T('In borsa è uguale: un ordine dice al mercato cosa vuoi, a quale prezzo e per quanto tempo. La Whale interroga sui tipi di ordine e sui loro rischi.'),
    T('Nel duello compaiono ordini a mercato, limite e stop, lo spread denaro-lettera e gli orari in cui le borse sono aperte.')),
  B('b_ordini_1', 'ordini', T('Mercato, limite, stop'),
    T('Ordine a mercato: eseguito subito al miglior prezzo disponibile. Sei sicur{o|a} dell\'esecuzione, non del prezzo.'),
    T('Ordine limite: fissi il prezzo massimo per comprare (o minimo per vendere). Sei sicur{o|a} del prezzo, non dell\'esecuzione: se il mercato non ci arriva, resti ferm{o|a}.'),
    T('Ordine stop: resta dormiente finché il prezzo tocca la soglia, poi diventa un ordine a mercato. Serve per limitare le perdite (stop loss) o per entrare su una rottura.'),
    T('Validità: "giornaliero" scade a fine seduta, "fino a revoca" resta attivo per giorni. Controlla sempre gli ordini aperti.')),
  B('b_ordini_2', 'ordini', T('Spread, orari e liquidità'),
    T('Lo spread è la differenza tra il prezzo a cui puoi vendere (denaro) e quello a cui puoi comprare (lettera). Più è largo, più paghi solo per entrare e uscire.'),
    T('I titoli poco scambiati hanno spread larghi e prezzi che saltano: un ordine a mercato può costare molto più del previsto.'),
    T('Le borse hanno orari: quella americana è aperta dalle 9:30 alle 16:00, ora di New York. Fuori orario i prezzi si muovono con pochi scambi e grandi salti.'),
    T('Le cripto non chiudono mai: comodo, ma significa che anche il rischio non dorme.'),
    T('Lo slippage è lo scarto tra il prezzo che ti aspetti e quello a cui l\'ordine viene eseguito: capita con ordini a mercato, titoli poco liquidi e notizie improvvise.')),

  // ---- Whale 3: diversificazione ----
  B('b_div_ctx', 'diversificazione', T('La città dei mille colori'),
    T('Diversia è famosa per il suo mosaico: nessuna tessera da sola fa il disegno, e se una si scheggia il quadro resta bello.'),
    T('La Whale interroga sulla diversificazione: perché funziona, cosa riduce davvero e cosa invece non può eliminare.'),
    T('Aspettati domande su correlazione, rischio specifico e di mercato, e sul ribilanciamento.')),
  B('b_div_1', 'diversificazione', T('Perché il paniere protegge'),
    T('Diversificare significa distribuire il denaro tra investimenti che non si muovono tutti insieme: settori, Paesi, classi di attivo.'),
    T('Riduce il rischio specifico (il crollo di una sola azienda) ma non il rischio di mercato, che nelle crisi colpisce quasi tutto.'),
    T('La correlazione dice quanto due investimenti si muovono insieme: vicina a 1, si somigliano; vicina a 0 o negativa, si compensano.'),
    T('Dieci azioni dello stesso settore non sono diversificazione: sono la stessa scommessa fatta dieci volte.')),
  B('b_div_2', 'diversificazione', T('Il ribilanciamento'),
    T('Con il tempo i pesi del portafoglio cambiano: ciò che è salito pesa di più, ciò che è sceso di meno. Il rischio cresce senza che tu abbia deciso nulla.'),
    T('Ribilanciare significa riportare i pesi all\'obiettivo: vendi un po\' di ciò che è cresciuto e compri ciò che è rimasto indietro.'),
    T('Si fa a scadenze fisse (una volta l\'anno) o quando un peso si allontana troppo (per esempio di 5 punti). Senza esagerare: ogni operazione costa.')),

  // ---- Whale 4: costi e composto ----
  B('b_costi_ctx', 'costi', T('La spirale di Interessa'),
    T('Il simbolo di Interessa è una spirale: ogni giro è un anno, e ogni giro è più largo del precedente. È l\'interesse composto.'),
    T('La Whale interroga sul tempo come alleato e sui costi come nemico: commissioni, TER, spread e tasse che girano la spirale al contrario.'),
    T('Preparati su regola del 72, costi ricorrenti e piani di accumulo.')),
  B('b_costi_1', 'costi', T('L\'interesse composto'),
    T('Reinvestendo i guadagni, ogni anno frutta anche ciò che hai guadagnato negli anni prima: la crescita accelera da sola. Quando gli interessi si aggiungono al capitale si parla di capitalizzazione.'),
    T('Regola del 72: dividi 72 per il rendimento annuo e ottieni gli anni per raddoppiare. Al 6% servono 12 anni, al 3% ne servono 24.'),
    T('Partire presto conta più che partire con tanto: dieci anni in più di composizione valgono più di un versamento doppio.'),
    T('Un piano di accumulo (versamenti fissi e regolari) sfrutta il tempo e toglie l\'ansia di indovinare il momento giusto.')),
  B('b_costi_2', 'costi', T('I costi si compongono al contrario'),
    T('Una commissione dell\'1% l\'anno sembra niente. In trent\'anni si mangia circa un quarto del capitale finale: i costi si compongono come i rendimenti, ma contro di te.'),
    T('Costi visibili: commissioni di acquisto e vendita, TER dei fondi. Costi nascosti: spread, tasse sui guadagni, inflazione.'),
    T('Operare spesso moltiplica i costi: ogni giro di ordini è un piccolo pedaggio. Chi fa meno, spesso tiene di più.')),

  // ---- Whale 5: analisi del percorso ----
  B('b_stocks_bil_ctx', 'stocks_bilanci', T('Dietro ogni azione, un\'azienda'),
    T('A Bilancia pesano tutto: ricavi, utili, debiti. Dicono che un\'azione senza bilancio è un biglietto della lotteria.'),
    T('La Whale interroga sulla lettura dei conti: cosa dicono i cinque numeri principali e cosa non dicono.'),
    T('Nel duello: ricavi, utile, margini, debito e il rapporto prezzo/utili.')),
  B('b_stocks_bil_1', 'stocks_bilanci', T('Il bilancio in cinque numeri'),
    T('Ricavi: quanto l\'azienda vende. Utile netto: cosa resta dopo costi, interessi e tasse. Margine: utile diviso ricavi, dice quanto è efficiente.'),
    T('Debito: quanto deve a banche e obbligazionisti; confrontalo con l\'utile per capire se è sostenibile. Flusso di cassa: i soldi veri che entrano, più difficili da truccare dell\'utile.'),
    T('Rapporto prezzo/utili (P/E): quanti anni di utili paghi per comprare l\'azienda. Alto non è sempre caro (può crescere molto), basso non è sempre economico (può essere in declino).'),
    T('EBITDA: l\'utile prima di interessi, tasse, ammortamenti e svalutazioni. Gli ammortamenti ripartiscono negli anni il costo di impianti e macchinari. Il rendiconto finanziario mostra come entra ed esce la cassa.'),
    T('Confronta i numeri con il passato dell\'azienda e con i concorrenti, mai da soli.')),
  B('b_etf_rep_ctx', 'etf_replica', T('Due gemelli, un prospetto'),
    T('A Bilancia dicono che due ETF possono sembrare identici e comportarsi in modo diverso: la differenza è scritta nel prospetto.'),
    T('La Whale interroga su replica fisica e sintetica, tracking error, dimensione del fondo e politica dei dividendi.')),
  B('b_etf_rep_1', 'etf_replica', T('Replica e tracking error'),
    T('Replica fisica: il fondo compra davvero i titoli dell\'indice. Replica sintetica: usa un contratto con una banca che promette il rendimento dell\'indice (rischio di controparte).'),
    T('Tracking difference: quanto il fondo ha reso meno (o più) dell\'indice in un periodo. Tracking error: quanto quello scarto varia nel tempo. Più sono bassi, meglio il fondo fa il suo mestiere.'),
    T('Ad accumulazione: i dividendi vengono reinvestiti nel fondo. A distribuzione: ti vengono pagati. Scegli in base a tasse e obiettivi.'),
    T('Patrimonio del fondo e volume degli scambi: un ETF troppo piccolo può costare di più (spread) o essere chiuso.')),
  B('b_crypto_cus_ctx', 'crypto_custodia', T('Le chiavi del regno'),
    T('A Bilancia custodiscono i pesi della città in una cassaforte con due chiavi. Nessuno conosce entrambe. È l\'idea della custodia.'),
    T('La Whale interroga su chiavi private, seed phrase, wallet caldi e freddi, e sui rischi di lasciare le cripto a terzi.')),
  B('b_crypto_cus_1', 'crypto_custodia', T('Chiavi, wallet e custodia'),
    T('La chiave privata è la prova di possesso: chi la conosce può spendere. La seed phrase (12 o 24 parole) la genera: va scritta su carta, mai fotografata o salvata online.'),
    T('Wallet caldo: connesso a internet, comodo ma esposto. Wallet freddo: dispositivo scollegato, scomodo ma sicuro per le somme importanti.'),
    T('Lasciare le cripto su una piattaforma significa fidarsi di lei: se fallisce o viene violata, le monete non sono tue. "Non le tue chiavi, non le tue monete".'),
    T('Nessun supporto tecnico serio chiede la seed phrase. Chi la chiede sta rubando.')),
  B('b_mixed_all_ctx', 'mixed_allocazione', T('Le proporzioni giuste'),
    T('Bilancia è la città delle proporzioni: non conta il singolo ingrediente, ma quanto ne metti. Vale per il pane e per il portafoglio.'),
    T('La Whale interroga sull\'asset allocation: come decidere i pesi tra classi in base a orizzonte, obiettivo e tolleranza al rischio.')),
  B('b_mixed_all_1', 'mixed_allocazione', T('Costruire un\'allocazione'),
    T('L\'asset allocation è la scelta dei pesi tra azioni, obbligazioni, liquidità e altro. Spiega la maggior parte del rendimento e del rischio di un portafoglio.'),
    T('Orizzonte lungo e stomaco forte: più azioni. Orizzonte breve o bisogno di stabilità: più obbligazioni e liquidità.'),
    T('Decidi i pesi prima, scrivili, e poi ribilancia quando il mercato li sposta. L\'allocazione va cambiata quando cambia la tua vita, non quando cambia l\'umore del mercato.'),
    T('L\'allocazione tattica sposta di poco e per poco tempo i pesi strategici. I fondi target date riducono da soli il rischio man mano che si avvicina la data obiettivo.')),

  // ---- Whale 6: raccolto del percorso ----
  B('b_stocks_div_ctx', 'stocks_dividendi', T('Il ciclo del raccolto'),
    T('A Valdividendo seminano, aspettano, raccolgono e riseminano. I contadini lo chiamano ciclo; gli investitori, reinvestimento dei dividendi.'),
    T('La Whale interroga su cosa sono i dividendi, da dove vengono e perché un rendimento da dividendo altissimo è spesso un segnale di pericolo.')),
  B('b_stocks_div_1', 'stocks_dividendi', T('Dividendi e reinvestimento'),
    T('Il dividendo è la parte di utile che l\'azienda distribuisce ai soci. Non è denaro in più: il giorno dello stacco il prezzo dell\'azione scende dello stesso importo.'),
    T('Rendimento da dividendo = dividendo annuo diviso prezzo. Se è molto alto, spesso è perché il prezzo è crollato: il mercato dubita che il dividendo durerà.'),
    T('Reinvestire i dividendi compra nuove azioni che pagheranno nuovi dividendi: è il composto applicato al raccolto.'),
    T('Il payout (quota di utile distribuita) sopra il 100% non è sostenibile: l\'azienda paga più di quanto guadagna.'),
    T('Un\'altra strada per restituire valore ai soci è il buyback: l\'azienda ricompra le proprie azioni, che così diminuiscono di numero.')),
  B('b_etf_obb_ctx', 'etf_obbligazioni', T('L\'onda dei tassi'),
    T('Le cedole di Valdividendo arrivano puntuali come le stagioni. Ma quando i tassi salgono, i prezzi delle vecchie obbligazioni scendono: è l\'onda.'),
    T('La Whale interroga su cedola, scadenza, duration e sul legame inverso tra tassi e prezzi.')),
  B('b_etf_obb_1', 'etf_obbligazioni', T('Obbligazioni e duration'),
    T('Un\'obbligazione è un prestito: tu presti, ricevi cedole periodiche e alla scadenza il capitale. Il rischio principale è che chi ha preso in prestito non restituisca.'),
    T('Quando i tassi di mercato salgono, le obbligazioni già emesse (con cedole più basse) valgono meno; quando scendono, valgono di più.'),
    T('La duration misura questa sensibilità: duration 7 significa circa −7% di prezzo per ogni +1% dei tassi. Scadenze lunghe, duration alta, oscillazioni ampie.'),
    T('Un ETF obbligazionario non ha scadenza: rinnova continuamente i titoli, quindi la duration resta più o meno costante.'),
    T('Zero coupon: nessuna cedola, si compra sotto il nominale e si guadagna al rimborso. Titoli indicizzati all\'inflazione: il capitale si rivaluta con i prezzi.')),
  B('b_crypto_sta_ctx', 'crypto_stable', T('Stabile a parole'),
    T('Nel porto di Valdividendo c\'è un\'ancora che tutti credevano infallibile. Un giorno la catena si spezzò. Le stablecoin somigliano a quell\'ancora.'),
    T('La Whale interroga su come una stablecoin mantiene il valore, cosa la può far crollare e sui rischi della DeFi.')),
  B('b_crypto_sta_1', 'crypto_stable', T('Stablecoin, DeFi e rug pull'),
    T('Una stablecoin promette di valere sempre 1 dollaro (o euro). Quelle con riserve vere in banca sono più solide; quelle "algoritmiche", senza riserve, sono già crollate a zero.'),
    T('DeFi: servizi finanziari su blockchain senza intermediari. I rendimenti alti pagano rischi alti: errori nel codice, attacchi, liquidità che sparisce.'),
    T('Rug pull: i creatori di un token raccolgono denaro e scompaiono. Segnali: team anonimo, promesse di rendimento garantito, pressione a entrare subito.'),
    T('Regola di Valdividendo: se non capisci da dove viene il rendimento, il rendimento sei tu.')),

  // ---- Whale 7: bias ----
  B('b_bias_ctx', 'bias', T('La città degli specchi'),
    T('A Mentelucida ogni vetrina è uno specchio: la gente dice che il nemico dell\'investitore lo vedi ogni mattina lì dentro.'),
    T('La Whale interroga sui bias: le trappole mentali che fanno comprare in alto, vendere in basso e seguire la folla.'),
    T('Nel duello: avversione alle perdite, FOMO, effetto gregge, eccesso di fiducia, ancoraggio e come difendersi.')),
  B('b_bias_1', 'bias', T('Le trappole della mente'),
    T('Avversione alle perdite: una perdita fa male circa il doppio di quanto un guadagno uguale faccia piacere. Per questo si tengono i titoli in perdita "finché tornano".'),
    T('FOMO: la paura di restare fuori spinge a comprare dopo che il prezzo è già salito. Effetto gregge: fare ciò che fanno tutti sembra sicuro, ma la folla arriva tardi.'),
    T('Eccesso di fiducia: dopo qualche successo si crede di saper prevedere. Ancoraggio: si resta legati a un prezzo passato ("torno in pari e vendo").'),
    T('Difese: regole scritte prima, piani di accumulo automatici, un diario delle decisioni e il tempo di aspettare una notte prima di agire.')),

  // ---- Whale 8: gestione del rischio ----
  B('b_gestione_ctx', 'gestione', T('Le mura di Rocca Rischio'),
    T('Rocca Rischio non ha mai vinto una battaglia d\'assalto. Ha vinto tutte quelle di difesa: le mura sono il suo scudo.'),
    T('La Whale interroga sulla gestione del rischio: quanto mettere in ogni posizione, quando uscire, cosa fare con la leva.'),
    T('Nel duello: dimensione delle posizioni, stop loss e trailing stop, rapporto rischio/rendimento, leva e margin call, martingala e fondo di emergenza.')),
  B('b_gestione_1', 'gestione', T('Quanto rischiare'),
    T('Prima di quanto guadagnare, decidi quanto puoi perdere: per singola posizione e per l\'intero portafoglio. Molti usano l\'1-2% del capitale a operazione.'),
    T('Lo stop loss trasforma una decisione emotiva in una regola: il punto di uscita è deciso quando sei lucid{o|a}, non quando il prezzo crolla.'),
    T('La leva moltiplica guadagni e perdite: con leva 5, un −20% azzera il capitale. La martingala (raddoppiare dopo ogni perdita) finisce sempre contro un limite: il tuo.'),
    T('Fondo di emergenza prima di investire: 3-6 mesi di spese liquidi, così non dovrai vendere nel momento peggiore.'),
    T('Rapporto rischio/rendimento: quanto rischi fino allo stop rispetto a quanto puoi guadagnare fino all\'obiettivo. Il trailing stop sale insieme al prezzo. Con la leva, se il capitale scende sotto il margine di mantenimento scatta la margin call.')),
];

export const BOOK_BY_ID: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

export function booksFor(topics: QuizTopic[]): Book[] {
  return BOOKS.filter((b) => topics.includes(b.topic));
}

/** Volume introduttivo generato per la Whale n: chi è, su cosa interroga, come prepararsi. */
export function guideBook(n: number, track: Track, mixed: AssetClass[]): Book {
  const m = mentor(n, track);
  const topics = mentorTopics(n, track, mixed);
  const town = TOWNS[n]?.name ?? '';
  return {
    id: `b_guide_${n}`, topic: topics[0] ?? 'rischio', title: T`Guida alla sfida: ${m.name}`,
    pages: [
      T`${m.name}, Whale n. ${n} di ${town}, assegna la ${m.badge}. Il suo motto: "${m.intro}"`,
      T`Nel duello fa domande su ${topics.map((t) => `«${TOPIC_LABEL[t]}»`).join(T(' e '))}. Servono risposte giuste alla maggior parte delle domande: studia questa sezione prima di sfidarla.`,
      T`Se la batti, impari la tecnica "${m.technique}": ${m.techDesc}`,
      T('Gli allievi dell\'Exchange fanno domande più facili sugli stessi temi: sono il ripasso ideale prima della Whale.'),
    ],
  };
}

/** Tutti i volumi della Sezione della Whale n (guida + contesto + materia). */
export function mentorBooks(n: number, track: Track, mixed: AssetClass[]): Book[] {
  return [guideBook(n, track, mixed), ...booksFor(mentorTopics(n, track, mixed))];
}
