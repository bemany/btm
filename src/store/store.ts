import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BTMState, Task, Project, LayoutMode, UIState, Filter } from './types';
import { SEED_PROJECTS, seedTasks } from './seed';

interface BTMActions {
  moveTask: (taskId: string, toCol: Task['col']) => void;
  reorderTask: (taskId: string, toCol: Task['col'], beforeTaskId: string | null) => void;
  addTask: (partial: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  startTimer: (taskId: string, withPomodoro?: boolean) => void;
  stopTimer: () => void;
  togglePomodoro: () => void;

  addProject: (partial: Partial<Project>) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  setUI: (patch: Partial<UIState>) => void;
  setFilter: (patch: Partial<Filter>) => void;
  setUser: (id: string) => void;
  setLayout: (layout: LayoutMode) => void;

  resetDemo: () => void;
}

export type BTMStore = BTMState & BTMActions;

// v5 = Demo-Daten entfernt, leere DB beim ersten Start
const STORAGE_KEY = 'btm.state.v5';

function initialState(): BTMState {
  return {
    currentUser: 'AR',
    projects: SEED_PROJECTS.slice(),
    tasks: seedTasks(),
    filter: { proj: 'all', who: 'mine', q: '' },
    timer: null,
    ui: { drawer: null, taskDetailId: null, layout: 'kanban' },
  };
}

function shortId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export const useStore = create<BTMStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      moveTask: (taskId, toCol) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, col: toCol } : t)),
        })),

      reorderTask: (taskId, toCol, beforeTaskId) =>
        set((s) => {
          const moving = s.tasks.find((t) => t.id === taskId);
          if (!moving) return s;
          const others = s.tasks.filter((t) => t.id !== taskId);
          const updated: Task = { ...moving, col: toCol };
          if (!beforeTaskId) {
            const colTasks = others.filter((t) => t.col === toCol);
            const last = colTasks[colTasks.length - 1];
            const insertIdx = last ? others.indexOf(last) + 1 : others.length;
            const out = [...others];
            out.splice(insertIdx, 0, updated);
            return { tasks: out };
          }
          const idx = others.findIndex((t) => t.id === beforeTaskId);
          const out = [...others];
          out.splice(idx, 0, updated);
          return { tasks: out };
        }),

      addTask: (partial) => {
        const t: Task = {
          col: 'todo',
          estH: 1.0,
          loggedH: 0,
          who: get().currentUser,
          prio: 'med',
          proj: null,
          ...partial,
          id: shortId('T'),
          createdAt: Date.now(),
          sessions: [],
        };
        set((s) => ({ tasks: [...s.tasks, t] }));
        return t;
      },

      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      startTimer: (taskId, withPomodoro = false) =>
        set((s) => {
          const now = Date.now();
          let tasks = s.tasks;
          if (s.timer) {
            const elapsedH = (now - s.timer.startedAt) / 1000 / 3600;
            const prevId = s.timer.taskId;
            const prevStart = s.timer.startedAt;
            tasks = tasks.map((t) =>
              t.id === prevId
                ? {
                    ...t,
                    loggedH: +(t.loggedH + elapsedH).toFixed(2),
                    sessions: [...t.sessions, { from: prevStart, to: now, h: +elapsedH.toFixed(2), source: 'timer' }],
                  }
                : t,
            );
          }
          return {
            tasks,
            timer: {
              taskId,
              startedAt: now,
              pomodoro: withPomodoro
                ? { mode: 'focus', blockIndex: 0, blocksDone: 0, startedAt: now }
                : null,
            },
          };
        }),

      stopTimer: () =>
        set((s) => {
          if (!s.timer) return s;
          const now = Date.now();
          const elapsedH = (now - s.timer.startedAt) / 1000 / 3600;
          const prevId = s.timer.taskId;
          const prevStart = s.timer.startedAt;
          const tasks = s.tasks.map((t) =>
            t.id === prevId
              ? {
                  ...t,
                  loggedH: +(t.loggedH + elapsedH).toFixed(2),
                  sessions: [...t.sessions, { from: prevStart, to: now, h: +elapsedH.toFixed(2), source: 'timer' as const }],
                }
              : t,
          );
          return { tasks, timer: null };
        }),

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

      addProject: (partial) => {
        const p: Project = {
          id: shortId('P'),
          code: 'NEU',
          name: 'Neues Projekt',
          color: '#6B6359',
          client: '',
          due: null,
          ...partial,
        };
        set((s) => ({ projects: [...s.projects, p] }));
        return p;
      },

      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) => (t.proj === id ? { ...t, proj: null } : t)),
        })),

      setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
      setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),
      setUser: (id) => set({ currentUser: id }),
      setLayout: (layout) => set((s) => ({ ui: { ...s.ui, layout } })),

      resetDemo: () => set({ ...initialState() }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): BTMState => ({
        currentUser: s.currentUser,
        projects: s.projects,
        tasks: s.tasks,
        filter: s.filter,
        timer: s.timer,
        ui: s.ui,
      }),
    },
  ),
);
