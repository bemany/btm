// /tv?token=… Fullscreen — Sidebar-/Topbar-los, eigener API-Modus mit Bearer-Token.
// Damit kann ein dediziertes Office-Display die Wand bespielen ohne Login.

import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { setApiTokenOverride, ApiError } from '../lib/api';
import { TVDashboardScreen } from '../components/drawers/TVDashboardScreen';
import * as api from '../data/api';
import { useQuery } from '@tanstack/react-query';

interface Props {
  token: string | null;
}

// Aggressives Retry-Profil für TV-Queries — der Bildschirm soll
// nicht bei einem kurzen API-Hick-up den Token-Error-Screen zeigen.
// 8 Versuche mit Exponential-Backoff (1s, 2s, 4s, … gecappt auf 30s).
const TV_RETRY = 8;
const TV_RETRY_DELAY = (attemptIndex: number) =>
  Math.min(1000 * 2 ** attemptIndex, 30_000);

// Auth-Fehler erkennen — nur dann fatal-Screen zeigen, alles andere
// (Netzwerk, 5xx, Timeout) ist transient und auto-heilt sich.
function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

// Wenn der TV länger als BOOTSTRAP_TIMEOUT auf „Verbinde …" hängt
// (initial-load schafft keinen Erfolg) ODER länger als STALE_TIMEOUT
// keinen erfolgreichen Refetch hatte, machen wir einen Hard-Reload.
// Realwelt-Symptom (Raspberry Pi am Office-TV): Chromium-Tab degradiert
// nach Stunden, fetch hängt ohne Error → ohne diesen Watchdog muss der
// Pi physisch neugestartet werden.
const BOOTSTRAP_TIMEOUT_MS = 90_000;  // 1.5 Min ohne erste Daten → Reload
const STALE_TIMEOUT_MS = 5 * 60_000;  // 5 Min ohne Refetch-Erfolg → Reload

