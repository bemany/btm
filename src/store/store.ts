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
  /** Archiviert eine erledigte Aufgabe (FgPjnOpBdCX). */
  archiveTask: (id: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;

  startTimer: (taskId: string, withPomodoro?: boolean) => Promise<void>;
  stopTimer: () => Promise<void>;
  togglePomodoro: () => void;

  addProject: (partial: Partial<Project> & { code?: string; name?: string }) => Promise<Project | null>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // FMcAHI4aMlL / FFZUYjxdE5I: Modal-Prompt beim Aufgaben-Statuswechsel auf
  // 'review' ODER 'done'. Wer den Status verschiebt — egal ob via Kanban-DnD,
  // Status-Dropdown im Detail-Drawer oder anderen Pfaden — wird gebeten eine
  // kurze Notiz zu hinterlassen.
  completionPrompt: { taskId: string; targetCol: 'review' | 'done' } | null;
  /** Loest einen offenen Prompt mit Notiz auf und fuehrt den Move aus. */
  resolveCompletionPrompt: (action: 'with-note' | 'skip' | 'cancel', note?: string) => Promise<void>;

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
    ui: { drawer: null, taskDetailId: null, projectDetailId: null, layout: 'kanban' },
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
  if ('plannedFor' in patch) out.plannedFor = patch.plannedFor ?? [];
  if ('parentTaskId' in patch) out.parentTaskId = patch.parentTaskId ?? null;
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
        // FMcAHI4aMlL / FFZUYjxdE5I: Beim Move auf 'review' oder 'done'
        // Notiz-Prompt einblenden. Wir blocken den Move bis der User im Modal
        // entscheidet — der resolveCompletionPrompt-Aufruf macht den Move
        // dann tatsaechlich. Ausnahme: Task ist schon in der Zielspalte (z.B.
        // Re-Drop auf dieselbe Spalte).
        const current = get().tasks.find((t) => t.id === taskId);
        if ((toCol === 'done' || toCol === 'review') && current && current.col !== toCol) {
          set({ completionPrompt: { taskId, targetCol: toCol } });
          return;
        }
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

      completionPrompt: null,
      resolveCompletionPrompt: async (action, note) => {
        const prompt = get().completionPrompt;
        if (!prompt) return;
        set({ completionPrompt: null });
        if (action === 'cancel') return;
        const { taskId, targetCol } = prompt;
        const before = get().tasks;
        // Optimistic Move auf die Ziel-Spalte
        set({ tasks: before.map((t) => (t.id === taskId ? { ...t, col: targetCol } : t)) });
        try {
          if (action === 'with-note' && note && note.trim()) {
            // Comment vor dem Move posten, damit die Reihenfolge in der
            // Aktivitaets-Timeline sauber ist: erst Notiz, dann Status-
            // Wechsel.
            await api.createComment({
              subjectType: 'task',
              subjectId: taskId,
              body: note.trim(),
            }).catch((e) => console.warn('completion note save failed', e));
          }
          const updated = await api.updateTask(taskId, { column: targetCol });
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === updated.id ? api.fromServerTask(updated, []) : t)),
          }));
        } catch (e) {
          set({ tasks: before });
          console.error('completion move failed', e);
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
            parentTaskId: partial.parentTaskId ?? null,
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
        // FFZUYjxdE5I: Status-Wechsel auf 'review' oder 'done' via
        // updateTask (Detail-Drawer-Dropdown, Mobile-Sheet, AI-Tool-Calls
        // etc.) muss genauso den Completion-Note-Prompt triggern wie das
        // Kanban-DnD. Wir ziehen die Spalten-Aenderung raus und delegieren
        // an moveTask, der den Prompt-Hook hat — restliche Patch-Felder
        // werden zuerst gespeichert.
        if (patch.col === 'review' || patch.col === 'done') {
          const current = get().tasks.find((t) => t.id === id);
          if (current && current.col !== patch.col) {
            const { col: targetCol, ...rest } = patch;
            // Nicht-Spalten-Felder gleich persistieren (z.B. Titel-Edit
            // gleichzeitig). moveTask kuemmert sich danach um die Spalte
            // und triggert den Prompt.
            if (Object.keys(rest).length > 0) {
              const before = get().tasks;
              set({ tasks: before.map((t) => (t.id === id ? { ...t, ...rest } : t)) });
              try {
                const serverPatch = mapPatchToServer(rest);
                if (Object.keys(serverPatch).length > 0) {
                  const updated = await api.updateTask(id, serverPatch);
                  set((s) => ({
                    tasks: s.tasks.map((t) =>
                      t.id === id ? { ...api.fromServerTask(updated, []), sessions: t.sessions } : t,
                    ),
                  }));
                }
              } catch (e) {
                set({ tasks: before });
                console.error('updateTask (non-col fields) failed', e);
                return;
              }
            }
            await get().moveTask(id, targetCol);
            return;
          }
        }
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

      // Archiv: optimistisch aus der lokalen Liste rausnehmen (Default-Liste
      // zeigt nur active). Bei Fehler reinrollen.
      archiveTask: async (id) => {
        const before = get().tasks;
        set({ tasks: before.filter((t) => t.id !== id) });
        try {
          await api.archiveTask(id);
        } catch (e) {
          set({ tasks: before });
          console.error('archiveTask failed', e);
          throw e;
        }
      },
      unarchiveTask: async (id) => {
        try {
          await api.unarchiveTask(id);
          // Liste neu laden ist Aufgabe des Aufrufers (Archiv-Screen invalidet
          // die TanStack-Query nach diesem Call).
        } catch (e) {
          console.error('unarchiveTask failed', e);
          throw e;
        }
      },

      startTimer: async (taskId, withPomodoro) => {
        // FopYCYAqsYX: Pomodoro-Default kommt aus localStorage. Default an,
        // Arne (und alle die Pomodoro nicht brauchen) koennen es in den
        // Settings ausschalten.
        if (withPomodoro === undefined) {
          try {
            withPomodoro = localStorage.getItem('btm.pomodoroDefault') !== 'off';
          } catch {
            withPomodoro = true;
          }
        }
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
            ownerId: partial.ownerId ?? null,
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
            ownerId: patch.ownerId,
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
          ui: { drawer: null, taskDetailId: null, projectDetailId: null, layout: 'kanban' },
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
