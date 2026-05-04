import type { CSSProperties } from 'react';
import { useStore } from '../../store/store';

export interface ProjTagProps {
  id: string | null | undefined;
}

export function ProjTag({ id }: ProjTagProps) {
  const projects = useStore((s) => s.projects);
  if (!id) return null;
  const p = projects.find((x) => x.id === id);
  if (!p) return null;
  return (
    <span
      className="proj-tag"
      style={{ ['--proj-color' as keyof CSSProperties]: p.color } as CSSProperties}
    >
      {p.code}
    </span>
  );
}
