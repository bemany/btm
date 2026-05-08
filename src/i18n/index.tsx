// i18n-Infrastruktur — Provider, Context, useT-Hook.
//
// Pattern: keine react-i18next/intl-Lib (overkill für 2 Sprachen, ~500 Keys).
// Stattdessen typed Dot-Path-Lookup: t('sidebar.week') ist compile-time-safe.
// Locale-State persistiert in localStorage. Default: Browser-Sprache, sonst de.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { de, type Translations } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';

const STORAGE_KEY = 'btm.locale.v1';

const DICTS: Record<Locale, Translations> = { de, en };

// Dot-Path-Type für Auto-Complete: 'sidebar.week' | 'topbar.title_board' | …
//
// Implementation: rekursiv durch die zwei Ebenen iterieren. Da die Translations
// flach geschachtelt sind (Domain → Key, beide string), reicht das.
type Leaves<T> = T extends string
  ? ''
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}` }[keyof T & string];

export type TKey = Leaves<Translations>;

// Naive Resolver: Pfad-String zerlegen, durch das Objekt traversieren. Wenn
// der Key in der Ziel-Sprache fehlt (sollte nie passieren weil wir gegen
// Translations-Type prüfen), fallback auf Deutsch, dann auf den Key selbst.
function resolve(dict: Translations, path: string): string {
  const parts = path.split('.');
  let cursor: unknown = dict;
  for (const p of parts) {
    if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[p];
    } else {
      return '';
    }
  }
  return typeof cursor === 'string' ? cursor : '';
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function detectInitial(): Locale {
  if (typeof window === 'undefined') return 'de';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // localStorage ggf. blockiert (Privacy-Mode) — silently fallback
  }
  const nav = navigator.language?.toLowerCase() ?? '';
  if (nav.startsWith('en')) return 'en';
  return 'de';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', locale);
    }
  }, [locale]);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[locale];
    const fallback = DICTS.de;
    return {
      locale,
      setLocale: setLocaleState,
      t: (key, params) => {
        const raw = resolve(dict, key) || resolve(fallback, key) || key;
        return interpolate(raw, params);
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback wenn Provider nicht da (z.B. in isolierten Storybook-Renders).
    // Liefert deutsche Default-Werte ohne Locale-Switch.
    return {
      locale: 'de',
      setLocale: () => {},
      t: (key, params) => interpolate(resolve(de, key) || key, params),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useLocale(): [Locale, (l: Locale) => void] {
  const { locale, setLocale } = useI18n();
  return [locale, setLocale];
}
