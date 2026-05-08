// Release-Notes, Roadmap-Items und Known-Issues für die /releases-Seite
// und das Release-Modal beim Login.
//
// Pflege: bei jedem Deploy einen neuen Eintrag oben in RELEASES anhängen.
// `version` ist die Vergleichs-Schlüssel für „neu seit"-Logik im Modal —
// muss SemVer-artig sortierbar sein (mehr-stellig durch padding bzw.
// monoton steigend).
//
// Übersetzungen: alle Text-Felder akzeptieren entweder einen string
// (dann unübersetzt für beide Sprachen) oder ein { de, en }-Objekt.
// Der Locale-Resolver `tx()` löst zur Render-Zeit auf.

export type ChangeKind = 'feature' | 'fix' | 'change' | 'breaking';

export type Localizable = string | { de: string; en: string };

export interface ReleaseChange {
  kind: ChangeKind;
  text: Localizable;
}

export interface Release {
  version: string; // z. B. "0.5.0"
  date: string; // ISO-Date
  title: Localizable;
  changes: ReleaseChange[];
}

export interface RoadmapItem {
  title: Localizable;
  description?: Localizable;
  eta?: Localizable;
}

export interface KnownIssue {
  title: Localizable;
  description: Localizable;
  workaround?: Localizable;
  status: 'investigating' | 'fix-pending' | 'external';
  reportedAt: string;
}

export function tx(value: Localizable, locale: 'de' | 'en'): string {
  if (typeof value === 'string') return value;
  return value[locale] ?? value.de;
}

// ── Releases (neueste zuerst) ──────────────────────────────────────────

