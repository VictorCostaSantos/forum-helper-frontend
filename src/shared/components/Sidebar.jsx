import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchUserStats,
  fetchLatamStats,
  getLatamUsername,
} from '../../api/apiService';
import { useTopics } from '../context/TopicsContext';
import {
  useAllocationItems,
  useAllocationSummary,
} from '../../features/allocation/useAllocationSummary';
import { useAvatar, useAvatarsMap } from '../avatars/avatarStore';
import {
  addDays,
  formatPeriodCompact,
  isPerennial,
  mondayOf,
  toISODate,
} from '../../features/allocation/dateHelpers';
import {
  getDisplayName,
  isPlaceholder,
} from '../../features/allocation/team';
import { brandFor, brandImageStyle } from '../../features/allocation/activityBrands';

const SHEET_ID = '1746BtlDdh97YV0CV0s941WezEgkhEJx8geFNPYf2ulk';
const REMINDERS_GID = '1463294778';

async function fetchSheetRows(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&_=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erro ao carregar planilha');
  const text = await response.text();
  return JSON.parse(text.substring(47).slice(0, -2));
}

function parseMessageToHTML(message) {
  if (!message) return '';
  let html = message;
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="reminder-image">');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  return `<p>${html}</p>`;
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

/*
  Chips de aviso de alocação no topo do sidebar. Mesma fonte de dados do
  banner do /allocation (useAllocationSummary). Some quando não há vagos
  nem sobrecarregados. Click leva pro painel.
*/
function AllocationAlertChips({ onNavigate }) {
  const summary = useAllocationSummary();
  if (!summary?.loaded || summary.total === 0) return null;
  return (
    <div className="alloc-chips-strip">
      {summary.vagoCount > 0 ? (
        <button
          type="button"
          className="alloc-chip alloc-chip--danger"
          onClick={() => onNavigate('/allocation')}
          title="Plantões vagos esta semana"
        >
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{summary.vagoCount} vago{summary.vagoCount === 1 ? '' : 's'}</span>
        </button>
      ) : null}
      {summary.dangerCount > 0 ? (
        <button
          type="button"
          className="alloc-chip alloc-chip--warn"
          onClick={() => onNavigate('/allocation')}
          title="Pessoas acima do limite saudável"
        >
          <i className="fa-solid fa-bolt"></i>
          <span>
            {summary.dangerCount} sobrecarregad{summary.dangerCount === 1 ? 'o' : 'os'}
          </span>
        </button>
      ) : null}
    </div>
  );
}

function MiniAvatar({ username, size = 18 }) {
  // Lê do store central — sem fetch local, sem prop drilling de URL.
  const url = useAvatar(username);
  return (
    <img
      src={url}
      alt={getDisplayName(username)}
      title={getDisplayName(username)}
      className="alloc-mini-avatar"
      style={{ width: size, height: size }}
    />
  );
}

/*
  Helper: filtra items pelas estações com currentShift nesta semana, opcionalmente
  com filterFn (ex: só do user). Retorna stations já agrupadas por nome.
*/
function useWeekStations(items, filterFn) {
  return useMemo(() => {
    const monday = mondayOf(new Date());
    const wkStart = toISODate(monday);
    const wkEnd   = toISODate(addDays(monday, 4));
    const byKey = new Map();
    for (const a of items) {
      if (!a?.nome) continue;
      const di = String(a?.data_inicio || '').slice(0, 10);
      const df = String(a?.data_fim || '').slice(0, 10);
      if (!di || !df || di > wkEnd || df < wkStart) continue;
      if (filterFn && !filterFn(a)) continue;
      const key = String(a.nome).trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: key,
          name: a.nome,
          activity: a,
          responsaveis: Array.isArray(a.responsaveis) ? a.responsaveis : [],
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filterFn]);
}

/*
  Carrossel ultra-compacto — 1 atividade visível por vez numa viewport de
  52px. Track desliza verticalmente entre items com easing bouncy.

  - Auto-rotate a cada AUTO_ROTATE_MS (pausado no hover).
  - Click em qualquer ponto do viewport pula pra próxima + reseta o timer.
  - Barra de progresso visual no footer mostra tempo até a próxima.
  - Counter "X / N" no footer.
  - Botão "abrir painel" leva pra /allocation.
*/
const AUTO_ROTATE_MS = 3500;

function AllocationCarousel({ stations, onNavigate, peerFilter, emptyLabel }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (active >= stations.length && stations.length > 0) setActive(0);
  }, [stations.length, active]);

  useEffect(() => {
    if (stations.length <= 1 || paused) return undefined;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % stations.length);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [stations.length, paused, active]);

  if (stations.length === 0) {
    return <p className="urgent-empty">{emptyLabel || 'Nada por aqui.'}</p>;
  }

  const advance = () => {
    setActive((i) => (i + 1) % stations.length);
  };

  return (
    <div
      className="alloc-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="alloc-carousel__viewport"
        onClick={advance}
        role="button"
        tabIndex={0}
        aria-label="Pular pra próxima atividade"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            advance();
          }
        }}
      >
        <div
          className="alloc-carousel__track"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {stations.map((st) => {
            const brand = brandFor(st.name);
            const realPeers = (st.responsaveis || [])
              .filter((u) => !isPlaceholder(u))
              .filter((u) => (peerFilter ? peerFilter(u) : true));
            const isVago = (st.responsaveis || []).filter((u) => !isPlaceholder(u)).length === 0;
            const period = isPerennial(st.activity) ? 'Fixo' : formatPeriodCompact(st.activity);
            // Mesmo visual do ícone no painel principal: gradient da brand
            // + imagem (com imageWhite quando aplicável). Sem shadow pesada.
            const iconBg = brand.gradient
              || (brand.solidBg
                ? `linear-gradient(135deg, ${brand.color}, ${brand.color}D8)`
                : `linear-gradient(160deg, ${brand.color}26, ${brand.color}0A)`);
            return (
              <div key={st.id} className="alloc-carousel__item">
                <div className="alloc-carousel__item-left">
                  <span
                    className="alloc-carousel__item-icon"
                    style={{ background: iconBg, color: brand.color }}
                    aria-hidden="true"
                  >
                    {brand.image ? (
                      <img
                        src={brand.image}
                        alt=""
                        className="alloc-carousel__item-icon-img"
                        style={brandImageStyle(brand)}
                      />
                    ) : (
                      <i className={brand.icon || 'fa-solid fa-circle-dot'}></i>
                    )}
                  </span>
                  <div className="alloc-carousel__item-texts">
                    <span className="alloc-carousel__item-name">{st.name}</span>
                    <span className="alloc-carousel__item-date">
                      <i className="fa-regular fa-calendar"></i>
                      {period}
                    </span>
                  </div>
                </div>
                <div className="alloc-carousel__item-right">
                  {isVago ? (
                    <span className="alloc-mini-item__tag">vago</span>
                  ) : realPeers.length === 0 ? (
                    <span className="alloc-carousel__solo">só você</span>
                  ) : (
                    <div className="alloc-carousel__peers">
                      {realPeers.slice(0, 3).map((u) => (
                        <MiniAvatar key={u} username={u} size={24} />
                      ))}
                      {realPeers.length > 3 ? (
                        <span className="alloc-mini-avatar alloc-mini-avatar--more">
                          +{realPeers.length - 3}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

const ALLOC_SEGMENTS = [
  { id: 'meus',   label: 'Meus',    icon: 'fa-solid fa-user-check',     emptyLabel: 'Você não está alocado em nada essa semana.' },
  { id: 'equipe', label: 'Equipe',  icon: 'fa-solid fa-people-group',  emptyLabel: 'Sem atividades essa semana.' },
  { id: 'fixas',  label: 'Fixas',   icon: 'fa-solid fa-thumbtack',      emptyLabel: 'Sem atividades fixas.' },
];

/*
  Painel único de alocações no sidebar. Substitui os dois <details> antigos
  (Meus plantões + Alocações da Equipe). Segmented control de 3 botões em
  cima (Equipe / Meus / Fixas) troca qual carrossel é exibido embaixo.
  Visual premium: tabs internas do carrossel sem underline arredondado, só
  destaque por cor da brand na ativa.
*/
function AllocationsPanel({ username, items, onNavigate }) {
  // Default 'meus' — Victor pediu inversão: o que ME diz respeito primeiro,
  // depois o que a equipe está fazendo, depois fixos.
  const [segment, setSegment] = useState('meus');

  const filterMine = useMemo(() => (
    (a) => Array.isArray(a?.responsaveis) && a.responsaveis.includes(username)
  ), [username]);
  const filterFixas = useMemo(() => (a) => isPerennial(a), []);
  const peerFilter = useMemo(() => (u) => u !== username, [username]);

  const equipeStations = useWeekStations(items);
  const myStations     = useWeekStations(items, filterMine);
  const fixasStations  = useWeekStations(items, filterFixas);

  const segmentData = {
    equipe: { stations: equipeStations, peerFilter: undefined },
    meus:   { stations: myStations,     peerFilter },
    fixas:  { stations: fixasStations,  peerFilter: undefined },
  };

  const active = segmentData[segment];
  const segmentMeta = ALLOC_SEGMENTS.find((s) => s.id === segment);

  return (
    <details className="sidebar-panel collapsible-panel" open>
      <summary className="sidebar-panel-header">
        <h3>
          <button
            type="button"
            className="sidebar-panel-header__link"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onNavigate('/allocation'); }}
            title="Abrir painel completo"
          >
            <i className="fa-solid fa-people-group"></i> Alocações
            <i className="fa-solid fa-up-right-from-square sidebar-panel-header__link-icon"></i>
          </button>
        </h3>
      </summary>
      <div className="sidebar-panel-content">
        <div className="alloc-segmented" role="tablist" aria-label="Filtro de alocações">
          {ALLOC_SEGMENTS.map((seg) => {
            const count = segmentData[seg.id].stations.length;
            const disabled = seg.id === 'meus' && !username;
            return (
              <button
                key={seg.id}
                type="button"
                className={`alloc-segmented__btn ${segment === seg.id ? 'is-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSegment(seg.id); }}
                disabled={disabled}
                role="tab"
                aria-selected={segment === seg.id}
              >
                <i className={seg.icon}></i>
                <span>{seg.label}</span>
                {count > 0 ? <span className="alloc-segmented__count">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <AllocationCarousel
          stations={active.stations}
          onNavigate={onNavigate}
          peerFilter={active.peerFilter}
          emptyLabel={segmentMeta?.emptyLabel}
        />
      </div>
    </details>
  );
}

const Sidebar = ({ username, displayName, meta, collapsed = false, onToggle }) => {
  const { topics } = useTopics();
  const navigate = useNavigate();
  const [statsBr, setStatsBr] = useState({ postsToday: 0, postsMonth: 0 });
  const [statsLatam, setStatsLatam] = useState({ postsToday: 0, postsMonth: 0 });
  const [reminder, setReminder] = useState(null);

  // Items vêm do mesmo cache compartilhado com o sino e o /allocation.
  // Avatares ficam no `avatarStore` central — cada <MiniAvatar /> lê de lá
  // direto, sem prop drilling.
  const allocItems  = useAllocationItems();

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

      <AllocationsPanel
        username={username}
        items={allocItems}
        onNavigate={navigate}
      />

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
