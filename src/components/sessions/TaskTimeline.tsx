// Task-Timeline — vereint Kommentare und Activity-Log in einer
// chronologischen Liste pro Task.
//
// Quellen:
//   • Comments: `GET /api/comments?subjectType=task&subjectId=...`
//   • Activity: `GET /api/activity?target=...` (taskId == target im Activity-Log)
//
// Beide werden parallel geladen, gemerget, ascending sortiert, und als
// Items in einer Timeline mit verbindender Linie gerendert. Kommentare
// dürfen editiert/gelöscht werden (übers existierende `CommentItem`),
// Activities sind read-only.
//
// Ein eingebauter `CommentComposer` am Ende erlaubt das direkte Posten
// neuer Kommentare ohne separate „Kommentare"-Section.

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { AppComment, ActivityEntry } from '../../data/api';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { useT, useLocale } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';
import { CommentItem } from '../comments/CommentItem';
import { CommentComposer } from '../comments/CommentComposer';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';

export interface TaskTimelineProps {
  taskId: string;
}

interface TimelineItem {
  ts: number;
  kind: 'comment' | 'activity';
  comment?: AppComment;
  activity?: ActivityEntry;
}

const ACTIVITY_ICON: Record<string, string> = {
  task_created: 'plus-circle',
  task_updated: 'edit-3',
  task_moved: 'move',
  task_done: 'check-circle-2',
  timer_started: 'play-circle',
  timer_stopped: 'square',
  comment_created: 'message-square',
  comment_updated: 'message-square',
  comment_deleted: 'message-square-x',
};

function fmtRel(iso: string, locale: 'de' | 'en'): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return locale === 'en' ? 'just now' : 'gerade eben';
  if (min < 60) return locale === 'en' ? `${min}m ago` : `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return locale === 'en' ? `${h}h ago` : `vor ${h} Std`;
  const d = Math.floor(h / 24);
  if (d < 14) return locale === 'en' ? `${d}d ago` : `vor ${d} Tg`;
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE');
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const t = useT();
  const [locale] = useLocale();
  const users = useStore((s) => s.users);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const commentsQ = useQuery({
    queryKey: [...SYNC_KEYS.COMMENTS, 'task', taskId],
    queryFn: () => api.listComments('task', taskId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const activityQ = useQuery({
    queryKey: ['btm', 'activity', 'task', taskId],
    queryFn: () => api.listActivity({ target: taskId, limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const items = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (const c of commentsQ.data ?? []) {
      out.push({ ts: new Date(c.createdAt).getTime(), kind: 'comment', comment: c });
    }
    for (const a of activityQ.data ?? []) {
      // Comment-Activities werden über die Comments selbst gerendert — den
      // doppelten Eintrag im Activity-Stream filtern wir raus.
      if (a.kind === 'comment_created' || a.kind === 'comment_updated' || a.kind === 'comment_deleted') {
        continue;
      }
      out.push({ ts: new Date(a.createdAt).getTime(), kind: 'activity', activity: a });
    }
    return out.sort((x, y) => x.ts - y.ts);
  }, [commentsQ.data, activityQ.data]);

  const renderActivityText = (a: ActivityEntry): string => {
    const meta = a.meta ?? {};
    switch (a.kind) {
      case 'task_created':
        return t('timeline.act_task_created');
      case 'task_updated':
        return t('timeline.act_task_updated');
      case 'task_moved': {
        const to = (meta as Record<string, unknown>).to as string | undefined;
        if (to) {
          const colKey = `column.${to}` as 'column.todo';
          return t('timeline.act_task_moved', { col: t(colKey) });
        }
        return t('timeline.act_task_moved_simple');
      }
      case 'task_done':
        return t('timeline.act_task_done');
      case 'timer_started':
        return t('timeline.act_timer_started');
      case 'timer_stopped': {
        const hours = (meta as Record<string, unknown>).hours as number | undefined;
        if (typeof hours === 'number') {
          return t('timeline.act_timer_stopped_with_h', {
            h: hours.toFixed(2).replace('.', locale === 'en' ? '.' : ','),
          });
        }
        return t('timeline.act_timer_stopped');
      }
      default:
        return a.kind;
    }
  };

  const isLoading = commentsQ.isLoading || activityQ.isLoading;
  const isEmpty = items.length === 0;

  const onCommentChanged = () => {
    queryClient.invalidateQueries({ queryKey: [...SYNC_KEYS.COMMENTS, 'task', taskId] });
    queryClient.invalidateQueries({ queryKey: ['btm', 'activity', 'task', taskId] });
  };

  return (
    <div className="tl-section">
      <div className="eyebrow tl-section-head">
        {t('timeline.heading', { count: items.length })}
      </div>

      <div className="tl-list">
        {isLoading && isEmpty && <div className="tl-empty">{t('common.loading')}</div>}
        {!isLoading && isEmpty && <div className="tl-empty">{t('timeline.empty')}</div>}

        {items.map((item) => {
          if (item.kind === 'comment' && item.comment) {
            return (
              <div key={`c-${item.comment.id}`} className="tl-item tl-item-comment">
                <div className="tl-marker">
                  <Avatar id={item.comment.authorId} size={26} />
                  <div className="tl-line" />
                </div>
                <div className="tl-body">
                  <CommentItem
                    comment={item.comment}
                    users={users}
                    currentUserId={user?.id ?? null}
                    isAdmin={isAdmin}
                  />
                </div>
              </div>
            );
          }
          if (item.kind === 'activity' && item.activity) {
            const a = item.activity;
            const actor = users.find((u) => u.id === a.actorId);
            const changes =
              a.kind === 'task_updated' && a.meta && typeof a.meta === 'object'
                ? ((a.meta as Record<string, unknown>).changes as
                    | Record<string, { from: string; to: string }>
                    | undefined)
                : undefined;
            const hasDiff = !!changes && Object.keys(changes).length > 0;
            return (
              <div key={`a-${a.id}`} className="tl-item tl-item-activity">
                <div className="tl-marker">
                  <span className="tl-act-dot">
                    <Icon name={ACTIVITY_ICON[a.kind] ?? 'circle'} size={11} />
                  </span>
                  <div className="tl-line" />
                </div>
                <div className="tl-act-text">
                  <strong>{actor?.name ?? t('timeline.system_actor')}</strong>{' '}
                  {renderActivityText(a)}
                  {hasDiff && (
                    <span className="tl-act-diff" tabIndex={0}>
                      <Icon name="info" size={11} />
                      <span className="tl-act-diff-pop" role="tooltip">
                        <div className="tl-act-diff-head">
                          {t('timeline.diff_heading')}
                        </div>
                        {Object.entries(changes!).map(([field, val]) => (
                          <div key={field} className="tl-act-diff-row">
                            <div className="tl-act-diff-field">
                              {t(`timeline.diff_field_${field}` as 'timeline.diff_field_title')}
                            </div>
                            <div className="tl-act-diff-values">
                              <span className="tl-act-diff-from">{val.from || '∅'}</span>
                              <Icon name="arrow-right" size={10} />
                              <span className="tl-act-diff-to">{val.to || '∅'}</span>
                            </div>
                          </div>
                        ))}
                      </span>
                    </span>
                  )}
                  <span className="tl-act-time">· {fmtRel(a.createdAt, locale)}</span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      <CommentComposer
        subjectType="task"
        subjectId={taskId}
        users={users}
        currentUserId={user?.id ?? null}
        onPosted={onCommentChanged}
      />
    </div>
  );
}
