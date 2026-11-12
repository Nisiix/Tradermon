// Domande generate: stesse situazioni, scenari nuovi a ogni duello.
// Rispondono al problema "il quiz premia la memoria": chi ha imparato la risposta a memoria deve comunque
// rileggere lo scenario (prezzi, soglie, importi cambiano ogni volta).
// Regola (richiesta dell'utente, 2026-11-12): nessun modello chiede calcoli. Si ragiona sul concetto
// (un ordine si esegue o no, cosa fa uno stop in caso di gap, chi custodisce cosa, quale bias agisce),
// mai su percentuali o formule da svolgere.
import type { Question, QuizTopic, Portfolio } from '../../types';
import type { Rng } from '../../systems/rng';
import { T } from '../../i18n';

export interface GenContext { portfolio?: Portfolio; prices?: Record<string, number>; names?: Record<string, string> }
export interface Template {
  id: string;
  topics: QuizTopic[];
  diff: 1 | 2 | 3 | 4;
  source: string;
  gen: (rng: Rng, ctx: GenContext) => { q: string; options: [string, string, string, string]; explain: string } | null;
}

export const GEN_PREFIX = 'gen_';
export const isGenerated = (id: string) => id.startsWith(GEN_PREFIX);

// ---------- formattazione all'italiana ----------
export function num(x: number, dec = 0): string {
  const s = Math.abs(x).toFixed(dec);
  const [int, frac] = s.split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (x < 0 ? '−' : '') + withDots + (frac ? ',' + frac : '');
}
export const pct = (x: number, dec = 0) => `${num(x, dec)}%`;
export const eur = (x: number, dec = 0) => `${num(x, dec)} euro`;
const between = (rng: Rng, lo: number, hi: number, step = 1) => lo + step * Math.floor(rng() * ((hi - lo) / step + 1));

/** Quattro opzioni distinte: se due errori coincidono tra loro o con la risposta, si sostituiscono con varianti. */
function distinct(opts: string[], fallback: (i: number) => string): [string, string, string, string] {
  const out: string[] = [];
  let k = 0;
  for (const o of opts) {
    let v = o;
    while (out.includes(v)) v = fallback(k++);
    out.push(v);
  }
  return out as [string, string, string, string];
}

const TPL = (id: string, topics: QuizTopic[], diff: 1 | 2 | 3 | 4, source: string, gen: Template['gen']): Template => ({ id, topics, diff, source, gen });

