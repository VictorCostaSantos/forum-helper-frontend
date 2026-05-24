// Tipos de bloco do editor Notion-style + helpers + migração de modelo legado.

export const BLOCK = {
  PARAGRAPH: 'paragraph',
  HEADING_2: 'heading-2',
  HEADING_3: 'heading-3',
  BULLET: 'bulleted-list',
  CHECKBOX: 'checkbox',
  PERCENT: 'percent',
  RECURRING: 'recurring',
  QUOTE: 'quote',
  DIVIDER: 'divider',
  IMAGE: 'image',
};

// Lista pro Slash Menu, em ordem de uso esperado.
export const BLOCK_PALETTE = [
  { type: BLOCK.PARAGRAPH, label: 'Texto', hint: 'Apenas comece a digitar', icon: 'fa-paragraph', shortcut: '' },
  { type: BLOCK.HEADING_2, label: 'Título de seção', hint: 'Cabeçalho médio (vira "grupo")', icon: 'fa-heading', shortcut: '## ' },
  { type: BLOCK.HEADING_3, label: 'Subtítulo', hint: 'Cabeçalho menor', icon: 'fa-heading', shortcut: '### ' },
  { type: BLOCK.BULLET, label: 'Lista', hint: 'Lista com bullets', icon: 'fa-list-ul', shortcut: '- ' },
  { type: BLOCK.CHECKBOX, label: 'To-do', hint: 'Tarefa simples', icon: 'fa-square-check', shortcut: '[] ' },
  { type: BLOCK.PERCENT, label: 'Progresso (%)', hint: 'Tarefa com barra', icon: 'fa-percent', shortcut: '' },
  { type: BLOCK.RECURRING, label: 'Hábito', hint: 'Tarefa recorrente com streak', icon: 'fa-arrows-rotate', shortcut: '' },
  { type: BLOCK.QUOTE, label: 'Citação', hint: 'Bloco com borda à esquerda', icon: 'fa-quote-left', shortcut: '> ' },
  { type: BLOCK.IMAGE, label: 'Imagem', hint: 'URL ou markdown ![alt](url)', icon: 'fa-image', shortcut: '![]()' },
  { type: BLOCK.DIVIDER, label: 'Divisor', hint: 'Linha horizontal', icon: 'fa-minus', shortcut: '---' },
];

// Larguras possíveis pra um bloco. Blocos consecutivos não-full agrupam em
// colunas. Soma das larguras numa "linha" não precisa ser 100% — sobra fica
// vazia. Heading e divider sempre ocupam linha inteira independente do width.
export const BLOCK_WIDTHS = [
  { id: 'full', label: 'Largura total', icon: 'fa-arrows-left-right-to-line', basis: '100%' },
  { id: 'half', label: '½ — duas colunas', icon: 'fa-table-columns', basis: 'calc(50% - 8px)' },
  { id: 'third', label: '⅓ — três colunas', icon: 'fa-grip', basis: 'calc(33.333% - 11px)' },
  { id: 'quarter', label: '¼ — quatro colunas', icon: 'fa-border-all', basis: 'calc(25% - 12px)' },
];

export function getWidthBasis(widthId) {
  return (BLOCK_WIDTHS.find((w) => w.id === widthId) || BLOCK_WIDTHS[0]).basis;
}

// IDs estáveis de bloco. Format: prefix + timestamp + random suffix.
export function genBlockId() {
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Cria um bloco com defaults sensatos pro tipo.
export function createBlock(type, partial = {}) {
  const base = { id: genBlockId(), type, content: '', width: 'full' };
  if (type === BLOCK.CHECKBOX) return { ...base, checked: false, linkedCourses: [], notes: '', link: '', ...partial };
  if (type === BLOCK.PERCENT) return { ...base, progress: 0, linkedCourses: [], notes: '', link: '', ...partial };
  if (type === BLOCK.RECURRING) return { ...base, recurring: { frequency: 'weekly', completedDates: [] }, notes: '', link: '', ...partial };
  if (type === BLOCK.DIVIDER) return { ...base, content: '', ...partial };
  if (type === BLOCK.IMAGE) return { ...base, content: '', src: '', alt: '', ...partial };
  return { ...base, ...partial };
}

// Atalhos markdown (no início do conteúdo do paragraph) — retorna { type, rest }
// se bate, ou null. Usado pelo Editor pra converter o bloco em outro tipo.
// Pra IMAGE, retorna também { src, alt } pra preencher os campos do bloco.
export function detectMarkdownShortcut(content) {
  if (content.startsWith('## ')) return { type: BLOCK.HEADING_2, rest: content.slice(3) };
  if (content.startsWith('### ')) return { type: BLOCK.HEADING_3, rest: content.slice(4) };
  if (content.startsWith('- [ ] ') || content.startsWith('[] ') || content.startsWith('[ ] ')) {
    const rest = content.replace(/^(- \[ \] |\[\] |\[ \] )/, '');
    return { type: BLOCK.CHECKBOX, rest };
  }
  if (content.startsWith('- ')) return { type: BLOCK.BULLET, rest: content.slice(2) };
  if (content.startsWith('> ')) return { type: BLOCK.QUOTE, rest: content.slice(2) };
  if (content === '---' || content === '—') return { type: BLOCK.DIVIDER, rest: '' };
  // ![alt](url) — markdown de imagem. Aceita também só `![](url)` e `![alt]()`.
  const imgMatch = content.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/);
  if (imgMatch) {
    return {
      type: BLOCK.IMAGE,
      rest: '',
      extra: { alt: imgMatch[1] || '', src: imgMatch[2] || '' },
    };
  }
  return null;
}

