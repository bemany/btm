import { useStore } from '../../store/store';
import type { AppUser } from '../../store/types';

export interface AvatarProps {
  id?: string | null;
  user?: AppUser;
  size?: number;
  title?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ id, user, size = 24, title }: AvatarProps) {
  const users = useStore((s) => s.users);
  const u = user ?? (id ? users.find((x) => x.id === id) : undefined);
  const label = u ? initials(u.name || u.email.split('@')[0]) : id ? id.slice(0, 2).toUpperCase() : '??';
  const color = u?.color ?? '#6B6359';
  const tooltip = title ?? u?.name ?? id ?? '';

  return (
    <span
      className="av"
      title={tooltip}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-grid',
        placeItems: 'center',
        background: color,
        color: '#FAF7F2',
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
