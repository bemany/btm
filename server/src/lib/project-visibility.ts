// Helper: liefert die IDs aller Projekte, die der User sehen darf.
//
// Sichtbarkeitsregeln:
//   1. Admin: alle Projekte
//   2. Privat-Projekte (`privateOwnerId IS NOT NULL`): nur der Owner
//   3. Projekte mit Mitgliedern: nur Mitglieder + Owner (`projects.ownerId`)
//   4. Projekte OHNE Mitglieder: alle aktiven User (Backwards-Compat,
//      damit alte Projekte nicht plötzlich verschwinden)
//
// Nutzt der Aufrufer das Ergebnis als Allowlist (Tasks-Listing,
// Projekt-Listing). Privatprojekte vom anderen User sind ausgeschlossen.

import { and, eq, isNull, isNotNull, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, projectMembers } from '../db/schema.js';

export interface VisibleProjectsResult {
  /** Sichtbare Projekt-IDs */
  ids: string[];
  /** Wenn true, gibt es noch ein Universum von Projekten (Member-leer) */
  isAdmin: boolean;
}

export async function listVisibleProjectIds(
  userId: string,
  role: 'admin' | 'member',
): Promise<VisibleProjectsResult> {
  if (role === 'admin') {
    const rows = await db.select({ id: projects.id }).from(projects);
    return { ids: rows.map((r) => r.id), isAdmin: true };
  }

  // Sichtbare normale Projekte:
  //   (a) Eigene Privatprojekte
  //   (b) Owner-Projekte (projects.ownerId = me)
  //   (c) Member-Projekte (project_members.userId = me)
  //   (d) „Legacy"-Projekte ohne Members + ohne privateOwnerId
  //
  // Wir holen alle nicht-privaten Projekte plus Member-Counts und
  // filtern in JS — das ist mit den DB-Größen hier ein No-Brainer und
  // einfacher als ein verschachtelter SQL-Subquery.

  const myMemberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const memberOf = new Set(myMemberships.map((m) => m.projectId));

  // Member-Counts pro Projekt — Projekte ohne Mitglieder sind weiterhin
  // für alle sichtbar (Backwards-Compat). Wir nutzen eine GROUP BY.
  const counts = await db
    .select({
      projectId: projectMembers.projectId,
      cnt: sql<number>`count(*)::int`.as('cnt'),
    })
    .from(projectMembers)
    .groupBy(projectMembers.projectId);
  const memberCount = new Map<string, number>();
  for (const r of counts) memberCount.set(r.projectId, Number(r.cnt));

  const allProjects = await db
    .select({
      id: projects.id,
      privateOwnerId: projects.privateOwnerId,
      ownerId: projects.ownerId,
    })
    .from(projects)
    .where(or(isNull(projects.privateOwnerId), eq(projects.privateOwnerId, userId)))
    .orderBy(projects.code);

  const visible: string[] = [];
  for (const p of allProjects) {
    // (a) eigene Privatprojekte: privateOwnerId === me oder NULL bei normalen
    if (p.privateOwnerId && p.privateOwnerId !== userId) continue; // doppelte Sicherheit

    if (p.privateOwnerId === userId) {
      visible.push(p.id);
      continue;
    }
    // Normales Projekt
    if (p.ownerId === userId) {
      visible.push(p.id);
      continue;
    }
    if (memberOf.has(p.id)) {
      visible.push(p.id);
      continue;
    }
    if (!memberCount.has(p.id)) {
      // Legacy: keine Members → für alle sichtbar
      visible.push(p.id);
      continue;
    }
    // Hat Members, aber ich bin keiner → unsichtbar
  }

  return { ids: visible, isAdmin: false };
}

void and;
void inArray;
void isNotNull;
