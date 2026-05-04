import type { Persona, Project, Column, Task } from './types';

export const PERSONAS: Persona[] = [
  { id: 'AR', name: 'Arne', full: 'Arne Bethge', role: 'Web/Marketing', cap: 40, color: '#4a6f8a' },
  { id: 'ES', name: 'Esref', full: 'Esref Yıldız', role: 'Backend', cap: 40, color: '#b86a3a' },
  { id: 'HK', name: 'Hakan', full: 'Hakan Demir', role: 'iOS', cap: 32, color: '#6a8455' },
  { id: 'AM', name: 'Amon', full: 'Amon Schubert', role: 'Android', cap: 32, color: '#8a5a8a' },
  { id: 'PM', name: 'PM', full: 'Projektleitung', role: 'Lead', cap: 40, color: '#9a3838' },
];

export const SEED_PROJECTS: Project[] = [];

export const COLUMNS: Column[] = [
  { id: 'todo',   label: 'Backlog',   dot: '#A8A097' },
  { id: 'doing',  label: 'In Arbeit', dot: '#C85A2C' },
  { id: 'review', label: 'Review',    dot: '#5573A0' },
  { id: 'done',   label: 'Erledigt',  dot: '#5E7F4E' },
];

export function seedTasks(): Task[] {
  return [];
}
