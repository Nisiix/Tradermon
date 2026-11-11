import type { Scenario } from '../systems/market';
import type { Track, RiskProfile } from '../types';

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
  maxW: number;
  investedW: number;
  finalValue: number;
  startValue: number;
  dripShareGrowth: number;
}

export interface SimMission {
  kind: 'sim';
  id: string;
  title: string;
  brief: string;
  scenario: Scenario;
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
  const notes = [
    { ok: r.maxW <= 0.4 && r.sectors >= 2, text: r.maxW <= 0.4 && r.sectors >= 2 ? 'Nessuna posizione dominante e più settori: rischio specifico sotto controllo.' : 'Troppo concentrato: una posizione sopra il 40% o un solo settore.' },
    { ok: r.lossSales === 0, text: r.lossSales === 0 ? 'Nessuna vendita in perdita: hai attraversato i cali senza panico.' : `Vendite in perdita: ${r.lossSales}. Vendere nel calo trasforma un ribasso in una perdita vera.` },
    { ok: r.orders <= Math.ceil(r.values.length / 10) + 3, text: r.orders <= Math.ceil(r.values.length / 10) + 3 ? 'Poche operazioni, ben scelte: i costi sono rimasti bassi.' : `Troppe operazioni (${r.orders}): ogni ordine costa e raramente aggiunge valore.` },
  ];
  return { stars: notes.filter((n) => n.ok).length, notes };
}

