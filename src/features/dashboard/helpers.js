// Constantes e funções puras do dashboard.

export const TEAM_MEMBERS = [
  'monalisa-silva1',
  'victos-costa',
  'nathqueiroz',
  'rafaela-petelin-silverio',
  'lorena-garcia',
  'armano-junior',
  'mikedesousa80',
  'udanielnogueira',
  'vascoginde',
];

export const MANAGERS = ['vascoginde', 'victos-costa'];

export const NAME_MAP = {
  'victos-costa': 'Victor Costa',
  'vascoginde': 'Vasco Ginde',
  'armano-junior': 'Armano Junior',
  'monalisa-silva1': 'Monalisa Silva',
  'nathqueiroz': 'Nathalia Queiroz',
  'rafaela-petelin-silverio': 'Rafaela Petelin',
  'lorena-garcia': 'Lorena Garcia',
  'mikedesousa80': 'Mike de Sousa',
  'udanielnogueira': 'Daniel Nogueira',
};

export function formatName(user) {
  if (NAME_MAP[user]) return NAME_MAP[user];
  return (user || '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function isManager(username) {
  return MANAGERS.includes((username || '').trim().toLowerCase());
}

export const PRESETS = [
  { key: 'yesterday', label: 'Ontem' },
  { key: 'week', label: 'Esta Semana' },
  { key: 'month', label: 'Este Mês' },
  { key: 'lastMonth', label: 'Último Mês' },
  { key: 'quarter', label: 'Este Trimestre' },
];

// Chaves batem com o texto cru que a API de escolas manda (já reflete o
// rebranding do fórum). Mantém os nomes antigos também, de forma
// defensiva, caso algum dado antigo em cache ainda use a nomenclatura
// anterior.
export const SCHOOL_COLORS = {
  'Back-end': '#8a63e6',
  'Programação': '#8a63e6',
  'Front-end': '#e07a3f',
  'Dados': '#e14b5a',
  'Data Science': '#e14b5a',
  DevOps: '#d6d34a',
  'UX & Design': '#4a90e2',
  Mobile: '#209d92',
  'Gestão & Negócios': '#819ec3',
  'Inovação & Gestão': '#819ec3',
  'Inteligência Artificial': '#4fb3d9',
  Cloud: '#89f336',
  'Cibersegurança': '#898989',
  Outros: '#495057',
};

export const PALETTE = [
  '#00C86F', '#6BD1FF', '#9CD33B', '#F16165',
  '#DC6EBE', '#FFBA05', '#FF8C2A', '#7B71FF',
  '#2A7AE4', '#06B9A1',
];

export const METRICS = [
  { key: 'responses', label: 'Respostas', icon: 'fa-comments', suffix: '', color: '#00C86F' },
  { key: 'solutions', label: 'Soluções', icon: 'fa-check-circle', suffix: '', color: '#28a745' },
  { key: 'rate', label: 'Taxa de Solução', icon: 'fa-percent', suffix: '%', color: '#7B71FF' },
];

// Métricas do gráfico individual quando a região LATAM está selecionada —
// vêm do BI (fetchMemberTopicsByRegion), não do dashboard-stats.
export const METRICS_LATAM = [
  { key: 'totalTopics', label: 'Tópicos', icon: 'fa-list-check', suffix: '', color: '#9CD33B' },
  { key: 'openTopics', label: 'Abertos', icon: 'fa-envelope-open-text', suffix: '', color: '#ffc107' },
  { key: 'closedTopics', label: 'Fechados', icon: 'fa-envelope', suffix: '', color: '#6BD1FF' },
  { key: 'rate', label: 'Taxa de Solução', icon: 'fa-percent', suffix: '%', color: '#7B71FF' },
];

export const HIGHLIGHT_COLOR = '#06B9A1';
export const ANON_COLOR_LIGHT = 'rgba(123, 113, 255, 0.45)';
export const ANON_COLOR_DARK = 'rgba(170, 145, 255, 0.5)';

export function getThemeColors() {
  const isDark = document.body.classList.contains('dark-mode');
  return {
    isDark,
    text: isDark ? '#FFFFFF' : '#333333',
    // Cor neutra que aparece com sutileza tanto no claro quanto no escuro.
    grid: 'rgba(127, 127, 127, 0.32)',
    border: 'rgba(127, 127, 127, 0.5)',
    anon: isDark ? ANON_COLOR_DARK : ANON_COLOR_LIGHT,
  };
}

const formatDate2 = (n) => String(n).padStart(2, '0');

export function formatYMD(d) {
  return `${d.getFullYear()}-${formatDate2(d.getMonth() + 1)}-${formatDate2(d.getDate())}`;
}

export function getPresetRange(preset) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  if (preset === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { start: d, end: d };
  }
  if (preset === 'week') {
    // Semana de trabalho = segunda a sexta da semana ISO atual.
    // - Seg-Sex: Mon-Fri da semana onde "hoje" está.
    // - Sáb-Dom: Mon-Fri que ACABOU de passar (semana já encerrada).
    //   Importante: nunca retornamos datas futuras — o backend não tem
    //   dados pro futuro e o dashboard ficava vazio. Hoje 03/05 (dom)
    //   retorna 27/04–01/05; amanhã 04/05 (seg) já vira 04/05–08/05.
    // dow || 7: 1=Seg, 2=Ter, ..., 5=Sex, 6=Sáb, 7=Dom.
    const dow = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return { start: monday, end: friday };
  }
  if (preset === 'month') return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
  if (preset === 'lastMonth') return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
  if (preset === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 0) };
  }
  return { start: today, end: today };
}

