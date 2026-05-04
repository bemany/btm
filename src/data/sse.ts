// SSE-Live-Updates: bei jedem 'change'-Event invalidieren wir die passende
// TanStack-Query. Polling der useServerSync läuft weiter als Fallback (15-60 s).
//
// EventSource sendet automatisch Cookies bei selber Origin — perfekt für unsere
// Cookie-Session. Bei Bearer-Auth (TV-Route) springen wir nicht in SSE rein,
// da EventSource keine Headers unterstützt — das fällt aufs Polling zurück.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SYNC_KEYS } from './sync';

type Topic = 'tasks' | 'projects' | 'timer' | 'users' | 'teams' | 'invitations' | 'activity';

interface ChangeEvent {
  topic: Topic;
  ts: number;
  meta?: Record<string, unknown>;
}

const TOPIC_TO_KEY: Record<Topic, readonly string[]> = {
  tasks: SYNC_KEYS.TASKS,
  projects: SYNC_KEYS.PROJECTS,
  timer: SYNC_KEYS.TIMER,
  users: SYNC_KEYS.USERS,
  teams: SYNC_KEYS.TEAMS,
  invitations: SYNC_KEYS.INVITATIONS,
  activity: ['btm', 'activity'],
};

export function useEventStream(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let backoff = 1000;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource('/api/events', { withCredentials: true });

      es.addEventListener('hello', () => {
        backoff = 1000; // Reset bei erfolgreichem Connect
      });

      es.addEventListener('change', (msg) => {
        try {
          const ev = JSON.parse((msg as MessageEvent).data) as ChangeEvent;
          const key = TOPIC_TO_KEY[ev.topic];
          if (key) queryClient.invalidateQueries({ queryKey: key });
        } catch {
          /* ignore */
        }
      });

      es.addEventListener('heartbeat', () => {
        // Keep-alive, nichts tun
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        // Reconnect mit Backoff
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [enabled, queryClient]);
}
