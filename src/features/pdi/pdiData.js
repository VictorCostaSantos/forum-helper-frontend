// SEED do PDI — dois papéis:
//   1) `buildInitialDoc()` (no fim do arquivo): doc Notion-style "tour das
//      possibilidades", usado em `Restaurar modelo padrão`. Mostra TODOS os
//      tipos de bloco com conteúdo genérico, pra elucidar quem chega.
//   2) `INITIAL_PLAN` (abaixo): estrutura legada (groups+tasks) mantida só pra
//      migração de quem ainda tem `pdiPlan-v1` no localStorage. Não é mais a
//      fonte do seed.

import { BLOCK, createBlock } from './blockTypes';

export const INITIAL_PLAN = {
  title: 'Evolução pessoal — Soft + Hard Skills',
  type: 'Desenvolver',
  role: 'Analista de Suporte Educacional I',
  department: 'Suporte Educacional Alura',
  emoji: '👨‍💻',
  avatarUrl: '',
  // focusTags = lista de focos atuais. Compatível com `focus` (string única) via migração.
  focusTags: ['Engenharia de IA', 'Oratória'],
  // Cor de acento do PDI — vide PDI_ACCENTS abaixo. Default = lima/data-science.
  accentId: 'is-data',
  // Banner colorido no topo do hero. Pode ser desativado.
  coverEnabled: true,
  startDate: '2026-03-23',
  endDate: '2026-09-23',
  feedzUrl: 'https://cursos.alura.com.br/pdi-victos-costa-1778035448418-p1078477',
  groups: [
    {
      id: 'produtividade',
      title: 'Produtividade e Eficiência',
      description: 'Manter volume estável de entregas, garantindo consistência e qualidade alinhadas à média do time.',
      icon: 'fa-bolt',
      accent: 'is-productivity',
      tasks: [
        {
          id: 'meta-100-topicos',
          title: 'Bater meta recorrente de 100 tópicos por semana',
          hint: 'Sincroniza com fetchUserStats no futuro',
        },
        {
          id: 'acompanhar-indicadores',
          title: 'Acompanhar evolução por meio de indicadores',
        },
        {
          id: 'entregas-adicionais',
          title: 'Realizar entregas adicionais (artigos, revisões, validações)',
        },
      ],
    },
    {
      id: 'tecnico',
      title: 'Fortalecer conhecimentos técnicos',
      description: 'Conectar mais os conhecimentos e se desenvolver de maneira técnica a fim de melhorar soluções para o time.',
      icon: 'fa-microchip',
      accent: 'is-technical',
      tasks: [
        {
          id: 'carreira-eng-ia',
          title: 'Fazer Carreira Engenharia de IA',
          defaultLink: 'https://cursos.alura.com.br/carreira/engenharia-de-ia',
        },
        {
          id: 'aplicar-aprendizados',
          title: 'Aplicar aprendizados em pelo menos 1 solução prática no time',
        },
        {
          id: 'iniciativas-tecnicas',
          title: 'Participar de iniciativas técnicas ou projetos internos',
        },
      ],
    },
    {
      id: 'comunicacao',
      title: 'Fortalecer comunicação e visibilidade no time',
      description: 'Desenvolver através de cursos uma comunicação mais clara, objetiva e frequente no dia a dia, além de fortalecer a participação nas interações com a equipe.',
      icon: 'fa-comments',
      accent: 'is-communication',
      tasks: [
        { id: 'onboarding-alunos', title: 'Participar de Onboarding de alunos' },
        { id: 'criacao-pautas', title: 'Criar hábito de criação de pautas' },
        { id: 'trilha-comunicacao', title: 'Desenvolver comunicação clara e objetiva (trilha comunicação)' },
        { id: 'trilha-comunicacao-lideres', title: 'Participar mais ativamente de atividade em grupos (trilha comunicação para líderes)' },
        { id: 'colaboracao-time', title: 'Fortalecer colaboração com o time (Habilidades e comportamento)' },
        { id: 'technical-writing', title: 'Dar mais visibilidade ao que estou fazendo (Technical Writing)' },
      ],
    },
  ],
};