/**
 * Mapa de exibição de nomes.
 * - Para gestores: nome real para todos.
 * - Para os demais: nome real só do próprio usuário; outros aparecem como "Membro N"
 *   numa ordem embaralhada (para não vazar a posição original do array).
 *
 * Como users muda quando os filtros recarregam, embaralhamos a cada chamada — fica
 * "estável durante a sessão" mas re-anonimiza ao trocar de período. Isso evita que
 * alguém deduza identidades comparando dois períodos consecutivos.
 */
export function buildDisplayNameMap(users, currentUser, manager) {
  const map = {};
  if (manager) {
    users.forEach((u) => { map[u.username] = formatName(u.username); });
    return map;
  }

  const me = (currentUser || '').trim().toLowerCase();
  const others = users.filter((u) => u.username !== me);
  const shuffled = [...others];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.forEach((u, i) => { map[u.username] = `Membro ${i + 1}`; });
  if (me) map[me] = formatName(me);
  return map;
}

/**
 * Ordena uma lista de membros e monta o mapa de nomes de exibição — usado tanto
 * pro chart BR (data.users) quanto pro LATAM (memberTopics), que têm campos
 * diferentes mas o mesmo formato { username, ... }.
 * Gestor: ordenado por sortValue desc, nomes reais. Demais: ordem embaralhada,
 * "Membro N" exceto o próprio (mesma lógica de anonimização do buildDisplayNameMap).
 */
export function orderAndAnonymize(items, sortValue, isMgr, me) {
  const arr = [...items];
  if (isMgr) {
    arr.sort((a, b) => sortValue(b) - sortValue(a));
  } else {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  const displayNames = {};
  if (isMgr) {
    arr.forEach((u) => { displayNames[u.username] = formatName(u.username); });
  } else {
    let counter = 1;
    arr.forEach((u) => {
      displayNames[u.username] = u.username === me ? formatName(u.username) : `Membro ${counter}`;
      if (u.username !== me) counter += 1;
    });
  }
  return { ordered: arr, displayNames };
}

/** Calcula valor de uma métrica para um usuário. */
export function getUserMetricValue(user, metric) {
  if (!user) return 0;
  if (metric === 'responses') return user.totalResponses || 0;
  if (metric === 'solutions') return user.totalSolutions || 0;
  if (metric === 'rate') {
    const total = user.totalResponses || 0;
    if (total === 0) return 0;
    return Math.round(((user.totalSolutions || 0) / total) * 1000) / 10;
  }
  return 0;
}