export function mentorMission(n: number, track: Track, profile: RiskProfile): Mission {
  const crypto = track === 'crypto';
  switch (n) {
    case 1: return {
      kind: 'sim', id: 'm1', title: 'Il primo raccolto', scenario: { id: 'm1', name: 'Mercato normale', desc: '', days: 60, jitter: 12, phases: [{ until: 999, drift: 0.08, vol: 0.16 }], shocks: [{ day: 25, market: -0.04, news: 'Giornata rossa: l\'indice perde il 4%.' }] },
      brief: 'Hai 60 giorni di mercato, con una giornata rossa da qualche parte nel mezzo. Investi almeno metà del capitale e arriva alla fine senza scendere sotto il 90% del capitale iniziale. Non serve fare tante operazioni.',
      check: (r) => ({ ok: r.investedW >= 0.5 && r.finalValue >= r.startValue * 0.9, detail: `Investito a fine periodo: ${pct(r.investedW)} (min 50%) · valore finale ${pct(r.finalValue / r.startValue)} del capitale (min 90%)` }) };
    case 2: return {
      kind: 'sim', id: 'm2', title: 'Ordini precisi', scenario: { id: 'm2', name: 'Mercato laterale', desc: '', days: 40, jitter: 6, phases: [{ until: 999, drift: 0, vol: 0.22 }], shocks: [{ day: 12, market: -0.03 }, { day: 27, market: -0.025 }] },
      brief: 'Il mercato oscilla senza direzione. Piazza un ordine limite di acquisto sotto il prezzo attuale e fallo eseguire entro 40 giorni.',
      check: (r) => ({ ok: r.limitFills >= 1, detail: `Ordini limite eseguiti: ${r.limitFills} (min 1)` }) };
    case 3: return {
      kind: 'sim', id: 'm3', title: 'Il mosaico', scenario: { id: 'm3', name: 'Shock di settore', desc: '', days: 80, jitter: 18, phases: [{ until: 999, drift: 0.06, vol: 0.16 }], shocks: [{ day: 40, sectors: { tech: -0.15, crypto: -0.2, energy: 0.05 }, news: 'Shock di settore: tecnologia e cripto crollano, l\'energia sale.' }] },
      brief: 'Prima o poi arriverà uno shock di settore: non sai quando né quale settore. A fine periodo devi avere almeno 3 settori diversi e nessuna posizione sopra il 40% del portafoglio.',
      check: (r) => ({ ok: r.sectors >= 3 && r.maxW <= 0.4, detail: `Settori: ${r.sectors} (min 3) · peso massimo ${pct(r.maxW)} (max 40%)` }) };
    case 4: return {
      kind: 'sim', id: 'm4', title: 'La spirale del tempo', monthly: 300, scenario: { id: 'm4', name: '24 mesi di accumulo', desc: '', days: 504, phases: [{ until: 150, drift: 0.05, vol: 0.18 }, { until: 260, drift: -0.25, vol: 0.25 }, { until: 999, drift: 0.15, vol: 0.16 }], shocks: [] },
      brief: 'Due anni di mercato con un calo nel mezzo. Ogni mese ricevi 300 Crediti: fai almeno 10 acquisti mensili (pulsante "Acquisto mensile" o ordini manuali a inizio mese) e tieni i costi totali sotto l\'1,5% di quanto hai versato.',
      check: (r) => ({ ok: r.monthlyBuys >= 10 && r.fees <= r.contributed * 0.015, detail: `Acquisti mensili: ${r.monthlyBuys} (min 10) · costi ${pct(r.fees / Math.max(1, r.contributed))} del versato (max 1,5%)` }) };
    case 5: return pickMission(track);
    case 6: {
      if (track === 'stocks') return {
        kind: 'sim', id: 'm6', title: 'Il raccolto dei dividendi', dividends: true, scenario: { id: 'm6', name: 'Dividendi', desc: '', days: 250, phases: [{ until: 999, drift: 0.04, vol: 0.14 }], shocks: [] },
        brief: 'Un anno di mercato tranquillo. I dividendi vengono pagati ogni mese e reinvestiti automaticamente. Compra titoli con dividendo e tienili: le quote devono crescere almeno del 3% grazie al reinvestimento.',
        check: (r) => ({ ok: r.dripShareGrowth >= 0.03, detail: `Quote aggiunte con i dividendi: ${pct(r.dripShareGrowth)} (min 3%)` }) };
      const lim = crypto ? 0.2 : ddAllow(0.08, profile);
      return {
        kind: 'sim', id: 'm6', title: crypto ? 'L\'ancora che cede' : 'L\'onda dei tassi',
        scenario: crypto
          ? { id: 'm6', name: 'Perdita di aggancio', desc: '', days: 120, jitter: 20, phases: [{ until: 999, drift: -0.2, vol: 0.2 }], shocks: [{ day: 50, sectors: { crypto: -0.25 }, news: 'Una stablecoin algoritmica perde l\'aggancio: panico su tutto il mercato cripto.' }, { day: 51, sectors: { crypto: -0.12 } }] }
          : { id: 'm6', name: 'Tassi in salita', desc: '', days: 120, jitter: 15, phases: [{ until: 999, drift: -0.08, vol: 0.18 }], shocks: [{ day: 30, sectors: { bond: -0.03, tech: -0.04, utility: -0.03 }, news: 'La banca centrale alza i tassi dello 0,75%.' }, { day: 70, sectors: { bond: -0.03, tech: -0.03 }, news: 'Altro rialzo dei tassi.' }] },
        brief: crypto ? `Una stablecoin crolla e trascina il mercato. Mantieni il massimo drawdown del portafoglio sotto il ${pct(lim)}. La liquidità e la stablecoin con riserve sono tue alleate.` : `I tassi salgono due volte. Mantieni il massimo drawdown del portafoglio sotto il ${pct(lim)}.`,
        check: (r) => ({ ok: r.mdd <= lim && r.investedW > 0.2, detail: `Max drawdown ${pct(r.mdd)} (max ${pct(lim)}) · investito ${pct(r.investedW)} (min 20%)` }) };
    }
    case 7: return {
      kind: 'sim', id: 'm7', title: 'Specchio, specchio', scenario: { id: 'm7', name: 'Bolle e notizie euforiche', desc: '', days: 90, jitter: 8, phases: [{ until: 30, drift: 0.3, vol: 0.2 }, { until: 60, drift: -0.4, vol: 0.3 }, { until: 999, drift: 0.1, vol: 0.18 }], shocks: [{ day: 10, asset: { RZM: 0.25, MEM: 0.5, TKE: 0.08 }, news: 'TUTTI COMPRANO! Razzomania e Gattomoneta volano!' }, { day: 25, asset: { RZM: 0.2, MEM: 0.4 }, news: '"Non è mai troppo tardi per salire a bordo!"' }, { day: 40, asset: { RZM: -0.35, MEM: -0.6 }, news: 'La bolla scoppia.' }] },
      brief: 'Notizie euforiche e bolle ti tenteranno. Fai al massimo 6 ordini, resta investito almeno al 30% a fine periodo (restare fermi in liquidità non è una strategia) e chiudi con almeno il 95% del capitale.',
      check: (r) => ({ ok: r.orders <= 6 && r.investedW >= 0.3 && r.finalValue >= r.startValue * 0.95, detail: `Ordini: ${r.orders} (max 6) · investito a fine periodo ${pct(r.investedW)} (min 30%) · valore finale ${pct(r.finalValue / r.startValue)} (min 95%)` }) };
    default: {
      const lim = crypto ? ddAllow(0.2, profile) : ddAllow(0.12, profile);
      return {
        kind: 'sim', id: 'm8', title: 'Lo scudo', scenario: { id: 'm8', name: 'Crollo improvviso', desc: '', days: 90, jitter: 14, phases: [{ until: 30, drift: 0.1, vol: 0.15 }, { until: 55, drift: -1.2, vol: 0.45 }, { until: 999, drift: 0.3, vol: 0.25 }], shocks: [{ day: 31, market: -0.07, news: 'Crollo! L\'indice perde il 7% in apertura.' }] },
        brief: `Arriverà un crollo improvviso, senza preavviso. Tieni il massimo drawdown sotto il ${pct(lim)}, restando investito almeno al 30% a fine periodo. Gli ordini stop e la diversificazione sono il tuo scudo.`,
        check: (r) => ({ ok: r.mdd <= lim && r.investedW >= 0.3, detail: `Max drawdown ${pct(r.mdd)} (max ${pct(lim)}) · investito a fine periodo ${pct(r.investedW)} (min 30%)` }) };
    }
  }
}

