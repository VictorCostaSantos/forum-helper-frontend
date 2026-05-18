/*
  Helpers de data pro quadro semanal (seg–sex).

  Tudo em horário local — atividades não têm hora, só dia. ISO YYYY-MM-DD
  é o formato de troca com o backend (DATEONLY do Sequelize). Cuidado com
  Date#toISOString(), que converte pra UTC e troca o dia quando o usuário
  tá em fuso negativo (BR). Usamos formatadores manuais.
*/

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso) {
  if (!iso) return null;
  // Parsing manual evita o "1 dia a menos" do `new Date('YYYY-MM-DD')` que
  // o JS interpreta como UTC meia-noite e o fuso BR puxa pra 21h do dia
  // anterior.
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

// Domingo=0..Sábado=6. Pra um dia qualquer, devolve a segunda da semana.
export function mondayOf(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dow = d.getDay();
  // Domingo conta como "fim da semana anterior" → -6 dias volta pra segunda
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), delta);
}

// Array de 5 datas: seg, ter, qua, qui, sex
export function workWeekDays(anchor) {
  const monday = mondayOf(anchor);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

export function formatDayShort(date) {
  return DAY_NAMES_SHORT[date.getDay()];
}

export function formatDayNum(date) {
  return date.getDate();
}

// "11–15 de mai" ou "29 abr–3 mai" se cruza mês
export function formatWeekRange(monday) {
  const friday = addDays(monday, 4);
  const sameMonth = monday.getMonth() === friday.getMonth();
  if (sameMonth) {
    return `${monday.getDate()}–${friday.getDate()} de ${MONTH_NAMES_SHORT[monday.getMonth()]}`;
  }
  return `${monday.getDate()} ${MONTH_NAMES_SHORT[monday.getMonth()]}–${friday.getDate()} ${MONTH_NAMES_SHORT[friday.getMonth()]}`;
}

export function isSameISODate(a, b) {
  return toISODate(a) === toISODate(b);
}

export function isToday(date) {
  return isSameISODate(date, new Date());
}

/*
  Calcula a interseção de uma atividade (data_inicio..data_fim, ambas
  inclusive) com os dias úteis visíveis (workWeekDays). Retorna null se a
  atividade não toca a semana visível.

  - startIdx/endIdx: índices 0..4 dentro de weekDays (não dias da semana)
  - extendsLeft: atividade começou antes da segunda visível
  - extendsRight: atividade termina depois da sexta visível
*/
export function computeWeekSegment(activity, weekDays) {
  const aStart = String(activity?.data_inicio || '').slice(0, 10);
  const aEnd   = String(activity?.data_fim   || activity?.data_inicio || '').slice(0, 10);
  if (!aStart || !aEnd) return null;

  const weekStartISO = toISODate(weekDays[0]);
  const weekEndISO   = toISODate(weekDays[weekDays.length - 1]);

  // Sem interseção com a semana visível.
  if (aEnd < weekStartISO || aStart > weekEndISO) return null;

  let startIdx = 0;
  for (let i = 0; i < weekDays.length; i++) {
    if (toISODate(weekDays[i]) >= aStart) { startIdx = i; break; }
  }
  let endIdx = weekDays.length - 1;
  for (let i = weekDays.length - 1; i >= 0; i--) {
    if (toISODate(weekDays[i]) <= aEnd) { endIdx = i; break; }
  }

  // Sanidade: backend valida data_fim >= data_inicio, mas defendemos contra
  // dados sujos vindo de migration manual.
  if (endIdx < startIdx) return null;

  return {
    activity,
    startIdx,
    endIdx,
    extendsLeft:  aStart < weekStartISO,
    extendsRight: aEnd   > weekEndISO,
  };
}

/*
  Detecta cadência cíclica de uma estação a partir das datas de início
  das instâncias. Calcula o intervalo entre instâncias consecutivas e
  classifica em weekly/biweekly/monthly se majoria dos intervalos casa.
  Retorna `null` se não há padrão claro (atividade pontual ou mista).
*/
export function detectCycle(instances) {
  if (!Array.isArray(instances) || instances.length < 2) return null;
  const sorted = [...instances]
    .map((x) => String(x?.data_inicio || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  if (sorted.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = fromISODate(sorted[i - 1]);
    const b = fromISODate(sorted[i]);
    if (!a || !b) continue;
    diffs.push(Math.round((b - a) / 86400000));
  }
  if (diffs.length === 0) return null;
  // Conta ocorrências de cada intervalo conhecido (com tolerância pra mês).
  const classify = (d) => {
    if (d === 7)               return 'weekly';
    if (d === 14)              return 'biweekly';
    if (d >= 28 && d <= 31)    return 'monthly';
    return null;
  };
  const counts = { weekly: 0, biweekly: 0, monthly: 0 };
  for (const d of diffs) {
    const c = classify(d);
    if (c) counts[c]++;
  }
  // Maioria simples > 50% pra dizer que é cíclico.
  const total = diffs.length;
  let winner = null;
  let winnerCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > winnerCount) { winner = k; winnerCount = v; }
  }
  if (winnerCount / total > 0.5) return winner;
  return null;
}

/*
  Greedy lane packing pro layout de barras: ordena por startIdx e atribui
  cada segmento à primeira lane onde não colide com o último segmento já
  colocado. Como a ordenação é por startIdx, basta checar o "topo" de cada
  lane — não precisa varrer a lane inteira.
*/
export function packLanes(segments) {
  const sorted = [...segments].sort((a, b) => a.startIdx - b.startIdx);
  const lanes = [];
  for (const seg of sorted) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.endIdx < seg.startIdx) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }
  return lanes;
}

