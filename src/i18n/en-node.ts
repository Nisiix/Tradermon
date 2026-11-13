// Dizionario inglese fuori da Vite (esbuild per docs:content, tsx negli script): stessi file, compilati all'avvio.
// Dentro Vite e Vitest '#i18n-en' e '#i18n-en-landing' sono invece i moduli virtuali di vite.config.ts, già compilati in fase di build;
// qui entrambi portano al dizionario intero (negli script fuori dal browser la differenza di peso non conta).
import { hashKey } from './hash';
import data from './en/data.json';
import landing from './en/landing.json';
import main from './en/main.json';
import quiz from './en/quiz.json';
import scenes from './en/scenes.json';
import systems from './en/systems.json';
import ui from './en/ui.json';
import world from './en/world.json';
import extra from './en/extra.json';

/** File che compongono il dizionario, nell'ordine in cui si sovrascrivono (extra.json, le correzioni a mano, per ultimo). */
export const FILES = { data, landing, main, quiz, scenes, systems, ui, world, extra } as Record<string, Record<string, string>>;

const dict: Record<string, string> = {};
for (const part of Object.values(FILES)) for (const [k, v] of Object.entries(part)) dict[hashKey(k)] = v;
export default dict;
