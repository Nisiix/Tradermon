// Tradermon: crea un giocatore (nome univoco + password). È l'unico modo di registrarsi:
// il trigger su auth.users accetta solo utenti già confermati con l'indirizzo interno che corrisponde al nome,
// cosa che un'iscrizione pubblica non può ottenere (resta comunque consigliato disattivare le iscrizioni pubbliche).
// Nessuna email reale: l'indirizzo interno è derivato dal nome e non riceve mai posta.
import { createClient } from 'npm:@supabase/supabase-js@2';

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]*$/;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export function normName(s: string): string { return s.normalize('NFC').trim().replace(/\s+/g, ' '); }
export function nameEmail(name: string): string {
  const hex = [...new TextEncoder().encode(normName(name).toLowerCase())].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `g${hex}@giocatori.tradermon.invalid`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Metodo non consentito' });
  let body: { name?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: 'Richiesta non valida' }); }
  const name = normName(String(body.name ?? ''));
  const password = String(body.password ?? '');
  if (name.length < 3 || name.length > 15 || !NAME_RE.test(name)) return reply(400, { error: 'Nome non valido: da 3 a 15 caratteri tra lettere, numeri, spazio, punto, trattino e trattino basso.' });
  if (password.length < 8 || password.length > 72) return reply(400, { error: 'La password deve avere da 8 a 72 caratteri.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: free, error: e1 } = await admin.rpc('nome_disponibile', { n: name });
  if (e1) return reply(500, { error: 'Servizio non disponibile, riprova tra poco.' });
  if (!free) return reply(409, { error: 'Questo nome è già usato da un altro giocatore.' });

  const email = nameEmail(name);
  const create = () => admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  let { data, error } = await create();
  if (error && /already|registered|exists/i.test(error.message)) {
    // l'indirizzo è occupato da un'iscrizione pubblica mai confermata (nessun profilo, nome libero): la si toglie
    const { data: stale } = await admin.rpc('tm_unconfirmed_user', { e: email });
    if (stale) { await admin.auth.admin.deleteUser(String(stale)); ({ data, error } = await create()); }
  }
  if (error) {
    console.error('createUser', error.status, error.code, error.message);
    // corsa fra due registrazioni con lo stesso nome: l'indice univoco blocca la seconda
    const taken = /already|registered|exists|duplicate/i.test(error.message);
    return reply(taken ? 409 : 500, { error: taken ? 'Questo nome è già usato da un altro giocatore.' : 'Registrazione non riuscita, riprova tra poco.' });
  }
  return reply(200, { ok: true, id: data.user?.id });
});
