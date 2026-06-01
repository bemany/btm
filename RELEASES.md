# BTM — Release Notes

Vollständige Release-Historie. Diese Datei ist abgeleitet aus der In-App-Quelle
`src/data/releases.ts` (User-facing) und dem Git-Log (technische Commits).

Bei jedem Release-Bump: Eintrag oben in `releases.ts` ergänzen, dann hier
spiegeln. Versionsnummern sind manuell gesetzt — keine automatischen Tags
im Repo.

---

## 0.13.4 — 2026-06-01

**Timer-Watchdog: Push-Warnung bei lang laufenden Sessions (FGuP3nYfPfL)**

- **Feature** — Backend-Scheduler tickt jede Minute durch alle laufenden Live-Timer:
  - elapsed >= 60 min → 1x Push ("Pause machen?")
  - elapsed >= 90 min → alle 5 min Push ("Session jetzt beenden")
- DB-Migration `0029_timer_watchdog.sql`: `live_timers.last_warning_push_at timestamptz`.
- Push-Tag `timer-watchdog-<userId>` — neue Notification ersetzt die vorherige (kein Lock-Screen-Stack).

---

## 0.13.3 — 2026-06-01

**Wochenplanung 2.0: Trennung Frist/Bearbeitungstag + Multi-Tag-Planung (F44rPspkp5z Phase 2)**

- **Feature** — Aufgaben haben jetzt ein separates `plannedFor`-Feld (jsonb-Array von ISO-Dates) parallel zu `due`. Plan-Tag(e) und Frist können auseinanderlaufen.
- **Feature** — Multi-Tag-Picker im TaskDetail-Drawer: Pillen-Reihe für 2 Werktag-Wochen, Klick-Toggle, "Zurücksetzen"-Button.
- **Feature** — Wochenansicht rendert Aufgaben auf jedem Plan-Tag (statt nur am Frist-Tag). Karten zeigen "Tag X/Y" wenn Multi-Tag-Plan.
- **Feature** — Frist-Label als kleines rotes Badge auf Karten in der Timeline, sobald Frist vom Plan-Tag abweicht.
- **Change** — Drag&Drop in der Timeline: bei plannedFor-getriebenen Aufgaben wird beim Drag nur der Source-Tag entfernt und Target-Tag hinzugefügt, andere Plan-Tage bleiben. Klassischer Fallback (due-getrieben) unverändert.
- **Change** — Tagessummen in der Timeline rechnen jetzt mit `plannedFor`-Buckets — eine Multi-Tag-Aufgabe zählt an jedem Plan-Tag voll.

DB-Migration: `0028_planned_for.sql` (`planned_for jsonb NOT NULL DEFAULT '[]'` + GIN-Index).

---

## 0.13.2 — 2026-05-29

**Wochenboard-Sanierung: Tagessummen, Plus-Button, Sortierung, Prio-Farben & freie KI-Blase**

- **Feature** — Tagessummen pro Spalte im Timeline-Header (auch "Ohne Frist"). _F44rPspkp5z_
- **Feature** — Erledigte Aufgaben in der Timeline standardmäßig ausgeblendet, Toggle mit Count "X erledigt versteckt". _F9hw8vcx3ci_
- **Feature** — Plus-Button "Plan" in jeder Timeline-Zelle, öffnet Neue-Aufgabe-Modal mit Person + Tag vorausgefüllt. _FXjEEm5q-_l_
- **Feature** — Kanban-Sortier-Selector: Standard / Erstellungsdatum neu zuerst / alt zuerst. _FUxfszEfNN5_
- **Feature** — KI-Blase ist jetzt frei per Drag&Drop verschiebbar, Position persistiert. Reset-Button im Panel. _F9rFkMkAMeF_
- **Change** — PrioDot komplett neu gefärbt: high = leuchtend rot mit Halo, med = bernstein, low = blaugrün. _FcQa5u3Ifxu_

---

## 0.13.1 — 2026-05-29

