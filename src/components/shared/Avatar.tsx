import { PERSONAS } from '../../store/seed';

export interface AvatarProps {
  id: string;
  size?: number;
}

export function Avatar({ id, size = 24 }: AvatarProps) {
  const p = PERSONAS.find((x) => x.id === id) || { name: '?', color: '#888' };
  return (
    <span
      className={`av av-${id}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-grid',
        placeItems: 'center',
        background: p.color,
        color: '#FAF7F2',
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {id}
    </span>
  );
}
