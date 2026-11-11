// Agenda (missioni del giorno e della settimana), traguardi con titoli, rivincite e contatori.
// Le ricompense sono sempre punti Conoscenza, titoli e oggetti per la casa: mai Crediti.
import { S, save, level } from './state';
import { todayKey } from './quiz';
import { toast } from '../ui/core';
import { jingle } from './music';
import { ALL_RESIDENTS } from '../data/residents';
import type { AgendaTask } from '../types';
import { LEDGER_PAGES, pageFlag, SECRET_FLAGS } from '../world/secretsData';

// ---------------- Contatori di eventi ----------------

export type GameEvent =
  | 'lesson' | 'duel_win' | 'duel_loss' | 'duel_perfect' | 'checkup' | 'tip' | 'daily_q' | 'mission' | 'journal' | 'minigame'
  | 'rematch' | 'steps' | 'trade' | 'rebalance' | 'quest' | 'house_unique' | 'review' | 'review_journal' | 'challenge' | 'badge' | 'legend' | 'islet' | 'secret';

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
  { id: 'd_lesson', ev: 'lesson', need: 1, text: 'Leggi una lezione in Biblioteca o dal menu', xp: 15 },
  { id: 'd_duel', ev: 'duel_win', need: 1, text: 'Vinci un duello di conoscenza', xp: 20 },
  { id: 'd_duel2', ev: 'duel_win', need: 2, text: 'Vinci due duelli di conoscenza', xp: 30 },
  { id: 'd_checkup', ev: 'checkup', need: 1, text: 'Fai il check-up del portafoglio in Clinica', xp: 10 },
  { id: 'd_tip', ev: 'tip', need: 2, text: 'Ascolta due lezioni degli abitanti', xp: 15 },
  { id: 'd_daily', ev: 'daily_q', need: 1, text: 'Rispondi alla domanda del giorno', xp: 15 },
  { id: 'd_steps', ev: 'steps', need: 150, text: 'Cammina 150 passi sui percorsi', xp: 10 },
  { id: 'd_journal', ev: 'journal', need: 1, text: 'Scrivi una riga nel Diario dopo un\'operazione', xp: 15 },
  { id: 'd_mini', ev: 'minigame', need: 1, text: 'Gioca un minigioco in Biblioteca o Zona Simulazione', xp: 15 },
  { id: 'd_review', ev: 'review', need: 1, text: 'Fai il ripasso delle domande in scadenza in Biblioteca', xp: 20 },
];

const WEEKLY_POOL: TaskDef[] = [
  { id: 'w_duel', ev: 'duel_win', need: 8, text: 'Vinci 8 duelli nella settimana', xp: 80 },
  { id: 'w_perfect', ev: 'duel_perfect', need: 2, text: 'Vinci 2 duelli senza errori', xp: 100 },
  { id: 'w_lessons', ev: 'lesson', need: 5, text: 'Leggi 5 lezioni', xp: 60 },
  { id: 'w_mission', ev: 'mission', need: 1, text: 'Completa una missione nella Macchina del Tempo', xp: 100 },
  { id: 'w_tips', ev: 'tip', need: 8, text: 'Ascolta 8 abitanti', xp: 60 },
  { id: 'w_daily', ev: 'daily_q', need: 4, text: 'Rispondi alla domanda del giorno 4 volte', xp: 80 },
  { id: 'w_rematch', ev: 'rematch', need: 3, text: 'Vinci 3 rivincite', xp: 90 },
  { id: 'w_mini', ev: 'minigame', need: 4, text: 'Gioca 4 minigiochi', xp: 70 },
  { id: 'w_quest', ev: 'quest', need: 1, text: 'Completa una storia di un abitante', xp: 120 },
  { id: 'w_journal', ev: 'journal', need: 3, text: 'Scrivi 3 righe di Diario', xp: 60 },
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
  const avail = pool.filter((t) => !(t.ev === 'rematch' && S.badges < 1) && !(t.ev === 'mission' && S.badges < 1));
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
      toast(`Agenda: "${def?.text ?? t.id}" completata! +${xp} Conoscenza`);
      if (S.agenda.daily.every((d) => d.done) && S.agenda.daily.length) { S.stats.xp += 25; S.counters.agenda_full = (S.counters.agenda_full ?? 0) + 1; }
    }
  }
}