export function TVRoute({ token }: Props) {
  const setTasks = useStore((s) => s.setTasks);
  const setProjects = useStore((s) => s.setProjects);
  const setTimer = useStore((s) => s.setTimer);
  const setUsers = useStore((s) => s.setUsers);

  // Token-Override aktivieren, body-Class für TV-Layout setzen
  useEffect(() => {
    if (token) setApiTokenOverride(token);
    document.body.classList.add('tv-fullscreen');
    return () => {
      setApiTokenOverride(null);
      document.body.classList.remove('tv-fullscreen');
    };
  }, [token]);

  // Auto-Reload-Intervall aus ?reload=… (Sekunden, default keiner).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reloadStr = params.get('reload');
    const seconds = reloadStr ? parseInt(reloadStr, 10) : NaN;
    if (!Number.isFinite(seconds) || seconds < 30) return;
    const id = setTimeout(() => window.location.reload(), seconds * 1000);
    return () => clearTimeout(id);
  }, []);

  // Eigene Polling-Loops (15 s) — sind aggressiver als die normale App weil das
  // Display ja immer aktuell sein soll.
  const tasksQ = useQuery({
    queryKey: ['btm', 'tv', 'tasks'],
    queryFn: api.listTasks,
    enabled: !!token,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: TV_RETRY,
    retryDelay: TV_RETRY_DELAY,
  });
  const projectsQ = useQuery({
    queryKey: ['btm', 'tv', 'projects'],
    queryFn: api.listProjects,
    enabled: !!token,
    refetchInterval: 60_000,
    retry: TV_RETRY,
    retryDelay: TV_RETRY_DELAY,
  });
  const timerQ = useQuery({
    queryKey: ['btm', 'tv', 'timer'],
    queryFn: api.getLiveTimer,
    enabled: !!token,
    refetchInterval: 10_000,
    retry: TV_RETRY,
    retryDelay: TV_RETRY_DELAY,
  });
  const usersQ = useQuery({
    queryKey: ['btm', 'tv', 'users'],
    queryFn: api.listUsers,
    enabled: !!token,
    refetchInterval: 60_000,
    retry: TV_RETRY,
    retryDelay: TV_RETRY_DELAY,
  });

  useEffect(() => {
    if (tasksQ.data) setTasks(tasksQ.data.map((t) => api.fromServerTask(t)));
  }, [tasksQ.data, setTasks]);
  useEffect(() => {
    if (projectsQ.data) setProjects(projectsQ.data.map(api.fromServerProject));
  }, [projectsQ.data, setProjects]);
  useEffect(() => {
    setTimer(api.fromServerLiveTimer(timerQ.data ?? null));
  }, [timerQ.data, setTimer]);
  useEffect(() => {
    if (usersQ.data) setUsers(usersQ.data);
  }, [usersQ.data, setUsers]);

  // ── Watchdog ─────────────────────────────────────────────────────────
  // Bootstrap-Timeout: nach BOOTSTRAP_TIMEOUT_MS ohne erste Daten → Reload.
  // Stale-Timeout: nach STALE_TIMEOUT_MS ohne erfolgreichen Refetch → Reload.
  // React-Query liefert `dataUpdatedAt` (timestamp ms) bei letztem Erfolg.
  const mountedAtRef = useRef<number>(Date.now());
  const lastSuccessRef = useRef<number>(Date.now());
  const hasInitialData = !!tasksQ.data && !!usersQ.data;
  useEffect(() => {
    const latest = Math.max(
      tasksQ.dataUpdatedAt || 0,
      projectsQ.dataUpdatedAt || 0,
      timerQ.dataUpdatedAt || 0,
      usersQ.dataUpdatedAt || 0,
    );
    if (latest > lastSuccessRef.current) lastSuccessRef.current = latest;
  }, [tasksQ.dataUpdatedAt, projectsQ.dataUpdatedAt, timerQ.dataUpdatedAt, usersQ.dataUpdatedAt]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const sinceMount = now - mountedAtRef.current;
      const sinceSuccess = now - lastSuccessRef.current;
      // Bootstrap: noch nie Daten gesehen UND zu lange schon
      if (!hasInitialData && sinceMount > BOOTSTRAP_TIMEOUT_MS) {
        console.warn('[tv] bootstrap timeout — reloading');
        window.location.reload();
        return;
      }
      // Stale: Daten waren mal da, aber Refetch klappt seit X nicht
      if (hasInitialData && sinceSuccess > STALE_TIMEOUT_MS) {
        console.warn('[tv] stale data — reloading');
        window.location.reload();
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [token, hasInitialData]);

  if (!token) {
    return (
      <div className="tv-token-missing">
        <div className="tv-token-card">
          <h1>TV-Modus</h1>
          <p>
            Diese Seite braucht einen API-Token, um ohne Login zu laufen.
            <br />
            Erstell einen in deinem Profil → API-Tokens und ruf die Seite mit{' '}
            <code>?token=…</code> auf.
          </p>
          <a href="/" className="login-btn-secondary">
            Zur App
          </a>
        </div>
      </div>
    );
  }

  // Echte Auth-Fehler (401/403) → fataler Token-ungültig-Screen.
  // Transiente Fehler (Netzwerk, 5xx, Container-Restart) → wir zeigen das
  // letzte bekannte Dashboard weiter, plus kleinen Reconnect-Banner falls
  // alles fehlschlägt. React Query refetcht selbständig alle 10–60s.
  const authFailed = isAuthError(tasksQ.error) || isAuthError(usersQ.error);
  if (authFailed) {
    return (
      <div className="tv-token-missing">
        <div className="tv-token-card">
          <h1>Token ungültig</h1>
          <p>
            Der Token wurde abgelehnt. Erstell einen neuen in deinem Profil → API-Tokens.
          </p>
          <a href="/" className="login-btn-secondary">
            Zur App
          </a>
        </div>
      </div>
    );
  }

  // Noch keine Daten und kein Auth-Error → Initial-Load-Spinner (kurz)
  if (!tasksQ.data && !usersQ.data) {
    return (
      <div className="tv-token-missing">
        <div className="tv-token-card">
          <h1>Verbinde …</h1>
          <p>Hole aktuelle Daten vom Server. Sollte in wenigen Sekunden bereit sein.</p>
        </div>
      </div>
    );
  }

  // Transient-Fehler-Indikator: Dashboard rendert mit Last-Known-Daten,
  // oben rechts schwebt ein kleiner Banner bis der nächste Refetch klappt.
  const reconnecting =
    (tasksQ.isError || usersQ.isError || projectsQ.isError) && !authFailed;

  return (
    <>
      <TVDashboardScreen />
      {reconnecting && (
        <div className="tv-reconnect-banner">
          <span className="tv-reconnect-dot" />
          Server nicht erreichbar — versuche neu zu verbinden …
        </div>
      )}
    </>
  );
}
