import type { Sector, BiasId } from '../types';
import { T } from '../i18n';

export interface SectorShock {
  id: string;
  title: string;
  text: string;
  effects: Partial<Record<Sector, number>>;
}

// Matrice evento × settore (rendimento applicato nel giorno dell'evento).
export const SECTOR_SHOCKS: SectorShock[] = [
  { id: 'rate_up', title: T('La banca centrale alza i tassi'), text: T('Per frenare l\'inflazione la banca centrale alza i tassi dello 0,5%.'),
    effects: { tech: -0.04, finance: 0.02, energy: 0, health: -0.01, consumer: -0.02, utility: -0.03, bond: -0.03, gold: -0.01, crypto: -0.06, world: -0.02 } },
  { id: 'rate_down', title: T('La banca centrale taglia i tassi'), text: T('L\'economia rallenta e i tassi vengono tagliati dello 0,5%.'),
    effects: { tech: 0.04, finance: -0.01, energy: 0.01, health: 0.01, consumer: 0.02, utility: 0.02, bond: 0.02, gold: 0.01, crypto: 0.06, world: 0.02 } },
  { id: 'oil', title: T('Petrolio alle stelle'), text: T('Una crisi di forniture fa salire il petrolio del 30%.'),
    effects: { tech: -0.02, energy: 0.06, consumer: -0.03, utility: -0.01, bond: -0.01, gold: 0.02, crypto: -0.02, world: -0.01 } },
  { id: 'recession', title: T('Recessione annunciata'), text: T('Il PIL scende per il secondo trimestre di fila.'),
    effects: { tech: -0.05, finance: -0.06, energy: -0.04, health: -0.01, consumer: -0.04, utility: 0.01, bond: 0.03, gold: 0.04, crypto: -0.08, world: -0.04 } },
  { id: 'ai', title: T('Boom dell\'intelligenza artificiale'), text: T('Un nuovo modello di IA entusiasma i mercati.'),
    effects: { tech: 0.07, finance: 0.01, energy: 0.01, health: 0.01, crypto: 0.03, world: 0.02 } },
  { id: 'hack', title: T('Hack di un exchange'), text: T('Un grande exchange di cripto subisce un furto.'),
    effects: { crypto: -0.12, stable: -0.01, gold: 0.01 } },
  { id: 'pandemic', title: T('Nuova epidemia'), text: T('Un\'epidemia blocca viaggi e fabbriche.'),
    effects: { tech: -0.03, finance: -0.05, energy: -0.08, health: 0.05, consumer: -0.04, bond: 0.03, gold: 0.03, crypto: -0.05, world: -0.04 } },
  { id: 'inflation', title: T('Inflazione sopra le attese'), text: T('I prezzi al consumo salgono più del previsto.'),
    effects: { tech: -0.03, finance: 0.01, energy: 0.03, health: -0.01, consumer: -0.02, utility: -0.01, bond: -0.04, gold: 0.03, crypto: -0.03, world: -0.02 } },
];

export interface NewsChoice { label: string; good: boolean; reply: string; stat?: 'disciplina' | 'pazienza'; delta?: number; bias?: BiasId }
export interface NewsEvent { id: string; who: string; text: string; choices: NewsChoice[]; source: string }

