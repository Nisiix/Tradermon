import { S } from './state';
import type { RiskProfile } from '../types';
import type { SimResult } from '../data/missions';
import { T } from '../i18n';

/**
 * Specchio dell'investitore: confronta il profilo di rischio DICHIARATO nel questionario
 * con quello RIVELATO dal comportamento nelle missioni della Macchina del Tempo.
 * Non cambia nessuna regola del gioco: è solo una lezione sul divario tra dire e fare.
 */

/** Un'osservazione compatta per missione (si tiene l'ultima per ogni missione). */
export interface MirrorObs {
  id: string;
  /** quota investita a fine periodo, 0-1 */
  inv: number;
  /** peso massimo di una posizione, 0-1 */
  maxW: number;
  /** vendite in perdita */
  loss: number;
  /** massimo drawdown sopportato, 0-1 */
  mdd: number;
  /** ordini eseguiti */
  orders: number;
}

const KEY = 'mirror';
const MAX_OBS = 24;
/** Missioni troppo brevi o senza decisioni non dicono nulla sul carattere. */
export const MIN_OBS = 2;

export function mirrorObs(): MirrorObs[] {
  const raw = S.flags[KEY];
  if (typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw) as MirrorObs[];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/** Registra il comportamento in una missione (chiamata a fine simulazione, anche se fallita). */
export function recordMission(id: string, r: Pick<SimResult, 'investedW' | 'maxW' | 'lossSales' | 'mdd' | 'orders'>): void {
  if (r.orders === 0) return; // non ha deciso nulla: niente da specchiare
  const obs = mirrorObs().filter((o) => o.id !== id);
  obs.push({ id, inv: round(r.investedW), maxW: round(r.maxW), loss: r.lossSales, mdd: round(r.mdd), orders: r.orders });
  S.flags[KEY] = JSON.stringify(obs.slice(-MAX_OBS));
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Punteggio di rischio di una missione, sulla stessa scala delle domande (0 prudente … 2 audace). */
export function obsScore(o: MirrorObs): number {
  let s = o.inv >= 0.75 ? 1 : o.inv >= 0.4 ? 0.5 : 0;
  if (o.maxW > 0.4) s += 0.5;
  if (o.mdd > 0.12) s += 0.5;
  if (o.loss >= 2) s -= 0.5; // vendere in perdita sotto stress = tolleranza reale più bassa
  return Math.max(0, Math.min(2, s));
}

export function revealedProfile(obs = mirrorObs()): RiskProfile | null {
  if (obs.length < MIN_OBS) return null;
  const avg = obs.reduce((s, o) => s + obsScore(o), 0) / obs.length;
  return avg < 0.7 ? 'prudente' : avg < 1.3 ? 'equilibrato' : 'audace';
}

/** Nome del profilo nella lingua scelta: il valore salvato resta la parola italiana. */
export const profileName = (p: RiskProfile): string => ({ prudente: T('prudente'), equilibrato: T('equilibrato'), audace: T('audace') })[p];

const RANK: Record<RiskProfile, number> = { prudente: 0, equilibrato: 1, audace: 2 };

/** Le frasi dello Specchio: confronto, fatti osservati, lezione. */
export function mirrorReport(declared: RiskProfile = S.profile, obs = mirrorObs()): { revealed: RiskProfile | null; lines: string[] } {
  const revealed = revealedProfile(obs);
  if (!revealed) {
    const left = MIN_OBS - obs.length;
    return { revealed, lines: [T`Nel questionario il tuo profilo è ${profileName(declared).toUpperCase()}.`, T`Lo Specchio ha bisogno di vederti all'opera: completa ancora ${left} ${left === 1 ? T('missione') : T('missioni')} nella Macchina del Tempo (Zona Simulazione di Diversia, o crisi leggendarie alla Torre), facendo almeno un ordine.`] };
  }
  const n = obs.length;
  const avg = (f: (o: MirrorObs) => number) => obs.reduce((s, o) => s + f(o), 0) / n;
  const facts: string[] = [];
  facts.push(T`In ${n} missioni sei rimast{o|a} investit{o|a} in media al ${Math.round(avg((o) => o.inv) * 100)}% e hai sopportato cali fino al ${Math.round(Math.max(...obs.map((o) => o.mdd)) * 100)}%.`);
  const losses = obs.reduce((s, o) => s + o.loss, 0);
  if (losses > 0) facts.push(T`Hai venduto in perdita ${losses} ${losses === 1 ? T('volta') : T('volte')}${obs.some((o) => o.loss >= 2) ? T(', spesso proprio nei momenti di calo') : ''}.`);
  else facts.push(T('Non hai mai venduto in perdita: quando il mercato scendeva, hai tenuto.'));
  const conc = obs.filter((o) => o.maxW > 0.4).length;
  if (conc) facts.push(T`In ${conc} ${conc === 1 ? T('missione') : T('missioni')} oltre il 40% del portafoglio era su un solo asset.`);

  const gap = RANK[revealed] - RANK[declared];
  const verdict = gap === 0
    ? [T`Profilo dichiarato: ${profileName(declared).toUpperCase()}. Profilo rivelato dalle tue scelte: ${profileName(revealed).toUpperCase()}. Dire e fare coincidono.`, T('È più raro di quanto sembri. Conoscersi così bene è il primo scudo contro le decisioni prese di pancia.')]
    : gap < 0
      ? [T`Profilo dichiarato: ${profileName(declared).toUpperCase()}. Profilo rivelato dalle tue scelte: ${profileName(revealed).toUpperCase()}, più prudente.`, T('Succede a molti: a mente fredda ci sentiamo coraggiosi, poi quando le perdite sono vere l\'avversione alle perdite prende il comando.'), T('Un piano scritto prima del calo, e un\'allocazione che ti fa dormire, valgono più di un profilo ambizioso.')]
      : [T`Profilo dichiarato: ${profileName(declared).toUpperCase()}. Profilo rivelato dalle tue scelte: ${profileName(revealed).toUpperCase()}, più rischioso.`, T('Hai rischiato più di quanto dici di sopportare. Può essere fiducia in te stess{o|a}, ma anche eccesso di sicurezza.'), T('Chiediti se reggeresti gli stessi cali con soldi veri: se la risposta è no, il tuo portafoglio dovrebbe seguire il profilo dichiarato.')];
  return { revealed, lines: [...verdict, ...facts] };
}

/** Riga per l'epilogo dopo Wall Street. */
export function mirrorEpilogue(): string | null {
  const r = revealedProfile();
  if (!r) return null;
  return r === S.profile
    ? T`Lo Specchio dell'investitore non ha mai mentito: il tuo profilo dichiarato era ${profileName(S.profile)}, e le tue scelte lo sono state fino alla fine.`
    : T`Il tuo profilo dichiarato era ${profileName(S.profile)}, ma lungo il viaggio lo Specchio ha mostrato scelte da profilo ${profileName(r)}. Ora lo sai: è questo che conta.`;
}
