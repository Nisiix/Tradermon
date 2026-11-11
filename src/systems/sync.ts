// Sincronizzazione del salvataggio con Supabase.
// Supabase è il posto dove vive la partita. Sul dispositivo resta solo una copia di lavoro
// (stessa chiave di prima, tradermon.save.v1) legata al giocatore: serve a non perdere nulla
// se la rete cade, e viene inviata appena la connessione torna.
import { S, SAVE_KEY, setSaveListener, validSave } from './state';
import * as C from './cloud';
import type { SaveData } from '../types';

export const OWNER_KEY = 'tradermon.save.owner';
export const PENDING_KEY = 'tradermon.save.pending';

let player: C.Player | null = null;
export function cloudPlayer(): C.Player | null { return player; }
export function setCloudPlayer(p: C.Player | null): void { player = p; }

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage pieno */ } };
const del = (k: string) => { try { localStorage.removeItem(k); } catch { /* niente */ } };

function localSave(): SaveData | null {
  const raw = get(SAVE_KEY);
  if (!raw) return null;
  try { const d = JSON.parse(raw); return validSave(d) ? null : d as SaveData; } catch { return null; }
}

export type SyncResult = 'ok' | 'offline';
export interface LegacyChoice { local: SaveData; cloud: C.CloudSave | null }

/**
 * Allinea la copia del dispositivo con Supabase all'avvio, dopo l'accesso.
 * `askLegacy` decide cosa fare con una partita di questo browser che non appartiene ancora a nessun giocatore
 * (salvataggi fatti prima dell'arrivo degli account): true = portala nel giocatore.
 */
export async function syncAtBoot(p: C.Player, askLegacy: (c: LegacyChoice) => Promise<boolean>): Promise<SyncResult> {
  player = p;
  const local = localSave();
  const owner = get(OWNER_KEY);
  let cloud: C.CloudSave | null;
  try { cloud = await C.fetchSave(); } catch {
    // senza rete: si gioca con la copia del dispositivo solo se è di questo giocatore
    if (local && owner !== p.id) { if (owner || !(await askLegacy({ local, cloud: null }))) clearLocal(); else adopt(p.id, true); }
    return 'offline';
  }
  if (local && owner !== p.id) {
    if (!owner && (await askLegacy({ local, cloud }))) { adopt(p.id, true); await flush(); return 'ok'; }
    if (!owner) set('tradermon.save.backup', JSON.stringify(local)); // copia di riserva della vecchia partita
    clearLocal();
  }
  const mine = owner === p.id ? localSave() : null;
  const pending = get(PENDING_KEY) === '1';
  if (mine && (!cloud || (pending && (mine.playMs ?? 0) >= cloud.playMs && (cloud.data.createdAt === mine.createdAt || !cloud.data.createdAt)))) {
    // la copia del dispositivo è più avanti (salvata senza rete): va su Supabase
    set(PENDING_KEY, '1');
    await flush();
  } else if (cloud) {
    set(SAVE_KEY, JSON.stringify(cloud.data));
    set(OWNER_KEY, p.id);
    del(PENDING_KEY);
  }
  return 'ok';
}

function adopt(id: string, pending: boolean) { set(OWNER_KEY, id); if (pending) set(PENDING_KEY, '1'); }

/** Toglie dal dispositivo la copia della partita (all'uscita dal giocatore). */
export function clearLocal(): void { del(SAVE_KEY); del(OWNER_KEY); del(PENDING_KEY); }

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let warned = false;

/** Invia subito la copia del dispositivo, se ce n'è una in attesa. */
export async function flush(): Promise<boolean> {
  if (!player || get(PENDING_KEY) !== '1') return true;
  if (inFlight) await inFlight;
  const raw = get(SAVE_KEY);
  if (!raw) return true;
  const run = (async () => {
    const d = JSON.parse(raw) as SaveData;
    await C.pushSave(player!.id, d);
    // se nel frattempo è arrivato un salvataggio più nuovo resta in attesa
    if (get(SAVE_KEY) === raw) del(PENDING_KEY);
    warned = false;
  })();
  inFlight = run.then(() => undefined, () => undefined);
  try { await run; return true; } catch {
    if (!warned) { warned = true; onOffline?.(); }
    return false;
  } finally { inFlight = null; }
}

let onOffline: (() => void) | null = null;
let lastTime = 0;

/** Collega il salvataggio a Supabase: ogni save() del gioco viene inviato (raggruppando quelli ravvicinati). */
export function startCloudSync(offlineNotice: () => void): void {
  onOffline = offlineNotice;
  setSaveListener(() => {
    if (!player) return;
    set(OWNER_KEY, player.id);
    set(PENDING_KEY, '1');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void flush(); }, 1500);
  });
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void flush());
  setInterval(() => void flush(), 60_000);
}

/** Tempo di gioco su Supabase al massimo una volta al minuto (e quando la pagina viene nascosta). */
export function cloudPlayTime(force = false): void {
  if (!player || !S || get(OWNER_KEY) !== player.id) return;
  const now = Date.now();
  if (!force && now - lastTime < 60_000) return;
  lastTime = now;
  void C.pushPlayTime(S.playMs, S.createdAt).catch(() => undefined);
}
