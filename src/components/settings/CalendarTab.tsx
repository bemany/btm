// Settings → Kalender (Odoo-Sync).
//
// Felder: Odoo-URL, Datenbank, Benutzername, API-Key. Plus:
//   • „Verbindung testen" — hits /me/calendar/test mit aktuellen Form-Werten
//   • „Speichern" — hits /me/calendar (PATCH)
//   • „Sync aktivieren"-Toggle
//   • Status-Box mit letztem Sync-Timestamp + Fehler-Code falls vorhanden
//   • „Jetzt synchronisieren" — manueller Sync-Trigger
//   • „Verbindung trennen" — DELETE
//
// Hinweis: das API-Key-Feld zeigt nie den existierenden Key (HttpOnly-Stil).
// User sieht „••• gespeichert" und kann einen neuen eingeben falls Rotation.

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';
import * as api from '../../data/api';
import { showToast } from '../shared/Toast';

type TestStatus = null | { ok: true; uid: number; name?: string } | { ok: false; error: string };

export function CalendarTab() {
  const t = useT();
  const [locale] = useLocale();
  const { user, refresh } = useAuth();

  const [url, setUrl] = useState(user?.odooUrl ?? '');
  const [database, setDatabase] = useState(user?.odooDatabase ?? '');
  const [username, setUsername] = useState(user?.odooUsername ?? '');
  const [apiKey, setApiKey] = useState('');
  const [syncEnabled, setSyncEnabled] = useState<boolean>(user?.odooSyncEnabled ?? false);
  const hasApiKey = user?.odooHasApiKey ?? false;

  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>(null);

  useEffect(() => {
    setUrl(user?.odooUrl ?? '');
    setDatabase(user?.odooDatabase ?? '');
    setUsername(user?.odooUsername ?? '');
    setSyncEnabled(user?.odooSyncEnabled ?? false);
  }, [user?.odooUrl, user?.odooDatabase, user?.odooUsername, user?.odooSyncEnabled]);

  const canSubmit = !!url && !!database && !!username && (hasApiKey || !!apiKey);

  const handleTest = async () => {
    if (busy) return;
    setBusy(true);
    setTestStatus(null);
    try {
      const res = await api.testCalendarConnection({
        odooUrl: url || undefined,
        odooDatabase: database || undefined,
        odooUsername: username || undefined,
        odooApiKey: apiKey || undefined,
      });
      if (res.ok && res.uid) {
        setTestStatus({ ok: true, uid: res.uid, name: res.name });
      } else {
        setTestStatus({ ok: false, error: res.error ?? 'unknown' });
      }
    } catch {
      setTestStatus({ ok: false, error: 'network' });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      await api.updateCalendarConfig({
        odooUrl: url,
        odooDatabase: database,
        odooUsername: username,
        ...(apiKey ? { odooApiKey: apiKey } : {}),
      });
      setApiKey('');
      await refresh();
      showToast(t('calendar.save_ok'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    const before = syncEnabled;
    setSyncEnabled(next);
    try {
      await api.updateCalendarConfig({ odooSyncEnabled: next });
      await refresh();
    } catch {
      setSyncEnabled(before);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.syncCalendarNow();
      if (res.ok) {
        showToast(t('calendar.sync_now_ok', { count: res.synced ?? 0 }));
      } else {
        showToast(t('calendar.sync_now_failed', { code: res.error ?? 'unknown' }));
      }
      await refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (busy) return;
    if (!confirm(t('calendar.disconnect_confirm'))) return;
    setBusy(true);
    try {
      await api.deleteCalendarConfig();
      setUrl('');
      setDatabase('');
      setUsername('');
      setApiKey('');
      setSyncEnabled(false);
      setTestStatus(null);
      await refresh();
      showToast(t('calendar.disconnect_ok'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  // Status-Block (zuletzt synchronisiert)
  const lastSyncRel = (() => {
    if (!user?.odooLastSyncAt) return null;
    const ms = Date.now() - new Date(user.odooLastSyncAt).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1) return locale === 'en' ? 'just now' : 'gerade eben';
    if (min < 60) return locale === 'en' ? `${min}m ago` : `vor ${min} Min`;
    const h = Math.floor(min / 60);
    if (h < 24) return locale === 'en' ? `${h}h ago` : `vor ${h} Std`;
    return new Date(user.odooLastSyncAt).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE');
  })();

  return (
    <div className="set-pane cal-settings">
      <p className="set-intro">{t('calendar.intro')}</p>

      <div className="cal-form">
        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.field_url')}</span>
          <input
            type="url"
            placeholder={t('calendar.field_url_placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
          <span className="cal-field-help">{t('calendar.field_url_help')}</span>
        </label>

        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.field_database')}</span>
          <input
            type="text"
            placeholder={t('calendar.field_database_placeholder')}
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.field_username')}</span>
          <input
            type="text"
            placeholder={t('calendar.field_username_placeholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.field_api_key')}</span>
          {/* WICHTIG: name=odoo-api-key-… (mit zufälligem Suffix) +
              autoComplete=new-password — verhindert dass Arc/Safari/Chrome
              ihren Passwort-Manager den Key überschreibt mit irgendeinem
              gespeicherten Login. Das hatte uns am 2026-05-13 die DB
              kaputt gemacht (siehe Fix-Commit). */}
          <input
            type="password"
            name="odoo-api-key-do-not-fill"
            placeholder={hasApiKey ? t('calendar.field_api_key_saved') : t('calendar.field_api_key_placeholder')}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
          />
          <span className="cal-field-help">{t('calendar.field_api_key_help')}</span>
        </label>
      </div>

      <div className="cal-actions">
        <button type="button" className="tb-btn" onClick={handleTest} disabled={busy || !url || !database || !username || (!apiKey && !hasApiKey)}>
          <Icon name="link" size={12} />
          {t('calendar.test_btn')}
        </button>
        <button type="button" className="tb-btn primary" onClick={handleSave} disabled={busy || !canSubmit}>
          <Icon name="check" size={12} />
          {t('calendar.save_btn')}
        </button>
        {testStatus && (
          <span className={`cal-test-pill ${testStatus.ok ? 'is-ok' : 'is-error'}`}>
            {testStatus.ok ? (
              <>
                <Icon name="check" size={11} />{' '}
                {t('calendar.test_ok', { uid: testStatus.uid, name: testStatus.name ?? '—' })}
              </>
            ) : (
              <>
                <Icon name="x" size={11} />{' '}
                {t('calendar.test_failed', { code: testStatus.error })}
              </>
            )}
          </span>
        )}
      </div>

      {hasApiKey && (
        <div className="cal-sync-section">
          <button
            type="button"
            className={`set-card notify-toggle ${syncEnabled ? 'is-active' : ''}`}
            onClick={() => handleToggle(!syncEnabled)}
            disabled={busy}
          >
            <span className="set-card-icon">
              <Icon name="refresh-cw" size={14} />
            </span>
            <span className="set-card-text">
              <span className="set-card-title">{t('calendar.sync_toggle_title')}</span>
              <span className="set-card-sub">{t('calendar.sync_toggle_body')}</span>
            </span>
            <span className={`notify-switch ${syncEnabled ? 'is-on' : ''}`} aria-hidden>
              <span className="notify-switch-knob" />
            </span>
          </button>

          <div className="cal-status">
            <div className="cal-status-row">
              <span className="cal-status-label">{t('calendar.status_last')}</span>
              <span className="cal-status-value">
                {!lastSyncRel ? (
                  <span className="dim">{t('calendar.status_never')}</span>
                ) : user?.odooLastSyncError ? (
                  <span className="cal-status-error">
                    <Icon name="alert-triangle" size={11} /> {lastSyncRel} · {user.odooLastSyncError}
                  </span>
                ) : (
                  <span className="cal-status-ok">
                    <Icon name="check" size={11} /> {lastSyncRel}
                  </span>
                )}
              </span>
            </div>
            <div className="cal-status-actions">
              <button type="button" className="tb-btn" onClick={handleSyncNow} disabled={busy || !syncEnabled}>
                <Icon name="refresh-cw" size={12} />
                {t('calendar.sync_now_btn')}
              </button>
              <button type="button" className="tb-btn danger" onClick={handleDisconnect} disabled={busy}>
                <Icon name="unlink" size={12} />
                {t('calendar.disconnect_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
