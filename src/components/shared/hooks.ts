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

// Reagiert auf viewport-Wechsel und sagt ob wir „mobile" sind (< breakpoint).
// Wird genutzt um zwischen Desktop-Layout (Sidebar/Topbar) und Mobile-App
// (3 Screens + Bottom-Tabs) zu schalten.
//
// Mehrfach-Detection für iOS-Safari/PWA-Edgecases:
//   1. window.matchMedia (primary, reagiert auf rotation/resize)
//   2. window.innerWidth (initial)
//   3. UserAgent enthält "iPhone"/"iPad"/"Android" (fallback wenn das CSS-mq
//      in einem PWA-Standalone-Mode bei langem Pre-Render mal nicht greift)
function detectMobile(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  // Manuelle Overrides für Test/Debug:
  //   ?mobile=1  → erzwingt Mobile-Layout (in sessionStorage gemerkt für den Tab)
  //   ?mobile=0  → erzwingt Desktop-Layout
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('mobile')) {
      const v = sp.get('mobile');
      if (v === '1' || v === 'true') {
        sessionStorage.setItem('btm.mobileOverride', '1');
      } else if (v === '0' || v === 'false') {
        sessionStorage.setItem('btm.mobileOverride', '0');
      } else if (v === 'auto' || v === '') {
        sessionStorage.removeItem('btm.mobileOverride');
      }
    }
    const override = sessionStorage.getItem('btm.mobileOverride');
    if (override === '1') return true;
    if (override === '0') return false;
  } catch { /* ignore (private mode etc.) */ }
  const w = window.innerWidth;
  if (w > 0 && w < breakpoint) return true;
  // matchMedia ist robuster als innerWidth in manchen iOS-Modi
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches) return true;
  }
  // Fallback per UA — nur greifen wenn innerWidth uns 0/undefined liefert
  if (w === 0 || !w) {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return true;
  }
  return false;
}

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => detectMobile(breakpoint));
  useEffect(() => {
    const handler = () => setIsMobile(detectMobile(breakpoint));
    handler();
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    mq.addEventListener('change', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [breakpoint]);
  return isMobile;
}
