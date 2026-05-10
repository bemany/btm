import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ScreenId, ThemeMode } from './store/types';
import { ALL_THEMES } from './store/types';
import { useStore } from './store/store';
import { useAuth } from './auth/AuthContext';
import { useLocation, navigate, pathToScreen, SCREEN_TO_PATH } from './router';
import { useIsMobile } from './components/shared/hooks';

// Eager geladen (Initial-Render): Shell + Haupt-Routes
import { Sidebar } from './components/shell/Sidebar';
import { Topbar } from './components/shell/Topbar';
import { BackgroundLayer } from './components/backgrounds/BackgroundLayer';
import {
  loadBackground,
  saveBackground,
  isValidBackgroundId,
  type BackgroundId,
} from './components/backgrounds/catalog';
import * as api from './data/api';
import { MyWeekScreen } from './components/screens/MyWeekScreen';
import { BoardScreen } from './components/board/BoardScreen';
import { ChatBubble } from './components/chat-bubble/ChatBubble';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { ReleaseModal } from './components/onboarding/ReleaseModal';
import { MobileApp } from './components/mobile/MobileApp';

// Lazy: Sekundäre Routes + Drawer (sparen ~150-300 kB initial)
const CapacityScreen = lazy(() =>
  import('./components/screens/CapacityScreen').then((m) => ({ default: m.CapacityScreen })),
);
const TimesScreen = lazy(() =>
  import('./components/screens/TimesScreen').then((m) => ({ default: m.TimesScreen })),
);
const ProjectsScreen = lazy(() =>
  import('./components/screens/ProjectsScreen').then((m) => ({ default: m.ProjectsScreen })),
);
const ReleasesScreen = lazy(() =>
  import('./components/screens/ReleasesScreen').then((m) => ({ default: m.ReleasesScreen })),
);
const InboxScreen = lazy(() =>
  import('./components/screens/InboxScreen').then((m) => ({ default: m.InboxScreen })),
);
const AdminScreen = lazy(() =>
  import('./components/admin/AdminScreen').then((m) => ({ default: m.AdminScreen })),
);
const MobileScreen = lazy(() =>
  import('./components/drawers/MobileScreen').then((m) => ({ default: m.MobileScreen })),
);
const ChromePluginScreen = lazy(() =>
  import('./components/drawers/ChromePluginScreen').then((m) => ({ default: m.ChromePluginScreen })),
);
const TVDashboardScreen = lazy(() =>
  import('./components/drawers/TVDashboardScreen').then((m) => ({ default: m.TVDashboardScreen })),
);
const AIDrawer = lazy(() =>
  import('./components/drawers/AIDrawer').then((m) => ({ default: m.AIDrawer })),
);
const TaskDetailDrawer = lazy(() =>
  import('./components/drawers/TaskDetailDrawer').then((m) => ({ default: m.TaskDetailDrawer })),
);
const ProjectDetailDrawer = lazy(() =>
  import('./components/drawers/ProjectDetailDrawer').then((m) => ({ default: m.ProjectDetailDrawer })),
);
const CommandPalette = lazy(() =>
  import('./components/command-palette/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
const SettingsModal = lazy(() =>
  import('./components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const FeedbackModal = lazy(() =>
  import('./components/feedback/FeedbackModal').then((m) => ({ default: m.FeedbackModal })),
);
type SettingsTabId =
  | 'profile'
  | 'appearance'
  | 'backgrounds'
  | 'language'
  | 'notifications'
  | 'api_tokens'
  | 'data';

function ScreenFallback() {
  return (
    <div style={{ padding: 32, color: 'var(--ink-500)', fontSize: 13 }}>
      Lädt …
    </div>
  );
}

const THEME_STORAGE_KEY = 'btm.theme.v1';

function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (ALL_THEMES as string[]).includes(v)) return v as ThemeMode;
  } catch {
    /* ignore */
  }
  return 'glass';
}

