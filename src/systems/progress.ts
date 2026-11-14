// Agenda (missioni del giorno e della settimana), traguardi con titoli e contatori.
// Le ricompense sono sempre punti Conoscenza, titoli e oggetti per la casa: mai Crediti.
import { S, save, level } from './state';
import { todayKey } from './quiz';
import { toast } from '../ui/core';
import { jingle } from './music';
import { ALL_RESIDENTS } from '../data/residents';
import type { AgendaTask } from '../types';
import { LEDGER_PAGES, pageFlag, SECRET_FLAGS } from '../world/secretsData';
import { RELICS, relicsFound, relicsOf, type CaveKey } from '../world/caves';
import { T } from '../i18n';

// ---------------- Contatori di eventi ----------------

export type GameEvent =
  | 'lesson' | 'duel_win' | 'duel_loss' | 'duel_perfect' | 'checkup' | 'tip' | 'daily_q' | 'mission' | 'journal' | 'minigame'
  | 'rematch' | 'steps' | 'trade' | 'rebalance' | 'quest' | 'house_unique' | 'review' | 'review_journal' | 'challenge' | 'badge' | 'legend' | 'islet' | 'secret' | 'relic';

const listeners: ((ev: GameEvent, n: number) => void)[] = [];
export function onEvent(fn: (ev: GameEvent, n: number) => void) { listeners.push(fn); }

/** Registra un evento di gioco: aggiorna contatori, agenda e traguardi. */
export function track(ev: GameEvent, n = 1) {
  if (!S) return;
  S.counters[ev] = (S.counters[ev] ?? 0) + n;
  agendaProgress(ev, n);
  listeners.forEach((l) => l(ev, n));
  checkAchievements();
}

// ---------------- Agenda ----------------

interface TaskDef { id: string; ev: GameEvent; need: number; text: string; xp: number }

const DAILY_POOL: TaskDef[] = [
  { id: 'd_lesson', ev: 'lesson', need: 1, text: T('Leggi una lezione in Biblioteca'), xp: 15 },
  { id: 'd_duel', ev: 'duel_win', need: 1, text: T('Vinci un duello di conoscenza'), xp: 20 },
  { id: 'd_duel2', ev: 'duel_win', need: 2, text: T('Vinci due duelli di conoscenza'), xp: 30 },
  { id: 'd_checkup', ev: 'checkup', need: 1, text: T('Fai il check-up del portafoglio in Banca'), xp: 10 },
  { id: 'd_tip', ev: 'tip', need: 2, text: T('Ascolta due lezioni degli abitanti'), xp: 15 },
  { id: 'd_daily', ev: 'daily_q', need: 1, text: T('Rispondi alla domanda del giorno'), xp: 15 },
  { id: 'd_steps', ev: 'steps', need: 150, text: T('Cammina 150 passi sui percorsi'), xp: 10 },
  { id: 'd_journal', ev: 'journal', need: 1, text: T('Scrivi una riga nel Diario dopo un\'operazione'), xp: 15 },
  { id: 'd_mini', ev: 'minigame', need: 1, text: T('Gioca un minigioco in Biblioteca o Zona Simulazione'), xp: 15 },
  { id: 'd_review', ev: 'review', need: 1, text: T('Fai il ripasso delle domande in scadenza in Biblioteca'), xp: 20 },
];

const WEEKLY_POOL: TaskDef[] = [
  { id: 'w_duel', ev: 'duel_win', need: 8, text: T('Vinci 8 duelli nella settimana'), xp: 80 },
  { id: 'w_perfect', ev: 'duel_perfect', need: 2, text: T('Vinci 2 duelli senza errori'), xp: 100 },
  { id: 'w_lessons', ev: 'lesson', need: 5, text: T('Leggi 5 lezioni'), xp: 60 },
  { id: 'w_mission', ev: 'mission', need: 1, text: T('Completa una missione nella Macchina del Tempo'), xp: 100 },
  { id: 'w_tips', ev: 'tip', need: 8, text: T('Ascolta 8 abitanti'), xp: 60 },
  { id: 'w_daily', ev: 'daily_q', need: 4, text: T('Rispondi alla domanda del giorno 4 volte'), xp: 80 },
  { id: 'w_rematch', ev: 'rematch', need: 3, text: T('Vinci 3 rivincite a Wall Street'), xp: 90 },
  { id: 'w_mini', ev: 'minigame', need: 4, text: T('Gioca 4 minigiochi'), xp: 70 },
  { id: 'w_quest', ev: 'quest', need: 1, text: T('Completa una storia di un abitante'), xp: 120 },
  { id: 'w_journal', ev: 'journal', need: 3, text: T('Scrivi 3 righe di Diario'), xp: 60 },
];

