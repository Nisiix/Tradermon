import type { RealWindow } from '../systems/realdata';
import type { Track, RiskProfile } from '../types';
import { T } from '../i18n';

export interface SimResult {
  values: number[];
  ret: number;
  vol: number;
  sharpe: number;
  mdd: number;
  orders: number;
  limitFills: number;
  monthlyBuys: number;
  fees: number;
  contributed: number;
  lossSales: number;
  sectors: number;
  /** Settori disponibili tra gli asset del replay: un percorso con due soli settori non può averne tre. */
  sectorsAvail: number;
  maxW: number;
  investedW: number;
  finalValue: number;
  startValue: number;
  dripShareGrowth: number;
}

/**
 * Replay storico: un periodo REALE di mercato, scaricato da Alpaca con le chiavi del giocatore.
 * Durante il replay nomi, date e prezzi sono nascosti (prezzi a base 100): si giudica il metodo, non la memoria.
 * Le notizie sono scritte a mano, generiche, e compaiono nel giorno vero dell'evento.
 */
export interface Replay {
  id: string;
  name: string;
  desc: string;
  window: RealWindow;
  news?: { date: string; text: string }[];
  /** Riferimento storico mostrato quando il periodo è dichiarato (crisi leggendarie). */
  historical?: string;
  /** Versamento periodico (ogni 21 giorni di mercato). */
  monthly?: number;
}

export interface SimMission {
  kind: 'sim';
  id: string;
  title: string;
  brief: string;
  scenario: Replay;
  capital?: number;
  monthly?: number; // versamento mensile nella missione
  dividends?: boolean;
  check: (r: SimResult) => { ok: boolean; detail: string };
}

export interface PickOption { title: string; lines: string[]; correct: boolean; why: string }
export interface PickMission { kind: 'pick'; id: string; title: string; brief: string; rounds: { prompt: string; options: PickOption[] }[]; need: number }

export type Mission = SimMission | PickMission;

const pct = (x: number) => (x * 100).toFixed(1) + '%';

/** Limite di drawdown della missione: uguale per tutti i profili (il profilo non è una leva di gioco). */
function ddAllow(base: number, _profile?: RiskProfile): number {
  return base;
}

/**
 * Giudizio sul processo, oltre all'obiettivo: come hai investito, non solo quanto hai guadagnato.
 * Tre criteri, una stella ciascuno; le stelle danno Conoscenza extra e restano nella Cartella dello studente.
 */
export interface ProcessReview { stars: number; notes: { ok: boolean; text: string }[] }
export function processReview(r: SimResult): ProcessReview {
  const needSec = Math.min(2, r.sectorsAvail || 2);
  const notes = [
    { ok: r.maxW <= 0.4 && r.sectors >= needSec, text: r.maxW <= 0.4 && r.sectors >= needSec ? T('Nessuna posizione dominante e più settori: rischio specifico sotto controllo.') : T('Troppo concentrato: una posizione sopra il 40% o un solo settore.') },
    { ok: r.lossSales === 0, text: r.lossSales === 0 ? T('Nessuna vendita manuale in perdita: hai attraversato i cali senza panico (gli stop pianificati non contano).') : T`Vendite manuali in perdita: ${r.lossSales}. Vendere nel calo per paura trasforma un ribasso in una perdita vera; uno stop deciso prima è un'altra cosa.` },
    { ok: r.orders <= Math.ceil(r.values.length / 10) + 3, text: r.orders <= Math.ceil(r.values.length / 10) + 3 ? T('Poche operazioni, ben scelte: i costi sono rimasti bassi.') : T`Troppe operazioni (${r.orders}): ogni ordine costa e raramente aggiunge valore.` },
  ];
  return { stars: notes.filter((n) => n.ok).length, notes };
}

// I periodi sono scelti perché contengono davvero la lezione della tappa. Gli obiettivi premiano il metodo
// (quanto investi, quanto diversifichi, quante volte operi, se vendi nel panico) più del risultato: su dati
// reali il risultato non è garantito a nessuno. scripts/check-windows.mjs verifica i periodi con le tue chiavi.