export function App() {
  const drawer = useStore((s) => s.ui.drawer);
  const taskDetailId = useStore((s) => s.ui.taskDetailId);
  const projectDetailId = useStore((s) => s.ui.projectDetailId);
  const currentUser = useStore((s) => s.currentUser);
  const setUI = useStore((s) => s.setUI);
  const setUser = useStore((s) => s.setUser);

  const { user: authUser } = useAuth();

  const location = useLocation();
  const active: ScreenId = pathToScreen(location.pathname) ?? 'week';
  const setActive = useCallback((id: ScreenId) => {
    navigate(SCREEN_TO_PATH[id]);
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const [tourReplay, setTourReplay] = useState(0);
  const [background, setBackgroundState] = useState<BackgroundId>(loadBackground);
  // setBackground: lokaler State sofort, localStorage als Cache fürs nächste
  // Initial-Render, dann fire-and-forget Server-PATCH. Bei Server-Fehler
  // bleibt der lokale Wert trotzdem aktiv — nicht kritisch genug für Toast.
  const setBackground = useCallback((id: BackgroundId) => {
    setBackgroundState(id);
    saveBackground(id);
    void api.updateUserPrefs({ backgroundChoice: id }).catch((e) => {
      console.warn('background save failed', e);
    });
  }, []);
  // AuthUser ist die Source-of-Truth: sobald `me` geladen ist, ggf. den
  // lokalen State auf den Server-Wert ziehen (z.B. nach Login auf einem
  // anderen Gerät, wo localStorage den alten Wert hatte).
  useEffect(() => {
    const serverBg = authUser?.backgroundChoice;
    if (serverBg && isValidBackgroundId(serverBg) && serverBg !== background) {
      setBackgroundState(serverBg);
      saveBackground(serverBg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.backgroundChoice]);
  const isMobile = useIsMobile(768);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  // Eingeloggten User mit dem (lokalen) Store-State synchronisieren —
  // Tasks-Filter (`who === currentUser`) läuft so weiterhin gegen den
  // aktiven User.
  useEffect(() => {
    if (authUser && authUser.id !== currentUser) {
      setUser(authUser.id);
    }
  }, [authUser, currentUser, setUser]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  // Cmd+K → Command-Palette · / → Search · Escape → Drawers schließen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsTab((v) => (v ? null : 'appearance'));
      }
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        document.getElementById('tb-search-input')?.focus();
      }
      if (e.key === 'Escape') {
        const ui = useStore.getState().ui;
        if (ui.drawer || ui.taskDetailId || ui.projectDetailId)
          setUI({ drawer: null, taskDetailId: null, projectDetailId: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUI]);

  // Mobile-Layout: ersetzt Desktop-Sidebar/Topbar komplett durch ein
  // fokussiertes 3-Screen-Setup (Heute · Timer · KI). Drawer + Onboarding
  // bleiben aber verfügbar.
  if (isMobile && authUser) {
    return (
      <>
        <BackgroundLayer theme={theme} id={background} />
        <MobileApp />
        <Suspense fallback={null}>
          {drawer === 'ai' && <AIDrawer setActive={setActive} />}
          {taskDetailId && <TaskDetailDrawer id={taskDetailId} />}
          {projectDetailId && <ProjectDetailDrawer id={projectDetailId} />}
        </Suspense>
        <OnboardingTour replayKey={tourReplay} theme={theme} setTheme={setTheme} />
        <ReleaseModal />
      </>
    );
  }

  return (
    <>
      <BackgroundLayer theme={theme} id={background} />
      <div
        className={`app ${collapsed ? 'sidebar-collapsed' : ''} density-comfortable`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('app') && (e.currentTarget as HTMLElement).classList.contains('sidebar-open')) {
            (e.currentTarget as HTMLElement).classList.remove('sidebar-open');
          }
        }}
      >
        <Sidebar
          active={active}
          setActive={(id) => {
            document.querySelector('.app')?.classList.remove('sidebar-open');
            setActive(id);
          }}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          theme={theme}
          setTheme={setTheme}
          onOpenSettings={(tab) => setSettingsTab(tab ?? 'appearance')}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />
        <Topbar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="app-main">
          <div style={{ height: '100%', overflow: 'auto' }}>
            <Suspense fallback={<ScreenFallback />}>
              {active === 'week' && <MyWeekScreen setActive={setActive} />}
              {active === 'board' && <BoardScreen />}
              {active === 'capacity' && <CapacityScreen />}
              {active === 'times' && <TimesScreen />}
              {active === 'projects' && <ProjectsScreen setActive={setActive} />}
              {active === 'mobile' && <MobileScreen />}
              {active === 'chrome' && <ChromePluginScreen />}
              {active === 'tv' && <TVDashboardScreen />}
              {active === 'releases' && <ReleasesScreen />}
              {active === 'inbox' && <InboxScreen />}
              {active === 'admin' && authUser?.role === 'admin' && <AdminScreen />}
              {active === 'admin' && authUser?.role !== 'admin' && (
                <div className="page">
                  <h1>Kein Zugriff</h1>
                  <p>Diese Seite ist nur für Admins.</p>
                </div>
              )}
            </Suspense>
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        {drawer === 'ai' && <AIDrawer setActive={setActive} />}
        {taskDetailId && <TaskDetailDrawer id={taskDetailId} />}
        {projectDetailId && <ProjectDetailDrawer id={projectDetailId} />}
        {cmdkOpen && <CommandPalette onClose={() => setCmdkOpen(false)} setActive={setActive} />}
        {settingsTab && (
          <SettingsModal
            initialTab={settingsTab}
            theme={theme}
            setTheme={setTheme}
            background={background}
            setBackground={setBackground}
            onReplayTour={() => setTourReplay((n) => n + 1)}
            onClose={() => setSettingsTab(null)}
          />
        )}
        {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      </Suspense>

      <OnboardingTour replayKey={tourReplay} theme={theme} setTheme={setTheme} />
      <ReleaseModal />
      <ChatBubble />
    </>
  );
}
