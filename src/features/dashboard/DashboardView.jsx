import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Title,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ptBR } from 'date-fns/locale';

import { fetchDashboardStats, fetchAvatarFromBackend, fetchMemberTopicsByRegion } from '../../api/apiService';
import {
  TEAM_MEMBERS,
  PRESETS,
  METRICS,
  METRICS_LATAM,
  SCHOOL_COLORS,
  PALETTE,
  HIGHLIGHT_COLOR,
  buildDisplayNameMap,
  formatName,
  formatYMD,
  getPresetRange,
  getThemeColors,
  getUserMetricValue,
  orderAndAnonymize,
  isManager as checkManager,
} from './helpers';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Title,
  Filler
);

// Plugin: desenha o avatar do próprio usuário sobre a barra dele.
// Usar plugin (não overlay HTML) garante que o avatar nunca se desloca em relação à barra.
const drawSelfAvatar = {
  id: 'drawSelfAvatar',
  afterDatasetsDraw(chart) {
    const opts = chart.config.options.plugins?.drawSelfAvatar;
    if (!opts || opts.index < 0) return;
    const img = opts.imageRef?.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const bar = chart.getDatasetMeta(0)?.data?.[opts.index];
    if (!bar) return;
    const { ctx, chartArea } = chart;
    const size = 36;
    const cx = chartArea.left - size / 2 - 8;
    const cy = bar.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try { ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size); } catch (_) { /* CORS — ignora */ }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 1.5, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#06b9a1';
    ctx.stroke();
  },
};

// Plugin: número inline na ponta da barra (dentro se couber, fora caso contrário).
// Texto branco sólido com sombra escura sutil para legibilidade contra qualquer cor de barra.
const inlineLabels = {
  id: 'inlineLabels',
  afterDatasetsDraw(chart) {
    const opts = chart.config.options.plugins?.inlineLabels;
    if (!opts || !opts.enabled) return;
    const suffix = opts.suffix || '';
    const textColor = opts.textColor || '#333';
    const ds = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    const { ctx, chartArea } = chart;

    ctx.save();
    ctx.font = '700 13px Roboto, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    meta.data.forEach((bar, i) => {
      const value = ds.data[i];
      if (value == null) return;
      const text = `${value}${suffix}`;
      const textW = ctx.measureText(text).width;
      const barWidth = bar.x - chartArea.left;
      const big = barWidth > textW + 14;
      const x = big ? bar.x - 8 : bar.x + 6;
      ctx.textAlign = big ? 'right' : 'left';

      if (big) {
        // Dentro da barra: branco com sombra escura.
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#FFFFFF';
      } else {
        // Fora da barra: cor do tema, sem sombra.
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = textColor;
      }
      ctx.fillText(text, x, bar.y);
    });
    ctx.restore();
  },
};

Chart.register(drawSelfAvatar, inlineLabels);

function KpiCard({ icon, label, value, color }) {
  return (
    <div className="kpi-card" style={{ '--accent': color }}>
      <div className="kpi-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="kpi-meta">
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
      </div>
    </div>
  );
}

