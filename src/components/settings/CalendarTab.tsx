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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';
import * as api from '../../data/api';
import type { IcalFeedDTO } from '../../data/api';
import { showToast } from '../shared/Toast';

const ICAL_FEEDS_KEY = ['btm', 'me', 'icalFeeds'] as const;

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

      <div className="cal-source-head">
        <Icon name="briefcase" size={14} />
        <h4>{t('calendar.source_odoo')}</h4>
      </div>

      {/* Odoo-Preset (FystBwbvLnW). Spart Kolleg:innen das Tippen
          der URL+DB. API-Key bleibt vom User selbst einzutragen. */}
      <div className="cal-preset-box">
        <div className="cal-preset-text">
          <Icon name="zap" size={13} />
          <span>{t('calendar.preset_hint')}</span>
        </div>
        <button
          type="button"
          className="tb-btn"
          onClick={() => {
            setUrl('https://meinfahrer.odoo.com');
            setDatabase('meinfahrer-main-22367884');
            if (!username && user?.email) setUsername(user.email);
          }}
          disabled={busy}
        >
          <Icon name="wand-2" size={12} />
          {t('calendar.preset_btn')}
        </button>
      </div>

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

        {/* Video-Tutorial-Platzhalter (FystBwbvLnW). Sobald Esref ein
            Tutorial aufgenommen hat, Video-URL hier eintragen + Banner
            durch <video>/<iframe> ersetzen. */}
        <div className="cal-video-placeholder">
          <div className="cal-video-placeholder-icon">
            <Icon name="play-circle" size={22} />
          </div>
          <div className="cal-video-placeholder-text">
            <div className="cal-video-placeholder-title">{t('calendar.video_tutorial_title')}</div>
            <div className="cal-video-placeholder-sub">{t('calendar.video_tutorial_sub')}</div>
          </div>
          <span className="cal-video-placeholder-badge">{t('calendar.video_tutorial_soon')}</span>
        </div>
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

      {/* ── iCal-Feeds (zweite Datenquelle, mehrere möglich) ── */}
      <div className="cal-source-head">
        <Icon name="link" size={14} />
        <h4>{t('calendar.source_ical')}</h4>
      </div>
      <p className="cal-source-intro">{t('calendar.ical_intro')}</p>
      <IcalFeedsSection />

      {/* ── TV-Privacy-Toggle ── */}
      <div className="cal-source-head">
        <Icon name="shield" size={14} />
        <h4>{t('calendar.privacy_heading')}</h4>
      </div>
      <PrivacyToggle />
    </div>
  );
}

