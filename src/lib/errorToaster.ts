// Globaler Error-Listener: fängt alle 'btm:api-error'-Events ab und
// zeigt sie als Toast. So muss kein Aufrufer eigene Fehlerbehandlung machen.
//
// Wird einmal in main.tsx initialisiert.

import { showToast } from '../components/shared/Toast';

interface ApiErrorDetail {
  status: number;
  message: string;
  path: string;
}

// Manche Fehler sind erwartet/laut UI ohnehin sichtbar — nicht doppelt toasten.
const SILENT_PATTERNS = [
  /\/api\/me$/, // bei initial anonym wird /me 200 mit user:null antworten — eh kein Fehler
  /\/api\/auth\//, // Auth-Endpoints regeln eigene UI (z.B. LoginScreen)
];

let lastSig = '';
let lastAt = 0;

export function installErrorToaster(): void {
  window.addEventListener('btm:api-error', ((e: CustomEvent<ApiErrorDetail>) => {
    const { status, message, path } = e.detail;
    if (SILENT_PATTERNS.some((rx) => rx.test(path))) return;
    if (status === 401) return; // anon → AppGate zeigt Login

    // De-Dup: gleiche Message innerhalb 1 s nicht zweimal toasten
    const sig = `${status}:${message}`;
    const now = Date.now();
    if (sig === lastSig && now - lastAt < 1000) return;
    lastSig = sig;
    lastAt = now;

    showToast(`${status === 403 ? 'Keine Berechtigung — ' : ''}${message}`);
  }) as EventListener);
}
