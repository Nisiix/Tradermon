import type { BossRun } from '../types';
// Boss dei Mercati: interfaccia della sfida (regole e punteggi in systems/boss.ts).
import * as A from '../systems/alpaca';
import { S, save } from '../systems/state';
import { BOSSES, BOSS_RULES, type BossDef, planError, planScore, outcome, quizPoints, bossWon } from '../systems/boss';
import { ASSET_BY_ID, unlockedAssets } from '../data/assets';
import { pickQuestions } from '../systems/quiz';
import { fmtPx, fmtPct } from '../systems/portfolio';
import { REWARD } from '../systems/balance';
import { reward } from '../world/scripts/common';
import { beep } from '../systems/audio';
import { say, choose, modal, esc, toast } from './core';
import { runDuel } from './battle';
import { realChart } from './live';
import { requireAccount } from './broker';

const KEEPER = 'Custode della Torre';
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const when = (t: number) => new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const cls = (id: string) => (id.includes('/') ? 'crypto' : 'stocks') as 'crypto' | 'stocks';

/** Sfide in corso, una per Boss (i salvataggi precedenti ne avevano una sola: viene portata qui). */
function runs(): Record<string, BossRun> {
  const b = S.boss;
  b.runs ??= {};
  if (b.run) { b.runs[b.run.id] = b.run; b.run = null; }
  return b.runs;
}

export async function bossMenu(): Promise<void> {
  for (;;) {
    const all = runs();
    const opts = [...BOSSES.map((b) => `${b.name} · ${b.durationLabel}${S.boss.beaten.includes(b.id) ? ' ✓' : ''}${all[b.id] ? (all[b.id].plan ? ' · piano in corso' : ' · quiz superato') : ''}`), 'Come funziona', 'Esci'];
    const c = await choose(opts, { cancel: true, title: 'BOSS DEI MERCATI', who: KEEPER });
    if (c < 0 || c === opts.length - 1) return;
    if (c === BOSSES.length) {
      await say([
        'Ogni Boss si affronta in due tempi: un quiz di livello esperto, poi UNA sola decisione su un grafico vero. Ingresso al prezzo del momento, uno stop, un obiettivo, quanto rischi.',
        'Il piano non si tocca più. Il mercato vero fa il resto, anche mentre il gioco è chiuso: torni alla scadenza e vedi com\'è andata. I tre Boss si possono sfidare insieme: ognuno ha il suo mandato.',
        `Il Boss ha ${BOSS_RULES.energy} punti di energia: fino a ${BOSS_RULES.quizMax} li toglie il quiz, fino a ${BOSS_RULES.planMax} la qualità del piano, fino a ${BOSS_RULES.outcomeMax} l'esito reale. Ne servono ${BOSS_RULES.win}.`,
        'Quiz e piano perfetti bastano da soli: l\'esito non lo controlla nessuno, quindi non può essere l\'unica strada. Se perdi, si rifà tutto il Boss, quiz compreso.',
        'Nessun ordine viene inviato: è un mandato su carta, valutato sui prezzi reali.',
      ], KEEPER);
      continue;
    }
    await bossFight(BOSSES[c]);
  }
}

function lose(def: BossDef, lines: string[]): Promise<void> {
  delete runs()[def.id];
  S.boss.tries[def.id] = (S.boss.tries[def.id] ?? 0) + 1;
  save();
  beep('lose');
  return say([...lines, 'La sfida ricomincia da capo, quiz compreso.'], def.name);
}

