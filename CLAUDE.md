# BTM — Bethesna Task Management

Internes Task-, Zeit- und Kapazitäts-Tool für ~5–25 Mitarbeiter.
Stand v0.10.0 (10.05.2026): voll multi-user, Server-State persistent, MCP über `/api/mcp`,
Mail-Notifications + Daily-Digest, Comments + Mentions + Inbox, Subtasks, Projekt-Owner,
Feedback-System, animierte Glass-Hintergründe. Siehe [`RELEASES.md`](./RELEASES.md) für Versions-Historie.

---

## Live-URLs

| Umgebung | URL | Status |
|---|---|---|
| Production | https://btm.bethesna.org | Live |
| API | https://btm.bethesna.org/api | Live |
| Repo | https://github.com/bemany/btm | Privat |
| Doku | https://docs.bemany.tech/doc/lxc-139-bethesna-tasks-btm-frontend-Ya09Ax1TX1 | Outline |

## Infrastruktur (seit 2026-05-05 auf Digital Ocean)

- **DO-VPS** `n8n-bemany` (`142.93.172.15`) — Ubuntu 22.04, 2 cores, 4 GB RAM. SSH key-auth (`~/.ssh/id_ed25519`).
- **Stack als Docker-Compose** unter `/opt/btm/`:
  - `btm-api` (gebaut aus `server/Dockerfile`, Node 22 alpine multi-stage)
  - `btm-postgres` (postgres:16-alpine, Volume `btm-pgdata`)
  - Beide Container in den Netzen `btm_default` (intern) und `n8n-docker-caddy_default` (für Caddy).
- **Reverse-Proxy: bestehender Caddy-Container** in `/root/n8n-docker-caddy/`:
  - Caddyfile-Block `btm.bethesna.org { … }` mit `/api/events` → `flush_interval -1` (SSE), `/api/*` → `btm-api:3001`, Rest → `/srv/btm` (Volume `/opt/btm/dist`).
  - Caddy holt Lets-Encrypt-Cert direkt (kein Cloudflare-Tunnel mehr).
- **DNS**: A `btm.bethesna.org` → `142.93.172.15`, Cloudflare-Proxy AUS (grey cloud).
- **Postgres**: 16-alpine, Datenbank `btm`, User `btm`. Passwort + Secrets in `/opt/btm/.env` (chmod 600, nur root). Compose injiziert per `environment:` → kein Read im Container.
- **Initial-Admin**: `esref@bemany.de` (Magic-Link → automatisch role=admin durch DB-Hook).
- **SMTP** für Magic-Links: `smtp.ionos.de:465 SSL`, User `portal@meinfahrer.app`.
- **AI**: OpenAI (`https://api.openai.com`, Default-Modell `gpt-4o-mini`) für AI-Drawer + Chat-Bubble, OpenAI-Chat-Completions-Protokoll mit Function-Calling. Seit 2026-05-14 (Feature FkqjgMk6RH6) — vorher LM-Studio mit Gemma 4 (Tool-Use unzuverlässig). Provider-Switch über Env: `OPENAI_API_KEY` + optional `OPENAI_MODEL` / `OPENAI_BASE_URL`. Code in `server/src/routes/ai.ts` bleibt rückwärtskompatibel zu `LMSTUDIO_*` als Fallback.
- **Backup**: `/opt/btm/backup.sh` (cron 03:30 UTC täglich), pg_dump.gz in `/opt/btm/backups/`, 14 Tage Retention.

### Alte Setup (LXC 139) — Rollback-Fallback (auslaufend)
- LXC 139 (`192.168.40.139`) auf g40 läuft noch, `btm-api.service` ist `disabled` + `stopped`. Daten + Code intakt.
- Bei Bedarf zurück: `pct exec 139 -- systemctl enable --now btm-api`, dann CF-Tunnel-Route wieder anlegen + DNS auf CNAME zurück.
- Heute Tag 5 nach Migration — bei stabilem Betrieb am 12.05. archivieren (Snapshot + LXC stoppen).

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript, Zustand-Store als UI-Cache, TanStack Query für Server-Sync (Tasks 30 s, Projects 60 s, Timer 15 s + Window-Focus).
- **Backend**: Hono auf Node 22, Better-Auth (Magic-Link + Admin-Rolle), Drizzle ORM, postgres-js Pool.
- **Auth**: Cookie-Sessions (Better-Auth) ODER Bearer-API-Token (`btm_<token>`, sha256-hashed at rest, scopes read/write).
- **Mail**: nodemailer (SMTP-SSL).
- **Webserver**: Caddy-Container in `/root/n8n-docker-caddy/` — `/api/events` mit `flush_interval -1` (SSE), `/api/*` → `btm-api:3001`, Rest → Volume `/srv/btm` (= Host `/opt/btm/dist`).
- **PWA**: vite-plugin-pwa (autoUpdate), Workbox precache + Window-focus-Refresh.

