// Regola del mondo (utente, 15/11): le domande seguono il viaggio. Ogni domanda ha una città minima: quella in cui
// il suo argomento entra in Biblioteca, oppure più avanti se la domanda o la sua risposta usano un concetto che il
// viaggio insegna dopo (ordini a Porto Ordini, correlazione a Diversia, costi a Interessa, dividendi e DeFi a
// Valdividendo, leva a Rocca Rischio...). Prima di quella città la domanda non si chiede, in nessun duello.
// Le spiegazioni e le risposte sbagliate possono nominare concetti futuri: conta solo ciò che serve per rispondere.
import type { AssetClass, Question, QuizTopic, Track } from '../../types';
import { mentorTopics, ACADEMY_TOPICS } from './build';

/** Città 9 = Wall Street, 10 = fine gioco (Accademia di Wall Street, dopo il titolo di Campione). */
export const CITY_WALL_STREET = 9;
export const CITY_ENDGAME = 10;

/** Concetti e città in cui il viaggio li insegna, uguale per tutti i Sentieri. */
export const CONCEPT_CITY: [number, string[]][] = [
  [2, ['ordine limite', 'ordine stop', 'stop loss', 'stop limit', 'slippage', 'spread', 'allo scoperto', 'libro degli ordini']],
  [3, ['correlazion', 'ribilanc', 'asset allocation']],
  [4, ['interesse composto', 'ter', 'regola del 72', 'piano di accumulo', 'rendimento reale']],
  [5, ['conto economico', 'stato patrimoniale', 'eps', 'ebitda', 'utile per azione', 'margine operativo', 'replica sintetica', 'swap', 'tracking', 'seed phrase', 'chiave privata', 'hardware wallet', 'wallet freddo', 'non custodial']],
  [6, ['dividend', 'payout', 'buyback', 'cedol', 'duration', 'rating', 'high yield', 'stablecoin', 'defi', 'staking', 'pool', 'amm', 'impermanente', 'bridge']],
  [7, ['bias', 'fomo', 'ancoraggio', 'avversione alle perdite', 'gregge', 'eccesso di fiducia']],
  [8, ['leva', 'margin call', 'conto a margine', 'margine di mantenimento', 'position sizing', 'trailing', 'martingala', 'rischio/rendimento']],
  [9, ['rsi', 'media mobile', 'analisi tecnica', 'analisi fondamentale', 'pil', 'bce', 'quantitative easing', 'curva dei rendimenti', 'stagflazione', 'market maker']],
  [10, ['opzion', 'opzione call', 'opzione put', 'future', 'derivat', 'cfd']],
];

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// le parole corte valgono solo intere («ter» non è dentro «interesse», «leva» non è dentro «solleva»)
const RX = CONCEPT_CITY.map(([n, ws]) => [n, ws.map((w) => new RegExp(`(^|[^a-zà-ù0-9])${esc(w)}${w.length > 4 ? '' : '([^a-zà-ù0-9]|$)'}`, 'i'))] as const);

/** Città in cui il viaggio insegna l'ultimo dei concetti che servono per rispondere (1 se nessuno). */
export function conceptCity(q: Pick<Question, 'q' | 'options' | 'answer'>): number {
  const text = `${q.q} ${q.options[q.answer]}`;
  let c = 1;
  for (const [n, rxs] of RX) if (n > c && rxs.some((r) => r.test(text))) c = n;
  return c;
}

/** Città in cui l'argomento entra in Biblioteca per questo Sentiero. */
export function topicCity(topic: QuizTopic, track: Track, mixed: AssetClass[] = []): number {
  if (topic === 'grotte') return 1; // le grotte hanno le loro regole (si aprono con la Lanterna)
  if (topic === 'regole' || topic === 'personale' || topic === 'tassi') return 1; // scaffali comuni, aperti da subito
  if (ACADEMY_TOPICS.includes(topic)) return CITY_ENDGAME;
  for (let n = 1; n <= 8; n++) if (mentorTopics(n, track, mixed).includes(topic)) return n;
  return CITY_WALL_STREET;
}

const cache = new Map<string, number>();
/** Prima città in cui la domanda si può chiedere. */
export function questionCity(q: Question, track: Track, mixed: AssetClass[] = []): number {
  const k = `${track}|${mixed.join(',')}|${q.id}`;
  let c = cache.get(k);
  if (c === undefined) cache.set(k, (c = Math.max(topicCity(q.topic, track, mixed), conceptCity(q))));
  return c;
}