function pickMission(track: Track): PickMission {
  if (track === 'etf') return { kind: 'pick', id: 'm5', title: 'Il prospetto', need: 2, brief: 'Tre ETF sembrano gemelli. Leggi i prospetti e scegli il più efficiente.', rounds: [
    { prompt: 'Tre ETF sullo stesso indice azionario globale. Quale scegli per 20 anni di accumulo?', options: [
      { title: 'ETF Alfa', lines: ['TER 0,65%', 'Tracking error 0,9%', 'Patrimonio 80 mln'], correct: false, why: 'Costi alti e replica meno fedele.' },
      { title: 'ETF Beta', lines: ['TER 0,12%', 'Tracking error 0,1%', 'Patrimonio 6 mld'], correct: true, why: 'Costi bassi, replica fedele, grande e liquido.' },
      { title: 'ETF Gamma', lines: ['TER 0,20%', 'Tracking error 0,4%', 'Patrimonio 15 mln (rischio chiusura)'], correct: false, why: 'Troppo piccolo: rischio di chiusura e spread più alti.' } ] },
    { prompt: 'Quale ETF è davvero diversificato?', options: [
      { title: 'Tecno Settore', lines: ['Solo tecnologia', '60 aziende'], correct: false, why: 'Un solo settore: concentrato.' },
      { title: 'Globo Mondo', lines: ['1.500 aziende', '23 Paesi', '11 settori'], correct: true, why: 'Diversificazione per Paese e settore.' },
      { title: 'Leva 3x Indice', lines: ['3 volte il rendimento giornaliero', 'Ricalcolo quotidiano'], correct: false, why: 'Strumento a leva per esperti, non diversificazione.' } ] },
    { prompt: 'Un ETF obbligazionario per chi teme i rialzi dei tassi:', options: [
      { title: 'Duration 2', lines: ['Titoli di Stato a breve'], correct: true, why: 'Bassa duration = poca sensibilità ai tassi.' },
      { title: 'Duration 18', lines: ['Titoli a 30 anni'], correct: false, why: 'Con tassi +1% perderebbe circa il 18%.' },
      { title: 'High yield', lines: ['Rating CCC'], correct: false, why: 'Rischio di credito elevato.' } ] } ] };
  if (track === 'crypto') return { kind: 'pick', id: 'm5', title: 'Il progetto truffa', need: 2, brief: 'Riconosci i progetti pericolosi e le pratiche di custodia corrette.', rounds: [
    { prompt: 'Quale di questi progetti è quasi certamente una truffa?', options: [
      { title: 'Progetto Rete', lines: ['Team pubblico', 'Codice aperto e verificato', 'Nessun rendimento promesso'], correct: false, why: 'Trasparente: non garantisce successo, ma non ha segnali di truffa.' },
      { title: 'Progetto LunaX', lines: ['Team anonimo', '1.000% annuo garantito', 'Liquidità non bloccata', '"Compra entro stasera"'], correct: true, why: 'Tutti i segnali di un rug pull.' },
      { title: 'Progetto Ponte', lines: ['Audit pubblicato', 'Rischi elencati nel documento'], correct: false, why: 'Dichiara i rischi: buon segnale.' } ] },
    { prompt: 'Dove conservi la seed phrase?', options: [
      { title: 'In una foto sul telefono', lines: ['Sincronizzata nel cloud'], correct: false, why: 'Se il cloud viene violato, perdi tutto.' },
      { title: 'Su carta, offline, in un luogo sicuro', lines: ['Mai digitata online'], correct: true, why: 'Offline e privata: la scelta corretta.' },
      { title: 'La invio al supporto', lines: ['Per sicurezza'], correct: false, why: 'Nessun supporto legittimo la chiede.' } ] },
    { prompt: 'Quale stablecoin è più solida?', options: [
      { title: 'Algoritmica', lines: ['Nessuna riserva', 'Rendimento 20%'], correct: false, why: 'Senza riserve l\'aggancio può crollare.' },
      { title: 'Con riserve verificate', lines: ['Titoli di Stato a breve', 'Attestazioni mensili'], correct: true, why: 'Riserve trasparenti e verificate.' },
      { title: 'Anonima', lines: ['Emittente sconosciuto'], correct: false, why: 'Non sai chi deve rimborsarti.' } ] } ] };
  if (track === 'mixed') return { kind: 'pick', id: 'm5', title: 'Le proporzioni', need: 2, brief: 'Scegli le allocazioni coerenti con il profilo dell\'investitore.', rounds: [
    { prompt: 'Lucia, 30 anni, orizzonte 25 anni, tollera bene le oscillazioni:', options: [
      { title: '80% azioni, 15% obbligazioni, 5% liquidità', lines: [], correct: true, why: 'Orizzonte lungo e tolleranza alta.' },
      { title: '100% cripto', lines: [], correct: false, why: 'Nessuna diversificazione, rischio estremo.' },
      { title: '100% liquidità', lines: [], correct: false, why: 'L\'inflazione eroderebbe il capitale in 25 anni.' } ] },
    { prompt: 'Marco deve comprare casa tra 2 anni:', options: [
      { title: '90% azioni tecnologiche', lines: [], correct: false, why: 'Orizzonte troppo breve per tanto rischio.' },
      { title: '20% azioni, 60% obbligazioni a breve, 20% liquidità', lines: [], correct: true, why: 'Poco tempo, poco rischio.' },
      { title: '50% cripto', lines: [], correct: false, why: 'Volatilità incompatibile con l\'obiettivo.' } ] },
    { prompt: 'Un portafoglio 60/40 è diventato 75/25 dopo un rialzo. Cosa fai?', options: [
      { title: 'Ribilancio verso 60/40', lines: [], correct: true, why: 'Torna al rischio scelto.' },
      { title: 'Compro altre azioni', lines: [], correct: false, why: 'Aumenteresti ancora il rischio.' },
      { title: 'Vendo tutto', lines: [], correct: false, why: 'Reazione eccessiva.' } ] } ] };
  return { kind: 'pick', id: 'm5', title: 'Il bilancio nascosto', need: 2, brief: 'Leggi i numeri e scegli l\'azienda con i fondamentali più solidi.', rounds: [
    { prompt: 'Tre aziende dello stesso settore. Quale ha i fondamentali più solidi?', options: [
      { title: 'Alfa Spa', lines: ['Ricavi +8%', 'Utile netto in crescita', 'P/E 14', 'Debito/patrimonio 0,4'], correct: true, why: 'Crescita sostenibile, prezzo ragionevole, poco debito.' },
      { title: 'Beta Spa', lines: ['Ricavi +40%', 'In perdita da 5 anni', 'Debito/patrimonio 3,5'], correct: false, why: 'Cresce bruciando cassa e indebitandosi.' },
      { title: 'Gamma Spa', lines: ['Ricavi −10%', 'P/E 60', 'Dividendo 9% (payout 150%)'], correct: false, why: 'Dividendo insostenibile e prezzo caro.' } ] },
    { prompt: 'Prezzo 80, utile per azione 4. Il P/E è…', options: [
      { title: '20', lines: [], correct: true, why: '80 / 4 = 20.' },
      { title: '320', lines: [], correct: false, why: 'Hai moltiplicato invece di dividere.' },
      { title: '5%', lines: [], correct: false, why: 'Quello è il rendimento degli utili (4/80).' } ] },
    { prompt: 'Utili in crescita ma flusso di cassa negativo da 3 anni. Cosa fai?', options: [
      { title: 'Approfondisco: gli utili non diventano cassa', lines: [], correct: true, why: 'Divergenza da indagare.' },
      { title: 'Compro subito', lines: [], correct: false, why: 'Ignori un segnale importante.' },
      { title: 'Guardo solo il grafico', lines: [], correct: false, why: 'Il grafico non mostra la cassa.' } ] } ] };
}

