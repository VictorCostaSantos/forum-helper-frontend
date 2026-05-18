import { useEffect, useRef } from 'react';
import { useNotifications } from '../../shared/notifications/NotificationsContext';
import { useAllocationSummary, useAllocationItems } from './useAllocationSummary';
import {
  addDays,
  formatPeriodCompact,
  isPerennial,
  mondayOf,
  toISODate,
} from './dateHelpers';
import { getDisplayName, isAdmin, isPlaceholder } from './team';

/*
  Bridge "headless" entre o estado de alocação e a Central de Notificações.

  Cada announce produz mensagem narrativa estilo X/Insta:
    - title    → subject (primeira linha bold). Ex: "Fórum", "Lorena Garcia".
    - body     → texto narrativo descritivo. Ex: "Você foi alocado…".
    - meta[]   → array opcional de { icon, label } com contexto extra
                 (período, equipe, valor). Renderizado em uma 3ª linha
                 cinza com mini-ícones.

  Famílias:
    1. Atividade sem ninguém / pessoa em sobrecarga (estáticos)
    2. Você foi alocado / saiu (diff de snapshot)
    3. Lembretes pessoais (começa amanhã / termina hoje)
    4. Radar admin (ciclo não criado, próxima sem alocação)
    5. Mudança de peso / atividade nova
*/

function readSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeSnapshot(key, snapshot) {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // ignora quota
  }
}

