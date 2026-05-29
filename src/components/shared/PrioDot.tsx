import type { Priority } from '../../store/types';

export interface PrioDotProps {
  p: Priority;
}

// FcQa5u3Ifxu: Prioritaet farblich am Punkt erkennbar machen.
// Vorher: nur high = akzentfarben (oft Orange/Gold und ging unter), med/low
// beide grau. Jetzt: high = leuchtendes Rot mit Halo, med = Bernstein/Orange,
// low = ruhiges Blaugruen. Auf einen Blick unterscheidbar.
const PRIO_COLOR: Record<Priority, string> = {
  high: '#D8453C',
  med: '#E0902B',
  low: '#7AA08F',
};
const PRIO_SIZE: Record<Priority, number> = {
  high: 8,
  med: 7,
  low: 7,
};

export function PrioDot({ p }: PrioDotProps) {
  const color = PRIO_COLOR[p];
  const size = PRIO_SIZE[p];
  return (
    <span
      className={`prio-dot prio-dot-${p}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
        boxShadow:
          p === 'high'
            ? `0 0 0 2px rgba(216, 69, 60, 0.22), 0 0 6px rgba(216, 69, 60, 0.55)`
            : p === 'med'
              ? `0 0 0 1.5px rgba(224, 144, 43, 0.2)`
              : 'none',
      }}
      title={p === 'high' ? 'Hoch' : p === 'med' ? 'Mittel' : 'Niedrig'}
    />
  );
}