export function leagueMission(i: number): Mission {
  switch (i) {
    case 0: return { kind: 'sim', id: 'l1', title: 'Il ciclo dei tassi', scenario: { id: 'l1', name: 'Ciclo dei tassi', desc: '', days: 180, phases: [{ until: 60, drift: 0.12, vol: 0.15 }, { until: 120, drift: -0.15, vol: 0.22 }, { until: 999, drift: 0.12, vol: 0.16 }], shocks: [{ day: 60, sectors: { bond: -0.03, tech: -0.04 }, news: 'Rialzo dei tassi a sorpresa.' }, { day: 125, sectors: { bond: 0.02, tech: 0.04 }, news: 'La banca centrale taglia i tassi.' }] },
      brief: 'Un ciclo completo di tassi. Ottieni un indice di Sharpe di almeno 0,3.', check: (r) => ({ ok: r.sharpe >= 0.3, detail: `Sharpe ${r.sharpe.toFixed(2)} (min 0,30)` }) };
    case 1: return { kind: 'sim', id: 'l2', title: 'Trend e inversioni', scenario: { id: 'l2', name: 'Trend e inversioni', desc: '', days: 120, phases: [{ until: 40, drift: 0.25, vol: 0.14 }, { until: 80, drift: -0.3, vol: 0.22 }, { until: 999, drift: 0.2, vol: 0.15 }], shocks: [] },
      brief: 'Tendenze che si invertono. Chiudi con rendimento positivo e drawdown massimo entro il 15%.', check: (r) => ({ ok: r.ret > 0 && r.mdd <= 0.15, detail: `Rendimento ${pct(r.ret)} (> 0) · max drawdown ${pct(r.mdd)} (max 15%)` }) };
    case 2: return { kind: 'pick', id: 'l3', title: 'Lo sportello delle offerte', need: 3, brief: 'Giulia Garante ti mostra offerte reali e truffe. Distinguile.', rounds: [
      { prompt: 'Quale offerta è una truffa?', options: [
        { title: 'Conto deposito', lines: ['Banca autorizzata', 'Tasso 3%', 'Garanzia depositi fino a 100.000'], correct: false, why: 'Offerta regolare.' },
        { title: '"Trading robot"', lines: ['Guadagni del 5% al giorno', 'Sito non autorizzato', 'Pagamento in cripto'], correct: true, why: 'Rendimenti impossibili e operatore abusivo.' },
        { title: 'ETF a indice', lines: ['KID disponibile', 'TER 0,2%'], correct: false, why: 'Prodotto trasparente.' } ] },
      { prompt: 'Quale messaggio è phishing?', options: [
        { title: 'Email dal broker', lines: ['"Accedi qui per evitare il blocco del conto"', 'Link a brok3r-login.xyz'], correct: true, why: 'Dominio falso e urgenza.' },
        { title: 'Estratto conto', lines: ['Disponibile nell\'area riservata', 'Nessun link'], correct: false, why: 'Comunicazione regolare.' },
        { title: 'Newsletter', lines: ['Notizie di mercato', 'Nessuna richiesta di dati'], correct: false, why: 'Innocua.' } ] },
      { prompt: 'Quale proposta è uno schema Ponzi?', options: [
        { title: 'Club "Moltiplica"', lines: ['10% al mese costante', 'Bonus se porti amici'], correct: true, why: 'Rendimenti costanti e reclutamento: classico Ponzi.' },
        { title: 'Fondo pensione', lines: ['Rendimenti variabili', 'Vigilato'], correct: false, why: 'Prodotto regolato.' },
        { title: 'Titolo di Stato', lines: ['Cedola 3,5%', 'Scadenza 10 anni'], correct: false, why: 'Obbligazione pubblica.' } ] } ] };
    case 3: return { kind: 'sim', id: 'l4', title: 'Mente fredda', scenario: { id: 'l4', name: 'Notizie tentatrici', desc: '', days: 120, phases: [{ until: 999, drift: 0.07, vol: 0.2 }], shocks: [{ day: 15, asset: { MEM: 0.6, RZM: 0.3 }, news: 'Tutti parlano di Gattomoneta!' }, { day: 30, market: -0.05, news: 'Panico! Vendite ovunque!' }, { day: 60, asset: { MEM: -0.5, RZM: -0.3 }, news: 'Le mode passano.' }, { day: 80, market: -0.04, news: 'Altra giornata nera.' }] },
      brief: 'Il mercato ti provoca. Al massimo 8 ordini e Sharpe di almeno 0,2.', check: (r) => ({ ok: r.orders <= 8 && r.sharpe >= 0.2, detail: `Ordini ${r.orders} (max 8) · Sharpe ${r.sharpe.toFixed(2)} (min 0,20)` }) };
    default: return { kind: 'sim', id: 'l5', title: 'La prova del Campione', scenario: { id: 'l5', name: 'Crollo e ripresa', desc: '', days: 250, phases: [{ until: 70, drift: 0.1, vol: 0.15 }, { until: 120, drift: -0.7, vol: 0.35 }, { until: 999, drift: 0.35, vol: 0.2 }], shocks: [{ day: 71, market: -0.06, news: 'Inizia la crisi.' }] },
      brief: 'Un anno intero con un crollo e una ripresa. Sharpe ≥ 0,4, drawdown ≤ 18% e almeno 3 settori a fine anno.', check: (r) => ({ ok: r.sharpe >= 0.4 && r.mdd <= 0.18 && r.sectors >= 3, detail: `Sharpe ${r.sharpe.toFixed(2)} (min 0,40) · max drawdown ${pct(r.mdd)} (max 18%) · settori ${r.sectors} (min 3)` }) };
  }
}

