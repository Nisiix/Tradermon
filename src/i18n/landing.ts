// Dizionario inglese della landing e della pagina privacy: solo i testi che queste pagine mostrano
// (scelti in fase di build da vite.config.ts), così non scaricano e non leggono quello intero del gioco.
// Va importato per primo. keepKeys(true) fa sì che le costanti dei moduli importati dopo (città, Whale…)
// restino in italiano, cioè chiavi: la landing le traduce al momento di mostrarle e può cambiare lingua sul posto.
import EN from '#i18n-en-landing';
import { addDictionary, keepKeys } from './index';

addDictionary(EN as Record<string, string>);
keepKeys(true);
