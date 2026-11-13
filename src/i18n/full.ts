// Dizionario inglese completo (gioco). Va importato per primo dall'ingresso della pagina,
// prima dei moduli che calcolano testi all'avvio.
import EN from '#i18n-en';
import { addDictionary } from './index';

addDictionary(EN as Record<string, string>);