// Vínculos curso → tarefa pré-populados, baseados em matches óbvios entre o
// título da tarefa e os cursos do Victor já presentes no BI da Alura.
// Ficam fora do plano editável porque dependem do dataset do BI, não do PDI.
export const INITIAL_LINKED_COURSES = {
  'carreira-eng-ia': [
    'Fundamentos de IA: explorando a estrutura e abordagens de sistemas inteligentes',
    'Inteligência artificial Generativa: Midjourney e ChatGPT',
    'Copywriting: criando textos persuasivos com Inteligência Artificial',
    'Tomada de decisão com IA: otimizando estratégias com dados',
  ],
  'trilha-comunicacao': [
    'Comunicação: como se expressar bem e ser compreendido',
    'Oratória: conquiste a atenção do seu público',
  ],
  'colaboracao-time': [
    'Aprender a aprender: técnicas para seu autodesenvolvimento',
    'Síndrome do Impostor: reconheça seu sucesso e resultados',
    'Hábitos: da produtividade às metas pessoais',
    'Propósito profissional: seja protagonista da sua carreira',
  ],
  'acompanhar-indicadores': [
    'Power BI Desktop: construindo meu primeiro dashboard',
  ],
};

// Ícones FA disponíveis pra escolher num grupo (lista curada).
// Inclui categorias variadas pra cada pessoa achar um que combine com o tema.
export const GROUP_ICONS = [
  'fa-bolt', 'fa-microchip', 'fa-comments', 'fa-rocket', 'fa-graduation-cap',
  'fa-bullseye', 'fa-chart-line', 'fa-lightbulb', 'fa-people-group',
  'fa-handshake', 'fa-flag', 'fa-trophy', 'fa-star', 'fa-fire',
  'fa-code', 'fa-laptop-code', 'fa-pen-to-square', 'fa-book',
  'fa-puzzle-piece', 'fa-magnifying-glass-chart', 'fa-seedling',
];

// Cores de acento dos grupos (mapeiam pra .is-* nas styles).
export const GROUP_ACCENTS = [
  { id: 'is-productivity', label: 'Verde', color: 'var(--cor-programacao)' },
  { id: 'is-technical', label: 'Roxo', color: 'var(--cor-ia)' },
  { id: 'is-communication', label: 'Azul', color: 'var(--cor-feedback)' },
  { id: 'is-data', label: 'Lima', color: 'var(--cor-data-science)' },
  { id: 'is-design', label: 'Rosa', color: 'var(--cor-ux-design)' },
  { id: 'is-mobile', label: 'Amarelo', color: 'var(--cor-mobile)' },
  { id: 'is-devops', label: 'Vermelho', color: 'var(--cor-devops)' },
  { id: 'is-innovation', label: 'Laranja', color: 'var(--cor-inovacao-gestao)' },
];

// Mesma paleta dos grupos, reutilizada como acento do PDI inteiro (cover, stats,
// detalhes). O id casa com GROUP_ACCENTS pra não duplicar a fonte da verdade.
export const PDI_ACCENTS = GROUP_ACCENTS;

// Tipos comuns de PDI na FEEDZ — escolha curada pra ficar fácil. Edição livre.
export const PDI_TYPES = ['Desenvolver', 'Aprender', 'Acelerar', 'Estabilizar', 'Transição'];

// Emojis pro picker do PDI — curados em "famílias" pra ficar mais fácil escolher.
// Lista expandida em relação ao picker antigo (16 → 36).
export const PDI_EMOJIS = [
  // Trabalho & papel
  '👨‍💻', '👩‍💻', '🧑‍🏫', '🧑‍🎓', '🧑‍🔬', '🧑‍🚀',
  // Foco & metas
  '🎯', '🚀', '🏆', '⭐', '🌟', '🔥',
  // Aprendizado
  '📚', '🧠', '💡', '✨', '🔍', '📝',
  // Energia & crescimento
  '🌱', '🌿', '⚡', '💪', '🦾', '🌈',
  // Soft skills & comunicação
  '🤝', '💬', '🗣️', '👂', '❤️', '🫶',
  // Ferramentas
  '🛠️', '🎨', '📊', '🧩', '⚙️', '📐',
];

