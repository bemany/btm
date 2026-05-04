import { useEffect, useState } from 'react';

// 1Hz tick — for live timer displays
export function useTick(active: boolean = true): void {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => set((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}
