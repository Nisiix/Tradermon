export type Track = 'stocks' | 'etf' | 'crypto' | 'mixed';
export type AssetClass = 'stocks' | 'etf' | 'crypto';
export type RiskProfile = 'prudente' | 'equilibrato' | 'audace';
export type Sector =
  | 'tech' | 'finance' | 'energy' | 'health' | 'consumer' | 'utility'
  | 'bond' | 'gold' | 'crypto' | 'stable' | 'world';

export type BiasId = 'fomo' | 'panico' | 'euforia' | 'gregge';

export type QuizTopic =
  | 'rischio' | 'ordini' | 'diversificazione' | 'costi' | 'bias' | 'gestione'
  | 'macro' | 'analisi' | 'regole' | 'esame'
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

export interface MarketState {
  day: number;
  prices: Record<string, number>;
  history: Record<string, number[]>;
  index: number[];
  seed: number;
  climate: 'toro' | 'orso' | 'tempesta' | 'laterale';
}

export interface Position {
  id: string;
  qty: number;
  cost: number; // total cost basis
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
  eggs: { asset: string; amount: number; hatchDay: number }[];
  drip: boolean;
  monthly: number;
  refillsUsed: number;
  target: { risky: number; defensive: number; cash: number };
}

export interface CardState {
  xp: number;
  gold: boolean;
  flawless: boolean;
  seen: number;
}

export interface LiveLimits {
  perOrder: number;
  perMonth: number;
  pauseUntil: number;
  monthKey: string;
  spentThisMonth: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  name: string;
  avatar: number;
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
  review: Record<string, number>; // question id -> box 1..3
  /** Ripetizione spaziata: data (AAAA-MM-GG) in cui la domanda torna nel ripasso. */
  reviewDue: Record<string, string>;
  answered: Record<string, number>;
  daily: { lastDate: string; streak: number };
  tower: { best: number };
  legends: string[];
  stepCounter: number;
  lastClinic: { map: string; x: number; y: number };
  license: 'apprendista' | 'esame' | 'investitore';
  examLastFail: number;
  liveLimits: LiveLimits;
  liveAudit: { t: number; symbol: string; side: string; notional: number; status: string; id: string }[];
  ngPlus: number;
  playMs: number;
  options: { textSpeed: number; fontScale: number; contrast: boolean; studyMode: boolean; volume: number; music: number; gfx: '2d' | '3d'; fx: 'alti' | 'bassi' };
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
  account: 'prova' | 'paper' | 'reale';
  reviewed: boolean;
}
