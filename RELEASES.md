# BTM — Release Notes

Vollständige Release-Historie. Diese Datei ist abgeleitet aus der In-App-Quelle
`src/data/releases.ts` (User-facing) und dem Git-Log (technische Commits).

Bei jedem Release-Bump: Eintrag oben in `releases.ts` ergänzen, dann hier
spiegeln. Versionsnummern sind manuell gesetzt — keine automatischen Tags
im Repo.

---

## 0.11.0 — 2026-05-13

**Kalender-Sync, schneller Aufgaben-Start, Wochenboard-Politur und Multi-Team**

### User-facing

**Kalender-Integration:**
- 🆕 **Odoo-Kalender-Sync** in Settings → Kalender. Eigene Termine auf „Meine Woche" (heute + morgen), alle Team-Termine im TV-Dashboard. Server-Sync alle 5 Min, API-Keys AES-verschlüsselt.
- 🆕 **iCal-Feeds als zweite Quelle** — beliebig viele URLs (Google, Apple, Outlook). Mit Label, Aktiv-Toggle, Sync-Status. Wiederkehrende Termine via RRULE auto-expandiert.
- 🆕 **TV-Privatsphäre pro Quelle**: Toggle für Odoo + Toggle pro iCal-Feed. Privat-Modus auf TV: Avatar + Zeit sichtbar, Titel/Ort als „Privat" anonymisiert.
- 🆕 **Calendar-Widget erweitert**: „Nächster Termin in 1h 23 Min"-Karte mit Live-Countdown, „Jetzt"-Linie zwischen vergangenen/kommenden Events, Timeline-View-Toggle (vertikale Stunden 07-20 Uhr mit Event-Blocks + pulsierender Now-Linie).

**Workflow:**
- 🆕 **Aufgabe in 3 Klicks starten** vom Hauptbildschirm: „Aufgabe starten"-Button → Titel + Projekt → Klick. Pausiert laufenden Timer, legt Task in „In Arbeit" an, startet neuen Timer.
- 🆕 **Personen-Filter im Wochenboard**: Dropdown mit allen aktiven Personen, filtert auf deren Tasks.
- 🆕 **Fristen sichtbar im Kanban**: Due-Pill (Datum / „Heute" / „Überfällig") mit 4 Farb-Stufen, Akzent-Streifen links, automatische Sortierung pro Spalte nach Dringlichkeit.

**Admin:**
- 🆕 **Multi-Team-Mitgliedschaft**: User in beliebig vielen Teams. Multi-Select-Chips im User-Drawer, Stern markiert primäres Team.
- 🆕 **Feedback bearbeiten**: pro Feedback-Eintrag „Bearbeiten"-Button für Titel, Beschreibung und Typ (Bug ↔ Feature).
- 🆕 **Status-Filter Feedback-Liste**: Default „Aktiv (offen + in Arbeit)" — erledigte ausgeblendet. Dropdown rechts oben für andere Status mit Live-Counts.
- 🆕 **Resolve-Endpoint**: Feedback nach Fix via `POST /api/feedback/:id/resolve` → Status=done, Inbox-Notification an Reporter, Mail.
- 🔄 **Admin-Magic-Link**: kopiert nur noch den Login-Link (statt Email + Code + URL).
- 🆕 **Projekt-Favoriten** mit Stern, eigene Sektion oben in der Card-View.
- 🆕 **Admins**: fremde Privatprojekte default ausgeblendet, Toggle zum Einblenden (dann mit gestrichelter Border).

