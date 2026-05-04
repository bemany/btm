// /tv?token=… Fullscreen — Sidebar-/Topbar-los, eigener API-Modus mit Bearer-Token.
// Damit kann ein dediziertes Office-Display die Wand bespielen ohne Login.

import { useEffect } from 'react';
import { useStore } from '../store/store';
import { setApiTokenOverride } from '../lib/api';
import { TVDashboardScreen } from '../components/drawers/TVDashboardScreen';
import * as api from '../data/api';
import { useQuery } from '@tanstack/react-query';

interface Props {
  token: string | null;
}

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

  // Eigene Polling-Loops (15 s) — sind aggressiver als die normale App weil das
  // Display ja immer aktuell sein soll.
  const tasksQ = useQuery({
    queryKey: ['btm', 'tv', 'tasks'],
    queryFn: api.listTasks,
    enabled: !!token,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const projectsQ = useQuery({
    queryKey: ['btm', 'tv', 'projects'],
    queryFn: api.listProjects,
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const timerQ = useQuery({
    queryKey: ['btm', 'tv', 'timer'],
    queryFn: api.getLiveTimer,
    enabled: !!token,
    refetchInterval: 10_000,
  });
  const usersQ = useQuery({
    queryKey: ['btm', 'tv', 'users'],
    queryFn: api.listUsers,
    enabled: !!token,
    refetchInterval: 60_000,
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

  if (tasksQ.isError || usersQ.isError) {
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

  return <TVDashboardScreen />;
}