export function mentorMission(n: number, track: Track, profile: RiskProfile): Mission {
  const crypto = track === 'crypto';
  switch (n) {
    case 1: return {
      kind: 'sim', id: 'm1', title: T('Il primo raccolto'),
      scenario: { id: 'm1', name: T('Un trimestre qualunque'), desc: '', window: { start: '2019-04-01', end: '2019-06-28', crypto: { start: '2023-01-02', end: '2023-03-31' } },
        news: [{ date: '2019-05-06', text: T('Tensioni commerciali: annunciate nuove tariffe, i listini aprono in rosso.') }, { date: '2023-03-10', text: T('Una banca legata alle aziende tecnologiche fallisce: giornata di paura sui mercati.') }] },
      brief: T('Tre mesi veri di mercato, con qualche giornata rossa nel mezzo. Investi almeno metà del capitale e arriva alla fine senza scendere sotto il 90% del capitale iniziale. Non serve fare tante operazioni.'),
      check: (r) => ({ ok: r.investedW >= 0.5 && r.finalValue >= r.startValue * 0.9, detail: T`Investito a fine periodo: ${pct(r.investedW)} (min 50%) · valore finale ${pct(r.finalValue / r.startValue)} del capitale (min 90%)` }) };
    case 2: return {
      kind: 'sim', id: 'm2', title: T('Ordini precisi'),
      scenario: { id: 'm2', name: T('Due mesi senza direzione'), desc: '', window: { start: '2023-08-01', end: '2023-09-29' },
        news: [{ date: '2023-08-02', text: T('Un\'agenzia taglia il giudizio sul debito pubblico: i listini arretrano.') }, { date: '2023-08-17', text: T('Vendite improvvise nella notte: le cripto perdono terreno in poche ore.') }] },
      brief: T('Il mercato oscilla e scivola un po\'. Piazza un ordine limite di acquisto sotto il prezzo attuale e fallo eseguire entro la fine del periodo.'),
      check: (r) => ({ ok: r.limitFills >= 1, detail: T`Ordini limite eseguiti: ${r.limitFills} (min 1)` }) };
    case 3: return {
      kind: 'sim', id: 'm3', title: T('Il mosaico'),
      scenario: { id: 'm3', name: T('Uno shock che divide i settori'), desc: '', window: { start: '2022-01-03', end: '2022-04-29' },
        news: [{ date: '2022-02-24', text: T('Scoppia una guerra: energia e oro salgono, quasi tutto il resto scende.') }] },
      brief: T('Prima o poi arriverà uno shock che colpisce i settori in modo diverso: non sai quando né quali. A fine periodo devi avere almeno 3 settori diversi (o tutti quelli del tuo percorso, se sono meno) e nessuna posizione sopra il 40% del portafoglio.'),
      check: (r) => { const need = Math.min(3, r.sectorsAvail); return { ok: r.sectors >= need && r.maxW <= 0.4, detail: T`Settori: ${r.sectors} (min ${need}) · peso massimo ${pct(r.maxW)} (max 40%)` }; } };
    case 4: return {
      kind: 'sim', id: 'm4', title: T('La spirale del tempo'), monthly: 300, capital: 1000,
      scenario: { id: 'm4', name: T('Due anni di accumulo'), desc: '', window: { start: '2021-07-01', end: '2023-06-30', crypto: { start: '2022-01-03', end: '2023-12-29' } } },
      brief: T('Due anni veri di mercato, con un lungo calo nel mezzo. Ogni mese ricevi 300 $: fai almeno 10 acquisti mensili (pulsante "Acquisto mensile" o ordini manuali) e non vendere mai in perdita. Chi continua a comprare nel calo compra a prezzi più bassi.'),
      check: (r) => ({ ok: r.monthlyBuys >= 10 && r.lossSales === 0, detail: T`Acquisti mensili: ${r.monthlyBuys} (min 10) · vendite in perdita: ${r.lossSales} (max 0)` }) };
    case 5: return pickMission(track);
    case 6: {
      if (track === 'listed') return {
        kind: 'sim', id: 'm6', title: T('Il raccolto dei dividendi'), dividends: true,
        scenario: { id: 'm6', name: T('Un anno tranquillo'), desc: '', window: { start: '2017-01-03', end: '2017-12-29' } },
        brief: T('Un anno vero di mercato tranquillo. I dividendi sono stimati dal rendimento medio di ogni titolo, pagati ogni mese e reinvestiti. Compra titoli con dividendo e tienili: le quote devono crescere almeno dell\'1,5% grazie al reinvestimento.'),
        check: (r) => ({ ok: r.dripShareGrowth >= 0.015, detail: T`Quote aggiunte con i dividendi: ${pct(r.dripShareGrowth)} (min 1,5%)` }) };
      const lim = crypto ? 0.2 : ddAllow(0.08, profile);
      return {
        kind: 'sim', id: 'm6', title: crypto ? T('L\'ancora che cede') : T('L\'onda dei tassi'),
        scenario: crypto
          ? { id: 'm6', name: T('Perdita di aggancio'), desc: '', window: { start: '2022-04-01', end: '2022-07-29' }, news: [{ date: '2022-05-09', text: T('Una stablecoin algoritmica perde l\'aggancio: panico su tutto il mercato cripto.') }, { date: '2022-06-13', text: T('Una piattaforma di prestiti cripto blocca i prelievi dei clienti.') }] }
          : { id: 'm6', name: T('Tassi in salita'), desc: '', window: { start: '2022-01-03', end: '2022-06-24', crypto: { start: '2022-01-03', end: '2022-06-24' } }, news: [{ date: '2022-03-16', text: T('La banca centrale alza i tassi per la prima volta dopo anni.') }, { date: '2022-05-04', text: T('Altro rialzo dei tassi, di mezzo punto.') }, { date: '2022-06-15', text: T('Rialzo dei tassi dello 0,75%: il più forte da decenni.') }] },
        brief: crypto ? T`Una stablecoin crolla e trascina il mercato. Mantieni il massimo drawdown del portafoglio sotto il ${pct(lim)}. La liquidità e la stablecoin con riserve sono tue alleate.` : T`I tassi salgono più volte. Mantieni il massimo drawdown del portafoglio sotto il ${pct(lim)}: anche le obbligazioni scendono quando i tassi salgono, quelle a breve molto meno.`,
        check: (r) => ({ ok: r.mdd <= lim && r.investedW > 0.2, detail: T`Max drawdown ${pct(r.mdd)} (max ${pct(lim)}) · investito ${pct(r.investedW)} (min 20%)` }) };
    }
    case 7: return {
      kind: 'sim', id: 'm7', title: T('Specchio, specchio'),
      scenario: { id: 'm7', name: T('Euforia e risveglio'), desc: '', window: { start: '2021-10-01', end: '2022-02-11', crypto: { start: '2024-02-01', end: '2024-06-28' } },
        news: [{ date: '2021-11-08', text: T('TUTTI COMPRANO! I titoli di moda segnano un record dopo l\'altro.') }, { date: '2021-11-19', text: T('«Non è mai troppo tardi per salire a bordo!», titolano i giornali.') }, { date: '2022-01-05', text: T('La banca centrale prepara i rialzi dei tassi: i titoli più cari scendono per primi.') },
          { date: '2024-03-05', text: T('NUOVO MASSIMO STORICO! Sui social non si parla d\'altro.') }, { date: '2024-03-13', text: T('«Chi non compra adesso resta fuori», dicono in tanti.') }, { date: '2024-04-13', text: T('Tensioni internazionali nel fine settimana: vendite a catena.') }] },
      brief: T('Titoli euforici e record ti tenteranno, poi arriverà il risveglio. Fai al massimo 6 ordini, resta investito almeno al 30% a fine periodo (restare fermi in liquidità non è una strategia) e non vendere mai in perdita per paura.'),
      check: (r) => ({ ok: r.orders >= 1 && r.orders <= 6 && r.investedW >= 0.3 && r.lossSales === 0, detail: T`Ordini: ${r.orders} (max 6) · investito a fine periodo ${pct(r.investedW)} (min 30%) · vendite in perdita: ${r.lossSales} (max 0)` }) };
    default: {
      const lim = crypto ? ddAllow(0.2, profile) : ddAllow(0.12, profile);
      return {
        kind: 'sim', id: 'm8', title: T('Lo scudo'),
        scenario: { id: 'm8', name: T('Crollo improvviso'), desc: '', window: { start: '2025-03-03', end: '2025-07-11', crypto: { start: '2024-07-15', end: '2024-10-31' } },
          news: [{ date: '2025-04-03', text: T('Annunciate barriere commerciali su quasi tutte le importazioni: l\'indice crolla in due sedute.') }, { date: '2025-04-09', text: T('Le misure vengono sospese: uno dei rimbalzi più forti di sempre.') }, { date: '2024-08-05', text: T('Lunedì nero sui mercati asiatici: vendite a catena, anche sulle cripto.') }] },
        brief: T`Arriverà un crollo improvviso, senza preavviso. Tieni il massimo drawdown sotto il ${pct(lim)}, restando investito almeno al 30% a fine periodo. Gli ordini stop e la diversificazione sono il tuo scudo.`,
        check: (r) => ({ ok: r.mdd <= lim && r.investedW >= 0.3, detail: T`Max drawdown ${pct(r.mdd)} (max ${pct(lim)}) · investito a fine periodo ${pct(r.investedW)} (min 30%)` }) };
    }
  }
}

