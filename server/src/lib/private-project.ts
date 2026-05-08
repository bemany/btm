// Erzeugt für einen User ein privates Default-Projekt „Privat <Name>"
// (idempotent — wenn schon vorhanden, no-op). Wird aufgerufen
//   • aus dem Better-Auth user.create-Hook (neue Logins)
//   • aus dem POST /invitations Endpoint (frisch eingeladene User)
//   • aus dem /me-Endpoint als Selbstheilung (für Bestand-User die noch
//     keins haben)

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { projects } from '../db/schema.js';

const PALETTE = ['#6B6359', '#5573A0', '#5E7F4E', '#C85A2C', '#8C6F2D', '#A85A95', '#4A8580'];

export async function ensurePrivateProject(userId: string, userName: string): Promise<void> {
  // Existiert bereits?
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.privateOwnerId, userId))
    .limit(1);
  if (existing) return;

  const id = `P${nanoid(8)}`;
  // Code aus den ersten 2 Buchstaben des Vornamens — z. B. „PR-ES" für Esref.
  const initials = (userName || 'XX').slice(0, 2).toUpperCase();
  const color = PALETTE[Math.abs(hashString(userId)) % PALETTE.length];
  await db.insert(projects).values({
    id,
    code: `PR-${initials}`,
    name: `Privat ${userName || ''}`.trim(),
    color,
    createdById: userId,
    privateOwnerId: userId,
  });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
