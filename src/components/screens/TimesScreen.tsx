import { Fragment, useMemo } from 'react';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS, DEMO_DAYS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { TimeCell } from './TimeCell';

export function TimesScreen() {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const setUI = useStore((s) => s.setUI);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);

  const users = useStore((s) => s.users);
  useTick(!!timer);
  const meUser = users.find((u) => u.id === currentUser);
  const me = { name: meUser ? meUser.name.split(' ')[0] || meUser.name : '—' };
  const myTasks = tasks.filter((t) => t.who === currentUser);
  const days = DEMO_DAYS;
  const todayIdx = 0;

  const grid = useMemo(() => {
    const m: Record<string, number[]> = {};
    myTasks.forEach((t) => {
      m[t.id] = days.map(() => 0);
      if (t.sessions && t.sessions.length) {
        t.sessions.forEach((sess) => {
          const di = new Date(sess.from).getDay() - 1;
          if (di >= 0 && di < 5) m[t.id][di] += sess.h;
        });
      } else if (t.loggedH > 0) {
        m[t.id][todayIdx] = t.loggedH;
      }
    });
    return m;
  }, [tasks, currentUser]);

  const liveTask = timer ? tasks.find((t) => t.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">04 · Zeiten</div>
          <h1>Live-Timer + Batch-Eintrag</h1>
          <div className="subtitle">Beides gleichberechtigt · Wochen-Grid: Zelle klicken → Stunden eintragen</div>
        </div>
        <div className="right">
          <button className="tb-btn">
            <Icon name="download" size={14} /> Export CSV
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
                <div>{pomo.mode === 'focus' ? 'FOKUS' : pomo.mode === 'short' ? 'PAUSE' : 'L. PAUSE'}</div>
                <div className="big">{fmtMS(pomo.remaining)}</div>
              </div>
            </div>
          )}
          <div className="info">
            <div className="ey eyebrow">
              Live · läuft seit{' '}
              {new Date(timer.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="t">{liveTask.title}</div>
            <div className="m">
              <ProjTag id={liveTask.proj} /> · geplant {liveTask.estH.toFixed(1).replace('.', ',')}h
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
              {timer.pomodoro ? 'Pomo aus' : 'Pomo an'}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                stopTimer();
                showToast('Timer gestoppt');
              }}
            >
              <Icon name="square" size={12} /> Stoppen
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
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Kein Timer läuft.</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              Klick „Start" auf einer Aufgabe (Wochenboard) · oder Stunden direkt unten ins Grid eintragen
            </div>
          </div>
        </div>
      )}

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Stunden-Grid · {me.name} · KW 19
      </div>
      <div className="tg-grid" style={{ gridTemplateColumns: '2fr repeat(5, 1fr) 80px' }}>
        <div className="tg-cell col-head" style={{ justifyContent: 'flex-start' }}>
          Aufgabe
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
          .filter((t) => t.col !== 'done' || t.loggedH > 0)
          .map((t) => {
            const row = grid[t.id] || [0, 0, 0, 0, 0];
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <Fragment key={t.id}>
                <div
                  className="tg-cell row-head"
                  onClick={() => setUI({ taskDetailId: t.id })}
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
                      {t.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <ProjTag id={t.proj} />
                    </div>
                  </div>
                </div>
                {row.map((v, i) => (
                  <TimeCell key={i} task={t} dayIdx={i} value={v} />
                ))}
                <div className="tg-cell total">{total > 0 ? total.toFixed(1).replace('.', ',') : '—'}</div>
              </Fragment>
            );
          })}
      </div>
    </div>
  );
}
