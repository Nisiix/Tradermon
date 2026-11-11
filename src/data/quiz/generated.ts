// Domande generate: stessi concetti, numeri nuovi a ogni duello.
// Rispondono al problema "il quiz premia la memoria": un giocatore che ha imparato la risposta a memoria
// deve comunque rifare il calcolo o il ragionamento, perché prezzi, percentuali e importi cambiano ogni volta.
// Ogni modello produce la risposta giusta e tre errori tipici (formula invertita, percentuale sbagliata, segno sbagliato),
// tutti scritti nello stesso formato, così la forma non tradisce la soluzione.
import type { Question, QuizTopic, Portfolio } from '../../types';
import type { Rng } from '../../systems/rng';

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
const pickOf = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
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

const T = (id: string, topics: QuizTopic[], diff: 1 | 2 | 3 | 4, source: string, gen: Template['gen']): Template => ({ id, topics, diff, source, gen });

export const TEMPLATES: Template[] = [
  T('recupero', ['rischio', 'crypto_base'], 1, 'ip_mdd', (rng) => {
    const d = pickOf(rng, [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80]);
    const need = (d / (100 - d)) * 100;
    const r = Math.round(need);
    return {
      q: `Un titolo perde il ${d}%. Di quanto deve salire per tornare al prezzo di partenza?`,
      options: distinct([`+${r}%`, `+${d}%`, `+${d + 10}%`, `+${Math.round(d * 1.5)}%`], (i) => `+${r + 5 * (i + 1)}%`),
      explain: `Dopo −${d}% resta il ${100 - d}% del capitale: per tornare a 100 serve ${d} / ${100 - d} = +${num(need, 1)}%. Le perdite pesano più dei guadagni di pari percentuale.`,
    };
  }),
  T('drawdown', ['rischio'], 2, 'ip_mdd', (rng) => {
    const peak = between(rng, 80, 200, 10);
    const trough = peak - between(rng, 10, Math.round(peak * 0.6), 5);
    const dd = ((peak - trough) / peak) * 100;
    return {
      q: `Un fondo tocca un massimo di ${peak}, scende fino a ${trough} e poi risale. Qual è stato il massimo drawdown?`,
      options: distinct([pct(dd, 1), pct(((peak - trough) / trough) * 100, 1), pct((trough / peak) * 100, 1), pct(peak - trough, 1)], (i) => pct(dd + 7 * (i + 1), 1)),
      explain: `Drawdown = (massimo − minimo) / massimo = (${peak} − ${trough}) / ${peak} = ${num(dd, 1)}%. Si misura sempre rispetto al punto più alto.`,
    };
  }),
  T('sharpe', ['rischio', 'analisi'], 3, 'ip_sharpe', (rng) => {
    const rf = pickOf(rng, [1, 2, 3]);
    const ra = between(rng, 6, 14), va = between(rng, 10, 30, 2);
    const rb = between(rng, 4, 9), vb = between(rng, 4, 10);
    const sa = (ra - rf) / va, sb = (rb - rf) / vb;
    if (Math.abs(sa - sb) < 0.05) return null;
    const aWins = sa > sb;
    const win = aWins ? 'A' : 'B', lose = aWins ? 'B' : 'A';
    return {
      q: `Tasso senza rischio ${rf}%. Fondo A: rendimento ${ra}%, volatilità ${va}%. Fondo B: rendimento ${rb}%, volatilità ${vb}%. Quale ha l'indice di Sharpe più alto?`,
      options: [
        `${win}, con Sharpe circa ${num(Math.max(sa, sb), 2)} contro ${num(Math.min(sa, sb), 2)}`,
        `${lose}, con Sharpe circa ${num(Math.min(sa, sb) + 0.3, 2)} contro ${num(Math.max(sa, sb) - 0.1, 2)}`,
        `A, perché il rendimento più alto vale più di qualsiasi volatilità`,
        `B, perché la volatilità più bassa vale più di qualsiasi rendimento`,
      ],
      explain: `Sharpe = (rendimento − tasso senza rischio) / volatilità. A: (${ra} − ${rf}) / ${va} = ${num(sa, 2)}; B: (${rb} − ${rf}) / ${vb} = ${num(sb, 2)}. Vince ${win}: più rendimento per unità di rischio.`,
    };
  }),
  T('limite', ['ordini'], 1, 'ig_order_types', (rng) => {
    const p = between(rng, 20, 120, 5);
    const lim = p - between(rng, 2, 10);
    const low = rng() < 0.5 ? lim - between(rng, 1, 3) : lim + between(rng, 1, 3);
    const fills = low <= lim;
    return {
      q: `Il titolo vale ${p}. Metti un ordine limite di acquisto a ${lim}. In giornata il minimo toccato è ${low}. L'ordine si esegue?`,
      options: fills
        ? [`Sì, a ${lim} o meno: il minimo ${low} ha raggiunto il limite`, `No, perché il prezzo di chiusura è rimasto sopra ${lim}`, `Sì, ma a ${p}: il limite vale solo come promemoria`, `No, un ordine limite si esegue solo al prezzo esatto ${lim}`]
        : [`No: il minimo ${low} non ha mai raggiunto ${lim}, l'ordine resta in attesa`, `Sì, a ${low}: il broker esegue al prezzo migliore disponibile`, `Sì, a ${lim}: l'ordine limite garantisce l'esecuzione in giornata`, `No, e l'ordine viene annullato perché il prezzo si è avvicinato troppo`],
      explain: fills
        ? `Un limite di acquisto a ${lim} si esegue quando il mercato tocca ${lim} o meno: il minimo ${low} lo ha fatto. Si compra a ${lim} o meglio, mai di più.`
        : `Un limite di acquisto a ${lim} si esegue solo se il prezzo scende fino a ${lim}: il minimo è stato ${low}. L'ordine resta valido fino alla scadenza.`,
    };
  }),
  T('stop_gap', ['ordini', 'gestione'], 3, 'ig_stop_order', (rng) => {
    const buy = between(rng, 40, 120, 5);
    const stop = buy - between(rng, 3, 10);
    const open = stop - between(rng, 4, 12);
    const loss = ((buy - open) / buy) * 100, planned = ((buy - stop) / buy) * 100;
    return {
      q: `Hai comprato a ${buy} con uno stop di vendita a ${stop}. Dopo una notizia il titolo apre direttamente a ${open}. Cosa succede?`,
      options: distinct([
        `Vendi intorno a ${open}: circa −${num(loss, 1)}% invece del −${num(planned, 1)}% previsto`,
        `Vendi esattamente a ${stop}: lo stop garantisce quel prezzo, perdita −${num(planned, 1)}%`,
        `Lo stop non scatta perché il prezzo lo ha saltato: resti con il titolo a ${open}`,
        `Vendi a ${buy}: con un gap il broker rimborsa il prezzo di acquisto`,
      ], (i) => `Vendi a ${open - i - 1}`),
      explain: `Lo stop diventa un ordine a mercato quando il prezzo tocca o supera ${stop} al ribasso: con un gap si vende al primo prezzo disponibile, circa ${open}. Perdita ≈ (${buy} − ${open}) / ${buy} = ${num(loss, 1)}%.`,
    };
  }),
  T('peso', ['diversificazione', 'gestione', 'mixed_base'], 1, 'ig_diversify', (rng, ctx) => {
    let total = between(rng, 5000, 20000, 500);
    let value = between(rng, 500, Math.round(total * 0.7), 100);
    let name = 'un solo titolo';
    const pf = ctx.portfolio;
    if (pf && ctx.prices && pf.positions.length) {
      const px = (p: { id: string; qty: number; cost: number }) => ctx.prices?.[p.id] ?? (p.qty ? p.cost / p.qty : 0);
      const pos = pickOf(rng, pf.positions);
      const v = pos.qty * px(pos);
      const tot = pf.cash + pf.positions.reduce((s, p) => s + p.qty * px(p), 0);
      if (v > 0 && tot > v) { value = Math.round(v); total = Math.round(tot); name = `la tua posizione su ${ctx.names?.[pos.id] ?? pos.id}`; }
    }
    const w = (value / total) * 100;
    return {
      q: `Il tuo portafoglio vale ${eur(total)} e ${name} vale ${eur(value)}. Che peso ha quella posizione?`,
      options: distinct([pct(w, 1), pct((value / (total - value)) * 100, 1), pct(((total - value) / total) * 100, 1), pct(w / 2, 1)], (i) => pct(w + 4 * (i + 1), 1)),
      explain: `Peso = valore della posizione / valore totale = ${num(value)} / ${num(total)} = ${num(w, 1)}%. Sopra il 20-25% su un solo titolo il rischio specifico comincia a pesare.`,
    };
  }),
  T('ter', ['costi', 'etf_base'], 1, 'ip_ter', (rng) => {
    const amt = between(rng, 2000, 50000, 1000);
    const ter = pickOf(rng, [0.07, 0.1, 0.2, 0.25, 0.5, 1, 1.5, 2]);
    const cost = (amt * ter) / 100;
    return {
      q: `Investi ${eur(amt)} in un fondo con TER ${pct(ter, 2)}. Quanto costa la gestione in un anno?`,
      options: distinct([eur(cost, 2), eur(cost * 10, 2), eur(cost / 10, 2), eur(amt * ter, 2)], (i) => eur(cost * (i + 3), 2)),
      explain: `${num(ter, 2)}% di ${num(amt)} = ${num(cost, 2)} euro, trattenuti ogni anno dal valore del fondo. Piccolo oggi, pesante in trent'anni.`,
    };
  }),
  T('costi_lungo', ['costi'], 3, 'ig_compound', (rng) => {
    const amt = between(rng, 5000, 30000, 5000);
    const years = pickOf(rng, [15, 20, 25, 30]);
    const ret = pickOf(rng, [5, 6, 7]);
    const lo = pickOf(rng, [0.1, 0.2, 0.3]), hi = pickOf(rng, [1.5, 2, 2.5]);
    const fLo = amt * Math.pow(1 + (ret - lo) / 100, years), fHi = amt * Math.pow(1 + (ret - hi) / 100, years);
    const diff = fLo - fHi;
    return {
      q: `${eur(amt)} per ${years} anni al ${ret}% lordo annuo. Fondo A con costi ${pct(lo, 1)}, fondo B con costi ${pct(hi, 1)}. Quanto vale in più il fondo A alla fine, circa?`,
      options: distinct([eur(diff, 0), eur((amt * (hi - lo) * years) / 100, 0), eur(diff * 2, 0), eur(diff / 4, 0)], (i) => eur(diff * (3 + i), 0)),
      explain: `A cresce a ${num(fLo)} euro (${num(ret - lo, 1)}% netto), B a ${num(fHi)} euro (${num(ret - hi, 1)}% netto): differenza ${num(diff)} euro. I costi si compongono come i rendimenti, al contrario.`,
    };
  }),
  T('commissione', ['costi', 'ordini'], 2, 'ip_spread', (rng) => {
    const fee = pickOf(rng, [1, 2, 2.5, 5, 10]);
    const order = pickOf(rng, [50, 100, 200, 250, 500, 1000]);
    const p = (fee / order) * 100;
    return {
      q: `Il broker chiede ${eur(fee, fee % 1 ? 2 : 0)} fissi per ordine. Su un acquisto da ${eur(order)}, quanto pesa la commissione in percentuale (solo acquisto)?`,
      options: distinct([pct(p, 2), pct(p * 2, 2), pct(p / 10, 2), pct(fee, 2)], (i) => pct(p * (3 + i), 2)),
      explain: `${num(fee, 2)} / ${num(order)} = ${num(p, 2)}%. Con ordini piccoli le commissioni fisse pesano molto: per questo i piani di accumulo convengono solo se le commissioni sono basse.`,
    };
  }),
  T('sizing', ['gestione'], 2, 'ip_position_sizing', (rng) => {
    const cap = between(rng, 5000, 30000, 5000);
    const risk = pickOf(rng, [1, 2]);
    const stop = pickOf(rng, [5, 8, 10, 20]);
    const pos = (cap * risk) / stop;
    return {
      q: `Capitale ${eur(cap)}. Vuoi rischiare al massimo il ${risk}% del capitale su un'operazione, con stop loss al −${stop}%. Quanto puoi investire in quella posizione?`,
      options: distinct([eur(pos), eur((cap * risk) / 100), eur((cap * stop) / 100), eur(pos * 2)], (i) => eur(pos + 500 * (i + 1))),
      explain: `Rischio massimo = ${num(cap)} × ${risk}% = ${num((cap * risk) / 100)} euro. Se lo stop è al −${stop}%, la posizione è ${num((cap * risk) / 100)} / ${stop}% = ${num(pos)} euro.`,
    };
  }),
  T('leva', ['gestione', 'rischio'], 2, 'ip_leverage', (rng) => {
    const lev = pickOf(rng, [2, 3, 5, 10]);
    const move = pickOf(rng, [2, 4, 5, 8, 10]);
    const loss = Math.min(100, lev * move);
    return {
      q: `Apri una posizione con leva ${lev}x. Il sottostante scende del ${move}%. Quanto perdi sul capitale impegnato?`,
      options: distinct([pct(loss), pct(move), pct(move / lev, 1), pct(Math.min(100, lev * move * 2))], (i) => pct(loss + 5 * (i + 1))),
      explain: `La leva moltiplica il movimento: ${lev} × ${move}% = ${num(loss)}%${loss >= 100 ? ', cioè tutto il capitale (e il broker chiude la posizione)' : ''}. Con leva ${lev}x basta un −${num(100 / lev, 1)}% per azzerare il capitale.`,
    };
  }),
  T('reale', ['macro', 'etf_obbligazioni', 'mixed_base'], 2, 'ip_inflation', (rng) => {
    const nom = pickOf(rng, [1, 2, 3, 4, 5, 6]);
    const inf = pickOf(rng, [1, 2, 3, 4, 5, 6, 8]);
    if (nom === inf) return null;
    const real = nom - inf;
    return {
      q: `Un conto deposito rende il ${nom}% annuo. L'inflazione è al ${inf}%. Qual è il rendimento reale, circa?`,
      options: distinct([pct(real), pct(nom + inf), pct(nom), pct(-real)], (i) => pct(real + 2 * (i + 1))),
      explain: `Rendimento reale ≈ nominale − inflazione = ${nom}% − ${inf}% = ${num(real)}%: ${real < 0 ? 'il potere d\'acquisto diminuisce anche se il saldo cresce' : 'il potere d\'acquisto cresce davvero'}.`,
    };
  }),
  T('regola72', ['macro', 'costi'], 2, 'ip_rule72', (rng) => {
    const r = pickOf(rng, [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
    const y = 72 / r;
    return {
      q: `Un investimento rende il ${num(r, r % 1 ? 1 : 0)}% annuo composto. In quanti anni, circa, raddoppia il capitale?`,
      options: distinct([`Circa ${num(y, y % 1 ? 1 : 0)} anni`, `Circa ${num(100 / r, 1)} anni`, `Circa ${num(y / 2, 1)} anni`, `Circa ${num(y * 2, 0)} anni`], (i) => `Circa ${num(y + 3 * (i + 1), 0)} anni`),
      explain: `Regola del 72: anni per raddoppiare ≈ 72 / tasso = 72 / ${r} = ${num(y, 1)}. È un'approssimazione dell'interesse composto, comoda per fare i conti a mente.`,
    };
  }),
  T('duration', ['macro', 'etf_obbligazioni'], 3, 'ip_duration', (rng) => {
    const d = pickOf(rng, [2, 3, 5, 7, 10, 15]);
    const delta = pickOf(rng, [-2, -1, -0.5, 0.5, 1, 2]);
    const chg = -d * delta;
    return {
      q: `Un ETF obbligazionario ha duration ${d}. I tassi ${delta > 0 ? 'salgono' : 'scendono'} di ${num(Math.abs(delta), delta % 1 ? 1 : 0)} punti. Effetto approssimativo sul prezzo?`,
      options: distinct([`Circa ${chg > 0 ? '+' : ''}${pct(chg, 1)}`, `Circa ${-chg > 0 ? '+' : ''}${pct(-chg, 1)}`, `Circa ${-delta > 0 ? '+' : ''}${pct(-delta, 1)}`, `Circa ${chg > 0 ? '+' : ''}${pct(chg * 2, 1)}`], (i) => `Circa ${pct(chg + 3 * (i + 1), 1)}`),
      explain: `Variazione ≈ −duration × variazione dei tassi = −${d} × (${num(delta, 1)}) = ${num(chg, 1)}%. Più duration, più sensibilità ai tassi, in entrambe le direzioni.`,
    };
  }),
  T('pe', ['analisi', 'stocks_bilanci', 'stocks_base'], 2, 'ip_pe', (rng) => {
    const eps = pickOf(rng, [1, 2, 2.5, 4, 5, 8]);
    const pe = pickOf(rng, [8, 10, 12, 15, 18, 20, 25, 30]);
    const price = eps * pe;
    return {
      q: `Un'azione costa ${num(price, price % 1 ? 1 : 0)} e l'utile per azione è ${num(eps, eps % 1 ? 1 : 0)}. Qual è il P/E?`,
      options: distinct([num(pe), num(price * eps, 1), num(eps / price, 3), num(pe * 2)], (i) => num(pe + 3 * (i + 1))),
      explain: `P/E = prezzo / utile per azione = ${num(price, 1)} / ${num(eps, 1)} = ${num(pe)}: si pagano ${num(pe)} euro per ogni euro di utile annuo.`,
    };
  }),
  T('eps', ['stocks_bilanci', 'analisi'], 2, 'ip_eps', (rng) => {
    const shares = pickOf(rng, [100, 200, 250, 400, 500, 1000]);
    const eps = pickOf(rng, [0.5, 1, 1.5, 2, 3, 4]);
    const net = shares * eps;
    return {
      q: `Utile netto ${num(net)} milioni, ${num(shares)} milioni di azioni. Qual è l'utile per azione (EPS)?`,
      options: distinct([num(eps, eps % 1 ? 1 : 0), num(shares / net, 2), num(net * shares), num(eps * 2, 1)], (i) => num(eps + 0.5 * (i + 1), 1)),
      explain: `EPS = utile netto / numero di azioni = ${num(net)} / ${num(shares)} = ${num(eps, 1)}.`,
    };
  }),
  T('margine', ['analisi', 'stocks_bilanci'], 2, 'ip_fundamental', (rng) => {
    const rev = between(rng, 100, 1000, 50);
    const m = pickOf(rng, [5, 10, 15, 20, 25, 30, 40]);
    const cost = rev - (rev * m) / 100;
    return {
      q: `Ricavi ${num(rev)} milioni, costi operativi ${num(cost)} milioni. Qual è il margine operativo?`,
      options: distinct([pct(m), pct(100 - m), pct((rev - cost) / cost * 100, 1), pct(m / 2, 1)], (i) => pct(m + 5 * (i + 1))),
      explain: `Utile operativo = ${num(rev)} − ${num(cost)} = ${num(rev - cost)}; margine = ${num(rev - cost)} / ${num(rev)} = ${num(m)}% dei ricavi.`,
    };
  }),
  T('dividendo', ['stocks_dividendi', 'stocks_base'], 1, 'ig_dividend', (rng) => {
    const price = between(rng, 20, 150, 5);
    const y = pickOf(rng, [2, 2.5, 3, 4, 5, 6]);
    const div = (price * y) / 100;
    const quarterly = rng() < 0.4;
    return {
      q: quarterly
        ? `Un'azione costa ${num(price)} e paga ${num(div / 4, 2)} euro di dividendo ogni trimestre. Qual è il rendimento annuo da dividendo?`
        : `Un'azione costa ${num(price)} e paga ${num(div, 2)} euro di dividendo all'anno. Qual è il rendimento da dividendo?`,
      options: distinct([pct(y, 1), pct(quarterly ? y / 4 : y * 4, 2), pct(price / div, 1), pct(y * 2, 1)], (i) => pct(y + 1.5 * (i + 1), 1)),
      explain: `Rendimento = dividendo annuo / prezzo = ${num(div, 2)} / ${num(price)} = ${num(y, 1)}%.${quarterly ? ' Prima si somma il dividendo dei quattro trimestri.' : ''}`,
    };
  }),
  T('ex_dividendo', ['stocks_dividendi'], 2, 'ig_dividend', (rng) => {
    const price = between(rng, 20, 150, 5);
    const div = pickOf(rng, [0.5, 1, 1.5, 2, 2.5, 3, 4]);
    return {
      q: `Un'azione chiude a ${num(price)} il giorno prima dello stacco di un dividendo di ${num(div, div % 1 ? 2 : 0)} euro. A parità di tutto il resto, a quanto apre il giorno dello stacco?`,
      options: distinct([`Circa ${num(price - div, 2)}`, `Circa ${num(price + div, 2)}`, `Circa ${num(price, 2)}, il dividendo non tocca il prezzo`, `Circa ${num(price - 2 * div, 2)}`], (i) => `Circa ${num(price - div - i - 1, 2)}`),
      explain: `Il dividendo esce dalla cassa dell'azienda e va agli azionisti: il prezzo si aggiusta di circa ${num(div, 2)} euro, da ${num(price)} a ${num(price - div, 2)}. Comprare "per prendere il dividendo" non crea valore dal nulla.`,
    };
  }),
  T('rendimento_totale', ['stocks_dividendi', 'stocks_base'], 3, 'ig_dividend', (rng) => {
    const p0 = between(rng, 20, 100, 5);
    const p1 = p0 + between(rng, -10, 20, 1);
    const div = pickOf(rng, [1, 2, 3, 4]);
    const tot = ((p1 - p0 + div) / p0) * 100, px = ((p1 - p0) / p0) * 100;
    if (p1 === p0) return null;
    return {
      q: `Hai comprato a ${num(p0)}; dopo un anno il titolo vale ${num(p1)} e hai incassato ${num(div)} euro di dividendi per azione. Qual è il rendimento totale?`,
      options: distinct([pct(tot, 1), pct(px, 1), pct((div / p0) * 100, 1), pct(((p1 - p0 + div) / p1) * 100, 1)], (i) => pct(tot + 2 * (i + 1), 1)),
      explain: `Rendimento totale = (variazione di prezzo + dividendi) / prezzo pagato = (${num(p1 - p0)} + ${num(div)}) / ${num(p0)} = ${num(tot, 1)}%. Guardare solo il prezzo (${num(px, 1)}%) ignora i dividendi.`,
    };
  }),
  T('payout', ['stocks_dividendi'], 2, 'ip_payout', (rng) => {
    const eps = pickOf(rng, [2, 3, 4, 5, 8]);
    const ratio = pickOf(rng, [25, 40, 50, 60, 75, 90, 110]);
    const dps = (eps * ratio) / 100;
    return {
      q: `Utile per azione ${num(eps)}, dividendo per azione ${num(dps, dps % 1 ? 2 : 0)}. Qual è il payout ratio e cosa indica?`,
      options: distinct([
        `${pct(ratio)}: ${ratio > 100 ? 'paga più di quanto guadagna, non è sostenibile' : ratio >= 75 ? 'quasi tutto l\'utile va in dividendi, poco margine' : 'distribuisce una parte e reinveste il resto'}`,
        `${pct(ratio)}: è il rendimento annuo garantito a chi tiene l'azione`,
        `${pct(100 - ratio > 0 ? 100 - ratio : ratio - 100)}: è la quota di utile che l'azienda distribuisce`,
        `${pct(eps / dps * 100, 0)}: è il rapporto tra utile e dividendo`,
      ], (i) => `${pct(ratio + 10 * (i + 1))}: altra lettura`),
      explain: `Payout = dividendo / utile per azione = ${num(dps, 2)} / ${num(eps)} = ${num(ratio)}%. ${ratio > 100 ? 'Sopra il 100% l\'azienda paga più di quanto guadagna: prima o poi taglia.' : 'Più è alto, meno spazio ha l\'azienda per reinvestire o per reggere un calo degli utili.'}`,
    };
  }),
  T('leva_etf', ['etf_base', 'gestione'], 3, 'ip_leverage', (rng) => {
    const a = pickOf(rng, [5, 8, 10, 12, 15]);
    const lev = pickOf(rng, [2, 3]);
    const idx = ((1 + a / 100) * (1 - a / 100) - 1) * 100;
    const etf = ((1 + (lev * a) / 100) * (1 - (lev * a) / 100) - 1) * 100;
    return {
      q: `Un indice fa +${a}% un giorno e −${a}% il giorno dopo (chiude a ${num(idx, 2)}%). Un ETF a leva ${lev}x giornaliera, dopo gli stessi due giorni, è a…`,
      options: distinct([`Circa ${pct(etf, 2)}`, `Circa ${pct(idx * lev, 2)}`, `Circa 0%, i due giorni si compensano`, `Circa ${pct(-idx * lev, 2)}`], (i) => `Circa ${pct(etf - 2 * (i + 1), 2)}`),
      explain: `+${lev * a}% poi −${lev * a}%: ${num(1 + (lev * a) / 100, 2)} × ${num(1 - (lev * a) / 100, 2)} = ${num(1 + etf / 100, 4)} → ${num(etf, 2)}%, peggio di ${lev} volte l'indice. La leva giornaliera erode nei mercati che oscillano.`,
    };
  }),
  T('tracking', ['etf_replica', 'etf_base'], 2, 'ip_tracking', (rng) => {
    const idx = pickOf(rng, [4, 6, 8, 10, 12, -5, -8]);
    const ter = pickOf(rng, [0.1, 0.2, 0.3, 0.5]);
    const extra = pickOf(rng, [0, 0.1, 0.2]);
    const etf = idx - ter - extra;
    const td = etf - idx;
    return {
      q: `In un anno l'indice fa ${pct(idx, 0)} e l'ETF che lo replica (TER ${pct(ter, 1)}) fa ${pct(etf, 1)}. Qual è il tracking difference e come si legge?`,
      options: distinct([
        `${pct(td, 1)}: ${extra ? 'l\'ETF ha perso più del solo TER, la replica costa qualcosa in più' : 'l\'ETF ha perso esattamente il TER, replica fedele'}`,
        `${pct(-td, 1)}: l'ETF ha battuto l'indice grazie alla gestione attiva del fondo, un buon segno`,
        `${pct(ter, 1)}: il tracking difference coincide sempre con il TER dichiarato nel documento`,
        `${pct(etf, 1)}: il tracking difference è il rendimento netto dell'ETF dopo tutti i costi`,
      ], (i) => `${pct(td - 0.1 * (i + 1), 1)}`),
      explain: `Tracking difference = rendimento ETF − rendimento indice = ${num(etf, 1)} − (${num(idx, 1)}) = ${num(td, 1)}%. ${extra ? `Oltre al TER (${num(ter, 1)}%) ci sono costi di replica: ${num(extra, 1)}% in più.` : 'Qui coincide con il TER: nessun costo nascosto.'}`,
    };
  }),
  T('custodia', ['crypto_custodia', 'crypto_base'], 2, 'ip_private_key', (rng) => {
    const onEx = between(rng, 500, 8000, 500);
    const onHw = between(rng, 500, 8000, 500);
    return {
      q: `Hai ${eur(onEx)} di cripto su un exchange e ${eur(onHw)} in un hardware wallet di cui solo tu hai la seed phrase. L'exchange fallisce senza garanzie. Quanto rischi di perdere?`,
      options: distinct([eur(onEx), eur(onEx + onHw), eur(onHw), eur(onEx / 2)], (i) => eur(onEx + 250 * (i + 1))),
      explain: `Sull'exchange sei un creditore: i ${num(onEx)} euro dipendono dalla sua solvibilità. Le cripto nel wallet con le tue chiavi (${num(onHw)} euro) non passano dall'exchange: "not your keys, not your coins" vale anche al contrario.`,
    };
  }),
  T('apy', ['crypto_stable', 'regole'], 2, 'ig_ponzi', (rng) => {
    const m = pickOf(rng, [3, 4, 5, 6, 8, 10, 12, 15, 20, 25]);
    const annual = (Math.pow(1 + m / 100, 12) - 1) * 100;
    return {
      q: `Una piattaforma promette il ${m}% al mese 'garantito'. A quanto corrisponde in un anno, con interesse composto?`,
      options: distinct([`Circa ${pct(annual, 0)}: un rendimento impossibile per un'attività reale`, `Circa ${pct(m * 12, 0)}: alto ma possibile per un'attività molto rischiosa`, `Circa ${pct(m, 0)}: la promessa è su base annua, non mensile`, `Circa ${pct(m * 12 / 2, 0)}: metà, perché le tasse dimezzano il rendimento`], (i) => `Circa ${pct(annual + 50 * (i + 1), 0)}`),
      explain: `(1 + ${m}%)^12 − 1 = ${num(annual, 0)}% l'anno. Nessuna attività legale rende così in modo costante: chi 'garantisce' il ${m}% al mese paga i vecchi iscritti con i soldi dei nuovi.`,
    };
  }),
  T('ribilancio', ['mixed_allocazione', 'diversificazione'], 2, 'ip_rebalancing', (rng) => {
    const total = between(rng, 10000, 50000, 5000);
    const target = pickOf(rng, [50, 60, 70, 80]);
    const now = target + pickOf(rng, [5, 8, 10, 12, 15]);
    const sell = (total * (now - target)) / 100;
    return {
      q: `Obiettivo ${target}/${100 - target} tra azioni e obbligazioni su un portafoglio di ${eur(total)}. Dopo un rialzo le azioni pesano il ${now}%. Quanto devi spostare dalle azioni alle obbligazioni per ribilanciare?`,
      options: distinct([eur(sell), eur((total * now) / 100), eur((total * target) / 100), eur(sell * 2)], (i) => eur(sell + 1000 * (i + 1))),
      explain: `Le azioni valgono ${num((total * now) / 100)} euro ma dovrebbero valerne ${num((total * target) / 100)}: la differenza è ${num(sell)} euro (${now - target}% di ${num(total)}), da vendere e spostare in obbligazioni.`,
    };
  }),
  T('allocazione', ['mixed_base', 'mixed_allocazione', 'diversificazione'], 1, 'ip_asset_alloc', (rng) => {
    const total = between(rng, 4000, 40000, 2000);
    const w = pickOf(rng, [10, 20, 25, 30, 40, 60, 70]);
    const amt = (total * w) / 100;
    return {
      q: `Portafoglio da ${eur(total)}: decidi di mettere il ${w}% in obbligazioni. Quanto investi in obbligazioni?`,
      options: distinct([eur(amt), eur((total * (100 - w)) / 100), eur(amt / 10), eur(total / w)], (i) => eur(amt + 500 * (i + 1))),
      explain: `${w}% di ${num(total)} = ${num(amt)} euro. L'allocazione si esprime in percentuali del patrimonio totale, e i pesi vanno ricontrollati nel tempo.`,
    };
  }),
  T('vol_portafoglio', ['mixed_allocazione', 'diversificazione', 'rischio'], 4, 'ip_correlation', (rng) => {
    const wa = pickOf(rng, [40, 50, 60, 70]);
    const va = pickOf(rng, [15, 18, 20, 25]), vb = pickOf(rng, [4, 5, 6, 8]);
    const a = wa / 100, b = 1 - a;
    const vol = Math.sqrt(a * a * va * va + b * b * vb * vb);
    const mean = a * va + b * vb;
    return {
      q: `Portafoglio: ${wa}% azioni (volatilità ${va}%), ${100 - wa}% obbligazioni (volatilità ${vb}%), correlazione zero. Volatilità del portafoglio, circa?`,
      options: distinct([pct(vol, 1), pct(mean, 1), pct(va - vb, 1), pct(vol / 2, 1)], (i) => pct(vol + 2 * (i + 1), 1)),
      explain: `Con correlazione 0: √(${num(a, 1)}²·${va}² + ${num(b, 1)}²·${vb}²) = √(${num(a * a * va * va, 1)} + ${num(b * b * vb * vb, 1)}) ≈ ${num(vol, 1)}%, meno della media semplice (${num(mean, 1)}%): è il premio della diversificazione.`,
    };
  }),
  T('copertura', ['analisi', 'stocks_bilanci', 'macro'], 4, 'ip_de', (rng) => {
    const ebit = between(rng, 100, 600, 50);
    const ratio = pickOf(rng, [1.2, 1.5, 2, 4, 8]);
    const interest = Math.round(ebit / ratio);
    const cov = ebit / interest;
    const weak = cov < 2.5;
    return {
      q: `Utile operativo ${num(ebit)} milioni, interessi sul debito ${num(interest)} milioni all'anno. Quante volte l'azienda copre gli interessi, e cosa significa?`,
      options: distinct([
        `${num(cov, 1)} volte: ${weak ? 'margine sottile, un calo degli utili la mette in difficoltà' : 'copertura ampia, il debito oggi è sostenibile'}`,
        `${num(cov, 1)} volte: ${weak ? 'copertura ampia, il debito oggi è sostenibile' : 'margine sottile, un calo degli utili la mette in difficoltà'}`,
        `${num(interest / ebit, 2)} volte: gli interessi superano l'utile operativo e l'azienda è già insolvente`,
        `${num(ebit - interest)} volte: la differenza tra utile operativo e interessi è la copertura del debito`,
      ], (i) => `${num(cov + i + 1, 1)} volte`),
      explain: `Copertura degli interessi = utile operativo / interessi = ${num(ebit)} / ${num(interest)} = ${num(cov, 1)}. ${weak ? 'Sotto 2-3 volte basta un anno storto per non pagare il debito.' : 'Sopra 4-5 volte il debito pesa poco sui conti.'}`,
    };
  }),
  T('ancora', ['bias'], 2, 'ip_anchoring', (rng) => {
    const buy = between(rng, 30, 120, 5);
    const now = buy - between(rng, 5, Math.round(buy * 0.4), 5);
    return {
      q: `Hai comprato a ${buy}; oggi il titolo vale ${now} e i fondamentali sono peggiorati. Pensi: "Vendo appena torna a ${buy}". Quale bias ti sta guidando e cosa conviene fare?`,
      options: [
        `Ancoraggio al prezzo di carico: ${buy} non conta, va deciso in base al valore attuale`,
        `Avversione al rischio: aspettare ${buy} è la scelta prudente e azzera la perdita`,
        `Nessun bias: il prezzo di acquisto ${buy} è il riferimento corretto per ogni decisione futura`,
        `Effetto gregge: conviene vendere a ${now} solo se lo stanno facendo anche gli altri azionisti`,
      ],
      explain: `Il mercato non sa che hai pagato ${buy}: il prezzo di carico è un'ancora che non dice nulla sul futuro. La domanda giusta è: "Lo comprerei oggi a ${now}?". Se no, la perdita è già avvenuta: tenerlo è solo rimandare.`,
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
