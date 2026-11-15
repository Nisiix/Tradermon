// Glossario: i termini dei libri con una definizione breve. Un termine si sblocca leggendo il libro che lo spiega
// (finché non l'hai letto il glossario ti dice quale libro aprire). Definizioni originali e parafrasate.
// Non dice mai che cosa comprare: spiega le parole.
import { T } from '../i18n';
import { S } from '../systems/state';

export interface Term { id: string; term: string; def: string; book: string }

const G = (id: string, term: string, def: string, book: string): Term => ({ id, term, def, book });

export const GLOSSARY: Term[] = [
  // rischio
  G('rendimento_atteso', T('Rendimento atteso'), T('La media di ciò che un investimento può rendere: il risultato vero può allontanarsene.'), 'b_r_rendimento'),
  G('premio_rischio', T('Premio per il rischio'), T('Il rendimento in più che ci si aspetta per accettare un investimento più rischioso di uno quasi privo di rischio.'), 'b_r_rendimento'),
  G('volatilita', T('Volatilità'), T('Quanto oscilla il prezzo di un investimento: più è alta, più il percorso è irregolare.'), 'b_r_volatilita'),
  G('drawdown', T('Massimo drawdown'), T('La caduta più profonda da un massimo al minimo che lo segue.'), 'b_r_volatilita'),
  G('rischio_sistematico', T('Rischio sistematico'), T('Il rischio che colpisce quasi tutto il mercato insieme: diversificare non lo elimina.'), 'b_r_tipi'),
  G('rischio_specifico', T('Rischio specifico'), T('Il rischio di una sola azienda o di un solo titolo: si riduce diversificando.'), 'b_r_tipi'),
  G('tolleranza', T('Tolleranza al rischio'), T('Quanta oscillazione e perdita temporanea riesci, e puoi permetterti, di sopportare.'), 'b_r_tolleranza'),
  G('orizzonte', T('Orizzonte temporale'), T('Per quanto tempo i soldi investiti non ti serviranno.'), 'b_r_tolleranza'),
  G('sharpe', T('Indice di Sharpe'), T('Quanto rendimento si è ottenuto per ogni unità di rischio corso.'), 'b_r_misure'),
  G('beta', T('Beta'), T('Quanto un titolo amplifica (sopra 1) o attenua (sotto 1) i movimenti del suo mercato.'), 'b_r_misure'),
  G('orso', T('Mercato orso'), T('Un calo prolungato dei prezzi, di solito di almeno il 20% dai massimi.'), 'b_r_mercato'),
  G('liquidita_inv', T('Liquidità (di un investimento)'), T('Quanto facilmente si vende un investimento senza far scendere il prezzo.'), 'b_r_mercato'),
  // azioni
  G('azione', T('Azione'), T('Una quota della proprietà di un\'azienda: dà diritto a una parte degli utili e delle decisioni.'), 'b_sb_azione'),
  G('capitalizzazione', T('Capitalizzazione di mercato'), T('Prezzo dell\'azione per numero di azioni: quanto vale in borsa l\'intera azienda.'), 'b_sb_cap'),
  G('flottante', T('Flottante'), T('La parte delle azioni di una società che si scambia liberamente in borsa.'), 'b_sb_cap'),
  G('split', T('Frazionamento (split)'), T('Ogni azione viene divisa in più azioni a prezzo più basso: il valore totale non cambia.'), 'b_sb_cap'),
  G('ipo', T('IPO'), T('La prima offerta al pubblico delle azioni di un\'azienda che entra in borsa.'), 'b_sb_quotarsi'),
  G('indice', T('Indice azionario'), T('Un paniere di titoli che rappresenta l\'andamento di un mercato o di un settore.'), 'b_sb_quotarsi'),
  G('growth_value', T('Growth e value'), T('Growth: aziende che puntano a crescere in fretta. Value: aziende che sembrano economiche rispetto a utili o patrimonio.'), 'b_sb_stili'),
  // bilanci
  G('tre_prospetti', T('Prospetti di bilancio'), T('Conto economico (ricavi e costi), stato patrimoniale (cosa possiede e cosa deve) e rendiconto finanziario (la cassa).'), 'b_sbl_prospetti'),
  G('ricavi', T('Ricavi'), T('Il denaro incassato vendendo beni e servizi, prima di togliere i costi.'), 'b_sbl_conto'),
  G('margine_operativo', T('Margine operativo'), T('La parte dei ricavi che resta dopo i costi della gestione ordinaria.'), 'b_sbl_conto'),
  G('patrimonio_netto', T('Patrimonio netto'), T('Ciò che un\'azienda possiede meno ciò che deve: il valore contabile che spetta ai soci.'), 'b_sbl_debito'),
  G('flusso_cassa', T('Flusso di cassa operativo'), T('Il denaro che l\'attività ordinaria genera davvero, al di là degli utili contabili.'), 'b_sbl_cassa'),
  G('eps', T('Utile per azione (EPS)'), T('L\'utile netto diviso per il numero di azioni.'), 'b_sbl_pe'),
  G('pe', T('Rapporto prezzo/utili (P/E)'), T('Quante volte il prezzo di un\'azione contiene l\'utile annuo per azione.'), 'b_sbl_pe'),
  // dividendi
  G('dividendo', T('Dividendo'), T('La parte degli utili che un\'azienda distribuisce ai soci. Non è garantito.'), 'b_sd_cose'),
  G('dividend_yield', T('Rendimento da dividendo'), T('Il dividendo annuo in rapporto al prezzo attuale dell\'azione.'), 'b_sd_rendimento'),
  G('payout', T('Payout'), T('La parte degli utili pagata come dividendo.'), 'b_sd_payout'),
  G('buyback', T('Buyback'), T('L\'azienda ricompra le proprie azioni sul mercato.'), 'b_sd_payout'),
  G('rendimento_totale', T('Rendimento totale'), T('Variazione del prezzo più i dividendi ricevuti.'), 'b_sd_reinvest'),
  // ETF
  G('etf', T('ETF'), T('Un fondo quotato in borsa che di solito replica un indice: con una quota compri tutto il paniere.'), 'b_eb_cose'),
  G('ter', T('TER'), T('Il costo annuo di gestione di un fondo, in percentuale del patrimonio investito.'), 'b_eb_pro'),
  G('passiva', T('Gestione passiva'), T('Replicare un indice invece di cercare di batterlo.'), 'b_eb_passiva'),
  G('ucits', T('UCITS'), T('Le regole europee di tutela per i fondi venduti al pubblico.'), 'b_eb_scheda'),
  G('replica_fisica', T('Replica fisica e sintetica'), T('Fisica: il fondo compra i titoli dell\'indice. Sintetica: ne ottiene il rendimento con un contratto swap.'), 'b_er_replica'),
  G('tracking', T('Tracking difference ed error'), T('Lo scarto tra il rendimento del fondo e quello dell\'indice (difference) e quanto varia nel tempo (error).'), 'b_er_tracking'),
  G('acc_dist', T('Accumulazione e distribuzione'), T('Il fondo reinveste i dividendi (accumulazione) oppure li versa a chi lo possiede (distribuzione).'), 'b_er_dividendi'),
  G('nav', T('NAV'), T('Il valore del patrimonio di un fondo per quota.'), 'b_er_dimensione'),
  // obbligazioni (percorso ETF)
  G('obbligazione', T('Obbligazione'), T('Un prestito a uno Stato o a un\'azienda, che paga interessi (cedole) e restituisce il capitale a scadenza.'), 'b_eo_cose'),
  G('duration', T('Duration'), T('Quanto il prezzo di un\'obbligazione reagisce ai tassi: più è lunga, più il prezzo si muove.'), 'b_eo_duration'),
  G('rating', T('Rating'), T('Il giudizio di un\'agenzia sulla capacità di chi emette un\'obbligazione di ripagare il debito.'), 'b_eo_credito'),
  // cripto
  G('blockchain', T('Blockchain'), T('Un registro condiviso tra molti computer, in cui i blocchi di operazioni si aggiungono uno dopo l\'altro.'), 'b_cb_blockchain'),
  G('token', T('Token'), T('La rappresentazione digitale di un valore o di un diritto su una blockchain.'), 'b_cb_token'),
  G('halving', T('Halving'), T('Il dimezzamento periodico dei nuovi bitcoin assegnati a chi convalida i blocchi.'), 'b_cb_bitcoin'),
  G('pos', T('Proof-of-stake'), T('Un modo di convalidare i blocchi in cui conta quanta moneta si mette in garanzia, non la potenza di calcolo.'), 'b_cb_consenso'),
  G('chiave_privata', T('Chiave privata'), T('La prova di possesso di una cripto: chi la conosce può spendere i fondi.'), 'b_cc_chiavi'),
  G('seed', T('Seed phrase'), T('Le 12 o 24 parole da cui nascono le chiavi di un wallet. Non va mai data a nessuno.'), 'b_cc_chiavi'),
  G('wallet', T('Wallet caldo e freddo'), T('Caldo: collegato a internet, comodo. Freddo: offline, più difficile da attaccare.'), 'b_cc_wallet'),
  G('stablecoin', T('Stablecoin'), T('Un token che cerca di mantenere un valore stabile, di solito agganciato a una valuta.'), 'b_cs_stable'),
  G('defi', T('DeFi'), T('Servizi finanziari gestiti da programmi su blockchain (smart contract), senza un intermediario.'), 'b_cs_defi'),
  G('rug_pull', T('Rug pull'), T('Una truffa in cui chi ha lanciato un progetto sparisce con i soldi raccolti.'), 'b_cs_truffe'),
  // misto
  G('classi', T('Classi di attivo'), T('Le grandi famiglie di investimenti: azioni, obbligazioni, liquidità, materie prime, cripto.'), 'b_mb_classi'),
  G('rischio_cambio', T('Rischio di cambio'), T('Il guadagno o la perdita che dipende da come si muove la valuta in cui è espresso un investimento.'), 'b_mb_insieme'),
  G('asset_allocation', T('Asset allocation'), T('Come si divide il capitale tra le classi di attivo: decide gran parte del rischio di un portafoglio.'), 'b_ma_cose'),
  G('core_satellite', T('Core-satellite'), T('Un nucleo stabile e diversificato più piccole parti con scelte più mirate.'), 'b_ma_strumenti'),
  G('deriva', T('Deriva del portafoglio'), T('I pesi che cambiano da soli perché le parti del portafoglio rendono in modo diverso.'), 'b_ma_deriva'),
  // ordini
  G('ordine_mercato', T('Ordine a mercato'), T('Eseguito subito al miglior prezzo disponibile: certo l\'acquisto, non il prezzo.'), 'b_o_tipi'),
  G('ordine_limite', T('Ordine limite'), T('Fissa il prezzo massimo per comprare o minimo per vendere: certo il prezzo, non l\'esecuzione.'), 'b_o_tipi'),
  G('ordine_stop', T('Ordine stop'), T('Resta in attesa finché il prezzo tocca una soglia, poi diventa un ordine a mercato.'), 'b_o_tipi'),
  G('spread', T('Spread denaro-lettera'), T('La distanza tra il prezzo migliore di chi compra e quello di chi vende.'), 'b_o_spread'),
  G('slippage', T('Slippage'), T('Lo scarto tra il prezzo atteso e quello a cui l\'ordine viene eseguito davvero.'), 'b_o_spread'),
  G('gap', T('Gap'), T('Un salto di prezzo tra una chiusura e l\'apertura successiva, senza scambi in mezzo.'), 'b_o_stoplimit'),
  G('scoperto', T('Vendita allo scoperto'), T('Vendere un titolo preso in prestito per ricomprarlo più tardi: la perdita possibile non ha un tetto.'), 'b_o_short'),
  // diversificazione
  G('diversificare', T('Diversificazione'), T('Distribuire il capitale su investimenti diversi e poco legati tra loro.'), 'b_d_cose'),
  G('correlazione', T('Correlazione'), T('Quanto due investimenti si muovono insieme, da −1 (opposti) a +1 (uguali).'), 'b_d_corr'),
  G('ribilanciamento', T('Ribilanciamento'), T('Riportare i pesi del portafoglio all\'obiettivo deciso, quando il mercato li ha spostati.'), 'b_d_ribil'),
  G('sovrapposizione', T('Sovrapposizione'), T('Lo stesso titolo presente in più fondi del portafoglio: pesa più di quanto sembra.'), 'b_d_alloc'),
  // costi
  G('composto', T('Interesse composto'), T('Gli interessi producono altri interessi: la crescita accelera con il tempo.'), 'b_c_composto'),
  G('regola72', T('Regola del 72'), T('Un modo rapido per stimare in quanti anni un capitale raddoppia a un certo rendimento.'), 'b_c_composto'),
  G('pac', T('Piano di accumulo (PAC)'), T('Investire una cifra fissa a intervalli regolari, qualunque sia il prezzo.'), 'b_c_pac'),
  G('rendimento_reale', T('Rendimento reale'), T('Il rendimento dopo aver tolto l\'inflazione: dice quanto cresce davvero il potere d\'acquisto.'), 'b_c_inflazione'),
  G('inflazione', T('Inflazione'), T('L\'aumento generale dei prezzi: con lo stesso denaro si compra meno.'), 'b_c_inflazione'),
  // bias
  G('avversione_perdite', T('Avversione alle perdite'), T('Una perdita pesa più di un guadagno della stessa grandezza: porta a tenere troppo a lungo i titoli in perdita.'), 'b_bi_perdite'),
  G('fomo', T('FOMO'), T('La paura di restare fuori da un rialzo, che spinge a comprare tardi e in fretta.'), 'b_bi_folla'),
  G('gregge', T('Effetto gregge'), T('Fare ciò che fanno tutti, perché lo fanno tutti.'), 'b_bi_folla'),
  G('eccesso_fiducia', T('Eccesso di fiducia'), T('Sopravvalutare le proprie capacità e informazioni.'), 'b_bi_fiducia'),
  G('ancoraggio', T('Ancoraggio'), T('Restare legati a un numero di riferimento, come il prezzo pagato, più che alle informazioni nuove.'), 'b_bi_fiducia'),
  G('conferma', T('Bias di conferma'), T('Cercare solo le notizie che danno ragione a ciò che già pensi.'), 'b_bi_conferma'),
  G('fallacia', T('Fallacia del giocatore'), T('Credere che dopo una serie di risultati uguali il contrario sia «dovuto».'), 'b_bi_probabilita'),
  // gestione
  G('position_sizing', T('Position sizing'), T('Decidere quanto capitale mettere in ogni operazione, partendo da quanto si accetta di perdere.'), 'b_g_quanto'),
  G('stop_loss', T('Stop loss'), T('Un ordine che vende se il prezzo scende fino a una soglia decisa prima.'), 'b_g_stop'),
  G('trailing', T('Trailing stop'), T('Uno stop che segue il prezzo quando sale e resta fermo quando scende.'), 'b_g_stop'),
  G('leva', T('Leva'), T('Investire con denaro preso in prestito: moltiplica guadagni e perdite.'), 'b_g_leva'),
  G('margin_call', T('Margin call'), T('La richiesta di rimettere denaro quando le perdite con la leva scendono sotto il margine minimo.'), 'b_g_leva'),
  G('fondo_emergenza', T('Fondo di emergenza'), T('Liquidità messa da parte per gli imprevisti, separata dagli investimenti.'), 'b_g_emergenza'),
  G('aspettativa', T('Aspettativa'), T('Il risultato medio per operazione di una strategia, tenendo conto di quanto spesso vince e quanto vince o perde.'), 'b_g_aspettativa'),
  // macro
  G('pil', T('PIL'), T('Il valore dei beni e servizi prodotti da un Paese in un periodo.'), 'b_m_pil'),
  G('banca_centrale', T('Banca centrale'), T('L\'istituzione che decide i tassi ufficiali e cerca di tenere stabili i prezzi.'), 'b_m_bc'),
  G('qe', T('Quantitative easing'), T('Acquisti di titoli da parte della banca centrale per abbassare i tassi a lunga scadenza.'), 'b_m_bc'),
  G('curva_rendimenti', T('Curva dei rendimenti'), T('I tassi per ogni scadenza. Invertita quando i tassi brevi superano quelli lunghi.'), 'b_m_obb'),
  G('stagflazione', T('Stagflazione'), T('Economia ferma e prezzi in salita nello stesso momento.'), 'b_m_inflazione'),
  // analisi
  G('fondamentale', T('Analisi fondamentale'), T('Studiare conti, attività e prospettive di un\'azienda per stimarne il valore.'), 'b_a_lenti'),
  G('tecnica', T('Analisi tecnica'), T('Studiare prezzi e volumi passati per leggere tendenze e livelli.'), 'b_a_lenti'),
  G('media_mobile', T('Media mobile'), T('La media dei prezzi degli ultimi giorni, aggiornata ogni giorno: smussa le oscillazioni.'), 'b_a_tecnica'),
  G('rsi', T('RSI'), T('Un indicatore che misura la forza dei rialzi recenti rispetto ai ribassi, da 0 a 100.'), 'b_a_indicatori'),
  G('backtest', T('Backtest'), T('Provare una strategia sui dati del passato. Rischia l\'overfitting: regole cucite su misura del passato.'), 'b_a_backtest'),
  // regole
  G('ponzi', T('Schema Ponzi'), T('Una truffa che paga i vecchi investitori con i soldi dei nuovi, finché i nuovi finiscono.'), 'b_rg_ponzi'),
  G('pump_dump', T('Pump and dump'), T('Gonfiare il prezzo di un titolo con notizie false per vendere a chi arriva dopo.'), 'b_rg_ponzi'),
  G('phishing', T('Phishing'), T('Messaggi o siti falsi che imitano quelli veri per rubare password e dati.'), 'b_rg_phishing'),
  G('kid', T('KID'), T('Il documento breve con le informazioni chiave di un prodotto d\'investimento: rischi, costi, scenari.'), 'b_rg_kid'),
  G('insider', T('Insider trading'), T('Operare usando informazioni riservate non ancora pubbliche: è vietato.'), 'b_rg_abusi'),
  // finanza personale
  G('budget', T('Budget'), T('Il piano che, prima del mese, divide le entrate tra spese, risparmio e imprevisti.'), 'b_p_budget'),
  G('paga_prima', T('Paga prima te stesso'), T('Mettere da parte il risparmio appena arrivano le entrate, invece di risparmiare ciò che avanza.'), 'b_p_budget'),
  G('smart', T('Obiettivo SMART'), T('Un obiettivo specifico, misurabile, raggiungibile, rilevante e con una scadenza.'), 'b_p_budget'),
  G('fondo_emergenza_p', T('Fondo di emergenza'), T('Liquidità tenuta da parte per gli imprevisti, disponibile in fretta e senza rischio di perdite.'), 'b_p_emergenza'),
  G('taeg', T('TAEG'), T('Il costo totale annuo di un prestito, interessi e spese obbligatorie compresi (in inglese APR).'), 'b_p_debito'),
  G('revolving', T('Credito revolving'), T('Una carta che si ripaga a piccole rate mentre il saldo residuo matura interessi alti.'), 'b_p_debito'),
  G('debito_buono', T('Debito buono e cattivo'), T('Il primo finanzia qualcosa che può rendere nel tempo, il secondo consumi che perdono valore.'), 'b_p_buono'),
  G('stile_vita', T('Inflazione dello stile di vita'), T('Spese che salgono insieme al reddito, lasciando fermo il risparmio.'), 'b_p_abitudini'),
  // obbligazioni e tassi
  G('obbligazione_t', T('Obbligazione'), T('Un prestito a uno Stato o a un\'azienda, che paga interessi e rimborsa il capitale a scadenza.'), 'b_t_obbligazione'),
  G('cedola', T('Cedola'), T('L\'interesse che un\'obbligazione paga a intervalli fissi.'), 'b_t_obbligazione'),
  G('valore_nominale', T('Valore nominale'), T('Il capitale che l\'emittente restituisce alla scadenza dell\'obbligazione.'), 'b_t_obbligazione'),
  G('zero_coupon', T('Zero coupon'), T('Un\'obbligazione senza cedole, comprata sotto il valore nominale.'), 'b_t_obbligazione'),
  G('duration_t', T('Duration'), T('Quanto il prezzo di un\'obbligazione reagisce a un cambio dei tassi.'), 'b_t_prezzo'),
  G('rating_t', T('Rating'), T('Il giudizio sulla solidità di chi emette un\'obbligazione: più è basso, più è alto il rischio di non essere ripagati.'), 'b_t_credito'),
  G('high_yield', T('High yield'), T('Obbligazioni con rating basso che pagano di più per il rischio maggiore.'), 'b_t_credito'),
  G('ytm', T('Rendimento a scadenza'), T('Il rendimento annuo atteso tenendo un\'obbligazione fino alla fine, tra prezzo, cedole e rimborso.'), 'b_t_rendimento'),
  G('tasso_reale', T('Tasso reale'), T('Il tasso nominale meno l\'inflazione: la crescita vera del potere d\'acquisto.'), 'b_t_rendimento'),
  G('curva_invertita', T('Curva invertita'), T('Quando i tassi a breve superano quelli a lunga: il mercato si aspetta tassi più bassi in futuro.'), 'b_t_banche'),
  // Accademia: derivati e opzioni
  G('derivato', T('Derivato'), T('Un contratto il cui valore dipende da un altro bene, il sottostante.'), 'b_dv_cose'),
  G('future', T('Future'), T('Un contratto che obbliga entrambe le parti a comprare o vendere a un prezzo e a una data fissati.'), 'b_dv_cose'),
  G('call', T('Opzione call'), T('Il diritto, non l\'obbligo, di comprare il sottostante allo strike entro la scadenza.'), 'b_dv_opzioni'),
  G('put', T('Opzione put'), T('Il diritto, non l\'obbligo, di vendere il sottostante allo strike entro la scadenza.'), 'b_dv_opzioni'),
  G('strike', T('Strike'), T('Il prezzo di esercizio fissato nel contratto di un\'opzione.'), 'b_dv_opzioni'),
  G('premio_opz', T('Premio'), T('Il prezzo di un\'opzione: chi la compra lo paga, chi la vende lo incassa.'), 'b_dv_opzioni'),
  G('valore_tempo', T('Valore del tempo'), T('La parte del premio che si consuma avvicinandosi alla scadenza.'), 'b_dv_valore'),
  G('vol_implicita', T('Volatilità implicita'), T('L\'oscillazione futura che il mercato mette nel prezzo di un\'opzione.'), 'b_dv_valore'),
  G('hedging', T('Copertura (hedging)'), T('Usare un derivato per ridurre il rischio di una posizione che hai già.'), 'b_dv_leva'),
  // Accademia: come funziona il mercato
  G('order_book', T('Libro degli ordini'), T('L\'elenco degli ordini di acquisto e di vendita in attesa, prezzo per prezzo.'), 'b_mk_libro'),
  G('asta', T('Asta di apertura'), T('La fase in cui la borsa raccoglie gli ordini e fissa un unico prezzo di inizio.'), 'b_mk_libro'),
  G('impatto', T('Costo di impatto'), T('Il movimento di prezzo causato dal tuo stesso ordine.'), 'b_mk_libro'),
  G('market_maker', T('Market maker'), T('Chi propone di continuo prezzi di acquisto e di vendita e guadagna sullo spread.'), 'b_mk_maker'),
  G('liquidita_mk', T('Liquidità di un titolo'), T('Quanto puoi comprare o vendere senza spostare molto il prezzo.'), 'b_mk_maker'),
  G('circuit', T('Circuit breaker'), T('Lo stop temporaneo agli scambi dopo movimenti di prezzo troppo forti.'), 'b_mk_orari'),
  G('short', T('Vendita allo scoperto'), T('Vendere un titolo preso in prestito per ricomprarlo dopo: la perdita possibile non ha un tetto.'), 'b_mk_scoperto'),
  G('squeeze', T('Short squeeze'), T('Un rialzo rapido che costringe chi è allo scoperto a ricomprare, spingendo ancora su il prezzo.'), 'b_mk_scoperto'),
  // Accademia: il mestiere del trader
  G('rischio_op', T('Rischio per operazione'), T('Quanto perdi se scatta lo stop, come parte del capitale.'), 'b_tr_rischio'),
  G('rr_trader', T('Rapporto rischio/rendimento'), T('Il confronto tra la perdita fino allo stop e il guadagno fino all\'obiettivo.'), 'b_tr_rischio'),
  G('win_rate', T('Win rate'), T('La quota di operazioni chiuse in guadagno sul totale.'), 'b_tr_aspettativa'),
  G('aspettativa_tr', T('Aspettativa'), T('Il risultato medio per operazione, tra vincite, perdite e costi.'), 'b_tr_aspettativa'),
  G('overtrading', T('Overtrading'), T('Fare troppe operazioni, spesso per noia o per recuperare.'), 'b_tr_disciplina'),
  G('revenge', T('Revenge trading'), T('Aprire subito un\'altra operazione per rifarsi di una perdita.'), 'b_tr_disciplina'),
  G('diario', T('Diario di trading'), T('Il quaderno in cui annoti il motivo e l\'esito di ogni operazione, per trovare gli errori che si ripetono.'), 'b_tr_disciplina'),
];

export const TERM_BY_ID: Record<string, Term> = Object.fromEntries(GLOSSARY.map((t) => [t.id, t]));

/** Termini sbloccati: quelli dei libri già letti. */
export function knownTerms(): Term[] {
  return GLOSSARY.filter((t) => S.booksRead.includes(t.book));
}
