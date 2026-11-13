// Pagina dell'informativa sulla privacy: stesso stile della landing, nessuno script esterno.
import '../src/i18n/landing';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './landing.css';
import { keepKeys } from '../src/i18n';
import { translateDom, wireLangSwitch } from '../src/i18n/dom';

keepKeys(false);
translateDom();
wireLangSwitch();
