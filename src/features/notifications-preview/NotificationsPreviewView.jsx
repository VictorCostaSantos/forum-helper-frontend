import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clickupLogo from '../../assets/clickup.svg';
import { useTopics } from '../../shared/context/TopicsContext';
import { fetchUpcomingEvents } from '../../shared/notifications/clickupSync';
import { formatTopicAge } from '../topics/helpers';

/*
  Galeria visual de TODAS as notificações que a Central pode emitir.
  Não usa o Context — renderiza cards estáticos com fixtures pra inspeção visual.
  Acessível por /notifications-preview (sem item de menu por enquanto).

  Cada item é uma "amostra" (kind, severity, ícone/logo). A intenção é que
  alterações no design das notificações sejam validadas aqui antes de subir.
*/

const NOW = Date.now();
const ago = (mins) => NOW - mins * 60 * 1000;

const SAMPLES = [
  // ===== Sistema Forum Helper (não-ClickUp) =====
  {
    section: 'Sistema · Forum Helper',
    items: [
      {
        id: 'sample-meta-hit',
        kind: 'meta-hit',
        icon: 'fa-trophy',
        severity: 'success',
        title: 'Você bateu a meta hoje!',
        body: '6 / 5 respondidos · BR',
        timestamp: ago(8),
      },
      {
        id: 'sample-topic-peak',
        kind: 'topic-peak',
        icon: 'fa-arrow-trend-up',
        severity: 'warning',
        title: 'Pico de tópicos novos',
        body: '7 tópicos nas últimas 2h · 60% acima do normal.',
        timestamp: ago(35),
      },
      {
        id: 'sample-focus-changed',
        kind: 'focus-changed',
        icon: 'fa-bullseye',
        severity: 'info',
        title: 'Foco do dia mudou',
        body: 'Agora: Front-end + Mobile',
        timestamp: ago(120),
      },
      {
        id: 'sample-sla-critical',
        kind: 'sla-critical',
        icon: 'fa-fire-flame-curved',
        severity: 'critical',
        title: '3 tópicos > 48h sem resposta',
        body: '1 no seu foco · Como configurar webpack para projeto React?',
        focused: true,
      },
      {
        id: 'sample-sla-soon',
        kind: 'sla-soon-digest',
        icon: 'fa-hourglass-half',
        severity: 'warning',
        title: '4 tópicos perto de virar urgentes',
        body: '2 no seu foco · próximo em 3h 12min',
        focused: true,
      },
    ],
  },

  // ===== ClickUp tarefas pessoais =====
  {
    section: 'ClickUp · Suas tarefas',
    items: [
      {
        id: 'sample-cu-new',
        kind: 'clickup-new',
        icon: 'fa-list-check',
        severity: 'info',
        title: 'Nova tarefa atribuída no ClickUp',
        body: 'Revisar planejamento da imersão · vence 12/05/2026',
        timestamp: ago(15),
      },
      {
        id: 'sample-cu-new-digest',
        kind: 'clickup-new-digest',
        icon: 'fa-list-check',
        severity: 'info',
        title: '8 novas tarefas atribuídas',
        body: 'Confira no ClickUp pra ver detalhes.',
        timestamp: ago(22),
      },
      {
        id: 'sample-cu-overdue',
        kind: 'clickup-overdue',
        icon: 'fa-circle-exclamation',
        severity: 'critical',
        title: 'Tarefa atrasada no ClickUp',
        body: 'Atualizar relatório semanal · venceu 28/04/2026',
        timestamp: ago(60),
      },
      {
        id: 'sample-cu-overdue-digest',
        kind: 'clickup-overdue-digest',
        icon: 'fa-circle-exclamation',
        severity: 'critical',
        title: '6 tarefas atrasadas',
        body: 'Confira no ClickUp pra atualizar prazos.',
        timestamp: ago(75),
      },
      {
        id: 'sample-cu-radar',
        kind: 'clickup-radar',
        icon: 'fa-list-check',
        severity: 'warning',
        title: 'ClickUp: vence em 1h 20min',
        body: 'Fechar pendência da Imersão Java',
        radarOnly: true,
      },
    ],
  },

  // ===== ClickUp eventos (Radar) =====
  {
    section: 'Radar de Eventos · ClickUp',
    items: [
      {
        id: 'sample-cu-event-live',
        kind: 'clickup-event-live',
        icon: 'fa-tower-broadcast',
        severity: 'critical',
        title: 'Evento agora',
        body: 'Imersão Java: Profissional — segunda jornada',
        timestamp: ago(5),
      },
      {
        id: 'sample-cu-event-1d',
        kind: 'clickup-event-1d',
        icon: 'fa-circle-exclamation',
        severity: 'critical',
        title: 'Evento começa em 1 dia',
        body: 'Curso Santander: Imersão Digital 2026 — 04/05/2026',
        timestamp: ago(180),
      },
      {
        id: 'sample-cu-event-7d',
        kind: 'clickup-event-7d',
        icon: 'fa-calendar-week',
        severity: 'warning',
        title: 'Evento começa em 1 semana',
        body: 'Grupo 10 - Oracle One Latam — 10/05/2026',
        timestamp: ago(1440),
      },
      {
        id: 'sample-cu-event-14d',
        kind: 'clickup-event-14d',
        icon: 'fa-calendar-day',
        severity: 'info',
        title: 'Evento começa em 2 semanas',
        body: 'Imersão IA - Google — 17/05/2026',
        timestamp: ago(2880),
      },
      {
        id: 'sample-cu-event-new',
        kind: 'clickup-event-new',
        icon: 'fa-calendar-check',
        severity: 'info',
        title: 'Novo evento confirmado',
        body: 'Imersão: Profissional Java — 23/05/2026',
        timestamp: ago(45),
      },
      {
        id: 'sample-cu-event-new-digest',
        kind: 'clickup-event-new-digest',
        icon: 'fa-calendar-check',
        severity: 'info',
        title: '7 novos eventos confirmados',
        body: 'Confira no Radar de Eventos do ClickUp.',
        timestamp: ago(50),
      },
    ],
  },
];

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
  'sla-critical': 'SLA',
  'sla-soon-digest': 'SLA',
};

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
  'clickup-radar',
]);

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