async function bossFight(def: BossDef): Promise<void> {
  if (!(await requireAccount('sfidare un Boss dei Mercati', KEEPER))) return;
  const run: BossRun | undefined = runs()[def.id];
  if (run?.plan) return resolve(def);
  if (!run) {
    await say(def.intro, def.name);
    if ((await choose(['Accetto la sfida', 'Non ora'], { cancel: true, who: def.name })) !== 0) return;
    const qs = pickQuestions(def.topics, BOSS_RULES.quizN, { minDiff: 3, maxDiff: 4 });
    const fid = S.stats.fiducia;
    S.stats.fiducia = 100;
    const r = await runDuel({ foeName: def.name, foeTitle: def.title, foePal: def.pal, questions: qs, need: BOSS_RULES.quizMin, damage: 0, fixed: true });
    S.stats.fiducia = fid;
    if (r.correct < BOSS_RULES.quizMin) return lose(def, [`${r.correct} risposte giuste su ${r.total}: ne servivano almeno ${BOSS_RULES.quizMin} per presentare un piano.`]);
    runs()[def.id] = { id: def.id, quiz: r.correct, quizMax: r.total, plan: null, startedAt: Date.now() };
    save();
    await say([`${r.correct} su ${r.total}: mi hai tolto ${quizPoints(r.correct, r.total)} punti di energia. Ora il piano.`], def.name);
  }
  await planForm(def);
}

/** Ampiezza media recente delle candele del boss, in rapporto al prezzo. */
async function recentVol(sym: string, def: BossDef): Promise<number> {
  const days = def.tf === '5Min' ? 4 : def.tf === '1Hour' ? 20 : 90;
  const { bars } = await A.bars(sym, cls(sym), iso(Date.now() - days * 86400000), iso(Date.now() + 86400000), def.tf);
  const last = bars.slice(-30);
  if (last.length < 5) throw new Error('Alpaca non ha abbastanza candele recenti per questo titolo.');
  return last.reduce((s, b) => s + (b.h - b.l) / b.c, 0) / last.length;
}

