import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { FeedbackEntry } from '../../data/api';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';

const MY_FEEDBACK_KEY = ['btm', 'my-feedback'] as const;

const STATUS_CONFIG: Record<
  FeedbackEntry['status'],
  { labelKey: 'feedback.status_open' | 'feedback.status_in_progress' | 'feedback.status_done' | 'feedback.status_wontfix'; color: string; bg: string }
> = {
  open: { labelKey: 'feedback.status_open', color: '#7B6A50', bg: 'rgba(180,140,80,0.13)' },
  in_progress: { labelKey: 'feedback.status_in_progress', color: 'var(--accent-700, #7C5A3C)', bg: 'rgba(var(--accent-rgb),0.15)' },
  done: { labelKey: 'feedback.status_done', color: '#4A6839', bg: 'rgba(94,127,78,0.14)' },
  wontfix: { labelKey: 'feedback.status_wontfix', color: 'var(--ink-400)', bg: 'rgba(28,26,23,0.07)' },
};

export function MyFeedbackTab() {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: MY_FEEDBACK_KEY,
    queryFn: api.listFeedback,
    staleTime: 30_000,
  });

  const remove = async (item: FeedbackEntry) => {
    if (!confirm(t('feedback.my_delete_confirm'))) return;
    try {
      await api.deleteFeedback(item.id);
      queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  return (
    <div className="set-pane">
      <p className="set-intro">{t('feedback.my_heading')}</p>

      {isLoading ? (
        <p className="fb-my-empty">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="fb-my-empty">{t('feedback.my_empty')}</p>
      ) : (
        <div className="fb-my-list">
          {items.map((item) => {
            const st = STATUS_CONFIG[item.status];
            return (
              <article key={item.id} className={`fb-my-card status-${item.status}`}>
                <div className="fb-my-card-head">
                  <span className={`fb-type-pill type-${item.type}`}>
                    <Icon name={item.type === 'bug' ? 'bug' : 'sparkles'} size={11} />
                    {t(`feedback.type_${item.type}` as 'feedback.type_bug')}
                  </span>
                  <span className="fb-my-card-title">{item.title}</span>
                  <span
                    className="fb-my-status-pill"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {t(st.labelKey)}
                  </span>
                </div>
                <p className="fb-my-card-body">{item.body}</p>
                {item.adminNote && (
                  <div className="fb-my-resolution">
                    <Icon name="check-circle" size={12} />
                    <span>
                      <strong>{t('feedback.my_resolution_note')}</strong> {item.adminNote}
                    </span>
                  </div>
                )}
                <div className="fb-my-card-foot">
                  <span className="fb-my-card-date">
                    {new Date(item.createdAt).toLocaleString(
                      locale === 'en' ? 'en-US' : 'de-DE',
                      { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' },
                    )}
                  </span>
                  {(item.status === 'open' || item.status === 'wontfix') && (
                    <button
                      type="button"
                      className="fb-action-btn fb-action-danger"
                      onClick={() => remove(item)}
                      title={t('common.delete')}
                    >
                      <Icon name="trash-2" size={11} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
