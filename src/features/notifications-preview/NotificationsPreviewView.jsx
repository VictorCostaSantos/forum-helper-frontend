import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopics } from '../../shared/context/TopicsContext';
import { useNotifications } from '../../shared/notifications/NotificationsContext';
import { fetchUpcomingEvents } from '../../shared/notifications/clickupSync';
import ClickupIcon from '../../shared/notifications/ClickupIcon';

/*
  Página "Acontecendo agora" — snapshot do estado atual da fila pra quem
  pega o sistema na ativa. Removi a galeria de notificações e a prévia de
  cards (uso interno de design/dev) — aqui mostra só o que importa pro
  atendente: KPIs ao vivo + eventos rolando agora.
*/

function NowKpi({ value, label, tone }) {
  return (
    <div className={`notif-preview__kpi notif-preview__kpi--${tone || 'neutral'}`}>
      <span className="notif-preview__kpi-num">{value}</span>
      <span className="notif-preview__kpi-lbl">{label}</span>
    </div>
  );
}

/* Painel de panorama do ClickUp — só os 4 KPIs essenciais:
   total / atrasadas / vencem em 24h / eventos ao vivo. A contagem de
   "próximos eventos" e o "próximo evento" foram removidos pq a seção
   "Próximos eventos" abaixo já mostra a lista completa — sem duplicação. */
function ClickupPanel({ summary }) {
  if (!summary) return null;
  const { totalTasks, overdueTotal, dueSoonTotal, liveEventsCount } = summary;

  return (
    <section className="notif-preview__section notif-preview__cu">
      <header className="notif-preview__cu-head">
        <span className="notif-preview__cu-brand">
          <ClickupIcon className="notif-preview__cu-brand-icon" />
          <span>ClickUp</span>
        </span>
        <a
          className="notif-preview__cu-open"
          href="https://app.clickup.com/"
          target="_blank"
          rel="noreferrer"
        >
          Abrir <i className="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </header>

      <div className="notif-preview__cu-kpis">
        <div className="notif-preview__cu-kpi">
          <span className="notif-preview__cu-num">{totalTasks}</span>
          <span className="notif-preview__cu-lbl">Tarefas</span>
        </div>
        <div className={`notif-preview__cu-kpi ${overdueTotal > 0 ? 'is-danger' : ''}`}>
          <span className="notif-preview__cu-num">{overdueTotal}</span>
          <span className="notif-preview__cu-lbl">Atrasadas</span>
        </div>
        <div className={`notif-preview__cu-kpi ${dueSoonTotal > 0 ? 'is-warn' : ''}`}>
          <span className="notif-preview__cu-num">{dueSoonTotal}</span>
          <span className="notif-preview__cu-lbl">Vencem 24h</span>
        </div>
        <div className={`notif-preview__cu-kpi ${liveEventsCount > 0 ? 'is-live' : ''}`}>
          <span className="notif-preview__cu-num">{liveEventsCount}</span>
          <span className="notif-preview__cu-lbl">Ao vivo</span>
        </div>
      </div>
    </section>
  );
}