function PreviewIcon({ item }) {
  const isClickUp = CLICKUP_KINDS.has(item.kind);
  const cls = [
    'notification-item__icon',
    `notification-item__icon--${item.severity || 'info'}`,
    isClickUp ? 'notification-item__icon--clickup' : '',
    item.focused ? 'is-focused' : '',
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} aria-hidden="true">
      {isClickUp ? (
        <img src={clickupLogo} alt="" className="notification-item__icon-img" />
      ) : (
        <i className={`fa-solid ${item.icon || 'fa-circle-info'}`}></i>
      )}
    </span>
  );
}

function PreviewItem({ item }) {
  const sourceLabel = SOURCE_LABELS[item.kind];

  return (
    <div className={`notification-item notification-item--${item.severity || 'info'} is-interactive`}>
      <PreviewIcon item={item} />
      <div className="notification-item__main">
        <div className="notification-item__title">
          {item.title}
          {item.focused ? <span className="notification-item__chip">seu foco</span> : null}
        </div>
        {item.body ? <div className="notification-item__body">{item.body}</div> : null}
        {item.radarOnly ? (
          <div className="notification-item__meta">
            <span className="notification-item__source">Radar (live)</span>
          </div>
        ) : item.timestamp ? (
          <div className="notification-item__meta">
            {sourceLabel ? <span className="notification-item__source">{sourceLabel}</span> : null}
            <span className="notification-item__time">{timeAgo(item.timestamp)}</span>
            <span className="notification-item__date">{formatAbsolute(item.timestamp)}</span>
          </div>
        ) : null}
      </div>
      <i className="fa-solid fa-chevron-right notification-item__chev" aria-hidden="true"></i>
    </div>
  );
}

/* Mini-card de tópico — espelha o visual do .topic-card real, sem
   funcionalidade de claim. Serve só pra inspecionar como cada estado
   (default / sla / urgent / claimed) aparece no light/dark mode. */
