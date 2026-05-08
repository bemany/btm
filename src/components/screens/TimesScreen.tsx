import { Fragment, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS, DEMO_TODAY } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { TimeCell } from './TimeCell';
import { listWeekSessions } from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { useT, useLocale } from '../../i18n';

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
  useTick(!!timer);
  const meUser = users.find((u) => u.id === currentUser);
  const me = { name: meUser ? meUser.name.split(' ')[0] || meUser.name : '—' };
  const myTasks = tasks.filter((tk) => tk.who === currentUser);
  const days = [
    t('board.timeline_day_mo'),
    t('board.timeline_day_di'),
    t('board.timeline_day_mi'),
    t('board.timeline_day_do'),
    t('board.timeline_day_fr'),
  ];

  const weekStart = useMemo(() => {
    const d = new Date(DEMO_TODAY);
    return d.toISOString().slice(0, 10);
  }, []);

  const sessionsQ = useQuery({
    queryKey: [...SYNC_KEYS.WEEK_SESSIONS, weekStart],
    queryFn: () => listWeekSessions(weekStart),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const grid = useMemo(() => {
    const m: Record<string, number[]> = {};
    myTasks.forEach((tk) => {
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
  }, [myTasks, sessionsQ.data, weekStart, days]);

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
        {t('times.grid_eyebrow', { name: me.name, kw: 19 })}
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
        {myTasks
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
