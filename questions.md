# Offene Fragen — BTM

Punkte, an denen ich autonom eine Annahme getroffen habe oder noch warte. Geh sie durch wenn du zurück bist; ich arbeite indes weiter.

## 1. Team-Mitglieder Onboarding

Aktuell ist nur **esref@bemany.de** in der DB (Initial-Admin). Damit das Tool für das Team nutzbar wird, brauche ich für die anderen mind. die E-Mail-Adressen.

**Aus dem ursprünglichen Prototyp:**
- AR – Arne Bethge — Web/Marketing — 40h
- ES – Esref Yıldız — Backend — 40h *(✅ esref@bemany.de — bereits Admin)*
- HK – Hakan Er — iOS — 32h *(✅ er@bethesna.de — wird mit eingeladen sobald Admin-UI steht)*
- AM – Amon Schubert — Android — 32h
- PM – Projektleitung — Lead — 40h

**Brauche von dir:**
- E-Mail-Adressen für AR / AM / PM
- Echte Avatar-Farben behalten (`#4a6f8a / #b86a3a / #6a8455 / #8a5a8a / #9a3838`)?

**Annahme bis Antwort:** Sobald die Admin-UI steht, lädst du esref @ bemany.de und hakan @ bethesna.org als ersten Test ein — den Rest sobald du die Mails hast.

## 2. Initial-Teams

Aus dem Prototyp wären sinnvolle Default-Teams: `Web`, `Backend`, `iOS`, `Android`, `Lead`. Soll ich die beim ersten Backend-Start automatisch anlegen, oder erst via Admin-UI?

**Annahme:** Migration legt diese 5 Default-Teams an. Lassen sich später via Admin-UI editieren/löschen.

## 3. Activity-Log Retention

Activity-Einträge wachsen unbegrenzt. Wie lange halten?

**Annahme:** 90 Tage Retention, danach auto-purge per Cron. Frontend zeigt nur letzte 50 ohne Pagination.

## 4. AI-Drawer auf LM-Studio

Aktuell: Pattern-Match-Mock auf Stichworte. Mit `glm-4.6v-flash` über `https://llm1.bemany.tech` kann der Drawer:

- **Freitext-Tab**: Markdown/E-Mail-Text → strukturierte Tasks-Vorschläge (Titel, Wer, Projekt, Stunden, Prio)
- **Datei-Tab**: PDF/DOCX/MD → noch unklar — soll ich die Datei serverseitig parsen (mit was?) oder vom Browser direkt an LM-Studio schicken?
- **Chat-Tab**: Gesprächs-basiertes Planen, Vorschläge, „mache mir Pomodoro-Slots"

**Brauche von dir:**
- Soll die LM-Studio-Anfrage direkt vom Browser laufen (Token müsste dann clientseitig sein → unsicher) oder über `/api/ai/*` Backend-Proxy (sicherer, aber mehr Code)?
- Welche Sprach-/Tonalität-Vorgabe für den System-Prompt?

**✅ Entscheidung:** Backend-Proxy (`POST /api/ai/extract` und `/api/ai/chat`), Token nur serverseitig. System-Prompt deutsch, Werkstattsprache, gibt structured-JSON zurück.

## 5. MCP-Server

Privates Repo `bemany/btm` — `npx github:bemany/btm-mcp` braucht GitHub-Auth. Optionen:

- **A**: Repo public machen (bzw. einen separaten public `btm-mcp` Repo)
- **B**: User klont btm lokal, `npm install && npm run build` im `mcp/`-Subdir, fügt absoluten Pfad in Claude-Desktop-Config
- **C**: NPM-Publishen unter `@bethesna/btm-mcp` (NPM-Account nötig)

**Annahme:** Variante B — User klont lokal. Onboarding-UI im API-Token-Drawer zeigt den Setup-Snippet mit Pfad-Platzhalter.

## 6. Mobile-Responsive

Der Prototyp hat `<meta viewport content="width=1440">` — mobile rendert das gequetscht. Mobile-Vorschau-Screen ist ein Desktop-Mockup von 3 Mobile-Frames.

**Brauche von dir:**
- Soll der Hauptscreen auf Mobile responsive werden, oder gibt's eine separate Mobile-PWA-Route mit eigenem Layout (Heute / Timer / KI-Eintrag — wie der Mobile-Vorschau-Screen)?

