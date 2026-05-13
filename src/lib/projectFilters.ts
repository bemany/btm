// Zentrale Filter- und Sortier-Logik für Projekt-Listen.
// Wird überall verwendet wo der User Projekte auswählen oder filtern kann:
//   • TaskDetailDrawer / QuickAdd / QuickStart / AIDrawer — Projekt-Select für Tasks
//   • FilterRow auf dem Wochenboard — Projekt-Chips
//
// Regeln (Feature FDpT3hc49EI):
//   1. Fremde Privatprojekte (privateOwnerId gesetzt + nicht eigener User)
//      werden IMMER komplett ausgeblendet. Sie haben in keiner Picker- oder
//      Filter-UI was zu suchen — eine Aufgabe in jemandes anderes Privat-
//      Projekt zu legen ist Unsinn, auch als Admin.
//   2. Favoriten zuerst (alphabetisch nach Code), dann nicht-Favoriten
//      (alphabetisch nach Code).
//   3. Optional: showOnlyFavorites = true → nicht-Favoriten ausblenden.
//      Wenn aber gar keine Favoriten existieren, wird auf alle gefallen
//      (sonst hätte der User eine leere Liste).
//   4. Optional: includeIds = string[] zwingt das Einschließen bestimmter
//      Projekt-IDs auch wenn sie nicht in den Favoriten sind. Wird vom
//      TaskDetailDrawer genutzt damit das Projekt der aktuellen Task immer
//      sichtbar ist, selbst wenn der User es nicht favorisiert hat.

import type { Project } from '../store/types';

export interface FilterProjectsOpts {
  currentUserId: string | null | undefined;
  showOnlyFavorites?: boolean;
  includeIds?: string[];
}

export interface FilteredProjects {
  /** Favoriten (alphabetisch). */
  favorites: Project[];
  /** Übrige Projekte (alphabetisch). */
  others: Project[];
  /** Alle in der gewünschten Reihenfolge (favorites + others). */
  all: Project[];
  /** Wie viele fremde Privatprojekte rausgefiltert wurden. */
  hiddenForeignPrivateCount: number;
}

export function filterAssignableProjects(
  projects: Project[],
  opts: FilterProjectsOpts,
): FilteredProjects {
  const { currentUserId, showOnlyFavorites = false, includeIds = [] } = opts;
  const include = new Set(includeIds.filter(Boolean));

  // Schritt 1: fremde Privat-Projekte rausfiltern (Schutz unabhängig
  // von Server-Visibility — der schickt Admins eh alles).
  let hiddenForeignPrivateCount = 0;
  const nonForeignPrivate = projects.filter((p) => {
    if (!p.privateOwnerId) return true;
    if (p.privateOwnerId === currentUserId) return true;
    hiddenForeignPrivateCount++;
    return false;
  });

  // Schritt 2: optional auf Favoriten beschränken (mit Fallback wenn keine
  // Favoriten existieren — und mit Force-Include für currentMissing).
  let visible = nonForeignPrivate;
  if (showOnlyFavorites) {
    const onlyFavs = nonForeignPrivate.filter((p) => p.isFavorite || include.has(p.id));
    // Wenn der User noch keine Favoriten hat, würde das eine leere Liste
    // ergeben — dann nehmen wir wieder alle.
    const userHasAnyFavorites = nonForeignPrivate.some((p) => p.isFavorite);
    visible = userHasAnyFavorites ? onlyFavs : nonForeignPrivate;
  }

  // Schritt 3: Sortieren (Favoriten zuerst, dann alphabetisch nach Code).
  const sorted = [...visible].sort((a, b) => {
    const fa = a.isFavorite ? 0 : 1;
    const fb = b.isFavorite ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.code.localeCompare(b.code);
  });

  return {
    favorites: sorted.filter((p) => p.isFavorite),
    others: sorted.filter((p) => !p.isFavorite),
    all: sorted,
    hiddenForeignPrivateCount,
  };
}
