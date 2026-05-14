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

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

async function fetchIfStale(force = false) {
  if (cache.inflight) return cache.inflight;
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
    return () => {
      listeners.delete(refresh);
      clearInterval(id);
    };
  }, []);
  return computeSummary(cache.items);
}

// Chamado depois de mutations no painel pra atualizar o badge imediatamente.
export function refreshAllocationSummary() {
  // Limpa o sentinel `__vago__` não importa — o cache só guarda o raw items.
  void PLACEHOLDER_USER;
  return fetchIfStale(true);
}
