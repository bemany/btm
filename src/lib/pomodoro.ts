import type { PomodoroState, PomodoroMode } from '../store/types';

export const POMO_FOCUS = 25 * 60 * 1000;
export const POMO_SHORT = 5 * 60 * 1000;
export const POMO_LONG = 15 * 60 * 1000;

export function pomoBlockMs(mode: PomodoroMode): number {
  return mode === 'focus' ? POMO_FOCUS : mode === 'long' ? POMO_LONG : POMO_SHORT;
}

export interface PomoComputed {
  mode: PomodoroMode;
  blocksDone: number;
  blockIndex: number;
  elapsedInBlock: number;
  total: number;
  remaining: number;
}

export function computePomo(pomo: PomodoroState | null | undefined, now: number): PomoComputed | null {
  if (!pomo) return null;
  let elapsed = now - pomo.startedAt;
  let blocksDone = pomo.blocksDone || 0;
  let mode: PomodoroMode = pomo.mode;
  let blockIndex = pomo.blockIndex || 0;
  while (elapsed >= pomoBlockMs(mode)) {
    elapsed -= pomoBlockMs(mode);
    if (mode === 'focus') {
      blocksDone += 1;
      blockIndex = blocksDone;
      mode = blocksDone % 4 === 0 ? 'long' : 'short';
    } else {
      mode = 'focus';
    }
  }
  const total = pomoBlockMs(mode);
  return { mode, blocksDone, blockIndex, elapsedInBlock: elapsed, total, remaining: total - elapsed };
}