export const TEMPLATES: Template[] = [
  TPL('limite', ['ordini'], 1, 'ig_order_types', (rng) => {
    const p = between(rng, 20, 120, 5);
    const lim = p - between(rng, 2, 10);
    const low = rng() < 0.5 ? lim - between(rng, 1, 3) : lim + between(rng, 1, 3);
    const fills = low <= lim;
    return {
      q: T`Il titolo vale ${p}. Metti un ordine limite di acquisto a ${lim}. In giornata il minimo toccato è ${low}. L'ordine si esegue?`,
      options: fills
        ? [T`Sì, a ${lim} o meno: il minimo ${low} ha raggiunto il limite`, T`No, perché il prezzo di chiusura è rimasto sopra ${lim}`, T`Sì, ma a ${p}: il limite vale solo come promemoria`, T`No, un ordine limite si esegue solo al prezzo esatto ${lim}`]
        : [T`No: il minimo ${low} non ha mai raggiunto ${lim}, l'ordine resta in attesa`, T`Sì, a ${low}: il broker esegue al prezzo migliore disponibile`, T`Sì, a ${lim}: l'ordine limite garantisce l'esecuzione in giornata`, T`No, e l'ordine viene annullato perché il prezzo si è avvicinato troppo`],
      explain: fills
        ? T`Un limite di acquisto a ${lim} si esegue quando il mercato tocca ${lim} o meno: il minimo ${low} lo ha fatto. Si compra a ${lim} o meglio, mai di più.`
        : T`Un limite di acquisto a ${lim} si esegue solo se il prezzo scende fino a ${lim}: il minimo è stato ${low}. L'ordine resta valido fino alla scadenza.`,
    };
  }),
  TPL('stop_gap', ['ordini', 'gestione'], 3, 'ig_stop_order', (rng) => {
    const buy = between(rng, 40, 120, 5);
    const stop = buy - between(rng, 3, 10);
    const open = stop - between(rng, 4, 12);
    return {
      q: T`Hai comprato a ${buy} con uno stop di vendita a ${stop}. Dopo una notizia notturna il titolo apre direttamente a ${open}. Cosa succede?`,
      options: distinct([
        T`Lo stop diventa un ordine a mercato: vendi intorno a ${open}, sotto la soglia scelta`,
        T`Vendi esattamente a ${stop}, perché lo stop garantisce sempre e comunque il prezzo che hai indicato`,
        T`Lo stop non scatta, perché il prezzo ha saltato la soglia: resti con il titolo a ${open}`,
        T`Vendi a ${buy}: in caso di gap il broker ti rimborsa il prezzo che avevi pagato`,
      ], (i) => T`Vendi a ${open - i - 1}`),
      explain: T`Lo stop si attiva quando il prezzo tocca o scende sotto ${stop} e diventa un ordine a mercato: con un gap si vende al primo prezzo disponibile, circa ${open}. Lo stop limita il rischio ma non garantisce il prezzo (rischio di gap).`,
    };
  }),
  TPL('custodia', ['crypto_custodia', 'crypto_base'], 2, 'ip_private_key', (rng) => {
    const onEx = between(rng, 500, 8000, 500);
    const onHw = between(rng, 500, 8000, 500);
    return {
      q: T`Hai ${eur(onEx)} di cripto su un exchange e ${eur(onHw)} in un hardware wallet di cui solo tu hai la seed phrase. L'exchange fallisce senza garanzie. Quanto rischi di perdere?`,
      options: [
        T`Solo i ${eur(onEx)} lasciati sull'exchange: il wallet con le tue chiavi non dipende da lui`,
        T`Anche i ${eur(onHw)} nel wallet, perché l'exchange controlla tutte le cripto che hai comprato da lui`,
        T`Solo i ${eur(onHw)} nel wallet hardware, perché l'exchange rimborsa sempre i clienti`,
        T`Nulla: la blockchain restituisce da sola le cripto ai legittimi proprietari`,
      ],
      explain: T`Sull'exchange sei un creditore: i ${num(onEx)} euro dipendono dalla sua solvibilità. Le cripto nel wallet con le tue chiavi (${num(onHw)} euro) non passano dall'exchange: "not your keys, not your coins" vale anche al contrario.`,
    };
  }),
  TPL('ancora', ['bias'], 2, 'ip_anchoring', (rng) => {
    const buy = between(rng, 30, 120, 5);
    const now = buy - between(rng, 5, Math.round(buy * 0.4), 5);
    return {
      q: T`Hai comprato a ${buy}; oggi il titolo vale ${now} e i fondamentali sono peggiorati. Pensi: "Vendo appena torna a ${buy}". Quale bias ti sta guidando?`,
      options: [
        T`Ancoraggio al prezzo di carico: ${buy} non conta, conta il valore di oggi`,
        T`Avversione al rischio: aspettare ${buy} è la scelta prudente e azzera la perdita`,
        T`Nessun bias: il prezzo di acquisto ${buy} è il riferimento corretto per ogni decisione futura`,
        T`Effetto gregge: conviene vendere a ${now} solo se lo stanno facendo anche gli altri azionisti`,
      ],
      explain: T`Il mercato non sa che hai pagato ${buy}: il prezzo di carico è un'ancora che non dice nulla sul futuro. La domanda giusta è: "Lo comprerei oggi a ${now}?". Se no, la perdita è già avvenuta: tenerlo è solo rimandare.`,
    };
  }),
];

/** Genera una domanda per il duello: `seedId` rende l'id unico anche se lo stesso modello esce due volte. */
export function generate(t: Template, topic: QuizTopic, rng: Rng, ctx: GenContext = {}): Question | null {
  for (let tries = 0; tries < 4; tries++) {
    const r = t.gen(rng, ctx);
    if (!r) continue;
    if (new Set(r.options).size < 4) continue;
    return { id: `${GEN_PREFIX}${t.id}`, topic, diff: t.diff, q: r.q, options: r.options, answer: 0, explain: r.explain, source: t.source };
  }
  return null;
}

/** Modelli adatti agli argomenti dati, più vicini alla difficoltà richiesta prima. */
export function templatesFor(topics: QuizTopic[], target: number): { t: Template; topic: QuizTopic }[] {
  const out: { t: Template; topic: QuizTopic }[] = [];
  for (const t of TEMPLATES) {
    const topic = t.topics.find((x) => topics.includes(x));
    if (topic && Math.abs(t.diff - target) <= 1.5) out.push({ t, topic });
  }
  return out.sort((a, b) => Math.abs(a.t.diff - target) - Math.abs(b.t.diff - target));
}
