// Motor de sugestão de foco — função pura, sem React.
//
// A ideia: o Forum Helper deixa de ser um filtro burro por área e passa a
// orientar o atendente sobre ONDE ele tem mais impacto agora. A área dele
// (foco1/foco2 da planilha) é só um sinal — não uma jaula. Quando a área
// dele tá tranquila e outra área tá pegando fogo, o FH sugere atravessar.
//
// Tiers de SLA (em dias de idade do tópico):
//   < 1d   → tranquilo
//   1d-2d  → "estourando" (sla)     — amarelo, pressão baixa/média
//   >= 2d  → "crítico"    (urgent)  — vermelho, ação imediata
//
// Regra de ouro: SLA de 1 dia sozinho NÃO trava o usuário na própria escola
// quando há volume bem maior em outra. A partir de 48h na sua área, prioridade
// absoluta. Pesos hardcoded — ajustar = mudar constante.

import { CATEGORY_BUTTONS, normalizeCategory } from './helpers';

const W_URGENT = 30;     // ageInDays >= 2 (crítico — 48h+)
const W_SLA = 4;         // ageInDays >= 1 (estourando — 24h+)
const W_UNCLAIMED = 2;   // tópico aberto sem dono — proxy de volume/demanda
const W_AREA_BONUS = 5;  // empate: a área do usuário desempata

const SLA_DAYS = 1;
const URGENT_DAYS = 2;

// Limiar pra considerar a fila "agitada" mesmo sem warning/urgent.
const ATTENTION_SLA_THRESHOLD = 3;

function summarize(topics, category) {
  const items = typeof category === 'undefined'
    ? topics
    : topics.filter((t) => t.category === category);
  const sla = items.filter(
    (t) => t.ageInDays >= SLA_DAYS && t.ageInDays < URGENT_DAYS,
  ).length;
  const urgent = items.filter((t) => t.ageInDays >= URGENT_DAYS).length;
  const unclaimed = items.filter((t) => !t.isClaimed).length;
  // warning fica como 0 — campo mantido pra compat com buildStatsForCategory
  // que ainda lê `warning` e mostra um chip se houver. Hoje sempre 0.
  return { category, total: items.length, sla, warning: 0, urgent, unclaimed };
}

// Stats são chips visuais no banner (número grande + label).
// Sem ícone — a cor do chip é o sinalizador. Ordem: do mais urgente pro contextual.
function buildStatsForCategory(summary, opts = {}) {
  const stats = [];
  if (summary.urgent > 0) {
    stats.push({
      value: summary.urgent,
      label: summary.urgent === 1 ? 'crítico · 48h+' : 'críticos · 48h+',
      tone: 'danger',
    });
  }
  if (summary.sla > 0 && opts.includeSla) {
    stats.push({
      value: summary.sla,
      label: summary.sla === 1 ? 'tópico de 1 dia' : 'tópicos de 1 dia',
      tone: 'mild',
    });
  }
  if (opts.includeTotal && summary.total > 0) {
    stats.push({
      value: summary.total,
      label: summary.total === 1 ? 'aberto' : 'abertos',
    });
  }
  return stats;
}

/**
 * Recebe a lista de tópicos normalizada (TopicsContext) e as áreas declaradas
 * do usuário (linha foco1/foco2 da planilha). Retorna um objeto pronto pra UI:
 *
 *   {
 *     kind: 'success' | 'warning' | 'critical' | 'info',
 *     title: string curto,
 *     subtitle: frase curta de orientação,
 *     targetCategory: string | null,        // categoria foco do banner (visual)
 *     recommended: ['Categoria1', ...],     // categorias pra pré-selecionar
 *     stats: [{ icon, value, label, tone? }], // chips visuais
 *     userAreas, summaries                   // dados crus pra debug
 *   }
 */
