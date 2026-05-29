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
    version: '0.13.2',
    date: '2026-05-29',
    title: {
      de: 'Wochenboard-Sanierung: Tagessummen, Plus-Button, Sortierung, Prio-Farben & freie KI-Blase',
      en: 'Week-board cleanup: day totals, plus button, sort, priority colors & free-floating AI bubble',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: '**Tagessummen in der Timeline**: jeder Tages-Spaltenkopf zeigt jetzt die Summe aller geplanten Stunden des Tages als kleine Pille. Auch für "Ohne Frist". So sieht man sofort wo noch Kapazität frei ist. _F44rPspkp5z_',
          en: '**Day totals in the timeline**: each day column header now shows the sum of planned hours for that day as a small pill. Also for "No deadline". Capacity at a glance. _F44rPspkp5z_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Erledigte Aufgaben in der Timeline ausblenden** ist jetzt Standard — kein Zumüllen der "Ohne Frist"-Spalte mehr. Neuer Toggle "X erledigt versteckt" rechts in der Toolbar schaltet sie bei Bedarf zurück. Tagessummen rechnen entsprechend nur mit den sichtbaren Tasks. Wahl bleibt in localStorage. _F9hw8vcx3ci_',
          en: '**Hide completed tasks in the timeline** is now the default — no more clogging the "No deadline" column. New "X done hidden" toggle in the toolbar brings them back. Day totals account for visible tasks only. Choice persists in localStorage. _F9hw8vcx3ci_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Plus-Button in jeder Timeline-Zelle**: kleiner "+ Plan"-Button pro Person × Tag (und "Ohne Frist"). Öffnet das Neue-Aufgabe-Modal mit Bearbeiter und Frist schon ausgefüllt. _FXjEEm5q-_l_',
          en: '**Plus button in every timeline cell**: small "+ Plan" button per person × day (and "No deadline"). Opens the new-task modal with assignee and due date pre-filled. _FXjEEm5q-_l_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Kanban-Sortierung nach Erstellungsdatum**: neuer Selector oben in der Kanban-Ansicht. Optionen: Standard (Frist+Prio), Erstellungsdatum neu zuerst, Erstellungsdatum alt zuerst. Letzteres bringt alte unerledigte Aufgaben prominent nach oben. _FUxfszEfNN5_',
          en: '**Kanban sort by creation date**: new selector at the top of the Kanban view. Options: default (due+priority), creation date newest first, creation date oldest first. The last surfaces old unresolved tasks. _FUxfszEfNN5_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**KI-Blase frei verschiebbar**: greifen und irgendwohin auf den Screen ziehen, sie bleibt dort. Position persistiert in localStorage. Im Panel ein "Position zurücksetzen"-Button. _F9rFkMkAMeF_',
          en: '**AI bubble is free-draggable**: grab and drop anywhere on screen, it stays. Position persists in localStorage. A reset-position button lives in the panel. _F9rFkMkAMeF_',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**Prio-Punkt deutlich erkennbar**: Hoch = leuchtendes Rot (8px) mit Halo, Mittel = Bernstein, Niedrig = ruhiges Blaugrün. Vorher waren Mittel + Niedrig beide grau, Hoch ging in der Akzentfarbe unter. _FcQa5u3Ifxu_',
          en: '**Priority dot now clearly readable**: High = vivid red (8px) with halo, Medium = amber, Low = soft teal. Previously medium + low were both grey and high blended with the accent color. _FcQa5u3Ifxu_',
        },
      },
    ],
  },
  {
    version: '0.13.1',
    date: '2026-05-29',
    title: {
      de: 'Admin-Feedbacks: Priorität, Submitter-Filter, schmalere User-Spalte',
      en: 'Admin feedbacks: priority, submitter filter, narrower user column',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: '**Priorisierung von Feedbacks**: jedes Feedback hat jetzt eine Priorität (Hoch / Mittel / Niedrig — Default Mittel). Der Admin setzt sie per Dropdown direkt auf der Karte. Liste sortiert nach Priorität (Hoch → Mittel → Niedrig), innerhalb nach Datum. Hoch-Prio offene Items bekommen einen roten Akzentstreifen am linken Rand der Karte. _FpU3hZAA30w_',
          en: '**Feedback priorities**: every feedback now has a priority (High / Medium / Low — default Medium). Admins set it via a dropdown on the card. List sorts by priority (High → Medium → Low), then by date. High-priority open items get a red accent stripe on the left edge of the card. _FpU3hZAA30w_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Feedbacks nach Submitter filtern**: neues Dropdown "Eingereicht von" im Admin-Screen. Listet alle Personen mit Feedbacks samt Anzahl, plus optional "Unbekannt" für anonyme/gelöschte Einreichungen. _FpU3hZAA30w_',
          en: '**Filter feedbacks by submitter**: new "Submitted by" dropdown in the admin screen. Lists everyone with feedbacks together with the count, plus optional "Unknown" for anonymous / deleted submissions. _FpU3hZAA30w_',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**Admin-Split-Layout neu gewichtet**: User-Sektion schmaler, Feedback-Sektion bekommt mehr Platz (von 42% auf ~60%) — Bug- und Feature-Titel haben jetzt Luft, ohne dass Title-Tags umbrechen. _FpU3hZAA30w_',
          en: '**Admin split layout reweighted**: user section narrower, feedback section gets more room (from 42% to ~60%) — bug and feature titles now have breathing room without wrapping. _FpU3hZAA30w_',
        },
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-05-25',
    title: {
      de: 'Mobile-PWA, Detail-Bottom-Sheets, Hyperspeed-Background & 12 Feedbacks',
      en: 'Mobile PWA, detail bottom sheets, Hyperspeed background & 12 feedbacks',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: '**Mobile-PWA komplett neu**: 8 iOS-natives Screens (Heute, Neue Aufgabe, Detail, Fokus-Timer, Foto→KI, Wochenboard, Profil, Lockscreen-Preview) — aktiv bei Viewport < 768px oder `?mobile=1`. Apple-Style Bottom-Sheets mit zwei Detents (medium 52vh ↔ large 88vh), Drag-Handle mit Swipe-to-Dismiss, Spring-Snap mit iOS-Easing, semi-transparenter Backdrop mit Blur. Tab-Wechsel mit 240ms Fade+Slide, Touch-Feedback (`:active` Scale) auf allen Buttons/Cards/Chips, iOS-Tap-Highlight versteckt. Safe-Area-Padding (Notch + Home-Indicator), Input-Zoom unterbunden (font-size: 16px + viewport-meta `user-scalable=no`).',
          en: '**Mobile PWA, full rebuild**: 8 iOS-native screens (Today, New Task, Detail, Focus Timer, Photo→AI, Week Board, Profile, Lockscreen preview) — active when viewport < 768px or `?mobile=1`. Apple-style bottom sheets with two detents (medium 52vh ↔ large 88vh), drag handle with swipe-to-dismiss, spring-snap with iOS easing, semi-transparent backdrop with blur. Tab transitions 240ms fade+slide, touch feedback (`:active` scale) on every button/card/chip, iOS tap-highlight hidden. Safe-area padding (notch + home indicator), input zoom prevented (font-size: 16px + viewport `user-scalable=no`).',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Neue-Aufgabe-Modal auf dem Board** statt Inline-Tile: Klick auf "+" öffnet ein zentriertes Modal mit Titel (Pflicht) + Beschreibung, Projekt, Verantwortlich, Aufwand, Priorität, Fälligkeit. "Anlegen" oder "Anlegen & öffnen", Cmd/Ctrl+Enter speichert. _FuO6j_tbUS5_',
          en: '**New-task modal on the board** instead of an inline tile: clicking "+" opens a centered modal with title (required) + description, project, assignee, effort, priority, due date. "Create" or "Create & open", Cmd/Ctrl+Enter to save. _FuO6j_tbUS5_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Hours-Minutes-Input überall**: Aufwand wird jetzt in getrennten H- und M-Feldern eingegeben statt als Dezimalzahl (`1h 30` statt `1.5`). Auto-Carry bei 60+ Minuten. Enter im H-Feld springt zum M-Feld. Greift im Board-NewTaskModal, Mobile-Create, Task-Detail Inline-Edit und in der Session-Liste (Edit + Add). _F0VxDj1glFV_',
          en: '**Hours/minutes input everywhere**: effort is entered in separate H and M fields instead of as a decimal (`1h 30` instead of `1.5`). Auto-carry on 60+ minutes. Enter in the H field jumps to the M field. Applies in board NewTaskModal, mobile create, task detail inline edit and session list (edit + add). _F0VxDj1glFV_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Zeit als `Hh M`-Format statt Dezimalstunden**: Aufgabenkarten, Listenansicht, Session-Liste und Detail-Hero zeigen jetzt `42m` / `1h` / `1h30` statt `0,7` / `1,0` / `1,5h`. Lesbarer auf einen Blick. _F4ItOLZIZ2-_',
          en: '**Time as `Hh M` instead of decimal hours**: task cards, list view, session list and detail hero now show `42m` / `1h` / `1h30` instead of `0.7` / `1.0` / `1.5h`. Easier to read at a glance. _F4ItOLZIZ2-_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Timer-Auto-Move**: Timer-Start schiebt die Aufgabe automatisch in "In Arbeit" und merkt sich die vorherige Spalte. Beim Stop oder beim Wechsel auf eine andere Aufgabe wandert sie zurück in die alte Spalte — außer sie wurde manuell weiterverschoben oder lag schon in Review/Erledigt. Gilt für Web, Mobile und MCP. _FclpRr066St_',
          en: '**Timer auto-move**: starting the timer moves the task to "In progress" automatically and remembers the previous column. On stop or when switching to a different task, it goes back to the old column — unless it was manually moved or was already in review/done. Web, mobile and MCP. _FclpRr066St_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Live-Session in der Sessions-Liste**: aktuell laufender Timer erscheint als virtuelle Session-Row im Task-Detail mit Akzent-Border, pulsierendem Live-Dot, "LIVE"-Chip und tickender Stunden-Anzeige (1Hz). Verschwindet automatisch beim Stoppen, die echte Session wandert in die DB.',
          en: '**Live session in the sessions list**: the currently running timer appears as a virtual session row in the task detail with accent border, pulsing live dot, "LIVE" chip and ticking hours display (1Hz). Disappears automatically on stop and the real session moves into the DB.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Notification-Wizard nach Login**: Daily-Digest ist standardmäßig aus. Beim nächsten Login erscheint einmalig ein Dialog "E-Mail-Benachrichtigungen?" mit Ja/Nein und Einzel-Toggles für Erwähnungen + Tägliche Zusammenfassung. Migration setzt `notify_digest_mail = false` für alle Bestands-User.',
          en: '**Notification wizard after login**: daily digest is off by default. On the next login, a one-time dialog appears: "Email notifications?" with yes/no and individual toggles for mentions + daily digest. Migration sets `notify_digest_mail = false` for all existing users.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Status-Wechsel im Mobile-Task-Detail**: Footer-Buttons je nach Spalte + Rolle. Eigene aktive Aufgabe → "Zur Review" + "Timer starten"; Review-Aufgabe + Projektleiter → "Zurück" + "Erledigt"; Erledigte → "Wieder öffnen".',
          en: '**Status switch in the mobile task detail**: footer buttons depend on column + role. Own active task → "To review" + "Start timer"; review task + project owner → "Back" + "Done"; done → "Reopen".',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Checklisten in Aufgaben**: neue Sektion im Task-Detail-Drawer zwischen Beschreibung und Anhängen. Items hinzufügen, abhaken, löschen — mit Fortschrittsbalken. Eigene DB-Tabelle, sauber persistiert. _FCXVQOSTCFp_',
          en: '**Checklists on tasks**: new section in the task detail drawer between description and attachments. Add items, check off, delete — with progress bar. Dedicated DB table, properly persisted. _FCXVQOSTCFp_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Projekte nur durch Admins**: Anlegen/Bearbeiten/Löschen ist Admin-only (Backend 403, Frontend versteckt Buttons, Command-Palette gefiltert). _Fpo1Iu0ndzL_',
          en: '**Projects admin-only**: create/edit/delete is admin-only (backend 403, frontend hides buttons, command palette filtered). _Fpo1Iu0ndzL_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**TV-Dashboard zeigt alle Live-Timer**: Aufgaben mit aktivem Timer erscheinen in "In Arbeit", auch wenn sie noch im Backlog/Geplant/Review stehen — mit Status-Badge und live tickender Pille. _FQJzGtjPqc-_',
          en: '**TV dashboard shows all live timers**: tasks with an active timer appear in "In progress" even if still in backlog/planned/review — with status badge and live ticking pill. _FQJzGtjPqc-_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Termin-Konsolidierung auf TV**: gleiche Termine (Titel + Zeitraum + Location) werden nur einmal angezeigt, mit gestapelten Avataren aller Teilnehmer (max 4 sichtbar + Counter). _FNl4YW89vBX_',
          en: '**TV calendar event deduplication**: identical events (title + time + location) are shown once with stacked attendee avatars (max 4 visible + counter). _FNl4YW89vBX_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Admin-UI Split**: User und Feedbacks nebeneinander, User-Sektion mit Karten/Liste-Toggle. Aktivitäts-Sidebar standardmäßig aus, per Toggle einblendbar. _FEtt86HtKR3_',
          en: '**Admin UI split**: users and feedback side by side, user section with cards/list toggle. Activity sidebar off by default, toggle to show. _FEtt86HtKR3_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Domain-Whitelisting für Self-Registration**: Admin-Sektion mit erlaubten E-Mail-Domains. Nutzer mit whitelisteter Domain können sich per Magic-Link selbst registrieren — werden automatisch als Member ohne Projektzugriff angelegt. _Fm16BUutfUO_',
          en: '**Domain whitelist for self-registration**: admin section with allowed email domains. Users with a whitelisted domain can self-register via magic link — added automatically as members without project access. _Fm16BUutfUO_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Push-Geräte in den Einstellungen**: alle registrierten Geräte mit Browser-Erkennung (Chrome/Android, Safari, Firefox, Edge) sehen, Test-Push senden, Gerät entfernen. _FRPyk3YmWAb_',
          en: '**Push devices in settings**: see all registered devices with browser detection (Chrome/Android, Safari, Firefox, Edge), send a test push, remove devices. _FRPyk3YmWAb_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Eigene Feedbacks in den Einstellungen**: neuer Tab "Meine Feedbacks" zeigt alle selbst eingereichten Bug-Reports und Feature-Requests mit Status-Pill (Offen / In Arbeit / Erledigt / Verworfen) und Resolution-Notiz vom Admin. _F92RWnkL_Iy_',
          en: '**My feedback in settings**: new tab "My feedback" shows all self-submitted bug reports and feature requests with status pill (open / in progress / done / wontfix) and the admin\'s resolution note. _F92RWnkL_Iy_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Review-Sektion auf "Meine Woche"** zeigt jetzt Aufgaben aus Projekten, bei denen du Verantwortlicher bist (nicht mehr eigene Tasks). _FyfRp-e2nzS_',
          en: '**Review section in "My week"** now shows tasks from projects you own (not your own tasks). _FyfRp-e2nzS_',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Zwei neue React-Bits-Backgrounds**: **Silk** (weich fließende SVG-Wellen, CSS-only) und **Hyperspeed** (3D Neon-Highway via Three.js + postprocessing, Click & hold = beschleunigen). Three-Chunk wird nur lazy bei Auswahl geladen, vendor-Bundle bleibt schlank. _FOoB-Gxa-gx_',
          en: '**Two new React Bits backgrounds**: **Silk** (soft flowing SVG waves, CSS-only) and **Hyperspeed** (3D neon highway via Three.js + postprocessing, click & hold to speed up). Three chunk loads only lazily on selection, vendor bundle stays slim. _FOoB-Gxa-gx_',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**Beta-Stack für Staging**: dedizierter `btm-beta.bethesna.org`-Stack (eigene DB, eigene API, eigene Domain) für Vorab-Tests. PIN-Auth statt Magic-Link, `MAIL_DISABLED=true` blockiert alle ausgehenden Mails.',
          en: '**Beta stack for staging**: dedicated `btm-beta.bethesna.org` stack (own DB, own API, own domain) for pre-release tests. PIN auth instead of magic link, `MAIL_DISABLED=true` blocks all outgoing mail.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Calendar-Overflow auf 13"-MacBook**: Termine-Spalte schießt nicht mehr aus dem Grid (`minmax(0, 1fr)`). _Fs0ppP5DH6r_',
          en: '**Calendar overflow on 13" MacBook**: the events column no longer overflows the grid (`minmax(0, 1fr)`). _Fs0ppP5DH6r_',
        },
      },
    ],
  },
  {
    version: '0.12.1',
    date: '2026-05-14',
    title: {
      de: '2 Bugfixes: Update-Pille + Subtask-Erstellung',
      en: '2 bugfixes: Update pill + subtask creation',
    },
    changes: [
      {
        kind: 'fix',
        text: {
          de: '**Update-Pille klickbar**: Klick auf „Update verfügbar" löst jetzt immer einen harten Seitenreload aus — auch wenn der Service-Worker den Reload intern nicht selbst auslöst.',
          en: '**Update pill clickable**: Clicking "Update available" now always triggers a hard page reload — even if the service worker doesn\'t fire its own reload internally.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Subtask-Erstellung**: `parentTaskId` wurde serverseitig nicht gespeichert — neue Subtasks tauchten deshalb nicht in der Liste auf. Behoben. Nach dem Anlegen öffnet sich die neue Subtask jetzt direkt im Drawer zum Weiterbearbeiten.',
          en: '**Subtask creation**: `parentTaskId` was not saved server-side — newly created subtasks didn\'t appear in the list. Fixed. After creation, the new subtask now opens directly in the drawer for immediate editing.',
        },
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-05-14',
    title: {
      de: 'Per-User-Akzentfarbe, OpenAI-AI, Claude-MCP-Wizard, Archiv & 20+ Bug-/Feature-Fixes',
      en: 'Per-user accent color, OpenAI AI, Claude-MCP wizard, archive & 20+ bug/feature fixes',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: '**Per-User-Akzentfarbe**: Einstellungen → Aussehen → 7 Presets (Orange/Lila/Blau/Petrol/Grün/Pink/Rot) oder eigener Hex-Wert via Color-Picker. Wird live übernommen und auf dem Server gespeichert — gilt auf jedem Gerät. Alle Buttons, Pills, Hover, Focus, Mention-Tags, Glass-Dark-Gradient und Highlights mitfärben jetzt (5 Accent-Shades + RGB-Triplet auf Body als CSS-Variable, ~125 Hardcode-Orange-Stellen umgezogen).',
          en: '**Per-user accent color**: Settings → Appearance → 7 presets (orange / purple / blue / teal / green / pink / red) or a custom hex via color picker. Live preview + saved server-side. Buttons, pills, hovers, focus rings, mention tags, glass-dark ambient gradient and highlights all follow your choice.',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**AI-Backend von Gemma auf OpenAI umgestellt** (Default `gpt-4o-mini`). Planungs-KI-Chatbubble + AI-Drawer-Aufgaben-Extract laufen jetzt verlässlich mit Tool-Calling, ohne die alten Gemma-Channel-Marker-Probleme. Provider-Switch über `.env` — kein Code-Change nötig.',
          en: 'AI backend switched from Gemma to **OpenAI** (default `gpt-4o-mini`). The planning chat bubble + AI drawer task-extract now use reliable function calling without the old Gemma channel-marker quirks. Provider switch via `.env` — no code change required.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Claude-MCP-Setup-Wizard** in Einstellungen → API-Tokens: drei klare Schritte mit „Setup-Prompt für Claude kopieren"-Button. Picker-Dropdown wählt entweder einen bestehenden Token, ersetzt einen Legacy-Token, oder erstellt direkt einen neuen. Bestehende Tokens werden im Klartext angezeigt (mit Eye/Copy/Sparkles-Buttons pro Zeile) — internes Tool, kein Datenschutz-Risiko.',
          en: '**Claude MCP setup wizard** in Settings → API tokens: three clear steps with a "Copy setup prompt for Claude" button. Picker dropdown selects an existing token, replaces a legacy token, or creates a fresh one. Existing tokens are now shown in plain text (with eye/copy/sparkles icon buttons per row) — internal tool, no privacy risk.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Archiv-Funktion für erledigte Aufgaben**: Drawer-Button am Detail + „Alle erledigten archivieren" im Kanban-Done-Header. Archivierte Tasks verschwinden aus dem Board, bleiben aber in Stunden-Reports + Times-Screen. `GET /api/tasks?archived=archived|all` für Power-User.',
          en: '**Archive for completed tasks**: drawer button on details + "Archive all done" in the kanban done column header. Archived tasks disappear from the board but stay in hour reports + Times screen. `GET /api/tasks?archived=archived|all` for power users.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Sammel-Prompt für Admin-Feedbacks**: Multi-Select per Checkbox + sticky Bulk-Action-Bar. Ein Klick generiert einen kombinierten Prompt für Claude Code mit einmaligem Repo-Header und einem Block pro Feedback — perfekt für verwandte CSS-Bugs oder zusammen-implementierbare Features.',
          en: '**Batch prompt for admin feedbacks**: multi-select via checkbox + sticky bulk action bar. One click generates a combined Claude-Code prompt with a single repo header and one section per feedback — perfect for related CSS bugs or features that can ship together.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Screenshot im Feedback-Modal**: Drag & Drop oder ⌘V — der letzte Clipboard-Screenshot wird automatisch angehängt (PNG/JPEG, max 8 MB). Wird in der DB mitgespeichert, Admin sieht das Bild im Feedback-Drawer.',
          en: '**Screenshot in feedback modal**: drag & drop or ⌘V — the last clipboard image is auto-attached (PNG/JPEG, max 8 MB). Stored alongside the feedback, admin sees it in the feedback drawer.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Update-Pille statt Force-Reload**: bei einer neuen Version erscheint Claude-Desktop-Style eine Pille direkt über dem Profil-Tile mit „Update verfügbar". Klick lädt die neue Version — kein erzwungener Reload mehr mid-task.',
          en: '**Update pill instead of force-reload**: when a new version ships, a Claude-Desktop-style pill appears right above the profile tile saying "Update available". Click to reload — no more forced mid-task reloads.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Globaler Feedback-Shortcut ⌘⇧F**: öffnet/schließt das Feedback-Modal von jeder Seite.',
          en: '**Global feedback shortcut ⌘⇧F**: opens/closes the feedback modal from anywhere.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Quickstart-Modal mit Beschreibung, Priorität und Fälligkeit**: neue Aufgabe direkt mit allen wichtigen Feldern anlegen, ohne hinterher in den Detail-Drawer wechseln zu müssen.',
          en: '**Quickstart modal with description, priority and due date**: create a new task with all the important fields up front — no need to open the detail drawer afterwards.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Task → Wochenansicht-Shortcut** im Detail-Drawer: Calendar-Icon-Button oben rechts springt direkt zu Meine Woche.',
          en: '**Task → week view shortcut** in the detail drawer: calendar icon button at top right jumps straight to My Week.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Sidebar restrukturiert**: Updates wandert nach unten direkt über das Profil. Mobile-Vorschau + Chrome-Plugin + TV-Dashboard in zusammenklappbare Extras-Gruppe. Projekte-Chip zeigt nur noch Favoriten-Anzahl statt aller Projekte.',
          en: '**Sidebar restructure**: Updates moves down right above the profile. Mobile preview + Chrome plugin + TV dashboard into a collapsible "Extras" group. Projects chip now shows only the favorites count instead of all projects.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Odoo-Kalender-Vorlage**: ein Klick füllt URL + Datenbank vor und schlägt deine Login-Email als Username vor. Platzhalter für ein zukünftiges Video-Tutorial direkt unter dem API-Key-Feld.',
          en: '**Odoo calendar preset**: one click fills URL + database and proposes your login email as the username. Placeholder for a future video tutorial below the API key field.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Kalender-Duplikate**: Dev Standup + Automation-Stammtisch tauchten doppelt auf. Ursache: Google-Kalender exportiert geänderte Serientermine als zwei VEVENTs (Master mit RRULE + Override mit RECURRENCE-ID), die wurden separat emittiert. Plus Cross-Source-Overlap, wenn Odoo den Google-Kalender spiegelt UND der gleiche Google-Kalender als iCal-Feed hängt. Beides ist jetzt deduped.',
          en: '**Calendar duplicates** fixed: Dev Standup + Automation-Stammtisch showed up twice. Google exports modified recurring instances as two VEVENTs (master with RRULE + override with RECURRENCE-ID) which got emitted separately. Plus cross-source overlap when Odoo mirrors Google and Google also runs as an iCal feed. Both are now deduped.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**TV-Dashboard-Stuck**: nach Stunden Laufzeit hing der Pi-Tab manchmal auf „Verbinde …" und musste manuell rebooted werden. Watchdog macht jetzt automatisch einen Reload nach 90 s ohne erste Daten oder 5 Min ohne erfolgreichen Refetch.',
          en: '**TV dashboard stuck screen**: after hours of uptime the Pi tab sometimes hung on "Connecting…" and needed a manual reboot. Watchdog now auto-reloads after 90 s without initial data or 5 min without a successful refetch.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Termine/Timeline-Toggle** auf Meine Woche zeigte im Dark-Theme weißen Hintergrund mit weißem Text — Base-CSS-Regel war nicht für Dark-Mode überschrieben. Jetzt Accent-Tint in Studio-Dark, Frosted-White-Pill in Glass-Dark.',
          en: '**Dates/Timeline toggle** on My Week showed white-on-white text in dark themes — base CSS had no dark-mode override. Now uses an accent tint in Studio Dark and a frosted-white pill in Glass Dark.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Aufgabenkarten-Kontrast** im Glass-Dark: bei hellen Akzentfarben (Lila/Türkis/Gelb) drückte der akzent-getintete Ambient-Gradient den Card-Untergrund unleserlich. Karten haben jetzt einen festen Cream-100-Base-Layer + Frost-Overlay.',
          en: '**Task card contrast** in glass-dark: with light accents (purple/teal/yellow) the accent-tinted ambient gradient washed out the card background. Cards now have a solid cream-100 base + frost overlay.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Review→Done-Permission**: Admins konnten still Reviews von Kolleg:innen durchwinken. Jetzt erscheint ein Confirm-Dialog mit Owner-Name. Non-Admin-Nicht-Owner = wie vorher hart geblockt.',
          en: '**Review→done permission**: admins could silently push other people\'s reviews through. Now a confirm dialog with the owner\'s name. Non-admins who aren\'t the owner are still hard-blocked as before.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Feedback-Modal verwirft nicht mehr aus Versehen**: Backdrop-Klick, X, Escape und Abbrechen fragen jetzt nach, wenn Titel, Body oder Screenshot etwas drin haben.',
          en: '**Feedback modal no longer discards by accident**: backdrop click, X, escape and cancel now confirm if you\'ve typed anything or attached a screenshot.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Admin-Login-Link** für andere User landete im Inkognito-Browser auf der Landing-Page statt am Login. URL und AppGate jetzt korrekt verkabelt.',
          en: '**Admin login link** for other users used to land on the landing page in incognito instead of the login screen. URL and AppGate are now wired correctly.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**DatePicker** im QuickStart-Modal klippte am Modal-Rand — jetzt via React-Portal direkt in `<body>` mit Smart-Placement (oben/unten je nach Platz).',
          en: '**DatePicker** in the quickstart modal used to clip at the modal edge — now portals to `<body>` with smart placement (above/below depending on space).',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Settings-Modal etwas größer (max-width 1120 statt 920, height 820 statt 680) — mit dem neuen MCP-Wizard + Color-Picker-Tab war es vorher zu eng.',
          en: 'Settings modal bumped a notch larger (max-width 1120 instead of 920, height 820 instead of 680) — felt cramped with the new MCP wizard + color picker tab.',
        },
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-05-13',
    title: {
      de: 'Kalender-Sync, schneller Aufgaben-Start, Wochenboard-Politur und Multi-Team',
      en: 'Calendar sync, quick task start, week board polish and multi-team',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: '**Odoo-Kalender-Sync**: Verbinde deinen Odoo-Kalender in Settings → Kalender. Auf „Meine Woche" siehst du deine eigenen Termine für heute und morgen, auf dem TV-Dashboard alle Termine aller Team-Mitglieder mit aktivem Sync. Server synct alle 5 Min im Hintergrund, API-Keys werden AES-verschlüsselt gespeichert.',
          en: '**Odoo calendar sync**: connect your Odoo calendar in Settings → Calendar. "My Week" shows your own events for today + tomorrow, the TV dashboard shows all team events. Background sync every 5 min, API keys AES-encrypted.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Eigene iCal-Feeds**: zusätzlich zu Odoo kannst du beliebig viele iCal-URLs einbinden (Google, Apple, Outlook, alles was eine .ics-URL hat). Mit Label, Aktiv-Toggle und individueller Sync-Status-Anzeige. Wiederkehrende Termine (RRULE) werden automatisch expandiert.',
          en: 'Add your own iCal feeds in addition to Odoo: any .ics URL (Google, Apple, Outlook, …). With label, active toggle, per-feed sync status. Recurring events (RRULE) auto-expanded.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**TV-Privatsphäre pro Quelle**: ein Toggle für deine Odoo-Termine + ein Toggle pro iCal-Feed. „Privat" auf TV bedeutet: Avatar + Zeit weiterhin sichtbar, Titel und Ort werden zu „Privat" anonymisiert. Auf deiner eigenen „Meine Woche"-Ansicht siehst du immer die vollen Titel.',
          en: 'Per-source TV privacy: one toggle for Odoo events + one per iCal feed. "Private" on TV: avatar + time stay visible, title and location anonymized. Your own "My Week" view always shows real titles.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Das Kalender-Widget auf „Meine Woche" zeigt jetzt eine **„Nächster Termin in 1h 23 Min"-Karte** mit Live-Countdown, eine „Jetzt"-Linie zwischen vergangenen und kommenden Terminen, und einen Toggle für **Timeline-View** (vertikale Stunden-Skala mit Event-Blöcken und pulsierender Now-Linie).',
          en: 'The calendar widget on "My Week" now has a **"Next up in 1h 23m" card** with live countdown, a "Now" line between past and upcoming events, and a **Timeline view** toggle (vertical hours grid with event blocks and pulsing now-line).',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Aufgabe starten in 3 Klicks** vom Hauptbildschirm: neuer „Aufgabe starten"-Button auf „Meine Woche". Klick öffnet ein Inline-Form (Titel + Pflicht-Projekt), Klick auf „Starten" pausiert deinen laufenden Timer, legt die Aufgabe in „In Arbeit" an und startet den neuen Timer automatisch.',
          en: '**Start a task in 3 clicks** from the home screen: new "Start task" button on "My Week". Opens an inline form (title + required project). Click starts a new task in "In progress", auto-pauses your current timer and starts the new one.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Personen-Filter im Wochenboard**: neben den „Meine/Team"-Chips ein Dropdown mit allen aktiven Personen. Auswählen und du siehst nur Aufgaben dieser Person — praktisch für „was macht XY gerade".',
          en: '**Person filter on the week board**: next to "Mine/Team" chips, a dropdown of all active people. Pick one to see only their tasks — handy for "what is XY working on right now".',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Fristen im Wochenboard sichtbar**: jede Kanban-Karte zeigt jetzt das Fälligkeitsdatum als kleinen Pill (Kalender-Icon + Datum). Überfällige Karten sind rot mit Warn-Icon, heute fällige orange, in nächsten 3 Tagen gelb. Karten werden zusätzlich pro Spalte automatisch nach Frist sortiert — überfällig → heute → bald → später → ohne Frist.',
          en: 'Due dates visible on the week board: every kanban card now shows a due-date pill (calendar icon + date). Overdue cards turn red with a warning icon, today-due cards orange, next-3-days yellow. Cards are also auto-sorted per column by urgency — overdue → today → soon → later → no deadline.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Multi-Team-Mitgliedschaft**: ein Mensch kann jetzt in beliebig vielen Teams sein, nicht mehr nur einem. Im Admin → User-Drawer erscheinen alle Team-Zugehörigkeiten als Chips, ein Stern markiert das primäre Team. Hinzufügen über Dropdown, Entfernen über X.',
          en: '**Multi-team membership**: a person can now belong to any number of teams, not just one. In Admin → User Drawer, all team memberships appear as chips with a star on the primary one. Add via dropdown, remove via X.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Bug-Report / Feature-Wunsch im Admin bearbeiten**: pro Eintrag in der Admin-Feedback-Liste ein neuer „Bearbeiten"-Button. Damit kannst du Titel, Beschreibung und Typ (Bug ↔ Feature) korrigieren — z.B. Tippfehler raus oder unsinnige Wünsche präzisieren bevor sie ins Claude-Prompt gehen.',
          en: '**Edit feedback in admin**: each entry in the admin feedback list now has an "Edit" button. Lets you correct the title, description and type (bug ↔ feature) — e.g. fix typos or sharpen vague wishes before sending them off to Claude.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Status-Filter in der Admin-Feedback-Liste**: Default zeigt nur „Aktiv (offen + in Arbeit)" — erledigte und verworfene werden ausgeblendet. Dropdown rechts oben um nach jedem Status einzeln zu filtern, mit Live-Counts.',
          en: '**Status filter in admin feedback**: default is "Active (open + in progress)" — done and won\'t-fix entries are hidden. Dropdown at top right to filter any status individually, with live counts.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Bearbeitete Feedbacks resolven**: neuer Workflow im Admin. Nach dem Fix kann Claude den `POST /api/feedback/:id/resolve`-Endpoint aufrufen — das setzt den Status auf „Erledigt", schreibt eine Inbox-Notification an den Reporter und schickt ihm eine Mail mit der Auflösungs-Notiz.',
          en: '**Resolve feedback after fixing**: new admin workflow. After implementing a fix, Claude can hit `POST /api/feedback/:id/resolve` — sets status to "done", writes an inbox notification to the reporter, and emails them with the resolution note.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Admin-Magic-Link**: Klick auf das Schlüssel-Symbol im Admin-User-Drawer kopiert jetzt nur den Login-Link in die Zwischenablage (statt Email + Code + URL). Beim Öffnen des Links wird der Empfänger automatisch eingeloggt, 15 Min gültig.',
          en: '**Admin magic link**: clicking the key icon in the user drawer now copies just the login URL (instead of email + code + URL). Opening the link signs the recipient in directly, valid 15 min.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '**Projekt-Favoriten**: jedes Projekt hat jetzt einen Stern in den Card-Actions und in der Tabellen-Spalte. Favorisierte Projekte erscheinen in einer eigenen „Favoriten"-Sektion oben, gelb umrandet. Pro User unabhängig speicherbar.',
          en: '**Project favorites**: every project has a star in the card actions and table column. Favorites show up in their own "Favorites" section at the top, gold-tinted. Stored per user.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Für Admins: **fremde Privatprojekte sind in der Übersicht standardmäßig ausgeblendet** — ein Toggle oben rechts blendet sie ein, dann werden sie mit gestrichelter Border + lila „PRIVAT"-Pill gerendert. Eigene Privatprojekte bleiben immer sichtbar.',
          en: 'For admins: **other users\' private projects are hidden by default** — a toggle at the top reveals them, rendered with dashed border + purple "PRIVATE" pill. Your own private projects are always visible.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**Logout funktionierte nicht** zuverlässig: nach Klick auf „Abmelden" war man nach einem Hard-Reload wieder eingeloggt. Better-Auth verlangt `Content-Type: application/json` auch bei POST ohne Body — der wurde nicht mitgeschickt, das Session-Cookie blieb am Leben. Fix: leerer JSON-Body wird jetzt mitgeschickt; bei Netzwerk-Fehler bleibt der User eingeloggt und sieht einen Toast statt eines stillen Fake-Logouts.',
          en: '**Sign-out was unreliable**: after clicking "Sign out" a hard reload brought you back in. Better-Auth requires `Content-Type: application/json` even on bodyless POST — wasn\'t sent, session cookie survived. Fixed: empty JSON body is now sent; on network errors user stays signed in and gets a toast instead of a silent fake-logout.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**HTTP 431 „Request Header Fields Too Large"** beim Öffnen von BTM behoben. Better-Auth speicherte den Avatar-base64 in einem Cookie — das wuchs schnell über Node\'s 16-KB-Header-Limit. `cookieCache` ist jetzt aus, Node-Limit auf 32 KB gebumpt. Wenn du diese Seite je gesehen hast: einmalig Cookies löschen und neu einloggen.',
          en: '**HTTP 431 "Request Header Fields Too Large"** on opening BTM fixed. Better-Auth was stashing the avatar as base64 in a cookie — grew past Node\'s 16 KB header limit. `cookieCache` is now off, Node limit bumped to 32 KB. If you ever saw that page: clear site cookies once and sign in fresh.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Das **„Ohne Frist"-Tab im Wochenboard-Timeline** zeigte fälschlich Aufgaben, die in einer anderen Woche fällig sind. Beim KW-Wechsel landeten zugewiesene Aufgaben als „ohne Frist" — jetzt verschwinden sie korrekt aus der aktuellen Wochen-View, weil sie ja eine echte Frist haben (nur in einer anderen Woche).',
          en: 'The **"No deadline" column in the week board timeline** wrongly showed tasks that are due in a different week. After switching weeks, assigned tasks would appear as "no deadline" — they now correctly disappear from the current week\'s view because they do have a deadline (just in a different week).',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Im **TV-Dashboard** war jeder kurze API-Hick-up (etwa beim Deploy oder kurzem Netzwerk-Aussetzer) sofort der dramatische „Token ungültig"-Fehlerbildschirm. Jetzt wird nur bei echten 401/403-Auth-Fehlern dieser Screen gezeigt; bei allen anderen Fehlern bleibt das Dashboard mit den letzten Daten sichtbar und ein kleiner roter „verbinde neu"-Banner schwebt rechts oben bis sich der Server wieder meldet. Plus 8 Retry-Versuche mit Exponential-Backoff statt 3.',
          en: 'On the **TV dashboard**, any brief API hiccup (deploy, network blip) would immediately show the dramatic "Token invalid" error screen. Now only real 401/403 errors show that screen; for everything else the dashboard keeps showing last-known data with a small red "reconnecting" banner top-right until the server comes back. Plus 8 retry attempts with exponential backoff instead of 3.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: '**App-Icon in allen Mails** war broken (kleines „BTM"-Alt-Text statt Icon). Der btm-api-Container hatte keinen Zugriff aufs Frontend-Asset-Verzeichnis. Das Icon liegt jetzt direkt im Server-Image — Magic-Link-Mails, Einladungen, Mention-Mails, Daily-Digest und Feedback-Resolved-Mails kommen mit Logo.',
          en: 'The **app icon in all emails** was broken (showed "BTM" alt-text instead of icon). The btm-api container had no access to the frontend asset directory. Icon now lives inside the server image — magic-link mails, invitations, mention mails, daily digest and feedback-resolved mails all show the logo.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Das **hochgeladene Profilbild** wurde unten links in der Sidebar nicht angezeigt (Initialen statt Bild). Jetzt sauber.',
          en: 'Your **uploaded profile picture** was not shown in the bottom-left sidebar (just initials). Fixed.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Die **„Bug melden / Feature wünschen"-Buttons** im Feedback-Modal hatten im Dark-Mode keine erkennbare Accent-Farbe — der aktive Button war fast nicht vom inaktiven unterscheidbar. Accent-Override für `.is-active` ergänzt, der orange Highlight ist wieder da.',
          en: 'The **"Report bug / Request feature" buttons** in the feedback modal had no recognizable accent color in dark mode — active button was almost indistinguishable from inactive. Active-state accent override added, orange highlight is back.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Browser-Password-Manager (Arc, 1Password, LastPass) konnten den **Odoo-API-Key**-Input automatisch mit gespeicherten Login-Passwörtern füllen — der zu kurze String hat dann den echten Key in der DB überschrieben und alle Syncs schlugen mit `auth_failed` fehl. Form-Feld blockt jetzt Autofill (`autoComplete=new-password` + diverse Vendor-Attribute), Server validiert zusätzlich `min(20)`.',
          en: 'Browser password managers (Arc, 1Password, LastPass) could auto-fill the **Odoo API key** input with saved login passwords — the too-short string then overwrote the real key in the database and all syncs failed with `auth_failed`. Form field now blocks autofill (`autoComplete=new-password` + vendor attributes), server adds `min(20)` validation.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Fehler beim iCal-Feed-Sync zeigten nur kryptische Codes wie `http_error`. Jetzt klassifiziert: 404 mit dem Hinweis „bei Google brauchst du die _geheime_ Adresse im iCal-Format, nicht die öffentliche", 401 „erfordert Anmeldung", 403 „nicht öffentlich freigegeben". Tooltip zeigt den Original-Code falls man genau wissen will was passiert ist.',
          en: 'Errors during iCal feed sync only showed cryptic codes like `http_error`. Now classified: 404 with the hint "for Google you need the _secret_ iCal address, not the public one", 401 "requires login", 403 "not publicly shared". Tooltip shows the original code if you want to dig deeper.',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**TV-Dashboard** zeigt im rechten Quadrant nicht mehr den „Heute erledigt"-Stapel sondern den **echten Team-Kalender für heute**. Wenn das Kalender-Sync aktiv ist und Termine im Team anstehen, siehst du sie hier mit Zeit + Titel + Avatar live.',
          en: '**TV dashboard** right quadrant no longer shows "Done today" but the **real team calendar for today**. With calendar sync active and team events scheduled, you see them here with time + title + avatar live.',
        },
      },
      {
        kind: 'change',
        text: {
          de: '**Projekte-Ansicht hat eine Listen-Variante** (Toggle oben rechts): kompakte Tabelle mit Code, Name, Owner-Avatar, Aufgaben-Count, Fortschritts-Balken, geplanten + erfassten Stunden, Frist und Aktionen. Persistent in localStorage.',
          en: '**Projects view has a list mode** (toggle at top right): compact table with code, name, owner avatar, task count, progress bar, planned + logged hours, due date and actions. Persisted in localStorage.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Avatare in der App zeigen jetzt überall das **hochgeladene Profilbild** (statt nur Initialen) — TaskCards, Inbox, Kapazität, Project-Members, Comments, TV-Dashboard und Sidebar.',
          en: 'Avatars throughout the app now show the **uploaded profile picture** (instead of just initials) — task cards, inbox, capacity, project members, comments, TV dashboard and sidebar.',
        },
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-05-10',
    title: {
      de: 'Timeline mit Drag-and-Drop, Zeit-Filter, neue Hintergründe & Profil-Editor',
      en: 'Timeline with drag-and-drop, time filter, new backgrounds & profile editor',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Wochenboard-Timeline jetzt voll interaktiv: Karten ziehen verschiebt **Frist und Bearbeiter** auf einen Schlag. Wochen lassen sich vor- und zurückblättern, KW + Datums-Range stehen sauber im Header. Jede Karte zeigt einen Status-Chip mit ihrer aktuellen Spalte.',
          en: 'Week-board timeline now fully interactive: dragging a card changes **due date and assignee** in one move. Weeks navigate forward/back, week number + date range sit cleanly in the header. Every card shows a status chip with its current column.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Zeiten-Seite: Wochen-Navigation + Personen-Filter. Admins können die erfassten Stunden anderer Personen einsehen, alle können beliebige Wochen rückblickend anschauen.',
          en: 'Time page: week navigation + person filter. Admins can view other people\'s logged hours, everyone can browse past weeks.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Fünf neue animierte Hintergründe für den Glass-Modus: **Sanfte Aurora**, **Lichtsäule**, **Prisma**, **Dunkler Schleier** und **Grainient**. In Einstellungen → Hintergrund mit „Neu"-Chip markiert. Pointer-reaktiv wie die bestehenden.',
          en: 'Five new animated backgrounds for glass mode: **Soft Aurora**, **Light Pillar**, **Prism**, **Dark Veil** and **Grainient**. Marked with a "New" chip in Settings → Background. Pointer-reactive like the existing ones.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Profil-Editor in den Einstellungen: Profilbild hochladen (wird auf 256×256 skaliert), Name und Position ändern. Position wird auch in der Admin-Übersicht angezeigt.',
          en: 'Profile editor in settings: upload an avatar (scaled to 256×256), edit name and job title. Job title is shown in the admin view too.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Tagesübersicht-Mail kann jetzt sofort getriggert werden — neuer Button „Tagesübersicht jetzt senden" in Einstellungen → Benachrichtigungen. Praktisch zum Testen.',
          en: 'Daily digest email can now be triggered on demand — new button "Send daily digest now" in Settings → Notifications. Handy for testing.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Admin-Tool: Login-Link für andere Personen mit einem Klick generieren. Der Code wird in die Zwischenablage kopiert (15 Min gültig). Beim Öffnen des Links sind Email + Code automatisch eingetragen — praktisch für Support-Fälle.',
          en: 'Admin tool: generate a login link for another person with one click. Code is copied to clipboard (valid 15 min). Opening the link auto-fills email + code — handy for support cases.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Projekt-Sichtbarkeit: ist eine Person kein Mitglied eines Projekts, sieht sie weder das Projekt noch dessen Aufgaben. Bestehende Projekte ohne Mitgliederliste bleiben für alle sichtbar (kein Plötzliches-Verschwinden).',
          en: "Project visibility: people who aren't members of a project don't see the project or its tasks. Existing projects without a member list remain visible to everyone (no sudden disappearance).",
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Inbox-Container ist jetzt frosted-glassy (passend zu Kanban + Release-Cards). Sichtbarer Wechsel im Glass-Modus.',
          en: 'Inbox container now frosted-glassy (matching kanban + release cards). Visible difference in glass mode.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Landingpage poliert: animierter Hintergrund hinter allen Sections (Mesh hell, Aurora dunkel), Mini-Board und Top-Bar im Glass-Look, smoothere Übergänge beim Theme-Wechsel.',
          en: 'Landing page polished: animated background behind all sections (mesh in light, aurora in dark), mini-board and top bar in glass look, smoother transitions on theme switch.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Datepicker und Kapazitäts-Container sind jetzt frosted-glassy. „Bekannte Probleme"-Karten ohne farbige Streifen links — Status-Pille reicht.',
          en: '"Known issues" cards no longer have colored strips on the left — status pill is enough. Date picker and capacity container are frosted-glassy.',
        },
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-10',
    title: {
      de: 'Projekt-Verantwortliche, Subtasks, Bug-Reports & viel Glass-Politur',
      en: 'Project owners, subtasks, bug reports & lots of glass polish',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Projekt-Verantwortliche und Mitglieder: jedes Projekt kann eine Person als „Verantwortlich" haben. Sie bekommt eine Inbox-Benachrichtigung sobald eine Aufgabe in Review wechselt, und nur sie (oder ein Admin) darf Aufgaben auf „Erledigt" setzen. Plus eine Mitglieder-Liste pro Projekt mit Rollen (Mitglied / Nur-Lesen).',
          en: 'Project owners and members: every project can have a designated owner. They get an inbox notification when a task moves to review, and only they (or an admin) can mark tasks as done. Plus a member list per project with roles (member / read-only).',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Subtasks: in jeder Aufgabe lässt sich jetzt eine Liste von Unteraufgaben pflegen. Subtasks tauchen als eigene Karten auf dem Board auf — mit klarer „Subtask"-Kennzeichnung. Im Drawer der Subtask kommst du per Klick zurück zur Hauptaufgabe.',
          en: 'Subtasks: every task now supports a list of subtasks. Subtasks appear as their own cards on the board — clearly marked as "Subtask". From a subtask drawer one click takes you back to the parent.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Bug-Report & Feature-Wunsch direkt aus der App: Profil-Menü → Feedback. Mit Bug/Feature-Toggle und automatischem Snapshot von Pfad, Theme und Browser. Admins sehen alle Einträge im Admin-Bereich, können Status setzen und mit einem Klick einen kompletten Prompt für Claude Code in die Zwischenablage kopieren oder direkt in Claude öffnen.',
          en: "Bug-report & feature-request right from the app: Profile menu → Feedback. With Bug/Feature toggle and an automatic snapshot of path, theme and browser. Admins see all entries in the admin area, can set status, and copy a full Claude Code prompt to clipboard or open it directly in Claude.",
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Aktivitäts-Zeitstrahl mit Diff-Tooltip: bei jeder Aufgaben-Änderung zeigt ein kleines Info-Icon, was sich konkret geändert hat (Titel, Priorität, Frist, Projekt, Bearbeiter, geplante Zeit). Hover öffnet den Vorher-Nachher-Vergleich.',
          en: 'Activity timeline with diff tooltip: on every task change a small info icon shows exactly what was changed (title, priority, due date, project, assignee, planned time). Hover reveals a before/after view.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Animierte Hintergründe sind jetzt **interaktiv**: Aurora-Blobs, Mesh-Punkte, Lichtsäulen, Wellen und der Akzent-Glow reagieren auf deinen Mauszeiger und folgen ihm subtil. Reduce-Motion und Touch-Geräte werden respektiert.',
          en: 'Animated backgrounds are now **interactive**: aurora blobs, mesh dots, light beams, waves and the accent glow react to your cursor and follow it subtly. Reduce-motion and touch devices are respected.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Animierte Hintergründe werden serverseitig gespeichert und folgen dir auf jedes Gerät, mit dem du eingeloggt bist. Plus eine Hero-Vorschau im Einstellungs-Tab mit Mock-App-Inhalt, sodass du siehst wie ein Effekt im echten Layout wirkt.',
          en: 'Animated backgrounds are now saved server-side and follow you onto any device you sign in to. Plus a hero preview in the settings tab with mock app content so you see how an effect feels in the real layout.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Glass-Look überarbeitet: Sidebar, Wochenboard-Spalten, Kapazitäts-Container, Command-Palette (⌘K), Release-Cards und der Datepicker sind jetzt alle frosted-translucent. Hover-Zustände wirken wie sanftes Glass, kein harter Block mehr.',
          en: 'Glass look overhauled: sidebar, week-board columns, capacity container, command palette (⌘K), release cards and the date picker are now all frosted-translucent. Hover states feel like soft glass instead of hard blocks.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Updates-Seite neu sortiert: Releases nehmen die volle Breite ein, „Bekannte Probleme" und „Aktuell in Arbeit" wandern in eine Sidebar rechts (20 %). NEU/GEÄNDERT/FIX-Pills haben jetzt einheitliche Breite, sodass die Texte daneben sauber bündig stehen.',
          en: 'Updates page rearranged: releases take the full width, "Known issues" and "Currently in progress" sit in a 20% sidebar on the right. NEW/CHANGED/FIX pills are now equal-width, so the descriptions next to them line up cleanly.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Auf der Landingpage kannst du jetzt zwischen Hell und Dunkel wechseln (Sonne/Mond-Icon oben rechts) — der Glass-Look bleibt in beiden Varianten.',
          en: 'On the landing page you can now toggle between light and dark (sun/moon icon top-right) — the glass look stays in both variants.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Animierte Hintergründe waren in Glass-Themes komplett unsichtbar (Z-Index-Konflikt mit dem Body-Gradient). Jetzt sichtbar wie gedacht, mit kräftigeren Farben in Dark-Mode.',
          en: 'Animated backgrounds were completely invisible in Glass themes (z-index conflict with body gradient). Now visible as intended, with stronger colors in dark mode.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Inline-Aufgabe hinzufügen im Wochenboard ragte aus der Spalte heraus, wenn die Spalte schmal war. Jetzt bleibt das Formular sauber innerhalb der Spalte.',
          en: 'Inline "add task" in the week board was overflowing the column when the column was narrow. The form now stays inside the column.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Im Command-Palette-Suchfeld (⌘K) hatte das ausgewählte Element im Dunkelmodus einen knallweißen Block-Hintergrund. Jetzt subtiler Glass-Highlight statt hart.',
          en: 'In the command palette (⌘K) the active item had a stark white block background in dark mode. Now a subtle glass highlight instead of a hard block.',
        },
      },
      {
        kind: 'change',
        text: {
          de: '„Bekannte Probleme"-Karten: die farbigen Leisten links sind raus — die Status-Pille oben reicht. Sieht im Frosted-Glass-Layout aufgeräumter aus.',
          en: '"Known issues" cards: removed the colored strips on the left — the status pill at the top is enough. Looks cleaner in the frosted-glass layout.',
        },
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-05-09',
    title: {
      de: 'Lebendige Hintergründe, smarteres Aufgaben-Modal, Mail-Benachrichtigungen',
      en: 'Living backgrounds, smarter task drawer, email notifications',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Animierte Hintergründe für den Glass-Modus: Aurora, Mesh, Glow, Lichtsäulen, Filmkorn, Punktraster, Linien und Wellen. Auswählbar in Einstellungen → Hintergrund. Mit Live-Vorschau und sanften Effekten, die deinem Mauszeiger folgen.',
          en: 'Animated backgrounds for Glass mode: Aurora, Mesh, Glow, Light beams, Film grain, Dot grid, Lines and Waves. Pick yours in Settings → Background. Live preview, with subtle effects that follow your cursor.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Mail-Benachrichtigungen: bekomme eine E-Mail wenn dich jemand mit @ in einem Kommentar erwähnt. Außerdem optionale **Tagesübersicht** morgens um 8:00 mit allem was du verpasst hast: Mentions, fällige Aufgaben, Aktivität auf deinen Aufgaben. Beides separat schaltbar in Einstellungen → Benachrichtigungen.',
          en: 'Email notifications: get an email when someone @-mentions you in a comment. Plus an optional **daily digest** at 8am with everything you missed: mentions, due tasks, activity on your tasks. Both toggle independently in Settings → Notifications.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Geplante Zeit nachträglich bearbeiten: Klick auf „/ X,Xh geplant" im Aufgaben-Drawer öffnet einen Inline-Editor. Enter speichert.',
          en: "Edit planned time after the fact: click on \"/ X.Xh planned\" in the task drawer to open an inline editor. Enter saves.",
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Sessions im Aufgaben-Drawer komplett editierbar: Stunden anpassen, Datum ändern, einzelne Sessions löschen, neue Sessions manuell nachtragen mit „+ Session". Der Logged-Counter rechnet sich automatisch nach.',
          en: 'Fully editable sessions in the task drawer: adjust hours, change date, delete individual sessions, add new ones manually via "+ Session". The logged counter recalculates automatically.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Aktivitäts-Zeitstrahl in jeder Aufgabe: Kommentare und Änderungen (Status, Timer, Bearbeitung) zusammen in chronologischer Reihenfolge. Du siehst auf einen Blick, was wann passiert ist.',
          en: 'Activity timeline in every task: comments and changes (status, timer, edits) merged into one chronological view. See at a glance what happened when.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Eigener Datepicker im BTM-Design. Kein hässlicher Browser-Dialog mehr. Mit Mo-Start, „Heute"-Sprung, Lösch-Button und Zeit-Stepper für präzise Session-Zeitpunkte.',
          en: 'Custom date picker in BTM design. No more ugly browser dialog. Mon-first week, "Today" jump, clear button, and a time stepper for precise session timestamps.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Aufgaben-Drawer neu sortiert: Anhänge stehen jetzt direkt unter der Beschreibung, dann Sessions, dann der Aktivitäts-Zeitstrahl. Logischere Lese-Reihenfolge.',
          en: 'Task drawer reordered: attachments now sit directly below the description, then sessions, then the activity timeline. More logical reading order.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Wenn du einen Projekt-Filter aktiv hattest, hat „+ Aufgabe hinzufügen" die neue Aufgabe in einem **anderen** Projekt angelegt und sie war danach unsichtbar. Jetzt landet sie automatisch im gefilterten Projekt.',
          en: "If you had a project filter active, \"+ Add task\" was creating the new task in a **different** project, making it invisible right away. It now lands in the filtered project automatically.",
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Bereits getrackte Sessions tauchten im Aufgaben-Drawer nicht auf, obwohl die Stunden gezählt waren. Jetzt zeigt jede Aufgabe ihre vollständige Session-Historie.',
          en: 'Sessions you had already tracked were not showing up in the task drawer, even though the hours were counted. Every task now shows its full session history.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Onboarding-Tour startete sich manchmal selbst nochmal. Stoppt jetzt verlässlich nach „Fertig".',
          en: 'Onboarding tour was occasionally restarting itself. Now reliably stays closed once you click "Finish".',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Glass-Look überarbeitet: Sidebar, Wochenboard-Spalten, Command-Palette und Release-Cards sind jetzt deutlich transluzenter. Hover- und Aktiv-Zustände wirken wie sanftes Frosted Glass statt harter Blöcke.',
          en: 'Glass look overhauled: sidebar, week-board columns, command palette and release cards are now noticeably more translucent. Hover and active states feel like soft frosted glass rather than hard blocks.',
        },
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-05-09',
    title: {
      de: 'Kommentare, @-Erwähnungen und Inbox',
      en: 'Comments, @-mentions and inbox',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Kommentare unter jeder Aufgabe und jedem Projekt. Chronologisch, mit Edit- und Lösch-Aktionen für deine eigenen Beiträge. ⌘+Enter zum Senden.',
          en: 'Comments under every task and every project. Chronological, with edit and delete on your own posts. ⌘+Enter to send.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: '@-Erwähnungen direkt im Kommentarfeld: Tippe `@`, wähle die Person aus dem Picker, fertig. Pfeiltasten zum Navigieren, Enter oder Tab fügt ein.',
          en: '@-mentions right in the comment field: type `@`, pick the person from the dropdown, done. Arrow keys to navigate, Enter or Tab to insert.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Neue Inbox-Seite mit allen Mentions an dich. Glocken-Icon im Topbar mit Counter ungelesener Einträge. Klick auf einen Eintrag bringt dich direkt zur jeweiligen Aufgabe oder Projekt.',
          en: 'New inbox page with every mention of you. Bell icon in the topbar with an unread counter. Click an entry to jump straight to the relevant task or project.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Projekt-Detail-Drawer: Klick auf eine Projekt-Card öffnet eine Seitenansicht mit Stats, Aufgabenliste und Kommentaren. „Im Board ansehen" springt wie gewohnt ins gefilterte Wochenboard.',
          en: 'Project detail drawer: clicking a project card opens a side view with stats, task list and comments. "Open in board" still jumps to the filtered week board as before.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Beim Bearbeiten eines Kommentars bekommen nur **neu hinzugefügte** Personen eine Benachrichtigung. Niemand wird zweimal informiert.',
          en: 'When editing a comment, only **newly added** mentions get notified. No one gets notified twice.',
        },
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-08',
    title: {
      de: 'Englisch, Einstellungen, Dark-Mode-Politur',
      en: 'English, settings, dark-mode polish',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'BTM komplett auf Englisch umschaltbar. Profil → Einstellungen → Sprache. Datum und Zahlen passen sich automatisch an.',
          en: 'BTM fully switchable to English. Profile → Settings → Language. Dates and numbers adapt automatically.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Aufgeräumtes Einstellungs-Modal mit klaren Bereichen (Aussehen, Sprache, API-Tokens, Daten). Tastenkürzel **⌘,** öffnet es von überall.',
          en: 'Tidy settings modal with clear sections (Appearance, Language, API tokens, Data). Shortcut **⌘,** opens it from anywhere.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Schlankeres Profil-Menü unten links: User-Card, schneller Theme-Wechsel (Glass/Studio + Hell/Dunkel), Einstellungen, Abmelden. Alles weitere im Einstellungs-Modal.',
          en: 'Slimmer profile menu at the bottom-left: user card, quick theme toggle (Glass/Studio + Light/Dark), Settings, Sign out. Everything else now lives in the settings modal.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Aktivitäts-Sidebar im Admin: neuer Filter, um Aktivitäten nach einzelnen Personen anzuzeigen.',
          en: 'Activity sidebar in admin: new filter to view activity per person.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Login per 6-stelligem Code. Neben dem klassischen Magic-Link bekommst du einen Code in der Mail, den du direkt in der App eingeben kannst. Praktisch wenn die App in einem anderen Browser/PWA als deine Mail läuft.',
          en: 'Login with 6-digit code. Alongside the magic link, the email also contains a code you can paste directly into the app. Handy when the app and your mail are in different browsers/PWAs.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Mobile-Layout für Smartphones: eigener 3-Screen-Modus (Heute, Timer, KI) mit Tab-Bar unten. Keine zusammengequetschte Desktop-Sidebar mehr.',
          en: "Dedicated mobile layout: 3-screen mode (Today, Timer, AI) with a bottom tab bar. No more squished desktop sidebar on phones.",
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Persönliches Privat-Projekt für jeden User. Nur du siehst deine eigenen privaten Aufgaben, niemand sonst.',
          en: 'Personal private project for everyone. Only you see your own private tasks, no one else.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Bevorzugte Wochenboard-Ansicht (Kanban / Liste / Timeline) wird pro Person gemerkt. Die Onboarding-Tour fragt direkt danach.',
          en: 'Preferred week-board view (Kanban / List / Timeline) is remembered per person. The onboarding tour asks for it right away.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Wochenboard zeigt wieder alle 5 Spalten (Backlog · Zu erledigen · In Arbeit · Review · Erledigt) nebeneinander statt „Erledigt" in eine zweite Zeile zu wrappen.',
          en: 'Week board again shows all 5 columns (Backlog · To do · In progress · Review · Done) in one row, no longer wrapping "Done" to a second line.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Dark-Mode systematisch durchpoliert: „Hallo Esref"-Begrüßung, Projekt-Namen, In-Arbeit-Karten, Counter, Stunden-Anzeigen. Alles wieder gut lesbar.',
          en: 'Dark mode systematically polished: "Hello Esref" greeting, project names, in-progress cards, counters, hour displays. Everything readable again.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Stunden-Übersicht: die Σ-Total-Spalte sah im Dark-Mode wie ein invertierter weißer Block aus. Jetzt mit der gleichen Optik wie der Rest.',
          en: 'Time grid: the Σ total column looked like an inverted white block in dark mode. Now matches the rest.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Beim Tippen langer Aufgaben-Beschreibungen ruckelte der Cursor. Jetzt flüssig.',
          en: 'Typing long task descriptions used to feel laggy. Now smooth.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Timeline-Ansicht: Aufgaben ohne Frist landen in einer eigenen „Ohne Frist"-Spalte statt zufällig in irgendeinem Wochentag.',
          en: 'Timeline view: tasks without a deadline now land in their own "No deadline" column instead of being scattered randomly across weekdays.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'BTM auf neue Server-Infrastruktur umgezogen. Spürbar schneller, eigenes SSL-Zertifikat, robuster.',
          en: 'BTM moved to new server infrastructure. Noticeably faster, own SSL certificate, more robust.',
        },
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-05',
    title: {
      de: 'Geführte Tour, lesbarer Dark-Mode',
      en: 'Guided tour, readable dark mode',
    },
    changes: [
      {
        kind: 'feature',
        text: {
          de: 'Geführte Onboarding-Tour beim ersten Login. Zeigt dir Wochenboard, Suche, KI-Assistent und Profil. Jederzeit über Einstellungen → „Tour wiederholen" neu startbar.',
          en: 'Guided onboarding tour on first login. Walks you through the week board, search, AI assistant and profile. Replay any time via Settings → "Replay tour".',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'Diese Release-Seite plus ein kurzes Modal nach dem Login, das dich über neue Features informiert.',
          en: 'This release page plus a short modal after login that briefs you on new features.',
        },
      },
      {
        kind: 'feature',
        text: {
          de: 'KI-Planungsassistent: ausführliche Gedanken-Blöcke sind jetzt eingeklappt. Du siehst sofort die Antwort, kannst aber per Klick auf „Gedanken" reinschauen, wie die KI vorgegangen ist.',
          en: 'AI planning assistant: long reasoning blocks are now collapsed. You see the answer immediately and can click "Thoughts" to peek at how the AI arrived there.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Dark-Mode wieder durchgehend lesbar: Live-Timer, Topbar, Pomodoro-Indikatoren, Suchfeld. Alles mit ordentlichem Kontrast.',
          en: 'Dark mode readable end-to-end again: live timer, topbar, pomodoro indicators, search field. All with proper contrast.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'Login-Mail kam manchmal mit Fehler an. Behoben.',
          en: 'Login email occasionally errored out. Fixed.',
        },
      },
      {
        kind: 'fix',
        text: {
          de: 'KI-Aufgabenextraktion lieferte zeitweise einen Fehler statt eines Vorschlags. Wieder zuverlässig.',
          en: 'AI task extraction occasionally returned an error instead of a suggestion. Reliable again.',
        },
      },
      {
        kind: 'change',
        text: {
          de: 'Theme-Auswahl ist umgezogen. Kein extra Tweak-Widget mehr, sondern direkt im Profil-Menü unten links.',
          en: "Theme selection moved. No separate tweak widget anymore, just directly in the profile menu at the bottom-left.",
        },
      },
    ],
  },
];

// ── Aktuell in Arbeit ──────────────────────────────────────────────────

export const ROADMAP: RoadmapItem[] = [
  {
    title: { de: 'KI legt Aufgaben direkt an', en: 'AI creates tasks for you' },
    description: {
      de: 'Der KI-Planungsassistent kann bald nicht nur Aufgaben aus deinem Briefing extrahieren, sondern sie auch direkt anlegen, verschieben und Timer starten. Ohne dass du sie erst manuell ins Board ziehen musst.',
      en: 'The AI planning assistant will soon not only extract tasks from your briefing but also create them, move them and start timers directly. No manual drag-and-drop into the board needed.',
    },
    eta: {
      de: 'sobald das nächste KI-Modell stabil läuft',
      en: 'as soon as the next AI model runs stably',
    },
  },
  {
    title: { de: 'Anhänge an Aufgaben', en: 'Attachments on tasks' },
    description: {
      de: 'Datei-Upload pro Aufgabe. Screenshots, PDFs, Briefings direkt am Kontext.',
      en: 'File uploads per task. Screenshots, PDFs, briefings right where the context is.',
    },
    eta: { de: 'Platzhalter ist schon im Drawer', en: 'placeholder already in the drawer' },
  },
  {
    title: { de: 'Kalender-Termine aus BTM erstellen', en: 'Create calendar events from BTM' },
    description: {
      de: 'Aktuell ist der Kalender-Sync read-only. Geplant: Termine direkt aus BTM in Odoo/Google anlegen — z.B. „blockiere mir 2h für diese Aufgabe morgen Vormittag".',
      en: 'Calendar sync is currently read-only. Planned: create events directly from BTM into Odoo/Google — e.g. "block 2h for this task tomorrow morning".',
    },
    eta: { de: 'nach dem Stabilisierungs-Sprint', en: 'after the stabilization sprint' },
  },
];

// ── Bekannte Probleme ──────────────────────────────────────────────────

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: {
      de: 'Claude.ai im Browser zeigt „Konnte MCP-Server nicht erreichen"',
      en: 'Claude.ai in the browser shows "Couldn\'t reach the MCP server"',
    },
    description: {
      de: 'Ein bekannter Fehler auf Anthropic-Seite, der die Web-Version von Claude.ai betrifft. Nicht BTM. Unsere Verbindung ist getestet und funktioniert mit den anderen Claude-Clients problemlos.',
      en: 'A known issue on Anthropic\'s side that affects the Claude.ai web version. Not BTM. Our connection is tested and works with the other Claude clients without issues.',
    },
    workaround: {
      de: 'Verwende Claude Desktop (Mac oder Windows) statt der Web-Version. Dort funktioniert die BTM-Anbindung zuverlässig. Setup-Anleitung in Einstellungen → API-Tokens.',
      en: 'Use Claude Desktop (Mac or Windows) instead of the web version. The BTM connection works reliably there. Setup guide in Settings → API tokens.',
    },
    status: 'external',
    reportedAt: '2026-05-04',
  },
  {
    title: {
      de: 'KI-Planungsassistent zeitweise nicht erreichbar',
      en: 'AI planning assistant occasionally unavailable',
    },
    description: {
      de: 'Wir stellen den KI-Planungsassistenten gerade auf ein neues, leistungsfähigeres Modell um. In der Übergangszeit kann es passieren, dass der Assistent kurzzeitig nicht antwortet oder einen Fehler zeigt.',
      en: 'We are switching the AI planning assistant to a new, more capable model. During the transition the assistant may briefly not respond or show an error.',
    },
    workaround: {
      de: 'Einfach nochmal versuchen. Meist ist es nach kurzer Zeit wieder da. In der Zwischenzeit kannst du Aufgaben wie gewohnt manuell anlegen.',
      en: 'Just try again. It usually comes back after a short while. Meanwhile you can keep creating tasks manually as usual.',
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
