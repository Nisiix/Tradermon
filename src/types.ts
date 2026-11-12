export type Track = 'stocks' | 'etf' | 'crypto' | 'mixed';
export type AssetClass = 'stocks' | 'etf' | 'crypto';
export type RiskProfile = 'prudente' | 'equilibrato' | 'audace';
export type Sector =
  | 'tech' | 'finance' | 'energy' | 'health' | 'consumer' | 'utility'
  | 'bond' | 'gold' | 'crypto' | 'stable' | 'world';

export type BiasId = 'fomo' | 'panico' | 'euforia' | 'gregge';

export type QuizTopic =
  | 'rischio' | 'ordini' | 'diversificazione' | 'costi' | 'bias' | 'gestione'
  | 'macro' | 'analisi' | 'regole'
  | 'stocks_base' | 'stocks_bilanci' | 'stocks_dividendi'
  | 'etf_base' | 'etf_replica' | 'etf_obbligazioni'
  | 'crypto_base' | 'crypto_custodia' | 'crypto_stable'
  | 'mixed_base' | 'mixed_allocazione';

export interface Question {
  id: string;
  topic: QuizTopic;
  diff: 1 | 2 | 3 | 4; // 1 base, 2 intermedio, 3 avanzato, 4 esperto (Lega)
  q: string;
  options: string[];
  answer: number;
  explain: string;
  source: string; // key in SOURCES
}

export interface Source {
  title: string;
  publisher: string;
  url: string;
}

export interface AssetDef {
  id: string;
  ticker: string;
  name: string;
  cls: AssetClass;
  sector: Sector;
  risk: 1 | 2 | 3 | 4 | 5;
  mu: number; // annual drift
  sigma: number; // annual vol
  beta: number;
  dividend: number; // annual yield
  ter?: number;
  desc: string;
  facts: string[]; // level 2..4 info
  unlock: string; // 'starter' | 'badge:N' | 'archive' | 'event'
}

export interface Lesson {
  id: string;
  topic: QuizTopic;
  title: string;
  body: string[];
  source: string;
}

/**
 * Mercato del mondo: SOLO dati reali di Alpaca. Prezzi = ultimo scambio, storia = chiusure giornaliere,
 * indice = S&P 500 (ETF SPY) a base 100. Senza conto collegato resta vuoto (asOf = 0) e il gioco offre
 * solo il percorso di studio.
 */
export interface MarketState {
  /** Giorni di mercato (lunedì-venerdì) trascorsi dall'inizio della partita: tempo reale, non simulato. */
  day: number;
  prices: Record<string, number>;
  history: Record<string, number[]>;
  index: number[];
  /** Mantenuto per i salvataggi precedenti: non genera più alcun prezzo. */
  seed: number;
  climate: 'toro' | 'orso' | 'tempesta' | 'laterale';
  /** Momento dell'ultimo aggiornamento dei prezzi da Alpaca (ms); 0 = mai. */
  asOf: number;
  /** Data (AAAA-MM-GG) dell'ultima chiusura giornaliera scaricata. */
  lastBar: string;
}

export type Difficulty = 'apprendista' | 'investitore' | 'stratega' | 'leggenda';

export interface Position {
  id: string;
  qty: number;
  cost: number; // total cost basis
}

/** Ordine inviato ad Alpaca dal conto di gioco e non ancora concluso (in attesa, o eseguito in parte). */
export interface PendingOrder {
  /** Id dell'ordine su Alpaca. */
  id: string;
  /** client_order_id: tm-<partita>-<numero>, così il registro riconosce i propri ordini. */
  cid: string;
  asset: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  /** Importo in dollari (acquisti a mercato) oppure quantità (limite, stop, vendite). */
  notional?: number;
  qty?: number;
  price?: number;
  /** Liquidità tenuta da parte per l'acquisto finché l'ordine non si chiude. */
  reserved: number;
  /** Quantità e controvalore già registrati (esecuzioni parziali). */
  filledQty: number;
  filledCost: number;
  createdAt: number;
  /** Tappa in corso quando l'acquisto è stato accettato. */
  stage?: number;
  /** Acquisto che non conta per le Prove: titolo già venduto nella Prova in corso, oppure Prova annullata dopo l'ordine. */
  noCredit?: boolean;
  /** Etichetta nel registro: mercato, limite, stop, ribilanciamento, liquidazione. */
  tag: string;
  /** Acquisto fatto usando la leva. */
  lev?: boolean;
}

