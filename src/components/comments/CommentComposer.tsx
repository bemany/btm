import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { CommentSubjectType } from '../../data/api';
import type { AppUser } from '../../store/types';
import { showToast } from '../shared/Toast';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';
import { MentionTextarea } from './MentionTextarea';

export interface CommentComposerProps {
  subjectType: CommentSubjectType;
  subjectId: string;
  users: AppUser[];
  currentUserId: string | null;
}

export function CommentComposer({ subjectType, subjectId, users, currentUserId }: CommentComposerProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await api.createComment({ subjectType, subjectId, body });
      setDraft('');
      await queryClient.invalidateQueries({
        queryKey: [...SYNC_KEYS.COMMENTS, subjectType, subjectId],
      });
      await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.NOTIFICATION_COUNT });
      showToast(t('comments.sent_toast'));
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('comments.send_failed_toast'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cmt-composer">
      <MentionTextarea
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder={t('comments.write_placeholder')}
        users={users}
        currentUserId={currentUserId}
        disabled={busy}
        rows={2}
      />
      <div className="cmt-composer-foot">
        <span className="cmt-composer-hint">{t('comments.shortcut_hint')}</span>
        <button
          type="button"
          className="tb-btn accent"
          onClick={submit}
          disabled={busy || !draft.trim()}
        >
          <Icon name="send" size={12} /> {t('comments.send')}
        </button>
      </div>
    </div>
  );
}
