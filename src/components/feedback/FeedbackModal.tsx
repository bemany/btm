// Feedback-Modal — User können Bugs melden und Features wünschen.
//
// Felder:
//   • type (bug | feature) — Toggle oben
//   • title (Pflicht, kurze Zusammenfassung)
//   • body  (Pflicht, ausführliche Beschreibung)
//
// Beim Submit werden zusätzlich der aktuelle Pfad, das aktive Theme und
// der User-Agent als Context-Snapshot mitgeschickt — Admin sieht im
// Detail wo der User war als das Problem auftrat.

import { useEffect, useState } from 'react';
import * as api from '../../data/api';
import type { FeedbackType } from '../../data/api';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

export interface FeedbackModalProps {
  initialType?: FeedbackType;
  onClose: () => void;
}

export function FeedbackModal({ initialType = 'bug', onClose }: FeedbackModalProps) {
  const t = useT();
  const [type, setType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  // Escape schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await api.createFeedback({
        type,
        title: title.trim(),
        body: body.trim(),
        contextPath: window.location.pathname + window.location.search,
        contextTheme: document.body.dataset.theme ?? null,
        contextUserAgent: navigator.userAgent.slice(0, 500),
      });
      showToast(t('feedback.sent_toast'));
      onClose();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="feedback-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="feedback-shell">
        <div className="feedback-head">
          <div>
            <div className="feedback-eyebrow">{t('feedback.eyebrow')}</div>
            <h2 className="feedback-title">{t('feedback.modal_title')}</h2>
          </div>
          <button className="feedback-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="feedback-type-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            className={`feedback-type-btn ${type === 'bug' ? 'is-active' : ''}`}
            onClick={() => setType('bug')}
          >
            <Icon name="bug" size={14} />
            <span>{t('feedback.type_bug')}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`feedback-type-btn ${type === 'feature' ? 'is-active' : ''}`}
            onClick={() => setType('feature')}
          >
            <Icon name="sparkles" size={14} />
            <span>{t('feedback.type_feature')}</span>
          </button>
        </div>

        <div className="feedback-form">
          <label className="feedback-field">
            <span className="feedback-label">{t('feedback.title_label')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'bug'
                  ? t('feedback.title_placeholder_bug')
                  : t('feedback.title_placeholder_feature')
              }
              autoFocus
              maxLength={200}
            />
          </label>
          <label className="feedback-field">
            <span className="feedback-label">{t('feedback.body_label')}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                type === 'bug'
                  ? t('feedback.body_placeholder_bug')
                  : t('feedback.body_placeholder_feature')
              }
              rows={7}
              maxLength={20_000}
            />
          </label>
          <div className="feedback-context-hint">
            <Icon name="info" size={11} />
            <span>{t('feedback.context_hint')}</span>
          </div>
        </div>

        <div className="feedback-foot">
          <button className="feedback-btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="feedback-btn is-primary" onClick={submit} disabled={!canSubmit}>
            <Icon name="send" size={12} /> {busy ? t('common.sending') : t('feedback.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
