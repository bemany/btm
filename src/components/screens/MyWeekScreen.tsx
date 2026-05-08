import { useStore } from '../../store/store';
import type { ScreenId } from '../../store/types';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { useT, useLocale } from '../../i18n';

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
          <button
            className="tb-btn accent"
            style={{ width: '100%', justifyContent: 'center', padding: 12 }}
            onClick={() => setUI({ drawer: 'ai' })}
          >
            <Icon name="sparkles" size={14} />
            {t('week.plan_tasks')}
          </button>
        </div>
      </div>
    </div>
  );
}