async function planForm(def: BossDef): Promise<void> {
  let pool = unlockedAssets(S.track, S.mixedClasses, 8, Object.keys(S.cards));
  // un mandato più corto di una seduta deve avere il mercato aperto per tutta la sua durata
  if (def.cryptoOnlyWhenClosed) {
    let stocksOk = false;
    try { const c = await A.clock('paper'); stocksOk = c.is_open && Date.parse(c.next_close) - Date.now() > def.durationMs + 5 * 60_000; } catch { stocksOk = false; }
    if (!stocksOk) {
      pool = pool.filter((a) => a.cls === 'crypto' && a.sector !== 'stable');
      if (!pool.length) { await say(['Con me si combatte a Borsa aperta, con almeno due ore di seduta davanti. Adesso non ci sono.', 'Il tuo quiz resta valido: torna durante la seduta americana.'], def.name); return; }
      await say('La Borsa è chiusa o sta per chiudere: per questo mandato restano le cripto, che non chiudono mai.', KEEPER);
    }
  }
  pool = pool.filter((a) => a.sector !== 'stable');
  const res = await modal<{ asset: string; stop: number; target: number; risk: number } | null>(`${def.name} · il piano`, ({ body, button, close }) => {
    body.innerHTML = `
      <p class="small">Una sola decisione, su un grafico vero: compri al prezzo del momento, fissi lo stop e l'obiettivo, decidi quanto rischi. Durata del mandato: <b>${def.durationLabel}</b>. Dopo l'invio non si cambia nulla.</p>
      <label>Titolo <select class="tx as">${pool.map((a) => `<option value="${esc(a.id)}">${esc(a.ticker)} · ${esc(a.name)}</option>`).join('')}</select></label>
      <p class="px small muted">Prezzo: …</p>
      <div class="grid2">
        <label>Stop (prezzo a cui esci in perdita)<input class="tx st" type="number" step="any"></label>
        <label>Obiettivo (prezzo a cui incassi)<input class="tx tg" type="number" step="any"></label>
        <label>Rischio: % del capitale della sfida che perdi se scatta lo stop<input class="tx rk" type="number" min="0.5" max="5" step="0.5" value="1"></label>
      </div>
      <p class="msg small bad"></p>`;
    const q = <T extends HTMLElement>(s: string) => body.querySelector(s) as T;
    const sel = q<HTMLSelectElement>('.as');
    let price = 0;
    const load = async () => {
      q('.px').textContent = 'Prezzo: …';
      try { price = (await A.latest(sel.value, cls(sel.value))).price; q('.px').textContent = `Prezzo attuale di ${ASSET_BY_ID[sel.value].ticker}: ${fmtPx(price)} $ (l'ingresso sarà al prezzo del momento dell'invio).`; }
      catch (e) { price = 0; q('.px').textContent = `Prezzo non disponibile: ${(e as Error).message}`; }
    };
    sel.addEventListener('change', () => void load());
    void load();
    button('Grafico', () => void realChart(sel.value));
    button('Invia il piano', () => {
      const p = { entry: price, stop: Number(q<HTMLInputElement>('.st').value), target: Number(q<HTMLInputElement>('.tg').value), risk: Number(q<HTMLInputElement>('.rk').value) / 100 };
      const err = price > 0 ? planError(p) : 'Aspetta il prezzo.';
      if (err) { q('.msg').textContent = err; return; }
      close({ asset: sel.value, stop: p.stop, target: p.target, risk: p.risk });
    }, 'primary');
    button('Ci penso', () => close(null));
  }, { wide: true, closable: false });
  if (!res) { await say('Il quiz resta valido: torna quando hai un piano.', def.name); return; }
  try {
    const [vol, last] = await Promise.all([recentVol(res.asset, def), A.latest(res.asset, cls(res.asset))]);
    const plan = { asset: res.asset, side: 'long' as const, entry: last.price, stop: res.stop, target: res.target, risk: res.risk, placedAt: Date.now(), deadline: Date.now() + def.durationMs, quality: 0 };
    const err = planError(plan);
    if (err) { await say(`Nel frattempo il prezzo si è mosso a ${fmtPx(last.price)} $ e il piano non regge più: ${err}`, KEEPER); return planForm(def); }
    const sc = planScore(plan, vol);
    plan.quality = sc.points;
    const cur = runs()[def.id];
    // un piano che non può vincere nemmeno con l'esito migliore non viene registrato: niente attese a vuoto
    const best = quizPoints(cur.quiz, cur.quizMax) + sc.points + BOSS_RULES.outcomeMax;
    if (best < BOSS_RULES.win) {
      await modal('Piano da rifare', ({ body, button, close }) => {
        body.innerHTML = `<p><b>Qualità del piano: ${sc.points}/${BOSS_RULES.planMax}.</b> Con il tuo quiz (${cur.quiz}/${cur.quizMax}) anche l'esito migliore porterebbe a ${best} punti: ne servono ${BOSS_RULES.win}.</p>
          <ul class="small">${sc.notes.map((n) => `<li class="${n.ok ? 'good' : 'bad'}">${esc(n.text)}</li>`).join('')}</ul>
          <p class="small">Non lo registro: aspettare ${esc(def.durationLabel.split(',')[0])} per una sconfitta già scritta non insegna nulla. Il quiz resta valido: correggi il piano.</p>`;
        button('Rifaccio il piano', () => close(), 'primary');
      });
      return planForm(def);
    }
    cur.plan = plan;
    save();
    await modal('Piano registrato', ({ body, button, close }) => {
      body.innerHTML = `<p>Ingresso <b>${fmtPx(plan.entry)} $</b> su ${esc(ASSET_BY_ID[plan.asset].ticker)} · stop ${fmtPx(plan.stop)} · obiettivo ${fmtPx(plan.target)} · rischio ${(plan.risk * 100).toFixed(1)}%.</p>
        <p><b>Qualità del piano: ${sc.points}/${BOSS_RULES.planMax}</b> <span class="small muted">(giudicata adesso, prima di sapere come va)</span></p>
        <ul class="small">${sc.notes.map((n) => `<li class="${n.ok ? 'good' : 'bad'}">${esc(n.text)}</li>`).join('')}</ul>
        <p class="small">Scadenza: <b>${when(plan.deadline)}</b>. Torna alla Torre dopo quell'ora (i dati arrivano con un quarto d'ora di ritardo). Nel frattempo puoi chiudere il gioco.</p>`;
      button('Ok', () => close(), 'primary');
    });
  } catch (e) { await say(`Non riesco a registrare il piano: ${(e as Error).message}`, KEEPER); }
}

