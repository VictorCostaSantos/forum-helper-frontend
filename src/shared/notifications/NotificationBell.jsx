import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from './NotificationsContext';
import { scrollToTopicCard, scrollToTopicCardEventually } from './scrollToTopic';
import clickupLogo from '../../assets/clickup.svg';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// "30/04 14:30" — data absoluta compacta pra acompanhar o time-ago.
function formatAbsolute(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

// Mapeia kind do alerta pra um label curto de fonte (chip discreto).
const SOURCE_LABELS = {
  'clickup-new': 'ClickUp',
  'clickup-new-digest': 'ClickUp',
  'clickup-overdue': 'ClickUp',
  'clickup-overdue-digest': 'ClickUp',
  'clickup-event-new': 'Radar',
  'clickup-event-new-digest': 'Radar',
  'clickup-event-1d': 'Radar',
  'clickup-event-7d': 'Radar',
  'clickup-event-14d': 'Radar',
  'clickup-event-live': 'Evento agora',
  'meta-hit': 'Meta',
  'topic-peak': 'Tópicos',
  'focus-changed': 'Foco',
};

// Quais "kinds" de alerta são originários do ClickUp. Usado pra trocar o ícone
// FA pelo logo gradiente oficial do ClickUp dentro do quadrado colorido — deixa
// o feed mais legível (rapidamente bate o olho e sabe "isso é ClickUp").
const CLICKUP_KINDS = new Set([
  'clickup-new',
  'clickup-new-digest',
  'clickup-overdue',
  'clickup-overdue-digest',
  'clickup-event-new',
  'clickup-event-new-digest',
  'clickup-event-1d',
  'clickup-event-7d',
  'clickup-event-14d',
  'clickup-event-live',
]);

function getSourceLabel(kind) {
  return SOURCE_LABELS[kind] || null;
}

function isClickUpKind(kind) {
  return CLICKUP_KINDS.has(kind);
}

/* Renderiza um ícone FA (ou logo do ClickUp) dentro de um quadrado colorido
   por severidade. Quando o kind do alerta vem do ClickUp, mostra o logo
   oficial em vez do FA — banded gradient roxo/ciano + rosa/amarelo. */
function ItemIcon({ icon, severity, focused, kind }) {
  const cls = [
    'notification-item__icon',
    `notification-item__icon--${severity || 'info'}`,
    isClickUpKind(kind) ? 'notification-item__icon--clickup' : '',
    focused ? 'is-focused' : '',
  ].filter(Boolean).join(' ');

  if (isClickUpKind(kind)) {
    return (
      <span className={cls} aria-hidden="true">
        <img src={clickupLogo} alt="" className="notification-item__icon-img" />
      </span>
    );
  }

  return (
    <span className={cls} aria-hidden="true">
      <i className={`fa-solid ${icon || 'fa-circle-info'}`}></i>
    </span>
  );
}

function NotificationItem({ item, isAlert, onDismiss, onActivate }) {
  const interactive = !!(item.href || item.topicLink || onActivate);
  const handleClick = (e) => {
    // Se for link externo (anchor com href), deixa o browser abrir.
    // Caso contrário, intercepta e chama onActivate.
    if (e.currentTarget.tagName === 'A' && item.href) return;
    if (interactive && onActivate) {
      e.preventDefault();
      onActivate(item);
    }
  };

  const Tag = item.href ? 'a' : 'div';
  const linkProps = item.href ? { href: item.href, target: '_blank', rel: 'noreferrer' } : {};

  return (
    <Tag
      {...linkProps}
      className={`notification-item notification-item--${item.severity || 'info'} ${item.read ? 'is-read' : ''} ${interactive ? 'is-interactive' : ''}`}
      onClick={handleClick}
      role={interactive && !item.href ? 'button' : undefined}
      tabIndex={interactive && !item.href ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && !item.href && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate?.(item);
        }
      }}
    >
      <ItemIcon icon={item.icon} severity={item.severity} focused={item.focused} kind={item.kind} />
      <div className="notification-item__main">
        <div className="notification-item__title">
          {item.title}
          {item.focused ? <span className="notification-item__chip">seu foco</span> : null}
        </div>
        {item.body ? <div className="notification-item__body">{item.body}</div> : null}
        {isAlert && item.timestamp ? (
          <div className="notification-item__meta">
            {getSourceLabel(item.kind) ? (
              <span className="notification-item__source">{getSourceLabel(item.kind)}</span>
            ) : null}
            <span className="notification-item__time">{timeAgo(item.timestamp)}</span>
            <span className="notification-item__date">{formatAbsolute(item.timestamp)}</span>
          </div>
        ) : null}
      </div>
      {interactive ? (
        <i className="fa-solid fa-chevron-right notification-item__chev" aria-hidden="true"></i>
      ) : null}
      {isAlert && onDismiss ? (
        <button
          type="button"
          className="notification-item__dismiss"
          title="Dispensar"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDismiss(item.id);
          }}
        >
          <i className="fa-solid fa-times"></i>
        </button>
      ) : null}
    </Tag>
  );
}

