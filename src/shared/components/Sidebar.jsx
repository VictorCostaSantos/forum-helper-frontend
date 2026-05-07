import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchUserStats,
  fetchLatamStats,
  fetchAvatarFromBackend,
  getLatamUsername,
} from '../../api/apiService';
import latamImage from '../../assets/image-removebg-preview.png';
import { useTopics } from '../context/TopicsContext';

const SHEET_ID = '1746BtlDdh97YV0CV0s941WezEgkhEJx8geFNPYf2ulk';

const ALLOC_TABS = [
  { id: 'sugestoes', gid: '1812290880', title: 'Sugestões', optional: false, icon: <img src="https://cursos.alura.com.br/assets/images/menu/community/engagement/icon-suggestions.svg" alt="Sugestões" className="tab-icon-custom" /> },
  { id: 'discord', gid: '1034627386', title: 'Discord', optional: false, icon: <i className="fab fa-discord"></i> },
  { id: 'latam', gid: '1145495672', title: 'Alura Latam', optional: true, icon: <img src={latamImage} alt="Alura Latam" className="tab-icon-custom tab-icon-latam" /> },
  { id: 'imersao', gid: '1966976426', title: 'Imersão', optional: true, icon: <img src="https://cursos.alura.com.br/assets/images/alura/topics/icon-moderador.svg" alt="Imersão" className="tab-icon-custom" /> },
  { id: 'artigos', gid: '1902907481', title: 'Artigos', optional: true, icon: <img src="https://cursos.alura.com.br/assets/images/search/article-tag.svg" alt="Artigos" className="tab-icon-custom" style={{ width: 20, height: 20 }} /> },
];

// O foco/área de cada pessoa (foco1/foco2 da planilha) deixou de ser exibido
// aqui — o FocusBanner em TopicsView agora usa esse dado dinamicamente,
// sugerindo onde a pessoa tem mais impacto. Manter como chip estático no
// sidebar virou ruído. Os GIDs ainda são usados em outros lugares.
const REMINDERS_GID = '1463294778';

async function fetchSheetRows(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&_=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erro ao carregar planilha');
  const text = await response.text();
  return JSON.parse(text.substring(47).slice(0, -2));
}

async function fetchAllocationData(gid) {
  const json = await fetchSheetRows(gid);
  return json.table.rows.map((row) => ({
    periodo: row.c[0]?.v || '',
    responsaveis: Array.from({ length: row.c.length - 1 }, (_, i) => row.c[i + 1]?.v).filter(Boolean),
  }));
}

function parseMessageToHTML(message) {
  if (!message) return '';
  let html = message;
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="reminder-image">');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  return `<p>${html}</p>`;
}

function findCurrentAllocation(rows) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  return rows.find((item) => {
    try {
      if (!item.periodo || !item.periodo.includes(' - ')) return false;
      const [inicioStr, fimStr] = item.periodo.split(' - ');
      const [diaInicio, mesInicio] = inicioStr.split('/');
      const [diaFim, mesFim] = fimStr.split('/');
      if (Number.isNaN(Number(diaInicio)) || Number.isNaN(Number(mesInicio))) return false;
      const dataInicio = new Date(year, mesInicio - 1, diaInicio);
      const dataFim = new Date(year, mesFim - 1, diaFim);
      dataFim.setHours(23, 59, 59, 999);
      return today >= dataInicio && today <= dataFim;
    } catch {
      return false;
    }
  });
}

