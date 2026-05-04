import { useEffect, useRef, useState } from 'react';
import type { LayoutMode, ScreenId, ThemeMode } from './store/types';
import { useStore } from './store/store';
import { useAuth } from './auth/AuthContext';

import { Sidebar } from './components/shell/Sidebar';
import { Topbar } from './components/shell/Topbar';
import { BoardScreen } from './components/board/BoardScreen';
import { MyWeekScreen } from './components/screens/MyWeekScreen';
import { CapacityScreen } from './components/screens/CapacityScreen';
import { TimesScreen } from './components/screens/TimesScreen';
import { ProjectsScreen } from './components/screens/ProjectsScreen';
import { AIDrawer } from './components/drawers/AIDrawer';
import { TaskDetailDrawer } from './components/drawers/TaskDetailDrawer';
import { MobileScreen } from './components/drawers/MobileScreen';
import { ChromePluginScreen } from './components/drawers/ChromePluginScreen';
import { TVDashboardScreen } from './components/drawers/TVDashboardScreen';
import { CommandPalette } from './components/command-palette/CommandPalette';

import {
  TweaksPanel,
  useTweaks,
  TweakSection,
  TweakRadio,
  TweakToggle,
} from './components/tweaks';
import { showToast } from './components/shared/Toast';

type Density = 'comfortable' | 'compact';

interface BTMTweaks {
  sidebarCollapsed: boolean;
  boardLayout: LayoutMode;
  showLiveTimerOnLoad: boolean;
  density: Density;
  theme: ThemeMode;
}

const TWEAK_DEFAULTS: BTMTweaks = {
  sidebarCollapsed: false,
  boardLayout: 'kanban',
  showLiveTimerOnLoad: false,
  density: 'comfortable',
  theme: 'glass',
};

export function App() {
  const layout = useStore((s) => s.ui.layout);
  const drawer = useStore((s) => s.ui.drawer);
  const taskDetailId = useStore((s) => s.ui.taskDetailId);
  const tasks = useStore((s) => s.tasks);
  const timer = useStore((s) => s.timer);
  const currentUser = useStore((s) => s.currentUser);
  const setUI = useStore((s) => s.setUI);
  const setLayout = useStore((s) => s.setLayout);
  const setUser = useStore((s) => s.setUser);
  const startTimer = useStore((s) => s.startTimer);
  const resetDemo = useStore((s) => s.resetDemo);

  const { user: authUser } = useAuth();

  const [active, setActive] = useState<ScreenId>('week');
  const [collapsed, setCollapsed] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const [tweaks, setTweak] = useTweaks<BTMTweaks>(TWEAK_DEFAULTS);

  // Eingeloggten User mit dem (lokalen) Store-State synchronisieren —
  // Tasks-Filter (`who === currentUser`) läuft so weiterhin gegen den
  // aktiven User, bis die Daten-Migration auf Server-State steht.
  useEffect(() => {
    if (authUser && authUser.id !== currentUser) {
      setUser(authUser.id);
    }
  }, [authUser, currentUser, setUser]);

  // Tweaks → live state
  useEffect(() => {
    setCollapsed(!!tweaks.sidebarCollapsed);
  }, [tweaks.sidebarCollapsed]);

  useEffect(() => {
    if (tweaks.boardLayout && tweaks.boardLayout !== layout) {
      setLayout(tweaks.boardLayout);
    }
  }, [tweaks.boardLayout, layout, setLayout]);

  useEffect(() => {
    document.body.dataset.theme = tweaks.theme || 'default';
  }, [tweaks.theme]);

  // First load: ensure a timer is running so the live state is visible (only once per page load)
  const seededTimerRef = useRef(false);
  useEffect(() => {
    if (seededTimerRef.current) return;
    if (!tweaks.showLiveTimerOnLoad || timer) {
      seededTimerRef.current = true;
      return;
    }
    const candidate = tasks.find((t) => t.who === currentUser && t.col === 'doing');
    if (candidate) {
      seededTimerRef.current = true;
      startTimer(candidate.id, true);
      setTimeout(() => {
        const st = useStore.getState();
        if (st.timer) {
          // Backdate the timer so the UI shows ~7 minutes already elapsed.
          useStore.setState({ timer: { ...st.timer, startedAt: Date.now() - 7 * 60 * 1000 } });
        }
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cmd+K → open palette; / → focus search; Escape closes drawers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdkOpen((v) => !v);
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
        if (ui.drawer || ui.taskDetailId) setUI({ drawer: null, taskDetailId: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUI]);

  return (
    <>
      <div className={`app ${collapsed ? 'sidebar-collapsed' : ''} density-${tweaks.density || 'comfortable'}`}>
        <Sidebar
          active={active}
          setActive={setActive}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          theme={tweaks.theme}
          setTheme={(v) => setTweak('theme', v)}
        />
        <Topbar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="app-main">
          <div style={{ height: '100%', overflow: 'auto' }}>
            {active === 'week' && <MyWeekScreen setActive={setActive} />}
            {active === 'board' && <BoardScreen />}
            {active === 'capacity' && <CapacityScreen />}
            {active === 'times' && <TimesScreen />}
            {active === 'projects' && <ProjectsScreen setActive={setActive} />}
            {active === 'mobile' && <MobileScreen />}
            {active === 'chrome' && <ChromePluginScreen />}
            {active === 'tv' && <TVDashboardScreen />}
          </div>
        </main>
      </div>

      {drawer === 'ai' && <AIDrawer setActive={setActive} />}
      {taskDetailId && <TaskDetailDrawer id={taskDetailId} />}
      {cmdkOpen && <CommandPalette onClose={() => setCmdkOpen(false)} setActive={setActive} />}

      <TweaksPanel title="Tweaks · BTM" open={tweaksOpen} onOpenChange={setTweaksOpen}>
        <TweakSection label="Theme">
          <TweakRadio
            label="Aussehen"
            value={tweaks.theme || 'default'}
            options={[
              { value: 'default', label: 'Studio' },
              { value: 'glass', label: 'Glass' },
            ]}
            onChange={(v) => setTweak('theme', v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakToggle
            label="Sidebar eingeklappt"
            value={!!tweaks.sidebarCollapsed}
            onChange={(v) => setTweak('sidebarCollapsed', v)}
          />
          <TweakRadio
            label="Board-Ansicht"
            value={tweaks.boardLayout}
            options={[
              { value: 'kanban', label: 'Kanban' },
              { value: 'list', label: 'Liste' },
              { value: 'timeline', label: 'Timeline' },
            ]}
            onChange={(v) => setTweak('boardLayout', v)}
          />
          <TweakRadio
            label="Dichte"
            value={tweaks.density || 'comfortable'}
            options={[
              { value: 'comfortable', label: 'Komfort' },
              { value: 'compact', label: 'Kompakt' },
            ]}
            onChange={(v) => setTweak('density', v)}
          />
        </TweakSection>
        <TweakSection label="Demo-Daten">
          <TweakToggle
            label="Live-Timer beim Start"
            value={!!tweaks.showLiveTimerOnLoad}
            onChange={(v) => setTweak('showLiveTimerOnLoad', v)}
          />
          <button
            className="twk-btn"
            onClick={() => {
              resetDemo();
              showToast('Demo-Daten zurückgesetzt');
            }}
          >
            Demo-Daten zurücksetzen
          </button>
        </TweakSection>
        <TweakSection label="Hauptflow">
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
            ⌘K → KI-Drawer öffnen → „Aufgaben extrahieren" → „8 Aufgaben anlegen" → landet auf Wochenboard.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}