function pickMission(track: Track): PickMission {
  if (track !== 'listed') return pickSet(track);
  // Azioni + ETF: due casi sui bilanci e due sui prospetti, come gli argomenti della Whale di Bilancia
  const st = pickSet('stocks'), ef = pickSet('etf');
  return { kind: 'pick', id: 'm5', title: T('Bilanci e prospetti'), need: 3, brief: T('Due aziende e due ETF da scegliere: leggi i numeri dei bilanci e dei prospetti prima di decidere.'), rounds: [...st.rounds.slice(0, 2), ...ef.rounds.slice(0, 2)] };
}

function pickSet(track: 'stocks' | 'etf' | 'crypto' | 'mixed'): PickMission {
  if (track === 'etf') return { kind: 'pick', id: 'm5', title: T('Il prospetto'), need: 2, brief: T('Tre ETF sembrano gemelli. Leggi i prospetti e scegli il più efficiente.'), rounds: [
    { prompt: T('Tre ETF sullo stesso indice azionario globale. Quale scegli per 20 anni di accumulo?'), options: [
      { title: T('ETF Alfa'), lines: ['TER 0,65%', T('Tracking error 0,9%'), T('Patrimonio 80 mln')], correct: false, why: T('Costi alti e replica meno fedele.') },
      { title: T('ETF Beta'), lines: ['TER 0,12%', T('Tracking error 0,1%'), T('Patrimonio 6 mld')], correct: true, why: T('Costi bassi, replica fedele, grande e liquido.') },
      { title: T('ETF Gamma'), lines: ['TER 0,20%', T('Tracking error 0,4%'), T('Patrimonio 15 mln (rischio chiusura)')], correct: false, why: T('Troppo piccolo: rischio di chiusura e spread più alti.') } ] },
    { prompt: T('Quale ETF è davvero diversificato?'), options: [
      { title: T('Tecno Settore'), lines: [T('Solo tecnologia'), '60 aziende'], correct: false, why: T('Un solo settore: concentrato.') },
      { title: T('Globo Mondo'), lines: ['1.500 aziende', '23 Paesi', '11 settori'], correct: true, why: T('Diversificazione per Paese e settore.') },
      { title: T('Leva 3x Indice'), lines: [T('3 volte il rendimento giornaliero'), T('Ricalcolo quotidiano')], correct: false, why: T('Strumento a leva per esperti, non diversificazione.') } ] },
    { prompt: T('Un ETF obbligazionario per chi teme i rialzi dei tassi:'), options: [
      { title: 'Duration 2', lines: [T('Titoli di Stato a breve')], correct: true, why: T('Bassa duration = poca sensibilità ai tassi.') },
      { title: 'Duration 18', lines: [T('Titoli a 30 anni')], correct: false, why: T('Con tassi +1% perderebbe circa il 18%.') },
      { title: T('High yield'), lines: [T('Rating CCC')], correct: false, why: T('Rischio di credito elevato.') } ] } ] };
  if (track === 'crypto') return { kind: 'pick', id: 'm5', title: T('Il progetto truffa'), need: 2, brief: T('Riconosci i progetti pericolosi e le pratiche di custodia corrette.'), rounds: [
    { prompt: T('Quale di questi progetti è quasi certamente una truffa?'), options: [
      { title: T('Progetto Rete'), lines: [T('Team pubblico'), T('Codice aperto e verificato'), T('Nessun rendimento promesso')], correct: false, why: T('Trasparente: non garantisce successo, ma non ha segnali di truffa.') },
      { title: T('Progetto LunaX'), lines: [T('Team anonimo'), T('1.000% annuo garantito'), T('Liquidità non bloccata'), T('"Compra entro stasera"')], correct: true, why: T('Tutti i segnali di un rug pull.') },
      { title: T('Progetto Ponte'), lines: [T('Audit pubblicato'), T('Rischi elencati nel documento')], correct: false, why: T('Dichiara i rischi: buon segnale.') } ] },
    { prompt: T('Dove conservi la seed phrase?'), options: [
      { title: T('In una foto sul telefono'), lines: [T('Sincronizzata nel cloud')], correct: false, why: T('Se il cloud viene violato, perdi tutto.') },
      { title: T('Su carta, offline, in un luogo sicuro'), lines: [T('Mai digitata online')], correct: true, why: T('Offline e privata: la scelta corretta.') },
      { title: T('La invio al supporto'), lines: [T('Per sicurezza')], correct: false, why: T('Nessun supporto legittimo la chiede.') } ] },
    { prompt: T('Quale stablecoin è più solida?'), options: [
      { title: T('Algoritmica'), lines: [T('Nessuna riserva'), 'Rendimento 20%'], correct: false, why: T('Senza riserve l\'aggancio può crollare.') },
      { title: T('Con riserve verificate'), lines: [T('Titoli di Stato a breve'), T('Attestazioni mensili')], correct: true, why: T('Riserve trasparenti e verificate.') },
      { title: T('Anonima'), lines: [T('Emittente sconosciuto')], correct: false, why: T('Non sai chi deve rimborsarti.') } ] } ] };
  if (track === 'mixed') return { kind: 'pick', id: 'm5', title: T('Le proporzioni'), need: 2, brief: T('Scegli le allocazioni coerenti con il profilo dell\'investitore.'), rounds: [
    { prompt: T('Lucia, 30 anni, orizzonte 25 anni, tollera bene le oscillazioni:'), options: [
      { title: T('80% azioni, 15% obbligazioni, 5% liquidità'), lines: [], correct: true, why: T('Orizzonte lungo e tolleranza alta.') },
      { title: '100% cripto', lines: [], correct: false, why: T('Nessuna diversificazione, rischio estremo.') },
      { title: T('100% liquidità'), lines: [], correct: false, why: T('L\'inflazione eroderebbe il capitale in 25 anni.') } ] },
    { prompt: T('Marco deve comprare casa tra 2 anni:'), options: [
      { title: T('90% azioni tecnologiche'), lines: [], correct: false, why: T('Orizzonte troppo breve per tanto rischio.') },
      { title: T('20% azioni, 60% obbligazioni a breve, 20% liquidità'), lines: [], correct: true, why: T('Poco tempo, poco rischio.') },
      { title: '50% cripto', lines: [], correct: false, why: T('Volatilità incompatibile con l\'obiettivo.') } ] },
    { prompt: T('Un portafoglio 60/40 è diventato 75/25 dopo un rialzo. Cosa fai?'), options: [
      { title: T('Ribilancio verso 60/40'), lines: [], correct: true, why: T('Torna al rischio scelto.') },
      { title: T('Compro altre azioni'), lines: [], correct: false, why: T('Aumenteresti ancora il rischio.') },
      { title: T('Vendo tutto'), lines: [], correct: false, why: T('Reazione eccessiva.') } ] } ] };
  return { kind: 'pick', id: 'm5', title: T('Il bilancio nascosto'), need: 2, brief: T('Leggi i numeri e scegli l\'azienda con i fondamentali più solidi.'), rounds: [
    { prompt: T('Tre aziende dello stesso settore. Quale ha i fondamentali più solidi?'), options: [
      { title: T('Alfa Spa'), lines: ['Ricavi +8%', T('Utile netto in crescita'), 'P/E 14', T('Debito/patrimonio 0,4')], correct: true, why: T('Crescita sostenibile, prezzo ragionevole, poco debito.') },
      { title: T('Beta Spa'), lines: ['Ricavi +40%', T('In perdita da 5 anni'), T('Debito/patrimonio 3,5')], correct: false, why: T('Cresce bruciando cassa e indebitandosi.') },
      { title: T('Gamma Spa'), lines: ['Ricavi −10%', 'P/E 60', T('Dividendo 9% (payout 150%)')], correct: false, why: T('Dividendo insostenibile e prezzo caro.') } ] },
    { prompt: T('Il P/E di un\'azione è 40, quello medio del suo settore è 15. Cosa indica?'), options: [
      { title: T('Attese di crescita alte, o un titolo caro'), lines: [], correct: true, why: T('Paghi molti dollari per ogni dollaro di utile: serve una crescita futura che lo giustifichi.') },
      { title: T('Un titolo economico'), lines: [], correct: false, why: T('Un P/E più alto della media significa che il titolo costa di più rispetto agli utili.') },
      { title: T('Un\'azienda in perdita'), lines: [], correct: false, why: T('Con utili negativi il P/E non ha senso: qui gli utili ci sono.') } ] },
    { prompt: T('Utili in crescita ma flusso di cassa negativo da 3 anni. Cosa fai?'), options: [
      { title: T('Approfondisco: gli utili non diventano cassa'), lines: [], correct: true, why: T('Divergenza da indagare.') },
      { title: T('Compro subito'), lines: [], correct: false, why: T('Ignori un segnale importante.') },
      { title: T('Guardo solo il grafico'), lines: [], correct: false, why: T('Il grafico non mostra la cassa.') } ] } ] };
}

