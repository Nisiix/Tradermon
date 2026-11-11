-- Il trigger della prima migrazione controllava app_metadata all'inserimento, ma Supabase Auth lo scrive dopo:
-- la registrazione falliva. Ora: all'inserimento si controlla che l'indirizzo interno corrisponda al nome,
-- e il profilo nasce alla conferma (che fa solo la funzione "registra-giocatore" con email_confirm).
drop trigger if exists tm_on_auth_user_created on auth.users;

create or replace function public.tm_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  n := new.raw_user_meta_data ->> 'name';
  if n is null or new.email is distinct from ('g' || encode(convert_to(lower(n), 'UTF8'), 'hex') || '@giocatori.tradermon.invalid') then
    raise exception 'Registrazione consentita solo dal gioco';
  end if;
  return new;
end $$;

create or replace function public.tm_user_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    n := new.raw_user_meta_data ->> 'name';
    insert into public.profiles (id, name, name_key) values (new.id, n, lower(n)) on conflict (id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.tm_new_user() from public, anon, authenticated;
revoke execute on function public.tm_user_confirmed() from public, anon, authenticated;

create trigger tm_on_auth_user_created before insert on auth.users for each row execute function public.tm_new_user();
create trigger tm_on_auth_user_confirmed after insert or update of email_confirmed_at on auth.users for each row execute function public.tm_user_confirmed();

-- Per la funzione di registrazione: un utente mai confermato che occupa l'indirizzo (iscrizione pubblica tentata) si può togliere.
create or replace function public.tm_unconfirmed_user(e text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = e and email_confirmed_at is null;
$$;
revoke execute on function public.tm_unconfirmed_user(text) from public, anon, authenticated;
grant execute on function public.tm_unconfirmed_user(text) to service_role;
