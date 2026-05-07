// Estrutura inicial do PDI — usada como SEED na primeira carga e como
// fallback no botão "Resetar plano". Depois disso, o plano vive editável
// em localStorage (`pdiPlan-v1`), permitindo que cada pessoa adapte ao próprio
// PDI da FEEDZ — títulos, grupos, tarefas, datas, etc.

export const INITIAL_PLAN = {
  title: 'Evolução pessoal — Soft + Hard Skills',
  type: 'Desenvolver',
  role: 'Analista de Suporte Educacional I',
  department: 'Suporte Educacional Alura',
  emoji: '👨‍💻',
  focus: 'Engenharia de IA & Oratória',
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