// ---------------- Rivincite ----------------

const REMATCH_DAYS = 3;

/** L'avversario è pronto per la rivincita? */
export function rematchReady(id: string): boolean {
  const d = S.rematch[id];
  return !!d && d <= todayKey();
}

export function scheduleRematch(id: string) {
  const d = new Date(); d.setDate(d.getDate() + REMATCH_DAYS);
  S.rematch[id] = todayKey(d);
}

export function rematchesReady(): string[] { return Object.keys(S.rematch).filter(rematchReady); }

// ---------------- Traguardi e titoli ----------------

/** secret: nascosto come "???" nell'Agenda finché non viene sbloccato. */
export interface Achievement { id: string; name: string; desc: string; title?: string; decor?: string; secret?: boolean; check: () => boolean }

const c = (k: string) => S.counters[k] ?? 0;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_step', name: 'Primo seme', desc: 'Scegli la tua Valigetta', title: 'Germoglio', check: () => !!S.flags.starter },
  { id: 'duel1', name: 'Prima vittoria', desc: 'Vinci il primo duello', check: () => c('duel_win') >= 1 },
  { id: 'duel10', name: 'Dieci su dieci', desc: 'Vinci 10 duelli', title: 'Studioso', check: () => c('duel_win') >= 10 },
  { id: 'duel50', name: 'Veterano dei quiz', desc: 'Vinci 50 duelli', title: 'Veterano', decor: 'trophy_silver', check: () => c('duel_win') >= 50 },
  { id: 'perfect10', name: 'Senza sbavature', desc: '10 duelli perfetti', title: 'Infallibile', decor: 'trophy_gold', check: () => c('duel_perfect') >= 10 },
  { id: 'badge1', name: 'Prima Medaglia', desc: 'Batti il primo Mentore', title: 'Apprendista', decor: 'poster_badges', check: () => S.badges >= 1 },
  { id: 'badge4', name: 'Metà strada', desc: 'Quattro Medaglie', title: 'Investitore in erba', check: () => S.badges >= 4 },
  { id: 'badge8', name: 'Tutte le Medaglie', desc: 'Otto Medaglie', title: 'Maestro dei Mentori', decor: 'poster_badges', check: () => S.badges >= 8 },
  { id: 'champion', name: 'Campione', desc: 'Vinci la Lega degli Investitori', title: 'Campione', decor: 'trophy_league', check: () => !!S.flags.champion },
  { id: 'tips10', name: 'Buon vicino', desc: 'Ascolta 10 abitanti', check: () => S.tipsHeard.length >= 10 },
  { id: 'tips_all', name: 'Orecchio della regione', desc: 'Ascolta tutti gli abitanti', title: 'Amico di tutti', decor: 'plant_big', check: () => S.tipsHeard.length >= ALL_RESIDENTS.length },
  { id: 'lessons10', name: 'Topo di biblioteca', desc: 'Leggi 10 lezioni', title: 'Lettore', decor: 'bookshelf_full', check: () => S.lessonsRead.length >= 10 },
  { id: 'lessons_all', name: 'Enciclopedia', desc: 'Leggi 30 lezioni', title: 'Enciclopedico', check: () => S.lessonsRead.length >= 30 },
  { id: 'streak7', name: 'Una settimana di fila', desc: 'Serie di 7 domande del giorno', title: 'Costante', check: () => S.daily.streak >= 7 },
  { id: 'streak30', name: 'Un mese di fila', desc: 'Serie di 30 domande del giorno', title: 'Disciplinato', decor: 'calendar', check: () => S.daily.streak >= 30 },
  { id: 'checkup5', name: 'Paziente modello', desc: '5 check-up in Clinica', check: () => c('checkup') >= 5 },
  { id: 'rebalance3', name: 'In equilibrio', desc: '3 ribilanciamenti', title: 'Equilibrista', check: () => c('rebalance') >= 3 },
  { id: 'mission3', name: 'Viaggiatore del tempo', desc: '3 missioni nella Macchina del Tempo', title: 'Cronista', check: () => c('mission') >= 3 },
  { id: 'no_loss_sale', name: 'Mano ferma', desc: 'Completa una missione senza vendere in perdita', title: 'Mano ferma', check: () => !!S.flags.missionNoLossSale },
  { id: 'journal5', name: 'Diarista', desc: '5 righe nel Diario', title: 'Diarista', decor: 'desk_journal', check: () => S.journal.length >= 5 },
  { id: 'journal_review', name: 'Senno di poi', desc: 'Rileggi 5 operazioni dopo 30 giorni', title: 'Riflessivo', check: () => c('review_journal') >= 5 },
  { id: 'rematch5', name: 'Rivincita servita', desc: 'Vinci 5 rivincite', title: 'Tenace', check: () => c('rematch') >= 5 },
  { id: 'mini_all', name: 'Giocatore completo', desc: 'Prova tutti e 4 i minigiochi', title: 'Giocoliere', decor: 'arcade', check: () => Object.keys(S.minigames).length >= 4 },
  { id: 'mini_ace', name: 'Asso dei minigiochi', desc: 'Punteggio pieno in un minigioco', check: () => Object.values(S.minigames).some((v) => v >= 100) },
  { id: 'quest1', name: 'Una mano agli altri', desc: 'Completa una storia di un abitante', title: 'Buon consigliere', check: () => c('quest') >= 1 },
  { id: 'quest_all', name: 'Il consigliere della regione', desc: 'Completa tutte le storie degli abitanti', title: 'Consigliere', decor: 'frame_letters', check: () => c('quest') >= 6 },
  { id: 'houses_all', name: 'Porta a porta', desc: 'Entra in tutte le 30 case', check: () => c('house_unique') >= 30 },
  { id: 'agenda7', name: 'Agenda piena', desc: 'Completa tutte le missioni del giorno 7 volte', title: 'Metodico', check: () => c('agenda_full') >= 7 },
  { id: 'islets_all', name: 'Navigatore di Liquidità', desc: 'Vinci la sfida sulle tre Isole della Liquidità', title: 'Navigatore', check: () => [3, 5, 7].every((r) => !!S.flags[`islet_r${r}`]) },
  { id: 'sea_all', name: 'Capitano di Liquidità', desc: 'Vinci le sfide della Guardiana del Faro e del Pescatore di Perle', title: 'Capitano', check: () => !!S.flags.islet_faro && !!S.flags.islet_perle },
  { id: 'legend1', name: 'Storico', desc: 'Supera una crisi leggendaria', title: 'Storico', check: () => S.legends.length >= 1 },
  { id: 'legend_all', name: 'Memoria dei mercati', desc: 'Supera tutte le crisi leggendarie', title: 'Memoria viva', decor: 'globe', check: () => S.legends.length >= 5 },
  { id: 'tower10', name: 'Scalatore', desc: 'Piano 10 della Torre', title: 'Scalatore', check: () => S.tower.best >= 10 },
  { id: 'level10', name: 'Conoscenza 10', desc: 'Raggiungi il livello 10', check: () => level() >= 10 },
  { id: 'level25', name: 'Conoscenza 25', desc: 'Raggiungi il livello 25', title: 'Sapiente', decor: 'trophy_gold', check: () => level() >= 25 },
  { id: 'challenge1', name: 'Sfidante', desc: 'Gioca una sfida settimanale', check: () => S.challenges.length >= 1 },
  { id: 'challenge5', name: 'Rivale di tutti', desc: 'Gioca 5 sfide', title: 'Sfidante', check: () => S.challenges.length >= 5 },
  { id: 'steps1000', name: 'Mille passi', desc: 'Cammina 1.000 passi', check: () => c('steps') >= 1000 },
  { id: 'steps10000', name: 'Esploratore', desc: 'Cammina 10.000 passi', title: 'Esploratore', check: () => c('steps') >= 10000 },
  { id: 'bias_all', name: 'Conosco i miei limiti', desc: 'Impara tutti e 4 i bias', title: 'Consapevole', check: () => S.biasSeen.length >= 4 },
  { id: 'casino', name: 'Il banco vince sempre', desc: 'Scopri la lezione del Casinò', check: () => !!S.flags.casinoLesson },
  // segreti della seconda parte (dalla Medaglia 4): restano "???" finché non li trovi
  { id: 'secret_ledger', name: 'Il Libro Mastro Perduto', desc: 'Ritrova le sei pagine nascoste di Mastro Ventura', title: 'Custode del Libro Mastro', decor: 'ledger', secret: true, check: () => ledgerDone() },
  { id: 'secret_tape', name: 'Lettore del Nastro', desc: 'Trova la Sala del Nastro e batti la Vecchia del Nastro', title: 'Lettore del Nastro', decor: 'tape', secret: true, check: () => !!S.flags[SECRET_FLAGS.tape] },
  { id: 'secret_whale', name: 'Avvistamento', desc: 'Incontra la Balena nel fine settimana', title: 'Avvistatore di Balene', secret: true, check: () => !!S.flags[SECRET_FLAGS.whale] },
  { id: 'secret_hodl', name: 'Mani di Diamante', desc: 'Compi il rituale della pietra sul Percorso 6', title: 'Mani di Diamante', secret: true, check: () => !!S.flags[SECRET_FLAGS.hodl] },
  { id: 'secret_all', name: 'Cacciatore di Segreti', desc: 'Scopri tutti i segreti della regione', title: 'Cacciatore di Segreti', decor: 'lamp', secret: true, check: () => ledgerDone() && !!S.flags[SECRET_FLAGS.tape] && !!S.flags[SECRET_FLAGS.whale] && !!S.flags[SECRET_FLAGS.hodl] },
];

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
    toast(`Traguardo: ${a.name}${a.title ? ` · titolo "${a.title}"` : ''}${a.decor ? ' · nuovo oggetto per la casa' : ''}${got.length > 1 ? ` (+${got.length - 1})` : ''}`);
    save();
  }
  return got;
}

