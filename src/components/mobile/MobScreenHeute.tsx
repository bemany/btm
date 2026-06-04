// Screen 1 · Heute — Tagesübersicht
// - Greeting mit Name + Tageszahl
// - Live-Task-Hero (wenn Timer läuft)
// - Überfällig-Sektion (Tasks mit due < heute, nicht done)
// - Heute-Liste (col=doing oder due=heute)
// - Onclick: Drawer öffnen, Long-press: schnell starten

import { useMemo } from 'react';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { useT, useLocale } from '../../i18n';
import { MobStatusBar, HomeBar } from './MobileChrome';
import type { Task } from '../../store/types';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isOverdue(due: Task['due'], today: string): boolean {
  if (!due) return false;
  if (due === 'today' || due === 'tomorrow') return false;
  return String(due) < today;
}
function isDueToday(due: Task['due'], today: string): boolean {
  if (!due) return false;
  if (due === 'today') return true;
  return due === today;
}
function daysLate(due: Task['due'], today: string): number {
  if (!due || typeof due !== 'string' || due === 'today' || due === 'tomorrow') return 0;
  const a = new Date(due);
  const b = new Date(today);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function PrioDot({ p }: { p: Task['prio'] }) {
  const color =
    p === 'high' ? 'var(--err-500, #C0432C)'
    : p === 'low' ? 'rgba(28,26,23,0.25)'
    : 'rgba(94,127,78,0.7)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} aria-label={p} />;
}

interface Props {
  onOpenTask: (taskId: string) => void;
}

export function MobScreenHeute({ onOpenTask }: Props) {
  const t = useT();
  const [locale] = useLocale();
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);

  const meUser = users.find((u) => u.id === currentUser);
  const meName = meUser ? meUser.name.split(' ')[0] : '—';
  const today = todayIso();

  // Heute zeigt nur Aufgaben die man selbst noch bearbeitet. Review-Aufgaben
  // liegen beim Projektleiter — die tauchen hier nicht mehr auf (auch nicht
  // unter Ueberfaellig). Done sowieso nicht.
  const myTasks = useMemo(
    () => tasks.filter((tk) => tk.who === currentUser && tk.col !== 'done' && tk.col !== 'review'),
    [tasks, currentUser],
  );

  const overdue = useMemo(
    () => myTasks.filter((tk) => isOverdue(tk.due, today)).slice(0, 4),
    [myTasks, today],
  );
  const todayList = useMemo(() => {
    return myTasks
      .filter((tk) => tk.col === 'doing' || isDueToday(tk.due, today) || tk.col === 'planned')
      .filter((tk) => !isOverdue(tk.due, today))
      .sort((a, b) => {
        // doing zuerst, dann planned, dann rest
        const order = { doing: 0, planned: 1, review: 2, todo: 3, done: 4 };
        return (order[a.col] ?? 9) - (order[b.col] ?? 9);
      })
      .slice(0, 12);
  }, [myTasks, today]);

  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;

  const dayLabel = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
  const totalH = todayList.reduce((a, tk) => a + (tk.estH || 0), 0);

  return (
    <div className="mob-screen">
      <MobStatusBar />

      <div className="mob-h-greeting">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-500)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {dayLabel} · {todayList.length} {t('mobile.tasks_count_many', { count: todayList.length }).replace(/^\d+\s*/, '')} · {totalH.toFixed(1).replace('.', locale === 'en' ? '.' : ',')}h
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, marginTop: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            {t('mobile.greeting', { name: meName })}
          </div>
        </div>
        {meUser && <Avatar id={meUser.id} size={30} />}
      </div>

      {liveTask && (
        <div
          className="mob-live-card mob-live-card-slim"
          onClick={() => onOpenTask(liveTask.id)}
        >
          <div className="mob-live-pulse" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="mono" style={{ fontSize: 8.5, color: '#F4D0BA', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Live</span>
              <span className="mono" style={{ fontSize: 8.5, color: 'rgba(244,239,231,0.7)' }}>
                {pomo && pomo.mode === 'focus' ? `${t('mobile.pomo_remaining_short')} ${fmtMS(pomo.remaining)}` : t('mobile.pomo_short')}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#FAF7F2', lineHeight: 1.25, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {liveTask.title}
            </div>
          </div>
          <button
            type="button"
            className="mob-live-stop"
            onClick={(e) => { e.stopPropagation(); stopTimer(); showToast(t('mobile.timer_stopped_toast')); }}
            aria-label={t('mobile.stop')}
          >
            <Icon name="square" size={10} />
          </button>
        </div>
      )}

      <div className="mob-scroll mob-scroll-tight">
        {overdue.length > 0 && (
          <>
            <div className="mob-section-head mob-section-head-overdue">
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--err-500, #C0432C)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="alert-circle" size={10} />
                {t('mobile.overdue_label')} · {overdue.length}
              </div>
            </div>
            {overdue.map((tk) => (
              <div
                key={tk.id}
                className="mob-task-row is-overdue"
                onClick={() => onOpenTask(tk.id)}
              >
                {tk.proj && <ProjTag id={tk.proj} />}
                <span className="mob-task-row-title">{tk.title}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--err-500, #C0432C)', fontWeight: 600, flexShrink: 0 }}>
                  +{daysLate(tk.due, today)}d
                </span>
                <button
                  type="button"
                  className="mob-task-row-start"
                  onClick={(e) => { e.stopPropagation(); startTimer(tk.id); showToast(t('mobile.timer_started_toast')); }}
                  aria-label={t('mobile.start')}
                >
                  <Icon name="play" size={9} />
                </button>
              </div>
            ))}
          </>
        )}

        <div className="mob-section-head">
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-500)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('mobile.today_label')} · {todayList.length}
          </div>
          <span className="mono" style={{ fontSize: 9, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('mobile.prio_label')}</span>
        </div>

        {todayList.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
            {t('mobile.no_open_tasks')}
          </div>
        )}

        {todayList.map((tk) => {
          const isLive = liveTask?.id === tk.id;
          return (
            <div
              key={tk.id}
              className={`mob-task-row ${isLive ? 'is-live' : ''}`}
              onClick={() => onOpenTask(tk.id)}
            >
              {tk.proj && <ProjTag id={tk.proj} />}
              <span className="mob-task-row-title">{tk.title}</span>
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)', flexShrink: 0 }}>
                {(tk.estH || 0).toFixed(1).replace('.', locale === 'en' ? '.' : ',')}h
              </span>
              <PrioDot p={tk.prio || 'med'} />
              {isLive ? (
                <span className="mob-task-row-live">●</span>
              ) : (
                <button
                  type="button"
                  className="mob-task-row-start"
                  onClick={(e) => { e.stopPropagation(); startTimer(tk.id); showToast(t('mobile.timer_started_toast')); }}
                  aria-label={t('mobile.start')}
                >
                  <Icon name="play" size={9} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <HomeBar />
    </div>
  );
}