// ── iCal-Feeds-Subkomponente ───────────────────────────────────────────
function IcalFeedsSection() {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const { data: feeds = [], isLoading } = useQuery({
    queryKey: ICAL_FEEDS_KEY,
    queryFn: api.listIcalFeeds,
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ICAL_FEEDS_KEY });

  const fmtRel = (iso: string | null): string | null => {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1) return locale === 'en' ? 'just now' : 'gerade eben';
    if (min < 60) return locale === 'en' ? `${min}m ago` : `vor ${min} Min`;
    const h = Math.floor(min / 60);
    if (h < 24) return locale === 'en' ? `${h}h ago` : `vor ${h} Std`;
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE');
  };

  const handleAdd = async () => {
    if (busy || !newUrl.trim()) return;
    setBusy(true);
    try {
      await api.createIcalFeed({ url: newUrl.trim(), label: newLabel.trim() || null });
      setNewUrl('');
      setNewLabel('');
      refresh();
      showToast(t('calendar.ical_added'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (feed: IcalFeedDTO, next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateIcalFeed(feed.id, { syncEnabled: next });
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handlePrivacyToggle = async (feed: IcalFeedDTO, next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateIcalFeed(feed.id, { tvPrivate: next });
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async (feed: IcalFeedDTO) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.syncIcalFeedNow(feed.id);
      if (r.ok) showToast(t('calendar.sync_now_ok', { count: r.synced ?? 0 }));
      else showToast(t('calendar.sync_now_failed', { code: r.error ?? 'unknown' }));
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (feed: IcalFeedDTO) => {
    if (busy) return;
    if (!confirm(t('calendar.ical_delete_confirm', { label: feed.label || feed.url }))) return;
    setBusy(true);
    try {
      await api.deleteIcalFeed(feed.id);
      refresh();
      showToast(t('calendar.ical_deleted'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cal-ical-section">
      {isLoading && feeds.length === 0 ? (
        <div className="cal-empty">{t('common.loading')}</div>
      ) : feeds.length === 0 ? (
        <div className="cal-empty">{t('calendar.ical_empty')}</div>
      ) : (
        <ul className="cal-ical-list">
          {feeds.map((feed) => {
            const rel = fmtRel(feed.lastSyncAt);
            return (
              <li key={feed.id} className="cal-ical-item">
                <div className="cal-ical-item-head">
                  <div className="cal-ical-item-label">
                    <span className="cal-ical-label">{feed.label || t('calendar.ical_unnamed')}</span>
                    {feed.lastSyncError ? (
                      <span className="cal-status-error" title={feed.lastSyncError}>
                        <Icon name="alert-triangle" size={11} /> {humanizeIcalError(feed.lastSyncError, t)}
                      </span>
                    ) : rel ? (
                      <span className="cal-status-ok">
                        <Icon name="check" size={11} /> {rel}
                      </span>
                    ) : (
                      <span className="dim">{t('calendar.status_never')}</span>
                    )}
                  </div>
                  <span
                    className={`notify-switch ${feed.syncEnabled ? 'is-on' : ''}`}
                    onClick={() => handleToggle(feed, !feed.syncEnabled)}
                    role="button"
                    aria-pressed={feed.syncEnabled}
                  >
                    <span className="notify-switch-knob" />
                  </span>
                </div>
                <div className="cal-ical-url" title={feed.url}>{feed.url}</div>
                <div className="cal-ical-privacy">
                  <span className="cal-ical-privacy-label">
                    <Icon name={feed.tvPrivate ? 'shield' : 'eye'} size={12} />
                    {feed.tvPrivate
                      ? t('calendar.ical_privacy_private')
                      : t('calendar.ical_privacy_public')}
                  </span>
                  <span
                    className={`notify-switch sm ${feed.tvPrivate ? 'is-on' : ''}`}
                    onClick={() => handlePrivacyToggle(feed, !feed.tvPrivate)}
                    role="button"
                    aria-pressed={feed.tvPrivate}
                    title={t('calendar.ical_privacy_help')}
                  >
                    <span className="notify-switch-knob" />
                  </span>
                </div>
                <div className="cal-ical-actions">
                  <button type="button" className="tb-btn" onClick={() => handleSyncNow(feed)} disabled={busy || !feed.syncEnabled}>
                    <Icon name="refresh-cw" size={12} />
                    {t('calendar.sync_now_btn')}
                  </button>
                  <button type="button" className="tb-btn danger" onClick={() => handleDelete(feed)} disabled={busy}>
                    <Icon name="trash-2" size={12} />
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="cal-ical-add">
        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.ical_label')}</span>
          <input
            type="text"
            placeholder={t('calendar.ical_label_placeholder')}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="cal-field">
          <span className="cal-field-label">{t('calendar.ical_url')}</span>
          <input
            type="url"
            placeholder={t('calendar.ical_url_placeholder')}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            disabled={busy}
          />
          <span className="cal-field-help">{t('calendar.ical_url_help')}</span>
        </label>
        <button type="button" className="tb-btn primary" onClick={handleAdd} disabled={busy || !newUrl.trim()}>
          <Icon name="plus" size={12} />
          {t('calendar.ical_add_btn')}
        </button>
      </div>
    </div>
  );
}

// ── Privacy-Toggle für TV ──────────────────────────────────────────────
function PrivacyToggle() {
  const t = useT();
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tvPrivate, setTvPrivate] = useState<boolean>(user?.calendarTvPrivate ?? false);

  useEffect(() => {
    setTvPrivate(user?.calendarTvPrivate ?? false);
  }, [user?.calendarTvPrivate]);

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    const before = tvPrivate;
    setTvPrivate(next);
    setBusy(true);
    try {
      await api.updateUserPrefs({ calendarTvPrivate: next });
      await refresh();
    } catch {
      setTvPrivate(before);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`set-card notify-toggle ${tvPrivate ? 'is-active' : ''}`}
      onClick={() => handleToggle(!tvPrivate)}
      disabled={busy}
    >
      <span className="set-card-icon">
        <Icon name="shield" size={14} />
      </span>
      <span className="set-card-text">
        <span className="set-card-title">{t('calendar.privacy_toggle_title')}</span>
        <span className="set-card-sub">{t('calendar.privacy_toggle_body')}</span>
      </span>
      <span className={`notify-switch ${tvPrivate ? 'is-on' : ''}`} aria-hidden>
        <span className="notify-switch-knob" />
      </span>
    </button>
  );
}

// Übersetzt Sync-Error-Codes aus dem Backend in lesbare Texte für den User.
// Codes kommen direkt aus IcalError.code (siehe server/lib/ical-client.ts).
function humanizeIcalError(code: string, t: (k: 'calendar.ical_err_unknown', vars?: Record<string, string | number>) => string): string {
  const mapping: Record<string, 'calendar.ical_err_unknown'> = {
    http_404: 'calendar.ical_err_http_404' as 'calendar.ical_err_unknown',
    http_401: 'calendar.ical_err_http_401' as 'calendar.ical_err_unknown',
    http_403: 'calendar.ical_err_http_403' as 'calendar.ical_err_unknown',
    http_error: 'calendar.ical_err_http_error' as 'calendar.ical_err_unknown',
    fetch_failed: 'calendar.ical_err_fetch_failed' as 'calendar.ical_err_unknown',
    parse_failed: 'calendar.ical_err_parse_failed' as 'calendar.ical_err_unknown',
    too_large: 'calendar.ical_err_too_large' as 'calendar.ical_err_unknown',
  };
  const key = mapping[code];
  return key ? t(key) : t('calendar.ical_err_unknown');
}