export function computeFocus(topics = [], userAreasRaw = []) {
  const userAreas = userAreasRaw
    .map((area) => normalizeCategory(area))
    .filter((area) => area && area !== 'Outros');

  const validCategories = CATEGORY_BUTTONS
    .filter((b) => b.category !== 'Todas')
    .map((b) => b.category);

  const summaries = validCategories.map((cat) => {
    const base = summarize(topics, cat);
    const inUserArea = userAreas.includes(cat);
    const score = base.urgent * W_URGENT
      + base.sla * W_SLA
      + base.unclaimed * W_UNCLAIMED
      + (inUserArea ? W_AREA_BONUS : 0);
    return { ...base, inUserArea, score };
  });

  const ranked = summaries
    .filter((s) => s.total > 0)
    .sort((a, b) => b.score - a.score);

  const totalUrgent = summaries.reduce((sum, s) => sum + s.urgent, 0);
  const totalSla = summaries.reduce((sum, s) => sum + s.sla, 0);

  // Caso A: fila vazia
  if (ranked.length === 0) {
    return {
      kind: 'success',
      title: 'Tudo zerado',
      subtitle: 'Nenhum tópico aberto agora — pode respirar.',
      targetCategory: null,
      recommended: [],
      stats: [],
      userAreas,
      summaries,
    };
  }

  const top = ranked[0];
  const userAreaSummaries = summaries.filter((s) => s.inUserArea && s.total > 0);
  const userAreaUrgent = userAreaSummaries.reduce((sum, s) => sum + s.urgent, 0);
  const userAreaSla = userAreaSummaries.reduce((sum, s) => sum + s.sla, 0);
  const userAreaTotal = userAreaSummaries.reduce((sum, s) => sum + s.total, 0);

  // Caso B: nada estourando em lugar nenhum
  if (totalUrgent === 0 && totalSla < ATTENTION_SLA_THRESHOLD) {
    if (userAreaSummaries.length > 0) {
      const cats = userAreaSummaries.map((s) => s.category).join(' e ');
      return {
        kind: 'success',
        title: 'Sua área tá em dia',
        subtitle: `${cats} sem SLA estourado. Pega o que quiser.`,
        targetCategory: userAreaSummaries[0].category,
        recommended: userAreaSummaries.map((s) => s.category),
        stats: [{
          value: userAreaTotal,
          label: userAreaTotal === 1 ? 'aberto na sua área' : 'abertos na sua área',
        }],
        userAreas,
        summaries,
      };
    }
    return {
      kind: 'success',
      title: 'Fila tranquila',
      subtitle: 'Nenhum tópico estourando SLA. Pega o que fizer mais sentido.',
      targetCategory: null,
      recommended: [],
      stats: [],
      userAreas,
      summaries,
    };
  }

  // Caso C: área do usuário tem SLA pesado (>=48h) — foca lá, ignora volume.
  // Atenção: SLA de 1 dia (24h-48h) sozinho NÃO entra aqui. Volume em outra
  // escola vence se a sua só tem 1d. A partir de 48h na sua área, trava.
  if (userAreaUrgent > 0) {
    const target = [...userAreaSummaries].sort((a, b) => b.score - a.score)[0];
    return {
      kind: 'critical',
      title: `Atenção em ${target.category}`,
      subtitle: 'Tópico crítico (48h+) parado na sua área.',
      targetCategory: target.category,
      recommended: [target.category],
      stats: buildStatsForCategory(target, { includeTotal: true }),
      userAreas,
      summaries,
    };
  }

  // Caso D: sua área tá leve (<48h) ou ok. Alguma categoria precisa de braço,
  // por SLA pesado OU por volume sem dono. Sugere atravessar.
  const isUrgent = top.urgent > 0;

  let subtitle;
  if (userAreaSla > 0) {
    subtitle = `Na sua área são ${userAreaSla} de 1 dia. O volume maior tá em ${top.category}.`;
  } else if (userAreaSummaries.length > 0) {
    subtitle = `Sua área (${userAreaSummaries.map((s) => s.category).join(' e ')}) tá tranquila.`;
  } else if (isUrgent) {
    subtitle = 'Tem tópico crítico parado nessa categoria.';
  } else {
    subtitle = 'Volume acumulando nessa categoria.';
  }

  const stats = buildStatsForCategory(top, { includeTotal: true });
  if (userAreaSla > 0) {
    stats.push({
      value: userAreaSla,
      label: userAreaSla === 1 ? 'tópico de 1 dia na sua área' : 'tópicos de 1 dia na sua área',
      tone: 'mild',
    });
  }

  return {
    kind: isUrgent ? 'critical' : 'warning',
    title: `${top.category} precisa de ajuda`,
    subtitle,
    targetCategory: top.category,
    recommended: [top.category],
    stats,
    userAreas,
    summaries,
  };
}