## Repo-Struktur

```
btm/
├── src/                  # Frontend (Vite-Entry: index.html → src/main.tsx)
│   ├── App.tsx           # Screen-Router, Tweaks-Effects, Hotkeys
│   ├── main.tsx          # Mount, ErrorBoundary, QueryClientProvider, AuthProvider, AppGate
│   ├── auth/             # AuthContext, LoginScreen, AppGate
│   ├── data/             # api.ts (Server-Calls + Field-Mapping), sync.ts (Tanstack), apiTokens.ts, releases.ts
│   ├── store/            # Zustand-Store (UI-State + Bridge zu Server-Daten)
│   ├── components/       # shell/, board/, screens/, drawers/, command-palette/, comments/, backgrounds/, settings/, projects/, sessions/, feedback/
│   ├── lib/              # format.ts, pomodoro.ts, inlineMarkdown.tsx, i18n
│   └── styles/           # globio-tokens, btm, btm-glass, btm-dark, btm-admin, cmdk, comments, inbox, datepicker, backgrounds, subtasks, sessions, project-members, feedback, settings, releases
├── server/               # Backend (eigenes package.json + tsconfig)
│   ├── src/
│   │   ├── index.ts      # Hono-Server-Entrypoint
│   │   ├── lib/          # auth, context, mailer, api-token, mentions, notifications, digest, project-visibility, activity, events
│   │   ├── routes/       # me, tasks, projects, users, api-tokens, comments, notifications, feedback, activity, sessions, mcp, sse
│   │   └── db/           # client.ts, schema.ts, migrate.ts
│   └── drizzle/          # SQL-Migrations (0000–0010), drizzle-kit generate
├── scripts/
│   ├── generate-icons.mjs   # SVG → PNG-PWA-Icons
│   └── smoke-test.mjs       # Playwright-Headless gegen Live, Screenshots /tmp/btm-shots/
└── public/               # static assets, app-icon.svg + PNG-Varianten, logo
```

## DB-Schema (Stand v0.10.0)

Better-Auth: `users`, `sessions`, `accounts`, `verifications`.

Domain:
- `projects`, `project_members` (role: owner|member|reader)
- `tasks` (mit `parent_task_id` für Subtasks), `task_sessions`, `live_timers`
- `comments`, `comment_mentions`, `notifications` (kind: 'mention' | 'review_assigned' | …)
- `feedback` (kind: bug|feature, status: open|in_progress|done)
- `activity_log`, `invitations`, `api_tokens`

User-Spalten zusätzlich zu Better-Auth-Default: `role`, `status`, `phone`, `teamId`, `office`, `jobTitle`, `avatarBase64`, `boardView`, `language`, `backgroundChoice`, `notifyPrefs` (JSONB: `{ mention: bool, digest: bool }`), `lastSeenInboxAt`.

Migrations: `server/drizzle/0000_*.sql … 0010_subtasks_and_feedback.sql`.
Auf Production **manuell** anwenden:
```bash
ssh -i ~/.ssh/id_ed25519 root@142.93.172.15 "docker exec -i btm-postgres psql -U btm -d btm" < server/drizzle/0010_subtasks_and_feedback.sql
```
Lokal: `npm run db:migrate` im `server/`-Subdir.

## Deploy-Workflow (DO-VPS, Docker)

```bash
# Lokal bauen + Bundle-Pakete erstellen
cd ~/Documents/GitHub/btm
npm run build                                          # Frontend → dist/
tar --exclude=server/node_modules --exclude=server/dist --exclude=server/.env \
    -czf /tmp/btm-server-src.tar.gz server docker-compose.yml
tar -czf /tmp/btm-dist.tar.gz dist

# Hochladen (Key-Auth)
scp -i ~/.ssh/id_ed25519 /tmp/btm-server-src.tar.gz /tmp/btm-dist.tar.gz \
    root@142.93.172.15:/opt/btm/

# Auf dem Server: extract, build, restart
ssh -i ~/.ssh/id_ed25519 root@142.93.172.15 "
  cd /opt/btm
  tar -xzf btm-server-src.tar.gz && tar -xzf btm-dist.tar.gz
  rm btm-server-src.tar.gz btm-dist.tar.gz
  docker compose build btm-api
  docker compose up -d btm-api
  # Drizzle-Migrationen werden NICHT auto-applied — bei Schema-Änderungen
  # einmalig manuell:
  # docker exec btm-api node -e \"…\"  oder direkt SQL via btm-postgres-Container
"

# Logs prüfen
ssh -i ~/.ssh/id_ed25519 root@142.93.172.15 "docker logs btm-api --tail 30 -f"
```

## Lokal entwickeln

```bash
npm install
npm run dev           # Vite auf 127.0.0.1:5173, /api/* proxy → btm.bethesna.org
node scripts/smoke-test.mjs   # Playwright-Smoke gegen Live; Screenshots /tmp/btm-shots/
```

