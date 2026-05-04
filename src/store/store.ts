// Zustand-Store als Cache für Server-State + UI-State.
//
// Lese-Daten (tasks/projects/timer) werden vom useServerSync()-Hook
// beim Mount + Polling befüllt. Mutations (addTask, moveTask, ...) rufen
// die API und schreiben das Ergebnis lokal — invalidiert wird über
// TanStack Query, das wiederum useServerSync triggert.
//
// Persistiert wird in localStorage NUR der UI-State (filter, ui, currentUser),
// nicht die Server-Daten — beim Reload kommt alles frisch vom Server.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BTMState,
  Task,
  Project,
  LayoutMode,
  UIState,
  Filter,
  Timer,
  AppUser,
  AppTeam,
  AppInvitation,
} from './types';
import * as api from '../data/api';

interface BTMActions {
  // Bridge: Server → Store (vom Sync-Layer aufgerufen)
  setTasks: (tasks: Task[]) => void;
  setProjects: (projects: Project[]) => void;
  setTimer: (timer: Timer | null) => void;
  setUsers: (users: AppUser[]) => void;
  setTeams: (teams: AppTeam[]) => void;
  setInvitations: (invitations: AppInvitation[]) => void;

  // Mutations: rufen API + cachen Ergebnis lokal (optimistic-style)
  moveTask: (taskId: string, toCol: Task['col']) => Promise<void>;
  reorderTask: (taskId: string, toCol: Task['col'], beforeTaskId: string | null) => Promise<void>;
  addTask: (partial: Partial<Task> & { title: string }) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  startTimer: (taskId: string, withPomodoro?: boolean) => Promise<void>;
  stopTimer: () => Promise<void>;
  togglePomodoro: () => void;

  addProject: (partial: Partial<Project> & { code?: string; name?: string }) => Promise<Project | null>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // UI-State (rein lokal)
  setUI: (patch: Partial<UIState>) => void;
  setFilter: (patch: Partial<Filter>) => void;
  setUser: (id: string) => void;
  setLayout: (layout: LayoutMode) => void;

  // Lokalen UI-State zurücksetzen (Server-Daten bleiben unangetastet)
  resetDemo: () => void;
}

export type BTMStore = BTMState & BTMActions;

const STORAGE_KEY = 'btm.ui.v1';

function initialState(): BTMState {
  return {
    currentUser: '',
    projects: [],
    tasks: [],
    users: [],
    teams: [],
    invitations: [],
    filter: { proj: 'all', who: 'mine', q: '' },
    timer: null,
    ui: { drawer: null, taskDetailId: null, layout: 'kanban' },
  };
}

function mapPatchToServer(patch: Partial<Task>): api.UpdateTaskInput {
  const out: api.UpdateTaskInput = {};
  if (patch.title !== undefined) out.title = patch.title;
  if ('desc' in patch) out.description = patch.desc ?? null;
  if (patch.col !== undefined) out.column = patch.col;
  if (patch.prio !== undefined) out.priority = patch.prio;
  if (patch.estH !== undefined) out.estH = patch.estH;
  if ('proj' in patch) out.projectId = patch.proj ?? null;
  if ('who' in patch) out.assigneeId = patch.who || null;
  if ('due' in patch) out.due = (patch.due as string | null | undefined) ?? null;
  return out;
}

