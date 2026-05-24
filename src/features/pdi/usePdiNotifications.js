import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications as useGlobalNotifications } from '../../shared/notifications/NotificationsContext';

// Notificações de hábitos do PDI.
//
// Estratégia em duas camadas:
//   1) IN-APP (sempre): chama `announce()` do NotificationsContext central,
//      então a notificação aparece no sino do header do FH como qualquer
//      outro alerta. Funciona com a aba do FH aberta em qualquer rota.
//   2) NAVEGADOR (opcional, com permissão): também dispara Notification
//      do navegador, pra notificar mesmo quando o FH está em background
//      ou em outra aba. Pede permissão uma vez.
//
// Persistência:
//   - dailyReminder ({ enabled, time }) em localStorage `pdiDailyReminder-v1`
//   - schedules ficam no doc do PDI (block.schedule)
//
// Triggers:
//   - dailyReminder: 1x por dia no horário (kind 'pdi-daily')
//   - block.schedule: nos dias/horário de cada hábito (kind 'pdi-habit')

const REMINDER_KEY = 'pdiDailyReminder-v1';

function loadDailyReminder() {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrompido */ }
  return { enabled: false, time: '09:00' };
}

function saveDailyReminder(value) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(value));
  } catch { /* ignore */ }
}

// Próximos eventos a partir do doc + daily reminder. Só o próximo de cada
// source — não enche de eventos.
function computeUpcoming(doc, dailyReminder, fromMs) {
  const events = [];
  const now = fromMs ?? Date.now();

  if (dailyReminder?.enabled && dailyReminder?.time) {
    const [h, m] = dailyReminder.time.split(':').map(Number);
    for (let off = 0; off < 2; off++) {
      const d = new Date(now);
      d.setDate(d.getDate() + off);
      d.setHours(h, m, 0, 0);
      if (d.getTime() > now) {
        events.push({
          at: d.getTime(),
          title: 'Lembrete diário do PDI',
          body: 'Hora de revisar suas metas e hábitos do dia.',
          tag: `pdi-daily-${d.toISOString().slice(0, 10)}`,
          kind: 'pdi-daily',
          icon: 'fa-graduation-cap',
        });
        break;
      }
    }
  }

  (doc?.blocks || []).forEach((block) => {
    if (!block.schedule || !block.schedule.time) return;
    const { days = [], time } = block.schedule;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;

    for (let off = 0; off < 8; off++) {
      const d = new Date(now);
      d.setDate(d.getDate() + off);
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= now) continue;
      const dow = d.getDay();
      if (days.length > 0 && !days.includes(dow)) continue;
      const label = block.content || 'Hábito';
      events.push({
        at: d.getTime(),
        title: label,
        body: 'Hora de praticar esse hábito do seu PDI.',
        tag: `pdi-habit-${block.id}-${d.toISOString().slice(0, 10)}-${time}`,
        kind: 'pdi-habit',
        icon: 'fa-arrows-rotate',
        blockId: block.id,
      });
      break;
    }
  });

  events.sort((a, b) => a.at - b.at);
  return events;
}

export function usePdiNotifications(doc) {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState(() => supported ? Notification.permission : 'unsupported');
  const [dailyReminder, setDailyReminder] = useState(loadDailyReminder);

  // Hook do sistema central — pra entrar no sino do header.
  const { announce } = useGlobalNotifications();
  const announceRef = useRef(announce);
  useEffect(() => { announceRef.current = announce; }, [announce]);

  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const firedTagsRef = useRef(new Set());

  const requestPermission = useCallback(async () => {
    if (!supported) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied';
    }
  }, [supported]);

  const updateDailyReminder = useCallback((patch) => {
    setDailyReminder((curr) => {
      const next = { ...curr, ...patch };
      saveDailyReminder(next);
      return next;
    });
  }, []);

  const upcoming = useMemo(
    () => computeUpcoming(doc, dailyReminder),
    [doc, dailyReminder],
  );

  // Scheduler: agenda próximo evento. Reagenda quando o doc/daily muda.
  // Dispara IN-APP (sino) sempre + Notification do navegador se permission='granted'.
  useEffect(() => {
    let cancelled = false;

    const dispatch = (ev) => {
      if (firedTagsRef.current.has(ev.tag)) return;
      firedTagsRef.current.add(ev.tag);

      // 1) IN-APP via sino do header (sempre)
      try {
        announceRef.current?.({
          id: ev.tag,
          kind: ev.kind,
          title: ev.title,
          body: ev.body,
          icon: ev.icon,
          route: '/pdi',
        });
      } catch { /* ignore */ }

      // 2) Notification do navegador (bonus, só se permissão concedida)
      if (supported && permission === 'granted') {
        try {
          // eslint-disable-next-line no-new
          new Notification(ev.title, { body: ev.body, tag: ev.tag });
        } catch { /* algum browser bloqueia */ }
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const events = computeUpcoming(doc, dailyReminder);
      if (events.length === 0) return;
      const next = events[0];
      const delay = Math.max(0, next.at - Date.now());
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        dispatch(next);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    intervalRef.current = setInterval(scheduleNext, 60_000);

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doc, dailyReminder, supported, permission]);

  return {
    supported,
    permission,
    requestPermission,
    dailyReminder,
    updateDailyReminder,
    upcoming,
  };
}

export { computeUpcoming };
