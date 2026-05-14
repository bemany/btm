// useServerSync — lädt Tasks/Projects/Timer beim Mount + Polling
// und schreibt das Ergebnis in den Zustand-Store.
//
// Wird einmal hoch in der Komponenten-Hierarchie aufgerufen (App-Wurzel
// nach AppGate), läuft also nur für eingeloggte User.

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useStore } from '../store/store';
import { useAuth } from '../auth/AuthContext';
import * as api from './api';

const TASKS_KEY = ['btm', 'tasks'] as const;
const PROJECTS_KEY = ['btm', 'projects'] as const;
const TIMER_KEY = ['btm', 'liveTimer'] as const;
const USERS_KEY = ['btm', 'users'] as const;
const TEAMS_KEY = ['btm', 'teams'] as const;
const INVITATIONS_KEY = ['btm', 'invitations'] as const;
const WEEK_SESSIONS_KEY = ['btm', 'weekSessions'] as const;
const TASK_SESSIONS_KEY = ['btm', 'taskSessions'] as const;
const PROJECT_MEMBERS_KEY = ['btm', 'projectMembers'] as const;
const COMMENTS_KEY = ['btm', 'comments'] as const;
const NOTIFICATIONS_KEY = ['btm', 'notifications'] as const;
const NOTIFICATION_COUNT_KEY = ['btm', 'notifications', 'count'] as const;
const CALENDAR_MY_KEY = ['btm', 'calendar', 'my'] as const;
const CALENDAR_ALL_KEY = ['btm', 'calendar', 'all'] as const;

export function useServerSync(): void {
  const setTasks = useStore((s) => s.setTasks);
  const setProjects = useStore((s) => s.setProjects);
  const setTimer = useStore((s) => s.setTimer);
  const setUsers = useStore((s) => s.setUsers);
  const setTeams = useStore((s) => s.setTeams);
  const setInvitations = useStore((s) => s.setInvitations);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const tasksQ = useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => api.listTasks(),
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

  // Users + Teams werden von allen gelesen (Avatar, Capacity, Assignee-Selects)
  const usersQ = useQuery({
    queryKey: USERS_KEY,
    queryFn: api.listUsers,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const teamsQ = useQuery({
    queryKey: TEAMS_KEY,
    queryFn: api.listTeams,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  // Einladungen sind admin-only — non-admin user bekommt sonst 403-Spam
  const invitesQ = useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: api.listInvitations,
    enabled: isAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (usersQ.data) setUsers(usersQ.data);
  }, [usersQ.data, setUsers]);
  useEffect(() => {
    if (teamsQ.data) setTeams(teamsQ.data);
  }, [teamsQ.data, setTeams]);
  useEffect(() => {
    if (invitesQ.data) setInvitations(invitesQ.data);
  }, [invitesQ.data, setInvitations]);
}

// Helper für Mutations: invalidiert alle gecachten Queries.
export const SYNC_KEYS = {
  TASKS: TASKS_KEY,
  PROJECTS: PROJECTS_KEY,
  TIMER: TIMER_KEY,
  USERS: USERS_KEY,
  TEAMS: TEAMS_KEY,
  INVITATIONS: INVITATIONS_KEY,
  WEEK_SESSIONS: WEEK_SESSIONS_KEY,
  TASK_SESSIONS: TASK_SESSIONS_KEY,
  PROJECT_MEMBERS: PROJECT_MEMBERS_KEY,
  COMMENTS: COMMENTS_KEY,
  NOTIFICATIONS: NOTIFICATIONS_KEY,
  NOTIFICATION_COUNT: NOTIFICATION_COUNT_KEY,
  CALENDAR_MY: CALENDAR_MY_KEY,
  CALENDAR_ALL: CALENDAR_ALL_KEY,
} as const;