export const LEGENDS: SimMission[] = [
  { kind: 'sim', id: 'leg1929', title: 'Il Grande Crollo (1929)', brief: 'Ricostruzione semplificata: il mercato perde circa l\'85% in 3 anni compressi in 300 giorni. Chiudi con almeno il 60% del capitale.',
    scenario: { id: 'leg1929', name: '1929', desc: '', days: 300, historical: 'Dow Jones 1929-1932: circa −89%', phases: [{ until: 30, drift: 0.2, vol: 0.2 }, { until: 260, drift: -1.6, vol: 0.4 }, { until: 999, drift: 0.5, vol: 0.35 }], shocks: [{ day: 31, market: -0.12, news: 'Giovedì nero!' }, { day: 34, market: -0.11 }] },
    check: (r) => ({ ok: r.finalValue >= r.startValue * 0.6, detail: `Valore finale ${pct(r.finalValue / r.startValue)} (min 60%)` }) },
  { kind: 'sim', id: 'leg2000', title: 'La bolla dot-com (2000)', brief: 'La tecnologia perde circa il 75%. Chiudi con drawdown massimo entro il 25%.',
    scenario: { id: 'leg2000', name: 'Dot-com', desc: '', days: 300, historical: 'Nasdaq 2000-2002: circa −78%', phases: [{ until: 40, drift: 0.4, vol: 0.25 }, { until: 999, drift: -0.5, vol: 0.3 }], shocks: [{ day: 45, sectors: { tech: -0.1 }, news: 'Le aziende internet senza utili crollano.' }, { day: 120, sectors: { tech: -0.08 } }, { day: 200, sectors: { tech: -0.08 } }] },
    check: (r) => ({ ok: r.mdd <= 0.25, detail: `Max drawdown ${pct(r.mdd)} (max 25%)` }) },
  { kind: 'sim', id: 'leg2008', title: 'La crisi finanziaria (2008)', brief: 'Il mercato perde circa il 55%, le banche molto di più. Chiudi con Sharpe positivo.',
    scenario: { id: 'leg2008', name: '2008', desc: '', days: 350, historical: 'S&P 500 ott. 2007 - mar. 2009: circa −57%', phases: [{ until: 60, drift: -0.1, vol: 0.2 }, { until: 250, drift: -0.9, vol: 0.45 }, { until: 999, drift: 0.9, vol: 0.3 }], shocks: [{ day: 150, sectors: { finance: -0.25 }, market: -0.05, news: 'Fallisce una grande banca d\'affari.' }] },
    check: (r) => ({ ok: r.sharpe > 0, detail: `Sharpe ${r.sharpe.toFixed(2)} (> 0)` }) },
  { kind: 'sim', id: 'leg2020', title: 'Il crollo lampo (2020)', brief: '−34% in 23 giorni, poi una ripresa veloce. Resta investito almeno al 50% e chiudi in positivo.',
    scenario: { id: 'leg2020', name: '2020', desc: '', days: 160, historical: 'S&P 500 feb.-mar. 2020: circa −34%', phases: [{ until: 30, drift: 0.1, vol: 0.12 }, { until: 53, drift: -4.5, vol: 0.7 }, { until: 999, drift: 1.2, vol: 0.3 }], shocks: [{ day: 31, sectors: { energy: -0.1, health: 0.04 }, news: 'Una pandemia blocca il mondo.' }] },
    check: (r) => ({ ok: r.investedW >= 0.5 && r.ret > 0, detail: `Investito ${pct(r.investedW)} (min 50%) · rendimento ${pct(r.ret)} (> 0)` }) },
  { kind: 'sim', id: 'leg2022', title: 'L\'inverno cripto (2022)', brief: 'Le cripto perdono circa il 75% e le obbligazioni il 15%. Chiudi con almeno l\'80% del capitale.',
    scenario: { id: 'leg2022', name: '2022', desc: '', days: 250, historical: 'Bitcoin nov. 2021 - nov. 2022: circa −77%', phases: [{ until: 999, drift: -0.2, vol: 0.25 }], shocks: [{ day: 60, sectors: { crypto: -0.3 }, news: 'Una stablecoin algoritmica crolla.' }, { day: 180, sectors: { crypto: -0.25 }, news: 'Fallisce un grande exchange.' }, { day: 30, sectors: { bond: -0.04 } }, { day: 90, sectors: { bond: -0.04 } }, { day: 150, sectors: { bond: -0.04 } }] },
    check: (r) => ({ ok: r.finalValue >= r.startValue * 0.8, detail: `Valore finale ${pct(r.finalValue / r.startValue)} (min 80%)` }) },
];

