import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchUserStats,
  fetchLatamStats,
  fetchFocusData,
  getLatamUsername,
} from '../../api/apiService';
import { useTopics } from '../context/TopicsContext';
import { useNotifications } from './NotificationsContext';
import { runClickUpSync } from './clickupSync';

/*
  Detectores que computam alertas e radar a partir dos dados do app.

  Watchers:
  - Meta batida (1×/dia/região)
  - Pico de tópicos (1×/hora)
  - Foco do dia mudou
  - SLA radar (live, foco-aware)
  - ClickUp tarefas (novas, atrasadas, deadlines próximos)
*/

const FOCUS_SEEN_KEY = 'fhFocusSeen';
const CLICKUP_POLL_MS = 5 * 60 * 1000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function hoursLeftToUrgent(ageInDays) {
  const remainingDays = 1 - (ageInDays || 0);
  return Math.max(0, remainingDays * 24);
}

function formatHoursLeft(hoursLeft) {
  const totalMinutes = Math.max(1, Math.round(hoursLeft * 60));
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function NotificationsHub({ username, meta, clickupToken }) {
  const { topics } = useTopics();
  const { announce, dismiss, setRadarItems, setClickupSummary } = useNotifications();
  const [focusCategories, setFocusCategories] = useState([]);
  const [clickupRadar, setClickupRadar] = useState([]);

  /* ============== CLICKUP CONNECT NUDGE ============== */
  // Onboarding leve: enquanto não tem token, anuncia 1 alerta sticky
  // sugerindo conectar. Quando o token aparece, dispensa automaticamente.
  // Pode ser dispensado pelo user (vai pra dismissedIds e não reaparece).
  useEffect(() => {
    if (!username) return;
    if (clickupToken) {
      dismiss('clickup-not-connected');
      return;
    }
    announce({
      id: 'clickup-not-connected',
      kind: 'clickup-connect',
      severity: 'info',
      icon: 'fa-plug',
      title: 'Conecte seu ClickUp',
      body: 'Tarefas e eventos da operação aparecem aqui depois que vc plugar o token',
      action: 'open-settings',
    });
  }, [username, clickupToken, announce, dismiss]);

  const statsBrRef = useRef({ postsToday: 0, postsMonth: 0 });
  const statsLatamRef = useRef({ postsToday: 0, postsMonth: 0 });

  /* ============== META WATCHER ============== */
  useEffect(() => {
    if (!username || !meta) return undefined;
    let alive = true;

    const checkAndAnnounce = (regionLabel, postsToday, metaNum) => {
      if (postsToday < metaNum) return;
      announce({
        id: `meta-hit-${regionLabel}-${todayISO()}`,
        kind: 'meta-hit',
        icon: 'fa-trophy',
        severity: 'success',
        title: 'Você bateu a meta hoje!',
        body: `${postsToday} / ${metaNum} respondidos · ${regionLabel}`,
      });
    };

    const tick = async () => {
      try {
        const [br, latam] = await Promise.all([
          fetchUserStats(username),
          fetchLatamStats(username),
        ]);
        if (!alive) return;
        statsBrRef.current = br || statsBrRef.current;
        statsLatamRef.current = latam || statsLatamRef.current;
        const metaNum = parseInt(meta, 10);
        if (!Number.isFinite(metaNum) || metaNum <= 0) return;
        checkAndAnnounce('BR', br?.postsToday || 0, metaNum);
        if (getLatamUsername(username)) {
          checkAndAnnounce('LATAM', latam?.postsToday || 0, metaNum);
        }
      } catch {
        // silencia
      }
    };

    tick();
    const id = setInterval(tick, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [username, meta, announce]);

  /* ============== PICO WATCHER ============== */
  // Limiares conservadores: o sinal era impreciso (disparava com 3 tópicos
  // em 2h e 50% acima do "normal"). Agora exige volume ABSOLUTO (>=6) +
  // baseline mínimo (>=2/janela) + pelo menos DOBRO do baseline. Combinado
  // com id-por-dia, fica raríssimo — só dispara quando vale olhar.
  useEffect(() => {
    if (!topics || topics.length === 0) return;

    const recentTopics = topics.filter((t) => (t.ageInDays || 0) < 2 / 24);
    const baselineTopics = topics.filter(
      (t) => (t.ageInDays || 0) >= 2 / 24 && (t.ageInDays || 0) <= 1,
    );

    if (recentTopics.length < 6) return;
    const expectedPerTwoHours = baselineTopics.length / 11;
    if (expectedPerTwoHours < 2) return;

    const ratio = recentTopics.length / expectedPerTwoHours;
    if (ratio < 2.0) return;

    announce({
      id: `peak-${todayISO()}`,
      kind: 'topic-peak',
      icon: 'fa-arrow-trend-up',
      severity: 'warning',
      title: 'Pico de tópicos novos',
      body: `${recentTopics.length} tópicos nas últimas 2h · ${Math.round((ratio - 1) * 100)}% acima do normal`,
    });
  }, [topics, announce]);

  /* ============== FOCO WATCHER ============== */
  useEffect(() => {
    if (!username) return undefined;
    let alive = true;

    (async () => {
      try {
        const focusData = await fetchFocusData();
        if (!alive) return;
        const row = focusData.find(
          (item) => item.nome?.trim().toLowerCase() === username.trim().toLowerCase(),
        );
        if (!row) return;
        const focuses = [row.foco1, row.foco2].filter(Boolean);
        if (!focuses.length) return;

        setFocusCategories(focuses);

        const focusSignature = focuses.join('|');
        const lastSeen = localStorage.getItem(FOCUS_SEEN_KEY);
        if (lastSeen === focusSignature) return;

        if (lastSeen) {
          announce({
            id: `focus-changed-${todayISO()}`,
            kind: 'focus-changed',
            icon: 'fa-bullseye',
            severity: 'info',
            title: 'Foco do dia mudou',
            body: `Agora: ${focuses.join(' + ')}`,
          });
        }
        localStorage.setItem(FOCUS_SEEN_KEY, focusSignature);
      } catch {
        // silencia
      }
    })();

    return () => {
      alive = false;
    };
  }, [username, announce]);

  /* ============== CLICKUP WATCHER ==============
     Polling a cada 5min. Lógica de sync isolada em ./clickupSync.js
     pra ser reaproveitada pelo botão "Sincronizar agora" das Configurações. */
  useEffect(() => {
    if (!clickupToken) {
      setClickupRadar([]);
      setClickupSummary(null);
      return undefined;
    }
    let alive = true;

    const tick = async () => {
      try {
        const result = await runClickUpSync({ token: clickupToken, announce });
        if (!alive) return;
        setClickupRadar(result.radarItems);
        // Publica o resumo agregado pra o dropdown da central renderizar
        // o mini-painel "Panorama ClickUp".
        setClickupSummary({
          totalTasks: result.totalTasks,
          totalEvents: result.totalEvents,
          overdueTotal: result.currentOverdueTotal,
          dueSoonTotal: result.dueSoonTotal,
          liveEventsCount: result.liveEventsCount,
          upcomingEventsCount: result.upcomingEventsCount,
          nextEvent: result.nextEvent,
          taskList: result.taskList || [],
          syncedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[NotificationsHub] ClickUp tick falhou:', err);
      }
    };

    tick();
    const id = setInterval(tick, CLICKUP_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [clickupToken, announce, setClickupSummary]);

  /* ============== SLA RADAR (digest — sem spam por tópico) ============== */
  // Antes: gerava 1 item "vira urgente em Xh" por tópico → 4 itens repetitivos
  // a cada sync. Substituído por:
  //   1. Critical único: "X tópicos > 48h sem resposta" (continua útil, é ação)
  //   2. Digest único: "N tópicos perto de virar urgentes" (1 linha vs 4)
  // Pessoa que quer detalhes vai pra TopicsView; o sininho não precisa repetir.
  const slaRadarItems = useMemo(() => {
    if (!topics || topics.length === 0) return [];

    const items = [];
    const isFocused = (cat) => focusCategories.includes(cat);

    const allCritical = topics.filter((t) => (t.ageInDays || 0) >= 2);
    if (allCritical.length > 0) {
      const focusedCritical = allCritical.find((t) => isFocused(t.category));
      const previewTopic = focusedCritical || allCritical[0];
      const focusedCount = allCritical.filter((t) => isFocused(t.category)).length;
      items.push({
        id: 'sla-critical',
        icon: 'fa-fire-flame-curved',
        severity: 'critical',
        title: `${allCritical.length} tópico${allCritical.length === 1 ? '' : 's'} > 48h sem resposta`,
        body: focusedCount > 0
          ? `${focusedCount} no seu foco · ${previewTopic.title?.slice(0, 56)}`
          : previewTopic.title?.slice(0, 70),
        topicLink: previewTopic.link,
        href: previewTopic.link,
        focused: !!focusedCritical,
      });
    }

    // DIGEST: tópicos no intervalo 12-24h (vão virar urgentes em breve).
    // Em vez de 1 item por tópico, mostra 1 item resumindo o total.
    const soon = topics.filter((t) => {
      const a = t.ageInDays || 0;
      return a >= 0.5 && a < 1;
    });

    if (soon.length >= 2) {
      const focusedSoon = soon.filter((t) => isFocused(t.category));
      const oldest = [...soon].sort((a, b) => (b.ageInDays || 0) - (a.ageInDays || 0))[0];
      const hoursLeft = hoursLeftToUrgent(oldest.ageInDays);

      items.push({
        id: 'sla-soon-digest',
        icon: 'fa-hourglass-half',
        severity: 'warning',
        title: `${soon.length} tópicos perto de virar urgentes`,
        body: focusedSoon.length > 0
          ? `${focusedSoon.length} no seu foco · próximo em ${formatHoursLeft(hoursLeft)}`
          : `Próximo vira urgente em ${formatHoursLeft(hoursLeft)}`,
        topicLink: oldest.link,
        href: oldest.link,
        focused: focusedSoon.length > 0,
      });
    }

    return items;
  }, [topics, focusCategories]);

  // Combina radar de todas as fontes (SLA + ClickUp).
  useEffect(() => {
    setRadarItems([...slaRadarItems, ...clickupRadar]);
  }, [slaRadarItems, clickupRadar, setRadarItems]);

  return null;
}

export default NotificationsHub;
