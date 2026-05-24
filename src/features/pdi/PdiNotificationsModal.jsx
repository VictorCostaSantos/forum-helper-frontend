import React, { useEffect, useMemo } from 'react';
import { formatScheduleShort } from './BlockSchedulePopover';

// Modal de configuração de notificações do PDI.
// - Estado da permissão do navegador (botão pra solicitar)
// - Toggle de lembrete diário + horário
// - Lista read-only dos próximos 5 disparos previstos
// - Caveat honesto: só funciona com aba aberta

function formatRelative(atMs) {
  const diff = atMs - Date.now();
  const min = Math.round(diff / 60_000);
  if (min < 60) return `em ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `em ${h}h`;
  const d = Math.round(h / 24);
  return `em ${d}d`;
}

function formatAbsolute(atMs) {
  const d = new Date(atMs);
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PdiNotificationsModal({
  doc,
  supported,
  permission,
  onRequestPermission,
  dailyReminder,
  onUpdateDailyReminder,
  upcoming,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Hábitos com schedule configurado (pra listar mesmo sem permissão concedida)
  const scheduledHabits = useMemo(
    () => (doc?.blocks || []).filter((b) => b.schedule && b.schedule.time),
    [doc?.blocks],
  );

  const permissionUi = (() => {
    if (!supported) {
      return {
        icon: 'fa-ban',
        title: 'Notificações não suportadas',
        body: 'Esse navegador não tem Notification API. Tente em desktop Chrome/Firefox/Edge.',
        cls: 'is-unsupported',
      };
    }
    if (permission === 'granted') {
      return {
        icon: 'fa-circle-check',
        title: 'Notificações ativas',
        body: 'Os lembretes vão disparar enquanto essa aba estiver aberta.',
        cls: 'is-granted',
      };
    }
    if (permission === 'denied') {
      return {
        icon: 'fa-circle-xmark',
        title: 'Notificações bloqueadas',
        body: 'Você negou a permissão. Habilite manualmente nas configurações do navegador (ícone de cadeado na barra de endereço).',
        cls: 'is-denied',
      };
    }
    return {
      icon: 'fa-bell',
      title: 'Ativar notificações',
      body: 'Pra você receber lembretes dos hábitos do PDI, o navegador precisa da sua permissão.',
      cls: 'is-default',
      cta: true,
    };
  })();

  return (
    <div className="pdi-notif-backdrop" onMouseDown={onClose}>
      <div
        className="pdi-notif-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pdi-notif-title"
      >
        <header className="pdi-notif-modal__head">
          <div>
            <h2 id="pdi-notif-title" className="pdi-notif-modal__title">
              <i className="fa-solid fa-bell"></i>
              Notificações do PDI
            </h2>
            <p className="pdi-notif-modal__subtitle">
              Lembretes só funcionam com a aba do Forum Helper aberta — não há servidor de push.
            </p>
          </div>
          <button
            type="button"
            className="pdi-notif-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="pdi-notif-modal__body">
          {/* PERMISSÃO */}
          <section className={`pdi-notif-status ${permissionUi.cls}`}>
            <i className={`fa-solid ${permissionUi.icon}`}></i>
            <div className="pdi-notif-status__main">
              <strong>{permissionUi.title}</strong>
              <span>{permissionUi.body}</span>
            </div>
            {permissionUi.cta ? (
              <button
                type="button"
                className="pdi-notif-btn pdi-notif-btn--primary"
                onClick={onRequestPermission}
              >
                Permitir
              </button>
            ) : null}
          </section>

          {/* LEMBRETE DIÁRIO */}
          <section className="pdi-notif-section">
            <header className="pdi-notif-section__head">
              <label className="pdi-notif-toggle">
                <input
                  type="checkbox"
                  checked={!!dailyReminder.enabled}
                  onChange={(e) => onUpdateDailyReminder({ enabled: e.target.checked })}
                />
                <span className="pdi-notif-toggle__lbl">Lembrete diário</span>
              </label>
              <input
                type="time"
                className="pdi-notif-time"
                value={dailyReminder.time || '09:00'}
                disabled={!dailyReminder.enabled}
                onChange={(e) => onUpdateDailyReminder({ time: e.target.value })}
              />
            </header>
            <p className="pdi-notif-section__hint">
              Notifica todo dia no horário escolhido pra você revisar seu PDI.
            </p>
          </section>

          {/* HÁBITOS COM HORÁRIO */}
          <section className="pdi-notif-section">
            <header className="pdi-notif-section__head">
              <strong className="pdi-notif-section__title">
                Hábitos com horário ({scheduledHabits.length})
              </strong>
            </header>
            {scheduledHabits.length === 0 ? (
              <p className="pdi-notif-section__hint">
                Você ainda não definiu horário em nenhum hábito recorrente. Clique no ⋯ ao lado
                de um bloco de hábito e escolha "Definir horário/lembrete".
              </p>
            ) : (
              <ul className="pdi-notif-habits">
                {scheduledHabits.map((b) => (
                  <li key={b.id} className="pdi-notif-habit">
                    <i className="fa-solid fa-arrows-rotate"></i>
                    <span className="pdi-notif-habit__name">{b.content || 'Hábito sem título'}</span>
                    <span className="pdi-notif-habit__sched">{formatScheduleShort(b.schedule)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* PRÓXIMOS DISPAROS */}
          {permission === 'granted' && upcoming && upcoming.length > 0 ? (
            <section className="pdi-notif-section">
              <header className="pdi-notif-section__head">
                <strong className="pdi-notif-section__title">Próximos lembretes</strong>
              </header>
              <ul className="pdi-notif-upcoming">
                {upcoming.slice(0, 5).map((ev) => (
                  <li key={ev.tag} className="pdi-notif-upcoming-item">
                    <span className="pdi-notif-upcoming-time">{formatRelative(ev.at)}</span>
                    <span className="pdi-notif-upcoming-title">{ev.title}</span>
                    <span className="pdi-notif-upcoming-abs">{formatAbsolute(ev.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="pdi-notif-modal__foot">
          <button type="button" className="pdi-notif-btn pdi-notif-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

export default PdiNotificationsModal;