export default function NotificationBell() {
  const {
    alerts,
    radar,
    readIds,
    unreadCount,
    dismiss,
    markRead,
    markAllRead,
    clearAll,
    setBellOpen,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Publica o estado de abertura no contexto pro Layout reagir (colapsa o
  // sidebar quando o dropdown abre, restaura ao fechar). Cleanup garante
  // que se o componente desmontar com a central aberta, o sidebar volta.
  useEffect(() => {
    setBellOpen(open);
    return () => setBellOpen(false);
  }, [open, setBellOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
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

  /* Lógica de ativação: tenta scroll pro card, se não rolar abre o link. */
  const activateItem = (item) => {
    if (item.id) markRead(item.id);

    if (item.topicLink) {
      const onTopics = location.pathname === '/topics' || location.pathname === '/';
      if (onTopics) {
        if (scrollToTopicCard(item.topicLink)) {
          setOpen(false);
          return;
        }
      } else {
        navigate('/topics');
        scrollToTopicCardEventually(item.topicLink);
        setOpen(false);
        return;
      }
    }

    // Fallback: se tem href externo, abre nova aba.
    if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      setOpen(false);
    }
  };

  const decoratedAlerts = alerts.map((a) => ({ ...a, read: readIds.has(a.id) }));
  const total = alerts.length + radar.length;

  return (
    <div className={`notification-bell ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`app-icon-btn notification-bell__btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Notificações'}
        aria-label="Abrir central de notificações"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="fa-solid fa-bell"></i>
        {unreadCount > 0 ? (
          <span className="notification-bell__badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-dropdown" role="dialog" aria-label="Central de notificações">
          <div className="notification-dropdown__header">
            <strong>Central</strong>
            <div className="notification-dropdown__actions">
              {alerts.length > 0 && unreadCount > 0 ? (
                <button type="button" onClick={markAllRead}>Marcar todas</button>
              ) : null}
              <button
                type="button"
                title="Ver galeria de notificações"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications-preview');
                }}
              >
                <i className="fa-solid fa-eye"></i>
              </button>
              {alerts.length > 0 ? (
                <button type="button" onClick={clearAll} title="Limpar tudo">
                  <i className="fa-solid fa-broom"></i>
                </button>
              ) : null}
            </div>
          </div>

          <div className="notification-dropdown__body">
            {radar.length > 0 ? (
              <section className="notification-section">
                <h4 className="notification-section__title">
                  <i className="fa-solid fa-satellite-dish"></i> Radar — o que tá vindo
                </h4>
                {radar.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    isAlert={false}
                    onActivate={activateItem}
                  />
                ))}
              </section>
            ) : null}

            {decoratedAlerts.length > 0 ? (
              <section className="notification-section">
                <h4 className="notification-section__title">
                  <i className="fa-solid fa-bolt"></i> Agora
                </h4>
                {decoratedAlerts.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    isAlert
                    onDismiss={dismiss}
                    onActivate={activateItem}
                  />
                ))}
              </section>
            ) : null}

            {total === 0 ? (
              <div className="notification-empty">
                <i className="fa-regular fa-circle-check"></i>
                <span>Tudo tranquilo. Sem alertas no momento.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
