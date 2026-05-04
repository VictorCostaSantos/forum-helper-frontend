/*
  Lógica de sincronização do ClickUp — extraída pra ser usada tanto pelo
  watcher periódico (NotificationsHub) quanto pelo botão "Sincronizar agora"
  nas Configurações.

  Estado persistido em localStorage:
  - fhClickUpSeen           → IDs de tarefas já vistas (dedupe alertas)
  - fhClickUpOverdueSeen    → IDs já anunciadas como atrasadas
  - fhClickUpEventsSeen     → IDs de eventos do Radar já vistos
  - fhClickUpEvents{N}dSeen → IDs de eventos que já cruzaram o marco de N dias

  Comportamento:
  - First run (seen vazio) → silencia anúncios pra evitar spam de história.
  - Runs subsequentes → anuncia só transições (novas / virou atrasada).
  - Radar (live) → tarefas com deadline em até 24h.
  - Eventos: novo evento + marcos de aproximação (14d, 7d, 1d).
*/

import {
  fetchAllClickUpData,
  fetchClickUpListTasks,
} from '../../api/apiService';

const CLICKUP_SEEN_KEY = 'fhClickUpSeen';
const CLICKUP_OVERDUE_SEEN_KEY = 'fhClickUpOverdueSeen';
const CLICKUP_EVENTS_SEEN_KEY = 'fhClickUpEventsSeen';

// IDs das listas que alimentam os alertas de evento. Extraído da URL do
// ClickUp: na URL /3148001/v/b/6-901324279732-2 o ID da lista é o número
// central (901324279732). Adicione novos IDs aqui se surgir outro Radar.
const EVENT_LIST_IDS = ['901324279732'];

const MS_PER_DAY = 24 * 3600 * 1000;

// Acima desse limiar de itens "novos" no mesmo sync, vira um único alerta
// digest. Evita o flood de "Nova tarefa atribuída" 30× quando a lista do
// ClickUp tem muitas tarefas/eventos vistos pela primeira vez.
const DIGEST_THRESHOLD = 5;

// Marcos de aproximação dos eventos. Ordem importa — o motor escolhe o MENOR
// marco aplicável (ex: evento a 6 dias dispara só o de 7d, não o de 14d junto).
// Severidade escala conforme aproxima: info → warning → critical.
// Adicionar/remover marco = mexer só nesse array.
const EVENT_MARKERS = [
  {
    days: 1,
    storageKey: 'fhClickUpEvents1dSeen',
    severity: 'critical',
    icon: 'fa-circle-exclamation',
    title: 'Evento começa em 1 dia',
  },
  {
    days: 7,
    storageKey: 'fhClickUpEvents7dSeen',
    severity: 'warning',
    icon: 'fa-calendar-week',
    title: 'Evento começa em 1 semana',
  },
  {
    days: 14,
    storageKey: 'fhClickUpEvents14dSeen',
    severity: 'info',
    icon: 'fa-calendar-day',
    title: 'Evento começa em 2 semanas',
  },
];

// Cópia ordenada ascendente pra busca eficiente do menor marco aplicável.
const EVENT_MARKERS_ASC = [...EVENT_MARKERS].sort((a, b) => a.days - b.days);

function readJsonSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveJsonSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // localStorage cheio/desabilitado — silencia.
  }
}