export const useStore = create<BTMStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setTasks: (tasks) => set({ tasks }),
      setProjects: (projects) => set({ projects }),
      setTimer: (timer) => set({ timer }),
      setUsers: (users) => set({ users }),
      setTeams: (teams) => set({ teams }),
      setInvitations: (invitations) => set({ invitations }),

      moveTask: async (taskId, toCol) => {
        const before = get().tasks;
        // Optimistic
        set({ tasks: before.map((t) => (t.id === taskId ? { ...t, col: toCol } : t)) });
        try {
          const updated = await api.updateTask(taskId, { column: toCol });
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === updated.id ? api.fromServerTask(updated, []) : t)),
          }));
        } catch (e) {
          set({ tasks: before });
          console.error('moveTask failed', e);
        }
      },

      reorderTask: async (taskId, toCol) => {
        // Server hat aktuell kein expliziertes Reorder-Endpoint — Spalte ändern reicht.
        return get().moveTask(taskId, toCol);
      },

      addTask: async (partial) => {
        try {
          const created = await api.createTask({
            title: partial.title,
            description: partial.desc ?? null,
            column: partial.col,
            priority: partial.prio,
            estH: partial.estH,
            due: (partial.due as string | null | undefined) ?? null,
            projectId: partial.proj ?? null,
            assigneeId: partial.who ?? get().currentUser ?? null,
          });
          const t = api.fromServerTask(created, []);
          set((s) => ({ tasks: [...s.tasks, t] }));
          return t;
        } catch (e) {
          console.error('addTask failed', e);
          return null;
        }
      },

      updateTask: async (id, patch) => {
        const before = get().tasks;
        // Optimistic
        set({ tasks: before.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
        try {
          const serverPatch = mapPatchToServer(patch);
          if (Object.keys(serverPatch).length === 0) return; // nichts auf Server zu schicken
          const updated = await api.updateTask(id, serverPatch);
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...api.fromServerTask(updated, []), sessions: t.sessions } : t,
            ),
          }));
        } catch (e) {
          set({ tasks: before });
          console.error('updateTask failed', e);
        }
      },

      deleteTask: async (id) => {
        const before = get().tasks;
        set({ tasks: before.filter((t) => t.id !== id) });
        try {
          await api.deleteTask(id);
        } catch (e) {
          set({ tasks: before });
          console.error('deleteTask failed', e);
        }
      },

      startTimer: async (taskId, withPomodoro = true) => {
        try {
          const live = await api.startServerTimer(taskId, withPomodoro);
          set({ timer: api.fromServerLiveTimer(live) });
        } catch (e) {
          console.error('startTimer failed', e);
        }
      },

      stopTimer: async () => {
        try {
          await api.stopServerTimer();
          set({ timer: null });
        } catch (e) {
          console.error('stopTimer failed', e);
        }
      },

      togglePomodoro: () =>
        set((s) => {
          if (!s.timer) return s;
          const now = Date.now();
          if (s.timer.pomodoro) return { timer: { ...s.timer, pomodoro: null } };
          return {
            timer: {
              ...s.timer,
              pomodoro: { mode: 'focus', blockIndex: 0, blocksDone: 0, startedAt: now },
            },
          };
        }),

      addProject: async (partial) => {
        if (!partial.code || !partial.name) {
          console.warn('addProject braucht code+name');
          return null;
        }
        try {
          const created = await api.createProject({
            code: partial.code,
            name: partial.name,
            color: partial.color ?? '#6B6359',
            client: partial.client ?? null,
            due: partial.due ?? null,
          });
          const p = api.fromServerProject(created);
          set((s) => ({ projects: [...s.projects, p] }));
          return p;
        } catch (e) {
          console.error('addProject failed', e);
          return null;
        }
      },

      updateProject: async (id, patch) => {
        const before = get().projects;
        set({ projects: before.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
        try {
          const updated = await api.updateProject(id, {
            code: patch.code,
            name: patch.name,
            color: patch.color,
            client: patch.client,
            due: patch.due,
          });
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? api.fromServerProject(updated) : p)),
          }));
        } catch (e) {
          set({ projects: before });
          console.error('updateProject failed', e);
        }
      },

      deleteProject: async (id) => {
        const before = get().projects;
        set({
          projects: before.filter((p) => p.id !== id),
          tasks: get().tasks.map((t) => (t.proj === id ? { ...t, proj: null } : t)),
        });
        try {
          await api.deleteProject(id);
        } catch (e) {
          set({ projects: before });
          console.error('deleteProject failed', e);
        }
      },

      setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
      setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
      setUser: (id) => set({ currentUser: id }),
      setLayout: (layout) => set((s) => ({ ui: { ...s.ui, layout } })),

      // Reset rein-lokaler UI-State (Server-Daten bleiben).
      resetDemo: () =>
        set((s) => ({
          ...s,
          filter: { proj: 'all', who: 'mine', q: '' },
          ui: { drawer: null, taskDetailId: null, layout: 'kanban' },
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persistiere NUR UI-Settings, nicht die Server-Daten.
      partialize: (s) => ({
        currentUser: s.currentUser,
        filter: s.filter,
        ui: s.ui,
      }),
    },
  ),
);