**Diverse Fixes:**
- 🛠 **Logout** funktionierte nicht zuverlässig (Cookie wurde nicht gelöscht, Better-Auth wollte JSON-Content-Type).
- 🛠 **HTTP 431** „Request Header Fields Too Large" auf Page-Open — Better-Auth's Avatar-Cookie wurde zu groß. cookieCache aus, Node-Limit auf 32 KB.
- 🛠 **„Ohne Frist"-Tab im Timeline** zeigte Tasks anderer Wochen fälschlich (Date-Logic-Bug).
- 🛠 **TV-Dashboard** crashte bei jedem kurzen API-Hick-up mit „Token ungültig". Jetzt nur bei echten 401/403, sonst Reconnect-Banner und letzte bekannte Daten.
- 🛠 **App-Icon in Mails** war broken — fehlte im Server-Image. Magic-Link, Invites, Mentions, Digest, Feedback-Resolved zeigen jetzt das Logo.
- 🛠 **Profilbild Sidebar-Footer** wurde nicht angezeigt (nur Initialen).
- 🛠 **Bug/Feature-Buttons im Feedback-Modal** hatten im Dark-Mode keinen erkennbaren Accent.
- 🛠 **Browser-Autofill** konnte Odoo-API-Key überschreiben — Form-Feld blockt jetzt, Server validiert min-length.
- 🛠 **iCal-Fehlermeldungen** lesbar (z.B. „bei Google brauchst du die _geheime_ Adresse" bei 404).

**Layout:**
- 🔄 **TV-Dashboard**: rechter Quadrant zeigt echten Team-Kalender (statt „Heute erledigt").
- 🔄 **Projekte**: Listen-View-Toggle mit Tabelle (Code, Owner, Tasks, Fortschritt, Frist).
- 🔄 **Avatare überall**: hochgeladenes Profilbild statt nur Initialen.

### Commits (ab `eb74e5f` … `4115a7b`)
*~30 Commits seit 0.10.0 — siehe git log auf `main`.*

---

## 0.10.0 — 2026-05-10

**Timeline mit Drag-and-Drop, Zeit-Filter, neue Hintergründe & Profil-Editor**

### User-facing
- 🆕 Wochenboard-Timeline jetzt voll interaktiv: Karten ziehen verschiebt **Frist und Bearbeiter** in einem Move. Wochen-Navigation, KW + Datums-Range im Header. Status-Chip auf jeder Karte.
- 🆕 Zeiten-Seite: Wochen-Navigation + Personen-Filter. Admins können fremde Stunden einsehen, alle können zurückblättern.
- 🆕 Fünf neue animierte Hintergründe für Glass: **Sanfte Aurora**, **Lichtsäule**, **Prisma**, **Dunkler Schleier**, **Grainient**. „Neu"-Chip in Settings → Hintergrund.
- 🆕 Profil-Editor: Avatar-Upload (256×256-Compress), Name + Position editierbar. Position auch in Admin-Übersicht.
- 🆕 Tagesübersicht-Mail mit „Jetzt senden"-Button (Settings → Benachrichtigungen).
- 🆕 Admin-Tool: Login-Link für andere Personen mit einem Klick generieren (15 Min gültig, kopiert in Zwischenablage, auto-fill bei Öffnen).
- 🆕 Projekt-Sichtbarkeit: Nicht-Mitglieder sehen Projekt + Tasks nicht mehr. Bestehende Projekte ohne Mitgliederliste bleiben für alle sichtbar.
- 🔄 Inbox-Container frosted-glassy.
- 🔄 Landingpage poliert: Mesh hell / Aurora dunkel hinter allen Sections, Glass-Top-Bar, smoothere Theme-Wechsel.
- 🔄 Datepicker + Kapazitäts-Container frosted-glassy. Bekannte-Probleme-Karten ohne Farb-Streifen.

### Commits
- `9ab888c` Chore: .claude/ aus Tracking nehmen + .gitignore
- `169afb4` Profile-Settings + Subtasks + Backgrounds + Feedback + Project-Members + Polish

> **Hinweis:** Versionen 0.8.0, 0.9.0 und 0.10.0 sind in einem einzigen Commit (`169afb4`) gebündelt — die Releases waren parallel in Arbeit und wurden zusammen ausgerollt. Die User-facing-Trennung in `releases.ts` bleibt drei Versionen.

---

## 0.9.0 — 2026-05-10

**Projekt-Verantwortliche, Subtasks, Bug-Reports & viel Glass-Politur**

### User-facing
- 🆕 **Projekt-Verantwortliche** + Mitgliederliste mit Rollen (Mitglied/Nur-Lesen). Inbox-Notification an den Owner bei Review-Wechsel. Nur Owner oder Admin dürfen auf „Erledigt" setzen.
- 🆕 **Subtasks** in jeder Aufgabe. Erscheinen als eigene Karten im Board mit „Subtask"-Pill, Drawer hat Parent-Link.
- 🆕 **Bug-Report & Feature-Wunsch** aus der App: Profil-Menü → Feedback. Mit Bug/Feature-Toggle, automatischem Snapshot (Pfad/Theme/Browser). Admins sehen alle Einträge, können Status setzen, Claude-Code-Prompt in 1 Klick kopieren oder direkt in Claude öffnen.
- 🆕 Aktivitäts-Zeitstrahl mit **Diff-Tooltip**: zeigt was sich konkret geändert hat (Titel, Priorität, Frist, Projekt, Bearbeiter, geplante Zeit). Hover zeigt Vorher-Nachher.
- 🆕 Animierte Hintergründe **interaktiv**: Aurora-Blobs, Mesh-Punkte, Lichtsäulen, Wellen, Akzent-Glow folgen dem Mauszeiger. Reduce-Motion + Touch werden respektiert.
- 🆕 Animierte Hintergründe serverseitig gespeichert (folgen auf jedes Gerät). Hero-Vorschau im Settings-Tab mit Mock-App-Inhalt.
- 🔄 Glass-Look überarbeitet: Sidebar, Wochenboard-Spalten, Kapazitäts-Container, ⌘K-Palette, Release-Cards, Datepicker — alles frosted-translucent.
- 🔄 Updates-Seite umsortiert: Releases volle Breite, „Bekannte Probleme" + „In Arbeit" rechts in 20%-Sidebar. NEU/GEÄNDERT/FIX-Pills mit einheitlicher Breite.
- 🔄 Landingpage Hell/Dunkel-Toggle (Sonne/Mond-Icon).
- 🛠 Animierte Hintergründe waren in Glass-Themes unsichtbar (Z-Index-Konflikt). Jetzt sichtbar, kräftigere Farben in Dark.
- 🛠 Inline-Aufgabe-Hinzufügen ragte aus schmalen Spalten heraus. Bleibt jetzt drin.
- 🛠 ⌘K-Palette: aktives Element war im Dark-Mode knallweiß. Jetzt subtiler Glass-Highlight.
- 🔄 „Bekannte Probleme"-Karten: Farb-Leisten links entfernt — Status-Pille reicht.

### Commits
gebündelt in `169afb4` (siehe 0.10.0)

---

## 0.8.0 — 2026-05-09

**Lebendige Hintergründe, smarteres Aufgaben-Modal, Mail-Benachrichtigungen**

### User-facing
- 🆕 8 animierte Hintergründe für Glass: Aurora, Mesh, Glow, Lichtsäulen, Filmkorn, Punktraster, Linien, Wellen. Live-Vorschau, pointer-reaktiv.
- 🆕 **Mail-Benachrichtigungen**: Mail bei @-Mention. Optionale **Tagesübersicht** morgens um 8:00 (Mentions, fällige Tasks, Aktivität auf eigenen Tasks). Beides separat schaltbar.
- 🆕 Geplante Zeit nachträglich editierbar (Inline-Editor im Drawer).
- 🆕 Sessions im Drawer voll editierbar: Stunden, Datum, Löschen, manuell nachtragen via „+ Session". Logged-Counter rechnet sich nach.
- 🆕 Aktivitäts-Zeitstrahl in jeder Aufgabe: Kommentare + Änderungen chronologisch.
- 🆕 Eigener BTM-Datepicker (Mo-Start, „Heute"-Sprung, Lösch-Button, Zeit-Stepper).
- 🔄 Aufgaben-Drawer neu sortiert: Anhänge unter Beschreibung → Sessions → Aktivitäts-Zeitstrahl.
- 🛠 Mit aktivem Projekt-Filter landeten neue Aufgaben in falschem Projekt → unsichtbar. Behoben.
- 🛠 Bereits getrackte Sessions tauchten im Drawer nicht auf (obwohl Stunden gezählt). Jetzt vollständige Historie.
- 🛠 Onboarding-Tour startete sich manchmal selbst nochmal. Stoppt jetzt verlässlich.
- 🔄 Glass-Look überarbeitet (Sidebar, Spalten, ⌘K-Palette, Release-Cards transluzenter).

### Commits
gebündelt in `169afb4` (siehe 0.10.0)

---

## 0.7.0 — 2026-05-09

**Kommentare, @-Erwähnungen und Inbox** (Linear-Style-Feature komplett)

### User-facing
- 🆕 **Kommentare** unter jeder Aufgabe + jedem Projekt. Chronologisch, Edit/Delete für eigene Beiträge, ⌘+Enter zum Senden.
- 🆕 **@-Erwähnungen** im Kommentarfeld: `@` tippen → Picker mit Pfeiltasten-Navigation, Enter/Tab fügt ein.
- 🆕 **Inbox-Seite** mit allen Mentions an dich. Glocken-Icon im Topbar mit ungelesener-Counter. Klick navigiert zu Aufgabe/Projekt.
- 🆕 **Projekt-Detail-Drawer**: Klick auf Projekt-Card öffnet Seitenansicht mit Stats, Aufgaben + Kommentaren. „Im Board ansehen" springt wie gewohnt ins gefilterte Wochenboard.
- 🔄 Beim Edit eines Kommentars werden nur **neu hinzugefügte** Mentions notifiziert (kein Doppel-Spam).

### Commits
- `eb74e5f` Comments + @-Mentions + Inbox: komplettes Linear-Style-Feature

---

## 0.6.0 — 2026-05-08

**Englisch, Einstellungen, Dark-Mode-Politur**

### User-facing
- 🆕 BTM komplett auf **Englisch** umschaltbar (Profil → Einstellungen → Sprache). Datum + Zahlen passen sich an.
- 🆕 **Aufgeräumtes Einstellungs-Modal** mit Tabs (Aussehen, Sprache, API-Tokens, Daten). Shortcut **⌘,**.
- 🆕 Schlankeres Profil-Menü unten links: User-Card, Theme-Quick-Toggle, Einstellungen, Abmelden. Rest im Modal.
- 🆕 Aktivitäts-Sidebar im Admin: Filter nach Person.
- 🆕 **Login per 6-stelligem Code** (zusätzlich zum Magic-Link). Praktisch wenn App + Mail in unterschiedlichen Browsern/PWAs.
- 🆕 **Mobile-Layout** für Smartphones: 3-Screen-Modus (Heute, Timer, KI) mit Bottom-Tab-Bar.
- 🆕 Persönliches Privat-Projekt für jeden User.
- 🆕 Bevorzugte Wochenboard-Ansicht (Kanban/Liste/Timeline) wird per User gemerkt. Onboarding-Tour fragt direkt.
- 🛠 Wochenboard zeigt wieder alle 5 Spalten in einer Zeile (Backlog · Zu erledigen · In Arbeit · Review · Erledigt).
- 🛠 Dark-Mode systematisch durchpoliert: Begrüßung, Projekt-Namen, In-Arbeit-Karten, Counter, Stunden-Anzeigen.
- 🛠 Σ-Total-Spalte sah im Dark-Mode wie invertierter weißer Block aus. Behoben.
- 🛠 Cursor ruckelte beim Tippen langer Aufgaben-Beschreibungen. Jetzt flüssig.
- 🛠 Timeline-Ansicht: Aufgaben ohne Frist landen in eigener „Ohne Frist"-Spalte statt zufällig.
- 🔄 **BTM auf neue Server-Infrastruktur umgezogen** (Digital Ocean): spürbar schneller, eigenes SSL, robuster.

### Commits
- `e62f271` Release-Notes v0.6.0 + i18n-Support für /releases
- `0d88e56` Aktivitäts-Sidebar: Filter nach Bearbeiter
- `cc21341` Dark-Mode: globaler body color + Audit-Fixes
- `6ea8c3a` Fix: 3 visuelle Issues (Quick-Toggle Overflow, Kanban-Spalten, Modal-Transparenz)
- `f64a564` Settings-Modal: Profil-Menu aufgeräumt, zentrales Settings-Panel mit Tabs
- `a55f62b` i18n: Multi-Sprach-System (Deutsch/English) durch die ganze UI
- `d892816` Backend + Frontend-Infrastruktur: Schema, Mobile-App, Dark-Mode, Login-Code

---

## 0.5.0 — 2026-05-05

**Geführte Tour, lesbarer Dark-Mode** (erste öffentliche Release)

### User-facing
- 🆕 Geführte **Onboarding-Tour** beim ersten Login (Wochenboard, Suche, KI-Assistent, Profil). Wiederholbar via Settings.
- 🆕 **Release-Seite** + Login-Modal mit „Neu seit"-Logik.
- 🆕 KI-Planungsassistent: lange Reasoning-Blöcke eingeklappt, per Klick auf „Gedanken" öffnen.
- 🛠 Dark-Mode wieder durchgehend lesbar (Live-Timer, Topbar, Pomodoro, Suchfeld).
- 🛠 Login-Mail kam manchmal mit Fehler an. Behoben.
- 🛠 KI-Aufgabenextraktion lieferte zeitweise Fehler. Wieder zuverlässig.
- 🔄 Theme-Auswahl ins Profil-Menü unten links umgezogen.

### Commits (Anlauf bis 0.5.0)
- `b0aa857` MCP CORS-Fix für Claude.ai + TV-URL persistent + Logout-Theme-Reset
- `fc1df13` Fix: /tv?token=… durch Auth-Cleanup-Logik abgewürgt
- `6d8ef36` AI-Drawer Demo-Daten raus + Due-Date in TaskDetail + Office-Display
- `2ab1160` MCP: Token-via-URL (?token=) für Claude.ai Connector
- `3ce91ee` Bug: /invitations/accept/:token war hinter requireAuth → 401
- `0c5a0aa` SSE Live-Updates statt nur Polling
- `7fb5575` TimeCell-Server-Persist (atomic Tag-Replace) + Mobile-Responsive Layer
- `a7ae40c` MCP-Server hosted: /api/mcp JSON-RPC mit 14 Tools
- `5149de0` TV-Fullscreen-Route, AI-Drawer auf LM-Studio Backend-Proxy, Error-Toaster, API-Token-Override
- `722c286` App-Router: pushState-basiert, Pfade pro Screen
- `fcc5193` Landing-Scroll-Fix + Mail: App-Icon als CID-Anhang
- `d286f94` Geile Einladungs-Mail mit Brand-Mark, Hero, Feature-Liste
- `38c2064` Landing-Page + Admin-Screen + Backend Activity-Log
- `bc2e3bc` Dark-Mode + 4-Theme-Switcher · Backend Admin-Schema + Routes · User-Mapping
- `8e5b79a` API-Token-Drawer + Login-Theme-Fix + Vite-API-Proxy
- `d178245` Frontend Server-State: Tasks/Projects/Timer kommen vom Server
- `e1c26b9` PersonaSwitcher entfernt — wird durch echten Auth-User ersetzt
- `1a1e6bf` tsbuildinfo aus git ausschließen
- `f7ae677` Frontend Auth-Flow: AuthContext + LoginScreen + AppGate
- `9789d47` Backend-Skelett: Hono + Drizzle + Better-Auth (Magic-Link)
- `107ce79` Glass als Default + Theme-Switcher in Sidebar, PWA + App-Icon
- `04b5d27` Initial scaffold for BTM app

---

## Roadmap (in Arbeit)

- **Live-Updates ohne Refresh** (SSE) — in Arbeit, kommt in den nächsten Releases
- **KI legt Aufgaben direkt an** — sobald das nächste KI-Modell stabil läuft
- **Anhänge an Aufgaben** — Datei-Upload pro Aufgabe; Platzhalter ist schon im Drawer

## Bekannte Probleme

- **Claude.ai (Web) zeigt „MCP-Server nicht erreichbar"** — externer Bug bei Anthropic, betrifft nur Web-Claude. Workaround: Claude Desktop nutzen.
- **KI-Planungsassistent zeitweise nicht erreichbar** — Modell-Umstellung läuft. Workaround: nochmal versuchen, manuell anlegen.
