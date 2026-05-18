import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications, NOTIF_CATEGORIES } from './NotificationsContext';
import { scrollToTopicCard, scrollToTopicCardEventually } from './scrollToTopic';
import ClickupIcon from './ClickupIcon';
import UserAvatar from '../components/UserAvatar';
import { useAvatar } from '../avatars/avatarStore';
import { getDisplayName } from '../../features/allocation/team';

/*
  Tempo relativo estilo X/Insta: "agora", "há 5min", "há 2h", "ontem",
  "há 3d", "12 mai". Curto e direto.
*/
function formatRelative(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function categoryOf(kind) {
  if (!kind) return 'outras';
  if (kind.startsWith('alloc-')) return 'alocacao';
  if (kind.startsWith('clickup-')) return 'clickup';
  return 'outras';
}

/*
  Gradient do avatar conforme o tipo de alerta. Cada categoria tem sua
  identidade visual (alocação roxo, tópicos laranja, foco verde, etc).
*/
function avatarVariant(kind) {
  if (!kind) return 'alloc';
  if (kind === 'alloc-danger') return 'people';
  if (kind === 'alloc-cycle-missing') return 'cycle';
  if (kind.startsWith('alloc-')) return 'alloc';
  if (kind === 'topic-peak') return 'topics';
  if (kind === 'focus-changed') return 'focus';
  if (kind === 'meta-hit') return 'meta';
  return 'alloc';
}

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

function isClickUpKind(kind) {
  return CLICKUP_KINDS.has(kind);
}

/*
  Extrai username "sobre quem é o alerta" a partir do id, pra
  retrocompatibilidade com alerts persistidos antes de o bridge passar
  `avatarUsername` explicitamente.
*/
function deriveAvatarUsername(item) {
  if (item?.avatarUsername) return item.avatarUsername;
  const id = String(item?.id || '');
  if (id.startsWith('alloc-danger:')) {
    return id.slice('alloc-danger:'.length) || null;
  }
  return null;
}

/* Avatar 44px circular. Três modos:
   1. Foto do usuário (avatarUsername)
   2. Logo do ClickUp dentro do gradient azul
   3. Ícone dentro do gradient da categoria
*/
function ItemAvatarPhoto({ username }) {
  const url = useAvatar(username);
  const displayName = getDisplayName(username);
  return (
    <UserAvatar
      name={displayName}
      src={url}
      size={44}
      cacheKey={username}
      className="notification-item__avatar-img"
    />
  );
}

function ItemAvatar({ icon, kind, avatarUsername }) {
  if (avatarUsername) {
    return (
      <span className="notification-item__avatar notification-item__avatar--photo" aria-hidden="true">
        <ItemAvatarPhoto username={avatarUsername} />
      </span>
    );
  }
  if (isClickUpKind(kind)) {
    return (
      <span className="notification-item__avatar notification-item__avatar--clickup" aria-hidden="true">
        <ClickupIcon className="notification-item__avatar-svg" />
      </span>
    );
  }
  const variant = avatarVariant(kind);
  return (
    <span
      className={`notification-item__avatar notification-item__avatar--${variant}`}
      aria-hidden="true"
    >
      <i className={`fa-solid ${icon || 'fa-bell'}`}></i>
    </span>
  );
}

function NotificationItem({ item, isAlert, onDismiss, onActivate }) {
  const interactive = !!(item.href || item.topicLink || item.route || item.action || onActivate);
  const handleClick = (e) => {
    if (e.currentTarget.tagName === 'A' && item.href) return;
    if (interactive && onActivate) {
      e.preventDefault();
      onActivate(item);
    }
  };

  const Tag = item.href ? 'a' : 'div';
  const linkProps = item.href ? { href: item.href, target: '_blank', rel: 'noreferrer' } : {};
  const isUnread = isAlert && !item.read;
  const meta = Array.isArray(item.meta) ? item.meta.filter(Boolean) : [];

  return (
    <Tag
      {...linkProps}
      className={`notification-item ${isUnread ? 'is-unread' : ''} ${item.read ? 'is-read' : ''} ${interactive ? 'is-interactive' : ''}`}
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
      <ItemAvatar
        icon={item.icon}
        kind={item.kind}
        avatarUsername={deriveAvatarUsername(item)}
      />

      <div className="notification-item__main">
        <div className="notification-item__head">
          <span className="notification-item__subject">{item.title}</span>
          {item.timestamp ? (
            <>
              <span className="notification-item__dot" aria-hidden="true">·</span>
              <span className="notification-item__time">{formatRelative(item.timestamp)}</span>
            </>
          ) : null}
          {item.focused ? <span className="notification-item__chip">seu foco</span> : null}
        </div>

        {item.body ? (
          <div className="notification-item__text">{item.body}</div>
        ) : null}

        {meta.length > 0 ? (
          <div className="notification-item__meta">
            {meta.map((m, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 ? (
                  <span className="notification-item__meta-sep" aria-hidden="true">·</span>
                ) : null}
                <span className="notification-item__meta-item">
                  {m.icon ? <i className={m.icon}></i> : null}
                  <span>{m.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>

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
    notifPrefs,
    setNotifPref,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  const activateItem = (item) => {
    if (item.id) markRead(item.id);

    if (item.action === 'open-settings') {
      window.__openSettings?.();
      setOpen(false);
      return;
    }

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

    if (item.route) {
      navigate(item.route);
      setOpen(false);
      return;
    }

    if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      setOpen(false);
    }
  };

  const decoratedAlerts = alerts.map((a) => ({ ...a, read: readIds.has(a.id) }));
  const total = alerts.length + radar.length;

  const [activeTab, setActiveTab] = useState('unread');

  const counts = {
    unread: decoratedAlerts.filter((a) => !a.read).length,
    read:   decoratedAlerts.filter((a) =>  a.read).length,
    all:    decoratedAlerts.length + radar.length,
  };

  const visibleRadar = activeTab === 'all' ? radar : [];
  const visibleAlerts = activeTab === 'all'
    ? decoratedAlerts
    : activeTab === 'unread'
      ? decoratedAlerts.filter((a) => !a.read)
      : decoratedAlerts.filter((a) =>  a.read);

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
            <h2 className="notification-dropdown__title">Notificações</h2>
            <div className="notification-dropdown__actions">
              {alerts.length > 0 && unreadCount > 0 ? (
                <button type="button" onClick={markAllRead} title="Marcar todas como lidas">
                  <i className="fa-solid fa-check-double"></i>
                </button>
              ) : null}
              <button
                type="button"
                title="Preferências"
                aria-pressed={prefsOpen}
                className={prefsOpen ? 'is-active' : ''}
                onClick={() => setPrefsOpen((v) => !v)}
              >
                <i className="fa-solid fa-gear"></i>
              </button>
              <button
                type="button"
                title="Galeria de notificações"
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

          {prefsOpen ? (
            <section className="notification-prefs" aria-label="Preferências de notificação">
              <header className="notification-prefs__head">
                <i className="fa-solid fa-sliders"></i>
                <span>Avise-me sobre…</span>
              </header>
              <ul className="notification-prefs__list">
                {NOTIF_CATEGORIES.map((cat) => {
                  const enabled = notifPrefs[cat.key] !== false;
                  return (
                    <li key={cat.key} className="notification-prefs__row">
                      <label className="notification-prefs__label">
                        <span className="notification-prefs__icon" aria-hidden="true">
                          <i className={cat.icon}></i>
                        </span>
                        <span className="notification-prefs__text">
                          <span className="notification-prefs__name">{cat.label}</span>
                          <span className="notification-prefs__hint">{cat.hint}</span>
                        </span>
                        <span className={`notification-prefs__switch ${enabled ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setNotifPref(cat.key, e.target.checked)}
                            aria-label={cat.label}
                          />
                          <span className="notification-prefs__switch-track" aria-hidden="true" />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="notification-tabs" role="tablist">
            <button
              type="button"
              className={`notification-tab ${activeTab === 'unread' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('unread')}
              role="tab"
              aria-selected={activeTab === 'unread'}
            >
              Não lidas
              {counts.unread > 0 ? (
                <span className="notification-tab__badge">{counts.unread}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`notification-tab ${activeTab === 'read' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('read')}
              role="tab"
              aria-selected={activeTab === 'read'}
              disabled={counts.read === 0}
            >
              Lidas
              {counts.read > 0 ? (
                <span className="notification-tab__badge">{counts.read}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`notification-tab ${activeTab === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('all')}
              role="tab"
              aria-selected={activeTab === 'all'}
            >
              Todas
              {counts.all > 0 ? (
                <span className="notification-tab__badge">{counts.all}</span>
              ) : null}
            </button>
          </div>

          <div className="notification-dropdown__body">
            {visibleRadar.length > 0 ? (
              <section className="notification-section">
                <h4 className="notification-section__title">Próximos</h4>
                {visibleRadar.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    isAlert={false}
                    onActivate={activateItem}
                  />
                ))}
              </section>
            ) : null}

            {visibleAlerts.length > 0 ? (
              <section className="notification-section">
                {visibleAlerts.map((item) => (
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
                <span className="notification-empty__title">Sem alertas no momento</span>
                <span className="notification-empty__sub">Você está em dia.</span>
              </div>
            ) : visibleRadar.length === 0 && visibleAlerts.length === 0 ? (
              <div className="notification-empty">
                <span className="notification-empty__title">Nada nessa categoria</span>
                <span className="notification-empty__sub">Tente outra aba.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