export const RELEASES: Release[] = [
  {
    version: '0.6.0',
    date: '2026-05-08',
    title: {
      de: 'Englisch-Sprache, Settings-Modal, Aktivitäts-Filter, Dark-Mode-Audit',
      en: 'English language, settings modal, activity filter, dark-mode audit',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Komplette UI auf Englisch umschaltbar — Profil-Menu unten links → Sprache → Deutsch / English. Datum und Zahlen passen sich automatisch an (de-DE / en-US).',
          en: 'Full UI switchable to English — profile menu bottom-left → language → Deutsch / English. Dates and numbers adapt automatically (de-DE / en-US).',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Settings-Modal mit Tab-Navigation (Aussehen / Sprache / API-Tokens / Daten). Tastenkürzel ⌘, öffnet es überall in der App. Ersetzt das alte überfrachtete Profil-Menu.',
          en: 'Settings modal with tab navigation (Appearance / Language / API tokens / Data). Shortcut ⌘, opens it from anywhere. Replaces the old crowded profile menu.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Aktivitäts-Sidebar im Admin: neuer Filter „Alle Bearbeiter" — Aktivitäten nach einzelnem User filterbar.',
          en: 'Activity sidebar in admin: new "All actors" filter — activities filterable per user.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Sidebar-Profil-Menu drastisch verschlankt: User-Header, Theme-Quick-Toggle (Glass/Studio + Hell/Dunkel inline), Einstellungen, Abmelden. Der Rest wandert ins Settings-Modal.',
          en: 'Sidebar profile menu slimmed down dramatically: user header, theme quick-toggle (Glass/Studio + Light/Dark inline), settings, sign out. The rest moved into the settings modal.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Wochenboard zeigt jetzt alle 5 Spalten (Backlog · Zu erledigen · In Arbeit · Review · Erledigt) nebeneinander. Vorher wrappte „Erledigt" in eine zweite Zeile.',
          en: 'Week board now shows all 5 columns (Backlog · To do · In progress · Review · Done) side by side. "Done" used to wrap into a second row.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Dark-Mode: globaler `body { color }` gesetzt — Elemente ohne explizite Textfarbe waren im Dark-Mode unsichtbar (z.B. „Hallo Esref."-Heading, Projekt-Namen, In-Arbeit-Cards). Alle Pages nochmal systematisch durchgegangen.',
          en: "Dark mode: global `body { color }` set — elements without an explicit text color were invisible in dark mode (e.g. \"Hallo Esref.\" heading, project names, in-progress cards). All pages walked through systematically.",
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Times Σ-Spalte (Total): war im Dark-Mode invertierter weißer Klotz mit dunklem Text. Jetzt Akzent-tinted, gleiches Look-and-Feel wie der Rest.',
          en: 'Times Σ column (total): was an inverted white block with dark text in dark mode. Now accent-tinted, matching the rest.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Settings-Modal-Hintergrund weniger transparent — Inhalte hinter dem Modal störten beim Lesen. Backdrop dunkler, Modal fast solid.',
          en: 'Settings modal background less transparent — content behind the modal made it hard to read. Backdrop darker, modal almost solid.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Sidebar Theme-Quick-Toggle bricht im Dark-Mode nicht mehr aus dem Container (jetzt 2×2-Grid statt einer langen Reihe).',
          en: 'Sidebar theme quick-toggle no longer overflows the container in dark mode (now 2×2 grid instead of one long row).',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Sub-Text-Kontrast im Dark-Mode aufgehellt — Counter, Timestamps, Stunden-Anzeigen, Stat-Labels lesbar statt fast unsichtbar.',
          en: 'Sub-text contrast in dark mode lifted — counters, timestamps, hour indicators, stat labels readable instead of barely visible.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Komplettes BTM von LXC 139 (intern, CF-Tunnel) auf DigitalOcean-VPS 142.93.172.15 mit Caddy + Docker-Compose umgezogen — schneller, robuster, eigene SSL-Cert.',
          en: 'Whole BTM moved from LXC 139 (internal, CF tunnel) to DigitalOcean VPS 142.93.172.15 with Caddy + Docker Compose — faster, more robust, own SSL cert.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Magic-Link-Mails enthalten jetzt zusätzlich einen 6-stelligen Code — praktisch in der PWA, wenn der Klick im Mailprogramm einen externen Browser öffnet.',
          en: 'Magic-link emails now also include a 6-digit code — handy in the PWA when the link click opens an external browser.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Mobile-Layout (< 768px): eigene 3-Screen-Vorschau (Heute / Timer / KI) mit Bottom-Tab-Bar statt Desktop-Sidebar.',
          en: 'Mobile layout (< 768px): dedicated 3-screen view (Today / Timer / AI) with bottom tab bar instead of desktop sidebar.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Privat-Projekt pro User — nur der Owner sieht es, andere bekommen es nicht zu Gesicht.',
          en: 'Private project per user — only the owner sees it, others never get it.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Wochenboard-Default-Ansicht (Kanban/Liste/Timeline) wird pro User serverseitig gespeichert. Onboarding-Tour fragt direkt danach.',
          en: 'Week-board default view (Kanban/List/Timeline) saved per user on the server. Onboarding tour asks for it directly.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Aufgaben-Beschreibung im TaskDetail-Drawer ruckelte beim Tippen — jetzt nur noch onBlur Sync, kein Buchstabe-für-Buchstabe-Lag mehr.',
          en: "Task description in the TaskDetail drawer stuttered while typing — now syncs only onBlur, no more letter-by-letter lag.",
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Wochenboard-Timeline: Tasks ohne Frist wandern in einen eigenen „Ohne Frist"-Bucket statt in zufällige Wochentag-Spalten.',
          en: "Week-board timeline: tasks without a deadline land in a separate \"No deadline\" bucket instead of random weekday columns.",
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'KI-Chat: markerlose Reasoning-Texte (ohne `<think>`-Tags) werden jetzt heuristisch erkannt und nicht mehr als Antwort angezeigt.',
          en: 'AI chat: markerless reasoning prose (without `<think>` tags) is now heuristically detected and no longer shown as the actual reply.',
        },
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-05',
    title: {
      de: 'Onboarding-Tour, Dark-Mode-Kontrast, MCP-Validierung',
      en: 'Onboarding tour, dark-mode contrast, MCP validation',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Geführte Onboarding-Tour beim ersten Login — über Profil → „Tour wiederholen" jederzeit erneut startbar.',
          en: 'Guided onboarding tour on first login — replay any time via profile → "Replay tour".',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Diese Release-Seite + Modal mit Hinweisen bei jedem Deploy.',
          en: 'This release page + modal with hints on every deploy.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'KI-Chat: Reasoning-Blöcke (`<think>…</think>`) sind eingeklappt — Klick auf „Gedanken" öffnet sie.',
          en: 'AI chat: reasoning blocks (`<think>…</think>`) are collapsed — click "Thoughts" to open them.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Dark-Mode: Live-Timer-Hero, Topbar, Pomo-Dots, Suchfeld — alles mit lesbarem Kontrast.',
          en: 'Dark mode: live timer hero, topbar, pomo dots, search field — all with readable contrast.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Magic-Link-Login lieferte 500 (DB-Schema-Drift). Onboarding-Spalte nachmigriert.',
          en: 'Magic-link login returned 500 (DB schema drift). Onboarding column back-migrated.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'KI-Extract gab 502 (LM-Studio-Inkompatibilität: `json_object` → `json_schema`).',
          en: 'AI extract returned 502 (LM-Studio incompatibility: `json_object` → `json_schema`).',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Tweak-Widget komplett entfernt — Theme-Auswahl jetzt im Profil-Menü unten links.',
          en: 'Tweak widget removed entirely — theme selection now in the profile menu bottom-left.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'MCP-Server: Protocol-Version-Echo, gegen offiziellen `@modelcontextprotocol/sdk`-Client durchvalidiert.',
          en: 'MCP server: protocol-version echo, validated against the official `@modelcontextprotocol/sdk` client.',
        },
      },
    ],
  },
];

