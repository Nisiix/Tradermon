// Libri dei temi aggiunti il 15/11/2026 (domande in data/quiz/learning.ts) e storie delle crisi.
// - Finanza personale e Obbligazioni e tassi: per tutti i percorsi, negli scaffali comuni di ogni Biblioteca.
// - Derivati e opzioni, Come funziona il mercato, Il mestiere del trader: solo nell'Accademia di Wall Street.
// - Storie dei mercati: le crisi raccontate nella Zona Simulazione, come libri di lettura (senza domande).
// Testi generici, validi in ogni Paese: niente regole fiscali nazionali, nessun consiglio d'acquisto.
import type { Book } from './books';
import type { QuizTopic } from '../types';
import { HISTORY } from './missions';
import { T } from '../i18n';

const B = (id: string, topic: QuizTopic, title: string, figs: Record<number, string> | null, ...pages: string[]): Book =>
  ({ id, topic, title, pages, ...(figs ? { figs } : {}) });

export const LEARNING_BOOKS: Book[] = [
  // ---- finanza personale ----
  B('b_p_budget', 'personale', T("Il budget personale"), { 0: 'budget' },
    T("Un budget è un piano che divide le entrate tra spese, risparmio e imprevisti. Si decide prima che il mese cominci: a ogni entrata dai un compito, invece di contare a fine mese quello che è rimasto."),
    T("Bisogni e desideri: il bisogno è una spesa necessaria (casa, cibo, trasporti per lavorare), il desiderio si può rimandare. Quando le entrate non bastano per tutto, è tra i desideri che si taglia."),
    T("«Paga prima te stesso»: appena arrivano le entrate, metti da parte la quota di risparmio che hai deciso. Quello che avanza a fine mese, di solito, è poco o niente."),
    T("Un obiettivo di risparmio funziona meglio se è SMART: specifico, misurabile, raggiungibile, rilevante e con una scadenza. Una cifra e una data diventano un risparmio mensile da rispettare; «un giorno vorrei» no.")),
  B('b_p_emergenza', 'personale', T("Il fondo di emergenza"), null,
    T("Il fondo di emergenza è liquidità tenuta da parte per gli imprevisti: un guasto, una spesa medica, un periodo senza entrate. Serve a coprirli senza vendere investimenti e senza fare debiti."),
    T("Un'emergenza non aspetta: il denaro del fondo deve essere disponibile in fretta e senza rischio di perdite. Qui il rendimento conta meno della disponibilità, e non va investito in titoli che oscillano."),
    T("Molti manuali suggeriscono di costruire il fondo prima di investire. Senza riserva, un imprevisto che capita durante un calo di mercato ti costringe a vendere in perdita proprio nel momento sbagliato.")),
  B('b_p_debito', 'personale', T("Debiti, TAEG e rate"), null,
    T("Il TAEG (tasso annuo effettivo globale, in inglese APR) è il costo totale annuo del credito: interessi più spese obbligatorie, in un solo numero. Per confrontare due prestiti si guarda il TAEG, non il solo tasso."),
    T("L'interesse composto lavora anche contro di te: se un debito non viene pagato, gli interessi si aggiungono al debito e producono altri interessi."),
    T("Il credito revolving della carta è tra i più cari: si paga una piccola rata e il resto del saldo matura interessi alti, che si sommano sul saldo non pagato. Il debito si allunga."),
    T("Rata bassa non vuol dire prestito economico. Allungare la durata abbassa la rata ma fa pagare interessi per più anni: il costo totale del prestito sale.")),
  B('b_p_buono', 'personale', T("Debito buono, debito cattivo"), null,
    T("Nei manuali di finanza personale un debito «buono» finanzia qualcosa che può crescere di valore o di reddito, come la formazione o uno strumento di lavoro. Un debito «cattivo» paga consumi che perdono valore, spesso a tassi alti."),
    T("Anche il debito buono va sostenuto dalla rata: se la rata pesa troppo sul budget, diventa un problema lo stesso."),
    T("Un confronto utile: un debito al 18% l'anno e dei risparmi fermi sul conto. Ripagare il debito vale come un guadagno sicuro pari al suo tasso, perché quegli interessi non li paghi più; un investimento promette solo un rendimento incerto. Il fondo di emergenza però resta.")),
  B('b_p_abitudini', 'personale', T("Le abitudini che contano"), null,
    T("L'inflazione dello stile di vita: ogni volta che il reddito sale, salgono anche le spese, e il risparmio resta fermo. Decidere prima quale parte degli aumenti mettere da parte la evita."),
    T("Avere più fonti di reddito è la diversificazione applicata alle entrate: se una si interrompe, le altre ti danno il tempo per reagire."),
    T("Nel lungo periodo conta soprattutto la costanza. Due persone con lo stesso reddito: una spende tutto, l'altra risparmia ogni mese una parte fissa. Con l'interesse composto la differenza si allarga anno dopo anno, perché ogni versamento ha più tempo per crescere.")),

  // ---- obbligazioni e tassi ----
  B('b_t_obbligazione', 'tassi', T("Che cos'è un'obbligazione"), null,
    T("Un'obbligazione è un prestito: chi la compra presta denaro a uno Stato o a un'azienda. In cambio riceve interessi periodici, le cedole, e alla scadenza la restituzione del capitale, il valore nominale."),
    T("Un titolo di Stato è un'obbligazione emessa da uno Stato per finanziarsi. Le obbligazioni zero coupon non pagano cedole: si comprano sotto il valore nominale e alla scadenza si riceve il valore pieno."),
    T("Fino alla scadenza l'obbligazione si può vendere in borsa, a un prezzo che sale e scende. Il rimborso del valore nominale arriva solo alla fine, e solo se chi l'ha emessa resta solvibile.")),
  B('b_t_prezzo', 'tassi', T("Prezzi e tassi: l'altalena"), { 0: 'tassi' },
    T("Quando i tassi di mercato salgono, le nuove obbligazioni pagano cedole più alte: quella vecchia, con la sua cedola fissa, attira meno e il suo prezzo scende finché il suo rendimento si allinea. Quando i tassi scendono succede il contrario."),
    T("La duration misura quanto il prezzo di un'obbligazione reagisce a un cambio dei tassi. Più è alta, più il prezzo si muove: le obbligazioni a lunga scadenza oscillano più di quelle brevi."),
    T("Una zero coupon a lunga scadenza restituisce tutto alla fine: la sua duration è pari alla scadenza ed è tra le obbligazioni più sensibili ai tassi.")),
  B('b_t_credito', 'tassi', T("Rating e rischio di credito"), null,
    T("Il rating è il giudizio sulla solidità di chi emette. Un rating basso segnala un rischio maggiore che chi ha emesso il titolo non ripaghi, e di solito un rendimento più alto per compensarlo."),
    T("Le obbligazioni high yield (ad alto rendimento) sono quelle con rating basso: pagano di più perché il rischio di insolvenza è più alto."),
    T("Rischio di credito e rischio di tasso sono due cose diverse. Il primo riguarda chi paga; il secondo come si muovono i tassi di mercato. Un'obbligazione di un emittente solidissimo perde comunque valore se i tassi salgono.")),
  B('b_t_rendimento', 'tassi', T("Rendimento a scadenza e tasso reale"), null,
    T("Il rendimento a scadenza è il rendimento annuo atteso tenendo l'obbligazione fino alla fine: mette insieme il prezzo pagato, le cedole e il rimborso. È il numero giusto per confrontare obbligazioni diverse."),
    T("Il tasso reale è il tasso nominale meno l'inflazione: dice quanto cresce davvero il potere d'acquisto. Un tasso del 3% con l'inflazione al 4% è un tasso reale negativo.")),
  B('b_t_banche', 'tassi', T("Banche centrali e curva dei tassi"), { 1: 'curva' },
    T("I tassi ufficiali di una valuta li decide la banca centrale. Quando l'inflazione è alta li alza: mutui e prestiti costano di più, il risparmio rende di più, la domanda rallenta e con essa la corsa dei prezzi."),
    T("La curva dei rendimenti mette in fila i tassi per scadenza. Quando è invertita, cioè i tassi brevi superano i lunghi, il mercato si aspetta tassi più bassi in futuro: storicamente è arrivata spesso prima di un rallentamento, ma non è un orologio."),
    T("Di solito le obbligazioni aiutano quando le azioni scendono. Ma la correlazione tra le due non è fissa: con l'inflazione alta e i tassi in salita possono scendere insieme, come nel 2022.")),

  // ---- Accademia: derivati e opzioni ----
  B('b_dv_cose', 'derivati', T("Che cos'è un derivato"), null,
    T("Un derivato è un contratto il cui valore dipende da un altro bene, il sottostante: un'azione, un indice, una materia prima, una valuta. Opzioni e future sono derivati."),
    T("Un future obbliga entrambe le parti a comprare o vendere un bene a un prezzo e a una data fissati. Si regola ogni giorno con i margini, quindi usa la leva."),
    T("I future nacquero per la copertura: un produttore di grano vende future sul raccolto per fissare oggi il prezzo e ridurre il rischio di un calo, rinunciando ai rialzi."),
    T("Leva, scadenze e prezzi che dipendono da più fattori rendono i derivati difficili: le autorità europee (ESMA) li trattano come prodotti complessi.")),
  B('b_dv_opzioni', 'derivati', T("Call e put"), { 1: 'opzione' },
    T("Un'opzione call dà a chi la compra il diritto, non l'obbligo, di comprare il sottostante a un prezzo fissato, lo strike (prezzo di esercizio), entro una data. Un'opzione put dà il diritto di vendere allo strike: guadagna valore quando il sottostante scende."),
    T("Il premio è il prezzo che chi compra l'opzione paga a chi la vende. La perdita massima di chi compra è il premio pagato: se a scadenza non conviene esercitarla, la lascia scadere senza valore."),
    T("Chi vende (scrive) un'opzione incassa il premio e si prende l'obbligo. Chi scrive una call scoperta, cioè senza possedere il titolo, rischia perdite potenzialmente illimitate se il prezzo sale molto: il premio è un guadagno piccolo e fisso.")),
  B('b_dv_valore', 'derivati', T("Il valore di un'opzione"), null,
    T("Una call è nel denaro (in the money) quando il prezzo è sopra lo strike, una put quando è sotto: esercitarla subito avrebbe un valore, il valore intrinseco. Altrimenti è fuori dal denaro (out of the money)."),
    T("Il resto del premio è valore del tempo. Avvicinandosi alla scadenza restano meno possibilità che il prezzo arrivi allo strike, e quel valore si consuma: è il decadimento temporale."),
    T("La volatilità implicita si ricava dal premio: è quanta oscillazione futura il mercato mette nel prezzo dell'opzione. Più ci si aspettano movimenti ampi, più le opzioni costano. È un'attesa, non una previsione sicura.")),
  B('b_dv_leva', 'derivati', T("Leva e copertura"), null,
    T("Coprirsi (hedging) vuol dire usare un derivato per ridurre il rischio di una posizione che hai già. Funziona come un'assicurazione: paghi un costo, per esempio il premio di una put, per limitare una perdita."),
    T("Con un CFD o un'opzione l'esposizione può valere 10 volte il capitale versato: un movimento del 10% contro la posizione cancella tutto il capitale. Gli avvisi dei broker ricordano che la maggior parte dei piccoli investitori sui CFD perde denaro.")),

  // ---- Accademia: come funziona il mercato ----
  B('b_mk_libro', 'mercato', T("Il libro degli ordini"), { 0: 'spread' },
    T("Il libro degli ordini (order book) è l'elenco degli ordini di acquisto e di vendita in attesa, prezzo per prezzo. Da un lato chi vuole comprare (denaro), dall'altro chi vuole vendere (lettera): il primo livello di ciascun lato definisce lo spread."),
    T("Prima dell'apertura c'è l'asta di apertura: gli ordini si raccolgono e la borsa fissa un unico prezzo di inizio, quello che fa incontrare più scambi."),
    T("Un ordine a mercato molto grande su un titolo poco scambiato consuma più livelli del libro e viene eseguito a prezzi peggiori: è lo slippage. Il movimento di prezzo causato dal tuo stesso ordine si chiama costo di impatto, ed è maggiore per ordini grandi e titoli poco scambiati.")),
  B('b_mk_maker', 'mercato', T("Market maker e liquidità"), null,
    T("Il market maker propone di continuo prezzi di acquisto e di vendita: guadagna sullo spread e in cambio dà liquidità, cioè rende più facile scambiare."),
    T("La liquidità di un titolo è quanto puoi comprare o vendere senza spostare molto il prezzo. Tanti compratori e venditori avvicinano i prezzi migliori: i titoli molto scambiati hanno spread stretti. La liquidità dell'azienda, il contante in cassa, è un'altra cosa."),
    T("In un crollo improvviso gli spread si allargano: chi offre prezzi rischia di più, si ritira o chiede un margine maggiore. Proprio quando serve, la liquidità cala."),
    T("Il prezzo di un ETF in borsa segue domanda e offerta e per un momento può allontanarsi dal valore del paniere che contiene. I market maker lo riportano vicino comprando e vendendo, ma in momenti agitati lo scarto può allargarsi.")),
  B('b_mk_orari', 'mercato', T("Orari, volumi e sospensioni"), null,
    T("Le sessioni pre-market e after-hours sono scambi fuori dall'orario regolare: ci sono meno ordini e spread più larghi, i prezzi possono saltare e gli ordini a mercato costare di più."),
    T("Il volume dice quanto si è scambiato. Un volume molto alto vuol dire molta partecipazione: tanti hanno comprato e venduto. Non dice quale sarà la direzione dei prezzi nei giorni dopo."),
    T("La sospensione per volatilità (circuit breaker) è uno stop temporaneo agli scambi dopo movimenti troppo forti di un titolo o dell'indice: dà il tempo a informazioni e ordini di arrivare prima di riprendere.")),
  B('b_mk_scoperto', 'mercato', T("Vendere allo scoperto"), null,
    T("Chi vende allo scoperto prende in prestito un titolo, lo vende e dovrà ricomprarlo. Se il prezzo sale, la perdita sale con lui, e un prezzo non ha un massimo: la perdita possibile non ha un tetto."),
    T("Short squeeze: quando molti sono allo scoperto e il prezzo sale, sono costretti a ricomprare in fretta, e i loro acquisti spingono il prezzo ancora più su."),
    T("Chi presta i propri titoli a chi vende allo scoperto riceve un compenso per il prestito. Resta però esposto alle oscillazioni del titolo e al rischio di controparte, coperto da garanzie.")),

  // ---- Accademia: il mestiere del trader ----
  B('b_tr_rischio', 'trading', T("Quanto rischiare per operazione"), { 1: 'rr' },
    T("Rischiare l'1% del capitale per operazione vuol dire che, se scatta lo stop, perdi al massimo l'1% del capitale. Il rischio è la perdita fino allo stop, non l'importo investito: con uno stop vicino puoi investire di più rischiando la stessa parte."),
    T("Il rapporto rischio/rendimento confronta la perdita fino allo stop con il guadagno fino all'obiettivo. Si guarda prima di entrare."),
    T("Lo stop si decide prima di entrare, a mente fredda, insieme alla dimensione della posizione. Uno stop «mentale», solo pensato e non inviato, dipende dalla disciplina del momento: quando il prezzo scende in fretta è facile non rispettarlo."),
    T("Rischiare sempre la stessa piccola parte del capitale, invece di cifre a caso, fa sì che nessuna singola operazione possa compromettere il conto: anche una lunga serie negativa lo lascia in piedi.")),
  B('b_tr_aspettativa', 'trading', T("Win rate e aspettativa"), { 1: 'asimmetria' },
    T("Il win rate è la percentuale di operazioni vincenti: la quota di operazioni chiuse in guadagno sul totale. Da solo dice poco: conta insieme a quanto guadagni quando vinci e quanto perdi quando perdi."),
    T("Una strategia che vince il 40% delle volte può guadagnare nel tempo, se le operazioni vinte guadagnano molto più di quanto perdono le altre. Vale anche il contrario: un win rate alto con perdite grandi può perdere."),
    T("L'aspettativa positiva è un risultato medio per operazione sopra zero, tra vincite, perdite e costi. Se l'aspettativa è negativa, nessuna gestione del denaro la rende positiva."),
    T("La martingala aumenta la dimensione dopo ogni perdita: la puntata cresce in fretta, e una serie sfavorevole un po' più lunga del previsto può azzerare il conto.")),
  B('b_tr_drawdown', 'trading', T("Drawdown e backtest"), { 0: 'drawdown' },
    T("Il drawdown di una strategia è la perdita più profonda dal suo massimo al minimo successivo: dice quanto può far male nei periodi peggiori."),
    T("Due strategie con lo stesso guadagno medio non sono uguali se una ha drawdown molto più profondi: è facile abbandonarla nel momento peggiore e perdere la risalita."),
    T("Pochi ottimi trade in un backtest non bastano: con pochi casi il risultato può dipendere dalla fortuna, non da un vantaggio. Servono molti casi, in mercati diversi e con i costi veri.")),
  B('b_tr_disciplina', 'trading', T("La disciplina del trader"), null,
    T("Overtrading: fare troppe operazioni, spesso per noia o per recuperare. Ogni operazione ha costi (commissioni, spread) e chiede una decisione: farne troppe aumenta errori e costi senza aumentare il vantaggio."),
    T("Revenge trading: aprire subito un'altra operazione per recuperare una perdita. La voglia di rifarsi spinge a operazioni impulsive e più grandi, ed è uno dei modi più rapidi per allargare una perdita."),
    T("Il diario di trading serve a rivedere decisioni e risultati: annotare il motivo di ogni operazione e rileggerlo dopo aiuta a trovare gli errori che si ripetono e a separare le decisioni buone dai risultati fortunati.")),
];

const STORY_TITLE: Record<string, string> = {
  leg1929: T('Il Grande Crollo (1929)'), leg2000: T('La bolla dot-com (2000)'), leg2008: T('La crisi finanziaria (2008)'),
  leg2018: T('Il Natale nero (2018)'), leg2020: T('Il crollo lampo (2020)'), leg2022: T("L'inverno cripto (2022)"),
  leg2022r: T("L'anno dei tassi (2022)"), leg2025: T('La guerra dei dazi (2025)'),
};

/**
 * Storie dei mercati: le crisi dell'Archivio della Zona Simulazione come libri, sullo scaffale Economia e mercati.
 * Non hanno domande e non aprono nessun tema (stanno fuori da BOOKS); si leggono per capire che cosa successe.
 */
export const STORY_BOOKS: Book[] = Object.entries(HISTORY).map(([id, h]) => ({
  id: `b_st_${id}`, topic: 'macro', level: 2, title: STORY_TITLE[id] ?? id,
  pages: [h.when, h.cause, T`La lezione: ${h.lesson}`, T('Nella Zona Simulazione di Diversia, alla voce «Crisi storiche», trovi la stessa storia; le crisi dal 2016 in poi si possono anche rivivere sui prezzi veri.')],
}));
