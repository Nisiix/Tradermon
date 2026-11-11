// Progetto Supabase dei giocatori Tradermon.
// La chiave "publishable" è pubblica per costruzione (sta in ogni browser che apre il gioco):
// la sicurezza dei dati è data dalle regole RLS del database, non dal segreto di questa chiave.
// Si possono sostituire in fase di build con VITE_SUPABASE_URL e VITE_SUPABASE_KEY (vuote = gioco solo locale).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://ivcasxzuhoywgdsuyygg.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_vGM_nbqMPosF-KbiV4r1OA_y6Nyhw82';
