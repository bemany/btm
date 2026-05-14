// Berechtigungs-Helper rund um Tasks (FwQQWBHfTid follow-up + F0vR8mfjrwv).
//
// Regel für „Auf Erledigt setzen":
//   • Projekt-Owner → darf (immer)
//   • Admin → darf, wird aber per Confirm gewarnt wenn Owner != admin selbst
//   • Sonst → blockiert mit Toast
//
// Vorher gab's die `canMarkDone`-Logik zweimal in BoardKanban + Task-
// DetailDrawer kopiert; dadurch wurden sowohl admin- als auch
// non-admin-Verstöße verschieden behandelt. Helper zentralisiert das.

import type { Project, Task } from '../store/types';

export interface MarkDoneContext {
  task: Task;
  projects: Project[];
  currentUserId: string;
  meIsAdmin: boolean;
}

export type MarkDonePermission =
  /** Normaler Move, kein Confirm nötig. */
  | { kind: 'allow' }
  /** Admin ist nicht Owner → confirm-Dialog vorschalten. */
  | { kind: 'admin_override'; ownerName: string | null }
  /** Non-Admin nicht-Owner → blockieren. */
  | { kind: 'blocked' };

export function checkMarkDone(
  ctx: MarkDoneContext,
  resolveOwnerName: (ownerId: string) => string | null = () => null,
): MarkDonePermission {
  const proj = ctx.projects.find((p) => p.id === ctx.task.proj);
  // Projekt ohne Owner → free-for-all (Legacy-Verhalten, Projekte vor 2026-04
  // hatten oft keinen Owner zugewiesen). Admin oder nicht spielt keine Rolle.
  if (!proj?.ownerId) return { kind: 'allow' };
  if (proj.ownerId === ctx.currentUserId) return { kind: 'allow' };
  if (ctx.meIsAdmin) {
    return { kind: 'admin_override', ownerName: resolveOwnerName(proj.ownerId) };
  }
  return { kind: 'blocked' };
}