/*
  Considera uma atividade "perene" quando o range é muito longo (> 6 meses).
  Usado só pra rótulo no UI ("perene" em vez de "14/01/2024 – 31/12/2099").
*/
export const PERENNIAL_MIN_DAYS = 180;

export function isPerennial(activity) {
  if (!activity?.data_inicio || !activity?.data_fim) return false;
  const a = String(activity.data_inicio).slice(0, 10);
  const b = String(activity.data_fim).slice(0, 10);
  if (!a || !b) return false;
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const diff = (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000;
  return diff >= PERENNIAL_MIN_DAYS;
}

/*
  Verdadeiro se o range da atividade tem alguma interseção com a semana
  visível. Atividades perenes (que cobrem a semana toda) sempre passam.
*/
export function overlapsWeek(activity, weekDays) {
  if (!activity?.data_inicio || !activity?.data_fim) return false;
  const aStart = String(activity.data_inicio).slice(0, 10);
  const aEnd   = String(activity.data_fim).slice(0, 10);
  const wStart = toISODate(weekDays[0]);
  const wEnd   = toISODate(weekDays[weekDays.length - 1]);
  return !(aEnd < wStart || aStart > wEnd);
}

/*
  Formato compacto DD/MM pra usar no chip de "Plantão Atual".
*/
export function formatDateShort(iso) {
  const d = fromISODate(String(iso || '').slice(0, 10));
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/*
  Label relativo do período em relação à semana ancorada (segunda):
   - "Esta semana"      → range cruza a semana âncora
   - "Próxima semana"   → começa na semana imediatamente seguinte
   - "Semana passada"   → terminou na anterior
   - "Em N semanas"     → 2..8 semanas adiante
   - "Há N semanas"     → 2..8 semanas atrás
   - cai pra DD/MM-DD/MM se for muito distante ou "Fixo" se perene
*/
export function formatPeriodRelative(activity, anchorMonday) {
  if (!activity?.data_inicio || !activity?.data_fim) return '—';
  if (isPerennial(activity)) return 'Fixo';
  if (!anchorMonday) return formatPeriodCompact(activity);

  const di = fromISODate(String(activity.data_inicio).slice(0, 10));
  const df = fromISODate(String(activity.data_fim).slice(0, 10));
  if (!di || !df) return '—';

  // Segunda da semana do anchor (Monday-Sunday). Compara via dias.
  const wStart = mondayOf(anchorMonday);
  const wEnd   = addDays(wStart, 6);

  // overlap com a semana?
  if (df >= wStart && di <= wEnd) return 'Esta semana';

  // Diferença em semanas (positivo = futuro, negativo = passado).
  // Usamos data_inicio pra "começo da próxima semana".
  const diffDays = Math.round((di - wStart) / 86400000);
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks === 1)  return 'Próxima semana';
  if (diffWeeks === -1) return 'Semana passada';
  if (diffWeeks > 1  && diffWeeks <= 8)  return `Em ${diffWeeks} semanas`;
  if (diffWeeks < -1 && diffWeeks >= -8) return `Há ${Math.abs(diffWeeks)} semanas`;

  // Distante demais — cai pro literal DD/MM-DD/MM.
  return formatPeriodCompact(activity);
}

/*
  "04/05 - 15/05" / "04/05" se for um dia / "Fixo" se range > 6 meses.
*/
export function formatPeriodCompact(activity) {
  if (!activity?.data_inicio || !activity?.data_fim) return '—';
  if (isPerennial(activity)) return 'Fixo';
  const a = formatDateShort(activity.data_inicio);
  const b = formatDateShort(activity.data_fim);
  if (!a || !b) return '—';
  if (a === b) return a;
  return `${a} – ${b}`;
}

/*
  Rótulo amigável do período da atividade — "Fixo", "14–18 mai" se mesmo
  mês, "29 abr–3 mai" se cruza mês, "14 mai (1 dia)" se 1 dia só.
*/
export function formatActivityPeriod(activity) {
  if (!activity?.data_inicio || !activity?.data_fim) return '—';
  if (isPerennial(activity)) return 'Fixo';

  const di = fromISODate(String(activity.data_inicio).slice(0, 10));
  const df = fromISODate(String(activity.data_fim).slice(0, 10));
  if (!di || !df) return '—';

  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  if (isSameISODate(di, df)) {
    return `${di.getDate()} ${months[di.getMonth()]}`;
  }
  if (di.getMonth() === df.getMonth() && di.getFullYear() === df.getFullYear()) {
    return `${di.getDate()}–${df.getDate()} ${months[di.getMonth()]}`;
  }
  return `${di.getDate()} ${months[di.getMonth()]}–${df.getDate()} ${months[df.getMonth()]}`;
}