**Admin-Feedbacks: Priorität, Submitter-Filter, schmalere User-Spalte**

- **Feature** — Priorisierung von Feedbacks (Hoch / Mittel / Niedrig — Default Mittel). Dropdown auf der Karte. Liste sortiert High → Med → Low, innerhalb nach Datum. Hoch-Prio offene Items bekommen einen roten Akzentstreifen am linken Rand. _FpU3hZAA30w_
- **Feature** — Feedbacks nach Submitter filtern: neues "Eingereicht von"-Dropdown mit Personenliste + Anzahl, optional "Unbekannt". _FpU3hZAA30w_
- **Change** — Admin-Split-Layout: User-Sektion schmaler, Feedback-Sektion bekommt ~60% statt 42%. _FpU3hZAA30w_

DB-Migration: `0027_feedback_priority.sql` (`priority text NOT NULL DEFAULT 'med'` + Index).

---

## 0.13.0 — 2026-05-25

**Mobile-PWA, Detail-Bottom-Sheets, Hyperspeed-Background & 12 Feedbacks**

### Features

- **Mobile-PWA komplett neu** — 8 iOS-native Screens (Heute, Neue Aufgabe, Detail, Fokus-Timer, Foto→KI, Wochenboard, Profil, Lockscreen-Preview). Aktiv bei Viewport < 768px oder `?mobile=1`. Apple-Style Bottom-Sheets mit zwei Detents (medium 52vh ↔ large 88vh), Drag-Handle mit Swipe-to-Dismiss, Spring-Snap mit iOS-Easing, semi-transparenter Backdrop mit Blur. Tab-Wechsel 240ms Fade+Slide, Touch-Feedback (`:active` Scale), iOS-Tap-Highlight versteckt. Safe-Area-Padding (Notch + Home-Indicator), Input-Zoom unterbunden.
- **NewTaskModal auf Board** statt Inline-Tile — Klick auf "+" öffnet zentriertes Modal mit allen Feldern (Titel Pflicht). Cmd/Ctrl+Enter speichert. _FuO6j_tbUS5_
- **HoursMinutesInput** überall: Aufwand in getrennten H- und M-Feldern statt Dezimalzahl. Auto-Carry bei 60+ Min. _F0VxDj1glFV_
- **Zeit als `Hh M`** statt Dezimalstunden auf Karten + Sessions (`42m` / `1h30` statt `0,7` / `1,5`). _F4ItOLZIZ2-_
- **Timer-Auto-Move**: Timer-Start verschiebt Task automatisch in "In Arbeit" + merkt vorherige Spalte. Beim Stop oder Wechsel zurück. Web + Mobile + MCP. _FclpRr066St_
- **Live-Session in Sessions-Liste**: virtuelle Row mit Akzent-Border, pulsierendem Dot, "LIVE"-Chip, tickender Stunden-Anzeige.
- **Notification-Wizard nach Login**: Daily-Digest standardmäßig aus, einmaliger Dialog "E-Mail-Benachrichtigungen?" mit Toggles. Migration für alle User.
- **Status-Wechsel im Mobile-Task-Detail**: Footer-Buttons je nach Spalte + Rolle.
- **Checklisten in Aufgaben** — Sektion im Detail-Drawer, eigene DB-Tabelle. _FCXVQOSTCFp_
- **Projekte nur durch Admins** — anlegen/bearbeiten/löschen. _Fpo1Iu0ndzL_
- **TV-Dashboard zeigt alle Live-Timer** aus allen Spalten. _FQJzGtjPqc-_
- **Termin-Konsolidierung auf TV** — gleiche Termine zusammengefasst mit Avatar-Stack. _FNl4YW89vBX_
- **Admin-UI Split** + Aktivitätsleiste standardmäßig aus. _FEtt86HtKR3_
- **Domain-Whitelisting für Self-Registration** via Admin-Sektion. _Fm16BUutfUO_
- **Push-Geräte in Settings** mit Browser-Erkennung + Test-Push. _FRPyk3YmWAb_
- **Meine Feedbacks in Settings** — alle eigenen Bug-Reports/Features mit Status + Resolution. _F92RWnkL_Iy_
- **Review-Sektion auf "Meine Woche"** zeigt Projekte bei denen man Owner ist. _FyfRp-e2nzS_
- **2 neue Backgrounds**: **Silk** (SVG-Wellen) + **Hyperspeed** (Three.js Neon-Highway, lazy-loaded). _FOoB-Gxa-gx_

