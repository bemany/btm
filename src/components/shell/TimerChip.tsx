import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { PomoRing } from '../shared/PomoRing';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';

export function TimerChip() {
  const timer = useStore((s) => s.timer);
  const tasks = useStore((s) => s.tasks);
  const setUI = useStore((s) => s.setUI);
  const stopTimer = useStore((s) => s.stopTimer);

  useTick(!!timer);
  if (!timer) return null;

  const now = Date.now();
  const elapsed = now - timer.startedAt;
  const task = tasks.find((t) => t.id === timer.taskId);
  const pomo = computePomo(timer.pomodoro, now);
  const progress = pomo ? pomo.elapsedInBlock / pomo.total : 0;

  return (
    <div className="timer-chip" onClick={() => task && setUI({ taskDetailId: task.id })}>
      <span className="pulse" />
      <span>{fmtHMS(elapsed)}</span>
      <span style={{ color: 'var(--ink-300)' }}>·</span>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-body)',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task?.title || '?'}
      </span>
      {pomo && (
        <>
          <span style={{ color: 'var(--ink-300)' }}>·</span>
          <span className="pomo">
            <PomoRing size={18} progress={progress} mode={pomo.mode} />
          </span>
          <span style={{ fontSize: 10, color: 'var(--cream-100)' }}>
            {pomo.mode === 'focus' ? 'Fokus' : pomo.mode === 'short' ? 'Pause' : 'L. Pause'} {fmtMS(pomo.remaining)} ·{' '}
            {pomo.blocksDone}/4
          </span>
        </>
      )}
      <button
        className="stop-btn"
        onClick={(e) => {
          e.stopPropagation();
          stopTimer();
          showToast('Timer gestoppt');
        }}
        title="Stoppen"
      >
        <Icon name="square" size={10} />
      </button>
    </div>
  );
}
