import { marked } from 'marked';

export const TYPE_COLORS = {
  'Aviso': '#F16165',
  'Demanda': '#7B71FF',
  'Link Útil': '#6BD1FF',
  'Projeto': '#00C86F',
  'Reunião': '#FFBA05',
  'Outros': '#94a3b8',
};

export const TYPE_ICONS = {
  'Aviso': 'fa-bullhorn',
  'Demanda': 'fa-tasks',
  'Link Útil': 'fa-link',
  'Projeto': 'fa-rocket',
  'Reunião': 'fa-handshake',
  'Outros': 'fa-paperclip',
};

export const TEAM_MEMBERS = [
  'monalisa-silva1', 'victos-costa', 'nathqueiroz', 'rafaela-petelin-silverio',
  'lorena-garcia', 'armano-junior', 'mikedesousa80', 'udanielnogueira', 'iara-martinez', 'vascoginde',
];

const NAME_MAP = {
  'victos-costa': 'Victor', 'nathqueiroz': 'Nath', 'mikedesousa80': 'Mike',
  'udanielnogueira': 'Daniel', 'vascoginde': 'Vasco', 'armano-junior': 'Armano',
  'lorena-garcia': 'Lorena', 'monalisa-silva1': 'Monalisa', 'rafaela-petelin-silverio': 'Rafaela',
  'iara-martinez': 'Iara',
};

export const FILTERS_LEFT = [
  { value: 'all', label: 'Todos', icon: 'fa-globe' },
  { value: 'mine', label: 'Para mim', icon: 'fa-user' },
  { value: 'created', label: 'Meus', icon: 'fa-pen' },
  { value: 'private', label: 'Privados', icon: 'fa-lock' },
  { value: 'archived', label: 'Arquivados', icon: 'fa-archive' },
];

export const FILTERS_RIGHT = [
  { value: 'Aviso', icon: 'fa-bullhorn' },
  { value: 'Demanda', icon: 'fa-tasks' },
  { value: 'Link Útil', icon: 'fa-link' },
  { value: 'Projeto', icon: 'fa-rocket' },
  { value: 'Reunião', icon: 'fa-handshake' },
];

export const initialForm = {
  id: '',
  title: '',
  type: 'Aviso',
  description: '',
  link: '',
  endDate: '',
  visibilityAll: false,
  isPrivate: false,
  assignees: [],
};

export function toDisplayName(username) {
  if (NAME_MAP[username]) return NAME_MAP[username];
  const base = (username || '').split('-')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function nameToHsl(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 46%)`;
}

export function getDateStatus(endDateString) {
  if (!endDateString) return 'normal';
  const endDate = new Date(`${endDateString}T23:59:59`);
  const diffHours = (endDate - new Date()) / (1000 * 60 * 60);
  if (diffHours < 0) return 'urgent';
  if (diffHours <= 72) return 'warning';
  return 'normal';
}

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    return marked.parse(text, { breaks: true, gfm: true });
  } catch {
    return text.replace(/\n/g, '<br>');
  }
}

export function getReadCards() {
  try { return new Set(JSON.parse(localStorage.getItem('alura_mural_read') || '[]')); }
  catch { return new Set(); }
}

export function markAsRead(id) {
  const set = getReadCards();
  if (!set.has(id)) {
    set.add(id);
    localStorage.setItem('alura_mural_read', JSON.stringify([...set]));
    return true;
  }
  return false;
}

export function getPinnedCards() {
  try { return new Set(JSON.parse(localStorage.getItem('alura_mural_pinned') || '[]')); }
  catch { return new Set(); }
}

export function savePinned(set) {
  localStorage.setItem('alura_mural_pinned', JSON.stringify([...set]));
}

export function togglePin(id) {
  const set = getPinnedCards();
  set.has(id) ? set.delete(id) : set.add(id);
  savePinned(set);
  return set.has(id);
}

export function getPrivateCards(user) {
  if (!user) return [];
  try { return JSON.parse(localStorage.getItem(`alura_mural_private_${user}`) || '[]'); }
  catch { return []; }
}

export function savePrivateCards(user, cards) {
  localStorage.setItem(`alura_mural_private_${user}`, JSON.stringify(cards));
}