/** Cosa successe davvero: cause e lezione di ogni crisi leggendaria (ricostruzioni semplificate per scopo didattico). */
export const HISTORY: Record<string, { when: string; cause: string; lesson: string }> = {
  leg1929: { when: 'Ottobre 1929 - 1932, Stati Uniti', cause: 'Dopo anni di rialzi molti compravano azioni a debito ("a margine"), con il broker che prestava gran parte del prezzo. Quando i prezzi iniziarono a scendere, le richieste di rientro dai prestiti costrinsero a vendere, e le vendite spinsero i prezzi ancora più giù. Il Dow Jones perse circa l\'89% dal massimo al minimo e la crisi bancaria trasformò il crollo nella Grande Depressione.', lesson: 'La leva trasforma un ribasso in una rovina. Chi aveva comprato senza debito e ha potuto aspettare ha visto i mercati recuperare; chi era a margine è stato liquidato lungo la strada.' },
  leg2000: { when: 'Marzo 2000 - ottobre 2002', cause: 'Le aziende internet venivano valutate in base ai clic e alle promesse, non agli utili: molte non avevano un modello per guadagnare. Quando i finanziamenti si fermarono, le società senza profitti chiusero e il Nasdaq perse circa il 78%. Le aziende solide sopravvissero, ma anche i loro prezzi scesero molto.', lesson: 'Una tecnologia può cambiare il mondo e allo stesso tempo essere un pessimo investimento se la paghi troppo. Un prezzo senza utili è una scommessa, non un\'analisi.' },
  leg2008: { when: 'Ottobre 2007 - marzo 2009', cause: 'Mutui concessi a chi non poteva ripagarli ("subprime") erano stati impacchettati in titoli complessi e venduti in tutto il mondo con rating alti. Quando i prezzi delle case scesero, nessuno sapeva chi avesse le perdite: le banche smisero di fidarsi tra loro, il 15 settembre 2008 fallì Lehman Brothers e l\'S&P 500 perse circa il 57%.', lesson: 'La diversificazione tra settori conta: le banche persero molto più del mercato. E un prodotto che non capisci non diventa sicuro perché ha un\'etichetta rassicurante.' },
  leg2020: { when: 'Febbraio - marzo 2020', cause: 'La pandemia di COVID-19 fermò l\'economia mondiale in poche settimane: l\'S&P 500 perse circa il 34% in 23 giorni di borsa, il ribasso più rapido della storia. Banche centrali e governi risposero con misure enormi e il mercato recuperò i massimi entro pochi mesi.', lesson: 'Chi ha venduto in preda al panico ha venduto quasi sul minimo. Restare investiti con un piano, e magari continuare ad accumulare, ha funzionato meglio di ogni previsione.' },
  leg2022: { when: 'Novembre 2021 - novembre 2022', cause: 'Con l\'inflazione le banche centrali alzarono i tassi in fretta: le obbligazioni persero valore (circa il 15% quelle a lunga scadenza) e gli asset più speculativi crollarono. Nel mondo cripto saltò una stablecoin algoritmica (Terra/Luna, maggio) e a novembre fallì un grande exchange (FTX): Bitcoin perse circa il 77% dal massimo.', lesson: 'Le stablecoin non sono tutte uguali e tenere le cripto su un exchange significa fidarsi di chi lo gestisce. E anche le obbligazioni "sicure" scendono quando i tassi salgono.' },
};

export const SANDBOX: Scenario[] = [
  { id: 'sb_normal', name: 'Mercato normale (1 anno)', desc: 'Crescita moderata con oscillazioni normali.', days: 250, phases: [{ until: 999, drift: 0.07, vol: 0.16 }], shocks: [] },
  { id: 'sb_bear', name: 'Mercato orso (1 anno)', desc: 'Un anno di calo.', days: 250, phases: [{ until: 999, drift: -0.25, vol: 0.25 }], shocks: [] },
  { id: 'sb_storm', name: 'Tempesta (6 mesi)', desc: 'Volatilità altissima, nessuna direzione.', days: 125, phases: [{ until: 999, drift: 0, vol: 0.4 }], shocks: [] },
  { id: 'sb_long', name: 'Accumulo 5 anni', desc: 'Cinque anni con PAC da 200 al mese.', days: 1260, phases: [{ until: 999, drift: 0.07, vol: 0.17 }], shocks: [] },
];