export const NEWS_EVENTS: NewsEvent[] = [
  { id: 'drop15', who: T('Notiziario dei Mercati'), source: 'ip_loss_aversion',
    text: T('Un titolo del tuo portafoglio perde il 15% in un giorno dopo una trimestrale deludente. Cosa fai?'),
    choices: [
      { label: T('Rileggo le ragioni per cui l\'ho comprato e il mio piano'), good: true, reply: T('Giusto: decidi in base al piano e ai fatti, non alla paura del momento.'), stat: 'pazienza', delta: 5 },
      { label: T('Vendo tutto subito!'), good: false, reply: T('Vendere d\'impulso dopo un calo spesso significa vendere vicino al minimo.'), stat: 'pazienza', delta: -5, bias: 'panico' },
      { label: T('Compro il triplo per "mediare"'), good: false, reply: T('Raddoppiare senza analisi aumenta la concentrazione: è una forma di martingala.'), stat: 'disciplina', delta: -5 },
    ] },
  { id: 'rally', who: T('Un passante entusiasta'), source: 'ip_fomo',
    text: T('"Hai visto Razzomania? +60% questa settimana! Tutti stanno comprando!"'),
    choices: [
      { label: T('Non rientra nel mio piano: passo'), good: true, reply: T('Ottimo. I rialzi verticali spesso finiscono con discese altrettanto rapide.'), stat: 'disciplina', delta: 5 },
      { label: T('Compro subito, non voglio perdere il treno'), good: false, reply: T('Questa è la FOMO: inseguire ciò che è già salito molto.'), stat: 'disciplina', delta: -5, bias: 'fomo' },
      { label: T('Compro perché lo fanno tutti'), good: false, reply: T('Effetto gregge: "tutti comprano" non è un\'analisi.'), stat: 'disciplina', delta: -5, bias: 'gregge' },
    ] },
  { id: 'streak', who: T('La tua coscienza'), source: 'ip_overconfidence',
    text: T('Hai indovinato tre operazioni di fila. Ti senti imbattibile. Cosa fai?'),
    choices: [
      { label: T('Mantengo le stesse regole di rischio'), good: true, reply: T('Tre successi possono essere fortuna: la disciplina vale di più.'), stat: 'disciplina', delta: 5 },
      { label: T('Raddoppio la dimensione delle operazioni'), good: false, reply: T('Eccesso di fiducia: aumentare il rischio dopo una serie positiva è un classico errore.'), stat: 'disciplina', delta: -5, bias: 'euforia' },
      { label: T('Metto tutto sulla prossima idea'), good: false, reply: T('La concentrazione totale può cancellare in un colpo tutti i guadagni.'), stat: 'disciplina', delta: -8, bias: 'euforia' },
    ] },
  { id: 'anchor', who: T('Notiziario dei Mercati'), source: 'ip_anchoring',
    text: T('Un titolo che hai comprato a 100 è a 70 da mesi e i conti peggiorano. Pensi: "Vendo solo quando torna a 100".'),
    choices: [
      { label: T('Mi chiedo se lo comprerei oggi a 70, con i dati attuali'), good: true, reply: T('Esatto: il prezzo di carico è un\'àncora che al mercato non interessa.'), stat: 'disciplina', delta: 5 },
      { label: T('Aspetto i 100, costi quel che costi'), good: false, reply: T('Ancoraggio e avversione alle perdite insieme: potresti aspettare per sempre.'), stat: 'pazienza', delta: -3 },
    ] },
  { id: 'crash_tv', who: T('Telegiornale'), source: 'ip_bear',
    text: T('"Crollo in borsa! L\'indice perde il 4% in una seduta!" Il tuo portafoglio è diversificato e il tuo orizzonte è lungo.'),
    choices: [
      { label: T('Resto fedele al piano; se serve, ribilancio'), good: true, reply: T('Con un piano e un orizzonte lungo, un giorno rosso è rumore.'), stat: 'pazienza', delta: 5 },
      { label: T('Vendo tutto e torno quando si calma'), good: false, reply: T('Uscire e rientrare "al momento giusto" è difficilissimo: spesso si perde la ripresa.'), stat: 'pazienza', delta: -5, bias: 'panico' },
    ] },
  { id: 'fees', who: T('Un venditore elegante'), source: 'ip_ter',
    text: T('"Il mio fondo costa il 3% l\'anno più il 2% di ingresso, ma è gestito dai migliori!"'),
    choices: [
      { label: T('Confronto costi e risultati con alternative più economiche'), good: true, reply: T('I costi sono certi, l\'abilità del gestore no.'), stat: 'disciplina', delta: 5 },
      { label: T('Firmo: se costa tanto sarà buono'), good: false, reply: T('Costo alto non significa qualità: su 30 anni un 3% annuo erode gran parte del capitale.'), stat: 'disciplina', delta: -5 },
    ] },
  { id: 'seed', who: T('"Supporto Wallet Ufficiale"'), source: 'ip_seed',
    text: T('"Il tuo wallet è bloccato! Inviaci la frase di recupero per sbloccarlo entro 10 minuti."'),
    choices: [
      { label: T('Non la invio a nessuno e controllo dai canali ufficiali'), good: true, reply: T('Perfetto: nessun supporto legittimo chiede la seed phrase.'), stat: 'disciplina', delta: 6 },
      { label: T('La invio subito, c\'è fretta!'), good: false, reply: T('La fretta è l\'arma del truffatore. Con la seed phrase ti avrebbero svuotato il wallet.'), stat: 'disciplina', delta: -8 },
    ] },
  { id: 'rebalance', who: T('Dott.ssa Ratio (messaggio)'), source: 'ip_rebalancing',
    text: T('Dopo un anno di rialzi la parte rischiosa del tuo portafoglio è passata dal 60% al 75%.'),
    choices: [
      { label: T('Ribilancio verso l\'obiettivo'), good: true, reply: T('Così il rischio torna a quello che avevi scelto.'), stat: 'disciplina', delta: 5 },
      { label: T('Lascio correre, sta andando bene'), good: false, reply: T('Senza ribilanciare il rischio cresce di nascosto.'), stat: 'disciplina', delta: -3 },
    ] },
];

