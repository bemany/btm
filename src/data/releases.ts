// Release-Notes, Roadmap-Items und Known-Issues für die /releases-Seite
// und das Release-Modal beim Login.
//
// Pflege: bei jedem Deploy einen neuen Eintrag oben in RELEASES anhängen.
// `version` ist die Vergleichs-Schlüssel für „neu seit"-Logik im Modal —
// muss SemVer-artig sortierbar sein (mehr-stellig durch padding bzw.
// monoton steigend).

export type ChangeKind = 'feature' | 'fix' | 'change' | 'breaking';

export interface ReleaseChange {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string; // z. B. "0.5.0"
  date: string; // ISO-Date
  title: string;
  changes: ReleaseChange[];
}

export interface RoadmapItem {
  title: string;
  description?: string;
  eta?: string;
}

export interface KnownIssue {
  title: string;
  description: string;
  workaround?: string;
  status: 'investigating' | 'fix-pending' | 'external';
  reportedAt: string;
}

// ── Releases (neueste zuerst) ──────────────────────────────────────────

export const RELEASES: Release[] = [
  {
    version: '0.5.0',
    date: '2026-05-05',
    title: 'Onboarding-Tour, Dark-Mode-Kontrast, MCP-Validierung',
    changes: [
      {
        kind: 'feature',
        text:
          'Geführte Onboarding-Tour beim ersten Login — über Profil → „Tour wiederholen" jederzeit erneut startbar.',
      },
      { kind: 'feature', text: 'Diese Release-Seite + Modal mit Hinweisen bei jedem Deploy.' },
      {
        kind: 'feature',
        text:
          'KI-Chat: Reasoning-Blöcke (`<think>…</think>`) sind eingeklappt — Klick auf „Gedanken" öffnet sie.',
      },
      {
        kind: 'fix',
        text:
          'Dark-Mode: Live-Timer-Hero, Topbar, Pomo-Dots, Suchfeld — alles mit lesbarem Kontrast.',
      },
      {
        kind: 'fix',
        text: 'Magic-Link-Login lieferte 500 (DB-Schema-Drift). Onboarding-Spalte nachmigriert.',
      },
      {
        kind: 'fix',
        text:
          'KI-Extract gab 502 (LM-Studio-Inkompatibilität: `json_object` → `json_schema`).',
      },
      {
        kind: 'change',
        text: 'Tweak-Widget komplett entfernt — Theme-Auswahl jetzt im Profil-Menü unten links.',
      },
      {
        kind: 'change',
        text:
          'MCP-Server: Protocol-Version-Echo, gegen offiziellen `@modelcontextprotocol/sdk`-Client durchvalidiert.',
      },
    ],
  },
];

// ── Aktuell in Arbeit ──────────────────────────────────────────────────

export const ROADMAP: RoadmapItem[] = [
  {
    title: 'Wechsel auf Gemma 4 E4B',
    description:
      'Native Function-Calling-Support → der KI-Chat kann Aufgaben direkt anlegen, verschieben, Timer starten.',
    eta: 'sobald LM-Studio-Engine das Modell stabil lädt',
  },
  {
    title: 'Postgres-Backup-Job',
    description: 'Tägliches pg_dump in den PBS-Storage auf g40.',
    eta: 'KW 19',
  },
  {
    title: 'Mobile-Responsive Layout',
    description:
      'Aktuell ist `viewport=1440` hartcoded. Mobile bekommt eigene, dichtere Layouts.',
  },
  {
    title: 'Live-Updates via SSE',
    description:
      'Tasks/Timer/Projekte updaten sich ohne Polling — wenn Person A was verschiebt, sieht Person B es sofort.',
    eta: 'angefangen, Frontend-Wiring ausstehend',
  },
];

// ── Bekannte Probleme ──────────────────────────────────────────────────

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: 'Claude.ai (Web) zeigt „Couldn’t reach the MCP server"',
    description:
      'Bekannter Anthropic-Broker-Bug — selbst spec-konforme MCP-Server scheitern an der Connector-Validierung im Browser. Unser Server ist gegen den offiziellen MCP-SDK-Client validiert (volle Tool-Liste, Tool-Calls, Session — alles grün).',
    workaround:
      'Claude Desktop (Mac/Win) statt Web nutzen — funktioniert zuverlässig. Setup-Anleitung im Profil-Menü → API-Tokens → MCP.',
    status: 'external',
    reportedAt: '2026-05-04',
  },
  {
    title: 'KI-Planungsassistent zeitweise offline',
    description:
      'LM-Studio auf der RTX-3080-Maschine wird gerade auf Gemma 4 E4B umgestellt. In der Übergangszeit kann Extract / Chat 502 oder Timeout liefern.',
    workaround:
      'Nochmal versuchen sobald „Gemma loaded" gemeldet wurde — bis dahin Aufgaben manuell anlegen.',
    status: 'fix-pending',
    reportedAt: '2026-05-05',
  },
];

// ── Helper: ungesehene Releases im Vergleich zur „last seen"-Version ───

const STORAGE_KEY = 'btm.lastSeenRelease';

export function getLastSeenRelease(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLastSeenRelease(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* ignore */
  }
}

// Naive numerische Versions-Vergleichslogik für Strings wie "0.5.0".
// Reicht für unseren simplen Increment-Workflow.
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function unseenReleases(lastSeen: string | null): Release[] {
  if (!lastSeen) return RELEASES;
  return RELEASES.filter((r) => cmpVersion(r.version, lastSeen) > 0);
}

export function latestReleaseVersion(): string | null {
  return RELEASES[0]?.version ?? null;
}
