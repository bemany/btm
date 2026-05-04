import { useEffect, useState } from 'react';
import { Icon } from '../components/shared/Icon';
import { showToast } from '../components/shared/Toast';
import { useAuth } from './AuthContext';
import { navigate } from '../router';
import * as api from '../data/api';

type Phase = 'loading' | 'invalid' | 'expired' | 'ready' | 'sending' | 'sent';

interface InviteData {
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  invitedAt: string;
}

export function InvitePage({ token }: { token: string }) {
  const { user, signIn } = useAuth();
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
        showToast('Willkommen!');
        navigate('/', { replace: true });
      });
    }
  }, [phase, user, data, token]);

  const accept = async () => {
    if (!data) return;
    setPhase('sending');
    try {
      // Magic-Link an die Invite-Email schicken; Mail enthält Link der nach Verify
      // auf btm.bethesna.org/?token=... redirected. AppGate ruft beim Login
      // dann acceptInvitation(token) auf — siehe useEffect oben.
      await signIn(data.email, `/invite/${token}`);
      // Mark invitation as accepted (so list of pending shrinks); Login-Step kann
      // nochmal POST machen, ist idempotent.
      await api.acceptInvitation(token);
      setPhase('sent');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Magic-Link konnte nicht geschickt werden');
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
            <div className="login-brand-sub">Einladung annehmen</div>
          </div>
        </div>

        {phase === 'loading' && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            <Icon name="loader-2" size={20} className="login-spin" />
            <div style={{ marginTop: 10, fontSize: 13 }}>Einladung wird geprüft …</div>
          </div>
        )}

        {phase === 'invalid' && (
          <div style={{ padding: '20px 0' }}>
            <h1>Diese Einladung ist nicht mehr gültig</h1>
            <p className="login-lead">
              Der Einladungs-Link ist ungültig oder wurde bereits eingelöst.
              {errorMsg && (
                <>
                  <br />
                  <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>({errorMsg})</span>
                </>
              )}
            </p>
            <button className="login-btn-secondary" onClick={() => navigate('/')}>
              Zur Startseite
            </button>
          </div>
        )}

        {phase === 'expired' && (
          <div style={{ padding: '20px 0' }}>
            <h1>Einladung abgelaufen</h1>
            <p className="login-lead">
              Der Link war 7 Tage gültig. Bitte frag den Admin nach einer neuen Einladung.
            </p>
            <button className="login-btn-secondary" onClick={() => navigate('/')}>
              Zur Startseite
            </button>
          </div>
        )}

        {phase === 'ready' && data && (
          <div>
            <h1>Hey{data.name ? ` ${data.name.split(' ')[0]}` : ''}!</h1>
            <p className="login-lead">
              Du wurdest als <b>{data.role === 'admin' ? 'Admin' : 'Mitglied'}</b> bei BTM eingeladen.
              Wir schicken dir einen Login-Link an <b>{data.email}</b> — kein Passwort nötig.
            </p>
            <button onClick={accept} className="login-btn-primary">
              <Icon name="mail" size={14} /> Login-Link anfordern
            </button>
            <p className="login-foot">Falls die Mail-Adresse nicht stimmt, sag dem Admin Bescheid.</p>
          </div>
        )}

        {phase === 'sending' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Icon name="loader-2" size={20} className="login-spin" />
            <div style={{ marginTop: 10, fontSize: 13 }}>Login-Link wird verschickt …</div>
          </div>
        )}

        {phase === 'sent' && data && (
          <div className="login-sent">
            <div className="login-sent-icon">
              <Icon name="mail-check" size={36} />
            </div>
            <h2>Mail unterwegs.</h2>
            <p>
              Wir haben dir einen Login-Link an <b>{data.email}</b> geschickt. Der bringt dich beim ersten
              Klick direkt rein.
            </p>
            <p className="login-sent-hint">Link ist 15 Minuten gültig.</p>
          </div>
        )}
      </div>
    </div>
  );
}
