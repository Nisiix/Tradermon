// Pagina dell'informativa sulla privacy: stesso stile della landing, nessuno script esterno.
import '@fontsource/press-start-2p/400.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './landing.css';
import { translateDom, wireLangSwitch } from '../src/i18n/dom';

translateDom();
wireLangSwitch();
