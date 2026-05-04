// useServerSync — lädt Tasks/Projects/Timer beim Mount + Polling
// und schreibt das Ergebnis in den Zustand-Store.
//
// Wird einmal hoch in der Komponenten-Hierarchie aufgerufen (App-Wurzel
// nach AppGate), läuft also nur für eingeloggte User.

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useStore } from '../store/store';
import * as api from './api';

const TASKS_KEY = ['btm', 'tasks'] as const;
const PROJECTS_KEY = ['btm', 'projects'] as const;
const TIMER_KEY = ['btm', 'liveTimer'] as const;

export function useServerSync(): void {
  const setTasks = useStore((s) => s.setTasks);
  const setProjects = useStore((s) => s.setProjects);
  const setTimer = useStore((s) => s.setTimer);

  const tasksQ = useQuery({
    queryKey: TASKS_KEY,
    queryFn: api.listTasks,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const projectsQ = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: api.listProjects,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const timerQ = useQuery({
    queryKey: TIMER_KEY,
    queryFn: api.getLiveTimer,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
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
}