function PerformanceCard({ meta, statsBr, statsLatam, hasLatam }) {
  // Região vem do TopicsContext — segue a aba ativa em "Tópicos em aberto".
  const { region: regionUpper } = useTopics();
  const useLatam = regionUpper === 'LATAM' && hasLatam;

  const stats = useLatam ? statsLatam : statsBr;
  const today = stats.postsToday || 0;
  const month = stats.postsMonth || 0;
  const metaNum = parseInt(meta, 10) || 1;
  const rawPct = Math.floor((today / metaNum) * 100);
  const pct = Math.min(rawPct, 100);
  const isComplete = today >= metaNum;
  const remaining = Math.max(metaNum - today, 0);
  // Apple system colors: green BR / orange LATAM.
  const color = useLatam ? '#FF9500' : '#34C759';

  // Faixa de cor da barra (vermelho → laranja → amarelo → verde).
  // Cor sólida muda em "degrau" conforme o pct cresce — visualmente mais
  // claro do que um gradiente contínuo (que ficou poluído).
  let fillTier = 'low';
  if (pct >= 100) fillTier = 'done';
  else if (pct >= 75) fillTier = 'almost';
  else if (pct >= 50) fillTier = 'high';
  else if (pct >= 25) fillTier = 'mid';

  return (
    <div
      className="sidebar-panel perf-card"
      id="performance-card"
      style={{ '--perf-color': color }}
    >
      <div className="perf-top">
        {useLatam ? <span className="perf-region-badge">LATAM</span> : null}
        <span className="perf-title-text">Desempenho hoje</span>
      </div>

      <div className="perf-hero">
        <div className="perf-hero__numbers">
          <span className="perf-hero__num">{today}</span>
          <span className="perf-hero__sep">/</span>
          <span className="perf-hero__meta">{metaNum}</span>
        </div>
        <span className={`perf-hero__pct ${isComplete ? 'is-complete' : ''}`}>
          {isComplete ? (
            <>
              <i className="fa-solid fa-check"></i> Meta
            </>
          ) : (
            `${pct}%`
          )}
        </span>
      </div>

      <div
        className="perf-progress"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da meta diária"
      >
        <div className="perf-progress__track">
          <div
            className={`perf-progress__fill perf-progress__fill--${fillTier} ${isComplete ? 'is-complete' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct > 0 && pct < 100 && (
          <div
            className="perf-progress__puck"
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          />
        )}
        <div
          className={`perf-progress__goal ${isComplete ? 'is-hit' : ''}`}
          aria-hidden="true"
          title="Meta diária"
        />
      </div>

      <div className="perf-footer">
        <div className="perf-stat-block">
          <span className="perf-stat-num">{month}</span>
          <span className="perf-stat-lbl">No mês</span>
        </div>
        <div className="perf-stat-sep"></div>
        <div className="perf-stat-block">
          <span className="perf-stat-num">
            {isComplete ? <i className="fa-solid fa-trophy"></i> : remaining}
          </span>
          <span className="perf-stat-lbl">{isComplete ? 'Meta batida' : 'Faltam'}</span>
        </div>
      </div>
    </div>
  );
}

function toFriendly(raw) {
  if (!raw) return '';
  const first = raw.split(/[-._\s\d]/).find(Boolean) || raw;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function AllocationItem({ alloc, currentUserBr }) {
  const [avatars, setAvatars] = useState([]);
  // Marca avatares cuja URL backend deu sucesso MAS a imagem em si falhou
  // ao carregar (404, CORS, bloqueio). Sem isso, a img quebrada fica num
  // limbo visual (placeholder padrão do navegador). Index pra evitar
  // re-render da lista inteira a cada erro.
  const [imgErrors, setImgErrors] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    setImgErrors(new Set());
    Promise.all((alloc?.responsaveis || []).map((u) => fetchAvatarFromBackend(u.trim())))
      .then((res) => { if (alive) setAvatars(res); });
    return () => { alive = false; };
  }, [alloc]);

  const handleImgError = (idx) => {
    setImgErrors((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  if (!alloc || !alloc.responsaveis?.length) {
    return (
      <div className="alloc-card alloc-card--empty">
        <i className="fa-regular fa-calendar-xmark"></i>
        <span>Nenhuma alocação ativa.</span>
      </div>
    );
  }

  const myLatam = getLatamUsername(currentUserBr);
  const normalize = (n) => (n || '').trim().toLowerCase();
  const isMe = (uClean) =>
    (currentUserBr && normalize(uClean) === normalize(currentUserBr)) ||
    (myLatam && normalize(uClean) === normalize(myLatam));

  return (
    <div className="alloc-card">
      <div className="alloc-card__period">
        <i className="fa-regular fa-calendar"></i>
        <span>{alloc.periodo}</span>
      </div>

      <div className="alloc-card__avatars">
        {alloc.responsaveis.map((u, idx) => {
          const uClean = u.trim();
          const profileUrl = `https://cursos.alura.com.br/user/${uClean}`;
          const avatar = avatars[idx];
          const me = isMe(uClean);
          return (
            <a
              key={`${uClean}-${idx}`}
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
              title={toFriendly(uClean)}
              className={`alloc-card__avatar ${me ? 'is-me' : ''}`}
            >
              {avatar?.success && !imgErrors.has(idx) ? (
                <img
                  src={avatar.url}
                  alt={uClean}
                  onError={() => handleImgError(idx)}
                />
              ) : (
                <span className="alloc-card__avatar-fallback">
                  {toFriendly(uClean).charAt(0) || '?'}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(daysFloat) {
  if (!daysFloat || daysFloat <= 0) return '0min';
  const totalMinutes = Math.round(daysFloat * 24 * 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  if (totalMinutes < 1440) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

const Sidebar = ({ username, displayName, meta, collapsed = false, onToggle }) => {
  const { topics } = useTopics();
  const [statsBr, setStatsBr] = useState({ postsToday: 0, postsMonth: 0 });
  const [statsLatam, setStatsLatam] = useState({ postsToday: 0, postsMonth: 0 });
  const [allocations, setAllocations] = useState({});
  const [hiddenTabs, setHiddenTabs] = useState({});
  const [activeTab, setActiveTab] = useState('sugestoes');
  const [reminder, setReminder] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!username) return;

    const loadStats = async () => {
      try {
        const [br, latam] = await Promise.all([
          fetchUserStats(username),
          fetchLatamStats(username),
        ]);
        setStatsBr(br);
        setStatsLatam(latam);
      } catch (e) {
        console.error('Falha ao buscar stats:', e);
      }
    };
    loadStats();
    const id = setInterval(loadStats, 60000);
    return () => clearInterval(id);
  }, [username]);

  useEffect(() => {
    let alive = true;
    const loadAllocs = async () => {
      const results = {};
      const hidden = {};
      await Promise.all(
        ALLOC_TABS.map(async (tab) => {
          try {
            const rows = await fetchAllocationData(tab.gid);
            const current = findCurrentAllocation(rows);
            results[tab.id] = current || null;
            if (tab.optional && (!current || current.responsaveis.length === 0)) {
              hidden[tab.id] = true;
            }
          } catch {
            results[tab.id] = null;
            if (tab.optional) hidden[tab.id] = true;
          }
        })
      );
      if (alive) {
        setAllocations(results);
        setHiddenTabs(hidden);
      }
    };
    loadAllocs();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const json = await fetchSheetRows(REMINDERS_GID);
        const value = json.table.rows[0]?.c[0]?.v || null;
        if (alive) setReminder(value);
      } catch {
        if (alive) setReminder(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const visibleTabs = useMemo(() => ALLOC_TABS.filter((t) => !hiddenTabs[t.id]), [hiddenTabs]);

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.find((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (visibleTabs.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveTab((current) => {
        const idx = visibleTabs.findIndex((t) => t.id === current);
        const next = visibleTabs[(idx + 1) % visibleTabs.length];
        return next?.id || current;
      });
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [visibleTabs]);

  const overview = useMemo(() => {
    const total = topics.length;
    const claimed = topics.filter((t) => t.isClaimed).length;
    const delayed = topics.filter((t) => t.ageInDays >= 1).length;
    const ages = topics.map((t) => t.ageInDays || 0);
    const maxAge = ages.length ? Math.max(...ages) : 0;
    const avgAge = total > 0 ? ages.reduce((a, b) => a + b, 0) / total : 0;
    return { total, claimed, delayed, maxAge, avgAge };
  }, [topics]);

  // Saúde da fila: faixas de SLA (verde < 24h, amarelo 24-48h, vermelho >= 48h).
  const queueHealth = useMemo(() => {
    let ok = 0;
    let attention = 0;
    let urgent = 0;
    topics.forEach((t) => {
      const age = t.ageInDays || 0;
      if (age >= 2) urgent += 1;
      else if (age >= 1) attention += 1;
      else ok += 1;
    });
    const total = topics.length || 1;
    return {
      ok,
      attention,
      urgent,
      okPct: (ok / total) * 100,
      attentionPct: (attention / total) * 100,
      urgentPct: (urgent / total) * 100,
    };
  }, [topics]);

  const maxColor = overview.maxAge >= 2 ? 'var(--cor-complexo)' : overview.maxAge >= 1 ? 'var(--cor-sla)' : 'inherit';
  const avgColor = overview.avgAge >= 2 ? 'var(--cor-complexo)' : 'inherit';

  const hasLatam = !!getLatamUsername(username);

  // Saudação por horário do dia.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // Prioridade: displayName configurado em Settings → fallback heurístico do username.
  // "armano-junior" → "Armano", "victor.costa" → "Victor", "ana_silva" → "Ana".
  const friendlyName = useMemo(() => {
    const trimmed = (displayName || '').trim();
    if (trimmed) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    if (!username) return '';
    const firstPart = username.split(/[-._\s\d]/).find(Boolean) || username;
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
  }, [displayName, username]);

  const dateLabel = useMemo(() => {
    const raw = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    // pt-BR retorna "qua., 28 de abr." — limpa pontos e capitaliza.
    return raw.replace(/\./g, '').replace(/^./, (c) => c.toUpperCase());
  }, []);

  return (
    <aside id="forum-counter" className={collapsed ? 'is-collapsed' : ''} aria-hidden={collapsed}>
      <div className="sidebar-topbar">
        <div className="sidebar-topbar__greeting">
          <span className="sidebar-topbar__hello">
            {greeting}{friendlyName ? ',' : ''}
          </span>
          {friendlyName ? (
            <span className="sidebar-topbar__name">{friendlyName}</span>
          ) : null}
          <span className="sidebar-topbar__date">{dateLabel}</span>
        </div>
        <button
          type="button"
          className="sidebar-minimize-btn"
          onClick={onToggle}
          aria-label="Minimizar painel"
          title="Minimizar painel"
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <PerformanceCard meta={meta} statsBr={statsBr} statsLatam={statsLatam} hasLatam={hasLatam} />

      <details id="general-overview-container" className="sidebar-panel collapsible-panel" open>
        <summary className="sidebar-panel-header">
          <h3>Resumo da fila</h3>
        </summary>
        <div id="general-overview" className="sidebar-panel-content">
          <div className="pulse-stats">
            <div className="pulse-stat">
              <span className="pulse-stat__num">{overview.total}</span>
              <span className="pulse-stat__lbl">Em aberto</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat__num">{overview.claimed}</span>
              <span className="pulse-stat__lbl">Respondendo</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat__num" style={{ color: avgColor }}>{formatTime(overview.avgAge)}</span>
              <span className="pulse-stat__lbl">Média SLA</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat__num" style={{ color: maxColor }}>{formatTime(overview.maxAge)}</span>
              <span className="pulse-stat__lbl">Maior SLA</span>
            </div>
          </div>

          {topics.length > 0 ? (
            <>
              <div className="pulse-bar-label">
                <span>Distribuição por SLA</span>
                <span className="pulse-bar-label__total">{topics.length} tópicos</span>
              </div>
              <div
                className="pulse-bar"
                role="img"
                aria-label={`${queueHealth.ok} tranquilos, ${queueHealth.attention} em atenção, ${queueHealth.urgent} urgentes`}
              >
                {queueHealth.ok > 0 && (
                  <span
                    className="pulse-bar__seg pulse-bar__seg--ok"
                    style={{ flexBasis: `${queueHealth.okPct}%` }}
                    title={`${queueHealth.ok} tranquilo${queueHealth.ok === 1 ? '' : 's'} · menos de 24h`}
                  >
                    {queueHealth.okPct >= 14 ? queueHealth.ok : ''}
                  </span>
                )}
                {queueHealth.attention > 0 && (
                  <span
                    className="pulse-bar__seg pulse-bar__seg--warn"
                    style={{ flexBasis: `${queueHealth.attentionPct}%` }}
                    title={`${queueHealth.attention} em atenção · 24-48h`}
                  >
                    {queueHealth.attentionPct >= 14 ? queueHealth.attention : ''}
                  </span>
                )}
                {queueHealth.urgent > 0 && (
                  <span
                    className="pulse-bar__seg pulse-bar__seg--urgent"
                    style={{ flexBasis: `${queueHealth.urgentPct}%` }}
                    title={`${queueHealth.urgent} urgente${queueHealth.urgent === 1 ? '' : 's'} · acima de 48h`}
                  >
                    {queueHealth.urgentPct >= 14 ? queueHealth.urgent : ''}
                  </span>
                )}
              </div>
              <div className="pulse-legend">
                <span><i className="pulse-dot pulse-dot--ok" /> &lt;24h</span>
                <span><i className="pulse-dot pulse-dot--warn" /> 24-48h</span>
                <span><i className="pulse-dot pulse-dot--urgent" /> &gt;48h</span>
              </div>
            </>
          ) : (
            <p className="urgent-empty">Sem tópicos abertos.</p>
          )}
        </div>
      </details>

      <details className="sidebar-panel collapsible-panel" open>
        <summary className="sidebar-panel-header">
          <h3>
            <a
              className="alocacao"
              href="https://docs.google.com/spreadsheets/d/1746BtlDdh97YV0CV0s941WezEgkhEJx8geFNPYf2ulk/edit?gid=1812290880#gid=1812290880"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fas fa-users"></i> Alocações da Equipe
            </a>
          </h3>
        </summary>
        <div id="team-allocations-panel" className="sidebar-panel-content allocation-panel">
          <div className="tab-nav">
            {ALLOC_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${hiddenTabs[tab.id] ? 'is-hidden' : ''}`}
                data-tab={tab.id}
                title={tab.title}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {ALLOC_TABS.map((tab) => (
              <div
                key={tab.id}
                id={`${tab.id}-data`}
                className={`tab-pane ${activeTab === tab.id ? 'active' : ''}`}
                data-tab-content={tab.id}
              >
                <AllocationItem alloc={allocations[tab.id]} currentUserBr={username} />
              </div>
            ))}
          </div>
        </div>
      </details>

      {reminder ? (
        <details className="sidebar-panel collapsible-panel">
          <summary className="sidebar-panel-header">
            <h3><i className="fas fa-info-circle"></i> Avisos</h3>
          </summary>
          <div id="reminders-panel" className="sidebar-panel-content">
            <div
              id="reminders-data"
              className="reminders-container"
              dangerouslySetInnerHTML={{ __html: parseMessageToHTML(reminder) }}
            />
          </div>
        </details>
      ) : null}
    </aside>
  );
};

export default Sidebar;
