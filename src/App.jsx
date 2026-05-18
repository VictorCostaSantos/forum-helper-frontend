import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Header from './shared/components/Header';
import Sidebar from './shared/components/Sidebar';
import SettingsModal from './shared/components/SettingsModal';
import { ToastProvider } from './shared/ui/ToastProvider';
import { TopicsProvider } from './shared/context/TopicsContext';
import { NotificationsProvider, useNotifications } from './shared/notifications/NotificationsContext';
import NotificationsHub from './shared/notifications/NotificationsHub';
import AllocationAlertsBridge from './features/allocation/AllocationAlertsBridge';
import TopicsView from './features/topics/TopicsView';

// Rotas secundárias com lazy load: cortam ~400kB do bundle inicial.
// DashboardView puxa chart.js + chartjs-adapter-date-fns + date-fns;
// MuralView puxa firebase; CatalogView é grande de UI.
// Suspense com fallback simples — fade-in basta enquanto baixa o chunk.
const DashboardView = lazy(() => import('./features/dashboard/DashboardView'));
const MuralView = lazy(() => import('./features/mural/MuralView'));
const CatalogView = lazy(() => import('./features/catalog/CatalogView'));
const StatusView = lazy(() => import('./features/status/StatusView'));
const AllocationView = lazy(() => import('./features/allocation/AllocationView'));
const NotificationsPreviewView = lazy(() => import('./features/notifications-preview/NotificationsPreviewView'));
const PdiView = lazy(() => import('./features/pdi/PdiView'));

// Spinner discreto que ocupa a tela enquanto o chunk baixa. Não usa o
// skeleton-card pq esse Suspense cobre views muito diferentes.
function RouteFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: 'var(--light-text-color)',
      fontSize: '0.9rem',
    }}>
      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
      Carregando…
    </div>
  );
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    username: localStorage.getItem('forumHelperUsername') || '',
    displayName: localStorage.getItem('forumHelperDisplayName') || '',
    meta: localStorage.getItem('forumHelperMeta') || '',
    apiKey: localStorage.getItem('googleApiKey') || '',
    solutionTag: localStorage.getItem('customSolutionTag') || '',
    feedbackTag: localStorage.getItem('customFeedbackTag') || '',
    clickupToken: localStorage.getItem('clickupToken') || '',
  });
  const [theme, setTheme] = useState(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!settings.username || !settings.meta) {
      setSettingsOpen(true);
    }
  }, []);

  const handleSettingsChange = (field, value) => {
    setSettings((current) => {
      const next = { ...current, [field]: value };
      const storageMap = {
        username: 'forumHelperUsername',
        displayName: 'forumHelperDisplayName',
        meta: 'forumHelperMeta',
        apiKey: 'googleApiKey',
        solutionTag: 'customSolutionTag',
        feedbackTag: 'customFeedbackTag',
        clickupToken: 'clickupToken',
      };
      const key = storageMap[field];
      if (key) {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      }
      return next;
    });
  };

  return (
    <ToastProvider>
      <TopicsProvider>
        <NotificationsProvider>
          <BrowserRouter>
            <Layout
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              settings={settings}
              onSettingsChange={handleSettingsChange}
              theme={theme}
              setTheme={setTheme}
            />
          </BrowserRouter>
        </NotificationsProvider>
      </TopicsProvider>
    </ToastProvider>
  );
}

// Redireciona pra /topics PRESERVANDO query string e hash. O <Navigate>
// padrão descarta `?...` e `#...`, o que quebrava o `?testEvent=santander`.
function NavigateToTopics() {
  const location = useLocation();
  return <Navigate replace to={`/topics${location.search}${location.hash}`} />;
}