export function leagueMission(i: number): Mission {
  switch (i) {
    case 0: return { kind: 'sim', id: 'l1', title: T('Il ciclo dei tassi'),
      scenario: { id: 'l1', name: T('Ciclo dei tassi'), desc: '', window: { start: '2023-07-03', end: '2024-03-28' }, news: [{ date: '2023-10-19', text: T('I rendimenti dei titoli di Stato toccano i massimi da sedici anni.') }, { date: '2023-12-13', text: T('La banca centrale lascia intendere che i tagli dei tassi sono vicini.') }] },
      brief: T('Nove mesi veri: i tassi salgono ancora, poi il vento gira. Ottieni un indice di Sharpe di almeno 0,3.'), check: (r) => ({ ok: r.sharpe >= 0.3, detail: T`Sharpe ${r.sharpe.toFixed(2)} (min 0,30)` }) };
    case 1: return { kind: 'sim', id: 'l2', title: T('Trend e inversioni'),
      scenario: { id: 'l2', name: T('Trend e inversioni'), desc: '', window: { start: '2020-01-02', end: '2020-06-30', crypto: { start: '2023-06-01', end: '2023-11-30' } }, news: [{ date: '2020-02-24', text: T('Un\'epidemia si diffonde oltre il Paese d\'origine: i mercati iniziano a scendere.') }, { date: '2020-03-23', text: T('Le banche centrali annunciano acquisti senza limiti.') }] },
      brief: T('Tendenze che si invertono in fretta. Chiudi con rendimento positivo e drawdown massimo entro il 15%.'), check: (r) => ({ ok: r.ret > 0 && r.mdd <= 0.15, detail: T`Rendimento ${pct(r.ret)} (> 0) · max drawdown ${pct(r.mdd)} (max 15%)` }) };
    case 2: return { kind: 'pick', id: 'l3', title: T('Lo sportello delle offerte'), need: 3, brief: T('Giulia Garante ti mostra offerte reali e truffe. Distinguile.'), rounds: [
      { prompt: T('Quale offerta è una truffa?'), options: [
        { title: T('Conto deposito'), lines: [T('Banca autorizzata'), 'Tasso 3%', T('Garanzia depositi fino a 100.000')], correct: false, why: T('Offerta regolare.') },
        { title: T('"Trading robot"'), lines: [T('Guadagni del 5% al giorno'), T('Sito non autorizzato'), T('Pagamento in cripto')], correct: true, why: T('Rendimenti impossibili e operatore abusivo.') },
        { title: T('ETF a indice'), lines: [T('KID disponibile'), 'TER 0,2%'], correct: false, why: T('Prodotto trasparente.') } ] },
      { prompt: T('Quale messaggio è phishing?'), options: [
        { title: T('Email dal broker'), lines: [T('"Accedi qui per evitare il blocco del conto"'), T('Link a brok3r-login.xyz')], correct: true, why: T('Dominio falso e urgenza.') },
        { title: T('Estratto conto'), lines: [T('Disponibile nell\'area riservata'), T('Nessun link')], correct: false, why: T('Comunicazione regolare.') },
        { title: T('Newsletter'), lines: [T('Notizie di mercato'), T('Nessuna richiesta di dati')], correct: false, why: T('Innocua.') } ] },
      { prompt: T('Quale proposta è uno schema Ponzi?'), options: [
        { title: T('Club "Moltiplica"'), lines: [T('10% al mese costante'), T('Bonus se porti amici')], correct: true, why: T('Rendimenti costanti e reclutamento: classico Ponzi.') },
        { title: T('Fondo pensione'), lines: [T('Rendimenti variabili'), T('Vigilato')], correct: false, why: T('Prodotto regolato.') },
        { title: T('Titolo di Stato'), lines: ['Cedola 3,5%', T('Scadenza 10 anni')], correct: false, why: T('Obbligazione pubblica.') } ] } ] };
    case 3: return { kind: 'sim', id: 'l4', title: T('Mente fredda'),
      scenario: { id: 'l4', name: T('Notizie tentatrici'), desc: '', window: { start: '2021-01-04', end: '2021-06-30', crypto: { start: '2024-10-01', end: '2025-03-31' } }, news: [{ date: '2021-01-27', text: T('Tutti parlano di un titolo raddoppiato in un giorno grazie ai forum!') }, { date: '2021-02-02', text: T('Le mode passano: il titolo del momento si dimezza.') }, { date: '2021-05-12', text: T('Paura dell\'inflazione: giornata nera.') }, { date: '2024-11-11', text: T('Record dopo record: «stavolta è diverso», scrivono tutti.') }, { date: '2025-02-03', text: T('Panico nel fine settimana: vendite ovunque.') }] },
      brief: T('Il mercato ti provoca con mode e spaventi. Al massimo 8 ordini e Sharpe di almeno 0,2.'), check: (r) => ({ ok: r.orders >= 1 && r.orders <= 8 && r.sharpe >= 0.2, detail: T`Ordini ${r.orders} (max 8) · Sharpe ${r.sharpe.toFixed(2)} (min 0,20)` }) };
    default: return { kind: 'sim', id: 'l5', title: T('La prova del Campione'),
      scenario: { id: 'l5', name: T('Crollo e ripresa'), desc: '', window: { start: '2020-01-02', end: '2020-12-31', crypto: { start: '2024-03-01', end: '2025-02-28' } }, news: [{ date: '2020-02-24', text: T('Inizia la crisi.') }] },
      brief: T('Un anno vero con un crollo e una ripresa. Sharpe ≥ 0,4, drawdown ≤ 18% e almeno 3 settori a fine anno (o tutti quelli del tuo percorso).'),
      check: (r) => { const need = Math.min(3, r.sectorsAvail); return { ok: r.sharpe >= 0.4 && r.mdd <= 0.18 && r.sectors >= need, detail: T`Sharpe ${r.sharpe.toFixed(2)} (min 0,40) · max drawdown ${pct(r.mdd)} (max 18%) · settori ${r.sectors} (min ${need})` }; } };
  }
}

