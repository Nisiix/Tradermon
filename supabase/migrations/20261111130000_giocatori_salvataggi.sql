-- Tradermon: giocatori, salvataggi e chiavi Alpaca cifrate.
-- Il browser usa solo la chiave pubblica (publishable/anon): ogni tabella ha RLS e ognuno vede solo le proprie righe.
-- I giocatori si creano solo dalla funzione Edge "registra-giocatore" (nome univoco, nessuna email reale).
-- Il trigger su auth.users di questo file è sostituito da 20261111131000_giocatori_trigger_conferma.sql.

-- ---------- Profili ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 15 and name ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]*$'),
  -- nome normalizzato (minuscolo): due giocatori non possono avere lo stesso nome, maiuscole a parte
  name_key text not null unique check (name_key = lower(name)),
  created_at timestamptz not null default now(),
  -- chiave dati per le chiavi Alpaca, cifrata nel browser con una chiave derivata dalla password (PBKDF2 + AES-GCM).
  -- Il server conserva solo questo involucro: senza la password del giocatore non si apre.
  crypto jsonb
);
alter table public.profiles enable row level security;

create policy "profilo: leggo il mio" on public.profiles for select to authenticated using ((select auth.uid()) = id);
-- il giocatore può aggiornare solo l'involucro della chiave (non il nome)
create policy "profilo: aggiorno il mio" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from anon, authenticated;
grant update (crypto) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

-- Crea il profilo quando nasce l'utente. Accetta solo utenti creati dalla funzione di registrazione
-- (app_metadata.tm_reg = 'ok', che un'iscrizione pubblica non può impostare): blocca le iscrizioni dirette.
create function public.tm_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if coalesce(new.raw_app_meta_data ->> 'tm_reg', '') <> 'ok' then
    raise exception 'Registrazione consentita solo dal gioco';
  end if;
  n := new.raw_user_meta_data ->> 'name';
  insert into public.profiles (id, name, name_key) values (new.id, n, lower(n));
  return new;
end $$;
revoke execute on function public.tm_new_user() from public, anon, authenticated;
create trigger tm_on_auth_user_created after insert on auth.users for each row execute function public.tm_new_user();

-- Il nome è libero? (usata prima di chiedere la password). Dice solo sì/no.
create function public.nome_disponibile(n text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where name_key = lower(btrim(n)));
$$;
revoke execute on function public.nome_disponibile(text) from public;
grant execute on function public.nome_disponibile(text) to anon, authenticated;

-- ---------- Salvataggi (uno per giocatore) ----------
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null check (pg_column_size(data) < 4000000),
  version int not null,
  play_ms bigint not null default 0,
  badges int not null default 0,
  map text,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "salvataggio: leggo il mio" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "salvataggio: creo il mio" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "salvataggio: aggiorno il mio" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "salvataggio: cancello il mio" on public.saves for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.saves from anon;

create function public.tm_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger tm_saves_touch before update on public.saves for each row execute function public.tm_touch();

-- Tempo di gioco ogni pochi secondi senza riscrivere tutto il salvataggio (solo se cresce).
create function public.salva_tempo(ms bigint, created bigint) returns void
language sql security invoker set search_path = '' as $$
  update public.saves
     set play_ms = ms, data = jsonb_set(data, '{playMs}', to_jsonb(ms))
   where user_id = auth.uid() and play_ms < ms and (data ->> 'createdAt')::bigint = created;
$$;
revoke execute on function public.salva_tempo(bigint, bigint) from public, anon;
grant execute on function public.salva_tempo(bigint, bigint) to authenticated;

-- ---------- Chiavi Alpaca (Paper e Live), solo cifrate ----------
-- ciphertext e iv sono prodotti nel browser (AES-GCM 256) con la chiave dati del giocatore:
-- nel database non c'è nulla di leggibile, nemmeno per chi amministra il progetto.
create table public.alpaca_keys (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  env text not null check (env in ('paper', 'live')),
  ciphertext text not null check (char_length(ciphertext) < 2000),
  iv text not null check (char_length(iv) < 64),
  updated_at timestamptz not null default now(),
  primary key (user_id, env)
);
alter table public.alpaca_keys enable row level security;
create policy "chiavi: leggo le mie" on public.alpaca_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "chiavi: creo le mie" on public.alpaca_keys for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chiavi: aggiorno le mie" on public.alpaca_keys for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chiavi: cancello le mie" on public.alpaca_keys for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.alpaca_keys from anon;
create trigger tm_keys_touch before update on public.alpaca_keys for each row execute function public.tm_touch();