function formatHoursLeft(hoursLeft) {
  const totalMinutes = Math.max(1, Math.round(hoursLeft * 60));
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// Chave do dia atual no formato YYYY-MM-DD. Usado pra IDs de digest —
// um digest por dia evita re-disparo do mesmo digest a cada sync.
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatBrDate(ms) {
  if (!ms) return '';
  const date = new Date(Number(ms));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Eventos podem ter start_date OU due_date (ou ambos). Pega o que existir,
// preferindo start_date — é o "quando começa" que importa pro alerta de 2 semanas.
function getEventDate(task) {
  if (task.start_date) return Number(task.start_date);
  if (task.due_date) return Number(task.due_date);
  return null;
}

/*
  Status que tratamos como "concluído" e devem ser filtrados antes de
  qualquer iteração. Cobre dois casos:

  - status.type === 'closed': é o tipo padrão da ClickUp (Done/Closed).
    O param da API include_closed=false já filtra esses, mas reforçamos
    aqui pra garantir.
  - status.status normalizado em DONE_STATUS_NORMALIZED: custom statuses
    que humanos tratam como "fora do meu radar" mas a API ainda devolve.

  Os nomes ficam aqui já normalizados (sem acentos, lowercase, espaços
  unificados) — a função normalizeStatus aplica a mesma transformação no
  input antes de comparar. Assim "Pós-Produção", "pos producao" e
  "pos-producao" todos viram a mesma chave.

  Pra extender: adicione o nome normalizado abaixo (sem acentos, espaços
  simples). Ex: "in review" cobre "In Review", "in-review", "in_review".
*/
function normalizeStatus(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

const DONE_STATUS_NORMALIZED = new Set([
  // Done genérico em pt-br/en
  'publicado', 'publicada', 'publicados', 'publicadas',
  'feito', 'feita', 'feitos', 'feitas',
  'realizado', 'realizada', 'realizados', 'realizadas',
  'concluido', 'concluida', 'concluidos', 'concluidas',
  'finalizado', 'finalizada',
  'completo', 'completa', 'completed',
  'done',
  'closed', 'fechado', 'fechada',
  'archived', 'arquivado', 'arquivada',
  'resolvido', 'resolvida',
  // Workflow do time de conteúdo — fases que indicam "saiu da minha mesa"
  'inbox pos producao',
  'pos producao',
  'em pos producao',
  'em revisao',
  'in review',
]);

function isTaskDone(task) {
  if (!task || !task.status) return false;
  if (task.status.type === 'closed') return true;
  const normalized = normalizeStatus(task.status.status);
  return DONE_STATUS_NORMALIZED.has(normalized);
}

/* Dedup por id + filtragem de done. ClickUp API às vezes devolve a mesma
   task em workspaces diferentes (mesmo id) — mantemos a primeira ocorrência. */
function cleanTaskList(rawTasks) {
  const seen = new Set();
  const out = [];
  for (const task of rawTasks) {
    if (!task?.id || seen.has(task.id)) continue;
    if (isTaskDone(task)) continue;
    seen.add(task.id);
    out.push(task);
  }
  return out;
}

// Quando ainda não acabou: usa due_date se houver, senão estima janela de
// 1 dia a partir do start. Pessoa que pegou o sistema na ativa precisa saber
// "esse evento começou e ainda tá rolando" — não pode silenciar só porque
// startMs já passou. 1 dia é chute conservador (eventos curtos: dispara
// "live" durante o dia. Eventos longos: edita due_date no ClickUp).
const DEFAULT_LIVE_WINDOW_MS = 24 * 3600 * 1000;

function getEventEndDate(task) {
  const start = getEventDate(task);
  const due = task.due_date ? Number(task.due_date) : null;
  if (due && start && due >= start) return due;
  if (start) return start + DEFAULT_LIVE_WINDOW_MS;
  return null;
}

function isEventLive(task, now = Date.now()) {
  const start = getEventDate(task);
  const end = getEventEndDate(task);
  if (!start || !end) return false;
  return start <= now && now <= end;
}

async function fetchEventTasks(token) {
  const all = [];
  await Promise.all(
    EVENT_LIST_IDS.map(async (listId) => {
      try {
        const tasks = await fetchClickUpListTasks(token, listId);
        all.push(...tasks);
      } catch (err) {
        // Lista pode estar inacessível pro token — segue sem quebrar a sync.
        console.warn(`[ClickUp] Falha ao buscar lista ${listId}:`, err);
      }
    }),
  );
  return all;
}

/*
  Helper pra UI: retorna eventos próximos OU acontecendo agora, normalizados
  pra consumo direto. Usado pelo EventsBanner.

  - Eventos futuros (startMs > now)        → flag `isLive: false`
  - Eventos em andamento (start <= now <= end) → flag `isLive: true`
  - Eventos passados (now > end)           → filtrados fora.

  Quem pega o sistema na ativa precisa ver imediatamente que tem evento ao
  vivo — antes ficava invisível porque só listávamos futuros.
*/
export async function fetchUpcomingEvents(token) {
  if (!token) return [];
  try {
    const tasks = await fetchEventTasks(token);
    const now = Date.now();
    return tasks
      .map((task) => ({
        id: task.id,
        name: task.name || '',
        startMs: getEventDate(task),
        endMs: getEventEndDate(task),
        url: task.url,
        isLive: isEventLive(task, now),
      }))
      .filter((event) => event.startMs && (event.isLive || event.startMs > now));
  } catch (err) {
    console.warn('[ClickUp] Falha ao buscar eventos próximos:', err);
    return [];
  }
}

/*
  Roda uma sincronização do ClickUp.

  @param {string} token        Personal API token do ClickUp.
  @param {function} announce   Callback do NotificationsContext.
  @param {boolean} forceAnnounce  Se true, ignora a proteção de first-run.
                                  Útil pra debugging — força anunciar tudo.
  @returns {Promise<{
    totalTasks: number,
    newAnnounced: number,
    overdueAnnounced: number,
    radarItems: Array,
    wasFirstRun: boolean,
  }>}
*/
export async function runClickUpSync({ token, announce, forceAnnounce = false }) {
  if (!token) throw new Error('Token ClickUp ausente.');

  // Tarefas pessoais + eventos do Radar em paralelo.
  const [{ tasks: rawTasks }, eventTasks] = await Promise.all([
    fetchAllClickUpData(token),
    fetchEventTasks(token),
  ]);
  // Dedupe + remove done. Tudo que vem depois (overdue, dueSoon, taskList,
   // anúncios) opera sobre essa lista limpa — nenhum lugar deve trabalhar
   // com `rawTasks` a partir daqui.
  const tasks = cleanTaskList(rawTasks);

  const seenBefore = readJsonSet(CLICKUP_SEEN_KEY);
  const overdueSeenBefore = readJsonSet(CLICKUP_OVERDUE_SEEN_KEY);
  const eventsSeenBefore = readJsonSet(CLICKUP_EVENTS_SEEN_KEY);
  // Um Set por marco — chaveado pelo days do marco.
  const markerSeenBefore = new Map(
    EVENT_MARKERS.map((m) => [m.days, readJsonSet(m.storageKey)]),
  );
  const isFirstRun = seenBefore.size === 0
    && eventsSeenBefore.size === 0
    && !forceAnnounce;

  const now = Date.now();
  const newSeen = new Set();
  const newOverdueSeen = new Set();
  const newEventsSeen = new Set();
  const newMarkerSeen = new Map(EVENT_MARKERS.map((m) => [m.days, new Set()]));
  const radarItems = [];
  // Buffers — acumulam o que SERIA anunciado individualmente. No fim,
  // decidimos: se o buffer cresceu além do threshold, anuncia 1 digest;
  // senão, anuncia cada item individualmente.
  const newTasksBuffer = [];
  const overdueTasksBuffer = [];
  let newAnnounced = 0;
  let overdueAnnounced = 0;
  let eventNewAnnounced = 0;
  let eventApproachAnnounced = 0;

  // Contadores agregados pra o panorama do dropdown — total atualmente
   // atrasadas e total com vencimento nas próximas 24h. Diferente de
   // overdueAnnounced (que conta só transições novas no sync).
   let currentOverdueTotal = 0;
   let dueSoonTotal = 0;

  tasks.forEach((task) => {
    newSeen.add(task.id);
    const dueMs = task.due_date ? Number(task.due_date) : null;
    const overdue = dueMs && dueMs < now;
    const upcoming24h = dueMs && dueMs >= now && (dueMs - now) <= 24 * 3600 * 1000;
    if (overdue) currentOverdueTotal += 1;
    if (upcoming24h) dueSoonTotal += 1;

    if (!seenBefore.has(task.id) && !isFirstRun) {
      newTasksBuffer.push(task);
    }
    if (overdue && !overdueSeenBefore.has(task.id) && !isFirstRun) {
      overdueTasksBuffer.push(task);
    }
    if (overdue) newOverdueSeen.add(task.id);

    // Radar: deadlines em até 24h (continua live, sem digest aqui — radar
    // é uma seção separada do sininho, não vira alerta persistente)
    if (upcoming24h && dueMs) {
      const hoursLeft = (dueMs - now) / 3600000;
      radarItems.push({
        id: `cu-radar-${task.id}`,
        icon: 'fa-list-check',
        severity: hoursLeft < 1 ? 'critical' : 'warning',
        title: `ClickUp: vence em ${formatHoursLeft(hoursLeft)}`,
        body: task.name?.slice(0, 70),
        href: task.url,
      });
    }
  });

  // ---- Decide digest vs individual pra tarefas novas ----
  if (newTasksBuffer.length > DIGEST_THRESHOLD) {
    announce({
      id: `cu-new-digest-${todayISO()}`,
      kind: 'clickup-new-digest',
      icon: 'fa-list-check',
      severity: 'info',
      title: `${newTasksBuffer.length} novas tarefas atribuídas`,
      body: 'Confira no ClickUp pra ver detalhes.',
      href: 'https://app.clickup.com/',
    });
    newAnnounced = newTasksBuffer.length;
  } else {
    newTasksBuffer.forEach((task) => {
      const dueLabel = task.due_date ? ` · vence ${formatBrDate(Number(task.due_date))}` : '';
      announce({
        id: `cu-new-${task.id}`,
        kind: 'clickup-new',
        icon: 'fa-list-check',
        severity: 'info',
        title: 'Nova tarefa atribuída no ClickUp',
        body: `${task.name?.slice(0, 70)}${dueLabel}`,
        href: task.url,
      });
      newAnnounced += 1;
    });
  }

  // ---- Decide digest vs individual pra atrasadas ----
  if (overdueTasksBuffer.length > DIGEST_THRESHOLD) {
    announce({
      id: `cu-overdue-digest-${todayISO()}`,
      kind: 'clickup-overdue-digest',
      icon: 'fa-circle-exclamation',
      severity: 'critical',
      title: `${overdueTasksBuffer.length} tarefas atrasadas`,
      body: 'Confira no ClickUp pra atualizar prazos.',
      href: 'https://app.clickup.com/',
    });
    overdueAnnounced = overdueTasksBuffer.length;
  } else {
    overdueTasksBuffer.forEach((task) => {
      const dueLabel = task.due_date ? ` · venceu ${formatBrDate(Number(task.due_date))}` : '';
      announce({
        id: `cu-overdue-${task.id}`,
        kind: 'clickup-overdue',
        icon: 'fa-circle-exclamation',
        severity: 'critical',
        title: 'Tarefa atrasada no ClickUp',
        body: `${task.name?.slice(0, 70)}${dueLabel}`,
        href: task.url,
      });
      overdueAnnounced += 1;
    });
  }

  // Eventos do Radar (lista compartilhada, todo mundo do time vê).
  // Anuncia 2 tipos de transição:
  //   1. Tarefa nova na lista (evento futuro) → "Novo evento confirmado".
  //   2. Cruzou um marco de aproximação (14d/7d/1d) → alerta escalando.
  // Eventos novos também usam buffer + digest pra evitar flood.
  const newEventsBuffer = [];

  eventTasks.forEach((task) => {
    newEventsSeen.add(task.id);
    const startMs = getEventDate(task);
    const dateLabel = formatBrDate(startMs);
    const body = dateLabel
      ? `${task.name?.slice(0, 80)} — ${dateLabel}`
      : task.name?.slice(0, 80);

    // Só considera "novo evento" se for FUTURO. Eventos com data passada
    // são silenciados (já rolaram, não fazem sentido anunciar).
    const isFutureEvent = startMs && startMs > now;
    if (!eventsSeenBefore.has(task.id) && !isFirstRun && isFutureEvent) {
      newEventsBuffer.push({ task, body });
    }

    // Evento ACONTECENDO AGORA — dispara um único alerta por evento por dia.
    // O id inclui a data de hoje pra que: (1) reapareça uma vez por dia em
    // eventos longos, e (2) quem chega no meio do dia ainda vê o aviso.
    // Não passa pelo gate de isFirstRun: o "live" é justamente o cenário
    // onde primeira-vez não pode silenciar — é a info mais valiosa pra
    // quem pegou o sistema na ativa.
    if (isEventLive(task, now)) {
      announce({
        id: `cu-event-live-${task.id}-${todayISO()}`,
        kind: 'clickup-event-live',
        icon: 'fa-tower-broadcast',
        severity: 'critical',
        title: 'Evento agora',
        body: task.name?.slice(0, 80) || 'Evento agora',
        href: task.url,
      });
      eventApproachAnnounced += 1;
    }

    if (!startMs) return;
    const daysToStart = (startMs - now) / MS_PER_DAY;
    if (daysToStart <= 0) return; // já começou — não dispara mais marco.

    // Encontra o MENOR marco aplicável. Evento a 6 dias dispara só "1 semana"
    // (não "1 semana" + "2 semanas" juntos). Evento a 0.5 dias dispara só "1 dia".
    const applicable = EVENT_MARKERS_ASC.find((m) => daysToStart <= m.days);
    if (!applicable) return;

    const seenForApplicable = markerSeenBefore.get(applicable.days)?.has(task.id);
    if (!seenForApplicable && !isFirstRun) {
      announce({
        id: `cu-event-${applicable.days}d-${task.id}`,
        kind: `clickup-event-${applicable.days}d`,
        icon: applicable.icon,
        severity: applicable.severity,
        title: applicable.title,
        body,
        href: task.url,
      });
      eventApproachAnnounced += 1;
    }

    // Marca o marco aplicável + todos os MAIORES como vistos. Assim, se o evento
    // entra direto pela janela de 7d (era >14d na sync anterior, agora <=7d), o
    // alerta de 14d não dispara depois — só faria sentido pra eventos que entram
    // na janela "do começo".
    EVENT_MARKERS_ASC.forEach((m) => {
      if (m.days >= applicable.days) {
        newMarkerSeen.get(m.days).add(task.id);
      }
    });
  });

  // ---- Decide digest vs individual pra eventos novos ----
  if (newEventsBuffer.length > DIGEST_THRESHOLD) {
    announce({
      id: `cu-event-new-digest-${todayISO()}`,
      kind: 'clickup-event-new-digest',
      icon: 'fa-calendar-check',
      severity: 'info',
      title: `${newEventsBuffer.length} novos eventos confirmados`,
      body: 'Confira no Radar de Eventos do ClickUp.',
      href: 'https://app.clickup.com/3148001/v/c/30271-247533',
    });
    eventNewAnnounced = newEventsBuffer.length;
  } else {
    newEventsBuffer.forEach(({ task, body }) => {
      announce({
        id: `cu-event-new-${task.id}`,
        kind: 'clickup-event-new',
        icon: 'fa-calendar-check',
        severity: 'info',
        title: 'Novo evento confirmado',
        body,
        href: task.url,
      });
      eventNewAnnounced += 1;
    });
  }

  // Ordena radar por urgência
  radarItems.sort((a, b) => {
    const w = { critical: 0, warning: 1, info: 2 };
    return (w[a.severity] ?? 3) - (w[b.severity] ?? 3);
  });

  saveJsonSet(CLICKUP_SEEN_KEY, newSeen);
  saveJsonSet(CLICKUP_OVERDUE_SEEN_KEY, newOverdueSeen);
  saveJsonSet(CLICKUP_EVENTS_SEEN_KEY, newEventsSeen);
  EVENT_MARKERS.forEach((m) => {
    saveJsonSet(m.storageKey, newMarkerSeen.get(m.days));
  });

  // Próximo evento futuro (mais perto) — usado no panorama do dropdown.
  const futureEvents = eventTasks
    .map((t) => ({ id: t.id, name: t.name || '', startMs: getEventDate(t), url: t.url }))
    .filter((e) => e.startMs && e.startMs > now)
    .sort((a, b) => a.startMs - b.startMs);
  const liveEventsCount = eventTasks.filter((t) => isEventLive(t, now)).length;

  /*
    Lista enxuta das tarefas pessoais pra mostrar na Central de Visualização.
    Filtramos só os campos que a UI consome — payload da API tem dezenas
    de campos extras (custom_fields, watchers, checklists) que pesam
    no localStorage e travam o re-render.

    Ordenação: atrasadas primeiro (mais antigas), depois vencendo em 24h,
    depois pelo due_date asc, sem-due no fim. Limita a 12 — mais que isso
    vira um scroll infinito que o usuário não consegue priorizar.
  */
  const taskList = tasks
    .map((task) => {
      const dueMs = task.due_date ? Number(task.due_date) : null;
      const isOverdue = dueMs && dueMs < now;
      const isDueSoon = dueMs && dueMs >= now && (dueMs - now) <= 24 * 3600 * 1000;
      return {
        id: task.id,
        name: task.name || '',
        url: task.url,
        dueMs,
        isOverdue,
        isDueSoon,
        statusLabel: task.status?.status || null,
        statusColor: task.status?.color || null,
      };
    })
    .sort((a, b) => {
      // Tier ordering: overdue=0, due_soon=1, has_due=2, no_due=3
      const tier = (t) => (t.isOverdue ? 0 : t.isDueSoon ? 1 : t.dueMs ? 2 : 3);
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      // Dentro do mesmo tier, due_date asc (mais urgente primeiro)
      if (a.dueMs && b.dueMs) return a.dueMs - b.dueMs;
      return 0;
    })
    .slice(0, 12);

  return {
    totalTasks: tasks.length,
    totalEvents: eventTasks.length,
    currentOverdueTotal,
    dueSoonTotal,
    liveEventsCount,
    nextEvent: futureEvents[0] || null,
    upcomingEventsCount: futureEvents.length,
    taskList,
    newAnnounced,
    overdueAnnounced,
    eventNewAnnounced,
    eventApproachAnnounced,
    radarItems,
    wasFirstRun: isFirstRun,
  };
}

/*
  Apaga o estado de "seen" do ClickUp — força a próxima sync a tratar TUDO
  como novo (e re-anunciar). Use com cuidado: vai inundar o sininho.
*/
export function resetClickUpSeenState() {
  try {
    localStorage.removeItem(CLICKUP_SEEN_KEY);
    localStorage.removeItem(CLICKUP_OVERDUE_SEEN_KEY);
    localStorage.removeItem(CLICKUP_EVENTS_SEEN_KEY);
    EVENT_MARKERS.forEach((m) => localStorage.removeItem(m.storageKey));
  } catch {
    // silencia
  }
}
