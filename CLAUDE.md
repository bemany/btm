# BTM — Bethesna Task Management

Internes Task-, Zeit- und Kapazitäts-Tool für ~5–25 Mitarbeiter.
Phase-1-Frontend ist live, Phase-2-Backend (eigene API + Postgres) ebenfalls.
Multi-User-Auth, Server-State-Persistenz, MCP-Anbindung folgen.

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
- **LM-Studio**: `https://llm1.bemany.tech` mit Token `sk-lm-…` für Chat (`google/gemma-4-e4b`) — Tool-Use im Chat aktiv.
- **Backup**: `/opt/btm/backup.sh` (cron 03:30 UTC täglich), pg_dump.gz in `/opt/btm/backups/`, 14 Tage Retention.

### Alte Setup (LXC 139) — Rollback-Fallback
- LXC 139 (`192.168.40.139`) auf g40 läuft noch, `btm-api.service` ist `disabled` + `stopped`. Daten + Code intakt.
- Bei Bedarf zurück: `pct exec 139 -- systemctl enable --now btm-api`, dann CF-Tunnel-Route wieder anlegen + DNS auf CNAME zurück.
- Geplant: nach 1 Woche stabilen DO-Betrieb LXC 139 archivieren.

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript, Zustand-Store als UI-Cache, TanStack Query für Server-Sync (Tasks 30 s, Projects 60 s, Timer 15 s + Window-Focus).
- **Backend**: Hono auf Node 22, Better-Auth (Magic-Link + Admin-Rolle), Drizzle ORM, postgres-js Pool.
- **Auth**: Cookie-Sessions (Better-Auth) ODER Bearer-API-Token (`btm_<token>`, sha256-hashed at rest, scopes read/write).
- **Mail**: nodemailer (SMTP-SSL).
- **Webserver**: Caddy 2.11 — `/api/*` → `localhost:3001`, `/` → `/opt/apps/btm/dist` (SPA-Fallback, immutable Asset-Cache).
- **PWA**: vite-plugin-pwa (autoUpdate), Workbox precache + Window-focus-Refresh.

## Repo-Struktur

```
btm/
├── src/                  # Frontend (Vite-Entry: index.html → src/main.tsx)
│   ├── App.tsx           # Screen-Router, Tweaks-Effects, Hotkeys
│   ├── main.tsx          # Mount, ErrorBoundary, QueryClientProvider, AuthProvider, AppGate
│   ├── auth/             # AuthContext, LoginScreen, AppGate
│   ├── data/             # api.ts (Server-Calls + Field-Mapping), sync.ts (Tanstack), apiTokens.ts
│   ├── store/            # Zustand-Store (UI-State + Bridge zu Server-Daten)
│   ├── components/       # shell/, board/, screens/, drawers/, command-palette/, tweaks/, profile/
│   ├── lib/              # format.ts, pomodoro.ts, mockReply.ts (wird durch LM-Studio ersetzt)
│   └── styles/           # globio-tokens, btm, btm-glass, btm-dark, btm-admin, cmdk, sidebar-profile, auth, api-tokens
├── server/               # Backend (eigenes package.json + tsconfig)
│   ├── src/
│   │   ├── index.ts      # Hono-Server-Entrypoint
│   │   ├── lib/          # auth.ts (Better-Auth), context.ts (Bearer + Cookie), mailer.ts, api-token.ts
│   │   ├── routes/       # me, tasks, projects, users, api-tokens, (TODO: teams, activity)
│   │   └── db/           # client.ts, schema.ts, migrate.ts
│   └── drizzle/          # SQL-Migrations (drizzle-kit generate)
├── scripts/
│   ├── generate-icons.mjs   # SVG → PNG-PWA-Icons
│   └── smoke-test.mjs       # Playwright-Headless gegen Live, Screenshots /tmp/btm-shots/
└── public/               # static assets, app-icon.svg + PNG-Varianten, logo
```

## DB-Schema (heute)

Tabellen: `users`, `sessions`, `accounts`, `verifications` (Better-Auth) + `projects`, `tasks`, `task_sessions`, `live_timers`, `invitations`, `api_tokens`.

Migrations: `server/drizzle/`. Anwenden via `npm run db:migrate` (im server-Subdir).

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

## ToDo (bis "vollständig nutzbar")

### Blocker
- [ ] **Liste/Timeline-Ansicht klickbar** — Snap-Back zwischen Tweak-State und Store-Layout. Fix gemacht, deploy ausstehend.
- [ ] **Avatar/User-Anzeige auf echte Server-User mappen** — `Avatar.tsx`, `CapacityScreen.tsx`, `BoardTimeline.tsx` nutzen noch hardcoded PERSONAS.
- [ ] **TaskDetailDrawer-Selects** (Assignee/Project) müssen aus `/api/users` und Projects-Store kommen.
- [ ] **TimeCell** schreibt nicht zum Server — Sessions verschwinden nach Reload.

### Wichtig
- [ ] **Admin-UI**: UserCard-Grid + InviteCard + UserDrawer + TeamsDrawer + ActivitySidebar (Design im Bundle `GflJT49HmCtRM3_1bRc--g` vorhanden).
- [ ] **Backend-Erweiterung für Admin**: `users.status/phone/teamId`, Tabellen `teams` + `activity_log`, Routes `/api/teams`, `/api/activity`. Activity-Instrumentation in `tasks.ts`/`projects.ts`/`users.ts`.
- [ ] **Dark-Mode**: CSS `btm-dark.css` ist drin, Theme-Switcher unten links muss auf 4 Modi.
- [ ] **Sidebar-Admin-Eintrag** nur für `role=admin`.
- [ ] **Invite-Page** `/invite/:token` als Landing für eingeladene User.
- [ ] **AI-Drawer auf LM-Studio** (`glm-4.6v-flash`) statt `mockReply`. Token: `sk-lm-…` aus Memory.
- [ ] **MCP-Server** im `mcp/`-Subdir mit stdio-Transport, Tools für Tasks/Projects/Timer/me. Onboarding-Snippet im API-Token-Drawer.

### Production
- [ ] **Postgres-Backup-Job** auf g40 (täglich pg_dump → PBS).
- [ ] **Mobile-Responsive** — aktuell `viewport: width=1440` hartcoded.
- [ ] **Bundle-Splitting** — 980 kB JS auf Vendor/React/App auftrennen.
- [ ] **Live-Updates** statt Polling (SSE oder WebSocket).
- [ ] **Error-Toasts** für API-Fails.
- [ ] **Loading-Skeletons** vor erstem Sync.
- [ ] **CSP-Header** + Rate-Limiting auf API.

### Nice-to-have
- [ ] PWA-Offline-Cache für Tasks/Projects.
- [ ] Tastatur-Shortcuts (viel aus Prototyp ist noch nicht verkabelt).
- [ ] EN-Sprache.
- [ ] Audit-Log persistent.

## Wichtige Werte / Geheimnisse

Nicht in Git committen, leben in `/opt/apps/btm/server/.env` auf 139:

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
- **Persona-Konstante**: `src/store/seed.ts` hat noch hardcoded `PERSONAS` als Frontend-Fallback. Nicht weiter ausbauen — Migration auf Server-User-Liste steht an.

## Kontakt-Pfade

- **Cloudflare-API-Token (hakan)** für Tunnel-Routes: in Memory `~/.claude/projects/-Users-esrefyalcinkaya/memory/MEMORY.md`.
- **Outline-API-Token** für Doku: gleiche Memory-Datei.
- **g40 root**: `sshpass -p root ssh root@192.168.40.131`.
