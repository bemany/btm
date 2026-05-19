// Screen 4 · Fokus-Timer (Pomodoro)
// Dark Screen — wenn ein Live-Timer läuft. SVG-Ring zeigt Block-Fortschritt,
// Block-Dots zeigen 4er-Zyklen, Stop/Pause-Controls am unteren Rand.

import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';
import { useT } from '../../i18n';

interface Props {
  onBack: () => void;
}

export function MobScreenTimer({ onBack }: Props) {
  const t = useT();
  const timer = useStore((s) => s.timer);
  const tasks = useStore((s) => s.tasks);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);

  useTick(!!timer);

  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;

  const ringR = 45;
  const ringCirc = 2 * Math.PI * ringR;
  const progress = pomo ? pomo.elapsedInBlock / pomo.total : 0;

  return (
    <>
      <div style={{ padding: '6px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ border: 0, background: 'transparent', color: '#FAF7F2', cursor: 'pointer', padding: 4 }}
          aria-label={t('common.back')}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="mono" style={{ flex: 1, fontSize: 9, color: 'var(--ink-300)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {liveTask ? t('mobile.timer_focus_mode') : t('mobile.timer_pomodoro')}
        </div>
        <Icon name="bell-minus" size={14} style={{ color: 'var(--ink-300)' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', textAlign: 'center', gap: 10 }}>
        {liveTask && pomo ? (
          <>
            {liveTask.proj && <ProjTag id={liveTask.proj} />}
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, lineHeight: 1.25, color: '#FAF7F2', maxWidth: 220 }}>
              {liveTask.title}
            </div>

            <div style={{ position: 'relative', width: 192, height: 192, marginTop: 6 }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r={ringR} fill="none" stroke="rgba(250,247,242,0.08)" strokeWidth="3" />
                <circle
                  cx="50" cy="50" r={ringR} fill="none"
                  stroke={pomo.mode === 'focus' ? 'var(--accent-500)' : 'var(--ok-500, #5E7F4E)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringCirc * (1 - progress)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-300)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {pomo.mode === 'focus' ? t('mobile.pomo_focus') : pomo.mode === 'long' ? t('mobile.pomo_long') : t('mobile.pomo_short')}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: '#FAF7F2', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmtMS(pomo.remaining)}
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-300)' }}>
                  / {Math.round(pomo.total / 60000)}:00
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 26,
                    height: 4,
                    borderRadius: 2,
                    background:
                      i < pomo.blocksDone
                        ? 'var(--ok-500, #5E7F4E)'
                        : i === pomo.blocksDone && pomo.mode === 'focus'
                          ? 'var(--accent-500)'
                          : 'rgba(250,247,242,0.12)',
                  }}
                />
              ))}
            </div>

            <div className="mono" style={{ fontSize: 9, color: 'var(--ink-300)', marginTop: 2 }}>
              {t('mobile.pomo_block_of', { done: Math.min(pomo.blocksDone, 4), total: 4 })} · {fmtMS(pomo.elapsedInBlock)}
            </div>
          </>
        ) : (
          <>
            <Icon name="timer" size={48} style={{ color: 'var(--ink-700)' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'rgba(244,239,231,0.85)' }}>
              {t('mobile.no_timer')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-400)', maxWidth: 220 }}>
              {t('mobile.no_timer_hint')}
            </div>
            <button
              type="button"
              onClick={onBack}
              className="mob-tc-stop"
              style={{ marginTop: 12 }}
            >
              <Icon name="arrow-left" size={11} /> {t('mobile.to_today')}
            </button>
          </>
        )}
      </div>

      {liveTask && (
        <div className="mob-timer-controls">
          <button
            type="button"
            className="mob-tc-btn"
            onClick={() => togglePomodoro()}
            aria-label={timer?.pomodoro ? t('mobile.pomo_off') : t('mobile.pomo_on')}
            title={timer?.pomodoro ? t('mobile.pomo_off') : t('mobile.pomo_on')}
          >
            <Icon name={timer?.pomodoro ? 'circle-dot' : 'circle'} size={13} />
          </button>
          <button
            type="button"
            className="mob-tc-stop"
            onClick={() => { stopTimer(); showToast(t('mobile.timer_stopped_toast')); onBack(); }}
          >
            <Icon name="square" size={11} /> {t('mobile.stop')}
          </button>
          <button
            type="button"
            className="mob-tc-btn"
            disabled
            aria-label="Pause"
            title={t('mobile.timer_pause_soon')}
          >
            <Icon name="pause" size={13} />
          </button>
        </div>
      )}

    </>
  );
}