### Changes

- **Beta-Stack `btm-beta.bethesna.org`** für Staging (eigene DB, PIN-Auth, `MAIL_DISABLED=true`).

### Fixes

- **Calendar-Overflow auf 13"-MacBook** — Termine-Spalte (`minmax(0, 1fr)`). _Fs0ppP5DH6r_
- Diverse Dark-Mode Texte (Meine-Feedbacks-Tab) aufgehellt.
- `dev-pin`-Auth setzt korrektes `__Secure-`-Cookie auf HTTPS.

---

## 0.12.0 — 2026-05-14

**Per-User-Akzentfarbe, OpenAI-AI, Claude-MCP-Wizard, Archiv & 20+ Bug-/Feature-Fixes**

### Features

- **Per-User-Akzentfarbe** — Einstellungen → Aussehen → 7 Presets (Orange / Lila / Blau / Petrol / Grün / Pink / Rot) oder eigener Hex via Color-Picker. Live-Preview, server-side gespeichert. Alle Buttons, Pills, Hover, Focus-Rings, Mention-Tags und Glass-Dark-Ambient-Gradient färben mit (5 Accent-Shades + RGB-Triplet als CSS-Variablen, ~125 Hardcode-Orange-Stellen umgezogen). _F7JzZf65SzX + FatbLooqY9-_
- **AI-Backend auf OpenAI** — Default `gpt-4o-mini`. Planungs-KI-Chatbubble + AI-Drawer-Aufgaben-Extract nutzen jetzt Function-Calling ohne die alten Gemma-Channel-Marker-Probleme. Provider-Switch über `.env`. _FkqjgMk6RH6_
- **Claude-MCP-Setup-Wizard** in Einstellungen → API-Tokens — 3-Schritte-Wizard mit „Setup-Prompt kopieren"-Button. Picker-Dropdown wählt existierenden Token, ersetzt Legacy oder erstellt neuen. API-Tokens werden im Klartext angezeigt (Eye/Copy/Sparkles-Buttons pro Zeile). _FTTMD2R8-LH_
- **Archiv-Funktion** für erledigte Aufgaben — Drawer-Button + „Alle erledigten archivieren" im Kanban-Done-Header. Archivierte verschwinden aus Board, bleiben in Stunden-Reports. Migration 0020 + `?archived=archived|all`-Query. _FgPjnOpBdCX_
- **Sammel-Prompt für Admin-Feedbacks** — Multi-Select-Checkboxen + sticky Bulk-Action-Bar. Generiert kombinierten Prompt mit einmaligem Repo-Header und einem Block pro Feedback. _FwQQWBHfTid_
- **Screenshot im Feedback-Modal** — Drag&Drop oder ⌘V, der letzte Clipboard-Screenshot wird automatisch angehängt (PNG/JPEG/GIF/WebP, max 8 MB). Migration 0019. _Esref-Idee_
- **Update-Pille statt Force-Reload** — Claude-Desktop-Style: bei neuer Version erscheint eine pulsierende Pille direkt über dem Profil-Tile. Klick lädt neu. PWA-Strategie auf `registerType: 'prompt'` umgestellt.
- **Globaler Feedback-Shortcut ⌘⇧F** — öffnet/schließt das Feedback-Modal von überall. _F2AMngaOedK_
- **Quickstart-Modal mit Beschreibung, Priorität und Fälligkeit** — neue Aufgabe direkt komplett anlegen statt Detail-Drawer nachzubearbeiten.
- **Task → Wochenansicht-Shortcut** im Detail-Drawer (Calendar-Icon oben rechts). _FRr66InEsBQ_
- **Sidebar restrukturiert** — Updates wandert direkt über das Profil, Mobile-Vorschau + Chrome-Plugin + TV-Dashboard in zusammenklappbare „Extras"-Gruppe. Projekte-Chip zeigt nur Favoriten-Anzahl. _FR0_IIsrpwo_
- **Odoo-Kalender-Vorlage** — ein Klick füllt URL + Datenbank + Email aus einer Preset-Konfiguration. Video-Tutorial-Placeholder unter dem API-Key-Feld. _FystBwbvLnW_
- **OpenAI-Key auf Production aktiv** — `gpt-4o-mini`, alte LMSTUDIO_*-Variablen entfernt.