// ── Aktuell in Arbeit ──────────────────────────────────────────────────

export const ROADMAP: RoadmapItem[] = [
  {
    title: { de: 'Live-Updates via SSE', en: 'Live updates via SSE' },
    description: {
      de: 'Tasks/Timer/Projekte updaten sich ohne Polling — wenn Person A was verschiebt, sieht Person B es sofort.',
      en: 'Tasks/timer/projects update without polling — when person A moves something, person B sees it instantly.',
    },
    eta: {
      de: 'angefangen, Frontend-Wiring ausstehend',
      en: 'started, frontend wiring pending',
    },
  },
  {
    title: { de: 'Postgres-Backup-Job', en: 'Postgres backup job' },
    description: {
      de: 'Tägliches pg_dump.gz nach `/opt/btm/backups/` — Cron 03:30 UTC, 14 Tage Retention.',
      en: 'Daily pg_dump.gz into `/opt/btm/backups/` — cron 03:30 UTC, 14-day retention.',
    },
    eta: { de: 'läuft auf DO-VPS', en: 'running on DO VPS' },
  },
  {
    title: { de: 'Wechsel auf Gemma 4 E4B', en: 'Switch to Gemma 4 E4B' },
    description: {
      de: 'Native Function-Calling-Support → der KI-Chat kann Aufgaben direkt anlegen, verschieben, Timer starten.',
      en: 'Native function-calling support → the AI chat can create tasks, move them, start timers directly.',
    },
    eta: {
      de: 'sobald LM-Studio-Engine das Modell stabil lädt',
      en: 'once LM-Studio engine loads the model stably',
    },
  },
];

// ── Bekannte Probleme ──────────────────────────────────────────────────

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: {
      de: 'Claude.ai (Web) zeigt „Couldn’t reach the MCP server"',
      en: 'Claude.ai (web) shows "Couldn\'t reach the MCP server"',
    },
    description: {
      de: 'Bekannter Anthropic-Broker-Bug — selbst spec-konforme MCP-Server scheitern an der Connector-Validierung im Browser. Unser Server ist gegen den offiziellen MCP-SDK-Client validiert (volle Tool-Liste, Tool-Calls, Session — alles grün).',
      en: 'Known Anthropic broker bug — even spec-compliant MCP servers fail the connector validation in the browser. Our server is validated against the official MCP SDK client (full tool list, tool calls, session — all green).',
    },
    workaround: {
      de: 'Claude Desktop (Mac/Win) statt Web nutzen — funktioniert zuverlässig. Setup-Anleitung in Einstellungen → API-Tokens → MCP.',
      en: 'Use Claude Desktop (Mac/Win) instead of web — works reliably. Setup guide in settings → API tokens → MCP.',
    },
    status: 'external',
    reportedAt: '2026-05-04',
  },
  {
    title: {
      de: 'KI-Planungsassistent zeitweise offline',
      en: 'AI planning assistant occasionally offline',
    },
    description: {
      de: 'LM-Studio auf der RTX-3080-Maschine wird gerade auf Gemma 4 E4B umgestellt. In der Übergangszeit kann Extract / Chat 502 oder Timeout liefern.',
      en: 'LM-Studio on the RTX-3080 machine is being switched to Gemma 4 E4B. In the transition period extract / chat may return 502 or timeout.',
    },
    workaround: {
      de: 'Nochmal versuchen sobald „Gemma loaded" gemeldet wurde — bis dahin Aufgaben manuell anlegen.',
      en: 'Retry once "Gemma loaded" is reported — until then, create tasks manually.',
    },
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
