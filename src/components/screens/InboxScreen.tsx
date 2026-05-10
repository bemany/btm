import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { AppNotification } from '../../data/api';
import { useStore } from '../../store/store';
import type { AppUser } from '../../store/types';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';

export function InboxScreen() {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: SYNC_KEYS.NOTIFICATIONS,
    queryFn: () => api.listNotifications({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { unread, read } = useMemo(() => {
    const u: AppNotification[] = [];
    const r: AppNotification[] = [];
    for (const n of notifs) (n.seenAt ? r : u).push(n);
    return { unread: u, read: r };
  }, [notifs]);

  const fmtRel = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return locale === 'en' ? 'just now' : 'gerade eben';
    if (min < 60) return locale === 'en' ? `${min}m ago` : `vor ${min} Min`;
    const h = Math.floor(min / 60);
    if (h < 24) return locale === 'en' ? `${h}h ago` : `vor ${h} Std`;
    const d = Math.floor(h / 24);
    if (d < 7) return locale === 'en' ? `${d}d ago` : `vor ${d} Tg`;
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE');
  };

  const open = async (n: AppNotification) => {
    if (!n.seenAt) {
      // optimistic — entferne aus dem cache
      queryClient.setQueryData<AppNotification[]>(SYNC_KEYS.NOTIFICATIONS, (old) =>
        (old ?? []).map((x) => (x.id === n.id ? { ...x, seenAt: new Date().toISOString() } : x)),
      );
      try {
        await api.markNotificationRead(n.id);
        queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATION_COUNT });
      } catch {
        // rollback
        queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATIONS });
      }
    }
    if ((n.kind === 'mention' || n.kind === 'review_request') && n.payload.subjectType && n.payload.subjectId) {
      if (n.payload.subjectType === 'task') {
        setUI({ taskDetailId: n.payload.subjectId });
      } else {
        setUI({ projectDetailId: n.payload.subjectId });
      }
    }
  };

  const markAll = async () => {
    queryClient.setQueryData<AppNotification[]>(SYNC_KEYS.NOTIFICATIONS, (old) => {
      const now = new Date().toISOString();
      return (old ?? []).map((x) => (x.seenAt ? x : { ...x, seenAt: now }));
    });
    try {
      await api.markAllNotificationsRead();
      queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATION_COUNT });
      showToast(t('inbox.all_read_toast'));
    } catch {
      queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATIONS });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('inbox.eyebrow')}</div>
          <h1>{t('inbox.title')}</h1>
          <div className="subtitle">
            {unread.length > 0
              ? t('inbox.unread_count', { count: unread.length })
              : t('inbox.all_caught_up')}
          </div>
        </div>
        <div className="right">
          {unread.length > 0 && (
            <button className="tb-btn" onClick={markAll}>
              <Icon name="check-check" size={13} /> {t('inbox.mark_all_read')}
            </button>
          )}
        </div>
      </div>

      {isLoading && notifs.length === 0 ? (
        <div className="empty-state">
          <Icon name="loader-2" size={28} className="login-spin" />
          <p>{t('common.loading')}</p>
        </div>
      ) : notifs.length === 0 ? (
        <div className="empty-state">
          <Icon name="inbox" size={36} className="icon" />
          <h4>{t('inbox.empty_title')}</h4>
          <p>{t('inbox.empty_body')}</p>
        </div>
      ) : (
        <div className="inbox-list">
          {unread.map((n) => (
            <NotifItem key={n.id} n={n} users={users} onOpen={open} fmtRel={fmtRel} unread />
          ))}
          {read.length > 0 && (
            <details className="inbox-read-section">
              <summary className="eyebrow">
                {t('inbox.read_section_title', { count: read.length })}
              </summary>
              <div className="inbox-list inbox-list-read">
                {read.map((n) => (
                  <NotifItem key={n.id} n={n} users={users} onOpen={open} fmtRel={fmtRel} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

interface NotifItemProps {
  n: AppNotification;
  users: AppUser[];
  onOpen: (n: AppNotification) => void;
  fmtRel: (iso: string) => string;
  unread?: boolean;
}

function NotifItem({ n, users, onOpen, fmtRel, unread }: NotifItemProps) {
  const t = useT();
  const actor = users.find((u) => u.id === n.actorId);
  const actorName = actor?.name ?? t('inbox.unknown_actor');

  const subject = n.payload.subjectTitle ?? '—';
  const text =
    n.kind === 'mention'
      ? t('inbox.mention_text', { actor: actorName, subject })
      : n.kind === 'review_request'
        ? t('inbox.review_request_text', { actor: actorName, subject })
        : `${actorName} · ${n.kind}`;

  return (
    <button
      type="button"
      className={`inbox-item ${unread ? 'is-unread' : ''}`}
      onClick={() => onOpen(n)}
    >
      <Avatar id={n.actorId ?? '__none__'} size={32} />
      <div className="inbox-item-body">
        <div className="inbox-item-text">
          {unread && <span className="inbox-dot" />}
          {text}
        </div>
        {n.payload.excerpt && <div className="inbox-item-excerpt">{n.payload.excerpt}</div>}
      </div>
      <div className="inbox-item-time">{fmtRel(n.createdAt)}</div>
    </button>
  );
}
