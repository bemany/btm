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
  // Odoo-Calendar-Sync-State (kein API-Key, nur Anzeige-Felder)
  odooUrl?: string | null;
  odooDatabase?: string | null;
  odooUsername?: string | null;
  odooHasApiKey?: boolean;
  odooSyncEnabled?: boolean;
  odooLastSyncAt?: string | null;
  odooLastSyncError?: string | null;
  /** Wenn true: eigene Events erscheinen auf dem TV-Dashboard mit
   *  Title 'Privat' (Location + Attendees werden ausgeblendet).
   *  „Meine Woche" zeigt eigene Titel immer voll. */
  calendarTvPrivate?: boolean;
  /** Per-User Akzentfarbe als Hex '#RRGGBB'. null/undefined → globaler
   *  BTM-Default Orange (#c85a2c). Wird in App.tsx bei Mount als
   *  CSS-Variable --accent-500/--accent-600 auf <body> gesetzt. */
  accentColor?: string | null;
}

export type AuthMode = 'session' | 'apiToken' | null;

export type AuthStatus = 'loading' | 'anon' | 'authenticated';