async function resolve(def: BossDef): Promise<void> {
  const run = runs()[def.id];
  const p = run.plan!;
  const a = ASSET_BY_ID[p.asset];
  const ready = p.deadline + BOSS_RULES.evalDelayMs;
  if (Date.now() < ready) {
    const c = await choose(['Guardo il grafico', 'Torno più tardi'], { cancel: true, who: def.name, prompt: `Il tuo piano su ${a?.ticker ?? p.asset} è in corso: ingresso ${fmtPx(p.entry)}, stop ${fmtPx(p.stop)}, obiettivo ${fmtPx(p.target)}. Si chiude il ${when(p.deadline)}; l'esito si legge dal ${when(ready)}.` });
    if (c === 0) await realChart(p.asset, { price: p.entry, label: 'ingresso' });
    return;
  }
  let bars: A.Bar[];
  try { bars = (await A.bars(p.asset, cls(p.asset), iso(p.placedAt), iso(p.deadline + 86400000), def.tf)).bars.filter((b) => { const t = Date.parse(b.t); return t > p.placedAt && t <= p.deadline; }); }
  catch (e) { await say(`Non riesco a leggere le candele del periodo: ${(e as Error).message}. Riprova tra poco.`, KEEPER); return; }
  if (!bars.length) {
    p.deadline += 86400000; save();
    toast('Mandato prolungato di un giorno.');
    await say('Nel periodo del mandato il mercato non ha scambiato questo titolo (era chiuso). Prolungo la scadenza di un giorno: nessuna penalità.', KEEPER);
    return;
  }
  const out = outcome(p, bars);
  const qp = quizPoints(run.quiz, run.quizMax);
  const total = qp + p.quality + out.points;
  const won = bossWon(qp, p.quality, out.points);
  await modal(`${def.name} · l'esito`, ({ body, button, close }) => {
    body.innerHTML = `<p>${out.how === 'stop' ? 'È scattato lo <b>stop</b>' : out.how === 'obiettivo' ? 'Raggiunto l\'<b>obiettivo</b>' : 'Mandato arrivato a <b>scadenza</b>'}: uscita a ${fmtPx(out.exit)} $ (${fmtPct(out.exit / p.entry - 1)}), cioè ${out.r >= 0 ? '+' : ''}${out.r.toFixed(2)} volte il rischio. Sul capitale della sfida: ${fmtPct(out.r * p.risk)}.</p>
      <table class="t"><tr><th>Energia tolta al Boss</th><th class="n">Punti</th></tr>
      <tr><td>Quiz (${run.quiz}/${run.quizMax})</td><td class="n">${qp}/${BOSS_RULES.quizMax}</td></tr>
      <tr><td>Qualità del piano</td><td class="n">${p.quality}/${BOSS_RULES.planMax}</td></tr>
      <tr><td>Esito reale</td><td class="n">${out.points}/${BOSS_RULES.outcomeMax}</td></tr>
      <tr><td><b>Totale</b> (ne servono ${BOSS_RULES.win})</td><td class="n"><b>${total}</b></td></tr></table>
      <p class="${won ? 'good' : 'bad'}"><b>${won ? `${esc(def.name)} è battuto!` : `${esc(def.name)} resiste.`}</b></p>
      <p class="small muted">${out.how === 'stop' ? 'Uno stop rispettato è un piano che ha funzionato: la perdita era decisa prima.' : 'Un buon esito non prova che il piano fosse buono, e viceversa: per questo contano anche gli altri due punteggi.'} Candele reali di Alpaca (${out.bars}).</p>`;
    button('Continua', () => close(), 'primary');
  }, { closable: false });
  if (!won) return lose(def, ['Non è bastato.']);
  delete runs()[def.id];
  const first = !S.boss.beaten.includes(def.id);
  if (first) { S.boss.beaten.push(def.id); reward({ rep: REWARD.rep.boss, xp: REWARD.xp.legend, save: false }); }
  save();
  beep('badge');
  await say([first ? `Hai battuto ${def.name}!` : `${def.name} battuto di nuovo.`, S.boss.beaten.length >= BOSSES.length ? 'Tutti e tre i Boss dei Mercati sono caduti. Non c\'è più nessuno, a Capitalia, che ne sappia più di te su come si costruisce un piano.' : `Boss battuti: ${S.boss.beaten.length}/${BOSSES.length}.`], KEEPER);
}