Backend lokal:

```bash
cd server
npm install
cp .env.example .env  # DATABASE_URL etc. setzen
npm run dev           # tsx watch src/index.ts
```

## ToDo

### Production
- [ ] **Postgres-Backup-Job vom DO-VPS** — aktuell läuft `/opt/btm/backup.sh` lokal mit 14d-Retention. Off-site-Kopie nach g40-PBS oder S3-Bucket fehlt.
- [ ] **Bundle-Splitting** — 980 kB JS auf Vendor/React/App auftrennen.
- [ ] **Loading-Skeletons** vor erstem Sync.
- [ ] **CSP-Header** + Rate-Limiting auf API.
- [ ] **LXC 139 archivieren** — sobald DO 1 Woche stabil (Ziel 12.05.).

### Nice-to-have
- [ ] PWA-Offline-Cache für Tasks/Projects (Workbox runtime-caching).
- [ ] Tastatur-Shortcuts vollständig verkabeln (vieles aus Prototyp noch nicht).
- [ ] Audit-Log-UI für Admin (Daten existieren in `activity_log`, Sidebar zeigt's, aber kein dedizierter Screen).
- [ ] Anhänge an Aufgaben (Roadmap-Item, Drawer-Platzhalter steht).
- [ ] KI legt Tasks direkt an (Tool-Use im AI-Drawer ausbauen).
- [ ] Live-Updates für Comments/Inbox (SSE-Topic `notifications` + `comments` existieren — Frontend invalidiert noch via Polling).

### Erledigt seit v0.5.0
Alle früheren Blocker (Live-Timeline, Server-User-Mapping, TimeCell-Persist, Admin-UI, Dark-Mode-4-Modi, Invite-Page, AI auf LM-Studio, MCP-Server, SSE, Mobile, Error-Toasts, EN-Sprache) — siehe `RELEASES.md`.

## Wichtige Werte / Geheimnisse

Nicht in Git committen, leben in `/opt/btm/.env` auf der DO-VPS (chmod 600, root-only).
Compose injiziert per `environment:` → kein direkter Read im Container nötig:

```
DATABASE_URL=postgres://btm:<PASS>@localhost:5432/btm
BETTER_AUTH_SECRET=<random 64 hex>
BETTER_AUTH_URL=https://btm.bethesna.org
TRUSTED_ORIGINS=https://btm.bethesna.org
INITIAL_ADMIN_EMAIL=esref@bemany.de
SMTP_HOST=smtp.ionos.de
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=portal@meinfahrer.app
SMTP_PASS=<...>
SMTP_FROM=BTM <portal@meinfahrer.app>
```

Backups dieser Datei separat sichern.

## Konventionen

- **CSS-Tokens** kommen aus `globio-tokens.css` (keine harten Farben außer in btm-dark.css-Overrides).
- **Field-Mapping** Server↔Frontend liegt in `src/data/api.ts`. UI-Komponenten arbeiten mit dem Frontend-Schema (`task.col`, `task.who`, `task.proj`); der Server hat `column`, `assigneeId`, `projectId`. Mapping nur in dieser Datei.
- **Auth-Schicht**: Browser-Session (Cookie) für UI, Bearer-Token für MCP/CLI. Token-Erstellen geht *nur* via Cookie-Session.
- **Demo-Datum**: Frontend hat einen UI-Anker `Mo 04.05.2026 KW 19` in `src/lib/format.ts`. Echte Daten kommen aus DB; das ist nur die Format-Konstante.
- **Releases**: Bei jedem Deploy mit User-sichtbaren Änderungen Eintrag in `src/data/releases.ts` (oben anhängen) + `RELEASES.md` spiegeln + `version` bumpen.
- **Mention-Encoding**: `@[Name](userId)` als sichtbares Token im Comment-Body. Regex `MENTION_RE` in `server/src/lib/mentions.ts` und `src/lib/inlineMarkdown.tsx` — beide synchron halten.
- **Notifications-Trigger**: explizit in Routes (`fanoutMentions()` in `comments.ts`, Review-Notify in `tasks.ts`), nicht via DB-Trigger. Diff-basiert beim Edit (oldSet vs newSet) — keine Doppel-Notifications.
- **Project-Visibility**: `server/src/lib/project-visibility.ts` filtert in jeder Tasks-Query basierend auf `project_members`. Projekte ohne Mitglieder sind public (kein Plötzliches-Verschwinden bei Migration).

## Kontakt-Pfade

- **Cloudflare-API-Token (hakan)** für Tunnel-Routes: in Memory `~/.claude/projects/-Users-user-Documents-GitHub-btm/memory/MEMORY.md`.
- **Outline-API-Token** für Doku: gleiche Memory-Datei.
- **DO-VPS**: `ssh -i ~/.ssh/id_ed25519 root@142.93.172.15`.
- **g40 root** (LXC 139 Rollback): `sshpass -p root ssh root@192.168.40.131`.
