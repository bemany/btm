import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { AppNotification, FeedbackEntry } from '../../data/api';
import { useStore } from '../../store/store';
import type { AppUser } from '../../store/types';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';

const MY_FEEDBACK_KEY = ['btm', 'my-feedback'] as const;

export function InboxScreen() {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const setUI = useStore((s) => s.setUI);

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: SYNC_KEYS.NOTIFICATIONS,
    queryFn: () => api.listNotifications({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Eigene Feedbacks, um offene Reporter-Abnahmen (FTKnjlXNVlH) als prominente
  // Aktion oben in der Inbox zu zeigen. Die Liste ist schlank (kein Screenshot).
  const { data: myFeedback = [] } = useQuery({
    queryKey: MY_FEEDBACK_KEY,
    queryFn: api.listFeedback,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Offen = von mir eingereicht, als erledigt markiert, aber noch nicht abgenommen.
  const pending = useMemo(
    () =>
      myFeedback.filter(
        (f) =>
          f.submitterId === currentUser &&
          f.status === 'done' &&
          f.reporterConfirmation === null,
      ),
    [myFeedback, currentUser],
  );
  const pendingIds = useMemo(() => new Set(pending.map((f) => f.id)), [pending]);

  // feedback_resolved-Notifications, deren Abnahme noch offen ist, blenden wir
  // aus der normalen Liste aus — sie erscheinen oben als Aktions-Karte. Nach der
  // Abnahme tauchen sie wieder als normale (gelesene) Info auf.
  const visibleNotifs = useMemo(
    () =>
      notifs.filter(
        (n) =>
          !(
            n.kind === 'feedback_resolved' &&
            n.payload.feedbackId &&
            pendingIds.has(n.payload.feedbackId)
          ),
      ),
    [notifs, pendingIds],
  );

  const { unread, read } = useMemo(() => {
    const u: AppNotification[] = [];
    const r: AppNotification[] = [];
    for (const n of visibleNotifs) (n.seenAt ? r : u).push(n);
    return { unread: u, read: r };
  }, [visibleNotifs]);

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

  const hasContent = pending.length > 0 || notifs.length > 0;

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

      {/* Aktion erforderlich: offene Reporter-Abnahmen. Bleibt stehen bis der
          User bestätigt oder ablehnt — nicht durch "als gelesen" wegklickbar. */}
      {pending.length > 0 && (
        <section className="inbox-action-section">
          <div className="inbox-action-head">
            <Icon name="circle-alert" size={14} />
            <span>{t('inbox.action_required', { count: pending.length })}</span>
          </div>
          <div className="inbox-action-list">
            {pending.map((f) => (
              <InboxConfirmCard key={f.id} item={f} />
            ))}
          </div>
        </section>
      )}

      {isLoading && notifs.length === 0 ? (
        <div className="empty-state">
          <Icon name="loader-circle" size={28} className="login-spin" />
          <p>{t('common.loading')}</p>
        </div>
      ) : !hasContent ? (
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

// Abnahme-Karte in der Inbox. "Passt so" akzeptiert sofort, "Noch nicht gelöst"
// klappt ein Begründungsfeld aus und öffnet das Feedback wieder.
function InboxConfirmCard({ item }: { item: FeedbackEntry }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    queryClient.invalidateQueries({ queryKey: ['btm', 'feedback'] });
    queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATIONS });
    queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATION_COUNT });
  };

  const approve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.confirmFeedback(item.id, { approved: true });
      refresh();
      showToast(t('feedback.confirm_thanks'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.confirmFeedback(item.id, { approved: false, note: note.trim() || null });
      refresh();
      showToast(t('feedback.confirm_reopened_toast'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="inbox-confirm-card">
      <div className="inbox-confirm-main">
        <span className={`fb-type-pill type-${item.type}`}>
          <Icon name={item.type === 'bug' ? 'bug' : 'sparkles'} size={11} />
          {t(`feedback.type_${item.type}` as 'feedback.type_bug')}
        </span>
        <span className="inbox-confirm-title">{item.title}</span>
      </div>
      {item.adminNote && (
        <div className="inbox-confirm-resolution">
          <Icon name="circle-check" size={12} />
          <span>
            <strong>{t('feedback.my_resolution_note')}</strong> {item.adminNote}
          </span>
        </div>
      )}
      <div className="inbox-confirm-prompt">{t('feedback.confirm_prompt')}</div>
      {rejecting ? (
        <div className="inbox-confirm-reject">
          <textarea
            className="fb-confirm-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={20_000}
            placeholder={t('feedback.confirm_reject_placeholder')}
            disabled={busy}
            autoFocus
          />
          <div className="inbox-confirm-actions">
            <button
              type="button"
              className="fb-action-btn"
              onClick={() => setRejecting(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="fb-action-btn fb-action-danger"
              onClick={reject}
              disabled={busy}
            >
              <Icon name="rotate-ccw" size={11} /> {t('feedback.confirm_reject_submit')}
            </button>
          </div>
        </div>
      ) : (
        <div className="inbox-confirm-actions">
          <button
            type="button"
            className="fb-action-btn fb-action-primary"
            onClick={approve}
            disabled={busy}
          >
            <Icon name="check" size={11} /> {t('feedback.confirm_approve')}
          </button>
          <button
            type="button"
            className="fb-action-btn"
            onClick={() => setRejecting(true)}
            disabled={busy}
          >
            <Icon name="x" size={11} /> {t('feedback.confirm_reject')}
          </button>
        </div>
      )}
    </article>
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

  const subject = n.payload.subjectTitle ?? n.payload.feedbackTitle ?? '—';
  const text =
    n.kind === 'mention'
      ? t('inbox.mention_text', { actor: actorName, subject })
      : n.kind === 'review_request'
        ? t('inbox.review_request_text', { actor: actorName, subject })
        : n.kind === 'feedback_resolved'
          ? t(
              n.payload.feedbackType === 'bug' ? 'inbox.feedback_bug_resolved_text' : 'inbox.feedback_feature_resolved_text',
              { actor: actorName, subject },
            )
          : n.kind === 'feedback_reopened'
            ? t('inbox.feedback_reopened_text', { actor: n.payload.reporterName ?? actorName, subject })
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
        {(n.payload.excerpt || n.payload.rejectionNote) && (
          <div className="inbox-item-excerpt">{n.payload.excerpt ?? n.payload.rejectionNote}</div>
        )}
      </div>
      <div className="inbox-item-time">{fmtRel(n.createdAt)}</div>
    </button>
  );
}
