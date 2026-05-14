export type ColumnId = 'todo' | 'planned' | 'doing' | 'review' | 'done';
export type Priority = 'high' | 'med' | 'low';
export type LayoutMode = 'kanban' | 'list' | 'timeline';
export type ScreenId = 'week' | 'board' | 'capacity' | 'times' | 'projects' | 'inbox' | 'mobile' | 'chrome' | 'tv' | 'admin' | 'releases';
export type ThemeBase = 'default' | 'glass';
export type ThemeBrightness = 'light' | 'dark';
// CSS-data-theme-Werte: kombinieren Base + Dunkel-Variante.
export type ThemeMode = 'default' | 'glass' | 'default-dark' | 'glass-dark';

export function composeTheme(base: ThemeBase, brightness: ThemeBrightness): ThemeMode {
  if (brightness === 'dark') return base === 'glass' ? 'glass-dark' : 'default-dark';
  return base === 'glass' ? 'glass' : 'default';
}

export function decomposeTheme(theme: ThemeMode): { base: ThemeBase; brightness: ThemeBrightness } {
  switch (theme) {
    case 'glass-dark': return { base: 'glass', brightness: 'dark' };
    case 'default-dark': return { base: 'default', brightness: 'dark' };
    case 'glass': return { base: 'glass', brightness: 'light' };
    default: return { base: 'default', brightness: 'light' };
  }
}

export const ALL_THEMES: ThemeMode[] = ['default', 'glass', 'default-dark', 'glass-dark'];

export interface Project {
  id: string;
  code: string;
  name: string;
  color: string;
  client: string;
  due: string | null;
  ownerId?: string | null;
  /** Wenn gesetzt: privates Projekt — nur für diesen User sichtbar. Tasks
   *  daraus dürfen NICHT auf öffentlichen Flächen (TV-Dashboard etc) erscheinen. */
  privateOwnerId?: string | null;
  /** Vom aktuellen User als Favorit markiert. Komplett user-spezifisch. */
  isFavorite?: boolean;
}

export interface Column {
  id: ColumnId;
  label: string;
  dot: string;
}

export interface Session {
  id?: string;
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
  due?: string | 'today' | 'tomorrow' | null;
  sessions: Session[];
  createdAt: number;
  attachments?: Array<{ name: string; size?: number }>;
  /** Wenn gesetzt: diese Aufgabe ist Subtask einer anderen. */
  parentTaskId?: string | null;
  /** ISO-Timestamp wenn archiviert, sonst null/undef. (FgPjnOpBdCX) */
  archivedAt?: string | null;
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
  // 'mine' = eigene Tasks, 'all' = alle Personen, ansonsten konkrete User-ID
  who: 'mine' | 'all' | string;
  q: string;
}

export interface UIState {
  drawer: 'ai' | null;
  taskDetailId: string | null;
  projectDetailId: string | null;
  layout: LayoutMode;
}

export type Role = 'admin' | 'member';
export type UserStatus = 'active' | 'invited' | 'inactive';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  status: UserStatus;
  cap: number;
  color: string;
  jobTitle: string | null;
  phone: string | null;
  /** Primary-Team (Backwards-Compat in Views wo nur ein Team pro User gerendert wird). */
  teamId: string | null;
  /** Alle Team-Mitgliedschaften des Users. Enthält teamId auch (Multi-Team-
   *  Erweiterung in Migration 0015). */
  teamIds?: string[];
  boardDefaultView: LayoutMode;
  createdAt: string;
}

export interface AppTeam {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}

export interface AppInvitation {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  teamId: string | null;
  cap: number;
  invitedById: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface BTMState {
  currentUser: string;
  projects: Project[];
  tasks: Task[];
  users: AppUser[];
  teams: AppTeam[];
  invitations: AppInvitation[];
  filter: Filter;
  timer: Timer | null;
  ui: UIState;
}
