import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'btm.tweaks.v1';

export type SetTweak<T extends object> = {
  <K extends keyof T>(key: K, value: T[K]): void;
  (edits: Partial<T>): void;
};

function loadStored(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStored(v: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* quota / private mode */
  }
}

export function useTweaks<T extends object>(defaults: T): [T, SetTweak<T>] {
  const [values, setValues] = useState<T>(() => {
    const stored = loadStored() as Partial<T> | null;
    return { ...defaults, ...(stored ?? {}) };
  });

  useEffect(() => {
    saveStored(values);
  }, [values]);

  const setTweak = useCallback(((keyOrEdits: unknown, val?: unknown) => {
    const edits =
      typeof keyOrEdits === 'object' && keyOrEdits !== null
        ? (keyOrEdits as Partial<T>)
        : ({ [keyOrEdits as string]: val } as Partial<T>);
    setValues((prev) => ({ ...prev, ...edits }));
  }) as SetTweak<T>, []);

  return [values, setTweak];
}
