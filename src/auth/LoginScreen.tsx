import { useState, type FormEvent } from 'react';
import { Icon } from '../components/shared/Icon';
import { useAuth } from './AuthContext';

type Phase = 'idle' | 'sending' | 'sent' | 'error';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setPhase('sending');
    setErrorMsg(null);
    try {
      await signIn(email);
      setPhase('sent');
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : 'Login fehlgeschlagen.');
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <svg viewBox="0 0 32 32" width="44" height="44" fill="none" aria-hidden="true">
            <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#login-bg)" />
            <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="9" width="9" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="15" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="21" width="6" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
            <defs>
              <linearGradient id="login-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1C1A17" />
                <stop offset="1" stopColor="#2A2622" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="login-brand-name">BTM</div>
            <div className="login-brand-sub">Bethesna Task Management</div>
          </div>
        </div>

        {phase === 'sent' ? (
          <div className="login-sent">
            <div className="login-sent-icon">
              <Icon name="mail-check" size={36} />
            </div>
            <h2>Mail unterwegs.</h2>
            <p>
              Wir haben dir einen Login-Link an <b>{email}</b> geschickt. Klick auf den Knopf in der Mail, dann
              bist du drin.
            </p>
            <p className="login-sent-hint">
              Link ist 15 Minuten gültig. Falls nichts ankommt: Spam-Ordner prüfen oder es nochmal versuchen.
            </p>
            <button
              type="button"
              className="login-btn-secondary"
              onClick={() => {
                setPhase('idle');
                setEmail('');
              }}
            >
              Andere Mail verwenden
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="login-form">
            <h1>Einloggen</h1>
            <p className="login-lead">
              Gib deine E-Mail-Adresse ein. Wir schicken dir einen Login-Link — kein Passwort, keine Registrierung.
            </p>

            <label className="login-label" htmlFor="login-email">
              E-Mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="dein.name@bethesna.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={phase === 'sending'}
              className="login-input"
            />

            {phase === 'error' && errorMsg && <div className="login-error">{errorMsg}</div>}

            <button type="submit" disabled={phase === 'sending' || !email.includes('@')} className="login-btn-primary">
              {phase === 'sending' ? (
                <>
                  <Icon name="loader-2" size={14} className="login-spin" /> Wird geschickt …
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={14} /> Login-Link schicken
                </>
              )}
            </button>

            <p className="login-foot">
              Noch keinen Zugang? Frag deinen Admin nach einer Einladung — BTM ist einladungs-basiert.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