// Helper de formatação de data BR — compartilhado pelas seções "agora"
// e "próximos". Mantido inline pra evitar import extra só por isso.
function formatDateBr(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "começa em Xh / Xd" — copy curto pro chip da listagem de próximos.
function formatTimeUntil(ms) {
  if (!ms) return '';
  const diffMin = Math.round((ms - Date.now()) / 60000);
  if (diffMin <= 0) return 'agora';
  if (diffMin < 60) return `em ${diffMin}min`;
  if (diffMin < 1440) {
    const h = Math.round(diffMin / 60);
    return `em ${h}h`;
  }
  const d = Math.floor(diffMin / 1440);
  if (d < 60) return `em ${d}d`;
  const months = Math.floor(d / 30);
  return `em ${months}mes`;
}

// Para tasks: "vence hoje", "venceu há Xd", "vence em Xd". Mais expressivo
// que só uma data isolada — comunica urgência num átomo.
function formatDueLabel(ms) {
  if (!ms) return null;
  const now = Date.now();
  const diffMin = Math.round((ms - now) / 60000);
  if (diffMin === 0) return 'vence agora';
  if (diffMin > 0 && diffMin < 60) return `vence em ${diffMin}min`;
  if (diffMin > 0 && diffMin < 1440) return `vence em ${Math.round(diffMin / 60)}h`;
  if (diffMin > 0) {
    const d = Math.floor(diffMin / 1440);
    if (d < 60) return `vence em ${d}d`;
    return `vence em ${Math.floor(d / 30)}mes`;
  }
  // Atrasada
  const minOverdue = -diffMin;
  if (minOverdue < 60) return `venceu há ${minOverdue}min`;
  if (minOverdue < 1440) return `venceu há ${Math.round(minOverdue / 60)}h`;
  const d = Math.floor(minOverdue / 1440);
  if (d < 60) return `venceu há ${d}d`;
  return `venceu há ${Math.floor(d / 30)}mes`;
}

/* Lista das tarefas pessoais do ClickUp — pega o taskList já normalizado
   no contexto. Cada item linka direto pra task no app do ClickUp. */
function ClickupTaskList({ tasks }) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <section className="notif-preview__section notif-preview__cu-tasks">
      <h2 className="notif-preview__section-title">
        <ClickupIcon className="notif-preview__cu-tasks-icon" />
        Suas tarefas no ClickUp
      </h2>

      <ul className="notif-preview__cu-tasks-list">
        {tasks.map((task) => {
          const dueLabel = formatDueLabel(task.dueMs);
          const dueClass = task.isOverdue
            ? 'is-overdue'
            : task.isDueSoon
            ? 'is-due-soon'
            : '';
          return (
            <li key={task.id} className="notif-preview__cu-task">
              <a
                href={task.url || 'https://app.clickup.com/'}
                target="_blank"
                rel="noreferrer"
                className="notif-preview__cu-task-link"
              >
                <div className="notif-preview__cu-task-main">
                  <span className="notif-preview__cu-task-name">{task.name}</span>
                  <div className="notif-preview__cu-task-meta">
                    {task.statusLabel ? (
                      <span
                        className="notif-preview__cu-task-status"
                        style={task.statusColor ? { '--status-color': task.statusColor } : undefined}
                      >
                        {task.statusLabel}
                      </span>
                    ) : null}
                    {dueLabel ? (
                      <span className={`notif-preview__cu-task-due ${dueClass}`}>
                        {dueLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NotificationsPreviewView() {
  const navigate = useNavigate();
  const { topics } = useTopics();
  const { clickupSummary } = useNotifications();
  const [liveEvents, setLiveEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('clickupToken');
    if (!token) return undefined;
    let alive = true;
    const load = async () => {
      const events = await fetchUpcomingEvents(token);
      if (!alive) return;
      const all = events || [];
      setLiveEvents(all.filter((e) => e.isLive));
      // Próximos = não-vivos com startMs futuro, ordenados pelo mais
      // próximo. Limita a 8 pra não virar uma lista enorme.
      const now = Date.now();
      setUpcomingEvents(
        all
          .filter((e) => !e.isLive && e.startMs && e.startMs > now)
          .sort((a, b) => a.startMs - b.startMs)
          .slice(0, 8),
      );
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const snapshot = useMemo(() => {
    const total = topics.length;
    const sla = topics.filter((t) => (t.ageInDays || 0) >= 1 && (t.ageInDays || 0) < 2).length;
    const urgent = topics.filter((t) => (t.ageInDays || 0) >= 2).length;
    const claimed = topics.filter((t) => t.isClaimed).length;
    return { total, sla, urgent, claimed };
  }, [topics]);

  return (
    <main className="notif-preview">
      <div className="notif-preview__inner">
        <button
          type="button"
          className="notif-preview__back"
          onClick={() => navigate(-1)}
        >
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>

        <header className="notif-preview__head">
          <h1 className="notif-preview__title">
            <i className="fa-solid fa-bolt"></i>
            Acontecendo agora
          </h1>
          <p className="notif-preview__subtitle">
            Visão rápida da fila e dos eventos do dia.
          </p>
        </header>

        <section className="notif-preview__section notif-preview__now">
          <div className="notif-preview__kpis">
            <NowKpi value={snapshot.total} label="Em aberto" tone="neutral" />
            <NowKpi value={snapshot.sla} label="Em SLA · 24-48h" tone="warn" />
            <NowKpi value={snapshot.urgent} label="Urgentes · 48h+" tone="danger" />
            <NowKpi value={snapshot.claimed} label="Sendo respondidos" tone="info" />
            <NowKpi value={liveEvents.length} label="Eventos agora" tone={liveEvents.length > 0 ? 'live' : 'neutral'} />
          </div>

          {liveEvents.length > 0 ? (
            <div className="notif-preview__live-list">
              {liveEvents.map((event) => (
                <a
                  key={event.id}
                  href={event.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="notif-preview__live-item"
                >
                  <span className="notif-preview__live-dot" aria-hidden="true"></span>
                  <span className="notif-preview__live-name">{event.name}</span>
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
              ))}
            </div>
          ) : (
            <p className="notif-preview__empty">
              Sem eventos ao vivo.
            </p>
          )}
        </section>

        <ClickupPanel summary={clickupSummary} />
        <ClickupTaskList tasks={clickupSummary?.taskList} />

        {/* ===== PRÓXIMOS EVENTOS ===== */}
        <section className="notif-preview__section notif-preview__upcoming">
          <h2 className="notif-preview__section-title">
            <i className="fa-regular fa-calendar"></i>
            Próximos eventos
          </h2>

          {upcomingEvents.length > 0 ? (
            <ul className="notif-preview__upcoming-list">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="notif-preview__upcoming-item">
                  <a
                    href={event.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="notif-preview__upcoming-link"
                  >
                    <div className="notif-preview__upcoming-main">
                      <span className="notif-preview__upcoming-name">{event.name}</span>
                      <span className="notif-preview__upcoming-meta">
                        {formatDateBr(event.startMs)} · começa {formatTimeUntil(event.startMs)}
                      </span>
                    </div>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notif-preview__empty">
              Sem eventos no Radar.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default NotificationsPreviewView;