export function availableTitles(): string[] {
  return ACHIEVEMENTS.filter((a) => a.title && S.achievements.includes(a.id)).map((a) => a.title!);
}

export const DECOR_INFO: Record<string, { name: string; tile: string }> = {
  trophy_silver: { name: 'Trofeo d\'argento', tile: 'trophy_silver' },
  trophy_gold: { name: 'Trofeo d\'oro', tile: 'trophy_gold' },
  trophy_league: { name: 'Coppa della Lega', tile: 'trophy_league' },
  poster_badges: { name: 'Bacheca delle Medaglie', tile: 'poster' },
  plant_big: { name: 'Pianta rigogliosa', tile: 'plant' },
  bookshelf_full: { name: 'Libreria piena', tile: 'shelf' },
  calendar: { name: 'Calendario delle serie', tile: 'calendar' },
  desk_journal: { name: 'Scrivania del Diario', tile: 'desk' },
  arcade: { name: 'Cabinato', tile: 'arcade' },
  frame_letters: { name: 'Lettere di ringraziamento', tile: 'frame' },
  globe: { name: 'Mappamondo', tile: 'globe' },
  radio: { name: 'Radio di Eleonora', tile: 'radio' },
  aquarium: { name: 'Acquario di Gennaro', tile: 'aquarium' },
  painting: { name: 'Quadro di Ottavio', tile: 'painting' },
  ledger: { name: 'Libro Mastro rilegato', tile: 'shelf' },
  tape: { name: 'Nastro delle quotazioni incorniciato', tile: 'frame' },
  lamp: { name: 'Mappamondo delle rotte segrete', tile: 'globe' },
};
