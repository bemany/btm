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
    title: { de: 'Live-Updates ohne Refresh', en: 'Live updates without refresh' },
    description: {
      de: 'Wenn jemand eine Aufgabe verschiebt, einen Kommentar schreibt oder einen Timer stoppt, siehst du es sofort. Ohne dass du die Seite neu laden musst.',
      en: 'When someone moves a task, posts a comment or stops a timer, you see it instantly. No need to refresh.',
    },
    eta: {
      de: 'in Arbeit, kommt in den nächsten Releases',
      en: 'in progress, shipping in the next releases',
    },
  },
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
