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
  'iara-martinez',
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
  'iara-martinez': 'Iara Martinez',
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

export const SCHOOL_COLORS = {
  'Programação': '#00C86F',
  'Front-end': '#6BD1FF',
  'Data Science': '#9CD33B',
  DevOps: '#F16165',
  'UX & Design': '#DC6EBE',
  Mobile: '#FFBA05',
  'Inovação & Gestão': '#FF8C2A',
  'Inteligência Artificial': '#7B71FF',
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
    // segunda → hoje
    const dow = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1));
    return { start: monday, end: today };
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
