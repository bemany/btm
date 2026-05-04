// Minimaler Custom-Router via History-API.
// Keine Dependencies. Reicht für unsere flache Pfad-Struktur.

import { useEffect, useState } from 'react';
import type { ScreenId } from './store/types';

// Dispatched ein synthetisches popstate-Event, damit alle useLocation-Subscriber
// die Path-Änderung mitkriegen — pushState alleine triggert kein popstate.
const NAV_EVENT = 'btm:navigate';

export interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
}

function readLocation(): RouteLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function useLocation(): RouteLocation {
  const [loc, setLoc] = useState<RouteLocation>(readLocation);
  useEffect(() => {
    const onChange = () => setLoc(readLocation());
    window.addEventListener('popstate', onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);
  return loc;
}

export interface NavigateOptions {
  replace?: boolean;
  search?: string; // '?foo=bar' inkl. ? oder ohne — wir normalisieren
  hash?: string;
}

export function navigate(to: string, opts: NavigateOptions = {}): void {
  let search = opts.search ?? '';
  if (search && !search.startsWith('?')) search = '?' + search;
  let hash = opts.hash ?? '';
  if (hash && !hash.startsWith('#')) hash = '#' + hash;
  const target = to + search + hash;
  const cur = window.location.pathname + window.location.search + window.location.hash;
  if (cur === target) return;
  if (opts.replace) {
    history.replaceState({}, '', target);
  } else {
    history.pushState({}, '', target);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

// ── Pfad-Mapping ──────────────────────────────────────────────────────

export const SCREEN_TO_PATH: Record<ScreenId, string> = {
  week: '/',
  board: '/board',
  capacity: '/capacity',
  times: '/times',
  projects: '/projects',
  admin: '/admin',
  mobile: '/mobile',
  chrome: '/chrome',
  tv: '/tv',
};

const PATH_TO_SCREEN: Record<string, ScreenId> = {
  '/': 'week',
  '/week': 'week',
  '/board': 'board',
  '/capacity': 'capacity',
  '/times': 'times',
  '/projects': 'projects',
  '/admin': 'admin',
  '/mobile': 'mobile',
  '/chrome': 'chrome',
  '/tv': 'tv',
};

export function pathToScreen(pathname: string): ScreenId | null {
  return PATH_TO_SCREEN[pathname] ?? null;
}

// /invite/<token>
export function matchInvite(pathname: string): string | null {
  const m = /^\/invite\/([^/]+)\/?$/.exec(pathname);
  return m ? m[1] : null;
}

// /tv (mit optionalem ?token=…) — Fullscreen-Modus
export function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/login/';
}
