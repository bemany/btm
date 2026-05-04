// In-Memory Pub/Sub für Realtime-Updates.
// Frontend connected sich via SSE und invalidiert TanStack-Queries auf
// jede Notification.
//
// Wir sind ein Single-Process-Setup; bei mehreren Instanzen müsste das
// auf Redis Pub/Sub umziehen.

export type EventTopic =
  | 'tasks'
  | 'projects'
  | 'timer'
  | 'users'
  | 'teams'
  | 'invitations'
  | 'activity';

export interface EventNotification {
  topic: EventTopic;
  ts: number;
  // optional payload — Frontend nutzt das bisher noch nicht, könnten wir
  // später für Optimistic-Patches verwenden
  meta?: Record<string, unknown>;
}

type Listener = (n: EventNotification) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emit(topic: EventTopic, meta?: Record<string, unknown>): void {
  const n: EventNotification = { topic, ts: Date.now(), meta };
  for (const l of listeners) {
    try {
      l(n);
    } catch (e) {
      console.warn('[events] listener failed', e);
    }
  }
}

export function listenerCount(): number {
  return listeners.size;
}
