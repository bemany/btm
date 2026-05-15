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
import type { PushDeviceDTO } from '../../data/api';
import { showToast } from '../shared/Toast';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '../../lib/pushNotifications';

function detectBrowser(endpoint: string): { name: string; icon: string } {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    if (host.includes('fcm.googleapis') || host.includes('fcm.google') || host.includes('android'))
      return { name: 'Chrome / Android', icon: 'smartphone' };
    if (host.includes('push.apple') || host.includes('apple'))
      return { name: 'Safari / Apple', icon: 'smartphone' };
    if (host.includes('mozilla') || host.includes('firefox'))
      return { name: 'Firefox', icon: 'globe' };
    if (host.includes('notify.windows') || host.includes('wns'))
      return { name: 'Edge / Windows', icon: 'monitor' };
  } catch {
    // ignore
  }
  return { name: 'Browser', icon: 'globe' };
}

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

  const pushSupported = isPushSupported();
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [devices, setDevices] = useState<PushDeviceDTO[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported) return;
    getCurrentSubscription().then((sub) => setPushActive(!!sub));
  }, [pushSupported]);

  useEffect(() => {
    api.listPushDevices().then(setDevices).catch(() => {});
  }, []);

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

  const handleTestPush = async (id: string) => {
    if (testingId) return;
    setTestingId(id);
    try {
      await api.sendPushTest(id);
      showToast(t('settings.push_test_sent'));
    } catch {
      showToast(t('settings.push_test_failed'));
    } finally {
      setTestingId(null);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    if (removingId) return;
    setRemovingId(id);
    try {
      await api.deletePushDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      showToast(t('settings.push_device_removed'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setRemovingId(null);
    }
  };

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushActive) {
        await unsubscribeFromPush();
        setPushActive(false);
        showToast(t('settings.push_disabled'));
      } else {
        const result = await subscribeToPush();
        if (result === 'granted') {
          setPushActive(true);
          showToast(t('settings.push_enabled'));
        } else if (result === 'denied') {
          showToast(t('settings.push_denied'));
        } else if (result === 'unsupported') {
          showToast(t('settings.push_unsupported'));
        } else {
          showToast(t('common.error_generic'));
        }
      }
    } finally {
      setPushBusy(false);
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
        {pushSupported && getPushPermission() !== 'denied' && (
          <ToggleRow
            iconName="smartphone"
            title={t('settings.push_title')}
            description={t('settings.push_body')}
            value={pushActive}
            onChange={togglePush}
            disabled={pushBusy}
          />
        )}
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

      {devices.length > 0 && (
        <div className="push-devices-section">
          <h4 className="push-devices-title">{t('settings.push_devices_title')}</h4>
          <div className="push-devices-list">
            {devices.map((device) => {
              const browser = detectBrowser(device.endpoint);
              const since = new Date(device.createdAt).toLocaleDateString(undefined, {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              return (
                <div key={device.id} className="push-device-row">
                  <span className="push-device-icon">
                    <Icon name={browser.icon as 'smartphone' | 'globe' | 'monitor'} size={14} />
                  </span>
                  <span className="push-device-info">
                    <span className="push-device-name">{browser.name}</span>
                    <span className="push-device-since">
                      {t('settings.push_registered_since', { date: since })}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="tb-btn"
                    disabled={!!testingId}
                    onClick={() => handleTestPush(device.id)}
                  >
                    {testingId === device.id ? (
                      t('common.sending')
                    ) : (
                      <>
                        <Icon name="send" size={12} />
                        Test
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="tb-btn tb-btn-danger"
                    disabled={!!removingId}
                    onClick={() => handleRemoveDevice(device.id)}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="set-foot-hint">
        {user?.email ? t('settings.notifications_recipient', { email: user.email }) : null}
      </p>
    </div>
  );
}
