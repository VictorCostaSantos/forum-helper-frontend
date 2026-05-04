import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/*
  Modelo:
  - alerts[]    sticky, dispensáveis. Persistem em localStorage.
                Ex: "Você bateu a meta", "Pico de tópicos".
  - radar[]     transient, recomputado pelos watchers. Não persiste.
                Ex: "X vira urgente em 2h".
  - readIds     Set persistido. ID já visto deixa de contar no badge.
  - dismissedIds Set persistido. ID dispensado não reaparece.

  Dispatch idempotente por id — chamar `announce` duas vezes com
  o mesmo id não cria duplicata.
*/

const NotificationsContext = createContext(null);
const STORAGE_KEY = 'fhNotifications';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { alerts: [], readIds: [], dismissedIds: [] };
    const parsed = JSON.parse(raw);
    return {
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
    };
  } catch {
    return { alerts: [], readIds: [], dismissedIds: [] };
  }
}

function saveToStorage({ alerts, readIds, dismissedIds }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        alerts,
        readIds: Array.from(readIds),
        dismissedIds: Array.from(dismissedIds),
      }),
    );
  } catch {
    // localStorage cheio ou desabilitado — silencia.
  }
}

export function NotificationsProvider({ children }) {
  const initial = useMemo(loadFromStorage, []);
  const [alerts, setAlerts] = useState(initial.alerts);
  const [radar, setRadar] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set(initial.readIds));
  const [dismissedIds, setDismissedIds] = useState(() => new Set(initial.dismissedIds));
  // bellOpen vive aqui (em vez de só no NotificationBell) pra que o Layout
  // possa reagir — quando o dropdown abre, o sidebar colapsa pra dar espaço,
  // e restaura ao fechar. Evita conflito visual sem precisar shiftar o
  // dropdown manualmente.
  const [bellOpen, setBellOpen] = useState(false);
  // Resumo do ClickUp atualizado pelo NotificationsHub a cada sync.
  // Usado pelo dropdown da central pra mostrar um mini-painel de
  // panorama (total de tarefas, atrasadas, próximo evento). Quando
  // o token não tá configurado, fica null e o painel some.
  const [clickupSummary, setClickupSummary] = useState(null);

  useEffect(() => {
    saveToStorage({ alerts, readIds, dismissedIds });
  }, [alerts, readIds, dismissedIds]);

  const announce = useCallback((alert) => {
    if (!alert?.id) return;
    setDismissedIds((prevDismissed) => {
      if (prevDismissed.has(alert.id)) return prevDismissed;
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [{ timestamp: Date.now(), ...alert }, ...prev];
      });
      return prevDismissed;
    });
  }, []);

  const dismiss = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setDismissedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      return next;
    });
  }, [alerts]);

  const setRadarItems = useCallback((items) => {
    setRadar(Array.isArray(items) ? items : []);
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !readIds.has(a.id)).length,
    [alerts, readIds],
  );

  const value = useMemo(
    () => ({
      alerts,
      radar,
      readIds,
      unreadCount,
      announce,
      dismiss,
      markRead,
      markAllRead,
      setRadarItems,
      clearAll,
      bellOpen,
      setBellOpen,
      clickupSummary,
      setClickupSummary,
    }),
    [
      alerts,
      radar,
      readIds,
      unreadCount,
      announce,
      dismiss,
      markRead,
      markAllRead,
      setRadarItems,
      clearAll,
      bellOpen,
      clickupSummary,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications precisa estar dentro de <NotificationsProvider>');
  }
  return ctx;
}
