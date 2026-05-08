import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { apiFetch } from '../../lib/api';
import { SYNC_KEYS } from '../../data/sync';
import type { Priority } from '../../store/types';
import { useT, useLocale } from '../../i18n';

type Tab = 'heute' | 'timer' | 'ki';

export function MobileApp() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('heute');
  return (
    <div className="ma-shell">
      <div className="ma-screen">
        {tab === 'heute' && <HeuteScreen onNeedTimer={() => setTab('timer')} />}
        {tab === 'timer' && <TimerScreen onNoTimer={() => setTab('heute')} />}
        {tab === 'ki' && <KiScreen />}
      </div>
      <nav className="ma-tabs" role="tablist">
        <TabBtn id="heute" active={tab} setTab={setTab} icon="list-todo" label={t('mobile.today')} />
        <TabBtn id="timer" active={tab} setTab={setTab} icon="timer" label={t('mobile.timer')} />
        <TabBtn id="ki" active={tab} setTab={setTab} icon="sparkles" label={t('mobile.ki')} />
      </nav>
    </div>
  );
}

function TabBtn({
  id,
  active,
  setTab,
  icon,
  label,
}: {
  id: Tab;
  active: Tab;
  setTab: (t: Tab) => void;
  icon: string;
  label: string;
}) {
  const isActive = active === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`ma-tab ${isActive ? 'active' : ''}`}
      onClick={() => setTab(id)}
    >
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );
}

