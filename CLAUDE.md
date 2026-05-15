# BTM — Bemany Task Management

Team task, time and capacity management tool for small teams (5–25 people).
Stand v0.12.0: multi-user, persistent server state, MCP via `/api/mcp`,
per-user accent color, OpenAI tool use, calendar sync (Odoo + iCal), task archive,
mail notifications + daily digest, comments + mentions + inbox, subtasks, project owner,
feedback system (with screenshot upload), animated glass backgrounds.
See [`RELEASES.md`](./RELEASES.md) for version history.

---

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript, Zustand store as UI cache, TanStack Query for server sync (tasks 30 s, projects 60 s, timer 15 s + window focus).
- **Backend**: Hono on Node 22, Better-Auth (magic link + admin role), Drizzle ORM, postgres-js pool.
- **Auth**: Cookie sessions (Better-Auth) OR Bearer API token (`btm_<token>`, sha256-hashed at rest, scopes read/write).
- **Mail**: nodemailer (SMTP-SSL).
- **Webserver**: Caddy — `/api/events` with `flush_interval -1` (SSE), `/api/*` → backend, rest → `/srv/btm` (dist).
- **PWA**: vite-plugin-pwa, Workbox precache + window-focus refresh.

## Repo Structure

```
btm/
├── src/                  # Frontend (Vite entry: index.html → src/main.tsx)
│   ├── App.tsx           # Screen router, hotkeys
│   ├── main.tsx          # Mount, ErrorBoundary, QueryClientProvider, AuthProvider, AppGate
│   ├── auth/             # AuthContext, LoginScreen, AppGate
│   ├── data/             # api.ts (server calls + field mapping), sync.ts, apiTokens.ts, releases.ts
│   ├── store/            # Zustand store (UI state + bridge to server data)
│   ├── components/       # shell/, board/, screens/, drawers/, command-palette/, comments/, backgrounds/, settings/, projects/, sessions/, feedback/
│   ├── lib/              # format.ts, pomodoro.ts, inlineMarkdown.tsx, brand.ts, i18n/
│   └── styles/           # globio-tokens, btm, btm-glass, btm-dark, btm-admin, cmdk, comments, inbox, …
├── server/               # Backend (own package.json + tsconfig)
│   ├── src/
│   │   ├── index.ts      # Hono server entrypoint
│   │   ├── lib/          # auth, context, mailer, brand, api-token, mentions, notifications, digest, project-visibility, activity, events
│   │   ├── routes/       # me, tasks, projects, users, api-tokens, comments, notifications, feedback, activity, sessions, mcp, sse
│   │   └── db/           # client.ts, schema.ts, migrate.ts
│   └── drizzle/          # SQL migrations (0000–latest), drizzle-kit generate
├── scripts/
│   ├── generate-icons.mjs   # SVG → PNG PWA icons
│   └── smoke-test.mjs       # Playwright headless smoke test, screenshots /tmp/btm-shots/
└── public/               # static assets, app-icon.svg + PNG variants, logo
```

## DB Schema

Better-Auth tables: `users`, `sessions`, `accounts`, `verifications`.

Domain:
- `projects`, `project_members` (role: owner|member|reader)
- `tasks` (with `parent_task_id` for subtasks), `task_sessions`, `live_timers`
- `comments`, `comment_mentions`, `notifications` (kind: 'mention' | 'review_assigned' | …)
- `feedback` (kind: bug|feature, status: open|in_progress|done)
- `activity_log`, `invitations`, `api_tokens`, `push_subscriptions`

Additional user columns beyond Better-Auth defaults: `role`, `status`, `phone`, `teamId`, `office`, `jobTitle`, `avatarBase64`, `boardView`, `language`, `backgroundChoice`, `notifyPrefs` (JSONB), `lastSeenInboxAt`.

Migrations: `server/drizzle/0000_*.sql` and up. Apply manually on production:
```bash
docker exec -i <postgres-container> psql -U btm -d btm < server/drizzle/<migration>.sql
```
Local: `npm run db:migrate` inside `server/`.

## Deploy Workflow (Docker)

```bash
# Build frontend + create packages
npm run build
tar --exclude=server/node_modules --exclude=server/dist --exclude=server/.env \
    -czf /tmp/btm-server-src.tar.gz server docker-compose.yml
tar -czf /tmp/btm-dist.tar.gz dist

# Upload to server
scp /tmp/btm-server-src.tar.gz /tmp/btm-dist.tar.gz user@your-server:/opt/btm/

# On server: extract, build, restart
ssh user@your-server "
  cd /opt/btm
  tar -xzf btm-server-src.tar.gz && tar -xzf btm-dist.tar.gz
  rm btm-server-src.tar.gz btm-dist.tar.gz
  docker compose build btm-api
  docker compose up -d btm-api
"
```

## Local Development

```bash
npm install
npm run dev     # Vite on 127.0.0.1:5173, /api/* proxied to production backend
```

Backend local:

```bash
cd server
npm install
cp .env.example .env   # set DATABASE_URL, BETTER_AUTH_SECRET, SMTP_*, …
npm run dev            # tsx watch src/index.ts on :3001
```

## Branding

Default app name is `Bemany Task Management`. Override via environment variables before building:

```
# Frontend (.env in repo root, baked in at build time)
VITE_APP_FULL_NAME=My Task Manager
VITE_APP_URL=https://your-instance.example

# Backend (server/.env, runtime)
APP_FULL_NAME=My Task Manager
APP_ORG_NAME=My Organization
APP_URL=https://your-instance.example
```

## Conventions

- **CSS tokens** come from `globio-tokens.css` — no hardcoded colors except in `btm-dark.css` overrides.
- **Field mapping** server↔frontend lives in `src/data/api.ts`. UI components use the frontend schema (`task.col`, `task.who`, `task.proj`); the server has `column`, `assigneeId`, `projectId`. Mapping only in this file.
- **Auth layer**: browser session (cookie) for UI, bearer token for MCP/CLI. Token creation requires cookie session.
- **Releases**: for every deploy with user-visible changes, add an entry at the top of `src/data/releases.ts` + mirror in `RELEASES.md` + bump `version`.
- **Mention encoding**: `@[Name](userId)` as a visible token in comment body. Regex `MENTION_RE` in `server/src/lib/mentions.ts` and `src/lib/inlineMarkdown.tsx` — keep both in sync.
- **Notification triggers**: explicit in routes (`fanoutMentions()` in `comments.ts`, review notify in `tasks.ts`), not via DB triggers. Diff-based on edit (oldSet vs newSet) — no duplicate notifications.
- **Project visibility**: `server/src/lib/project-visibility.ts` filters every task query based on `project_members`. Projects without members are public.

## Nice-to-have / Roadmap

- [ ] PWA offline cache for tasks/projects (Workbox runtime caching).
- [ ] Keyboard shortcuts fully wired (many from prototype not yet connected).
- [ ] Audit log UI for admins (`activity_log` data exists, sidebar shows it, but no dedicated screen).
- [ ] File attachments on tasks (roadmap item, drawer placeholder exists).
- [ ] AI creates tasks directly (tool use in AI drawer, extend).
- [ ] Live updates for comments/inbox (SSE topics `notifications` + `comments` exist — frontend still polls).
- [ ] Bundle splitting — vendor/react/app chunks.
- [ ] Loading skeletons before first sync.
- [ ] CSP headers + rate limiting on API.
