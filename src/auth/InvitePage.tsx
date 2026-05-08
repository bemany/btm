import { useEffect, useState } from 'react';
import { Icon } from '../components/shared/Icon';
import { showToast } from '../components/shared/Toast';
import { useAuth } from './AuthContext';
import { navigate } from '../router';
import * as api from '../data/api';
import { useT } from '../i18n';

type Phase = 'loading' | 'invalid' | 'expired' | 'ready' | 'sending' | 'sent';

interface InviteData {
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  invitedAt: string;
}

export function InvitePage({ token }: { token: string }) {
  const { user, signIn } = useAuth();
  const t = useT();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.lookupInvitation(token);
        if (cancelled) return;
        setData(res);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('expired')) setPhase('expired');
        else if (msg.includes('cancelled') || msg.includes('invalid')) setPhase('invalid');
        else setPhase('invalid');
        setErrorMsg(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Wenn der User bereits eingeloggt ist und eine Invitation passt zur Email,
  // markieren wir die Einladung sofort als angenommen + leiten in die App.
  useEffect(() => {
    if (phase === 'ready' && user && data && user.email.toLowerCase() === data.email.toLowerCase()) {
      void api.acceptInvitation(token).finally(() => {
        showToast(t('invite.welcome_toast'));
        navigate('/', { replace: true });
      });
    }
  }, [phase, user, data, token]);

  const accept = async () => {
    if (!data) return;
    setPhase('sending');
    try {
      // Magic-Link an die Invite-Email schicken. Den Accept-Mark setzen wir
      // *nicht* hier — sonst sieht der GET-Lookup nach Klick auf den Link
      // bereits `accepted_at != null` und liefert 410 „already accepted".
      // Tatsächliches Annehmen passiert nach erfolgreichem Magic-Verify im
      // useEffect oben (siehe `phase === 'ready' && user && data`-Branch).
      await signIn(data.email, `/invite/${token}`);
      setPhase('sent');
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('invite.magic_link_failed'));
      setPhase('ready');
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <svg viewBox="0 0 32 32" width="44" height="44" fill="none" aria-hidden="true">
            <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#inv-bg)" />
            <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="9" width="9" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="15" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="21" width="6" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
            <defs>
              <linearGradient id="inv-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1C1A17" />
                <stop offset="1" stopColor="#2A2622" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="login-brand-name">BTM</div>
            <div className="login-brand-sub">{t('invite.title')}</div>
          </div>
        </div>

        {phase === 'loading' && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            <Icon name="loader-2" size={20} className="login-spin" />
            <div style={{ marginTop: 10, fontSize: 13 }}>{t('invite.checking')}</div>
          </div>
        )}

        {phase === 'invalid' && (
          <div style={{ padding: '20px 0' }}>
            <h1>{t('invite.invalid_title')}</h1>
            <p className="login-lead">
              {t('invite.invalid_body')}
              {errorMsg && (
                <>
                  <br />
                  <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>
                    {t('invite.error_msg_inline', { msg: errorMsg })}
                  </span>
                </>
              )}
            </p>
            <button className="login-btn-secondary" onClick={() => navigate('/')}>
              {t('invite.home')}
            </button>
          </div>
        )}

        {phase === 'expired' && (
          <div style={{ padding: '20px 0' }}>
            <h1>{t('invite.expired_title')}</h1>
            <p className="login-lead">{t('invite.expired_body')}</p>
            <button className="login-btn-secondary" onClick={() => navigate('/')}>
              {t('invite.home')}
            </button>
          </div>
        )}

        {phase === 'ready' && data && (
          <div>
            <h1>{t('invite.ready_greeting', { name: data.name ? ` ${data.name.split(' ')[0]}` : '' })}</h1>
            <p className="login-lead">
              {t('invite.ready_body', {
                role: data.role === 'admin' ? t('invite.role_admin') : t('invite.role_member'),
                email: data.email,
              })}
            </p>
            <button onClick={accept} className="login-btn-primary">
              <Icon name="mail" size={14} /> {t('invite.request_link')}
            </button>
            <p className="login-foot">{t('invite.foot_wrong_email')}</p>
          </div>
        )}

        {phase === 'sending' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Icon name="loader-2" size={20} className="login-spin" />
            <div style={{ marginTop: 10, fontSize: 13 }}>{t('invite.sending')}</div>
          </div>
        )}

        {phase === 'sent' && data && (
          <div className="login-sent">
            <div className="login-sent-icon">
              <Icon name="mail-check" size={36} />
            </div>
            <h2>{t('invite.sent_title')}</h2>
            <p>{t('invite.sent_body', { email: data.email })}</p>
            <p className="login-sent-hint">{t('invite.sent_hint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
