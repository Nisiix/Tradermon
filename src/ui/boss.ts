import type { BossRun } from '../types';
// Boss dei Mercati: interfaccia della sfida (regole e punteggi in systems/boss.ts).
import * as A from '../systems/alpaca';
import { S, save } from '../systems/state';
import { BOSSES, BOSS_RULES, type BossDef, planError, planScore, outcome, quizPoints, bossWon, sellOut, planPool, endRun } from '../systems/boss';
import { ASSET_BY_ID, unlockedAssets } from '../data/assets';
import { pickQuestions, endgameDiff } from '../systems/quiz';
import { fmtPx, fmtPct, fmtMoney, fmtQty } from '../systems/portfolio';
import * as Acc from '../systems/account';
import * as M from '../systems/mandate';
import { REWARD } from '../systems/balance';
import { reward } from '../world/scripts/common';
import { beep } from '../systems/audio';
import { say, choose, modal, esc, toast } from './core';
import { runDuel } from './battle';
import { realChart } from './alpaca';
import { requireAccount } from './broker';
import { T, LOCALE } from '../i18n';

const KEEPER = T('Custode della Torre');
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const when = (t: number) => new Date(t).toLocaleString(LOCALE, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const cls = (id: string) => (id.includes('/') ? 'crypto' : 'stocks') as 'crypto' | 'stocks';

/** Sfide in corso, una per Boss (i salvataggi precedenti ne avevano una sola: viene portata qui). */
function runs(): Record<string, BossRun> {
  const b = S.boss;
  b.runs ??= {};
  if (b.run) { b.runs[b.run.id] = b.run; b.run = null; }
  return b.runs;
}

/** Come funzionano i Boss: si spiega da sola alla prima visita, poi resta alla voce "Come funziona". */
function bossRules(): Promise<void> {
  S.flags.bossRules = true;
  save();
  return say([
    T('Ogni Boss si affronta in due tempi: un quiz più difficile di quelli di Wall Street, poi UNA sola decisione su un grafico vero. Ingresso al prezzo del momento, uno stop, un obiettivo, quanto rischi.'),
    T('Il piano muove ordini veri sul conto di gioco: quando lo invii compri davvero il titolo e parte uno stop vero al prezzo che hai indicato. Quanto compri lo decide il rischio che scegli: capitale × rischio ÷ distanza dello stop. L\'acquisto deve essere eseguito subito, quindi le azioni si usano a Borsa aperta e le cripto sempre.'),
    T('Stop e obiettivo non si toccano più. Il mercato vero fa il resto, anche mentre il gioco è chiuso: torni alla scadenza e vedi com\'è andata. I tre Boss si possono sfidare insieme: ognuno ha il suo mandato.'),
    T('Se vedi che l\'obiettivo non arriva puoi decidere di vendere prima della scadenza e puntare su un altro titolo. La vendita può essere anche parziale, ma va dichiarata: scegli "vendo una parte per annullare la sfida". Decidere di vendere annulla la sfida in ogni caso: la ripeti da capo, quiz compreso, scegliendo un titolo diverso. Non conta come sconfitta.'),
    T`Il Boss ha ${BOSS_RULES.energy} punti di energia: fino a ${BOSS_RULES.quizMax} li toglie il quiz, fino a ${BOSS_RULES.planMax} la qualità del piano, fino a ${BOSS_RULES.outcomeMax} l'esito reale. Ne servono ${BOSS_RULES.win}.`,
    T('Quiz e piano perfetti bastano da soli: l\'esito non lo controlla nessuno, quindi non può essere l\'unica strada. Se perdi, si rifà tutto il Boss, quiz compreso, e la perdita fatta su quella posizione resta sul conto.'),
    T('Il punteggio dell\'esito si legge sulle candele reali del periodo; il denaro segue gli ordini veri. A mandato finito decidi tu se chiudere la posizione o tenerla.'),
  ], KEEPER);
}

export async function bossMenu(): Promise<void> {
  if (!S.flags.bossRules) await bossRules();
  for (;;) {
    const all = runs();
    const opts = [...BOSSES.map((b) => `${b.name} · ${b.durationLabel}${S.boss.beaten.includes(b.id) ? ' ✓' : ''}${all[b.id] ? (all[b.id].plan ? T(' · piano in corso') : T(' · quiz superato')) : ''}`), T('Come funziona'), T('Esci')];
    const c = await choose(opts, { cancel: true, title: T('BOSS DEI MERCATI'), who: KEEPER });
    if (c < 0 || c === opts.length - 1) return;
    if (c === BOSSES.length) {
      await bossRules();
      continue;
    }
    await bossFight(BOSSES[c]);
  }
}

function lose(def: BossDef, lines: string[]): Promise<void> {
  runs();
  endRun(S.boss, def.id);
  S.boss.tries[def.id] = (S.boss.tries[def.id] ?? 0) + 1;
  save();
  beep('lose');
  return say([...lines, T('La sfida ricomincia da capo, quiz compreso.')], def.name);
}

async function bossFight(def: BossDef): Promise<void> {
  if (!(await requireAccount(T('sfidare un Boss dei Mercati'), KEEPER))) return;
  const run: BossRun | undefined = runs()[def.id];
  if (run?.plan) return resolve(def);
  if (!run) {
    await say(def.intro, def.name);
    if ((await choose([T('Accetto la sfida'), T('Non ora')], { cancel: true, who: def.name })) !== 0) return;
    // fine gioco: sopra l'ultimo duello di Wall Street della stessa difficoltà, fino al livello esperto
    const qs = pickQuestions(def.topics, BOSS_RULES.quizN, { target: endgameDiff() });
    const fid = S.stats.fiducia;
    S.stats.fiducia = 100;
    const r = await runDuel({ foeName: def.name, foeTitle: def.title, foePal: def.pal, questions: qs, need: BOSS_RULES.quizMin, damage: 0, fixed: true, arena: 'borsa' });
    S.stats.fiducia = fid;
    if (r.correct < BOSS_RULES.quizMin) return lose(def, [T`${r.correct} risposte giuste su ${r.total}: ne servivano almeno ${BOSS_RULES.quizMin} per presentare un piano.`]);
    runs()[def.id] = { id: def.id, quiz: r.correct, quizMax: r.total, plan: null, startedAt: Date.now() };
    save();
    await say([T`${r.correct} su ${r.total}: mi hai tolto ${quizPoints(r.correct, r.total)} punti di energia. Ora il piano.`], def.name);
  }
  await planForm(def);
}

/** Ampiezza media recente delle candele del boss, in rapporto al prezzo. */
async function recentVol(sym: string, def: BossDef): Promise<number> {
  const days = def.tf === '5Min' ? 4 : def.tf === '1Hour' ? 20 : 90;
  const { bars } = await A.bars(sym, cls(sym), iso(Date.now() - days * 86400000), iso(Date.now() + 86400000), def.tf);
  const last = bars.slice(-30);
  if (last.length < 5) throw new Error(T('Alpaca non ha abbastanza candele recenti per questo titolo.'));
  return last.reduce((s, b) => s + (b.h - b.l) / b.c, 0) / last.length;
}

async function planForm(def: BossDef): Promise<void> {
  let pool = unlockedAssets(S.track, S.mixedClasses, 8, Object.keys(S.cards));
  // l'acquisto del piano deve essere eseguito subito: a Borsa chiusa restano le cripto. Un mandato più corto di
  // una seduta deve inoltre avere il mercato aperto per tutta la sua durata
  let stocksOk = false;
  try { const c = await A.clock('paper'); stocksOk = c.is_open && (!def.cryptoOnlyWhenClosed || Date.parse(c.next_close) - Date.now() > def.durationMs + 5 * 60_000); } catch { stocksOk = false; }
  if (!stocksOk) {
    pool = pool.filter((a) => a.cls === 'crypto' && a.sector !== 'stable');
    if (!pool.length) {
      await say(def.cryptoOnlyWhenClosed
        ? [T('Con me si combatte a Borsa aperta, con almeno due ore di seduta davanti. Adesso non ci sono.'), T('Il tuo quiz resta valido: torna durante la seduta americana.')]
        : [T('Il piano compra subito, e adesso la Borsa è chiusa: tra i tuoi titoli non ci sono cripto con cui partire.'), T('Il tuo quiz resta valido: torna a Borsa aperta.')], def.name);
      return;
    }
    await say(def.cryptoOnlyWhenClosed ? T('La Borsa è chiusa o sta per chiudere: per questo mandato restano le cripto, che non chiudono mai.') : T('La Borsa è chiusa e il piano compra subito: adesso restano le cripto, che non chiudono mai. Per le azioni torna a Borsa aperta.'), KEEPER);
  }
  // la posizione del mandato deve restare distinta: niente titoli già in portafoglio, in un ordine o in un altro piano
  pool = pool.filter((a) => a.sector !== 'stable' && !M.assetProblem(a.id));
  // dopo una vendita la sfida si ripete con un titolo diverso
  const sold = S.boss.barred?.[def.id];
  pool = planPool(pool, S.boss, def.id);
  if (!pool.length) { await say(T('In questo momento non ci sono titoli liberi tra cui scegliere per questo mandato: servono titoli che non hai già in portafoglio. Il tuo quiz resta valido: torna più tardi.'), def.name); return; }
  const res = await modal<{ asset: string; stop: number; target: number; risk: number } | null>(T`${def.name} · il piano`, ({ body, button, close }) => {
    body.innerHTML = T`
      <p class="small">Una sola decisione, su un grafico vero, con <b>ordini veri sul conto di gioco</b>: all'invio compri il titolo al prezzo del momento e parte uno stop vero al prezzo che indichi. Quanto compri lo decide il rischio: capitale × rischio ÷ distanza dello stop. Durata del mandato: <b>${def.durationLabel}</b>. Dopo l'invio stop e obiettivo non si cambiano.</p>
      <p class="small">Se il piano va male, la perdita resta sul conto e la sfida si rifà da capo.</p>
      <p class="small">Se l'obiettivo non arriva puoi vendere prima della scadenza e puntare su un altro titolo: anche una vendita parziale annulla la sfida, e la ripeti da capo con un titolo diverso.${sold ? T` Hai venduto <b>${esc(ASSET_BY_ID[sold]?.ticker ?? sold)}</b> nell'ultimo mandato: questa volta scegli un altro titolo.` : ''}</p>
      <label>Titolo <select class="tx as">${pool.map((a) => `<option value="${esc(a.id)}">${esc(a.ticker)} · ${esc(a.name)}</option>`).join('')}</select></label>
      <p class="px small muted">Prezzo: …</p>
      <div class="grid2">
        <label>Stop (prezzo a cui esci in perdita)<input class="tx st" type="number" step="any"></label>
        <label>Obiettivo (prezzo a cui incassi)<input class="tx tg" type="number" step="any"></label>
        <label>Rischio: % del capitale della sfida che perdi se scatta lo stop<input class="tx rk" type="number" min="0.5" max="5" step="0.5" value="1"></label>
      </div>
      <p class="sz small"></p>
      <p class="msg small bad"></p>`;
    const q = <T extends HTMLElement>(s: string) => body.querySelector(s) as T;
    const sel = q<HTMLSelectElement>('.as');
    let price = 0;
    // quanto comprerebbe il piano adesso: lo si vede prima di inviare
    const size = () => {
      const stop = Number(q<HTMLInputElement>('.st').value), risk = Number(q<HTMLInputElement>('.rk').value) / 100;
      const z = price > 0 && stop > 0 && stop < price && risk > 0 ? M.sizeFor(price, stop, risk) : null;
      q('.sz').textContent = !z ? '' : z.amount >= 1 ? T`Con questo piano compri circa ${fmtMoney(z.amount)} di ${ASSET_BY_ID[sel.value].ticker}${z.capped ? T(': è tutta la liquidità disponibile, quindi il rischio vero sarà più basso di quello indicato') : ''}. Se scatta lo stop perdi circa ${fmtMoney(z.amount * (price - stop) / price)}.` : T('Non hai liquidità disponibile per questo piano.');
    };
    body.querySelectorAll('.st, .rk').forEach((i) => i.addEventListener('input', size));
    const load = async () => {
      q('.px').textContent = T('Prezzo: …');
      try { price = (await A.latest(sel.value, cls(sel.value))).price; q('.px').textContent = T`Prezzo attuale di ${ASSET_BY_ID[sel.value].ticker}: ${fmtPx(price)} $ (l'ingresso sarà al prezzo del momento dell'invio).`; }
      catch (e) { price = 0; q('.px').textContent = T`Prezzo non disponibile: ${(e as Error).message}`; }
      size();
    };
    sel.addEventListener('change', () => void load());
    void load();
    button(T('Grafico'), () => void realChart(sel.value));
    button(T('Invia il piano e compra'), () => {
      const p = { entry: price, stop: Number(q<HTMLInputElement>('.st').value), target: Number(q<HTMLInputElement>('.tg').value), risk: Number(q<HTMLInputElement>('.rk').value) / 100 };
      const err = price > 0 ? planError(p) : T('Aspetta il prezzo.');
      if (err) { q('.msg').textContent = err; return; }
      close({ asset: sel.value, stop: p.stop, target: p.target, risk: p.risk });
    }, 'primary');
    button(T('Ci penso'), () => close(null));
  }, { wide: true, closable: false });
  if (!res) { await say(T('Il quiz resta valido: torna quando hai un piano.'), def.name); return; }
  try {
    const [vol, last] = await Promise.all([recentVol(res.asset, def), A.latest(res.asset, cls(res.asset))]);
    const draft = { entry: last.price, stop: res.stop, target: res.target, risk: res.risk };
    const err = planError(draft);
    if (err) { await say(T`Nel frattempo il prezzo si è mosso a ${fmtPx(last.price)} $ e il piano non regge più: ${err}`, KEEPER); return planForm(def); }
    const sc = planScore(draft, vol);
    const cur = runs()[def.id];
    // un piano che non può vincere nemmeno con l'esito migliore non viene registrato: niente attese a vuoto
    const best = quizPoints(cur.quiz, cur.quizMax) + sc.points + BOSS_RULES.outcomeMax;
    if (best < BOSS_RULES.win) {
      await modal(T('Piano da rifare'), ({ body, button, close }) => {
        body.innerHTML = T`<p><b>Qualità del piano: ${sc.points}/${BOSS_RULES.planMax}.</b> Con il tuo quiz (${cur.quiz}/${cur.quizMax}) anche l'esito migliore porterebbe a ${best} punti: ne servono ${BOSS_RULES.win}.</p>
          <ul class="small">${sc.notes.map((n) => `<li class="${n.ok ? 'good' : 'bad'}">${esc(n.text)}</li>`).join('')}</ul>
          <p class="small">Non lo registro e non invio ordini: aspettare ${esc(def.durationLabel.split(',')[0])} per una sconfitta già scritta non insegna nulla. Il quiz resta valido: correggi il piano.</p>`;
        button(T('Rifaccio il piano'), () => close(), 'primary');
      });
      return planForm(def);
    }
    // gli ordini partono solo dopo una conferma esplicita, con importo e perdita possibile in chiaro
    const tick = ASSET_BY_ID[res.asset].ticker;
    const size = M.sizeFor(last.price, res.stop, res.risk);
    if (!(size.amount >= 1)) { await say(T('Non hai liquidità disponibile per questo piano: libera capitale dalla Banca e riprova. Il quiz resta valido.'), KEEPER); return; }
    const go = await choose([T`Compro ${fmtMoney(size.amount)} di ${tick} e metto lo stop`, T('Rifaccio il piano'), T('Ci penso')], { cancel: true, who: def.name, prompt: T`Qualità del piano: ${sc.points}/${BOSS_RULES.planMax}. Sto per inviare ordini veri sul conto di gioco: un acquisto a mercato di ${fmtMoney(size.amount)} di ${tick} (ora a ${fmtPx(last.price)} $) e uno stop di vendita a ${fmtPx(res.stop)} $. Se lo stop scatta perdi circa ${fmtMoney(size.amount * (last.price - res.stop) / last.price)}, e quella perdita resta sul conto. Confermi?` });
    if (go === 1) return planForm(def);
    if (go !== 0) { await say(T('Nessun ordine inviato. Il quiz resta valido: torna quando hai deciso.'), def.name); return; }
    const r = await M.openMandate(def, res, sc.points);
    if (!r.ok || !r.plan) { await say(r.msg, KEEPER); return; }
    const plan = r.plan;
    await modal(T('Piano registrato, ordini inviati'), ({ body, button, close }) => {
      body.innerHTML = T`<p>Ingresso <b>${fmtPx(plan.entry)} $</b> su ${esc(tick)} · stop ${fmtPx(plan.stop)} · obiettivo ${fmtPx(plan.target)} · rischio ${(plan.risk * 100).toFixed(1)}%.</p>
        <ul class="small">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <p><b>Qualità del piano: ${sc.points}/${BOSS_RULES.planMax}</b> <span class="small muted">(giudicata adesso, prima di sapere come va)</span></p>
        <ul class="small">${sc.notes.map((n) => `<li class="${n.ok ? 'good' : 'bad'}">${esc(n.text)}</li>`).join('')}</ul>
        <p class="small">Scadenza: <b>${when(plan.deadline)}</b>. Torna alla Torre dopo quell'ora (i dati arrivano con un quarto d'ora di ritardo). Nel frattempo puoi chiudere il gioco: lo stop è su Alpaca.</p>
        <p class="small">Se l'obiettivo non arriva, torna da me prima della scadenza: puoi vendere e ripetere la sfida con un altro titolo. Anche vendere ${esc(tick)} dalla Banca o dal sito di Alpaca annulla la sfida.</p>`;
      button('Ok', () => close(), 'primary');
    });
  } catch (e) { await say(T`Non riesco a registrare il piano: ${(e as Error).message}`, KEEPER); }
}