function DashboardView({ username = '' }) {
  const isMgr = checkManager(username);
  const me = (username || '').trim().toLowerCase();

  const initial = getPresetRange('week');
  const [startDate, setStartDate] = useState(formatYMD(initial.start));
  const [endDate, setEndDate] = useState(formatYMD(initial.end));
  const [activePreset, setActivePreset] = useState('week');
  const [data, setData] = useState({ summary: {}, users: [] });
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState('team'); // 'team' | 'individual'
  const [metric, setMetric] = useState('responses');
  const [modalUser, setModalUser] = useState(null);
  const [region, setRegion] = useState('BR'); // 'BR' | 'LATAM'
  const [memberTopics, setMemberTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const teamCanvasRef = useRef(null);
  const schoolCanvasRef = useRef(null);
  const modalDailyCanvasRef = useRef(null);
  const modalSchoolsCanvasRef = useRef(null);

  const teamChartRef = useRef(null);
  const schoolChartRef = useRef(null);
  const modalDailyChartRef = useRef(null);
  const modalSchoolsChartRef = useRef(null);

  // Avatar do próprio usuário — pré-carregado e renderizado pelo plugin do Chart.js.
  const myAvatarImgRef = useRef(null);
  useEffect(() => {
    if (!username) return undefined;
    let alive = true;
    fetchAvatarFromBackend(username).then((res) => {
      if (!alive || !res.success) return;
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        myAvatarImgRef.current = img;
        teamChartRef.current?.update('none');
      };
      img.src = res.url;
    });
    return () => { alive = false; };
  }, [username]);

  // Garantia: se o usuário não é gestor, modal nunca abre.
  useEffect(() => {
    if (!isMgr) setModalUser(null);
  }, [isMgr]);

  const loadDashboard = async (s = startDate, e = endDate) => {
    setLoading(true);
    try {
      const result = await fetchDashboardStats(s, e, TEAM_MEMBERS.join(','));
      setData(result || { summary: {}, users: [] });
    } catch (err) {
      console.error('Erro dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega dados de tópicos por membro conforme a região
  const loadMemberTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const topics = await fetchMemberTopicsByRegion(region);
      setMemberTopics(topics || []);
    } catch (err) {
      console.error(`Erro ao carregar tópicos (${region}):`, err);
      setMemberTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  }, [region]);

  // Carrega tópicos quando a região muda
  useEffect(() => {
    loadMemberTopics();
  }, [loadMemberTopics]);

  useEffect(() => {
    loadDashboard();
    return () => {
      teamChartRef.current?.destroy();
      schoolChartRef.current?.destroy();
      modalDailyChartRef.current?.destroy();
      modalSchoolsChartRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreset = (preset) => {
    const range = getPresetRange(preset);
    const s = formatYMD(range.start);
    const e = formatYMD(range.end);
    setStartDate(s);
    setEndDate(e);
    setActivePreset(preset);
    loadDashboard(s, e);
  };

  // Ordem-base estável: gestor vê ordenado por respostas; demais veem embaralhado.
  // Recomputa só quando os dados mudam — trocar de métrica não reembaralha (evita "salto").
  const { ordered: orderedUsers, displayNames } = useMemo(
    () => orderAndAnonymize(data.users || [], (u) => u.totalResponses || 0, isMgr, me),
    [data.users, isMgr, me]
  );

  // Mesma lógica pro gráfico LATAM (dados do BI, não do dashboard-stats).
  const { ordered: orderedLatamMembers, displayNames: latamDisplayNames } = useMemo(
    () => orderAndAnonymize(memberTopics, (u) => u.totalTopics || 0, isMgr, me),
    [memberTopics, isMgr, me]
  );

  // LATAM não tem série diária (o BI só dá totais agregados) — força pro modo Individual.
  useEffect(() => {
    if (region === 'LATAM' && chartView === 'team') setChartView('individual');
  }, [region, chartView]);

  // Ao trocar de região, garante que a métrica selecionada existe no novo conjunto.
  useEffect(() => {
    const list = region === 'LATAM' ? METRICS_LATAM : METRICS;
    if (!list.some((m) => m.key === metric)) setMetric(list[0].key);
  }, [region, metric]);

  // KPIs
  const kpis = useMemo(() => {
    const summary = data.summary || {};
    const users = Array.isArray(data.users) ? data.users : [];
    const activeMembers = users.filter((u) => u.totalResponses > 0).length;
    const avgPerMember = activeMembers > 0
      ? (summary.totalResponses / activeMembers).toFixed(1)
      : '0';
    const avgSla = summary.avgSlaMinutes
      ? `${(summary.avgSlaMinutes / 60).toFixed(1)}h`
      : '0h';

    let bestDay = '—';
    if (summary.responsesByDate) {
      const entries = Object.entries(summary.responsesByDate);
      if (entries.length > 0) {
        const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
        const [, mDate, dDate] = (top[0].split(' ')[0] || '').split('-');
        bestDay = `${dDate}/${mDate} (${top[1]})`;
      }
    }

    // KPI personal: minhas respostas no período
    const myStats = users.find((u) => u.username === me);
    const myResponses = myStats?.totalResponses || 0;

    return [
      { key: 'responses', label: 'Total Respostas', value: summary.totalResponses || 0, icon: 'fa-comments', color: '#00C86F' },
      { key: 'solutions', label: 'Soluções', value: summary.totalSolutions || 0, icon: 'fa-check-circle', color: '#28a745' },
      { key: 'avgSla', label: 'SLA Médio', value: avgSla, icon: 'fa-stopwatch', color: '#ffc107' },
      { key: 'active', label: 'Ativos', value: `${activeMembers}/${TEAM_MEMBERS.length}`, icon: 'fa-users', color: '#17a2b8' },
      { key: 'avg', label: 'Média/Membro', value: avgPerMember, icon: 'fa-paper-plane', color: '#6610f2' },
      { key: 'mine', label: 'Minhas Respostas', value: myResponses, icon: 'fa-user-check', color: HIGHLIGHT_COLOR },
      { key: 'peak', label: 'Pico', value: bestDay, icon: 'fa-calendar-day', color: '#fd7e14' },
    ];
  }, [data, me]);

  const totalSchools = useMemo(() => {
    const teamSchools = {};
    (data.users || []).forEach((user) => {
      if (user.schools) {
        Object.entries(user.schools).forEach(([k, v]) => {
          teamSchools[k] = (teamSchools[k] || 0) + v;
        });
      }
    });
    return Object.values(teamSchools).reduce((a, b) => a + b, 0);
  }, [data]);

  // Volume de Contribuições (por dia / por membro)
  useEffect(() => {
    if (!teamCanvasRef.current) return;
    teamChartRef.current?.destroy();
    teamChartRef.current = null;
    const theme = getThemeColors();

    if (chartView === 'team' && region === 'BR') {
      const respByDate = data.summary?.responsesByDate || {};
      const groupedByDay = {};
      Object.keys(respByDate).forEach((full) => {
        const dayKey = full.split(' ')[0];
        groupedByDay[dayKey] = (groupedByDay[dayKey] || 0) + respByDate[full];
      });
      const dates = Object.keys(groupedByDay).sort();
      if (dates.length === 0) return;
      const chartData = dates.map((d) => ({ x: d, y: groupedByDay[d] }));
      const unit = dates.length > 60 ? 'week' : 'day';

      teamChartRef.current = new Chart(teamCanvasRef.current, {
        type: 'bar',
        data: {
          datasets: [{
            label: 'Respostas',
            data: chartData,
            backgroundColor: '#00c86f',
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.85,
            maxBarThickness: 50,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              adapters: { date: { locale: ptBR } },
              time: {
                unit,
                tooltipFormat: 'dd/MM/yyyy',
                displayFormats: {
                  day: 'dd MMM',
                  week: 'dd MMM',
                  month: 'MMM yyyy',
                },
              },
              ticks: { color: theme.text },
              grid: { display: false },
              border: { display: true, color: theme.border, width: 1 },
              offset: true,
            },
            y: {
              beginAtZero: true,
              ticks: { color: theme.text, precision: 0 },
              grid: { display: true, color: theme.grid, drawTicks: false, lineWidth: 1 },
              border: { display: false },
            },
          },
          plugins: { legend: { display: false } },
        },
      });
      return;
    }

    // Individual — usa a métrica selecionada. LATAM lê direto do BI (fetchMemberTopicsByRegion),
    // que já vem ordenado/anonimizado por orderAndAnonymize; BR usa dashboard-stats.
    const isLatam = region === 'LATAM';
    const metricsList = isLatam ? METRICS_LATAM : METRICS;
    const metricCfg = metricsList.find((m) => m.key === metric) || metricsList[0];

    const items = isLatam
      ? orderedLatamMembers.map((u) => ({ user: u, value: u[metricCfg.key] || 0 }))
      : (() => {
          const baseItems = orderedUsers.map((u) => ({ user: u, value: getUserMetricValue(u, metric) }));
          return isMgr
            ? [...baseItems].sort((a, b) => (metric === 'sla' ? a.value - b.value : b.value - a.value))
            : baseItems;
        })();

    const namesMap = isLatam ? latamDisplayNames : displayNames;
    const labels = items.map((r) => namesMap[r.user.username] || formatName(r.user.username));
    const totals = items.map((r) => r.value);
    const colors = items.map((_, i) => PALETTE[i % PALETTE.length]);
    const myIndex = items.findIndex((r) => r.user.username === me);

    teamChartRef.current = new Chart(teamCanvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: totals,
          backgroundColor: colors,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
          maxBarThickness: 30,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { left: 50 } }, // espaço para o avatar à esquerda do eixo
        scales: {
          x: {
            beginAtZero: true,
            ticks: { display: false },
            // Grid vertical sutil para dar referência visual em ambos os temas.
            grid: { display: true, color: theme.grid, drawTicks: false, lineWidth: 1 },
            border: { display: false },
          },
          y: {
            ticks: {
              color: theme.text,
              font: { size: 12, weight: 'bold' },
              callback(val) {
                const r = items[val];
                if (r && r.user.username === me) return '';
                return this.getLabelForValue(val);
              },
            },
            grid: { display: false },
            // Linha de base à esquerda — onde os bars começam.
            border: { display: true, color: theme.border, width: 1 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          drawSelfAvatar: { index: myIndex, imageRef: myAvatarImgRef },
          inlineLabels: {
            enabled: true,
            suffix: metricCfg.suffix,
            textColor: theme.text,
          },
        },
        onClick: isMgr && !isLatam
          ? (_e, els) => {
              if (!els.length) return;
              const idx = els[0].index;
              const u = items[idx]?.user;
              if (u) setModalUser(u);
            }
          : undefined,
        onHover: (event, els) => {
          const target = event.native?.target;
          if (target) target.style.cursor = isMgr && !isLatam && els.length ? 'pointer' : 'default';
        },
      },
    });
  }, [orderedUsers, orderedLatamMembers, chartView, metric, region, displayNames, latamDisplayNames, isMgr, me]);

  // Distribuição por Escola
  useEffect(() => {
    if (!schoolCanvasRef.current) return;
    schoolChartRef.current?.destroy();
    schoolChartRef.current = null;
    const theme = getThemeColors();

    const teamSchools = {};
    (data.users || []).forEach((user) => {
      if (user.schools) {
        Object.entries(user.schools).forEach(([escola, count]) => {
          teamSchools[escola] = (teamSchools[escola] || 0) + count;
        });
      }
    });
    const entries = Object.entries(teamSchools).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    schoolChartRef.current = new Chart(schoolCanvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Respostas',
          data: values,
          backgroundColor: (ctx) => SCHOOL_COLORS[labels[ctx.dataIndex]] || SCHOOL_COLORS['Outros'],
          borderRadius: 6,
          barPercentage: 0.75,
          categoryPercentage: 0.8,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.raw} tópicos` } },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { display: true, color: theme.grid, drawTicks: false, lineWidth: 1 },
            border: { display: false },
            ticks: { color: theme.text },
          },
          y: {
            grid: { display: false },
            border: { display: true, color: theme.border, width: 1 },
            ticks: { color: theme.text, font: { size: 12, weight: 'bold' } },
          },
        },
      },
    });
  }, [data]);

  // Extrai a série diária do usuário do modal — tenta vários campos possíveis da API.
  const modalDaily = useMemo(() => {
    if (!modalUser) return [];
    const raw = modalUser.responsesByDate
      || modalUser.dailyResponses
      || modalUser.daily_counts
      || modalUser.dailyCounts
      || {};
    const grouped = {};
    Object.keys(raw).forEach((full) => {
      const day = full.split(' ')[0];
      grouped[day] = (grouped[day] || 0) + (Number(raw[full]) || 0);
    });
    return Object.keys(grouped).sort().map((d) => ({ x: d, y: grouped[d] }));
  }, [modalUser]);

  // Modal — chart de atividade diária (line) quando a API trouxer dado.
  useEffect(() => {
    if (!modalUser || !modalDailyCanvasRef.current) return;
    modalDailyChartRef.current?.destroy();
    modalDailyChartRef.current = null;
    if (modalDaily.length === 0) return;
    const theme = getThemeColors();
    const unit = modalDaily.length > 60 ? 'week' : 'day';

    modalDailyChartRef.current = new Chart(modalDailyCanvasRef.current, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Respostas',
          data: modalDaily,
          borderColor: HIGHLIGHT_COLOR,
          backgroundColor: 'rgba(6, 185, 161, 0.18)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: HIGHLIGHT_COLOR,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: 'time',
            adapters: { date: { locale: ptBR } },
            time: { unit, tooltipFormat: 'dd/MM/yyyy', displayFormats: { day: 'dd MMM', week: 'dd MMM', month: 'MMM yyyy' } },
            ticks: { color: theme.text },
            grid: { display: false },
            border: { display: true, color: theme.border, width: 1 },
          },
          y: {
            beginAtZero: true,
            ticks: { color: theme.text, precision: 0 },
            grid: { display: true, color: theme.grid, drawTicks: false, lineWidth: 1 },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.raw.y ?? c.raw} respostas` } },
        },
      },
    });

    return () => {
      modalDailyChartRef.current?.destroy();
      modalDailyChartRef.current = null;
    };
  }, [modalUser, modalDaily]);

  // Modal — distribuição por escola (bar horizontal).
  useEffect(() => {
    if (!modalUser || !modalSchoolsCanvasRef.current) return;
    modalSchoolsChartRef.current?.destroy();
    modalSchoolsChartRef.current = null;
    const theme = getThemeColors();

    const schools = modalUser.schools || {};
    const entries = Object.entries(schools).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return;

    const labels = entries.map(([name]) => name);
    const values = entries.map(([, v]) => v);

    modalSchoolsChartRef.current = new Chart(modalSchoolsCanvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: (ctx) => SCHOOL_COLORS[labels[ctx.dataIndex]] || SCHOOL_COLORS['Outros'],
          borderRadius: 6,
          barPercentage: 0.75,
          categoryPercentage: 0.85,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: { display: false },
            grid: { display: true, color: theme.grid, drawTicks: false, lineWidth: 1 },
            border: { display: false },
          },
          y: {
            ticks: { color: theme.text, font: { size: 12, weight: 'bold' } },
            grid: { display: false },
            border: { display: true, color: theme.border, width: 1 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.raw} respostas` } },
          inlineLabels: { enabled: true, suffix: '', textColor: theme.text },
        },
      },
    });

    return () => {
      modalSchoolsChartRef.current?.destroy();
      modalSchoolsChartRef.current = null;
    };
  }, [modalUser]);

  const closeModal = () => setModalUser(null);

  const currentMetricsList = region === 'LATAM' ? METRICS_LATAM : METRICS;
  const currentMetric = currentMetricsList.find((m) => m.key === metric) || currentMetricsList[0];

  return (
    <div id="dashboard-view" className="view-container active dashboard-modern">
      <main>
        {/* Filtros */}
        <section className="dash-filters dash-section">
          <div className="preset-group">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`preset-btn ${activePreset === preset.key ? 'active-preset' : ''}`}
                onClick={() => handlePreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }}
            />
            <span className="sep">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }}
            />
            <button className="filter-apply" onClick={() => loadDashboard()}>
              <i className="fas fa-filter"></i>
              <span>Aplicar</span>
            </button>
          </div>
        </section>


        {loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: 60, color: 'var(--light-text-color)' }}>
            <i className="fas fa-spinner fa-spin"></i> Carregando dashboard...
          </div>
        ) : (
          <>
            {/* KPIs */}
            <section className="kpi-grid dash-section">
              {kpis.map((k) => (
                <KpiCard key={k.key} icon={k.icon} label={k.label} value={k.value} color={k.color} />
              ))}
            </section>

            {/* Volume de Contribuições — Equipe (timeline) ou Individual (ranking + avatar) */}
            <section className="panel dash-section">
              <div className="panel-header panel-header--separated">
                <div className="header-info">
                  <h3 className="panel-title">
                    <i className="fas fa-chart-column" style={{ color: '#00C86F' }}></i>
                    Volume de Contribuições
                  </h3>
                  <p className="panel-subtitle">
                    {chartView === 'team'
                      ? 'Toda a equipe ao longo do período selecionado'
                      : isMgr
                        ? region === 'LATAM'
                          ? `${currentMetric.label} por membro (LATAM)`
                          : `${currentMetric.label} por membro — clique numa barra para ver detalhes`
                        : `${currentMetric.label} — sua posição na equipe (demais membros anonimizados)`}
                  </p>
                </div>
                <div className="header-controls">
                  <div className="pill-toggle">
                    <button
                      type="button"
                      className={region === 'BR' ? 'active' : ''}
                      onClick={() => setRegion('BR')}
                    >
                      <i className="fas fa-globe"></i> Brasil
                    </button>
                    <button
                      type="button"
                      className={region === 'LATAM' ? 'active' : ''}
                      onClick={() => setRegion('LATAM')}
                    >
                      <i className="fas fa-globe"></i> Latam
                    </button>
                  </div>
                  <div className="pill-toggle">
                    {region === 'BR' ? (
                      <button
                        type="button"
                        className={chartView === 'team' ? 'active' : ''}
                        onClick={() => setChartView('team')}
                      >
                        <i className="fas fa-users"></i> Equipe
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={chartView === 'individual' ? 'active' : ''}
                      onClick={() => setChartView('individual')}
                    >
                      <i className="fas fa-user"></i> Individual
                    </button>
                  </div>
                  {chartView === 'individual' ? (
                    <div className="pill-toggle">
                      {currentMetricsList.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className={metric === m.key ? 'active' : ''}
                          onClick={() => setMetric(m.key)}
                          title={m.label}
                        >
                          <i className={`fas ${m.icon}`}></i> <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {region === 'LATAM' && loadingTopics ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--light-text-color)' }}>
                  <i className="fas fa-spinner fa-spin"></i> Carregando dados da LATAM...
                </div>
              ) : (
                <div className="chart-canvas tall">
                  <canvas
                    key={`${region}-${chartView}-${metric}`}
                    ref={teamCanvasRef}
                  ></canvas>
                </div>
              )}
            </section>

            {/* Distribuição por Escola — full width, agregado da equipe */}
            <section className="panel dash-section">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">
                    <i className="fas fa-school" style={{ color: '#6BD1FF' }}></i>
                    Distribuição por Escola
                  </h3>
                  <p className="panel-subtitle">Onde a equipe está concentrando os esforços</p>
                </div>
                <span className="panel-badge">Total: {totalSchools}</span>
              </div>
              <div className="chart-canvas">
                <canvas ref={schoolCanvasRef}></canvas>
              </div>
            </section>

          </>
        )}
      </main>

      {isMgr && modalUser ? (
        <div
          className="dashboard-modern-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="dashboard-modern-modal">
            <div className="dashboard-modern-modal-header">
              <h3>
                <i className="fas fa-chart-line" style={{ marginRight: 8, color: HIGHLIGHT_COLOR }}></i>
                {formatName(modalUser.username)}
              </h3>
              <button className="close" onClick={closeModal} title="Fechar">×</button>
            </div>
            <div className="dashboard-modern-modal-body">
              <div className="dashboard-modern-modal-summary">
                <div className="item">
                  <p className="v">{modalUser.totalResponses || 0}</p>
                  <p className="l">Respostas</p>
                </div>
                <div className="item">
                  <p className="v">{modalUser.totalSolutions || 0}</p>
                  <p className="l">Soluções</p>
                </div>
                <div className="item">
                  <p className="v">
                    {modalUser.totalResponses
                      ? `${((modalUser.totalSolutions || 0) / modalUser.totalResponses * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                  <p className="l">Taxa de Solução</p>
                </div>
                <div className="item">
                  <p className="v">{Object.keys(modalUser.schools || {}).length}</p>
                  <p className="l">Escolas</p>
                </div>
              </div>
              {modalDaily.length > 0 ? (
                <>
                  <h4 style={{ margin: '8px 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>
                    <i className="fas fa-chart-line" style={{ marginRight: 8, color: HIGHLIGHT_COLOR }}></i>
                    Atividade ao longo do período
                  </h4>
                  <div style={{ height: 220, marginBottom: 18 }}>
                    <canvas ref={modalDailyCanvasRef}></canvas>
                  </div>
                </>
              ) : null}

              <h4 style={{ margin: '8px 0 12px', fontSize: '0.95rem', fontWeight: 700 }}>
                <i className="fas fa-school" style={{ marginRight: 8, color: '#6BD1FF' }}></i>
                Distribuição por Escola
              </h4>
              <div style={{ height: 280 }}>
                <canvas ref={modalSchoolsCanvasRef}></canvas>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DashboardView;
