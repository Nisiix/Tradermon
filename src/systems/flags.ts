// Registro dei flag del salvataggio (S.flags). I flag sono la memoria della storia: un nome sbagliato in un punto
// e giusto in un altro rompe una scena senza errori visibili. Qui c'è l'elenco di tutti i nomi usati, con il loro
// significato; tests/flags.test.ts cerca nel codice ogni nome scritto per esteso e controlla che sia registrato.
// Chi aggiunge un flag lo aggiunge qui.

/** Flag con un nome fisso. */
export const FLAGS: Record<string, string> = {
  starter: 'Valigetta scelta nel Laboratorio',
  starterAsset: 'titolo della Valigetta (id)',
  profIntro: 'il Professore ha fatto la presentazione',
  momIntro: 'la mamma ha salutato alla partenza',
  rivalStyle: 'stile di Leo, deciso dalle risposte del questionario',
  champion: 'Wall Street vinta (Torre, Accademia, Boss, Nuova Partita+)',
  wsRound: 'giro delle rivincite di Wall Street (0..4)',
  academyAll: 'superati i tre Tutor dell\'Accademia di Wall Street',
  archiveBonus: 'bonus di studio dell\'Archivio già dato',
  casinoLesson: 'lezione della martingala al Casinò',
  scamLesson: 'lezione sulle truffe dopo il primo speculatore',
  missionNoLossSale: 'missione completata senza vendere in perdita',
  legendMet: 'parlato con l\'Investitrice Leggendaria',
  bossRules: 'spiegate le regole dei Boss dei Mercati',
  provaRules: 'spiegate le regole delle Prove sul conto',
  medalRule: 'la prima Whale ha spiegato Attestato e Sigillo',
  oysterRule: 'spiegata la regola delle ostriche',
  caveEntry: 'casella da cui si è entrati nella grotta (x,y): ci si torna dalle gallerie-trappola',
  caveTip: 'consiglio della Lanterna già dato',
  raftTip: 'consiglio della barchetta già dato',
  seaVisited: 'prima uscita in mare aperto',
  doorNotice_league: 'avviso sulla porta di Wall Street già mostrato',
  firstBuy: 'primo acquisto sul conto di gioco',
  bankrupt: 'bancarotta del conto di gioco in corso',
  sealPaid: 'ultimo Sigillo per cui è stato dato il premio',
  useLev: 'leva di gioco attiva',
  levFail: 'ora dell\'ultimo Esame della Leva fallito',
  ignoreHint: 'spiegato «ignora la Prova»',
  patDay: 'ultimo giorno in cui la Pazienza è salita tenendo le posizioni',
  vhDay: 'ultimo giorno di borsa in cui si è registrato il valore del conto',
  migratedV3: 'salvataggio convertito alla versione 3',
  leoTourT1: 'giro di Ponte Cedola con Leo concluso',
  mirror: 'osservazioni del profilo di rischio rivelato (testo)',
  islet_faro: 'isolotto del Faro visitato',
  islet_perle: 'isolotto delle Perle visitato',
  secret_tape_open: 'Sala del Nastro aperta',
  secret_tape_won: 'sfida della Sala del Nastro vinta',
  secret_whale: 'incontrato lo Squalo del fine settimana',
  secret_hodl: 'rituale delle Mani di Diamante compiuto',
};

/** Flag con una parte variabile (città, tappa, mappa, id): la forma del nome e il significato. */
export const FLAG_PATTERNS: [RegExp, string][] = [
  [/^m\d+_(mission|p1|perfect)$/, 'Whale n: missione riuscita, quiz superato (resta la prova pratica), duello perfetto'],
  [/^[a-z0-9_]+_(stars|fails)$/, 'stelle di processo o tentativi di una missione (per id della missione)'],
  [/^league_\d_p1$/, 'quiz del Superiore i superato (resta la prova pratica)'],
  [/^doorNotice_\d$/, 'avviso sulla porta dell\'Exchange n già mostrato'],
  [/^lib_intro_\d$/, 'presentazione della Biblioteca n già fatta'],
  [/^shelf_\d$/, 'letti tutti i libri dei temi della città n'],
  [/^hist_[a-z0-9]+$/, 'crisi storica letta (Zona Simulazione o Storie dei mercati)'],
  [/^visited_[a-z0-9_]+$/, 'mappa visitata'],
  [/^islet_[a-z0-9]+$/, 'isolotto visitato'],
  [/^academy_(derivati|mercato|trading)$/, 'Tutor dell\'Accademia battuto'],
  [/^[a-z0-9_]+_(lock|wrong)$/, 'riprova bloccata finché non si ripassa, e domande sbagliate (systems: lockRetry)'],
  [/^caveGuide_[a-z]+$/, 'la guida della grotta ha fatto la presentazione'],
  [/^relic_[a-z0-9_]+$/, 'reperto di grotta raccolto'],
  [/^trap_[a-z0-9_]+$/, 'galleria-trappola già scoperta'],
  [/^sign_[a-z0-9_]+_\d+_\d+$/, 'incisione di grotta letta'],
  [/^secret_page_[a-z0-9_]+$/, 'pagina segreta trovata'],
];

/** Il nome è registrato (fisso o secondo una forma)? */
export function knownFlag(name: string): boolean {
  return name in FLAGS || FLAG_PATTERNS.some(([re]) => re.test(name));
}