function AllocationAlertsBridge() {
  const summary = useAllocationSummary();
  const items   = useAllocationItems();
  const { announce, dismiss } = useNotifications();
  const lastIdsRef = useRef(new Set());

  /* === Vago + sobrecarga (estáticos, dismiss quando resolve) === */
  useEffect(() => {
    if (!summary?.loaded) return;
    const nextIds = new Set();

    for (const stationName of summary.vagoStations || []) {
      const id = `alloc-vago:${String(stationName).toLowerCase()}`;
      nextIds.add(id);
      announce({
        id,
        kind: 'alloc-vago',
        severity: 'critical',
        icon: 'fa-circle-exclamation',
        title: stationName,
        body: 'Ninguém alocado nesta atividade esta semana.',
        meta: [{ label: 'Atividade fica vaga sem alguém na escala' }],
        route: '/allocation',
      });
    }

    for (const u of summary.dangerUsers || []) {
      const id = `alloc-danger:${u.username}`;
      nextIds.add(id);
      announce({
        id,
        kind: 'alloc-danger',
        severity: 'warning',
        icon: 'fa-bolt',
        avatarUsername: u.username,
        title: u.displayName,
        body: `Está em ${u.pct}% da carga saudável esta semana.`,
        meta: [{ label: 'Considere realocar pra distribuir melhor' }],
        route: '/allocation',
      });
    }

    for (const prevId of lastIdsRef.current) {
      if (!nextIds.has(prevId)) dismiss(prevId);
    }
    lastIdsRef.current = nextIds;
  }, [summary, announce, dismiss]);

  // Cleanup APENAS no unmount real (sem deps). Antes o cleanup estava
  // colado no effect acima e rodava a cada re-render, dispensando alertas
  // permanentemente em loop → congelava o React Router (bug: navegação
  // entre rotas /topics → /catalog não atualizava a UI).
  useEffect(() => () => {
    for (const id of lastIdsRef.current) dismiss(id);
    lastIdsRef.current = new Set();
  }, [dismiss]);

  /* === "Vc foi alocado em X" + "Vc saiu de X" (snapshot diff) === */
  useEffect(() => {
    const username = (localStorage.getItem('forumHelperUsername') || '').trim();
    if (!username) return;
    if (!Array.isArray(items) || items.length === 0) return;

    const SNAP_KEY = `fhAllocSnapshot:${username}`;
    const SEED_KEY = `fhAllocSnapshotSeeded:${username}`;

    // Map id → { name, di, df, peersCount } pra montar mensagens ricas.
    const current = {};
    for (const a of items) {
      if (!a?.id) continue;
      const list = Array.isArray(a.responsaveis) ? a.responsaveis : [];
      if (!list.includes(username)) continue;
      const peers = list.filter((u) => u !== username && !isPlaceholder(u));
      current[a.id] = {
        name: a.nome || 'atividade',
        period: formatPeriodCompact(a),
        peersCount: peers.length,
        peersNames: peers.slice(0, 3).map(getDisplayName).join(', '),
      };
    }

    const seeded = localStorage.getItem(SEED_KEY) === '1';
    const previous = readSnapshot(SNAP_KEY) || {};

    if (seeded) {
      for (const [id, info] of Object.entries(current)) {
        if (previous[id]) continue;
        const peerLabel = info.peersCount === 0
          ? 'Você é a única pessoa na escala'
          : info.peersCount === 1
            ? `Com ${info.peersNames}`
            : `Com ${info.peersNames} e mais ${info.peersCount - (info.peersNames.split(',').length)} pessoa(s)`;
        announce({
          id: `alloc-assigned:${id}`,
          kind: 'alloc-assigned',
          severity: 'info',
          icon: 'fa-user-plus',
          title: info.name,
          body: 'Você foi alocado para esta atividade.',
          meta: [
            { icon: 'fa-regular fa-calendar', label: info.period },
            { icon: 'fa-solid fa-people-group', label: peerLabel },
          ],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
      for (const [id, prev] of Object.entries(previous)) {
        if (current[id]) continue;
        // prev pode ser string (snapshot antigo) ou objeto novo — ambos têm name acessível.
        const prevName = typeof prev === 'string' ? prev : prev?.name || 'atividade';
        announce({
          id: `alloc-unassigned:${id}`,
          kind: 'alloc-unassigned',
          severity: 'info',
          icon: 'fa-user-minus',
          title: prevName,
          body: 'Você não está mais na escala desta atividade.',
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }

    writeSnapshot(SNAP_KEY, current);
    if (!seeded) localStorage.setItem(SEED_KEY, '1');
  }, [items, announce]);

  /* === Lembretes de data + radar admin === */
  useEffect(() => {
    const username = (localStorage.getItem('forumHelperUsername') || '').trim();
    if (!username) return;
    if (!Array.isArray(items) || items.length === 0) return;

    const todayISO = toISODate(new Date());
    const tomorrowISO = toISODate(addDays(new Date(), 1));
    const in7daysISO  = toISODate(addDays(new Date(), 7));
    const monday      = mondayOf(new Date());
    const weekStartISO = toISODate(monday);
    const weekEndISO   = toISODate(addDays(monday, 4));
    const userIsAdmin = isAdmin(username);

    for (const a of items) {
      const di = String(a?.data_inicio || '').slice(0, 10);
      const df = String(a?.data_fim    || '').slice(0, 10);
      const list = Array.isArray(a?.responsaveis) ? a.responsaveis : [];
      if (!list.includes(username)) continue;

      if (di === tomorrowISO) {
        announce({
          id: `alloc-begins:${a.id}:${todayISO}`,
          kind: 'alloc-begins',
          severity: 'info',
          icon: 'fa-clock',
          title: a.nome,
          body: 'Sua alocação começa amanhã.',
          meta: [{ icon: 'fa-regular fa-calendar', label: formatPeriodCompact(a) }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
      if (df === todayISO) {
        announce({
          id: `alloc-ends:${a.id}:${todayISO}`,
          kind: 'alloc-ends',
          severity: 'info',
          icon: 'fa-flag-checkered',
          title: a.nome,
          body: 'Hoje é o último dia da sua alocação.',
          meta: [{ icon: 'fa-regular fa-calendar', label: formatPeriodCompact(a) }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }

    const byName = new Map();
    for (const a of items) {
      const key = String(a?.nome || '').trim().toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, { name: a.nome, instances: [] });
      byName.get(key).instances.push(a);
    }

    for (const st of byName.values()) {
      const sorted = [...st.instances].sort((a, b) => {
        const da = String(a.data_inicio || '').slice(0, 10);
        const db = String(b.data_inicio || '').slice(0, 10);
        return da < db ? -1 : da > db ? 1 : 0;
      });
      const last = sorted[sorted.length - 1];
      if (!last) continue;
      const lastIsPerennial = isPerennial(last);

      if (userIsAdmin && !lastIsPerennial) {
        const lastDf = String(last.data_fim || '').slice(0, 10);
        if (lastDf >= todayISO && lastDf <= in7daysISO) {
          announce({
            // ID sem data — re-anuncia substitui o anterior. Senão gera
            // 1 alerta novo por dia pra mesma estação acabando.
            id: `alloc-cycle:${st.name.toLowerCase()}`,
            kind: 'alloc-cycle-missing',
            severity: 'warning',
            icon: 'fa-rotate',
            title: st.name,
            body: 'Acaba em breve sem próxima ocorrência criada.',
            meta: [
              { icon: 'fa-solid fa-rotate', label: `Última: ${formatPeriodCompact(last)}` },
              { label: 'Estender pra próximo ciclo?' },
            ],
            route: '/allocation',
            timestamp: Date.now(),
          });
        }
      }

      const current = sorted.find((inst) => {
        const di = String(inst.data_inicio || '').slice(0, 10);
        const df = String(inst.data_fim    || '').slice(0, 10);
        return di && df && di <= weekEndISO && df >= weekStartISO;
      });
      if (!current) continue;

      const currentEnd = String(current.data_fim || '').slice(0, 10);
      const next = sorted.find((inst) => String(inst.data_inicio || '').slice(0, 10) > currentEnd);
      if (!next) continue;

      const nextRealList = (next.responsaveis || []).filter((u) => !isPlaceholder(u));
      if (nextRealList.length === 0) {
        announce({
          // ID sem data — re-anuncia substitui o anterior. Sem isso,
          // polui a central com 1 alerta/dia por estação enquanto vazia.
          id: `alloc-next-vago:${st.name.toLowerCase()}`,
          kind: 'alloc-next-vago',
          severity: 'warning',
          icon: 'fa-circle-question',
          title: st.name,
          body: 'Próxima ocorrência sem ninguém escalado.',
          meta: [{ icon: 'fa-regular fa-calendar', label: formatPeriodCompact(next) }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }
  }, [items, announce]);

  /* === Mudança de peso + atividade nova === */
  useEffect(() => {
    const username = (localStorage.getItem('forumHelperUsername') || '').trim();
    if (!username) return;
    if (!Array.isArray(items) || items.length === 0) return;

    const PESO_KEY = `fhAllocPesoSnap:${username}`;
    const PESO_SEED = `${PESO_KEY}:seeded`;
    const currentPeso = {};
    for (const a of items) {
      if (!a?.id) continue;
      const list = Array.isArray(a.responsaveis) ? a.responsaveis : [];
      if (!list.includes(username)) continue;
      currentPeso[a.id] = { peso: Number(a.peso) || 0, nome: a.nome || 'atividade' };
    }
    const pesoSeeded = localStorage.getItem(PESO_SEED) === '1';
    const previousPeso = readSnapshot(PESO_KEY) || {};
    if (pesoSeeded) {
      for (const [id, info] of Object.entries(currentPeso)) {
        const prev = previousPeso[id];
        if (!prev || typeof prev.peso !== 'number') continue;
        if (prev.peso === info.peso) continue;
        const up = info.peso > prev.peso;
        announce({
          id: `alloc-peso:${id}:${info.peso}`,
          kind: 'alloc-peso',
          severity: up ? 'warning' : 'info',
          icon: 'fa-scale-balanced',
          title: info.nome,
          body: `Peso ${prev.peso} → ${info.peso}. ${up ? 'Carga semanal aumentou.' : 'Carga semanal reduziu.'}`,
          meta: [{ label: up ? 'Atenção redobrada' : 'Pode respirar' }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }
    writeSnapshot(PESO_KEY, currentPeso);
    if (!pesoSeeded) localStorage.setItem(PESO_SEED, '1');

    const STA_KEY = `fhAllocStationsSnap:${username}`;
    const STA_SEED = `${STA_KEY}:seeded`;
    const currentStations = {};
    for (const a of items) {
      if (!a?.nome) continue;
      const key = String(a.nome).trim().toLowerCase();
      if (!currentStations[key]) currentStations[key] = a.nome;
    }
    const staSeeded = localStorage.getItem(STA_SEED) === '1';
    const previousStations = readSnapshot(STA_KEY) || {};
    if (staSeeded) {
      for (const [key, name] of Object.entries(currentStations)) {
        if (previousStations[key]) continue;
        announce({
          id: `alloc-new-station:${key}`,
          kind: 'alloc-new-station',
          severity: 'info',
          icon: 'fa-circle-plus',
          title: name,
          body: 'Nova atividade foi criada no painel.',
          meta: [{ label: 'Confira no painel quem está alocado' }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }
    writeSnapshot(STA_KEY, currentStations);
    if (!staSeeded) localStorage.setItem(STA_SEED, '1');
  }, [items, announce]);

  return null;
}

export default AllocationAlertsBridge;
