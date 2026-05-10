// Geführter Onboarding-Tour-Layer.
//
// Wird beim ersten Login (User.onboardingCompletedAt == null) automatisch
// gestartet und kann später aus dem Sidebar-Profil-Menü via onReplayTour
// erneut ausgelöst werden (App.tsx hochgezählter `replayKey`).
//
// Mechanik: Vollflächiger SVG-Backdrop mit „Loch" über dem aktuellen
// Step-Target (Spotlight). Daneben die Erklärungs-Karte. Pfeiltasten /
// Buttons navigieren, Esc / „Überspringen" beendet die Tour und schreibt
// `onboardingCompletedAt` in die DB.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { apiFetch } from '../../lib/api';
import * as api from '../../data/api';
import type { ThemeMode, LayoutMode } from '../../store/types';
import { useStore } from '../../store/store';
import { useT } from '../../i18n';

type StepKind = 'info' | 'theme-picker' | 'view-picker';

interface Step {
  kind?: StepKind;
  selector?: string;
  titleKey: string;
  bodyKey: string;
  beforeShow?: () => void;
  placement?: 'right' | 'left' | 'top' | 'bottom' | 'center';
}

const STEPS: Step[] = [
  { placement: 'center', titleKey: 'onboarding.welcome_title', bodyKey: 'onboarding.welcome_body' },
  { kind: 'theme-picker', placement: 'center', titleKey: 'onboarding.theme_title', bodyKey: 'onboarding.theme_body' },
  { kind: 'view-picker', placement: 'center', titleKey: 'onboarding.view_title', bodyKey: 'onboarding.view_body' },
  {
    selector: '.app-sidebar .sb-section:first-of-type',
    placement: 'right',
    titleKey: 'onboarding.sidebar_title',
    bodyKey: 'onboarding.sidebar_body',
  },
  {
    selector: '#tb-search-input',
    placement: 'bottom',
    titleKey: 'onboarding.search_title',
    bodyKey: 'onboarding.search_body',
  },
  {
    selector: '.app-topbar .tb-btn.accent',
    placement: 'bottom',
    titleKey: 'onboarding.ai_title',
    bodyKey: 'onboarding.ai_body',
  },
  {
    selector: '.app-topbar .tb-bell',
    placement: 'bottom',
    titleKey: 'onboarding.inbox_title',
    bodyKey: 'onboarding.inbox_body',
  },
  {
    selector: '.app-sidebar .sb-foot-wrap',
    placement: 'right',
    titleKey: 'onboarding.profile_title',
    bodyKey: 'onboarding.profile_body',
  },
  { placement: 'center', titleKey: 'onboarding.done_title', bodyKey: 'onboarding.done_body' },
];