export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((+t - +y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

function seeded(str: string): () => number {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
}

function pickTasks(pool: TaskDef[], n: number, seedStr: string): AgendaTask[] {
  const rng = seeded(seedStr);
  const avail = pool.filter((t) => !(t.ev === 'rematch' && !S.flags.champion) && !(t.ev === 'mission' && S.badges < 1));
  const out: TaskDef[] = [];
  const used = new Set<string>();
  while (out.length < n && out.length < avail.length) {
    const t = avail[Math.floor(rng() * avail.length)];
    if (used.has(t.ev + t.need)) continue;
    used.add(t.ev + t.need);
    out.push(t);
  }
  return out.map((t) => ({ id: t.id, ev: t.ev, need: t.need, got: 0, done: false }));
}

export function taskDef(id: string): TaskDef | undefined { return DAILY_POOL.concat(WEEKLY_POOL).find((t) => t.id === id); }

/** Rinnova l'agenda se è cambiato il giorno o la settimana. */
export function refreshAgenda() {
  if (!S) return;
  const today = todayKey(), week = weekKey();
  if (S.agenda.day !== today) { S.agenda.day = today; S.agenda.daily = pickTasks(DAILY_POOL, 3, today + S.name); S.agenda.dailyDone = 0; }
  if (S.agenda.week !== week) { S.agenda.week = week; S.agenda.weekly = pickTasks(WEEKLY_POOL, 1, week + S.name); }
}

function agendaProgress(ev: GameEvent, n: number) {
  refreshAgenda();
  for (const t of [...S.agenda.daily, ...S.agenda.weekly]) {
    if (t.done || t.ev !== ev) continue;
    t.got = Math.min(t.need, t.got + n);
    if (t.got >= t.need) {
      t.done = true;
      const def = taskDef(t.id);
      const xp = def?.xp ?? 20;
      S.stats.xp += xp;
      if (S.agenda.daily.includes(t)) S.agenda.dailyDone++;
      jingle('quest');
      toast(T`Agenda: "${def?.text ?? t.id}" completata! +${xp} Conoscenza`);
      if (S.agenda.daily.every((d) => d.done) && S.agenda.daily.length) { S.stats.xp += 25; S.counters.agenda_full = (S.counters.agenda_full ?? 0) + 1; }
    }
  }
}

// ---------------- Traguardi e titoli ----------------

/** secret: nascosto come "???" nell'Agenda finché non viene sbloccato. */
export interface Achievement { id: string; name: string; desc: string; title?: string; decor?: string; secret?: boolean; check: () => boolean }

const c = (k: string) => S.counters[k] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_step', name: T('Primo seme'), desc: T('Scegli la tua Valigetta'), title: 'Germoglio', check: () => !!S.flags.starter },
  { id: 'duel1', name: T('Prima vittoria'), desc: T('Vinci il primo duello'), check: () => c('duel_win') >= 1 },
  { id: 'duel10', name: T('Dieci su dieci'), desc: T('Vinci 10 duelli'), title: 'Studioso', check: () => c('duel_win') >= 10 },
  { id: 'duel50', name: T('Veterano dei quiz'), desc: T('Vinci 50 duelli'), title: 'Veterano', decor: 'trophy_silver', check: () => c('duel_win') >= 50 },
  { id: 'perfect10', name: T('Senza sbavature'), desc: T('10 duelli perfetti'), title: 'Infallibile', decor: 'trophy_gold', check: () => c('duel_perfect') >= 10 },
  { id: 'badge1', name: T('Primo Attestato'), desc: T('Batti la prima Whale'), title: 'Apprendista', decor: 'poster_badges', check: () => S.badges >= 1 },
  { id: 'badge4', name: T('Metà strada'), desc: T('Quattro Attestati'), title: 'Investitore in erba', check: () => S.badges >= 4 },
  { id: 'badge8', name: T('Tutti gli Attestati'), desc: T('Otto Attestati'), title: 'Maestro delle Whale', decor: 'poster_badges', check: () => S.badges >= 8 },
  { id: 'champion', name: T('Campione'), desc: T('Vinci Wall Street'), title: 'Campione', decor: 'trophy_league', check: () => !!S.flags.champion },
  { id: 'tips10', name: T('Buon vicino'), desc: T('Ascolta 10 abitanti'), check: () => S.tipsHeard.length >= 10 },
  { id: 'tips_all', name: T('Orecchio della regione'), desc: T('Ascolta tutti gli abitanti'), title: 'Amico di tutti', decor: 'plant_big', check: () => S.tipsHeard.length >= ALL_RESIDENTS.length },
  { id: 'lessons10', name: T('Topo di biblioteca'), desc: T('Leggi 10 lezioni'), title: 'Lettore', decor: 'bookshelf_full', check: () => S.lessonsRead.length >= 10 },
  { id: 'lessons_all', name: T('Enciclopedia'), desc: T('Leggi 30 lezioni'), title: 'Enciclopedico', check: () => S.lessonsRead.length >= 30 },
  { id: 'streak7', name: T('Una settimana di fila'), desc: T('Serie di 7 domande del giorno'), title: 'Costante', check: () => S.daily.streak >= 7 },
  { id: 'streak30', name: T('Un mese di fila'), desc: T('Serie di 30 domande del giorno'), title: 'Disciplinato', decor: 'calendar', check: () => S.daily.streak >= 30 },
  { id: 'checkup5', name: T('Cliente modello'), desc: T('5 check-up in Banca'), check: () => c('checkup') >= 5 },
  { id: 'rebalance3', name: T('In equilibrio'), desc: '3 ribilanciamenti', title: 'Equilibrista', check: () => c('rebalance') >= 3 },
  { id: 'mission3', name: T('Viaggiatore del tempo'), desc: T('3 missioni nella Macchina del Tempo'), title: 'Cronista', check: () => c('mission') >= 3 },
  { id: 'no_loss_sale', name: T('Mano ferma'), desc: T('Completa una missione senza vendere in perdita'), title: 'Mano ferma', check: () => !!S.flags.missionNoLossSale },
  { id: 'journal5', name: T('Diarista'), desc: T('5 righe nel Diario'), title: 'Diarista', decor: 'desk_journal', check: () => S.journal.length >= 5 },
  { id: 'journal_review', name: T('Senno di poi'), desc: T('Rileggi 5 operazioni dopo 30 giorni'), title: 'Riflessivo', check: () => c('review_journal') >= 5 },
  { id: 'rematch5', name: T('Rivincita servita'), desc: T('Vinci 5 rivincite a Wall Street'), title: 'Tenace', check: () => c('rematch') >= 5 },
  { id: 'mini_all', name: T('Giocatore completo'), desc: T('Prova tutti e 4 i minigiochi'), title: 'Giocoliere', decor: 'arcade', check: () => Object.keys(S.minigames).length >= 4 },
  { id: 'mini_ace', name: T('Asso dei minigiochi'), desc: T('Punteggio pieno in un minigioco'), check: () => Object.values(S.minigames).some((v) => v >= 100) },
  { id: 'quest1', name: T('Una mano agli altri'), desc: T('Completa una storia di un abitante'), title: 'Buon consigliere', check: () => c('quest') >= 1 },
  { id: 'quest_all', name: T('Il consigliere della regione'), desc: T('Completa tutte le storie degli abitanti'), title: 'Consigliere', decor: 'frame_letters', check: () => c('quest') >= 6 },
  { id: 'houses_all', name: T('Porta a porta'), desc: T('Entra in tutte le 30 case'), check: () => c('house_unique') >= 30 },
  { id: 'agenda7', name: T('Agenda piena'), desc: T('Completa tutte le missioni del giorno 7 volte'), title: 'Metodico', check: () => c('agenda_full') >= 7 },
  { id: 'islets_all', name: T('Navigatore di Liquidità'), desc: T('Vinci la sfida sulle tre Isole della Liquidità'), title: 'Navigatore', check: () => [3, 5, 7].every((r) => !!S.flags[`islet_r${r}`]) },
  { id: 'sea_all', name: T('Capitano di Liquidità'), desc: T('Vinci le sfide della Guardiana del Faro e del Pescatore di Perle'), title: 'Capitano', check: () => !!S.flags.islet_faro && !!S.flags.islet_perle },
  { id: 'legend1', name: T('Storico'), desc: T('Supera una crisi leggendaria'), title: 'Storico', check: () => S.legends.length >= 1 },
  { id: 'legend_all', name: T('Memoria dei mercati'), desc: T('Supera tutte le crisi leggendarie'), title: 'Memoria viva', decor: 'globe', check: () => S.legends.length >= 5 },
  { id: 'tower10', name: T('Scalatore'), desc: T('Piano 10 della Torre'), title: 'Scalatore', check: () => S.tower.best >= 10 },
  { id: 'level10', name: T('Conoscenza 10'), desc: T('Raggiungi il livello 10'), check: () => level() >= 10 },
  { id: 'level25', name: T('Conoscenza 25'), desc: T('Raggiungi il livello 25'), title: 'Sapiente', decor: 'trophy_gold', check: () => level() >= 25 },
  { id: 'challenge1', name: T('Sfidante'), desc: T('Gioca una sfida settimanale'), check: () => S.challenges.length >= 1 },
  { id: 'challenge5', name: T('Rivale di tutti'), desc: T('Gioca 5 sfide'), title: 'Sfidante', check: () => S.challenges.length >= 5 },
  { id: 'steps1000', name: T('Mille passi'), desc: T('Cammina 1.000 passi'), check: () => c('steps') >= 1000 },
  { id: 'steps10000', name: T('Esploratore'), desc: T('Cammina 10.000 passi'), title: 'Esploratore', check: () => c('steps') >= 10000 },
  { id: 'bias_all', name: T('Conosco i miei limiti'), desc: T('Impara tutti e 4 i bias'), title: 'Consapevole', check: () => S.biasSeen.length >= 4 },
  { id: 'casino', name: T('Il banco vince sempre'), desc: T('Scopri la lezione del Casinò'), check: () => !!S.flags.casinoLesson },
  // reperti delle grotte (dalla Lanterna, Attestato 5): tre per grotta, mai denaro
  { id: 'relics_gold', name: T('Naso per l\'oro'), desc: T('Trova i tre lingotti della Miniera dei Lingotti'), title: 'Naso per l\'oro', decor: 'ingot', check: () => caveDone('gold') },
  { id: 'relics_dp', name: T('Occhio nel buio'), desc: T('Trova i tre ordini nascosti della Galleria del Dark Pool'), title: 'Occhio nel buio', decor: 'order_frame', check: () => caveDone('dp') },
  { id: 'relics_pearl', name: T('Occhio per il valore'), desc: T('Apri le tre ostriche della Grotta delle Perle'), title: 'Occhio per il valore', decor: 'pearl', check: () => caveDone('pearl') },
  { id: 'caves_all', name: T('Lanterna d\'oro'), desc: T('Trova tutti e nove i reperti delle grotte'), title: 'Lanterna d\'oro', decor: 'lantern', check: () => relicsFound(S.flags) >= RELICS.length },
  // segreti della seconda parte (dalla Medaglia 4): restano "???" finché non li trovi
  { id: 'secret_ledger', name: T('Il Libro Mastro Perduto'), desc: T('Ritrova le sei pagine nascoste di Mastro Ventura'), title: 'Custode del Libro Mastro', decor: 'ledger', secret: true, check: () => ledgerDone() },
  { id: 'secret_tape', name: T('Lettore del Nastro'), desc: T('Trova la Sala del Nastro e batti la Vecchia del Nastro'), title: 'Lettore del Nastro', decor: 'tape', secret: true, check: () => !!S.flags[SECRET_FLAGS.tape] },
  { id: 'secret_whale', name: T('Avvistamento'), desc: T('Incontra lo Squalo nel fine settimana'), title: 'Avvistatore di Squali', secret: true, check: () => !!S.flags[SECRET_FLAGS.whale] },
  { id: 'secret_hodl', name: T('Mani di Diamante'), desc: T('Compi il rituale della pietra sul Percorso 6'), title: 'Mani di Diamante', secret: true, check: () => !!S.flags[SECRET_FLAGS.hodl] },
  { id: 'secret_all', name: T('Cacciatore di Segreti'), desc: T('Scopri tutti i segreti della regione'), title: 'Cacciatore di Segreti', decor: 'lamp', secret: true, check: () => ledgerDone() && !!S.flags[SECRET_FLAGS.tape] && !!S.flags[SECRET_FLAGS.whale] && !!S.flags[SECRET_FLAGS.hodl] },
];

function caveDone(k: CaveKey): boolean { return relicsFound(S.flags, k) >= relicsOf(k).length; }
function ledgerDone(): boolean { return LEDGER_PAGES.every((p) => !!S.flags[pageFlag(p.id)]); }

/** Controlla i traguardi e assegna quelli nuovi. */
export function checkAchievements(): Achievement[] {
  if (!S) return [];
  const got: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (S.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = a.check(); } catch { ok = false; }
    if (!ok) continue;
    S.achievements.push(a.id);
    got.push(a);
    if (a.decor && !S.decor.includes(a.decor)) S.decor.push(a.decor);
    S.stats.xp += 25;
  }
  if (got.length) {
    jingle('badge');
    const a = got[got.length - 1];
    toast(`${T`Traguardo: ${a.name}`}${a.title ? T` · titolo "${T(a.title!)}"` : ''}${a.decor ? T(' · nuovo oggetto per la casa') : ''}${got.length > 1 ? ` (+${got.length - 1})` : ''}`);
    save();
  }
  return got;
}

