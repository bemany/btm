// Lokale UI-Praeferenzen die nicht mit dem Server synchen muessen.
// Per-Browser/Geraet, nicht per-User auf der Backend-Seite.

const POMODORO_KEY = 'btm.pomodoroDefault';

export function getPomodoroDefault(): boolean {
  try {
    // Default an, 'off' = explizit aus.
    return localStorage.getItem(POMODORO_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setPomodoroDefault(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(POMODORO_KEY);
    else localStorage.setItem(POMODORO_KEY, 'off');
  } catch {
    /* ignore */
  }
}