export interface OpenOrder {
  id: string;
  asset: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'stop';
  qty: number;
  price: number;
  createdDay: number;
  /** Giorno di mercato dopo il quale l'ordine scade (validità "fino a revoca" limitata a 20 giorni). */
  expiresDay?: number;
}

export interface OrderLog {
  day: number;
  asset: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  fee: number;
  type: string;
}

export interface Portfolio {
  cash: number;
  initial: number;
  contributed: number;
  positions: Position[];
  orders: OpenOrder[];
  log: OrderLog[];
  peak: number;
  valueHistory: number[];
  /** Data (AAAA-MM-GG) di ogni punto di valueHistory: il conto si misura solo nei giorni in cui il gioco lo vede. */
  valueDays?: string[];
  eggs: { asset: string; amount: number; hatchDay: number }[];
  drip: boolean;
  monthly: number;
  refillsUsed: number;
  target: { risky: number; defensive: number; cash: number };
  // ---- conto di gioco dentro il conto Alpaca Paper ----
  /** Ordini reali ancora aperti su Alpaca. */
  pending: PendingOrder[];
  /** Numero progressivo degli ordini (per il client_order_id). */
  orderSeq: number;
  /** Totale degli acquisti accettati da Alpaca dall'inizio: misura le rate di tappa. */
  bought: number;
  /** Acquisti che non contano più: quelli delle Prove annullate da una vendita. Per le Prove vale bought − exVoid. */
  exVoid?: number;
  /** Acquisti che contano per la Prova in corso, titolo per titolo: vendere uno di questi titoli la annulla. */
  exBuys?: Record<string, number>;
  /** Titoli venduti durante la Prova in corso: non contano finché non è completata. */
  exBarred?: string[];
  /** Tappa la cui Prova è andata male (annullata) e non è ancora stata rifatta. */
  exFailed?: number;
  /** Quota riconosciuta alle Prove chiuse con l'opzione "prosegui anche se va male", e quali tappe. */
  exSkip?: number;
  exIgnored?: number[];
  /** Costi didattici addebitati dal gioco (solo Paper), tenuti separati dai prezzi reali. */
  costs: number;
  /** Prestito per la leva e data dell'ultimo interesse calcolato (AAAA-MM-GG). */
  loan: number;
  interestDay: string;
  /** Chiamata di margine: momento in cui il giocatore l'ha vista (0 = nessuna). */
  marginCallAt: number;
  /** Bancarotte subite. */
  bankruptcies: number;
  /** Impronta del conto Alpaca a cui il registro è legato (per accorgersi di un conto azzerato). */
  accountTag: string;
  /** Operazioni fatte fuori dal gioco e scoperte dalla riconciliazione. */
  external: { t: number; asset: string; qty: number; note: string }[];
  /** Risultato realizzato dalle vendite (dentro e fuori dal gioco), ai prezzi veri di esecuzione: negativo = perdite. */
  realized?: number;
  /** Momento dell'ultima riconciliazione con Alpaca: le vendite esterne più vecchie sono già nel registro. */
  reconAt?: number;
}

