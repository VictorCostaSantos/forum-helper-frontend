// Classificação de tipos, ícones, normalização e busca fuzzy.

export const ICONS = {
  DEFAULT: 'https://www.alura.com.br/assets/api/cursos/alura-sala-de-aula.svg',
  VIDEO: 'https://cursos.alura.com.br/assets/images/learningGuide/learningContentIcons/step-video.svg',
  PODCAST: 'https://cursos.alura.com.br/assets/images/learningGuide/learningContentIcons/step-like-a-boss.svg',
  ARTIGO: 'https://cursos.alura.com.br/assets/images/search/article-tag.svg',
  CURSO: 'https://cursos.alura.com.br/assets/images/learningGuide/learningContentIcons/step-post-alura.svg',
  FERRAMENTA: 'https://cdn-icons-png.flaticon.com/128/1077/1077198.png',
  DOC: 'https://cdn-icons-png.flaticon.com/128/7222/7222850.png',
};

export const INTRO_LABELS = {
  default: 'Para saber mais:',
  aprofundar: 'Para se aprofundar no tema:',
  comecar: 'Por onde começar:',
  relacionado: 'Conteúdo relacionado:',
  pratica: 'Para praticar:',
};

export function getKindIconClass(kindRaw) {
  const k = (kindRaw || '').toUpperCase().trim();
  if (k.includes('TIRINHA') || k.includes('HQ') || k.includes('ALURAVERSO')) return 'fa-laugh-beam';
  if (k.includes('CASE')) return 'fa-lightbulb';
  if (k.includes('WEBSERIE') || k.includes('WEB SÉRIE') || k.includes('SERIE')) return 'fa-play-circle';
  if (k.includes('TRILHA') || k.includes('FORMACAO') || k.includes('FORMAÇÃO')) return 'fa-map-signs';
  if (k.includes('ALURA+') || k.includes('PLUS') || k.includes('MAIS')) return 'fa-star';
  if (k.includes('CARREIRA') || k.includes('SOFT')) return 'fa-briefcase';
  if (k.includes('VIDEO') || k.includes('VÍDEO') || k.includes('LIVE') || k.includes('EVENTO')) return 'fa-youtube';
  if (k.includes('PODCAST') || k.includes('HIPSTERS') || k.includes('LAYERS')) return 'fa-microphone-alt';
  if (k.includes('ARTIGO') || k.includes('LEITURA') || k.includes('APOSTILA') || k.includes('E-BOOK')) return 'fa-file-alt';
  if (k.includes('CURSO')) return 'fa-book';
  return 'fa-link';
}

export function classifyKind(kindRaw) {
  const k = (kindRaw || '').toUpperCase().trim();
  if (k.includes('TIRINHA') || k.includes('HQ') || k.includes('ALURAVERSO'))
    return { typeClass: 'type-ludico', badgeLabel: 'Tirinha', iconClass: 'fa-laugh-beam' };
  if (k.includes('CASE'))
    return { typeClass: 'type-case', badgeLabel: 'Case', iconClass: 'fa-lightbulb' };
  if (k.includes('WEBSERIE') || k.includes('WEB SÉRIE') || k.includes('SERIE'))
    return { typeClass: 'type-video', badgeLabel: 'Websérie', iconClass: 'fa-play-circle' };
  if (k.includes('TRILHA') || k.includes('FORMACAO') || k.includes('FORMAÇÃO'))
    return { typeClass: 'type-formacao', badgeLabel: 'Trilha', iconClass: 'fa-map-signs' };
  if (k.includes('ALURA+') || k.includes('PLUS') || k.includes('MAIS'))
    return { typeClass: 'type-aluramais', badgeLabel: 'Alura+', iconClass: 'fa-star' };
  if (k.includes('CARREIRA') || k.includes('SOFT'))
    return { typeClass: 'type-carreira', badgeLabel: 'Carreira', iconClass: 'fa-briefcase' };
  if (k.includes('VIDEO') || k.includes('VÍDEO') || k.includes('LIVE') || k.includes('EVENTO'))
    return { typeClass: 'type-video', badgeLabel: 'Vídeo', iconClass: 'fa-youtube' };
  if (k.includes('PODCAST') || k.includes('HIPSTERS') || k.includes('LAYERS'))
    return { typeClass: 'type-podcast', badgeLabel: 'Podcast', iconClass: 'fa-microphone-alt' };
  if (k.includes('ARTIGO') || k.includes('LEITURA') || k.includes('APOSTILA') || k.includes('E-BOOK') || k.includes('EBOOK'))
    return { typeClass: 'type-artigo', badgeLabel: 'Artigo', iconClass: 'fa-file-alt' };
  if (k.includes('CURSO'))
    return { typeClass: 'type-curso', badgeLabel: 'Curso', iconClass: 'fa-book' };
  return { typeClass: 'type-outro', badgeLabel: kindRaw || 'Outro', iconClass: 'fa-question' };
}

export function isContentLegacy(dateText) {
  if (!dateText) return false;
  const parts = dateText.split('/');
  if (parts.length !== 3) return false;
  const date = new Date(parts[2], parts[1] - 1, parts[0]);
  if (Number.isNaN(date.getTime())) return false;
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
  return date < fourYearsAgo;
}

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function scoreTerm(term, field, weight) {
  if (!field) return 0;
  const nf = normalize(field);
  const nt = normalize(term);
  const words = nf.split(/\s+/);
  if (nf === nt) return 100 * weight;
  if (words.includes(nt)) return 70 * weight;
  if (words.some((w) => w.startsWith(nt))) return 45 * weight;
  if (nf.includes(nt)) return 25 * weight;
  const maxDist = nt.length <= 4 ? 1 : 2;
  if (words.some((w) => levenshtein(nt, w) <= maxDist)) return 10 * weight;
  return 0;
}

function scoreItem(item, terms) {
  let total = 0;
  let missed = 0;
  for (const term of terms) {
    const t = scoreTerm(term, item.title, 2.0);
    const k = scoreTerm(term, item.kind, 1.0);
    const best = Math.max(t, k);
    if (best === 0) missed += 1;
    total += best;
  }
  if (missed > Math.floor(terms.length / 2)) return 0;
  return total;
}

export function filterData(data, searchText, selectedType) {
  if (!searchText || !searchText.trim()) {
    return data.filter((item) => selectedType === '' || item.kind === selectedType);
  }
  const terms = normalize(searchText).trim().split(/\s+/).filter(Boolean);
  const scored = data
    .filter((item) => selectedType === '' || item.kind === selectedType)
    .map((item) => ({ item, score: scoreItem(item, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map(({ item }) => item);
}