/**
 * Crisi leggendarie: periodi reali dal 2016 in poi (lo storico di Alpaca non va più indietro), con tutte le classi
 * di attivo. Il periodo qui è dichiarato: sono i nomi dei titoli a restare nascosti fino alla fine.
 * Le crisi del 1929, 2000 e 2008 restano raccontate nell'Archivio (HISTORY), senza replay.
 */
export const LEGENDS: SimMission[] = [
  { kind: 'sim', id: 'leg2018', title: T('Il Natale nero (2018)'), brief: T('Tra ottobre e dicembre l\'indice perde quasi il 20%, poi recupera in quattro mesi. Tieni il massimo drawdown entro il 15% restando investito almeno al 40%.'),
    scenario: { id: 'leg2018', name: '2018', desc: '', historical: T('S&P 500 set.-dic. 2018: circa −20%'), window: { start: '2018-09-04', end: '2019-04-30' }, news: [{ date: '2018-10-10', text: T('I tassi salgono e la tecnologia scivola: la peggior seduta da mesi.') }, { date: '2018-12-24', text: T('Vigilia di Natale in profondo rosso.') }, { date: '2019-01-04', text: T('La banca centrale promette pazienza: i listini rimbalzano.') }] },
    check: (r) => ({ ok: r.mdd <= 0.15 && r.investedW >= 0.4, detail: T`Max drawdown ${pct(r.mdd)} (max 15%) · investito ${pct(r.investedW)} (min 40%)` }) },
  { kind: 'sim', id: 'leg2020', title: T('Il crollo lampo (2020)'), brief: T('−34% in 23 sedute, poi una ripresa veloce. Resta investito almeno al 50% e chiudi in positivo.'),
    scenario: { id: 'leg2020', name: '2020', desc: '', historical: T('S&P 500 feb.-mar. 2020: circa −34%'), window: { start: '2020-02-03', end: '2020-11-30' }, news: [{ date: '2020-02-24', text: T('Una pandemia blocca il mondo.') }, { date: '2020-03-23', text: T('Le banche centrali annunciano acquisti senza limiti.') }] },
    check: (r) => ({ ok: r.investedW >= 0.5 && r.ret > 0, detail: T`Investito ${pct(r.investedW)} (min 50%) · rendimento ${pct(r.ret)} (> 0)` }) },
  { kind: 'sim', id: 'leg2022r', title: T('L\'anno dei tassi (2022)'), brief: T('Azioni e obbligazioni scendono insieme: la difesa classica non basta. Chiudi con almeno l\'85% del capitale restando investito almeno al 50%.'),
    scenario: { id: 'leg2022r', name: '2022 tassi', desc: '', historical: T('S&P 500 gen.-ott. 2022: circa −25%; obbligazioni a lunga scadenza: circa −15%'), window: { start: '2022-01-03', end: '2022-10-31' }, news: [{ date: '2022-03-16', text: T('Primo rialzo dei tassi dopo anni.') }, { date: '2022-06-15', text: T('Rialzo dello 0,75%: il più forte da decenni.') }, { date: '2022-09-13', text: T('L\'inflazione non scende: giornata nera.') }] },
    check: (r) => ({ ok: r.finalValue >= r.startValue * 0.85 && r.investedW >= 0.5, detail: T`Valore finale ${pct(r.finalValue / r.startValue)} (min 85%) · investito ${pct(r.investedW)} (min 50%)` }) },
  { kind: 'sim', id: 'leg2022', title: T('L\'inverno cripto (2022)'), brief: T('Le cripto perdono circa il 75% e le obbligazioni il 15%. Chiudi con almeno l\'80% del capitale.'),
    scenario: { id: 'leg2022', name: '2022 cripto', desc: '', historical: T('Bitcoin nov. 2021 - nov. 2022: circa −77%'), window: { start: '2021-11-01', end: '2022-11-30' }, news: [{ date: '2022-05-09', text: T('Una stablecoin algoritmica crolla.') }, { date: '2022-11-08', text: T('Fallisce un grande exchange.') }] },
    check: (r) => ({ ok: r.orders >= 1 && r.finalValue >= r.startValue * 0.8, detail: T`Valore finale ${pct(r.finalValue / r.startValue)} (min 80%)` }) },
  { kind: 'sim', id: 'leg2025', title: T('La guerra dei dazi (2025)'), brief: T('Un annuncio a sorpresa, due sedute di crollo, un rimbalzo record una settimana dopo. Resta investito almeno al 50% e chiudi con almeno il 97% del capitale.'),
    scenario: { id: 'leg2025', name: '2025', desc: '', historical: T('S&P 500 feb.-apr. 2025: circa −19%'), window: { start: '2025-02-03', end: '2025-06-30' }, news: [{ date: '2025-04-03', text: T('Dazi su quasi tutte le importazioni: l\'indice crolla.') }, { date: '2025-04-09', text: T('Dazi sospesi per novanta giorni: rimbalzo record.') }] },
    check: (r) => ({ ok: r.investedW >= 0.5 && r.finalValue >= r.startValue * 0.97, detail: T`Investito ${pct(r.investedW)} (min 50%) · valore finale ${pct(r.finalValue / r.startValue)} (min 97%)` }) },
];

