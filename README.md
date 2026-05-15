# BTM — Bemany Task Management

> Team task, time and capacity management for small teams (5–25 people).

BTM is a self-hosted web app and PWA built for teams that need structured weekly planning, time tracking, and team capacity visibility — without the noise of enterprise tools.

---

## Features

- **Kanban board** with weekly planning (Backlog → In Progress → Review → Done)
- **Live timer** + Pomodoro mode for focused work sessions
- **Time tracking** — log hours per task, view capacity per user
- **AI task extraction** — paste emails or briefings, AI creates tasks (OpenAI-compatible)
- **MCP server** — connect Claude or other AI agents directly to your tasks
- **Push notifications** (Web Push / PWA)
- **Comments, @mentions, inbox** — stay in the loop without leaving the app
- **Subtasks** and nested task trees
- **Project visibility** — owner/member/reader roles per project
- **Calendar sync** — Odoo and iCal integration
- **Admin dashboard** — user management, feedback system, activity log
- **Invite-only** — magic link auth, no passwords
- **PWA** — installable on desktop and mobile, works offline (cached)
- **Dark mode** — four theme variants
- **Multilingual** — German and English UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite 5 + React 18 + TypeScript |
| State | Zustand + TanStack Query |
| Backend | Hono + Node 22 |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | Better-Auth (magic link + API tokens) |
| PWA | vite-plugin-pwa + Workbox |
| AI | OpenAI Chat Completions API (compatible with any OpenAI-compatible endpoint) |

---

## Self-Hosting

### Requirements

- Docker + Docker Compose
- An SMTP server for magic link emails
- (Optional) An OpenAI-compatible API key for AI features

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/bemany/btm.git
cd btm

# 2. Configure the backend
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL, BETTER_AUTH_SECRET, SMTP_*, BETTER_AUTH_URL

# 3. (Optional) Set branding before building
echo "VITE_APP_FULL_NAME=My Task Manager" > .env

# 4. Build the frontend
npm install && npm run build

# 5. Start everything
docker compose up -d
```

The app will be available on port 3001 (behind a reverse proxy like Caddy or nginx).

### Reverse Proxy (Caddy example)

```
your-domain.example {
  handle /api/events {
    reverse_proxy btm-api:3001
    flush_interval -1
  }
  handle /api/* {
    reverse_proxy btm-api:3001
  }
  handle {
    root * /srv/btm
    file_server
    try_files {path} /index.html
  }
}
```

### Environment Variables

#### Backend (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | — | Random 64-char secret for session signing |
| `BETTER_AUTH_URL` | — | Public URL of your BTM instance |
| `TRUSTED_ORIGINS` | — | Allowed origins for CSRF (usually same as BETTER_AUTH_URL) |
| `INITIAL_ADMIN_EMAIL` | — | Email address that gets auto-promoted to admin on first login |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `465` | SMTP port |
| `SMTP_SECURE` | `true` | Use SSL |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | From address for outgoing mail |
| `APP_FULL_NAME` | `Bemany Task Management` | App name shown in emails and MCP |
| `APP_ORG_NAME` | `Bemany` | Organization name in email footers |
| `APP_URL` | same as BETTER_AUTH_URL | Public URL used in email links |
| `OPENAI_API_KEY` | — | API key for AI features |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for AI task extraction |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Override for self-hosted LLM endpoints |
| `VAPID_PUBLIC_KEY` | — | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | — | VAPID private key for Web Push |

Generate VAPID keys: `npx web-push generate-vapid-keys`

#### Frontend (`.env` in repo root, set before `npm run build`)

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_FULL_NAME` | `Bemany Task Management` | App name baked into the PWA manifest and page title |
| `VITE_APP_URL` | `` | Public URL baked into Open Graph meta tags |

---

## Development

### Frontend

```bash
npm install
npm run dev
# Vite dev server on http://127.0.0.1:5173
# /api/* requests are proxied to the backend configured in vite.config.ts
```

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in required values
npm run dev            # tsx watch mode on :3001
```

### Database migrations

```bash
cd server
npm run db:migrate     # apply all pending migrations
npm run db:generate    # generate new migration from schema changes
```

---

## MCP Server

BTM ships with a built-in MCP (Model Context Protocol) server at `/api/mcp`. This lets Claude Desktop and other MCP clients manage tasks, timers and weekly plans directly.

1. Create an API token in BTM → Settings → API Tokens
2. Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "btm": {
      "url": "https://your-instance.example/api/mcp",
      "headers": {
        "Authorization": "Bearer btm_your-token-here"
      }
    }
  }
}
```

Available tools: `me`, `list_tasks`, `create_task`, `update_task`, `move_task`, `delete_task`, `list_projects`, `create_project`, `list_users`, `start_timer`, `stop_timer`, `get_live_timer`, `list_week`, `list_activity`.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

Private and internal use is permitted. Commercial use is prohibited.
