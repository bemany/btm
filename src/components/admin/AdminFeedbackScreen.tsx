// FclU83tVeNu: Bug-Reports & Feature-Requests als eigene Verwaltungs-
// Unterseite unter /admin/feedback (vorher: rechte Spalte im Admin-Screen).
// Verwendet die bestehende FeedbackList — nur Wrapping mit Heading + Back-
// Link zum Admin-Hauptscreen.

import { FeedbackList } from './FeedbackList';
import { Icon } from '../shared/Icon';
import { navigate } from '../../router';
import { useT } from '../../i18n';

export function AdminFeedbackScreen() {
  const t = useT();
  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <button
            type="button"
            className="admin-feedback-back"
            onClick={() => navigate('/admin')}
            aria-label={t('admin.back_to_overview')}
          >
            <Icon name="chevron-left" size={14} />
            <span>{t('admin.back_to_overview')}</span>
          </button>
          <div className="eyebrow">{t('admin.feedback_eyebrow')}</div>
          <h1>{t('feedback.admin_heading')}</h1>
          <div className="subtitle">{t('admin.feedback_sub')}</div>
        </div>
      </div>
      <FeedbackList />
    </div>
  );
}