/** Cosa successe davvero: cause e lezione di ogni crisi leggendaria (ricostruzioni semplificate per scopo didattico). */
export const HISTORY: Record<string, { when: string; cause: string; lesson: string }> = {
  leg1929: { when: T('Ottobre 1929 - 1932, Stati Uniti'), cause: T('Dopo anni di rialzi molti compravano azioni a debito ("a margine"), con il broker che prestava gran parte del prezzo. Quando i prezzi iniziarono a scendere, le richieste di rientro dai prestiti costrinsero a vendere, e le vendite spinsero i prezzi ancora più giù. Il Dow Jones perse circa l\'89% dal massimo al minimo e la crisi bancaria trasformò il crollo nella Grande Depressione.'), lesson: T('La leva trasforma un ribasso in una rovina. Chi aveva comprato senza debito e ha potuto aspettare ha visto i mercati recuperare; chi era a margine è stato liquidato lungo la strada.') },
  leg2000: { when: T('Marzo 2000 - ottobre 2002'), cause: T('Le aziende internet venivano valutate in base ai clic e alle promesse, non agli utili: molte non avevano un modello per guadagnare. Quando i finanziamenti si fermarono, le società senza profitti chiusero e il Nasdaq perse circa il 78%. Le aziende solide sopravvissero, ma anche i loro prezzi scesero molto.'), lesson: T('Una tecnologia può cambiare il mondo e allo stesso tempo essere un pessimo investimento se la paghi troppo. Un prezzo senza utili è una scommessa, non un\'analisi.') },
  leg2008: { when: T('Ottobre 2007 - marzo 2009'), cause: T('Mutui concessi a chi non poteva ripagarli ("subprime") erano stati impacchettati in titoli complessi e venduti in tutto il mondo con rating alti. Quando i prezzi delle case scesero, nessuno sapeva chi avesse le perdite: le banche smisero di fidarsi tra loro, il 15 settembre 2008 fallì Lehman Brothers e l\'S&P 500 perse circa il 57%.'), lesson: T('La diversificazione tra settori conta: le banche persero molto più del mercato. E un prodotto che non capisci non diventa sicuro perché ha un\'etichetta rassicurante.') },
  leg2018: { when: T('Settembre - dicembre 2018'), cause: T('La banca centrale americana alzava i tassi e riduceva il proprio bilancio mentre crescevano le tensioni commerciali con la Cina. I titoli tecnologici, i più cari, scesero per primi; il 24 dicembre l\'S&P 500 era quasi il 20% sotto il massimo. A gennaio la banca centrale promise pazienza e in quattro mesi l\'indice tornò dov\'era.'), lesson: T('Un calo del 20% senza recessione capita più spesso di quanto si ricordi. Chi aveva un piano e una parte difensiva non ha dovuto indovinare il minimo.') },
  leg2020: { when: T('Febbraio - marzo 2020'), cause: T('La pandemia di COVID-19 fermò l\'economia mondiale in poche settimane: l\'S&P 500 perse circa il 34% in 23 giorni di borsa, il ribasso più rapido della storia. Banche centrali e governi risposero con misure enormi e il mercato recuperò i massimi entro pochi mesi.'), lesson: T('Chi ha venduto in preda al panico ha venduto quasi sul minimo. Restare investiti con un piano, e magari continuare ad accumulare, ha funzionato meglio di ogni previsione.') },
  leg2022: { when: T('Novembre 2021 - novembre 2022'), cause: T('Con l\'inflazione le banche centrali alzarono i tassi in fretta: le obbligazioni persero valore (circa il 15% quelle a lunga scadenza) e gli asset più speculativi crollarono. Nel mondo cripto saltò una stablecoin algoritmica (Terra/Luna, maggio) e a novembre fallì un grande exchange (FTX): Bitcoin perse circa il 77% dal massimo.'), lesson: T('Le stablecoin non sono tutte uguali e tenere le cripto su un exchange significa fidarsi di chi lo gestisce. E anche le obbligazioni "sicure" scendono quando i tassi salgono.') },
  leg2022r: { when: T('Gennaio - ottobre 2022'), cause: T('L\'inflazione più alta da quarant\'anni costrinse le banche centrali ad alzare i tassi a ogni riunione. Le azioni scesero di circa un quarto e, cosa rara, le obbligazioni scesero insieme a loro: il portafoglio 60/40 visse uno degli anni peggiori della sua storia. Energia e liquidità furono tra i pochi rifugi.'), lesson: T('Le obbligazioni proteggono dalle recessioni, non dai rialzi dei tassi: conta la durata. Diversificare vuol dire anche chiedersi da che cosa ti stai proteggendo.') },
  leg2025: { when: T('Febbraio - giugno 2025'), cause: T('Il 2 aprile 2025 gli Stati Uniti annunciarono dazi su quasi tutte le importazioni, molto più alti del previsto: l\'S&P 500 perse circa il 10% in due sedute. Una settimana dopo la sospensione per novanta giorni portò uno dei rialzi giornalieri più forti di sempre, e a fine giugno l\'indice era su nuovi massimi.'), lesson: T('I giorni migliori arrivano spesso subito dopo i peggiori: chi è uscito nel panico li ha persi entrambi. Nessuno sapeva in anticipo né l\'annuncio né la retromarcia.') },
};

/** Zona Simulazione: periodi reali senza punteggio. Il nome dice che tipo di mercato è, non quando è successo. */
export const SANDBOX: Replay[] = [
  { id: 'sb_normal', name: T('Mercato tranquillo (1 anno)'), desc: T('Un anno vero di crescita regolare con oscillazioni piccole.'), window: { start: '2017-01-03', end: '2017-12-29', crypto: { start: '2023-01-02', end: '2023-12-29' } } },
  { id: 'sb_bear', name: T('Mercato orso (1 anno)'), desc: T('Un anno vero di calo.'), window: { start: '2022-01-03', end: '2022-12-30' } },
  { id: 'sb_storm', name: T('Tempesta (6 mesi)'), desc: T('Sei mesi veri di volatilità altissima.'), window: { start: '2020-01-02', end: '2020-06-30', crypto: { start: '2022-04-01', end: '2022-09-30' } } },
  { id: 'sb_long', name: T('Accumulo 5 anni'), desc: T('Cinque anni veri con un versamento di 200 $ al mese.'), monthly: 200, window: { start: '2019-01-02', end: '2023-12-29', crypto: { start: '2021-06-01', end: '2025-05-30' } } },
];