/** Titoli sbloccati, in italiano (sono la chiave salvata in S.title): mostrali con T(). */
export function availableTitles(): string[] {
  return ACHIEVEMENTS.filter((a) => a.title && S.achievements.includes(a.id)).map((a) => a.title!);
}

export const DECOR_INFO: Record<string, { name: string; tile: string }> = {
  trophy_silver: { name: T('Trofeo d\'argento'), tile: 'trophy_silver' },
  trophy_gold: { name: T('Trofeo d\'oro'), tile: 'trophy_gold' },
  trophy_league: { name: T('Coppa di Wall Street'), tile: 'trophy_league' },
  poster_badges: { name: T('Bacheca degli Attestati'), tile: 'poster' },
  plant_big: { name: T('Pianta rigogliosa'), tile: 'plant' },
  bookshelf_full: { name: T('Libreria piena'), tile: 'shelf' },
  calendar: { name: T('Calendario delle serie'), tile: 'calendar' },
  desk_journal: { name: T('Scrivania del Diario'), tile: 'desk' },
  arcade: { name: T('Cabinato'), tile: 'arcade' },
  frame_letters: { name: T('Lettere di ringraziamento'), tile: 'frame' },
  globe: { name: T('Mappamondo'), tile: 'globe' },
  radio: { name: T('Radio di Eleonora'), tile: 'radio' },
  aquarium: { name: T('Acquario di Gennaro'), tile: 'aquarium' },
  painting: { name: T('Quadro di Ottavio'), tile: 'painting' },
  ledger: { name: T('Libro Mastro rilegato'), tile: 'shelf' },
  tape: { name: T('Nastro delle quotazioni incorniciato'), tile: 'frame' },
  lamp: { name: T('Mappamondo delle rotte segrete'), tile: 'globe' },
  ingot: { name: T('Lingotto della Miniera'), tile: 'ingot' },
  order_frame: { name: T('Ordine nascosto incorniciato'), tile: 'frame' },
  pearl: { name: T('Perla della Grotta'), tile: 'pearl' },
  lantern: { name: T('Lanterna della Due Diligence'), tile: 'lantern' },
};
