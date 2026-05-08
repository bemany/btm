export type Role = 'admin' | 'member';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  cap: number;
  color: string;
  boardDefaultView?: 'kanban' | 'list' | 'timeline';
}

export type AuthMode = 'session' | 'apiToken' | null;

export type AuthStatus = 'loading' | 'anon' | 'authenticated';
