import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/*
  Preferências de notificação — toggle por categoria.

  Cada kind do bridge cai em uma das 6 categorias abaixo. Quando o usuário
  desliga uma categoria, o `announce` ignora silenciosamente os kinds dela
  (não chega a entrar em storage). Default: tudo ligado.

  KIND_TO_CATEGORY mapeia 1-pra-1 kind→key. NOTIF_CATEGORIES é o que o UI
  renderiza, na ordem que aparece no painel de prefs.
*/
export const NOTIF_CATEGORIES = [
  { key: 'actsVago',     label: 'Atividades sem ninguém', icon: 'fa-solid fa-circle-exclamation', hint: 'Estação vaga ou próxima ocorrência sem alocação.' },
  { key: 'selfDanger',   label: 'Sua carga alta',          icon: 'fa-solid fa-bolt',               hint: 'Quando sua carga semanal passa do saudável.' },
  { key: 'selfAssign',   label: 'Você foi alocado/saiu',   icon: 'fa-solid fa-user-pen',           hint: 'Quando alguém te coloca ou tira de uma escala.' },
  { key: 'selfPersonal', label: 'Lembretes pessoais',      icon: 'fa-solid fa-bell',               hint: 'Começa amanhã, termina hoje, peso/data mudaram.' },
  { key: 'panelChanges', label: 'Mudanças no painel',      icon: 'fa-solid fa-circle-info',        hint: 'Atividade nova, renomeada, removida.' },
  { key: 'adminRadar',   label: 'Radar admin',             icon: 'fa-solid fa-shield-halved',      hint: 'Ciclo acabando sem próxima ocorrência criada.' },
];

const KIND_TO_CATEGORY = {
  'alloc-vago':            'actsVago',
  'alloc-next-vago':       'actsVago',
  'alloc-danger':          'selfDanger',
  'alloc-assigned':        'selfAssign',
  'alloc-unassigned':      'selfAssign',
  'alloc-begins':          'selfPersonal',
  'alloc-ends':            'selfPersonal',
  'alloc-date-changed':    'selfPersonal',
  'alloc-peso':            'selfPersonal',
  'alloc-new-station':     'panelChanges',
  'alloc-station-deleted': 'panelChanges',
  'alloc-renamed':         'panelChanges',
  'alloc-cycle-missing':   'adminRadar',
};

function prefsStorageKey() {
  const username = (localStorage.getItem('forumHelperUsername') || '').trim();
  return username ? `fhNotifPrefs:${username}` : 'fhNotifPrefs';
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(prefsStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(prefsStorageKey(), JSON.stringify(prefs));
  } catch {
    // ignora quota
  }
}

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

  // Prefs por categoria. Acesso via ref dentro de announce pra não recriar
  // o callback a cada toggle (o bridge depende de announce nos seus effects).
  const [notifPrefs, setNotifPrefs] = useState(loadPrefs);
  const notifPrefsRef = useRef(notifPrefs);
  useEffect(() => {
    notifPrefsRef.current = notifPrefs;
    savePrefs(notifPrefs);
  }, [notifPrefs]);

  useEffect(() => {
    saveToStorage({ alerts, readIds, dismissedIds });
  }, [alerts, readIds, dismissedIds]);

  const announce = useCallback((alert) => {
    if (!alert?.id) return;
    // Filtra silenciosamente por preferência de categoria. Default = ligado;
    // só bloqueia se explicitamente false (`undefined` continua passando).
    const cat = KIND_TO_CATEGORY[alert.kind];
    if (cat && notifPrefsRef.current[cat] === false) return;
    setDismissedIds((prevDismissed) => {
      if (prevDismissed.has(alert.id)) return prevDismissed;
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [{ timestamp: Date.now(), ...alert }, ...prev];
      });
      return prevDismissed;
    });
  }, []);

  const setNotifPref = useCallback((key, enabled) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !!enabled }));
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
      notifPrefs,
      setNotifPref,
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
      notifPrefs,
      setNotifPref,
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
