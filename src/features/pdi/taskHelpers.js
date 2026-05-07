// Helpers de cálculo pros 3 tipos de tarefa: checkbox, percent, recurring.
// Encapsulado aqui pra `PdiView` ficar enxuto.

export const TASK_TYPES = {
  CHECKBOX: 'checkbox',
  PERCENT: 'percent',
  RECURRING: 'recurring',
};

export const RECURRING_FREQUENCIES = [
  { id: 'daily', label: 'Diária' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
];

// Tipo padrão quando uma tarefa ainda não tem `type` setado. Mantemos
// 'percent' como default pra preservar comportamento das tarefas que
// existiam antes da Fase 2 (já tinham progresso 0-100 sendo editado via
// barra). Uma tarefa nova cai aqui também — usuário muda pelo menu se
// quiser checkbox/recorrente.
export const DEFAULT_TASK_TYPE = TASK_TYPES.PERCENT;

export function getTaskType(taskState) {
  return taskState?.type || DEFAULT_TASK_TYPE;
}

// Formato YYYY-MM-DD pra comparar datas como string (timezone-safe).
function toIsoDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Retorna o "bucket" do período atual em ISO. Pra weekly: ISO da segunda-feira
// daquela semana. Pra monthly: "YYYY-MM-01". Pra daily: o próprio dia.
function periodBucket(frequency, dateInput = new Date()) {
  const date = new Date(dateInput);
  if (frequency === 'daily') return toIsoDate(date);
  if (frequency === 'weekly') {
    // Domingo → 0, Segunda → 1, ... Sábado → 6.
    // Queremos a segunda anterior (ou mesmo dia se já é segunda).
    const dayOfWeek = date.getDay();
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + offsetToMonday);
    return toIsoDate(monday);
  }
  if (frequency === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return toIsoDate(date);
}

export function isCompletedThisPeriod(taskState, today = new Date()) {
  const r = taskState?.recurring;
  if (!r || !r.completedDates) return false;
  const bucket = periodBucket(r.frequency || 'weekly', today);
  return r.completedDates.some((iso) => periodBucket(r.frequency || 'weekly', iso) === bucket);
}

// Streak: quantos períodos consecutivos a tarefa foi completada,
// terminando no período atual. Se a pessoa não fez no período atual mas fez
// no anterior, o streak segue contando — só zera se ela perder um período.
// Pra evitar a sensação chata de "perdeu o streak por nada", consideramos
// que o streak inclui o período atual SE ela já marcou esse período, ou
// segue do período anterior se ela ainda não marcou hoje.
export function calculateStreak(taskState, today = new Date()) {
  const r = taskState?.recurring;
  if (!r || !r.completedDates || r.completedDates.length === 0) return 0;
  const freq = r.frequency || 'weekly';

  // Set de buckets onde teve check.
  const buckets = new Set(r.completedDates.map((iso) => periodBucket(freq, iso)));

  // Vai recuando do bucket atual e contando enquanto encontrar.
  let count = 0;
  let cursor = new Date(today);
  // Se o período atual ainda não foi feito, começa do anterior.
  if (!buckets.has(periodBucket(freq, cursor))) {
    cursor = stepBack(cursor, freq);
  }
  while (buckets.has(periodBucket(freq, cursor))) {
    count += 1;
    cursor = stepBack(cursor, freq);
  }
  return count;
}

function stepBack(date, frequency) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() - 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() - 7);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() - 1);
  return next;
}

// Toggle do "feito no período atual". Se já tem check pro bucket atual,
// remove (todos os checks daquele bucket). Se não tem, adiciona o check
// com hoje.
export function toggleRecurringForToday(taskState, today = new Date()) {
  const r = taskState?.recurring || { frequency: 'weekly', completedDates: [] };
  const freq = r.frequency || 'weekly';
  const todayIso = toIsoDate(today);
  const todayBucket = periodBucket(freq, today);
  const dates = r.completedDates || [];
  const inBucket = dates.some((iso) => periodBucket(freq, iso) === todayBucket);
  if (inBucket) {
    return {
      ...taskState,
      recurring: { ...r, completedDates: dates.filter((iso) => periodBucket(freq, iso) !== todayBucket) },
    };
  }
  return {
    ...taskState,
    recurring: { ...r, completedDates: [...dates, todayIso] },
  };
}

// Progresso EFETIVO da tarefa (0-100). É o número que vai pra média do grupo
// e do plano todo, e que é mostrado se a tarefa não for renderizada com
// componente próprio (raro). Cada tipo retorna um valor coerente:
// - checkbox: 0 ou 100 (binário)
// - percent: o próprio progress (override por cursos vinculados)
// - recurring: 100 se feito no período atual, 0 caso contrário
export function effectiveTaskProgress(taskState, courseMap, today = new Date()) {
  const type = getTaskType(taskState);

  if (type === TASK_TYPES.CHECKBOX) {
    // Sempre manual: a pessoa marca quando se sente pronta. Cursos vinculados
    // são informativos (badge), não controlam o estado.
    return taskState?.progress >= 100 ? 100 : 0;
  }

  if (type === TASK_TYPES.RECURRING) {
    return isCompletedThisPeriod(taskState, today) ? 100 : 0;
  }

  // percent (default) — vínculo com cursos vira média (read-only).
  const linked = taskState?.linkedCourses || [];
  if (linked.length === 0 || !courseMap) return taskState?.progress ?? 0;
  const pcts = linked
    .map((name) => courseMap.get(name))
    .filter(Boolean)
    .map((c) => Number(c.porcentagem_concluida) || 0);
  if (pcts.length === 0) return taskState?.progress ?? 0;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

// Diz se a tarefa pode ter cursos vinculados. Recurring não combina
// (uma "habit" não tem curso atrelado).
export function canLinkCourses(taskState) {
  return getTaskType(taskState) !== TASK_TYPES.RECURRING;
}

// % é derivado SÓ em percent+vínculos. Checkbox e recurring são sempre manuais
// (mesmo com cursos vinculados — esses só viram badge informativo).
export function isProgressDerived(taskState) {
  const type = getTaskType(taskState);
  const linkedCount = (taskState?.linkedCourses || []).length;
  return type === TASK_TYPES.PERCENT && linkedCount > 0;
}
