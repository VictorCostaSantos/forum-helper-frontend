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
    2. Você foi alocado / saiu (diff de snapshot por usuário)
    3. Lembretes pessoais (começa amanhã / termina hoje)
    4. Radar admin (ciclo não criado, próxima sem alocação)
    5. Snapshot por id: peso, nova, removida, renomeada, data alterada
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

  /* === Snapshot por id: peso, nova, removida, renomeada, data alterada ===
     Único effect com snapshot por id pra evitar ruído cruzado. Exemplo: se
     "Fórum" vira "Fórum Helper" via editStation, snapshots separados de
     stations + per-id disparariam 3 alertas (nova + removida + renomeada).
     Aqui detectamos rename PRIMEIRO e suprimimos os falsos new/deleted. */
  useEffect(() => {
    const username = (localStorage.getItem('forumHelperUsername') || '').trim();
    if (!username) return;
    if (!Array.isArray(items) || items.length === 0) return;

    const KEY  = `fhAllocItemsByIdSnap:${username}`;
    const SEED = `${KEY}:seeded`;

    const currentById = {};
    for (const a of items) {
      if (!a?.id) continue;
      currentById[a.id] = {
        nome: a.nome || 'atividade',
        peso: Number(a.peso) || 0,
        di:   String(a?.data_inicio || '').slice(0, 10),
        df:   String(a?.data_fim    || '').slice(0, 10),
        responsaveis: Array.isArray(a.responsaveis) ? a.responsaveis : [],
      };
    }

    const seeded = localStorage.getItem(SEED) === '1';
    const previousById = readSnapshot(KEY) || {};

    if (seeded) {
      // 1) Renomes: id existia, mudou nome. Dedupe por par oldName→newName
      //    pra editStation que renomeia N instâncias virar 1 alerta só.
      const renames = new Map(); // oldKey -> { oldName, newName }
      for (const [id, info] of Object.entries(currentById)) {
        const prev = previousById[id];
        if (!prev?.nome || prev.nome === info.nome) continue;
        const oldKey = String(prev.nome).toLowerCase();
        if (!renames.has(oldKey)) {
          renames.set(oldKey, { oldName: prev.nome, newName: info.nome });
        }
      }
      const renameOldKeys = new Set([...renames.keys()]);
      const renameNewKeys = new Set([...renames.values()].map((r) => String(r.newName).toLowerCase()));

      for (const { oldName, newName } of renames.values()) {
        announce({
          id: `alloc-renamed:${String(oldName).toLowerCase()}→${String(newName).toLowerCase()}`,
          kind: 'alloc-renamed',
          severity: 'info',
          icon: 'fa-pen-to-square',
          title: newName,
          body: `Atividade renomeada de "${oldName}".`,
          meta: [{ label: 'Confira no painel' }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }

      // 2) Conjuntos de chaves de nome pra detectar new/deleted suprimindo renames
      const prevNameKeys = new Set();
      for (const info of Object.values(previousById)) {
        if (info?.nome) prevNameKeys.add(String(info.nome).toLowerCase());
      }
      const currNameKeys = new Set();
      for (const info of Object.values(currentById)) {
        if (info?.nome) currNameKeys.add(String(info.nome).toLowerCase());
      }

      // 3) Novas estações
      const announcedNewKeys = new Set();
      for (const info of Object.values(currentById)) {
        const key = String(info.nome).toLowerCase();
        if (prevNameKeys.has(key)) continue;
        if (renameNewKeys.has(key)) continue;
        if (announcedNewKeys.has(key)) continue;
        announcedNewKeys.add(key);
        announce({
          id: `alloc-new-station:${key}`,
          kind: 'alloc-new-station',
          severity: 'info',
          icon: 'fa-circle-plus',
          title: info.nome,
          body: 'Nova atividade foi criada no painel.',
          meta: [{ label: 'Confira no painel quem está alocado' }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }

      // 4) Estações removidas (todas as instâncias sumiram, e não é rename)
      const announcedDelKeys = new Set();
      for (const info of Object.values(previousById)) {
        if (!info?.nome) continue;
        const key = String(info.nome).toLowerCase();
        if (currNameKeys.has(key)) continue;
        if (renameOldKeys.has(key)) continue;
        if (announcedDelKeys.has(key)) continue;
        announcedDelKeys.add(key);
        announce({
          id: `alloc-station-deleted:${key}`,
          kind: 'alloc-station-deleted',
          severity: 'info',
          icon: 'fa-circle-minus',
          title: info.nome,
          body: 'Atividade foi removida do painel.',
          meta: [{ label: 'Não aparece mais na lista' }],
          route: '/allocation',
          timestamp: Date.now(),
        });
      }

      // 5) Mudança de peso (só pras atividades do usuário). Dedupe por
      //    (nameKey, peso) — editStation propaga pra N instâncias.
      const pesoSeen = new Set();
      for (const [id, info] of Object.entries(currentById)) {
        const prev = previousById[id];
        if (!prev || typeof prev.peso !== 'number' || prev.peso === info.peso) continue;
        const list = info.responsaveis || [];
        if (!list.includes(username)) continue;
        const nameKey = String(info.nome).toLowerCase();
        const dedupeKey = `${nameKey}:${info.peso}`;
        if (pesoSeen.has(dedupeKey)) continue;
        pesoSeen.add(dedupeKey);
        const up = info.peso > prev.peso;
        announce({
          id: `alloc-peso:${nameKey}:${info.peso}`,
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

      // 6) Data alterada (só pras instâncias em que o usuário está agora).
      //    Skip se também foi rename — o alerta de rename já cobre.
      for (const [id, info] of Object.entries(currentById)) {
        const prev = previousById[id];
        if (!prev) continue;
        if (prev.nome !== info.nome) continue;
        if (prev.di === info.di && prev.df === info.df) continue;
        const list = info.responsaveis || [];
        if (!list.includes(username)) continue;
        const fmt = (iso) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';
        const oldRange = prev.di && prev.df ? `${fmt(prev.di)} → ${fmt(prev.df)}` : '';
        const newRange = info.di && info.df ? `${fmt(info.di)} → ${fmt(info.df)}` : '';
        announce({
          id: `alloc-date-changed:${id}:${info.di}-${info.df}`,
          kind: 'alloc-date-changed',
          severity: 'info',
          icon: 'fa-calendar-day',
          title: info.nome,
          body: 'O período da sua alocação mudou.',
          meta: [
            oldRange ? { icon: 'fa-regular fa-calendar-minus', label: `Antes: ${oldRange}` } : null,
            newRange ? { icon: 'fa-regular fa-calendar-check', label: `Agora: ${newRange}` } : null,
          ].filter(Boolean),
          route: '/allocation',
          timestamp: Date.now(),
        });
      }
    }

    writeSnapshot(KEY, currentById);
    if (!seeded) localStorage.setItem(SEED, '1');
  }, [items, announce]);

  return null;
}

export default AllocationAlertsBridge;
