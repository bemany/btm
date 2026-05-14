// Service-Worker-Update-Handling (Claude-Desktop-Style „Relaunch to update").
//
// Pattern: vite-plugin-pwa registriert den SW im `prompt`-Modus, d.h. der
// neue Worker wartet auf eine explizite Übernahme. Wir polling-checken alle
// CHECK_INTERVAL_MS auf eine neue Version und setzen ein Signal. Der Toast
// in der Sidebar zeigt dann „Relaunch to update vX.Y.Z" — Klick triggert
// updateSW(true), was skipWaiting() + reload() macht.
//
// Vorher (autoUpdate + skipWaiting): User wurde ohne Vorwarnung mid-task
// neugeladen, das war Esrefs Beschwerde.

import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 60 * 1000; // 1 Min — Polling-Tick auf SW-Update

let pending = false;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<(pending: boolean) => void>();

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  // Dev-Mode (Vite): kein SW registriert → no-op
  if (!('serviceWorker' in navigator)) return;

  updateSWFn = registerSW({
    immediate: false,
    onNeedRefresh() {
      pending = true;
      for (const l of listeners) l(true);
    },
    onOfflineReady() {
      // First install — nichts zu tun, App läuft eh schon.
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodisch nach Updates fragen damit der Toast zeitnah kommt.
      // (Browser checken sonst nur bei Navigation.)
      setInterval(() => {
        registration.update().catch(() => {
          /* offline — beim nächsten Tick wieder */
        });
      }, CHECK_INTERVAL_MS);
    },
  });
}

/** Ob aktuell eine Update-Version bereitliegt. */
export function isUpdatePending(): boolean {
  return pending;
}

/** Subscriptions für UI-Komponenten (Sidebar-Toast). */
export function subscribeSwUpdate(cb: (pending: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** User hat „Relaunch" geklickt — neuen Worker aktivieren + Tab neu laden. */
export async function applyPendingUpdate(): Promise<void> {
  if (!updateSWFn) {
    // Kein SW registriert (Dev oder unsupported) → trotzdem reload, damit
    // ein Token-/Auth-Refresh greift.
    window.location.reload();
    return;
  }
  await updateSWFn(true);
}

/** React-Hook: liefert true wenn eine neue Version bereit liegt. */
export function useUpdatePending(): boolean {
  const [val, setVal] = useState(isUpdatePending());
  useEffect(() => subscribeSwUpdate(setVal), []);
  return val;
}
