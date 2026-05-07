import React, { useEffect, useRef, useState } from 'react';
import icon from '../../assets/icon.png';
import { useToast } from '../ui/ToastProvider';
import NotificationBell from '../notifications/NotificationBell';

const DEFAULT_SOLUTION_FLAG_HTML =
  '<div style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #06B9A1, #049F89); color: white; font-size: 0.85em; font-style: italic; border-radius: 8px; box-shadow: 0px 4px 6px rgba(0,0,0,0.1); border: 1px solid #FFF; text-align: center;">\n<strong style="font-size: 0.9em;">Caso este post tenha lhe ajudado, por favor, <span style="text-decoration: underline;">marcar como solucionado</span></strong>\n</div>';

const DEFAULT_FEEDBACK_FLAG_HTML =
  '<div style="padding: 5px;"></div>\n<div style="display: inline-flex; padding: 10px 20px; background-color: #051933; color: white; font-size: 0.85em; font-style: italic; border-radius: 8px; box-shadow: 0px 4px 6px rgba(0,0,0,0.1); border: 1px solid #FFF; text-align: center; align-items: center; gap: 10px;">\n  <img src="https://i.imgur.com/PnH9w3G.jpeg" alt="Alura" width="35">\n  <strong style="font-size: 0.9em;"> Conte com o apoio da <span style="text-decoration: underline;">comunidade Alura</span> na sua jornada. Abraços e bons estudos!</strong>\n</div>';

const FORUM_URL = 'https://cursos.alura.com.br/forum/todos/1?hasAccessMGM=true';

const NAV_ITEMS = [
  { path: '/catalog', icon: 'fa-book', label: 'Catálogo', accentClass: 'is-catalog' },
  { path: '/mural', icon: 'fa-table-columns', label: 'Mural', accentClass: 'is-mural' },
  { path: '/dashboard', icon: 'fa-chart-line', label: 'Dashboard', accentClass: 'is-dashboard' },
  { path: '/allocation', icon: 'fa-people-group', label: 'Alocação', accentClass: 'is-allocation' },
  // PDI: rota /pdi continua acessível direto pelo URL — escondida do menu
  // enquanto a feature ainda não está pronta pra todo o time.
];

/* Menu único pra atalhos do dia a dia. Substitui os 3 ícones soltos. */
function QuickActionsMenu({ onCopySolution, onCopyFeedback }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="quick-actions" ref={wrapRef}>
      <button
        type="button"
        className={`app-icon-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Ações rápidas"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="fa-solid fa-bolt"></i>
      </button>

      {open ? (
        <div className="quick-actions__menu" role="menu">
          <div className="quick-actions__header">Ações rápidas</div>

          <button
            type="button"
            className="quick-actions__item"
            role="menuitem"
            onClick={() => { close(); onCopySolution(); }}
          >
            <span className="quick-actions__icon quick-actions__icon--solution">
              <i className="fa-solid fa-clipboard-check"></i>
            </span>
            <span className="quick-actions__main">
              <span className="quick-actions__title">Marcação de Solução</span>
              <span className="quick-actions__hint">Copia o template HTML</span>
            </span>
            <kbd className="quick-actions__kbd">↵</kbd>
          </button>

          <button
            type="button"
            className="quick-actions__item"
            role="menuitem"
            onClick={() => { close(); onCopyFeedback(); }}
          >
            <span className="quick-actions__icon quick-actions__icon--feedback">
              <i className="fa-solid fa-clipboard-question"></i>
            </span>
            <span className="quick-actions__main">
              <span className="quick-actions__title">Marcação de Feedback</span>
              <span className="quick-actions__hint">Copia o template HTML</span>
            </span>
            <kbd className="quick-actions__kbd">↵</kbd>
          </button>

          <div className="quick-actions__divider"></div>

          <a
            href={FORUM_URL}
            target="_blank"
            rel="noreferrer"
            className="quick-actions__item"
            role="menuitem"
            onClick={close}
          >
            <span className="quick-actions__icon quick-actions__icon--forum">
              <i className="fa-solid fa-up-right-from-square"></i>
            </span>
            <span className="quick-actions__main">
              <span className="quick-actions__title">Abrir Fórum da Alura</span>
              <span className="quick-actions__hint">Abre em nova aba</span>
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

const Header = ({ onSettingsClick, onNavigate, currentPath }) => {
  const { showToast } = useToast();
  const isHome = currentPath === '/topics' || currentPath === '/';

  const goHome = () => onNavigate?.('/topics');

  const copyTag = async (storageKey, defaultValue, label) => {
    const text = localStorage.getItem(storageKey) || defaultValue;
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiada!`, 'success');
    } catch {
      showToast('Erro ao copiar.', 'error');
    }
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        {/* BRAND — logo + título funcionam como botão "voltar à tela inicial" */}
        <button
          type="button"
          className={`app-header__brand ${isHome ? 'is-home' : ''}`}
          onClick={goHome}
          title="Voltar para o Forum Helper"
          aria-current={isHome ? 'page' : undefined}
        >
          <span className="app-header__logo-wrap">
            <img src={icon} alt="" className="app-header__logo" />
          </span>
          <span className="app-header__brand-text">
            <span className="app-header__title">Forum Helper</span>
            <span className="app-header__subtitle">Suporte educacional</span>
          </span>
        </button>

        {/* NAV — segmented control central */}
        <nav className="app-nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                className={`app-nav__tab ${item.accentClass} ${active ? 'is-active' : ''}`}
                onClick={() => onNavigate?.(active ? '/topics' : item.path)}
                title={`Abrir ${item.label}`}
                aria-current={active ? 'page' : undefined}
              >
                <i className={`fas ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* AÇÕES — 3 ícones limpos: atalhos, alertas, configurações */}
        <div className="app-header__actions">
          <QuickActionsMenu
            onCopySolution={() => copyTag('customSolutionTag', DEFAULT_SOLUTION_FLAG_HTML, 'Marcação de Solução')}
            onCopyFeedback={() => copyTag('customFeedbackTag', DEFAULT_FEEDBACK_FLAG_HTML, 'Marcação de Feedback')}
          />
          <NotificationBell />
          <button
            type="button"
            className="app-icon-btn"
            title="Configurações"
            onClick={() => onSettingsClick?.()}
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
