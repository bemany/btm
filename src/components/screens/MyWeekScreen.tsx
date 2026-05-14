import { useEffect, useState } from 'react';
import type { Project } from '../../store/types';
import { useStore } from '../../store/store';
import type { ScreenId } from '../../store/types';
import { filterAssignableProjects } from '../../lib/projectFilters';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { useT, useLocale } from '../../i18n';
import { CalendarWidget } from './CalendarWidget';

export interface MyWeekScreenProps {
  setActive: (id: ScreenId) => void;
}

export function MyWeekScreen({ setActive }: MyWeekScreenProps) {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const setUI = useStore((s) => s.setUI);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);
  const t = useT();
  const [locale] = useLocale();

  const users = useStore((s) => s.users);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  useTick(!!timer);
  const meUser = users.find((u) => u.id === currentUser);
  const me = meUser
    ? { name: meUser.name.split(' ')[0] || meUser.name, cap: meUser.cap }
    : { name: '—', cap: 40 };
  const myTasks = tasks.filter((tk) => tk.who === currentUser);
  const today = myTasks.filter((tk) => tk.col === 'doing').slice(0, 5);
  const inReview = myTasks.filter((tk) => tk.col === 'review');
  const doneThisWeek = myTasks.filter((tk) => tk.col === 'done');

  const plannedH = myTasks.filter((tk) => tk.col !== 'done').reduce((a, b) => a + b.estH, 0);
  const loggedH = myTasks.reduce((a, b) => a + b.loggedH, 0);
  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('week.eyebrow')}</div>
          <h1>{t('week.title', { name: me.name })}</h1>
          <div className="subtitle">
            {t('week.sub', { kw: 19, dates: t('topbar.meta_week_dates').replace(/^.*?·\s*/, ''), h: me.cap })}
          </div>
        </div>
        <div className="right">
          <button className="tb-btn" onClick={() => setActive('board')}>
            <Icon name="kanban-square" size={14} />
            {t('week.open_board')}
          </button>
        </div>
      </div>

      {timer && liveTask && (
        <div className="timer-hero">
          {pomo ? (
            <div className="pomo-ring-lg">
              <svg viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--ink-700)" strokeWidth="3" opacity="0.5" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={pomo.mode === 'focus' ? 'var(--accent-500)' : 'var(--ok-500)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="175.93"
                  strokeDashoffset={175.93 * (1 - pomo.elapsedInBlock / pomo.total)}
                />
              </svg>
              <div className="lbl">
                <div>
                  {pomo.mode === 'focus'
                    ? t('week.pomo_caps_focus')
                    : pomo.mode === 'short'
                    ? t('week.pomo_caps_short')
                    : t('week.pomo_caps_long')}
                </div>
                <div className="big">{fmtMS(pomo.remaining)}</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 8,
              }}
            >
              <Icon name="timer" size={28} style={{ color: 'var(--accent-500)' }} />
            </div>
          )}
          <div className="info">
            <div className="ey eyebrow">
              {t('week.live_eyebrow', {
                time: new Date(timer.startedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </div>
            <div className="t">{liveTask.title}</div>
            <div className="m">
              <ProjTag id={liveTask.proj} /> · {t('week.planned_short', { h: fmtNum(liveTask.estH) })} ·{' '}
              {t('week.logged_live', { h: fmtNum(liveTask.loggedH + elapsed / 3600000) })}
              {pomo && <> · {t('week.pomo_block', { n: pomo.blocksDone + 1 })}</>}
            </div>
            {pomo && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pomo-dots">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`d ${
                        i < pomo.blocksDone ? 'done' : i === pomo.blocksDone && pomo.mode === 'focus' ? 'now' : ''
                      }`}
                    />
                  ))}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--cream-100)' }}>
                  {t('week.pomo_legend')}
                </span>
              </div>
            )}
          </div>
          <div className="clock">{fmtHMS(elapsed)}</div>
          <div className="actions">
            <button className="btn" onClick={togglePomodoro}>
              <Icon name="sparkles" size={12} />
              {timer.pomodoro ? t('week.pomo_off') : t('week.pomo_on')}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                stopTimer();
                showToast(t('toast.timer_stopped'));
              }}
            >
              <Icon name="square" size={12} /> {t('week.stop')}
            </button>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k">{t('week.kpi_planned')}</div>
          <div className="v">
            {fmtNum(plannedH)}
            <span className="u">h</span>
          </div>
          <div className="d">
            {t('week.kpi_planned_sub', { pct: Math.round((plannedH / me.cap) * 100), cap: me.cap })}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t('week.kpi_logged')}</div>
          <div className="v">
            {fmtNum(loggedH)}
            <span className="u">h</span>
          </div>
          <div className="d">
            {t('week.kpi_logged_sub', { pct: plannedH ? Math.round((loggedH / plannedH) * 100) : 0 })}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t('week.kpi_open')}</div>
          <div className="v">{myTasks.filter((tk) => tk.col !== 'done').length}</div>
          <div className="d">
            {t('week.kpi_open_sub', { count: myTasks.filter((tk) => tk.col === 'doing').length })}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t('week.kpi_done', { kw: 19 })}</div>
          <div className="v">{doneThisWeek.length}</div>
          <div className="d ok">
            {t('week.kpi_done_sub', { h: Math.round(doneThisWeek.reduce((a, b) => a + b.loggedH, 0)) })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t('week.in_progress_now')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {today.length === 0 && (
              <div className="empty-state">
                <Icon name="check-circle-2" size={36} className="icon" />
                <h4>{t('week.empty_doing_title')}</h4>
                <p>{t('week.empty_doing_body')}</p>
              </div>
            )}
            {today.map((tk) => (
              <div
                key={tk.id}
                onClick={() => setUI({ taskDetailId: tk.id })}
                style={{
                  background: 'var(--cream-50)',
                  border: '1px solid var(--ink-100)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <span className="pill doing">{t('week.pill_doing')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{tk.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <ProjTag id={tk.proj} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                      {t('week.task_meta_short', { plan: fmtNum(tk.estH), logged: fmtNum(tk.loggedH) })}
                    </span>
                  </div>
                </div>
                {timer?.taskId === tk.id ? (
                  <button
                    className="timer-btn live"
                    onClick={(e) => {
                      e.stopPropagation();
                      stopTimer();
                    }}
                  >
                    <Icon name="square" size={11} /> {t('week.stop')}
                  </button>
                ) : (
                  <button
                    className="timer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTimer(tk.id, true);
                      showToast(t('week.timer_pomo_started'));
                    }}
                  >
                    <Icon name="play" size={11} /> Start
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t('week.review_section')}
          </div>
          {inReview.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic' }}>
              {t('week.review_empty')}
            </div>
          )}
          {inReview.map((tk) => (
            <div
              key={tk.id}
              onClick={() => setUI({ taskDetailId: tk.id })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-100)',
                borderRadius: 6,
                padding: 10,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <ProjTag id={tk.proj} />
              <div style={{ fontSize: 13, marginTop: 6 }}>{tk.title}</div>
            </div>
          ))}

          <div className="eyebrow" style={{ margin: '20px 0 10px' }}>
            {t('week.quick_action')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="tb-btn"
              style={{ flex: 1, justifyContent: 'center', padding: 12, minWidth: 0 }}
              onClick={() => setQuickStartOpen(true)}
            >
              <Icon name="play" size={13} />
              {t('week.quickstart_btn')}
            </button>
            <button
              type="button"
              className="tb-btn accent"
              style={{ flex: 1, justifyContent: 'center', padding: 12, minWidth: 0 }}
              onClick={() => setUI({ drawer: 'ai' })}
            >
              <Icon name="sparkles" size={14} />
              {t('week.plan_tasks')}
            </button>
          </div>
        </div>
      </div>

      <CalendarWidget
        onOpenSettings={() => {
          window.dispatchEvent(new CustomEvent('btm:open-settings', { detail: { tab: 'calendar' } }));
        }}
      />

      {quickStartOpen && (
        <QuickStartModal
          onClose={() => setQuickStartOpen(false)}
          onStarted={() => setQuickStartOpen(false)}
        />
      )}
    </div>
  );
}

// ── QuickStart-Modal (auf Meine Woche) ─────────────────────────────────
// Schnellster Weg eine neue Aufgabe zu starten:
//   1. Title-Input (required, auto-fokussiert)
//   2. Projekt-Select (required, kein Default — User MUSS wählen)
//   3. „Starten" → laufenden Timer stoppen, Task in col='doing' anlegen,
//      Timer auf die neue Task starten
// Bug-Report Fvyh_H5dNy3 (Benjamin Fiens). Seit 2026-05-14 als Modal —
// vorher inline-Form über der In-Arbeit-Liste, war auf der Seite leicht
// zu übersehen und konkurrierte visuell mit den Task-Cards.
interface QuickStartModalProps {
  onClose: () => void;
  onStarted: () => void;
}
function QuickStartModal({ onClose, onStarted }: QuickStartModalProps) {
  const t = useT();
  const projects = useStore((s) => s.projects);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const addTask = useStore((s) => s.addTask);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);

  const [title, setTitle] = useState('');
  const [proj, setProj] = useState<string>(''); // explizit leer → User muss wählen
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    const trimmed = title.trim();
    if (!trimmed) {
      showToast(t('week.quickstart_need_title'));
      return;
    }
    if (!proj) {
      showToast(t('week.quickstart_need_project'));
      return;
    }
    setBusy(true);
    try {
      // Laufenden Timer stoppen (falls vorhanden) — die alte Task wird so
      // auf Pause gesetzt, ihre erfasste Zeit gespeichert.
      if (timer) {
        await stopTimer();
      }
      const created = await addTask({
        title: trimmed,
        proj,
        col: 'doing',
        prio: 'med',
        estH: 0,
        who: currentUser,
      });
      if (!created) {
        showToast(t('toast.save_failed'));
        setBusy(false);
        return;
      }
      await startTimer(created.id, true);
      showToast(t('week.quickstart_started'));
      onStarted();
    } catch {
      showToast(t('toast.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  // Escape + ⌘↵ Shortcuts auf Modal-Ebene, gleiches Pattern wie
  // NewProjectModal / FeedbackModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, proj, busy]);

  const canSubmit = !busy && title.trim().length > 0 && !!proj;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h3>{t('week.quickstart_btn')}</h3>
          <button type="button" className="x" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>{t('week.quickstart_title_label')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('week.quickstart_title_placeholder')}
              autoFocus
              disabled={busy}
            />
          </div>
          <div className="form-row">
            <label>{t('week.quickstart_project_label')}</label>
            <QuickStartProjectSelect
              value={proj}
              projects={projects}
              currentUserId={currentUser}
              onChange={setProj}
              disabled={busy}
              placeholder={t('week.quickstart_pick_project')}
            />
            <div className="hint">{t('week.quickstart_project_hint')}</div>
          </div>
          {timer && (
            <div className="hint" style={{ marginTop: 12 }}>
              {t('week.quickstart_swap_hint')}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            <Icon name="play" size={12} />
            {timer ? t('week.quickstart_swap_btn') : t('week.quickstart_start_btn')}
            <span style={{ opacity: 0.6, marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘↵</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// QuickStart-Project-Select: gleicher Filter wie ProjectSelect (Favoriten
// first, fremde Privat raus), aber mit eigenem Placeholder/Style damit es
// ins QuickStart-Form passt. Wenn der User noch keine Favoriten gesetzt
// hat, werden alle Projekte gezeigt (sonst leere Liste).
interface QuickStartProjectSelectProps {
  value: string;
  projects: Project[];
  currentUserId: string | null | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
}
function QuickStartProjectSelect({
  value,
  projects,
  currentUserId,
  onChange,
  disabled,
  placeholder,
}: QuickStartProjectSelectProps) {
  const { favorites, others } = filterAssignableProjects(projects, {
    currentUserId,
    showOnlyFavorites: true,
    includeIds: value ? [value] : [],
  });
  return (
    <select
      className="qs-project"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
    >
      <option value="" disabled>{placeholder}</option>
      {favorites.length > 0 && others.length > 0 ? (
        <>
          <optgroup label="★ Favoriten">
            {favorites.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </optgroup>
          <optgroup label="Andere Projekte">
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </optgroup>
        </>
      ) : (
        [...favorites, ...others].map((p) => (
          <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
        ))
      )}
    </select>
  );
}
