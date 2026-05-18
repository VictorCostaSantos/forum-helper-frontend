import { useEffect, useState } from 'react';
import { fetchAtividades } from '../../api/apiService';
import { PLACEHOLDER_USER, TEAM, getMaxLoad, isPlaceholder } from './team';
import { addDays, mondayOf, toISODate } from './dateHelpers';

/*
  Sumário de alocação compartilhado entre Header (badge) e AllocationView
  (banner). Mora num "store" no nível de módulo (não Context) — qualquer
  componente que chamar `useAllocationSummary()` recebe os mesmos dados,
  recalculados quando o cache atualiza.

  Custo: 1 request a /atividades a cada 60s (TTL). Mutations chamam
  `refreshAllocationSummary()` pra invalidar imediatamente.
*/

const TTL_MS = 60 * 1000;

const cache = {
  items: null,
  timestamp: 0,
  inflight: null,
};

const listeners = new Set();

/*
  Canal de sincronização entre tabs do mesmo navegador. Quando uma tab
  faz uma mutation (refreshAllocationSummary), publica `{ type: 'refresh' }`
  e as outras tabs também invalidam o cache + refetch. Sem isso, abrir o
  painel em 2 tabs deixava elas dessincronizadas até o próximo tick de 60s.

  Wrap em try/catch porque BroadcastChannel não existe em browsers antigos.
*/
let bc = null;
try {
  bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fhAllocSync') : null;
} catch {
  bc = null;
}

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

async function fetchIfStale(force = false) {
  // Se já tem um fetch em voo e NÃO foi forçado, espera ele. Mas se foi
  // forçado (post-mutation), agenda um novo logo após o atual — o inflight
  // pode ter começado ANTES da mutação chegar no servidor, lendo dados
  // velhos. Sem isso, refresh pós-edit ficava "perdido" e o banner do sino
  // mostrava menos alertas que a realidade.
  if (cache.inflight) {
    if (!force) return cache.inflight;
    return cache.inflight.then(() => fetchIfStale(true));
  }
  if (!force && cache.items && Date.now() - cache.timestamp < TTL_MS) {
    return cache.items;
  }

  // Range bem largo pra capturar perenes + próximos ciclos.
  const monday = mondayOf(new Date());
  const range = {
    dataInicio: toISODate(addDays(monday, -365 * 2)),
    dataFim:    toISODate(addDays(monday, 365)),
  };

  cache.inflight = (async () => {
    try {
      const data = await fetchAtividades(range);
      cache.items = Array.isArray(data) ? data : [];
      cache.timestamp = Date.now();
      notify();
      return cache.items;
    } catch {
      if (!cache.items) cache.items = [];
      notify();
      return cache.items;
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
}

function computeSummary(items) {
  if (!Array.isArray(items)) items = [];

  const monday = mondayOf(new Date());
  const wkStart = toISODate(monday);
  const wkEnd   = toISODate(addDays(monday, 4));

  // Agrupa por nome → estação.
  const byName = new Map();
  for (const a of items) {
    const key = String(a?.nome || '').trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, { name: a.nome, instances: [] });
    byName.get(key).instances.push(a);
  }

  const vagoStations = [];   // estações cujo currentShift está vago
  const totalsByUser = new Map();
  for (const m of TEAM) totalsByUser.set(m.username, 0);

  for (const st of byName.values()) {
    // currentShift = qualquer instância que cruza a semana de hoje.
    const current = st.instances.find((inst) => {
      const di = String(inst?.data_inicio || '').slice(0, 10);
      const df = String(inst?.data_fim    || '').slice(0, 10);
      return di && df && di <= wkEnd && df >= wkStart;
    });
    if (!current) continue;

    const list = Array.isArray(current.responsaveis) ? current.responsaveis : [];
    const realList = list.filter((u) => !isPlaceholder(u));

    if (realList.length === 0) vagoStations.push(st.name);

    const peso = Number(current.peso) || 0;
    for (const u of realList) {
      if (totalsByUser.has(u)) totalsByUser.set(u, totalsByUser.get(u) + peso);
    }
  }

  const dangerUsers = [];
  for (const m of TEAM) {
    const pts = totalsByUser.get(m.username) || 0;
    const max = Math.max(1, getMaxLoad(m.username));
    const pct = Math.round((pts / max) * 100);
    if (pct >= 90) dangerUsers.push({ username: m.username, displayName: m.displayName, pct });
  }

  return {
    vagoCount: vagoStations.length,
    vagoStations,
    dangerCount: dangerUsers.length,
    dangerUsers,
    total: vagoStations.length + dangerUsers.length,
    // Cor predominante do badge: vermelho se há vago; senão âmbar (só danger).
    tone: vagoStations.length > 0 ? 'danger' : (dangerUsers.length > 0 ? 'warn' : 'ok'),
    loaded: cache.items !== null,
  };
}

export function useAllocationSummary() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    listeners.add(refresh);
    fetchIfStale();
    const id = setInterval(() => fetchIfStale(true), TTL_MS);

    // Quando a aba volta a ficar visível, força fetch imediato. Cobre o
    // caso "estava com outra coisa aberta, alguém mexeu, voltei pro app"
    // sem esperar o próximo tick de 60s.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchIfStale(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Outra tab fez mutation → invalida e refaz fetch aqui também.
    const onMessage = (event) => {
      if (event?.data?.type === 'refresh') {
        fetchIfStale(true);
      }
    };
    bc?.addEventListener('message', onMessage);

    return () => {
      listeners.delete(refresh);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      bc?.removeEventListener('message', onMessage);
    };
  }, []);
  return computeSummary(cache.items);
}

/*
  Expõe os items raw do cache compartilhado pra quem precisa diffar
  mudanças (ex: bridge que detecta "vc foi alocado em X"). Mesmo store
  do useAllocationSummary — sem novo fetch.
*/
export function useAllocationItems() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    listeners.add(refresh);
    fetchIfStale();
    return () => { listeners.delete(refresh); };
  }, []);
  return Array.isArray(cache.items) ? cache.items : [];
}

// Chamado depois de mutations no painel pra atualizar o badge imediatamente.
// Também publica no canal de sync pra que outras tabs do mesmo browser
// reajam — quem aceitou uma cobertura noutra aba não vê estado defasado.
export function refreshAllocationSummary() {
  // Limpa o sentinel `__vago__` não importa — o cache só guarda o raw items.
  void PLACEHOLDER_USER;
  try { bc?.postMessage({ type: 'refresh' }); } catch { /* canal fechou */ }
  return fetchIfStale(true);
}