/** Vendere prima della scadenza: la sfida è annullata e si ripete da capo con un titolo diverso. */
async function sellMandate(def: BossDef): Promise<void> {
  const p = runs()[def.id]?.plan;
  if (!p) return;
  const tick = ASSET_BY_ID[p.asset]?.ticker ?? p.asset;
  const c = await choose([T('Vendo tutto per annullare la sfida'), p.real ? T('Vendo metà per annullare la sfida') : T('Vendo una parte per annullare la sfida'), T('Tengo il piano')], { cancel: true, who: def.name, prompt: T`Se pensi che ${tick} non arriverà all'obiettivo puoi vendere e puntare su un altro titolo. Decidere di vendere, anche solo una parte, annulla la sfida: la ripeti da capo, quiz compreso, con un titolo diverso da ${tick}. Scegli tu come vendi: in tutti e due i casi dichiari che vendi per annullare la sfida e rifarla con un altro titolo.` });
  if (c !== 0 && c !== 1) return;
  if (p.real) {
    // la vendita è vera: parte un ordine sul conto di gioco, e la sfida è annullata
    const r = await M.closeMandate(def.id, 'annulla', c === 1 ? 0.5 : 1);
    beep('bad');
    await say([r.msg, r.cancelled ?? T`Il mandato su ${tick} è annullato: non conta come sconfitta.`, T`Quando vuoi riprovare ricominci dal quiz, e per il piano sceglierai un titolo diverso da ${tick}.${c === 1 ? T` La parte di ${tick} che hai tenuto resta una posizione normale, senza lo stop del piano.` : ''}`], def.name);
    return;
  }
  if (!sellOut(S.boss, def.id)) return;
  save();
  beep('bad');
  await say([T`Hai deciso di vendere ${c === 1 ? T('una parte di ') : ''}${tick} per annullare la sfida: il mandato è chiuso${c === 1 ? T(', anche se la vendita è parziale') : ''}. Non conta come sconfitta.`, T`Quando vuoi riprovare ricominci dal quiz, e per il piano sceglierai un titolo diverso da ${tick}.`], def.name);
}

