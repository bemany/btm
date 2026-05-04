export type ColumnId = 'todo' | 'doing' | 'review' | 'done';
export type Priority = 'high' | 'med' | 'low';
export type LayoutMode = 'kanban' | 'list' | 'timeline';
export type ScreenId = 'week' | 'board' | 'capacity' | 'times' | 'projects' | 'mobile' | 'chrome' | 'tv';
export type ThemeMode = 'default' | 'glass';

export interface Persona {
  id: string;
  name: string;
  full: string;
  role: string;
  cap: number;
  color: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  color: string;
  client: string;
  due: string | null;
}

export interface Column {
  id: ColumnId;
  label: string;
  dot: string;
}

export interface Session {
  from: number;
  to: number;
  h: number;
  source?: 'timer' | 'manual';
}

export interface Task {
  id: string;
  title: string;
  desc?: string;
  col: ColumnId;
  who: string;
  proj: string | null;
  estH: number;
  loggedH: number;
  prio: Priority;
  due?: string | 'today' | 'tomorrow';
  sessions: Session[];
  createdAt: number;
  attachments?: Array<{ name: string; size?: number }>;
}

export type PomodoroMode = 'focus' | 'short' | 'long';

export interface PomodoroState {
  mode: PomodoroMode;
  blockIndex: number;
  blocksDone: number;
  startedAt: number;
}

export interface Timer {
  taskId: string;
  startedAt: number;
  pomodoro: PomodoroState | null;
}

export interface Filter {
  proj: string;
  who: 'mine' | 'all';
  q: string;
}

export interface UIState {
  drawer: 'ai' | null;
  taskDetailId: string | null;
  layout: LayoutMode;
}

export interface BTMState {
  currentUser: string;
  projects: Project[];
  tasks: Task[];
  filter: Filter;
  timer: Timer | null;
  ui: UIState;
}
