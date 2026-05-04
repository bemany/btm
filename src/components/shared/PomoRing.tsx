import type { PomodoroMode } from '../../store/types';

export interface PomoRingProps {
  size?: number;
  progress?: number;
  mode?: PomodoroMode;
}

export function PomoRing({ size = 22, progress = 0, mode = 'focus' }: PomoRingProps) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, progress)));
  const stroke = mode === 'focus' ? 'var(--accent-500)' : 'var(--ok-500)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-700)" strokeWidth="2" opacity="0.4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
      />
    </svg>
  );
}
