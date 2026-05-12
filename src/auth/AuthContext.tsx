import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, authFetch, ApiError } from '../lib/api';
import type { AuthMode, AuthStatus, AuthUser } from './types';

interface MeResponse {
  user: AuthUser | null;
  authMode?: AuthMode;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  authMode: AuthMode;
  refresh: () => Promise<void>;
  signIn: (email: string, callbackURL?: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<MeResponse>('/me');
      if (data.user) {
        setUser(data.user);
        setAuthMode(data.authMode ?? null);
        setStatus('authenticated');
      } else {
        setUser(null);
        setAuthMode(null);
        setStatus('anon');
      }
    } catch (e) {
      console.warn('auth refresh failed', e);
      setUser(null);
      setStatus('anon');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, callbackURL = '/') => {
    setError(null);
    await authFetch('/sign-in/magic-link', {
      method: 'POST',
      body: { email, callbackURL: new URL(callbackURL, window.location.origin).toString() },
    });
  }, []);

  const signOut = useCallback(async () => {
    // WICHTIG: Better-Auth verlangt `Content-Type: application/json` selbst
    // bei einem POST OHNE Body — sonst antwortet der Server mit 415 und das
    // Session-Cookie wird NICHT gelöscht. Wir schicken daher einen leeren
    // JSON-Body (apiFetch setzt dadurch den Content-Type automatisch).
    // Fehler-Behandlung:
    //   • 200/401/403  → Session ist tot oder gerade beendet, lokal aufräumen
    //   • Netzwerk/5xx → werfen, damit der Caller den User darauf hinweisen
    //                    kann; lokal NICHT zurücksetzen (Cookie steht noch
    //                    → User wäre nach Reload wieder eingeloggt und würde
    //                    irre).
    let sessionGone = true;
    try {
      await authFetch('/sign-out', { method: 'POST', body: {} });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // Session war serverseitig schon weg — OK, lokal angleichen
      } else {
        sessionGone = false;
        console.warn('sign-out failed', e);
        throw e;
      }
    }
    if (sessionGone) {
      // Body-Theme zurück auf default (hell) — die Landing soll für Anon hell sein.
      // localStorage bleibt unverändert, damit die User-Theme-Wahl beim nächsten
      // Login wiederhergestellt wird.
      document.body.dataset.theme = 'default';
      setUser(null);
      setAuthMode(null);
      setStatus('anon');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, authMode, refresh, signIn, signOut, error }),
    [status, user, authMode, refresh, signIn, signOut, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