export interface CardState {
  xp: number;
  gold: boolean;
  flawless: boolean;
  seen: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  name: string;
  avatar: number;
  /** Genere del protagonista: accorda i testi e sceglie lo sprite. Assente nei vecchi salvataggi = 'm'. */
  gender?: 'm' | 'f';
  rival: string;
  profile: RiskProfile;
  profileScore: number;
  goal: string;
  horizon: string;
  track: Track;
  mixedClasses: AssetClass[];
  map: string;
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  flags: Record<string, boolean | number | string>;
  badges: number;
  techniques: string[];
  stats: {
    xp: number;
    fiducia: number;
    disciplina: number;
    pazienza: number;
    reputazione: number;
  };
  bias: BiasId | null;
  biasSeen: BiasId[];
  cards: Record<string, CardState>;
  lessonsRead: string[];
  /** Libri letti sugli scaffali delle Biblioteche (id in data/books.ts). */
  booksRead: string[];
  tipsHeard: string[];
  defeated: string[];
  visited: string[];
  portfolio: Portfolio;
  market: MarketState;
  /** Identificativo breve della partita: marca gli ordini inviati ad Alpaca. */
  saveId: string;
  /** Difficoltà scelta all'inizio: fissa il capitale del conto di gioco e non si cambia più. */
  difficulty: Difficulty;
  /** Sigilli pratici ottenuti (0-8): Attestato più Prova sul conto della tappa, in ordine. */
  seals: number;
  /** Esercizi di tappa completati (0-9): il prossimo da fare è quello con questo numero. */
  exDone: number;
  /** Attrezzi usati nell'esercizio in corso (ordine limite, stop). */
  exTools: { limit: boolean; stop: boolean };
  /** Esame della Leva superato. */
  levExam: boolean;
  /** Ultimo avvio del gioco con il conto raggiungibile (per "Mentre eri via"). */
  lastSeen: { t: number; value: number };
  /** Boss dell'endgame: sfida in corso e boss battuti. */
  boss: BossState;
  review: Record<string, number>; // question id -> box 1..3
  /** Ripetizione spaziata: data (AAAA-MM-GG) in cui la domanda torna nel ripasso. */
  reviewDue: Record<string, string>;
  answered: Record<string, number>;
  daily: { lastDate: string; streak: number };
  tower: { best: number };
  legends: string[];
  stepCounter: number;
  lastClinic: { map: string; x: number; y: number };
  ngPlus: number;
  playMs: number;
  options: { textSpeed: number; fontScale: number; contrast: boolean; studyMode: boolean; volume: number; music: number; gfx: '2d' | '3d'; fx: 'alti' | 'bassi'; /** Prosegui anche se una Prova sul conto va male (solo Apprendista e Investitore). */ ignoreProva?: boolean };
  // ---- novità: agenda, traguardi, casa, storie, diario, minigiochi, sfide ----
  counters: Record<string, number>;
  agenda: { day: string; week: string; daily: AgendaTask[]; weekly: AgendaTask[]; dailyDone: number };
  achievements: string[];
  title: string;
  decor: string[];
  rematch: Record<string, string>;
  quests: Record<string, number>;
  journal: JournalEntry[];
  minigames: Record<string, number>;
  challenges: { code: string; score: number; date: string; label: string }[];
  npcMemory: Record<string, number>;
}

export interface BossPlan {
  asset: string;
  side: 'long';
  entry: number;
  stop: number;
  target: number;
  /** Quota del capitale del boss messa a rischio (0-1). */
  risk: number;
  /** Momento dell'invio e scadenza del mandato (ms). */
  placedAt: number;
  deadline: number;
  /** Punti di qualità del piano, calcolati all'invio (prima di conoscere l'esito). */
  quality: number;
  /** Il piano ha inviato ordini veri sul conto di gioco (i piani precedenti erano mandati solo sulla carta). */
  real?: boolean;
  /** Importo comprato in dollari e quantità eseguita all'ingresso. */
  amount?: number;
  qty?: number;
  /** Quantità venduta e ricavo delle vendite del mandato (stop scattato, obiettivo incassato, chiusura a scadenza). */
  sold?: number;
  proceeds?: number;
}
export interface BossRun { id: string; quiz: number; quizMax: number; plan: BossPlan | null; startedAt: number }
/** `runs`: sfide in corso, una per Boss (i mandati corrono in parallelo). `run` resta per i salvataggi precedenti. */
/** `barred`: per ogni Boss, il titolo venduto durante l'ultimo mandato (la sfida annullata si ripete con un titolo diverso). */
export interface BossState { run: BossRun | null; runs?: Record<string, BossRun>; beaten: string[]; tries: Record<string, number>; barred?: Record<string, string> }

export interface AgendaTask { id: string; ev: string; need: number; got: number; done: boolean }

export interface JournalEntry {
  id: string;
  day: number;
  date: string;
  asset: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  reason: string;
  note: string;
  account: 'prova' | 'paper';
  reviewed: boolean;
}
