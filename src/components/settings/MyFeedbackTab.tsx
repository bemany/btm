import { useState } from 'react';
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

                {/* FTKnjlXNVlH: Reporter-Abnahme nach Resolve */}
                {item.status === 'done' && item.reporterConfirmation === null && (
                  <ConfirmPanel item={item} />
                )}
                {item.reporterConfirmation === 'confirmed' && (
                  <div className="fb-my-confirmed">
                    <Icon name="circle-check" size={12} />
                    <span>{t('feedback.confirm_confirmed_badge')}</span>
                  </div>
                )}
                {item.status !== 'done' && item.reporterConfirmation === 'rejected' && (
                  <div className="fb-my-reopened">
                    <Icon name="rotate-ccw" size={12} />
                    <span>{t('feedback.confirm_reopened_badge')}</span>
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

// Abnahme-Panel: „Passt so" akzeptiert sofort. „Noch nicht gelöst" klappt ein
// Begründungs-Feld aus und schickt das Feedback zurück auf 'open'.
function ConfirmPanel({ item }: { item: FeedbackEntry }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: MY_FEEDBACK_KEY });
    queryClient.invalidateQueries({ queryKey: ['btm', 'feedback'] });
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
    <div className="fb-confirm">
      <div className="fb-confirm-prompt">
        <Icon name="circle-help" size={13} />
        <span>{t('feedback.confirm_prompt')}</span>
      </div>
      {rejecting ? (
        <div className="fb-confirm-reject">
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
          <div className="fb-confirm-actions">
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
        <div className="fb-confirm-actions">
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
    </div>
  );
}
