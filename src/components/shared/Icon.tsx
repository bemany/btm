import { icons } from 'lucide-react';
import type { CSSProperties } from 'react';

const iconCache: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: CSSProperties }>> = {};

function kebabToPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolve(name: string) {
  if (iconCache[name]) return iconCache[name];
  const pascal = kebabToPascal(name);
  // @ts-expect-error – dynamic key access into the lucide-react icons map
  const C = icons[pascal] || icons.CircleHelp;
  iconCache[name] = C;
  return C;
}

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const C = resolve(name);
  return (
    <C
      size={size}
      strokeWidth={1.5}
      className={className}
      style={{ width: size, height: size, flexShrink: 0, ...style }}
    />
  );
}
