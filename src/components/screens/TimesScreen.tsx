import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS, DEMO_TODAY } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { TimeCell } from './TimeCell';
import { listWeekSessions } from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { useAuth } from '../../auth/AuthContext';
import { useT, useLocale } from '../../i18n';

/** Berechnet den Montag der Woche von `dateISO` (lokal). */
function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + 'T12:00:00'); // Mittagsanker, vermeidet TZ-Drift
  const dow = (d.getDay() || 7) - 1; // Mo=0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** ISO-Wochenzahl (KW) von einem Datum. */
function isoWeek(dateISO: string): number {
  const d = new Date(dateISO + 'T12:00:00');
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function TimesScreen() {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const setUI = useStore((s) => s.setUI);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const users = useStore((s) => s.users);
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin';
  useTick(!!timer);
  const days = [
    t('board.timeline_day_mo'),
    t('board.timeline_day_di'),
    t('board.timeline_day_mi'),
    t('board.timeline_day_do'),
    t('board.timeline_day_fr'),
  ];

  // ── State: ausgewählter User + Wochenanker ───────────────────────
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser ?? '');
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOf(DEMO_TODAY instanceof Date ? DEMO_TODAY.toISOString().slice(0, 10) : String(DEMO_TODAY).slice(0, 10)),
  );

  const targetUser = users.find((u) => u.id === selectedUserId) ?? users.find((u) => u.id === currentUser);
  const me = { name: targetUser ? targetUser.name.split(' ')[0] || targetUser.name : '—' };
  const targetTasks = tasks.filter((tk) => tk.who === selectedUserId);

  // Wochen-Navigation
  const shiftWeek = (deltaDays: number) => {
    const d = new Date(weekStart + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(d.toISOString().slice(0, 10));
  };
  const goToday = () => setWeekStart(mondayOf(new Date().toISOString().slice(0, 10)));
  const friday = useMemo(() => {
    const d = new Date(weekStart + 'T12:00:00');
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);
  const kw = useMemo(() => isoWeek(weekStart), [weekStart]);
  const fmtDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
      day: '2-digit',
      month: '2-digit',
    });

  const sessionsQ = useQuery({
    queryKey: [...SYNC_KEYS.WEEK_SESSIONS, weekStart, selectedUserId],
    queryFn: () => listWeekSessions(weekStart, selectedUserId || undefined),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!selectedUserId,
  });

  const grid = useMemo(() => {
    const m: Record<string, number[]> = {};
    targetTasks.forEach((tk) => {
      m[tk.id] = days.map(() => 0);
    });
    const sessions = sessionsQ.data ?? [];
    for (const s of sessions) {
      const dayDate = new Date(s.day + 'T00:00:00Z');
      const monday = new Date(weekStart + 'T00:00:00Z');
      const di = Math.floor((dayDate.getTime() - monday.getTime()) / 86400000);
      if (di < 0 || di >= 5) continue;
      if (!m[s.taskId]) m[s.taskId] = days.map(() => 0);
      m[s.taskId][di] += s.hours;
    }
    return m;
  }, [targetTasks, sessionsQ.data, weekStart, days]);

  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('times.eyebrow')}</div>
          <h1>{t('times.title_alt')}</h1>
          <div className="subtitle">{t('times.sub_alt')}</div>
        </div>
        <div className="right">
          <button className="tb-btn">
            <Icon name="download" size={14} /> {t('times.export_csv')}
          </button>
        </div>
      </div>

      {/* Wochen-Navigation + User-Picker */}
      <div className="times-toolbar">
        <div className="times-nav">
          <button
            type="button"
            className="times-nav-btn"
            onClick={() => shiftWeek(-7)}
            title={t('times.prev_week')}
            aria-label={t('times.prev_week')}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <div className="times-nav-label">
            <span className="times-nav-kw">KW {kw}</span>
            <span className="times-nav-range">
              {fmtDay(weekStart)} – {fmtDay(friday)}
            </span>
          </div>
          <button
            type="button"
            className="times-nav-btn"
            onClick={() => shiftWeek(7)}
            title={t('times.next_week')}
            aria-label={t('times.next_week')}
          >
            <Icon name="chevron-right" size={14} />
          </button>
          <button type="button" className="times-nav-today" onClick={goToday}>
            {t('common.today')}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {isAdmin && users.length > 1 && (
          <div className="times-user-picker">
            <span className="times-user-picker-label">{t('times.show_for')}</span>
            <div className="times-user-chips">
              {users
                .filter((u) => u.status === 'active')
                .slice(0, 6)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`times-user-chip ${u.id === selectedUserId ? 'is-active' : ''}`}
                    onClick={() => setSelectedUserId(u.id)}
                    title={u.name}
                  >
                    <Avatar id={u.id} size={20} />
                    <span>{u.name.split(' ')[0]}</span>
                  </button>
                ))}
              {users.filter((u) => u.status === 'active').length > 6 && (
                <select
                  className="times-user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {users
                    .filter((u) => u.status === 'active')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>

      {timer && liveTask ? (
        <div className="timer-hero">
          {pomo && (
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
              <ProjTag id={liveTask.proj} /> · {t('week.planned_short', { h: fmtNum(liveTask.estH) })}
            </div>
            {pomo && (
              <div style={{ marginTop: 8 }}>
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
              </div>
            )}
          </div>
          <div className="clock">{fmtHMS(elapsed)}</div>
          <div className="actions">
            <button className="btn" onClick={togglePomodoro}>
              <Icon name="sparkles" size={12} />
              {timer.pomodoro ? t('times.pomo_short_off') : t('times.pomo_short_on')}
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
      ) : (
        <div
          style={{
            background: 'var(--cream-100)',
            border: '1px dashed var(--ink-300)',
            borderRadius: 8,
            padding: 18,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Icon name="timer" size={28} style={{ color: 'var(--ink-400)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t('times.no_timer_running')}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {t('times.no_timer_hint')}
            </div>
          </div>
        </div>
      )}

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {t('times.grid_eyebrow', { name: me.name, kw })}
      </div>
      <div className="tg-grid" style={{ gridTemplateColumns: '2fr repeat(5, 1fr) 80px' }}>
        <div className="tg-cell col-head" style={{ justifyContent: 'flex-start' }}>
          {t('times.grid_task')}
        </div>
        {days.map((d) => (
          <div key={d} className="tg-cell col-head">
            {d}
          </div>
        ))}
        <div className="tg-cell col-head" style={{ background: 'var(--ink-900)', color: 'var(--cream-50)' }}>
          Σ
        </div>
        {targetTasks
          .filter((tk) => tk.col !== 'done' || tk.loggedH > 0)
          .map((tk) => {
            const row = grid[tk.id] || [0, 0, 0, 0, 0];
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <Fragment key={tk.id}>
                <div
                  className="tg-cell row-head"
                  onClick={() => setUI({ taskDetailId: tk.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 13,
                        color: 'var(--ink-900)',
                        fontWeight: 500,
                      }}
                    >
                      {tk.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <ProjTag id={tk.proj} />
                    </div>
                  </div>
                </div>
                {row.map((v, i) => (
                  <TimeCell key={i} task={tk} dayIdx={i} value={v} />
                ))}
                <div className="tg-cell total">{total > 0 ? fmtNum(total) : '—'}</div>
              </Fragment>
            );
          })}
      </div>
    </div>
  );
}