interface Props {
  replayKey?: number;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

// Theme- und View-Optionen werden im Render zur t()-Zeit aufgebaut, damit
// Locale-Wechsel sofort greift.
const THEME_IDS: ThemeMode[] = ['glass', 'glass-dark', 'default', 'default-dark'];
const VIEW_IDS: Array<{ id: LayoutMode; icon: string }> = [
  { id: 'kanban', icon: 'kanban-square' },
  { id: 'list', icon: 'list' },
  { id: 'timeline', icon: 'calendar-range' },
];

export function OnboardingTour({ replayKey = 0, theme, setTheme }: Props) {
  const { user, refresh: refreshAuth } = useAuth();
  const setLayout = useStore((s) => s.setLayout);
  const t = useT();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [savedView, setSavedView] = useState<LayoutMode | null>(null);
  // Schutz vor Mehrfach-Starts: useEffect-Deps `[user, replayKey]` feuern
  // sonst auch dann, wenn AuthContext nur die User-Referenz erneuert
  // (z.B. nach refreshAuth im View-Picker). Wir merken uns, welcher
  // replayKey schon verarbeitet wurde — derselbe replayKey startet nicht
  // ein zweites Mal.
  const lastHandledReplayKey = useRef<number>(-1);

  const themeOptions: Array<{ id: ThemeMode; label: string; sub: string }> = [
    { id: 'glass', label: t('onboarding.theme_glass_light'), sub: t('onboarding.theme_glass_light_sub') },
    { id: 'glass-dark', label: t('onboarding.theme_glass_dark'), sub: t('onboarding.theme_glass_dark_sub') },
    { id: 'default', label: t('onboarding.theme_studio_light'), sub: t('onboarding.theme_studio_light_sub') },
    { id: 'default-dark', label: t('onboarding.theme_studio_dark'), sub: t('onboarding.theme_studio_dark_sub') },
  ];
  const viewOptions: Array<{ id: LayoutMode; icon: string; label: string; sub: string }> = [
    { id: 'kanban', icon: 'kanban-square', label: t('onboarding.view_kanban'), sub: t('onboarding.view_kanban_sub') },
    { id: 'list', icon: 'list', label: t('onboarding.view_list'), sub: t('onboarding.view_list_sub') },
    { id: 'timeline', icon: 'calendar-range', label: t('onboarding.view_timeline'), sub: t('onboarding.view_timeline_sub') },
  ];
  void THEME_IDS;
  void VIEW_IDS;

  // Beim Mount / replayKey-Wechsel prüfen, ob die Tour starten soll.
  useEffect(() => {
    if (!user) return;
    // Selber replayKey schon verarbeitet → nicht erneut triggern.
    // Wichtig: useEffect feuert auch wenn `user` die Referenz wechselt
    // (z.B. nach refreshAuth() im View-Picker), und ohne diesen Guard
    // würde dann der Replay-Reset-Pfad mehrfach laufen.
    if (lastHandledReplayKey.current === replayKey) return;
    lastHandledReplayKey.current = replayKey;
    let cancelled = false;
    (async () => {
      try {
        if (replayKey > 0) {
          // Replay: Server-Flag zurücksetzen, dann starten.
          await apiFetch('/me/onboarding/reset', { method: 'POST' });
          if (!cancelled) {
            setStepIdx(0);
            setActive(true);
          }
          return;
        }
        // Initial-Mount: nur starten wenn nicht schon erledigt.
        // Wir vertrauen dem User-Objekt aus AuthContext — kein zweiter
        // /me-Roundtrip nötig (vermeidet Race mit POST /complete).
        if (!user.onboardingCompletedAt) {
          if (!cancelled) {
            setStepIdx(0);
            setActive(true);
          }
        }
      } catch {
        /* ignore — keine Tour-Anzeige bei Auth-Issues */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, replayKey]);

  const step = active ? STEPS[stepIdx] : null;

  // Bounding-Rect des aktuellen Targets messen (mit Resize-Listener).
  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    if (!step.selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setRect(r);
    };
    measure();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [step]);

  const finish = useCallback(async () => {
    setActive(false);
    try {
      await apiFetch('/me/onboarding/complete', { method: 'POST' });
      // AuthContext refreshen, damit `user.onboardingCompletedAt` lokal aktuell
      // ist — sonst kann ein nachfolgender Re-Mount der Komponente die Tour
      // erneut starten (Server sagt zwar OK, aber AuthUser hat noch null).
      await refreshAuth();
    } catch {
      /* still close locally */
    }
  }, [refreshAuth]);

  const next = useCallback(() => {
    if (!active) return;
    if (stepIdx >= STEPS.length - 1) {
      void finish();
      return;
    }
    const nextStep = STEPS[stepIdx + 1];
    nextStep.beforeShow?.();
    setStepIdx((i) => i + 1);
  }, [active, stepIdx, finish]);

  const back = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard-Navigation
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void finish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, finish]);

  // Tooltip-Position berechnen
  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    if (!step) return { display: 'none' };
    const placement = step.placement ?? 'right';
    if (placement === 'center' || !rect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const PAD = 12;
    const TOOLTIP_W = 360;
    switch (placement) {
      case 'right':
        return {
          left: Math.min(rect.right + PAD, window.innerWidth - TOOLTIP_W - PAD),
          top: Math.min(rect.top, window.innerHeight - 240),
        };
      case 'left':
        return {
          left: Math.max(PAD, rect.left - TOOLTIP_W - PAD),
          top: rect.top,
        };
      case 'bottom':
        return {
          left: Math.max(PAD, Math.min(rect.left, window.innerWidth - TOOLTIP_W - PAD)),
          top: rect.bottom + PAD,
        };
      case 'top':
        return {
          left: Math.max(PAD, Math.min(rect.left, window.innerWidth - TOOLTIP_W - PAD)),
          bottom: window.innerHeight - rect.top + PAD,
        };
    }
  }, [step, rect]);