function PreviewCard({ variant, ageInDays, claimed }) {
  const stateClass = [
    'topic-card',
    'frontend',
    ageInDays >= 1 ? 'is-sla' : '',
    ageInDays >= 2 ? 'is-urgent' : '',
  ].filter(Boolean).join(' ');

  const fakeAvatar = 'https://ui-avatars.com/api/?name=Aluno&background=random';
  const claimedAvatar = 'https://ui-avatars.com/api/?name=VC&background=7B71FF&color=fff';

  return (
    <div className="notif-preview__card-wrap">
      <span className="notif-preview__card-label">{variant}</span>
      <div className={stateClass}>
        <div className="card-header">
          <span className="category-tag">Front-end</span>
          <div className="card-tags-right">
            <span className="priority-tag">{ageInDays >= 2 ? 'Complexo' : 'Médio'}</span>
          </div>
        </div>
        <div className="card-body">
          <h2>
            <a href="#preview" onClick={(e) => e.preventDefault()}>
              {variant === 'urgente · 48h+'
                ? 'Erro estranho no useEffect que não roda'
                : variant === 'em SLA · 24-48h'
                ? 'Como organizar pasta components em projeto grande?'
                : variant === 'assumido (você)'
                ? 'Webpack 5 + React 19 sem hot reload'
                : 'Dúvida sobre props com TypeScript'}
            </a>
          </h2>
          <p className="topic-age">{formatTopicAge(ageInDays)}</p>
        </div>
        <div className="card-footer">
          <div className="author-info">
            <img src={fakeAvatar} alt="" />
          </div>
          {claimed ? (
            <div className="claimed-by is-mine" title="Você">
              <img src={claimedAvatar} alt="" />
            </div>
          ) : (
            <button type="button" className="action-button claim-button" disabled>
              <span className="icon-add"><i className="fas fa-plus"></i></span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Pílula KPI com número grande + label — usada no painel "Acontecendo agora". */
function NowKpi({ value, label, tone }) {
  return (
    <div className={`notif-preview__kpi notif-preview__kpi--${tone || 'neutral'}`}>
      <span className="notif-preview__kpi-num">{value}</span>
      <span className="notif-preview__kpi-lbl">{label}</span>
    </div>
  );
}

function NotificationsPreviewView() {
  const navigate = useNavigate();
  const { topics } = useTopics();
  const [liveEvents, setLiveEvents] = useState([]);

  // Busca eventos do Radar e fica só com os "vivos" (acontecendo agora).
  // Se token ClickUp não tá configurado, lista fica vazia — sem barulho.
  useEffect(() => {
    const token = localStorage.getItem('clickupToken');
    if (!token) return undefined;
    let alive = true;
    const load = async () => {
      const events = await fetchUpcomingEvents(token);
      if (!alive) return;
      setLiveEvents((events || []).filter((e) => e.isLive));
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Snapshots da fila — alimenta as KPIs de "Acontecendo agora".
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
            <i className="fa-solid fa-bell"></i>
            Central de visualização
          </h1>
          <p className="notif-preview__subtitle">
            Estado atual do sistema, prévia de como os cards aparecem em cada
            severidade e galeria de todas as notificações que a central pode emitir.
          </p>
        </header>

        {/* ===== ESTADO ATUAL ===== */}
        <section className="notif-preview__section notif-preview__now">
          <h2 className="notif-preview__section-title">Acontecendo agora</h2>

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
              Nenhum evento ao vivo no momento. Quando houver, aparece aqui em destaque.
            </p>
          )}
        </section>

        {/* ===== PRÉVIA DE CARDS ===== */}
        <section className="notif-preview__section">
          <h2 className="notif-preview__section-title">Estados do card</h2>
          <p className="notif-preview__section-hint">
            Inspeção visual de como cada faixa de SLA aparece. Útil pra validar
            mudanças de cor e contraste no modo claro / escuro.
          </p>
          <div className="notif-preview__cards">
            <PreviewCard variant="normal · menos de 24h" ageInDays={0.4} claimed={false} />
            <PreviewCard variant="em SLA · 24-48h" ageInDays={1.5} claimed={false} />
            <PreviewCard variant="urgente · 48h+" ageInDays={3.2} claimed={false} />
            <PreviewCard variant="assumido (você)" ageInDays={0.7} claimed />
          </div>
        </section>

        {/* ===== GALERIA DE NOTIFICAÇÕES ===== */}
        {SAMPLES.map((group) => (
          <section key={group.section} className="notif-preview__section">
            <h2 className="notif-preview__section-title">{group.section}</h2>
            <div className="notif-preview__grid">
              {group.items.map((item) => (
                <article key={item.id} className="notif-preview__cell">
                  <span className="notif-preview__kind">{item.kind}</span>
                  <PreviewItem item={item} />
                </article>
              ))}
            </div>
          </section>
        ))}

        <footer className="notif-preview__foot">
          <p>
            ClickUp e Radar agora carregam o logo oficial do ClickUp em vez do
            ícone genérico — é o que os tipos prefixados <code>clickup-*</code> usam.
          </p>
        </footer>
      </div>
    </main>
  );
}

export default NotificationsPreviewView;
