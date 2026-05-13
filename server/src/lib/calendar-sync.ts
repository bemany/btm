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

import { and, eq, gte, inArray, lt, isNotNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { users, calendarEvents, icalFeeds, type User, type IcalFeed } from '../db/schema.js';
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
import { fetchIcalEvents, IcalError } from './ical-client.js';

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

  // Schritt C: Existierende Odoo-Events im Window holen (für Diff-Delete).
  // WICHTIG: nur source='odoo' — iCal-Events haben eigenen Sync.
  const existing = await db
    .select({ id: calendarEvents.id, externalId: calendarEvents.externalId })
    .from(calendarEvents)
    .where(and(
      eq(calendarEvents.userId, user.id),
      eq(calendarEvents.source, 'odoo'),
      gte(calendarEvents.startAt, win.fromDate),
      lt(calendarEvents.startAt, win.toDate),
    ));
  const existingByExtId = new Map(existing.map((e) => [e.externalId, e.id]));
  const seenIds = new Set<string>();

  // Schritt D: Upsert. Conflict-Target ist der neue Unique-Index
  // (userId, source, external_id).
  let synced = 0;
  for (const ev of events) {
    const externalIdStr = String(ev.id);
    seenIds.add(externalIdStr);
    const existingId = existingByExtId.get(externalIdStr);
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
        source: 'odoo',
        externalId: externalIdStr,
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
        target: [calendarEvents.userId, calendarEvents.source, calendarEvents.externalId],
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

  // Schritt E: Verwaiste Odoo-Events löschen
  const orphanIds: string[] = [];
  for (const e of existing) {
    if (!seenIds.has(e.externalId)) orphanIds.push(e.id);
  }
  let deleted = 0;
  if (orphanIds.length > 0) {
    await db.delete(calendarEvents).where(inArray(calendarEvents.id, orphanIds));
    deleted = orphanIds.length;
  }

  return { synced, deleted };
}

/**
 * Syncs einen einzelnen iCal-Feed: holt URL → expandiert Events ins
 * Window → upsert in calendar_events mit source='ical' und icalFeedId.
 */
export async function syncIcalFeed(feed: IcalFeed): Promise<{ synced: number; deleted: number }> {
  const win = syncWindow();
  const events = await fetchIcalEvents(feed.url, win.fromDate, win.toDate);

  // Existierende Events dieses Feeds im Window holen (Diff-Delete)
  const existing = await db
    .select({ id: calendarEvents.id, externalId: calendarEvents.externalId })
    .from(calendarEvents)
    .where(and(
      eq(calendarEvents.userId, feed.userId),
      eq(calendarEvents.source, 'ical'),
      eq(calendarEvents.icalFeedId, feed.id),
      gte(calendarEvents.startAt, win.fromDate),
      lt(calendarEvents.startAt, win.toDate),
    ));
  const existingByExtId = new Map(existing.map((e) => [e.externalId, e.id]));
  const seen = new Set<string>();

  let synced = 0;
  for (const ev of events) {
    seen.add(ev.uid);
    const existingId = existingByExtId.get(ev.uid);
    const newId = existingId ?? `CE${nanoid(10)}`;
    await db
      .insert(calendarEvents)
      .values({
        id: newId,
        userId: feed.userId,
        source: 'ical',
        icalFeedId: feed.id,
        externalId: ev.uid,
        title: ev.title,
        location: ev.location,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay,
        attendeeCount: ev.attendeeCount,
        organizerName: ev.organizerName,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calendarEvents.userId, calendarEvents.source, calendarEvents.externalId],
        set: {
          title: ev.title,
          location: ev.location,
          startAt: ev.startAt,
          endAt: ev.endAt,
          allDay: ev.allDay,
          attendeeCount: ev.attendeeCount,
          organizerName: ev.organizerName,
          icalFeedId: feed.id,
          syncedAt: new Date(),
        },
      });
    synced++;
  }

  // Verwaiste Events löschen
  const orphanIds: string[] = [];
  for (const e of existing) {
    if (!seen.has(e.externalId)) orphanIds.push(e.id);
  }
  let deleted = 0;
  if (orphanIds.length > 0) {
    await db.delete(calendarEvents).where(inArray(calendarEvents.id, orphanIds));
    deleted = orphanIds.length;
  }

  return { synced, deleted };
}

export async function runCalendarSyncTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    // --- Teil 1: Odoo-Sync ---
    const odooCandidates = await db
      .select()
      .from(users)
      .where(and(
        eq(users.odooSyncEnabled, true),
        eq(users.status, 'active'),
        isNotNull(users.odooUrl),
        isNotNull(users.odooApiKeyEnc),
      ));

    for (const u of odooCandidates) {
      try {
        const result = await syncUserCalendar(u);
        await db
          .update(users)
          .set({ odooLastSyncAt: new Date(), odooLastSyncError: null })
          .where(eq(users.id, u.id));
        console.log(
          `[calendar-sync] odoo user=${u.id} synced=${result.synced} deleted=${result.deleted}`,
        );
      } catch (e) {
        const code = e instanceof OdooError ? e.code : 'network';
        await db
          .update(users)
          .set({ odooLastSyncAt: new Date(), odooLastSyncError: code })
          .where(eq(users.id, u.id));
        console.warn(`[calendar-sync] odoo user=${u.id} error=${code}:`, (e as Error).message);
      }
    }

    // --- Teil 2: iCal-Feeds ---
    const feedsToSync = await db
      .select()
      .from(icalFeeds)
      .where(eq(icalFeeds.syncEnabled, true));

    for (const feed of feedsToSync) {
      try {
        const result = await syncIcalFeed(feed);
        await db
          .update(icalFeeds)
          .set({ lastSyncAt: new Date(), lastSyncError: null })
          .where(eq(icalFeeds.id, feed.id));
        console.log(
          `[calendar-sync] ical feed=${feed.id} user=${feed.userId} synced=${result.synced} deleted=${result.deleted}`,
        );
      } catch (e) {
        const code = e instanceof IcalError ? e.code : 'unknown';
        await db
          .update(icalFeeds)
          .set({ lastSyncAt: new Date(), lastSyncError: code })
          .where(eq(icalFeeds.id, feed.id));
        console.warn(`[calendar-sync] ical feed=${feed.id} error=${code}:`, (e as Error).message);
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