### Fixes

- **Kalender-Duplikate** (Dev Standup + Automation-Stammtisch doppelt). Master+RECURRENCE-ID-Override in iCal-Client gemerged via `ICAL.Event({ exceptions })`. Cross-Source-Dedup im Calendar-Route (Odoo+iCal Title+Start+End).
- **TV-Dashboard-Stuck** auf „Verbinde …" — Watchdog macht Reload nach 90 s ohne erste Daten oder 5 Min ohne Refetch-Erfolg.
- **Termine/Timeline-Toggle Kontrast** auf Meine Woche im Dark-Mode (weiß auf weiß). _F2qEnzlswSt_
- **Aufgabenkarten-Kontrast** im Glass-Dark bei hellen Akzentfarben — Cards bekommen feste Cream-100-Base statt nur 4.5%-White. _Fyrf31EWVGt_
- **Review→Done-Permission** — Admin-Override wird jetzt per Confirm-Dialog mit Owner-Name bestätigt statt stiller Bypass. _F0vR8mfjrwv_
- **Feedback-Modal verwirft nicht mehr aus Versehen** — Discard-Confirm bei Backdrop-Klick / X / Escape / Abbrechen wenn Inhalt vorhanden. _FHwNHtIY5Xe_
- **Admin-Login-Link** landete im Inkognito auf Landing statt Login. URL gibt jetzt `/login?as=…` aus, AppGate erkennt Magic-Params auch auf `/`. _FKMsD4WmmOX_
- **DatePicker** im QuickStart-Modal klippte am Modal-Rand — jetzt via React-Portal in `<body>` mit Smart-Placement.

### Changes

- Settings-Modal größer (1120 × 820 statt 920 × 680).
- API-Token-Schema: neue `token_plain`-Spalte (Migration 0018), bestehende „Legacy"-Tokens zeigen Re-Create-Hinweis.
- Feedback-Schema: `screenshot_base64`-Spalte (Migration 0019).
- Tasks-Schema: `archived_at`-Spalte + Index (Migration 0020).
- Frontend-PWA: `autoUpdate` → `prompt` Mode, `skipWaiting: false`.

### Resolved Feedbacks

`F7JzZf65SzX` (Akzentfarbe), `FKMsD4WmmOX` (Login-Link), `F2qEnzlswSt` (Toggle-Kontrast), `FatbLooqY9-` (Akzent-Override), `FkqjgMk6RH6` (OpenAI), `FTTMD2R8-LH` (MCP-Wizard), `FwQQWBHfTid` (Sammel-Prompt), `Fyrf31EWVGt` (Card-Kontrast), `F0vR8mfjrwv` (Permission), `F2AMngaOedK` (Shortcut), `FgPjnOpBdCX` (Archiv), `FHwNHtIY5Xe` (Discard-Confirm), `FR0_IIsrpwo` (Sidebar), `FystBwbvLnW` (Odoo-Preset), `FRr66InEsBQ` (Week-Shortcut).

> ⚠️ `F7OAFqRLy5R` (Week-Overview-Liste auf „Meine Woche") wurde nach kurzer Live-Phase zurückgenommen — die Liste hat den Screen visuell zu sehr dominiert. Die Funktionalität lebt weiter im Wochenboard (`/board`).

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