async function resolve(def: BossDef): Promise<void> {
  // con gli ordini veri prima si legge che cosa è successo sul conto (stop scattato, vendite fatte altrove)
  if (runs()[def.id]?.plan?.real) {
    (await Acc.sync(true)).forEach((n) => toast(n));
    if (!runs()[def.id]?.plan) { await say(T('Il titolo del piano è stato venduto fuori dal piano: il mandato è annullato. Non conta come sconfitta: quando vuoi ricominci dal quiz, con un altro titolo.'), def.name); return; }
  }
  const run = runs()[def.id];
  const p = run.plan!;
  const a = ASSET_BY_ID[p.asset];
  const tick = a?.ticker ?? p.asset;
  const money = M.mandateMoney(def.id);
  const holding = !!money && money.held > 0;
  // se la posizione vera è già stata venduta dal piano (stop scattato, obiettivo incassato) l'esito si può leggere subito
  const closedEarly = !!money && !holding && money.sold > 0;
  const ready = p.deadline + BOSS_RULES.evalDelayMs;
  if (Date.now() < ready && !closedEarly) {
    const running = Date.now() < p.deadline;
    const noStop = M.stopMissing(def.id);
    const acts: [string, () => Promise<unknown>][] = [[T('Guardo il grafico'), () => realChart(p.asset, { price: p.entry, label: 'ingresso' })]];
    if (running && (!p.real || holding)) acts.push([T('Vendo e cambio titolo'), () => sellMandate(def)]);
    if (holding && (S.market.prices[p.asset] ?? 0) >= p.target) acts.push([T('Incasso l\'obiettivo (vendo tutto)'), async () => { const r = await M.closeMandate(def.id, 'obiettivo'); await say([r.msg, r.ok ? T('L\'obiettivo è incassato: il mandato resta valido, torna da me per l\'esito.') : T('Riprova tra poco.')], def.name); }]);
    if (running && noStop) acts.push([T('Rimetto lo stop'), async () => { const r = await M.restoreStop(def.id); await say(r.msg, KEEPER); }]);
    acts.push([T('Torno più tardi'), async () => undefined]);
    const realLine = !p.real ? '' : holding ? T` Sul conto hai ${fmtQty(money!.held)} ${tick}${noStop ? T(', ma lo stop vero non è più attivo (sulle quote frazionarie Alpaca lo tiene solo per la seduta): rimettilo') : T(', con lo stop vero attivo')}. Risultato finora: ${money!.result >= 0 ? '+' : '−'}${fmtMoney(Math.abs(money!.result))}.` : T(' La posizione sul conto è già stata venduta.');
    const c = await choose(acts.map((x) => x[0]), { cancel: true, who: def.name, prompt: T`Il tuo piano su ${tick} è in corso: ingresso ${fmtPx(p.entry)}, stop ${fmtPx(p.stop)}, obiettivo ${fmtPx(p.target)}. Si chiude il ${when(p.deadline)}; l'esito si legge dal ${when(ready)}.${realLine}` });
    if (c >= 0) await acts[c][1]();
    return;
  }
  const until = Math.min(p.deadline, Date.now());
  let bars: A.Bar[];
  try { bars = (await A.bars(p.asset, cls(p.asset), iso(p.placedAt), iso(p.deadline + 86400000), def.tf)).bars.filter((b) => { const t = Date.parse(b.t); return t > p.placedAt && t <= until; }); }
  catch (e) { await say(T`Non riesco a leggere le candele del periodo: ${(e as Error).message}. Riprova tra poco.`, KEEPER); return; }
  if (closedEarly && Date.now() < ready && (!bars.length || outcome(p, bars).how === 'scadenza')) { await say(T('La posizione sul conto è già stata venduta, ma le candele non mostrano ancora l\'uscita: i dati arrivano con un quarto d\'ora di ritardo. Torna tra poco per l\'esito.'), KEEPER); return; }
  if (!bars.length) {
    p.deadline += 86400000; save();
    toast(T('Mandato prolungato di un giorno.'));
    await say(T('Nel periodo del mandato il mercato non ha scambiato questo titolo (era chiuso). Prolungo la scadenza di un giorno: nessuna penalità.'), KEEPER);
    return;
  }
  const out = outcome(p, bars);
  const qp = quizPoints(run.quiz, run.quizMax);
  const total = qp + p.quality + out.points;
  const won = bossWon(qp, p.quality, out.points);
  await modal(T`${def.name} · l'esito`, ({ body, button, close }) => {
    body.innerHTML = T`<p>${out.how === 'stop' ? T('È scattato lo <b>stop</b>') : out.how === 'obiettivo' ? T('Raggiunto l\'<b>obiettivo</b>') : T('Mandato arrivato a <b>scadenza</b>')}: uscita a ${fmtPx(out.exit)} $ (${fmtPct(out.exit / p.entry - 1)}), cioè ${out.r >= 0 ? '+' : ''}${out.r.toFixed(2)} volte il rischio. Sul capitale della sfida: ${fmtPct(out.r * p.risk)}.</p>
      <table class="t"><tr><th>Energia tolta al Boss</th><th class="n">Punti</th></tr>
      <tr><td>Quiz (${run.quiz}/${run.quizMax})</td><td class="n">${qp}/${BOSS_RULES.quizMax}</td></tr>
      <tr><td>Qualità del piano</td><td class="n">${p.quality}/${BOSS_RULES.planMax}</td></tr>
      <tr><td>Esito reale</td><td class="n">${out.points}/${BOSS_RULES.outcomeMax}</td></tr>
      <tr><td><b>Totale</b> (ne servono ${BOSS_RULES.win})</td><td class="n"><b>${total}</b></td></tr></table>
      ${money ? T`<p>Sul conto di gioco, con gli ordini veri: <b class="${money.result >= 0 ? 'good' : 'bad'}">${money.result >= 0 ? '+' : '−'}${fmtMoney(Math.abs(money.result))}</b>${holding ? T` (posizione ancora aperta: ${fmtQty(money.held)} ${esc(tick)})` : T(' (posizione chiusa)')}. Il punteggio si legge sulle candele, il denaro segue gli ordini: per questo i due numeri possono differire di poco.</p>` : ''}
      <p class="${won ? 'good' : 'bad'}"><b>${won ? T`Hai battuto ${esc(def.name)}!` : T`${esc(def.name)} resiste.`}</b></p>
      <p class="small muted">${out.how === 'stop' ? T('Uno stop rispettato è un piano che ha funzionato: la perdita era decisa prima.') : T('Un buon esito non prova che il piano fosse buono, e viceversa: per questo contano anche gli altri due punteggi.')} Candele reali di Alpaca (${out.bars}).</p>`;
    button(T('Continua'), () => close(), 'primary');
  }, { closable: false });
  // a mandato finito la posizione vera è del giocatore: decide lui se chiuderla
  if (holding) {
    const c = await choose([T('Chiudo la posizione adesso'), T('La tengo')], { cancel: true, who: KEEPER, prompt: T`Il mandato è finito e sul conto hai ancora ${fmtQty(money!.held)} ${tick}. Vuoi venderli adesso o tenerli come una posizione normale?` });
    if (c === 0) { const r = await M.closeMandate(def.id, 'mandato'); await say(r.msg, KEEPER); }
    else await say(T`Tieni ${tick}: da ora è una posizione come le altre, la gestisci dalla Banca${M.stopMissing(def.id) ? '' : T(' (lo stop del piano resta attivo finché non lo togli o scade)')}.`, KEEPER);
  }
  const after = M.mandateMoney(def.id);
  if (!won) return lose(def, [T('Non è bastato.'), ...(after && after.result < 0 ? [T`La perdita di ${fmtMoney(-after.result)} su ${tick} resta sul conto: fa parte della sfida.`] : [])]);
  endRun(S.boss, def.id);
  const first = !S.boss.beaten.includes(def.id);
  if (first) { S.boss.beaten.push(def.id); reward({ rep: REWARD.rep.boss, xp: REWARD.xp.legend, save: false }); }
  save();
  beep('badge');
  await say([first ? T`Hai battuto ${def.name}!` : T`Hai battuto di nuovo ${def.name}.`, S.boss.beaten.length >= BOSSES.length ? T('Tutti e tre i Boss dei Mercati sono caduti. Non c\'è più nessuno, a Capitalia, che ne sappia più di te su come si costruisce un piano.') : T`Boss battuti: ${S.boss.beaten.length}/${BOSSES.length}.`], KEEPER);
}
