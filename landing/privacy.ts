// Pagina dell'informativa sulla privacy: stesso stile della landing, nessuno script esterno.
// Nome e contatto del titolare vengono da landing/config/titolare.json (inclusi al momento del build).
import '@fontsource/press-start-2p/400.css';
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import './landing.css';
import titolare from './config/titolare.json';

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fill(field: 'nome' | 'contatto', value: string) {
  document.querySelectorAll<HTMLElement>(`[data-titolare="${field}"]`).forEach((el) => {
    const v = value.trim();
    if (!v) { el.textContent = field === 'nome' ? 'da indicare' : 'un contatto ancora da indicare'; el.classList.add('missing'); return; }
    if (field === 'contatto' && MAIL.test(v)) {
      const a = document.createElement('a');
      a.href = `mailto:${v}`;
      a.textContent = v;
      el.replaceChildren(a);
    } else if (field === 'contatto' && /^https:\/\//.test(v)) {
      const a = document.createElement('a');
      a.href = v;
      a.rel = 'noopener';
      a.target = '_blank';
      a.textContent = v;
      el.replaceChildren(a);
    } else el.textContent = v;
  });
}

fill('nome', String(titolare.nome ?? ''));
fill('contatto', String(titolare.contatto ?? ''));