export interface Temptation { id: string; who: string; text: string; accept: string; refuse: string; source: string; bias: BiasId; loss: number }

export const TEMPTATIONS: Temptation[] = [
  { id: 'ponzi', who: T('Speculatore'), source: 'ig_ponzi', bias: 'fomo', loss: 0.05,
    text: T('"Affare garantito: 20% al mese, senza rischi! Mi servono i soldi entro stasera."'),
    accept: T('Dopo due "rendimenti" pagati, lo Speculatore sparisce. Era uno schema Ponzi: i primi pagamenti venivano dai soldi dei nuovi.'),
    refuse: T('Rendimenti garantiti e fretta: due campanelli d\'allarme. Ben fatto.') },
  { id: 'pump', who: T('Speculatore'), source: 'ig_pump', bias: 'gregge', loss: 0.04,
    text: T('"Nel nostro gruppo segreto compriamo tutti insieme Gattomoneta alle 21:00. Poi sale per forza!"'),
    accept: T('Alle 21:01 gli organizzatori vendono tutto ai nuovi arrivati. Il prezzo crolla: era un pump and dump.'),
    refuse: T('Chi organizza i "pump" vende a chi arriva dopo. Ottima scelta.') },
  { id: 'leva', who: T('Speculatore'), source: 'ip_leverage', bias: 'euforia', loss: 0.06,
    text: T('"Perché guadagnare poco? Con la leva 20 trasformi 100 in 2.000 di esposizione!"'),
    accept: T('Un calo del 5% basta ad azzerare la posizione con leva 20. Lezione sulla leva imparata a caro prezzo (simulato).'),
    refuse: T('Con leva 20, un movimento del 5% contro di te azzera tutto. Saggio.') },
  { id: 'phish', who: T('Speculatore'), source: 'ip_phishing', bias: 'fomo', loss: 0.02,
    text: T('"Vuoi gli otto Sigilli subito? Inserisci le tue chiavi su questo sito e salti la fila!"'),
    accept: T('Il sito era falso: le chiavi sono finite nelle mani dello Speculatore. Per fortuna era tutto simulato.'),
    refuse: T('Le chiavi API non si inseriscono mai su siti sconosciuti. E la fila non si salta.') },
  { id: 'rug', who: T('Speculatore'), source: 'ip_rugpull', bias: 'fomo', loss: 0.05,
    text: T('"Nuovo token, team anonimo ma geniale. Rendimento del 1.000% l\'anno in staking!"'),
    accept: T('Il giorno dopo il sito è sparito con la liquidità: rug pull.'),
    refuse: T('Team anonimo e rendimenti impossibili: segnali di rug pull. Ben visto.') },
];

export const BIAS_INFO: Record<BiasId, { name: string; effect: string; cure: string; topic: 'bias'; source: string }> = {
  fomo: { name: T('FOMO'), effect: T('Le risposte si rimescolano a metà timer.'), cure: T('Che cosa ti protegge meglio dalla FOMO?'), topic: 'bias', source: 'ip_fomo' },
  panico: { name: T('Panico'), effect: T('Il timer è dimezzato.'), cure: T('Cosa conviene fare dopo un forte calo?'), topic: 'bias', source: 'ip_loss_aversion' },
  euforia: { name: T('Eccesso di fiducia'), effect: T('Le spiegazioni non vengono mostrate.'), cure: T('Cosa fare dopo una serie di successi?'), topic: 'bias', source: 'ip_overconfidence' },
  gregge: { name: T('Effetto gregge'), effect: T('Compare una falsa percentuale su una risposta sbagliata.'), cure: T('Come reagire se "tutti comprano"?'), topic: 'bias', source: 'ip_herd' },
};

export const BIAS_CURE_Q: Record<BiasId, [string, string, string, string]> = {
  fomo: [T('Che cosa ti protegge meglio dalla FOMO?'), T('Un piano scritto a mente fredda'), T('Comprare appena qualcosa sale'), T('Seguire i social')],
  panico: [T('Cosa conviene fare dopo un forte calo?'), T('Ricontrollare il piano prima di agire'), T('Vendere tutto subito'), T('Spegnere tutto e non guardare mai più')],
  euforia: [T('Cosa fare dopo una serie di successi?'), T('Mantenere le stesse regole di rischio'), T('Aumentare la leva'), T('Smettere di diversificare')],
  gregge: [T('Come reagire se "tutti comprano"?'), T('Valutare con la propria analisi'), T('Comprare perché lo fanno tutti'), T('Comprare il doppio')],
};
