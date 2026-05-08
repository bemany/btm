import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppComment } from '../../data/api';
import * as api from '../../data/api';
import type { AppUser } from '../../store/types';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';
import { RenderMentions } from './renderMentions';
import { MentionTextarea } from './MentionTextarea';

export interface CommentItemProps {
  comment: AppComment;
  users: AppUser[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function CommentItem({ comment, users, currentUserId, isAdmin }: CommentItemProps) {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const author = users.find((u) => u.id === comment.authorId);
  const isAuthor = comment.authorId === currentUserId;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const save = async () => {
    if (!draft.trim() || draft === comment.body) {
      setEditing(false);
      setDraft(comment.body);
      return;
    }
    setBusy(true);
    try {
      await api.updateComment(comment.id, draft.trim());
      await queryClient.invalidateQueries({
        queryKey: [...SYNC_KEYS.COMMENTS, comment.subjectType, comment.subjectId],
      });
      await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATION_COUNT });
      setEditing(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('toast.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('comments.delete_confirm'))) return;
    setBusy(true);
    try {
      await api.deleteComment(comment.id);
      await queryClient.invalidateQueries({
        queryKey: [...SYNC_KEYS.COMMENTS, comment.subjectType, comment.subjectId],
      });
      showToast(t('comments.deleted_toast'));
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('toast.save_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cmt-item">
      <Avatar id={comment.authorId} size={28} />
      <div className="cmt-body">
        <div className="cmt-head">
          <span className="cmt-author">{author?.name ?? comment.authorId}</span>
          <span className="cmt-time" title={fmtTime(comment.createdAt)}>
            {fmtTime(comment.createdAt)}
            {comment.editedAt && (
              <span className="cmt-edited"> · {t('comments.edited')}</span>
            )}
          </span>
          {!editing && (
            <div className="cmt-actions">
              {canEdit && (
                <button
                  type="button"
                  className="cmt-action"
                  onClick={() => setEditing(true)}
                  title={t('comments.edit')}
                >
                  <Icon name="pencil" size={11} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="cmt-action danger"
                  onClick={remove}
                  disabled={busy}
                  title={t('comments.delete')}
                >
                  <Icon name="trash-2" size={11} />
                </button>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className="cmt-edit">
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              onSubmit={save}
              users={users}
              currentUserId={currentUserId}
              autoFocus
              rows={3}
            />
            <div className="cmt-edit-actions">
              <button
                type="button"
                className="tb-btn"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                }}
                disabled={busy}
              >
                {t('comments.edit_cancel')}
              </button>
              <button
                type="button"
                className="tb-btn accent"
                onClick={save}
                disabled={busy || !draft.trim() || draft === comment.body}
              >
                {t('comments.edit_save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cmt-text">
            <RenderMentions body={comment.body} users={users} />
          </div>
        )}
      </div>
    </div>
  );
}
