// Notify-Prompt — Onboarding-Wizard fuer Mail-Benachrichtigungen.
// Erscheint einmalig beim naechsten Login wenn user.notifyPromptShownAt
// noch null ist. User entscheidet:
//   1. Will ich ueberhaupt E-Mails bekommen? (Ja / Nein)
//   2. Wenn ja: welche? (Mentions, Daily Digest)
//
// Nach "Speichern" oder "Spaeter" wird notifyPromptShownAt gesetzt, damit
// der Dialog nicht erneut auftaucht.

import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';
import * as api from '../../data/api';

export function NotifyPrompt() {
  const t = useT();
  const { user, refresh } = useAuth();

  const [wantMail, setWantMail] = useState<boolean | null>(null);
  const [mentions, setMentions] = useState(true);
  const [digest, setDigest] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sichtbar nur wenn: User da, Onboarding-Tour abgeschlossen, Prompt noch nicht gesehen
  const visible =
    !!user &&
    !!user.onboardingCompletedAt &&
    !user.notifyPromptShownAt;

  if (!visible) return null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // wantMail=false  → beide ausschalten
      // wantMail=true   → nach Toggles
      // wantMail=null   → "Spaeter" geklickt → prefs nicht aendern, nur seen markieren
      const prefs =
        wantMail === false
          ? { notifyMentionsMail: false, notifyDigestMail: false }
          : wantMail === true
            ? { notifyMentionsMail: mentions, notifyDigestMail: digest }
            : {};
      await api.markNotifyPromptSeen(prefs);
      await refresh();
      showToast(t('notify_prompt.saved_toast'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.markNotifyPromptSeen({});
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="np-backdrop" role="dialog" aria-modal="true">
      <div className="np-shell">
        <div className="np-head">
          <div className="np-icon-circle">
            <Icon name="mail" size={22} />
          </div>
          <h2 className="np-title">{t('notify_prompt.title')}</h2>
          <p className="np-sub">{t('notify_prompt.sub')}</p>
        </div>

        <div className="np-body">
          <div className="np-choice-row">
            <button
              type="button"
              className={`np-choice ${wantMail === true ? 'is-on' : ''}`}
              onClick={() => setWantMail(true)}
            >
              <Icon name="check" size={14} />
              <span>{t('notify_prompt.want_yes')}</span>
            </button>
            <button
              type="button"
              className={`np-choice ${wantMail === false ? 'is-on np-choice-no' : ''}`}
              onClick={() => setWantMail(false)}
            >
              <Icon name="x" size={14} />
              <span>{t('notify_prompt.want_no')}</span>
            </button>
          </div>

          {wantMail === true && (
            <div className="np-options">
              <p className="np-options-label">{t('notify_prompt.which_label')}</p>
              <button
                type="button"
                className={`np-toggle-row ${mentions ? 'is-on' : ''}`}
                onClick={() => setMentions((v) => !v)}
              >
                <div className="np-toggle-icon a-blue">
                  <Icon name="at-sign" size={14} />
                </div>
                <div className="np-toggle-text">
                  <div className="np-toggle-title">{t('notify_prompt.mentions_title')}</div>
                  <div className="np-toggle-sub">{t('notify_prompt.mentions_sub')}</div>
                </div>
                <span className={`np-switch ${mentions ? 'is-on' : ''}`}>
                  <span />
                </span>
              </button>
              <button
                type="button"
                className={`np-toggle-row ${digest ? 'is-on' : ''}`}
                onClick={() => setDigest((v) => !v)}
              >
                <div className="np-toggle-icon a-orange">
                  <Icon name="sun" size={14} />
                </div>
                <div className="np-toggle-text">
                  <div className="np-toggle-title">{t('notify_prompt.digest_title')}</div>
                  <div className="np-toggle-sub">{t('notify_prompt.digest_sub')}</div>
                </div>
                <span className={`np-switch ${digest ? 'is-on' : ''}`}>
                  <span />
                </span>
              </button>
            </div>
          )}

          {wantMail === false && (
            <p className="np-hint">
              <Icon name="info" size={12} /> {t('notify_prompt.hint_off')}
            </p>
          )}
        </div>

        <div className="np-foot">
          <button className="np-btn" onClick={skip} disabled={busy}>
            {t('notify_prompt.later')}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="np-btn is-primary"
            onClick={save}
            disabled={busy || wantMail === null}
          >
            <Icon name="check" size={12} /> {t('notify_prompt.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
