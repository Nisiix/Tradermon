// Tradermon: il giocatore cancella se stesso (diritto alla cancellazione, art. 17 GDPR).
//
// Che cosa cancella: l'utente su Supabase Auth. Profilo, salvataggio e le vecchie copie cifrate delle chiavi
// (tabelle profiles, saves, alpaca_keys) se ne vanno con lui, perché sono legate con "on delete cascade".
// Il nome torna libero.
//
// Sicurezza:
//  - si cancella solo l'utente a cui appartiene il token di sessione: l'id non arriva mai dalla richiesta;
//  - il gioco chiede la password e rientra subito prima di chiamare questa funzione, quindi il token è fresco;
//    qui si accettano solo token emessi da non più di 5 minuti, così una sessione rimasta aperta su un altro
//    dispositivo non basta per cancellare il giocatore.

// deno-lint-ignore no-explicit-any
declare const Deno: any;

export interface Deps {
  /** Utente del token, con l'ora del suo ultimo accesso (null se il token non è valido). */
  verifyUser: (token: string) => Promise<{ id: string; lastSignIn: number } | null>;
  deleteUser: (id: string) => Promise<boolean>;
  now?: () => number;
}

export const FRESH_MS = 5 * 60_000;

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Metodo non consentito' });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const user = token ? await deps.verifyUser(token) : null;
  if (!user) return reply(401, { error: 'Entra con il tuo giocatore per cancellarlo.' });
  const now = (deps.now ?? Date.now)();
  if (!(now - user.lastSignIn <= FRESH_MS)) return reply(403, { error: 'Per sicurezza inserisci di nuovo la password e riprova.' });
  if (!(await deps.deleteUser(user.id))) return reply(500, { error: 'Cancellazione non riuscita, riprova tra poco.' });
  return reply(200, { ok: true });
}

if (typeof Deno !== 'undefined') {
  const base = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const deps: Deps = {
    verifyUser: async (token) => {
      try {
        const r = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: service } });
        if (!r.ok) return null;
        const u = await r.json();
        if (!u?.id || u.is_anonymous) return null;
        return { id: String(u.id), lastSignIn: Date.parse(u.last_sign_in_at ?? '') || 0 };
      } catch { return null; }
    },
    deleteUser: async (id) => {
      try {
        const r = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${service}`, apikey: service } });
        if (!r.ok) console.error('deleteUser', r.status);
        return r.ok;
      } catch { return false; }
    },
  };
  Deno.serve((req: Request) => handleRequest(req, deps));
}
