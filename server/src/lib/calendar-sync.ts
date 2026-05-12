// Odoo-Calendar-Sync — Scheduler-Tick alle 5 Min.
//
// Pro User mit `odoo_sync_enabled = true`:
//   1. Falls odooUid / odooPartnerId null: authenticate + readUserInfo → cache.
//   2. search_read calendar.event mit partner_ids-Filter im Window
//      [today 00:00 UTC, +7 days).
//   3. Upsert in calendar_events (PK: id; UNIQUE userId+odooEventId).
//   4. Lösche „verwaiste" Events (User-eigene Events im Window aber nicht
//      in der frischen Liste — Termin wurde in Odoo gelöscht/verschoben).
//   5. odoo_last_sync_at = now, odoo_last_sync_error = null (oder bei
//      Fehler: error-code-String).
//
// Fehler eines Users blockt die Iteration NICHT. Loop läuft für alle.

import { and, eq, gte, inArray, lt, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { users, calendarEvents, type User } from '../db/schema.js';
import { decryptSecret } from './secrets.js';
import {
  authenticate,
  readUserInfo,
  searchReadEvents,
  toOdooDateTime,
  fromOdooDateTime,
  OdooError,
  type OdooCreds,
} from './odoo-client.js';

const SYNC_WINDOW_DAYS = 7;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 min

let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;

function syncWindow(): { fromIso: string; toIso: string; fromDate: Date; toDate: Date } {
  // Window-Start = heute 00:00 lokal (UTC-formatiert für Odoo)
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + SYNC_WINDOW_DAYS);
  return {
    fromIso: toOdooDateTime(fromDate),
    toIso: toOdooDateTime(toDate),
    fromDate,
    toDate,
  };
}

function credsFromUser(u: User): OdooCreds | null {
  if (!u.odooUrl || !u.odooDatabase || !u.odooUsername || !u.odooApiKeyEnc || !u.odooApiKeyIv) {
    return null;
  }
  let apiKey: string;
  try {
    apiKey = decryptSecret(u.odooApiKeyEnc, u.odooApiKeyIv);
  } catch (e) {
    throw new OdooError('auth_failed', `Decrypt failed: ${(e as Error).message}`);
  }
  return { url: u.odooUrl, database: u.odooDatabase, username: u.odooUsername, apiKey };
}

export async function syncUserCalendar(user: User): Promise<{ synced: number; deleted: number }> {
  const creds = credsFromUser(user);
  if (!creds) throw new OdooError('auth_failed', 'Odoo-Credentials unvollständig');

  // Schritt A: UID + Partner-ID resolven (gecacht in users-Tabelle)
  let uid = user.odooUid;
  let partnerId = user.odooPartnerId;
  if (!uid || !partnerId) {
    uid = await authenticate(creds);
    const info = await readUserInfo(creds, uid);
    partnerId = info.partnerId;
    await db
      .update(users)
      .set({ odooUid: uid, odooPartnerId: partnerId })
      .where(eq(users.id, user.id));
  }

  // Schritt B: Events aus Odoo holen
  const win = syncWindow();
  const events = await searchReadEvents(creds, uid, partnerId, win.fromIso, win.toIso);

  // Schritt C: Existierende DB-IDs im Window holen (für Diff-Delete)
  const existing = await db
    .select({ id: calendarEvents.id, odooEventId: calendarEvents.odooEventId })
    .from(calendarEvents)
    .where(and(
      eq(calendarEvents.userId, user.id),
      gte(calendarEvents.startAt, win.fromDate),
      lt(calendarEvents.startAt, win.toDate),
    ));
  const existingByOdooId = new Map(existing.map((e) => [e.odooEventId, e.id]));
  const seenOdooIds = new Set<string>();

  // Schritt D: Upsert. Wir nutzen INSERT … ON CONFLICT, dafür muss der
  // Conflict-Target auf dem Unique-Index (userId, odooEventId) liegen.
  let synced = 0;
  for (const ev of events) {
    const odooEventIdStr = String(ev.id);
    seenOdooIds.add(odooEventIdStr);
    const existingId = existingByOdooId.get(odooEventIdStr);
    const newId = existingId ?? `CE${nanoid(10)}`;
    const startAt = fromOdooDateTime(ev.start);
    const endAt = fromOdooDateTime(ev.stop);
    const location = typeof ev.location === 'string' ? ev.location : null;
    const organizerName = Array.isArray(ev.user_id) ? ev.user_id[1] : null;
    const attendeeCount = Array.isArray(ev.attendee_ids) ? ev.attendee_ids.length : 0;
    await db
      .insert(calendarEvents)
      .values({
        id: newId,
        userId: user.id,
        odooEventId: odooEventIdStr,
        title: ev.name,
        location,
        startAt,
        endAt,
        allDay: !!ev.allday,
        attendeeCount,
        organizerName,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calendarEvents.userId, calendarEvents.odooEventId],
        set: {
          title: ev.name,
          location,
          startAt,
          endAt,
          allDay: !!ev.allday,
          attendeeCount,
          organizerName,
          syncedAt: new Date(),
        },
      });
    synced++;
  }

  // Schritt E: Verwaiste Events löschen (existierten im DB-Cache, sind aber
  // nicht mehr in der frischen Odoo-Antwort → in Odoo gelöscht/verschoben).
  const orphanIds: string[] = [];
  for (const e of existing) {
    if (!seenOdooIds.has(e.odooEventId)) orphanIds.push(e.id);
  }
  let deleted = 0;
  if (orphanIds.length > 0) {
    const res = await db.delete(calendarEvents).where(inArray(calendarEvents.id, orphanIds));
    deleted = orphanIds.length;
    void res;
  }

  return { synced, deleted };
}

export async function runCalendarSyncTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const candidates = await db
      .select()
      .from(users)
      .where(and(
        eq(users.odooSyncEnabled, true),
        eq(users.status, 'active'),
        isNotNull(users.odooUrl),
        isNotNull(users.odooApiKeyEnc),
      ));
    if (candidates.length === 0) return;

    for (const u of candidates) {
      try {
        const result = await syncUserCalendar(u);
        await db
          .update(users)
          .set({ odooLastSyncAt: new Date(), odooLastSyncError: null })
          .where(eq(users.id, u.id));
        console.log(
          `[calendar-sync] user=${u.id} synced=${result.synced} deleted=${result.deleted}`,
        );
      } catch (e) {
        const code = e instanceof OdooError ? e.code : 'network';
        await db
          .update(users)
          .set({ odooLastSyncAt: new Date(), odooLastSyncError: code })
          .where(eq(users.id, u.id));
        console.warn(`[calendar-sync] user=${u.id} error=${code}:`, (e as Error).message);
      }
    }
  } finally {
    isRunning = false;
  }
}

export function startCalendarSyncScheduler(): void {
  if (process.env.SKIP_CALENDAR_SYNC === '1') {
    console.log('[calendar-sync] scheduler disabled via SKIP_CALENDAR_SYNC=1');
    return;
  }
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    void runCalendarSyncTick();
  }, SCHEDULER_INTERVAL_MS);
  // Initial-Run kurz nach Start (catch-up nach Restart)
  setTimeout(() => void runCalendarSyncTick(), 8_000);
  console.log('[calendar-sync] scheduler started (5min interval)');
}
