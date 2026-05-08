import { useQuery } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { CommentSubjectType } from '../../data/api';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';
import { CommentItem } from './CommentItem';
import { CommentComposer } from './CommentComposer';

export interface CommentsSectionProps {
  subjectType: CommentSubjectType;
  subjectId: string;
}

export function CommentsSection({ subjectType, subjectId }: CommentsSectionProps) {
  const t = useT();
  const users = useStore((s) => s.users);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: comments = [], isLoading } = useQuery({
    queryKey: [...SYNC_KEYS.COMMENTS, subjectType, subjectId],
    queryFn: () => api.listComments(subjectType, subjectId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return (
    <div className="cmt-section">
      <div className="eyebrow cmt-section-head">
        {t('comments.heading', { count: comments.length })}
      </div>

      <div className="cmt-list">
        {isLoading && comments.length === 0 ? (
          <div className="cmt-empty">{t('common.loading')}</div>
        ) : comments.length === 0 ? (
          <div className="cmt-empty">{t('comments.empty')}</div>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              users={users}
              currentUserId={user?.id ?? null}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      <CommentComposer
        subjectType={subjectType}
        subjectId={subjectId}
        users={users}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