function HeuteScreen({ onNeedTimer }: { onNeedTimer: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const list = useMemo(
    () =>
      tasks
        .filter((tk) => tk.who === currentUser)
        .filter((tk) => tk.col !== 'done')
        .sort((a, b) => {
          const order = { doing: 0, planned: 1, review: 2, todo: 3, done: 4 };
          return (order[a.col] ?? 9) - (order[b.col] ?? 9);
        }),
    [tasks, currentUser],
  );

  const today = new Date();
  const dayStr = today.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="ma-page">
      <div className="ma-header">
        <div className="ma-eyebrow">{dayStr}</div>
        <h1 className="ma-title">{t('mobile.today')}</h1>
        <div className="ma-sub">
          {list.length === 1
            ? t('mobile.tasks_count_one', { count: list.length })
            : t('mobile.tasks_count_many', { count: list.length })}
          {t('mobile.tasks_open_suffix')}
          {timer && t('mobile.timer_running_suffix')}
        </div>
      </div>

      <div className="ma-list">
        {list.length === 0 && (
          <div className="ma-empty">
            <Icon name="check-check" size={28} />
            <div>{t('mobile.no_open_tasks')}</div>
            <div className="ma-empty-hint">{t('mobile.no_open_hint')}</div>
          </div>
        )}
        {list.map((tk) => {
          const isLive = timer?.taskId === tk.id;
          return (
            <div key={tk.id} className={`ma-card ${isLive ? 'is-live' : ''}`}>
              <div className="ma-card-row">
                <ProjTag id={tk.proj} />
                {tk.col === 'doing' && <span className="ma-pill doing">{t('mobile.pill_doing')}</span>}
                {tk.col === 'planned' && <span className="ma-pill planned">{t('mobile.pill_today')}</span>}
                {tk.col === 'review' && <span className="ma-pill review">{t('mobile.pill_review')}</span>}
                {tk.prio === 'high' && <span className="ma-pill prio-high">{t('mobile.pill_high')}</span>}
              </div>
              <div className="ma-card-title">{tk.title}</div>
              <div className="ma-card-meta">
                <span className="mono">
                  {t('mobile.planned_short', { h: fmtNum(tk.estH), logged: fmtNum(tk.loggedH) })}
                </span>
              </div>
              <div className="ma-card-actions">
                {isLive ? (
                  <button className="ma-btn primary" onClick={onNeedTimer}>
                    <Icon name="timer" size={14} /> {t('mobile.running')}
                  </button>
                ) : (
                  <button
                    className="ma-btn"
                    onClick={() => {
                      startTimer(tk.id);
                      showToast(t('mobile.timer_started_toast'));
                      onNeedTimer();
                    }}
                  >
                    <Icon name="play" size={14} /> {t('mobile.start')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimerScreen({ onNoTimer }: { onNoTimer: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const timer = useStore((s) => s.timer);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);
  const t = useT();
  const [locale] = useLocale();

  useTick(!!timer);
  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  if (!timer || !liveTask) {
    return (
      <div className="ma-page">
        <div className="ma-empty centered">
          <Icon name="timer" size={36} />
          <div className="ma-empty-title">{t('mobile.no_timer')}</div>
          <div className="ma-empty-hint">{t('mobile.no_timer_hint')}</div>
          <button className="ma-btn primary" onClick={onNoTimer}>
            {t('mobile.to_today')}
          </button>
        </div>
      </div>
    );
  }

  const ringSize = 220;
  const ringR = 96;
  const ringCirc = 2 * Math.PI * ringR;
  const progress = pomo ? pomo.elapsedInBlock / pomo.total : 0;

  return (
    <div className="ma-page">
      <div className="ma-header">
        <div className="ma-eyebrow">{liveTask.title.slice(0, 40)}</div>
        <h1 className="ma-title">
          {pomo?.mode === 'focus'
            ? t('mobile.pomo_focus')
            : pomo?.mode === 'short'
            ? t('mobile.pomo_short')
            : pomo?.mode === 'long'
            ? t('mobile.pomo_long')
            : t('mobile.live_timer')}
        </h1>
        <div className="ma-sub">
          {pomo
            ? t('mobile.pomo_block', { n: pomo.blocksDone + 1 })
            : t('mobile.timer_running_since', {
                time: new Date(timer.startedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
        </div>
      </div>

      <div className="ma-ring-wrap">
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringR}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="6"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringR}
            fill="none"
            stroke={pomo?.mode === 'focus' ? 'var(--accent-500)' : '#5E7F4E'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringCirc * (1 - progress)}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="ma-ring-label">
          <div className="ma-ring-time">
            {pomo ? fmtMS(pomo.remaining) : fmtHMS(elapsed)}
          </div>
          <div className="ma-ring-sub">
            {pomo ? t('mobile.pomo_remaining') : t('mobile.elapsed')}
          </div>
        </div>
      </div>

      {pomo && (
        <div className="ma-pomo-dots">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`ma-pomo-dot ${i < pomo.blocksDone ? 'done' : i === pomo.blocksDone && pomo.mode === 'focus' ? 'now' : ''}`}
            />
          ))}
        </div>
      )}

      <div className="ma-actions-row">
        <button
          className="ma-btn"
          onClick={() => {
            togglePomodoro();
            showToast(timer.pomodoro ? t('mobile.pomo_off_toast') : t('mobile.pomo_on_toast'));
          }}
        >
          <Icon name="sparkles" size={14} />
          {timer.pomodoro ? t('mobile.pomo_off') : t('mobile.pomo_on')}
        </button>
        <button
          className="ma-btn danger"
          onClick={() => {
            stopTimer();
            showToast(t('mobile.timer_stopped_toast'));
          }}
        >
          <Icon name="square" size={14} /> {t('mobile.stop')}
        </button>
      </div>
    </div>
  );
}

interface ExtractedTask {
  title: string;
  proj: string;
  who: string;
  estH: number;
  prio: Priority;
  notes: string;
}

function KiScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'input' | 'thinking' | 'result'>('input');
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [picks, setPicks] = useState<boolean[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const extract = async () => {
    if (!text.trim()) return;
    setPhase('thinking');
    try {
      const res = await apiFetch<{
        result: {
          tasks: Array<{
            title: string;
            description?: string;
            project_id?: string | null;
            assignee_id?: string | null;
            est_h?: number;
            prio?: Priority;
            notes?: string;
          }>;
        };
      }>('/ai/extract', { method: 'POST', body: { text } });
      const tasks: ExtractedTask[] = (res.result?.tasks ?? []).map((tk) => ({
        title: tk.title,
        proj: tk.project_id ?? '',
        who: tk.assignee_id ?? user?.id ?? '',
        estH: typeof tk.est_h === 'number' ? tk.est_h : 1,
        prio: (tk.prio ?? 'med') as Priority,
        notes: tk.notes ?? tk.description ?? '',
      }));
      setExtracted(tasks);
      setPicks(tasks.map(() => true));
      setPhase('result');
      if (tasks.length === 0) showToast(t('mobile.ki_no_tasks_toast'));
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('chat_bubble.error_unavailable'));
      setPhase('input');
    }
  };

  const create = async () => {
    const selected = extracted.filter((_, i) => picks[i]);
    if (selected.length === 0) return;
    let ok = 0;
    for (const tk of selected) {
      try {
        await apiFetch('/tasks', {
          method: 'POST',
          body: {
            title: tk.title,
            description: tk.notes || null,
            estH: tk.estH,
            priority: tk.prio,
            projectId: tk.proj || null,
            assigneeId: tk.who || user?.id,
            column: 'todo',
          },
        });
        ok++;
      } catch {
        /* ignore single failures */
      }
    }
    showToast(t('mobile.ki_created_toast', { count: ok }));
    queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TASKS });
    setText('');
    setExtracted([]);
    setPicks([]);
    setPhase('input');
  };

  if (phase === 'thinking') {
    return (
      <div className="ma-page">
        <div className="ma-empty centered">
          <Icon name="loader-2" size={28} className="ma-spin" />
          <div className="ma-empty-title">{t('mobile.ki_thinking')}</div>
          <div className="ma-empty-hint">{t('mobile.ki_thinking_sub')}</div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="ma-page">
        <div className="ma-header">
          <div className="ma-eyebrow">{t('mobile.ki_eyebrow_result')}</div>
          <h1 className="ma-title">{t('mobile.ki_result_title', { count: extracted.length })}</h1>
          <div className="ma-sub">{t('mobile.ki_result_sub')}</div>
        </div>
        <div className="ma-list">
          {extracted.map((tk, i) => (
            <label key={i} className={`ma-pick ${picks[i] ? 'on' : 'off'}`}>
              <input
                type="checkbox"
                checked={picks[i]}
                onChange={(e) => {
                  const next = [...picks];
                  next[i] = e.target.checked;
                  setPicks(next);
                }}
              />
              <div className="ma-pick-text">
                <div className="ma-pick-title">{tk.title}</div>
                <div className="mono ma-pick-meta">
                  {fmtNum(tk.estH)}h · {tk.prio}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="ma-actions-row">
          <button className="ma-btn" onClick={() => setPhase('input')}>
            <Icon name="arrow-left" size={14} /> {t('mobile.ki_back')}
          </button>
          <button className="ma-btn primary" onClick={create} disabled={picks.every((p) => !p)}>
            {t('mobile.ki_apply', { count: picks.filter(Boolean).length })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ma-page">
      <div className="ma-header">
        <div className="ma-eyebrow">{t('mobile.ki_eyebrow')}</div>
        <h1 className="ma-title">{t('mobile.ki_title')}</h1>
        <div className="ma-sub">{t('mobile.ki_sub')}</div>
      </div>
      <textarea
        ref={inputRef}
        className="ma-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('mobile.ki_textarea')}
      />
      <div className="ma-actions-row">
        <button className="ma-btn" disabled title={t('mobile.ki_photo')}>
          <Icon name="camera" size={14} /> {t('mobile.ki_photo')}
        </button>
        <button className="ma-btn" disabled title={t('mobile.ki_voice')}>
          <Icon name="mic" size={14} /> {t('mobile.ki_voice')}
        </button>
        <button className="ma-btn primary" onClick={extract} disabled={!text.trim()}>
          <Icon name="sparkles" size={14} /> {t('mobile.ki_extract')}
        </button>
      </div>
    </div>
  );
}
