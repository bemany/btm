import type { Project, Column, Task } from './types';

// PERSONAS / SEED_PROJECTS / seedTasks() sind seit dem Wechsel auf
// Server-State (TanStack Query) ohne Funktion. COLUMNS bleibt — die
// Spalten sind UI-Konstanten und werden nicht aus dem Server geladen.

export const SEED_PROJECTS: Project[] = [];

export const COLUMNS: Column[] = [
  { id: 'todo',    label: 'Backlog',      dot: '#A8A097' },
  { id: 'planned', label: 'Zu erledigen', dot: '#C8A04C' },
  { id: 'doing',   label: 'In Arbeit',    dot: '#C85A2C' },
  { id: 'review',  label: 'Review',       dot: '#5573A0' },
  { id: 'done',    label: 'Erledigt',     dot: '#5E7F4E' },
];

export function seedTasks(): Task[] {
  return [];
}