// =====================================================================
// SEED — doc inicial usado em "Restaurar modelo padrão" e em qualquer
// boot sem dados. Funciona como TUTORIAL VIVO: cada tipo de bloco aparece
// como exemplo + explicação, em ordem didática. A pessoa lê, entende como
// usar, e apaga (selecionar + Backspace, ou ⋯ → Remover) pra começar
// o PDI dela de verdade.
// =====================================================================
export function buildInitialDoc() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const endIso = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

  return {
    title: 'Meu PDI',
    type: '',
    role: '',
    department: '',
    emoji: '🚀',
    avatarUrl: '',
    focus: 'Aprender e crescer',
    focusTags: ['Aprender uma habilidade nova', 'Crescer profissionalmente'],
    accentId: 'is-data',
    coverEnabled: false,
    cover: '',
    startDate: todayIso,
    endDate: endIso,
    feedzUrl: '',
    blocks: [
      // ---------------- BOAS-VINDAS ----------------
      createBlock(BLOCK.QUOTE, {
        content: 'Esse PDI vem com um tutorial embutido. Lê descendo, entende como cada bloco funciona, e depois apaga tudo (seleciona o texto + Backspace, ou ⋯ → Remover bloco) pra começar o seu de verdade.',
      }),

      // ---------------- COMO EDITAR ----------------
      createBlock(BLOCK.HEADING_2, { content: '👋 Como editar' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Clique em qualquer texto pra editar. Aperte Enter pra criar um bloco novo abaixo. Backspace num bloco vazio apaga.',
      }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Pra adicionar um bloco de outro tipo (lista, hábito, imagem…), digite "/" num bloco vazio. Aparece o menu com tudo o que dá pra criar.',
      }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'No menu ⋯ ao lado de cada bloco você pode duplicar, mudar de tipo, remover, ou abrir extras (anotações, cursos da Alura, horário…).',
      }),

      // ---------------- OS TIPOS DE BLOCO ----------------
      createBlock(BLOCK.HEADING_2, { content: '🧱 Os tipos de bloco' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Cada bloco abaixo é um exemplo real do tipo correspondente — usa eles à vontade pra montar seu PDI.',
      }),

      // Parágrafo
      createBlock(BLOCK.HEADING_3, { content: 'Parágrafo de texto' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Eu sou um parágrafo. Use pra escrever livre. Enter dentro de mim cria um bloco novo logo abaixo.',
      }),

      // Lista
      createBlock(BLOCK.HEADING_3, { content: 'Lista com bullets' }),
      createBlock(BLOCK.BULLET, { content: 'Primeiro item da lista' }),
      createBlock(BLOCK.BULLET, { content: 'Cada Enter dentro de um bullet cria outro item' }),
      createBlock(BLOCK.BULLET, { content: 'Enter num bullet vazio sai da lista' }),

      // To-do
      createBlock(BLOCK.HEADING_3, { content: 'To-do (checkbox)' }),
      createBlock(BLOCK.CHECKBOX, { content: 'Clique no quadradinho à esquerda pra me marcar como feito' }),
      createBlock(BLOCK.CHECKBOX, { content: 'Cada checkbox marcado conta pro % concluído do PDI no topo' }),

      // Progresso
      createBlock(BLOCK.HEADING_3, { content: 'Progresso (%)' }),
      createBlock(BLOCK.PERCENT, {
        content: 'Eu sou um bloco de %. Use os botões + / − pra ajustar.',
        progress: 35,
      }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'No menu ⋯ → "Anotação e cursos", dá pra vincular cursos da Alura. Quando vincula, o % vira média automática dos cursos.',
      }),

      // Hábito recorrente
      createBlock(BLOCK.HEADING_3, { content: 'Hábito recorrente' }),
      createBlock(BLOCK.RECURRING, {
        content: 'Estudar 1h (exemplo — clique no círculo pra marcar quando fizer)',
        schedule: { days: [1, 3, 5], time: '19:00' },
      }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Hábitos resetam a cada período (semanal/mensal — escolha no ⋯). O streak aparece ao lado quando você marca em períodos seguidos.',
      }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'O badge 🔔 acima é um horário/lembrete (configurado no ⋯ → "Definir horário"). Se você ativar notificações no menu do PDI, ele dispara no horário.',
      }),

      // Citação
      createBlock(BLOCK.HEADING_3, { content: 'Citação' }),
      createBlock(BLOCK.QUOTE, {
        content: 'Sou uma citação. Use pra destacar uma ideia, um mantra, um lembrete importante. Me reconhece pela barra lateral.',
      }),

      // Imagem
      createBlock(BLOCK.HEADING_3, { content: 'Imagem' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'No bloco abaixo, cole uma URL de imagem (campo "URL da imagem"). Aceita também o atalho markdown `![alt](url)` se você colar diretamente num bloco de texto.',
      }),
      createBlock(BLOCK.IMAGE, { src: '', alt: '' }),

      // Divisor
      createBlock(BLOCK.HEADING_3, { content: 'Divisor' }),
      createBlock(BLOCK.PARAGRAPH, { content: 'Divisores ajudam a separar seções. Tipo isso:' }),
      createBlock(BLOCK.DIVIDER),
      createBlock(BLOCK.PARAGRAPH, { content: 'Cria um digitando "---" num bloco vazio, ou pelo menu /.' }),

      createBlock(BLOCK.DIVIDER),

      // ---------------- PRÓXIMOS PASSOS ----------------
      createBlock(BLOCK.HEADING_2, { content: '✅ Próximos passos' }),
      createBlock(BLOCK.BULLET, {
        content: 'Apaga essa parte do tutorial: clica no ⋯ de cada bloco e "Remover", ou seleciona e Backspace.',
      }),
      createBlock(BLOCK.BULLET, {
        content: 'Edita o cabeçalho (título, cargo, foco, datas) clicando direto nos campos.',
      }),
      createBlock(BLOCK.BULLET, {
        content: 'Ou abre o ⋯ → "Configurações do PDI" pra ajustar tudo de uma vez.',
      }),
      createBlock(BLOCK.BULLET, {
        content: 'Define seus 2-3 objetivos do ciclo — começa por aí, não precisa preencher tudo no primeiro dia.',
      }),
      createBlock(BLOCK.BULLET, {
        content: 'Liga as notificações em ⋯ → "Configurar notificações" se quiser lembretes dos hábitos.',
      }),
      createBlock(BLOCK.QUOTE, {
        content: 'O PDI é seu — volta aqui ao longo do ciclo. Documento vivo, não checklist.',
      }),
    ],
  };
}

