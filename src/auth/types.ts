export type Role = 'admin' | 'member';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  cap: number;
  color: string;
  jobTitle?: string | null;
  boardDefaultView?: 'kanban' | 'list' | 'timeline';
  onboardingCompletedAt?: string | null;
  notifyMentionsMail?: boolean;
  notifyDigestMail?: boolean;
  backgroundChoice?: string;
}

export type AuthMode = 'session' | 'apiToken' | null;

export type AuthStatus = 'loading' | 'anon' | 'authenticated';
