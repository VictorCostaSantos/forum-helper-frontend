/*
  Lista do time de Suporte Educacional para o painel de Alocação.

  - username: bate com o username usado no resto do app (forumHelperUsername)
  - displayName: nome legível mostrado no quadro e no drawer
  - isAdmin: pode editar/excluir QUALQUER atividade. Não-admins só editam
    atividades em que estão em `responsaveis`.

  TODO Victor: ajusta os displayNames se eu errei alguma grafia e marca
  outros admins se precisar. A constante LOAD_THRESHOLDS rege as faixas
  de cor da barra de carga semanal.
*/

export const TEAM = [
  { username: 'monalisa-silva1',         displayName: 'Monalisa Silva',    isAdmin: false },
  { username: 'victos-costa',            displayName: 'Victor Costa',      isAdmin: true  },
  { username: 'nathqueiroz',             displayName: 'Nathalia Queiroz',  isAdmin: false },
  { username: 'rafaela-petelin-silverio',displayName: 'Rafaela Petelin',   isAdmin: false },
  { username: 'lorena-garcia',           displayName: 'Lorena Garcia',     isAdmin: false },
  { username: 'armano-junior',           displayName: 'Armano Júnior',     isAdmin: false },
  { username: 'mikedesousa80',           displayName: 'Mike de Sousa',     isAdmin: false },
  { username: 'udanielnogueira',         displayName: 'Daniel Nogueira',   isAdmin: false },
  { username: 'iara-martinez',           displayName: 'Iara Martinez',     isAdmin: false },
  { username: 'vascoginde',              displayName: 'Vasco Ginde',       isAdmin: true  },
];

// Capacidade máxima de carga (soma de pesos do plantão atual) por pessoa.
// O termômetro mostra a carga atual como % desse máximo. NÃO é hora —
// é só um número absoluto de "pontos" que cada pessoa aguenta com folga.
// Ajuste por pessoa quando alguém tem mais/menos disponibilidade (estágio,
// período de prova, líder com outras frentes, etc).
export const DEFAULT_MAX_LOAD = 10;

const MAX_LOAD_BY_USER = {
  // Exemplos — preencha conforme a realidade do time:
  // 'lorena-garcia': 8,
  // 'armano-junior': 12,
};

export function getMaxLoad(username) {
  if (username && Object.prototype.hasOwnProperty.call(MAX_LOAD_BY_USER, username)) {
    return MAX_LOAD_BY_USER[username];
  }
  return DEFAULT_MAX_LOAD;
}

// Soma de pesos da semana → faixa de carga. Ajuste empírico:
// 3 atividades peso 3 = 9 ≈ saturação. Acima disso, sinal vermelho.
export const LOAD_THRESHOLDS = {
  light:    { max: 4,  label: 'Carga leve',       tone: 'light'    },
  healthy:  { max: 7,  label: 'Carga saudável',   tone: 'healthy'  },
  heavy:    { max: 10, label: 'Carga alta',       tone: 'heavy'    },
  overload: { max: Infinity, label: 'Sobrecarga', tone: 'overload' },
};

export const LOAD_MAX_REFERENCE = 10;

export function getMember(username) {
  if (!username) return null;
  const normalized = String(username).trim().toLowerCase();
  return TEAM.find((m) => m.username.toLowerCase() === normalized) || null;
}

/*
  Sentinela usada quando todos saem de uma atividade. O backend exige
  responsaveis com pelo menos 1 item, então em vez de bloquear, gravamos
  esse "usuário vago" — e o front ESCONDE ele do facepile, dando a
  impressão de card vazio. Ao adicionar uma pessoa real depois, o vago é
  automaticamente removido.

  Use só esse helper (isPlaceholder) pra checar — não compare a string
  diretamente em outros lugares.
*/
export const PLACEHOLDER_USER = '__vago__';

export function isPlaceholder(username) {
  return username === PLACEHOLDER_USER;
}

export function getDisplayName(username) {
  const member = getMember(username);
  if (member) return member.displayName;
  return username || '—';
}

/*
  Avatar fallback determinístico via pravatar.cc — gera uma foto consistente
  baseada no username. Usado quando o backend não tem avatar pra essa pessoa.
  UserAvatar tenta `src` primeiro; se falhar, cai no círculo colorido.

  Substitua aqui se quiser usar outra fonte (ex: hosted CDN do time).
*/
export function avatarFallbackUrl(username) {
  if (!username) return '';
  const seed = encodeURIComponent(String(username).toLowerCase().trim());
  return `https://i.pravatar.cc/96?u=${seed}`;
}

export function isAdmin(username) {
  const member = getMember(username);
  return Boolean(member?.isAdmin);
}

export function canEditActivity(currentUsername, activity) {
  if (!currentUsername || !activity) return false;
  if (isAdmin(currentUsername)) return true;
  const list = Array.isArray(activity.responsaveis) ? activity.responsaveis : [];
  return list.some((u) => String(u).toLowerCase() === String(currentUsername).toLowerCase());
}

export function loadToneFor(totalWeight) {
  const n = Number(totalWeight) || 0;
  if (n <= LOAD_THRESHOLDS.light.max)   return LOAD_THRESHOLDS.light;
  if (n <= LOAD_THRESHOLDS.healthy.max) return LOAD_THRESHOLDS.healthy;
  if (n <= LOAD_THRESHOLDS.heavy.max)   return LOAD_THRESHOLDS.heavy;
  return LOAD_THRESHOLDS.overload;
}
