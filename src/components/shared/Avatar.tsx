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
  const image = u?.image ?? null;

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-grid' as const,
    placeItems: 'center' as const,
    flexShrink: 0,
    overflow: 'hidden' as const,
  };

  if (image) {
    return (
      <span className="av av-img" title={tooltip} style={baseStyle}>
        <img
          src={image}
          alt={tooltip || 'Avatar'}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            borderRadius: '50%',
          }}
        />
      </span>
    );
  }

  return (
    <span
      className="av"
      title={tooltip}
      style={{
        ...baseStyle,
        background: color,
        color: '#FAF7F2',
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