// Bloco que pode ter cursos da Alura vinculados.
export function blockCanHaveCourses(block) {
  return block?.type === BLOCK.CHECKBOX || block?.type === BLOCK.PERCENT;
}

// Bloco que tem "conteúdo" textual editável. Divider e Image não têm.
export function blockHasContent(block) {
  return block?.type !== BLOCK.DIVIDER && block?.type !== BLOCK.IMAGE;
}

// Bloco que conta no progresso geral do PDI (tem noção de "feito").
export function blockCountsForProgress(block) {
  return [BLOCK.CHECKBOX, BLOCK.PERCENT, BLOCK.RECURRING].includes(block?.type);
}

// =====================================================================
// MIGRAÇÃO — converte estrutura legada (groups+tasks) em lista de blocos.
// Lê pdiPlan-v1 + pdiState-v1 e merge.
// =====================================================================

// Mapeia tipo de tarefa antigo (taskHelpers.TASK_TYPES) pro tipo de bloco.
function legacyTaskTypeToBlock(legacyType) {
  if (legacyType === 'checkbox') return BLOCK.CHECKBOX;
  if (legacyType === 'recurring') return BLOCK.RECURRING;
  return BLOCK.PERCENT;
}

export function migrateLegacyToDoc(legacyPlan, legacyState = {}) {
  if (!legacyPlan) return null;

  const blocks = [];
  (legacyPlan.groups || []).forEach((g, gIdx) => {
    // Heading do grupo (heading-2). Se não é o primeiro, não precisa de divider —
    // o próprio visual de heading-2 já cria o "espaço de seção".
    blocks.push(createBlock(BLOCK.HEADING_2, { content: g.title || 'Sem título' }));

    // Descrição do grupo (paragraph) só se existir.
    if (g.description && g.description.trim()) {
      blocks.push(createBlock(BLOCK.PARAGRAPH, { content: g.description }));
    }

    // Tarefas → blocos
    (g.tasks || []).forEach((t) => {
      const taskState = legacyState[t.id] || {};
      const blockType = legacyTaskTypeToBlock(taskState.type);
      const partial = {
        content: t.title || 'Tarefa',
        notes: taskState.notes || '',
        link: taskState.link || t.defaultLink || '',
        linkedCourses: taskState.linkedCourses || [],
      };
      if (blockType === BLOCK.CHECKBOX) {
        partial.checked = (taskState.progress ?? 0) >= 100;
      } else if (blockType === BLOCK.PERCENT) {
        partial.progress = taskState.progress ?? 0;
      } else if (blockType === BLOCK.RECURRING) {
        partial.recurring = taskState.recurring || { frequency: 'weekly', completedDates: [] };
      }
      blocks.push(createBlock(blockType, partial));
    });
  });

  // Se nem um grupo veio, adiciona um paragraph vazio pra começar.
  if (blocks.length === 0) {
    blocks.push(createBlock(BLOCK.PARAGRAPH));
  }

  // Converte string única "A & B · C" em lista de tags, preservando a ordem.
  // Aceita ` & `, ` · `, `,` e `;` como separadores comuns.
  const focusFromLegacy = (legacyPlan.focus || '')
    .split(/\s*(?:&|·|,|;)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title: legacyPlan.title || 'Meu PDI',
    type: legacyPlan.type || '',
    role: legacyPlan.role || '',
    department: legacyPlan.department || '',
    focus: legacyPlan.focus || '',
    focusTags: Array.isArray(legacyPlan.focusTags) && legacyPlan.focusTags.length > 0
      ? legacyPlan.focusTags
      : focusFromLegacy,
    emoji: legacyPlan.emoji || '👨‍💻',
    avatarUrl: legacyPlan.avatarUrl || '',
    accentId: legacyPlan.accentId || 'is-data',
    coverEnabled: legacyPlan.coverEnabled !== false,
    cover: legacyPlan.cover || '',
    startDate: legacyPlan.startDate || new Date().toISOString().slice(0, 10),
    endDate: legacyPlan.endDate || new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
    feedzUrl: legacyPlan.feedzUrl || '',
    blocks,
  };
}