  if (!active || !step) return null;

  // Spotlight-Polygon: ganzer Viewport mit ausgeschnittenem Target-Rect
  const spotlight =
    rect && step.selector ? (
      <svg className="ot-svg" width="100%" height="100%">
        <defs>
          <mask id="ot-spotlight">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={Math.max(0, rect.left - 6)}
              y={Math.max(0, rect.top - 6)}
              width={rect.width + 12}
              height={rect.height + 12}
              rx={8}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#ot-spotlight)" />
        <rect
          x={Math.max(0, rect.left - 6)}
          y={Math.max(0, rect.top - 6)}
          width={rect.width + 12}
          height={rect.height + 12}
          rx={8}
          fill="none"
          stroke="rgba(224,113,64,0.95)"
          strokeWidth="2"
        />
      </svg>
    ) : (
      <div className="ot-fullbackdrop" />
    );

  return (
    <div className="ot-root" role="dialog" aria-modal="true">
      {spotlight}
      <div className="ot-tooltip" style={tooltipStyle}>
        <div className="ot-tooltip-step">
          {t('onboarding.step_label', { n: stepIdx + 1, total: STEPS.length })}
        </div>
        <div className="ot-tooltip-title">{t(step.titleKey as 'onboarding.welcome_title')}</div>
        <div className="ot-tooltip-body">{t(step.bodyKey as 'onboarding.welcome_body')}</div>
        {step.kind === 'theme-picker' && (
          <div className="ot-theme-grid">
            {themeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`ot-theme-card ${theme === opt.id ? 'is-active' : ''}`}
                onClick={() => setTheme(opt.id)}
              >
                <span className={`ot-theme-swatch swatch-${opt.id}`} />
                <span className="ot-theme-card-text">
                  <span className="ot-theme-card-title">{opt.label}</span>
                  <span className="ot-theme-card-sub">{opt.sub}</span>
                </span>
                {theme === opt.id && (
                  <Icon name="check" size={14} className="ot-theme-card-check" />
                )}
              </button>
            ))}
          </div>
        )}
        {step.kind === 'view-picker' && (
          <div className="ot-view-grid">
            {viewOptions.map((opt) => {
              const isActive = savedView === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`ot-view-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    setLayout(opt.id);
                    setSavedView(opt.id);
                    if (user) {
                      void api
                        .updateUser(user.id, { boardDefaultView: opt.id })
                        .then(() => refreshAuth())
                        .catch(() => {
                          /* ignore — UI hat schon umgeschaltet */
                        });
                    }
                  }}
                >
                  <span className="ot-view-icon">
                    <Icon name={opt.icon} size={18} />
                  </span>
                  <span className="ot-view-card-text">
                    <span className="ot-view-card-title">{opt.label}</span>
                    <span className="ot-view-card-sub">{opt.sub}</span>
                  </span>
                  {isActive && <Icon name="check" size={14} className="ot-view-card-check" />}
                </button>
              );
            })}
          </div>
        )}
        <div className="ot-tooltip-actions">
          <button className="ot-btn ghost" onClick={() => void finish()}>
            {t('onboarding.skip')}
          </button>
          <div style={{ flex: 1 }} />
          {stepIdx > 0 && (
            <button className="ot-btn" onClick={back}>
              <Icon name="arrow-left" size={12} /> {t('common.back')}
            </button>
          )}
          <button className="ot-btn primary" onClick={next}>
            {stepIdx < STEPS.length - 1 ? (
              <>
                {t('onboarding.next')} <Icon name="arrow-right" size={12} />
              </>
            ) : (
              <>{t('onboarding.finish')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
