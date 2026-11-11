// "Trasloco" del salvataggio tra due indirizzi (domini) diversi, senza nessun server.
//
// Il localStorage è legato all'origine (protocollo + dominio + porta): se il gioco cambia
// indirizzo, il nuovo sito non vede i dati del vecchio. Soluzione: il vecchio indirizzo
// continua a pubblicare il gioco compilato con VITE_MOVED_TO=<nuovo indirizzo>. All'apertura
// legge i dati tradermon.* dal browser, li comprime e reindirizza a
//   <nuovo indirizzo>#trasloco=<dati>
// La parte dopo "#" non viene MAI inviata al server: resta nel browser. Il nuovo indirizzo la
// legge, la importa e la cancella dalla barra degli indirizzi.

const PREFIX = 'tradermon.';
/** Chiavi Alpaca cifrate e scelte sul collegamento: restano sul dispositivo, non viaggiano in un link e un link non le può scrivere. */
const DEVICE_ONLY = 'tradermon.alpaca.';
const SAVE_KEY = 'tradermon.save.v1';
export const BACKUP_KEY = 'tradermon.save.backup';
const HASH = '#trasloco=';

export interface Bundle { v: 1; at: number; keys: Record<string, string> }

export function collect(storage: Storage = localStorage): Bundle {
  const keys: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(PREFIX) && !k.startsWith(DEVICE_ONLY) && k !== BACKUP_KEY) keys[k] = storage.getItem(k) ?? '';
  }
  return { v: 1, at: Date.now(), keys };
}

const b64u = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** JSON → gzip (se il browser lo supporta) → base64url. Prefisso "z." compresso, "j." no. */
export async function encode(b: Bundle): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(b));
  if (typeof CompressionStream !== 'undefined') return 'z.' + b64u(await pipe(raw, new CompressionStream('gzip')));
  return 'j.' + b64u(raw);
}

export async function decode(s: string): Promise<Bundle | null> {
  try {
    const [kind, data] = [s.slice(0, 2), s.slice(2)];
    let bytes = unb64u(data);
    if (kind === 'z.') bytes = await pipe(bytes, new DecompressionStream('gzip'));
    else if (kind !== 'j.') return null;
    const b = JSON.parse(new TextDecoder().decode(bytes)) as Bundle;
    if (!b || b.v !== 1 || typeof b.keys !== 'object') return null;
    return b;
  } catch { return null; }
}

interface SaveInfo { name: string; playMs: number; badges: number }
export function saveInfo(raw: string | null | undefined): SaveInfo | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d.version !== 'number' || d.version < 1 || !d.portfolio) return null;
    return { name: String(d.name ?? '?'), playMs: Number(d.playMs) || 0, badges: Number(d.badges) || 0 };
  } catch { return null; }
}

export type MergeResult = 'imported' | 'kept-local' | 'nothing';

/**
 * Unisce i dati arrivati con quelli già presenti. Vince il salvataggio con più tempo di gioco;
 * quello scartato resta in BACKUP_KEY. Le altre preferenze si copiano solo se mancano.
 * `confirmReplace` viene chiesto solo se esiste già una partita diversa in questo browser.
 */
export async function merge(b: Bundle, confirmReplace: (local: SaveInfo, incoming: SaveInfo) => Promise<boolean>, storage: Storage = localStorage): Promise<MergeResult> {
  const incoming = saveInfo(b.keys[SAVE_KEY]);
  const localRaw = storage.getItem(SAVE_KEY);
  const local = saveInfo(localRaw);
  let result: MergeResult = 'nothing';
  if (incoming) {
    if (!local) { storage.setItem(SAVE_KEY, b.keys[SAVE_KEY]); result = 'imported'; }
    else if (localRaw === b.keys[SAVE_KEY]) result = 'kept-local';
    else if (incoming.playMs > local.playMs && await confirmReplace(local, incoming)) {
      storage.setItem(BACKUP_KEY, localRaw!);
      storage.setItem(SAVE_KEY, b.keys[SAVE_KEY]);
      result = 'imported';
    } else result = 'kept-local';
  }
  for (const [k, v] of Object.entries(b.keys)) {
    if (k === SAVE_KEY || !k.startsWith(PREFIX) || k.startsWith(DEVICE_ONLY) || k === BACKUP_KEY) continue;
    if (storage.getItem(k) === null) storage.setItem(k, v);
  }
  return result;
}

/** Sul VECCHIO indirizzo: se il gioco è stato spostato, porta i dati al nuovo. true = reindirizzato. */
export async function leaveIfMoved(): Promise<boolean> {
  const to = import.meta.env.VITE_MOVED_TO as string | undefined;
  if (!to) return false;
  let target: URL;
  try { target = new URL(to, location.href); } catch { return false; }
  if (target.origin === location.origin && target.pathname === location.pathname) return false;
  let hash = '';
  try { const b = collect(); if (Object.keys(b.keys).length) hash = HASH + await encode(b); } catch { /* storage non disponibile */ }
  target.hash = hash;
  location.replace(target.toString());
  return true;
}

/** Sul NUOVO indirizzo: importa i dati arrivati nell'hash e lo ripulisce. */
export async function receiveTransfer(confirmReplace: Parameters<typeof merge>[1]): Promise<MergeResult> {
  if (!location.hash.startsWith(HASH)) return 'nothing';
  const data = location.hash.slice(HASH.length);
  history.replaceState(null, '', location.pathname + location.search);
  const b = await decode(data);
  if (!b) return 'nothing';
  try { return await merge(b, confirmReplace); } catch { return 'nothing'; }
}
