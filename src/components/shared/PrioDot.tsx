import type { Priority } from '../../store/types';

export interface PrioDotProps {
  p: Priority;
}

export function PrioDot({ p }: PrioDotProps) {
  const c = p === 'high' ? 'var(--accent-500)' : p === 'med' ? 'var(--ink-400)' : 'var(--ink-200)';
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c,
        display: 'inline-block',
        flexShrink: 0,
      }}
      title={p}
    />
  );
}
