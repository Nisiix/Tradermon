-- Tradermon è un gioco e collega solo il conto Alpaca Paper, con denaro finto.
-- La tabella delle vecchie copie cifrate delle chiavi ammette ormai solo il Paper (era vuota quando è stato applicato).
delete from public.alpaca_keys where env <> 'paper';
alter table public.alpaca_keys drop constraint if exists alpaca_keys_env_check;
alter table public.alpaca_keys add constraint alpaca_keys_env_check check (env = 'paper');