// =====================================================================
// SEED — template "Sistema de estudos" focado em estudo (vs `buildInitialDoc`
// que é tutorial completo). Usado quando a pessoa clica "Começar meu PDI"
// na tela de boas-vindas. Estrutura enxuta: objetivos, cursos, rotina,
// anotações. ~10 blocos vs ~30 do tutorial.
//
// Opcionalmente recebe `studyTime` + `studyDays` do setup modal: aplica
// como schedule do bloco recurring "Estudar hoje".
// =====================================================================
export function buildStudyDoc(opts = {}) {
  const { studyTime = '', studyDays = [] } = opts;
  const todayIso = new Date().toISOString().slice(0, 10);
  const endIso = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

  const recurringPartial = { content: 'Estudar hoje' };
  if (studyTime) {
    recurringPartial.schedule = { days: studyDays, time: studyTime };
  }

  return {
    title: 'Meu PDI',
    type: '',
    role: '',
    department: '',
    emoji: '📚',
    avatarUrl: '',
    focus: '',
    focusTags: [],
    accentId: 'is-data',
    coverEnabled: false,
    cover: '',
    startDate: todayIso,
    endDate: endIso,
    feedzUrl: '',
    blocks: [
      // OBJETIVOS
      createBlock(BLOCK.HEADING_2, { content: '🎯 Objetivos do ciclo' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'O que você quer alcançar até o fim do período? Defina 2-3 metas grandes — depois quebra em passos menores.',
      }),
      createBlock(BLOCK.CHECKBOX, { content: 'Concluir minha trilha principal de estudos' }),
      createBlock(BLOCK.CHECKBOX, { content: 'Aplicar o que aprendi em pelo menos 1 projeto/situação' }),

      // CURSOS
      createBlock(BLOCK.HEADING_2, { content: '📚 Cursos & estudos' }),
      createBlock(BLOCK.PARAGRAPH, {
        content: 'Vincule seus cursos da Alura ao bloco abaixo (⋯ → "Anotação e cursos") — o progresso vira média automática.',
      }),
      createBlock(BLOCK.PERCENT, { content: 'Carreira ou trilha principal', progress: 0 }),

      // ROTINA
      createBlock(BLOCK.HEADING_2, { content: '🔁 Rotina' }),
      createBlock(BLOCK.RECURRING, recurringPartial),

      // ANOTAÇÕES
      createBlock(BLOCK.HEADING_2, { content: '📝 Anotações' }),
      createBlock(BLOCK.PARAGRAPH, { content: '' }),
    ],
  };
}

// Cria um doc em branco — só 1 paragraph vazio. Usado quando a pessoa
// quer começar do zero pela tela de boas-vindas.
export function buildBlankDoc() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const endIso = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
  return {
    title: 'Meu PDI',
    type: '',
    role: '',
    department: '',
    emoji: '📄',
    avatarUrl: '',
    focus: '',
    focusTags: [],
    accentId: 'is-data',
    coverEnabled: false,
    cover: '',
    startDate: todayIso,
    endDate: endIso,
    feedzUrl: '',
    blocks: [createBlock(BLOCK.PARAGRAPH, { content: '' })],
  };
}
