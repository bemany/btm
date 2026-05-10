// Settings → Benachrichtigungen.
//
// Zwei unabhängige Toggles:
//   • notifyMentionsMail — Sofort-Mail wenn jemand mich mit @ erwähnt
//   • notifyDigestMail   — Tägliche Zusammenfassung (~08:00 morgens)
//
// Optimistic toggle: lokal sofort umlegen, dann PATCH zum Server. Bei
// Fehler rollback + Toast.

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';
import * as api from '../../data/api';
import { showToast } from '../shared/Toast';

interface ToggleRowProps {
  iconName: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ iconName, title, description, value, onChange, disabled }: ToggleRowProps) {
  return (
    <button
      type="button"
      className={`set-card notify-toggle ${value ? 'is-active' : ''}`}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
    >
      <span className="set-card-icon">
        <Icon name={iconName} size={14} />
      </span>
      <span className="set-card-text">
        <span className="set-card-title">{title}</span>
        <span className="set-card-sub">{description}</span>
      </span>
      <span className={`notify-switch ${value ? 'is-on' : ''}`} aria-hidden>
        <span className="notify-switch-knob" />
      </span>
    </button>
  );
}

export function NotificationsTab() {
  const t = useT();
  const { user, refresh } = useAuth();
  const [mentions, setMentions] = useState<boolean>(user?.notifyMentionsMail ?? true);
  const [digest, setDigest] = useState<boolean>(user?.notifyDigestMail ?? true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMentions(user?.notifyMentionsMail ?? true);
    setDigest(user?.notifyDigestMail ?? true);
  }, [user?.notifyMentionsMail, user?.notifyDigestMail]);

  const updateMentions = async (value: boolean) => {
    if (busy) return;
    const before = mentions;
    setMentions(value);
    setBusy(true);
    try {
      await api.updateNotifyPrefs({ notifyMentionsMail: value });
      await refresh();
    } catch {
      setMentions(before);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const updateDigest = async (value: boolean) => {
    if (busy) return;
    const before = digest;
    setDigest(value);
    setBusy(true);
    try {
      await api.updateNotifyPrefs({ notifyDigestMail: value });
      await refresh();
    } catch {
      setDigest(before);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="set-pane">
      <p className="set-intro">{t('settings.notifications_intro')}</p>

      <div className="set-card-grid notify-grid">
        <ToggleRow
          iconName="at-sign"
          title={t('settings.notifications_mentions_title')}
          description={t('settings.notifications_mentions_body')}
          value={mentions}
          onChange={updateMentions}
          disabled={busy}
        />
        <ToggleRow
          iconName="mail"
          title={t('settings.notifications_digest_title')}
          description={t('settings.notifications_digest_body')}
          value={digest}
          onChange={updateDigest}
          disabled={busy}
        />
      </div>

      <div className="notify-send-now">
        <button
          type="button"
          className="tb-btn"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await api.sendDigestNow();
              showToast(t('settings.notifications_send_now_ok'));
            } catch {
              showToast(t('common.error_generic'));
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
        >
          <Icon name="send" size={12} />
          {t('settings.notifications_send_now')}
        </button>
        <span className="notify-send-now-hint">
          {t('settings.notifications_send_now_hint')}
        </span>
      </div>

      <p className="set-foot-hint">
        {user?.email ? t('settings.notifications_recipient', { email: user.email }) : null}
      </p>
    </div>
  );
}