function Layout({ settingsOpen, setSettingsOpen, settings, onSettingsChange, theme, setTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { bellOpen } = useNotifications();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored !== null) return stored === '1';
    return typeof window !== 'undefined'
      && window.matchMedia('(max-width: 1400px)').matches;
  });

  // Quando a central de notificações abre, força o sidebar fechado pra
  // dar lugar ao dropdown — sem persistir no localStorage. Ao fechar a
  // central, o sidebar volta ao estado anterior automaticamente, porque
  // o effective collapse abaixo respeita o sidebarCollapsed real.
  const effectiveSidebarCollapsed = sidebarCollapsed || bellOpen;

  const isTopicsRoute = location.pathname === '/topics' || location.pathname === '/';
  const isDashboard = location.pathname === '/dashboard';
  const isMural = location.pathname === '/mural';
  const isCatalog = location.pathname === '/catalog';
  const isStatus = location.pathname === '/status';
  const isAllocation = location.pathname === '/allocation';
  const isNotificationsPreview = location.pathname === '/notifications-preview';
  const isPdi = location.pathname === '/pdi';
  const showSidebar = isTopicsRoute && Boolean(settings.username) && Boolean(settings.meta);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    document.body.classList.toggle('dashboard-active', isDashboard);
    document.body.classList.toggle('mural-active', isMural);
    document.body.classList.toggle('catalog-active', isCatalog);
    document.body.classList.toggle('status-active', isStatus);
    document.body.classList.toggle('allocation-active', isAllocation);
    document.body.classList.toggle('notifications-preview-active', isNotificationsPreview);
    document.body.classList.toggle('pdi-active', isPdi);
  }, [isDashboard, isMural, isCatalog, isStatus, isAllocation, isNotificationsPreview, isPdi]);

  // Ponte global pra notificações abrirem o modal de Settings via
  // `action: 'open-settings'`. Mesmo padrão do window.__showToast.
  useEffect(() => {
    window.__openSettings = () => setSettingsOpen(true);
    return () => {
      if (window.__openSettings) delete window.__openSettings;
    };
  }, [setSettingsOpen]);

  return (
    <>
      <div id="toast-container"></div>

      {settings.username ? (
        <>
          <NotificationsHub
            username={settings.username}
            meta={settings.meta}
            clickupToken={settings.clickupToken}
          />
          {/* Bridge headless: alocação → notificações do sino. Watch o sumário
              (compartilhado com o badge do header) e anuncia/dispensa alerts. */}
          <AllocationAlertsBridge />
        </>
      ) : null}

      <Header
        settings={settings}
        onSettingsClick={() => setSettingsOpen(true)}
        onNavigate={navigate}
        currentPath={location.pathname}
      />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<NavigateToTopics />} />
          <Route path="/topics" element={<TopicsView username={settings.username} />} />
          <Route path="/dashboard" element={<DashboardView username={settings.username} />} />
          <Route path="/mural" element={<MuralView username={settings.username} />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/status" element={<StatusView username={settings.username} />} />
          <Route path="/allocation" element={<AllocationView />} />
          <Route path="/notifications-preview" element={<NotificationsPreviewView />} />
          <Route path="/pdi" element={<PdiView />} />
          <Route path="*" element={<NavigateToTopics />} />
        </Routes>
      </Suspense>

      {showSidebar && !effectiveSidebarCollapsed && (
        <div
          className="sidebar-backdrop"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {showSidebar && (
        <Sidebar
          username={settings.username}
          displayName={settings.displayName}
          meta={settings.meta}
          collapsed={effectiveSidebarCollapsed}
          onToggle={toggleSidebar}
        />
      )}

      {/* Renderiza só quando sidebar foi colapsado pelo usuário. Antes
          ficava sempre montado com classe is-visible toggleada — mas o
          box-shadow projetado pra esquerda (-4px) vazava no edge mesmo
          com o botão transladado pra fora. Render condicional resolve. */}
      {showSidebar && sidebarCollapsed && (
        <button
          type="button"
          className="sidebar-reopen-btn is-visible"
          onClick={toggleSidebar}
          aria-label="Reabrir painel"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
      )}

      {settingsOpen && (
        <>
          <div
            className="overlay"
            onClick={() => setSettingsOpen(false)}
          ></div>
          <SettingsModal
            settings={settings}
            theme={theme}
            onChange={onSettingsChange}
            onThemeChange={setTheme}
            onClose={() => setSettingsOpen(false)}
          />
        </>
      )}
    </>
  );
}

export default App;