**Annahme:** Hauptscreen wird auf Mobile auf-/zugeklappt: Sidebar wird Drawer, Topbar reduziert, Board scrollt horizontal. Separater Mobile-Layout-Switch kommt später.

## 7. TV-Dashboard

Aktuell ein „Ausblick"-Screen mit 4-Quadranten-Anzeige.

**Brauche von dir:**
- Echte Live-Anzeige als dedizierte Route (z.B. `https://btm.bethesna.org/tv?token=...`) ohne Sidebar/Topbar?
- Oder bleibt's eine In-App-Vorschau wie aktuell?

**Annahme:** Bleibt In-App-Vorschau bis du anders sagst.

## 8. Chrome-Plugin

`Ausblick`-Screen mit drei Mockups (Toolbar-Popup, Kontext-Menü, Side-Panel).

**Brauche von dir:**
- Echtes Plugin bauen (eigenes Repo, Manifest v3) oder erstmal Mockup lassen?

**Annahme:** Mockup, kommt nicht ins Production-Backlog bis du explizit sagst.

## 9. Postgres-Backup

Aktuell **kein Backup** der `btm`-DB.

**Brauche von dir:**
- PBS-Backup-Group für 139? Oder eigener `pg_dump` täglich → ZFS-Pool?
- Aufbewahrungs-Politik (täglich 7 Tage, wöchentlich 4 Wochen, monatlich 12 Monate)?

**Annahme:** `pg_dump` täglich um 03:30 in `/var/backups/btm/`, 14 Tage Aufbewahrung, plus Container-PBS-Backup wie andere LXCs auf g40.

## 10. Live-Updates / Real-Time

Aktuell Polling alle 30 s. Bei mehreren parallelen Usern verzögert.

**Annahme:** Bleibt erstmal Polling. Wenn ein User den Bedarf hat, wechseln wir auf SSE (Server-Sent Events) — leichter als WebSockets, reicht für Read-Updates.

## 11. Bundle-Splitting / Performance

980 kB JS in einem Chunk. Sollte auf `react`, `react-dom`, `@tanstack/query`, `lucide-react`, `app` aufgeteilt werden.

**Annahme:** Mache ich autonom in `vite.config.ts` `rollupOptions.output.manualChunks`.

## 12. CSP / Security-Header

Aktuell kein Content-Security-Policy. Caddy könnte das setzen.

**Annahme:** Setze konservative CSP per Caddy-Header — `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (für Vite-runtime), `connect-src 'self' https://btm.bethesna.org`, `style-src 'self' 'unsafe-inline'`.

---

# Aktuell autonom in Arbeit

- ✅ Liste/Timeline-Layout-Bug (Snap-Back gefixt, deploy steht aus)
- 🟡 Dark-Mode + Theme-Switcher 4 Modi
- 🟡 Backend Schema-Erweiterung: teams, activity_log, users.status/phone/teamId
- 🟡 Backend Routes: teams, activity, user-PATCH erweitert
- 🟡 Activity-Instrumentation in Backend-Mutations
- 🟡 Admin-Screen Frontend (User-Cards, Invite-Cards, Drawer, Teams-Drawer, Activity-Sidebar)
- 🟡 Sidebar-Admin-Eintrag (role-gated)
- 🟡 Avatar/User-Mapping in Frontend (Avatar.tsx, CapacityScreen, BoardTimeline, TaskDetailDrawer-Selects)
- 🟡 TimeCell auf Server-Persistenz
- 🟡 Invite-Token-Page für eingeladene User
- 🟡 Bundle-Splitting in vite.config.ts
- 🟡 Error-Toasts für API-Fails

# Bewusst hintenan

- LM-Studio-Anbindung des AI-Drawers — wartet auf Antwort zu Frage 4
- MCP-Server — wartet auf Antwort zu Frage 5
- Mobile-Responsive — wartet auf Antwort zu Frage 6
- TV-Dashboard-Route — wartet auf Antwort zu Frage 7
- Chrome-Plugin — wartet auf Antwort zu Frage 8
- Postgres-Backup-Job — wartet auf Antwort zu Frage 9
- CSP-Header — autonom angenommen, kann ich abnicken/anpassen
