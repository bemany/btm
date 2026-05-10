import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/shared/Icon';
import { showToast } from '../components/shared/Toast';
import { useAuth } from './AuthContext';
import { useT } from '../i18n';

type Phase = 'idle' | 'sending' | 'sent' | 'error';

export function LoginScreen() {
  const { signIn } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Auto-Login wenn URL `?as=email&code=123456` enthält (Admin-Magic-Link).
  // Wird genau einmal pro Mount ausgeführt — danach URL bereinigt.
  const autoTriedRef = useRef(false);
  useEffect(() => {
    if (autoTriedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const asEmail = params.get('as');
    const asCode = params.get('code');
    if (!asEmail || !asCode || !/^\d{6}$/.test(asCode)) return;
    autoTriedRef.current = true;
    setEmail(asEmail);
    setCode(asCode);
    setPhase('sent');
    // Direkt verifizieren
    void (async () => {
      try {
        const r = await fetch('/api/login-code', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: asEmail, code: asCode, callbackURL: '/' }),
        });
        if (!r.ok) throw new Error('invalid');
        const { verifyUrl } = (await r.json()) as { verifyUrl: string };
        // URL bereinigen, dann auf verifyUrl
        window.history.replaceState({}, '', '/');
        window.location.href = verifyUrl;
      } catch {
        setErrorMsg(t('login.code_invalid'));
        showToast(t('login.code_invalid'));
      }
    })();
  }, [t]);

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
      setErrorMsg(e instanceof Error ? e.message : t('toast.save_failed'));
    }
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const r = await fetch('/api/login-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: trimmed, callbackURL: '/' }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? t('login.code_invalid'));
      }
      const { verifyUrl } = (await r.json()) as { verifyUrl: string };
      window.location.href = verifyUrl;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('login.code_invalid'));
      showToast(e instanceof Error ? e.message : t('login.code_invalid'));
      setVerifying(false);
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
            <div className="login-brand-sub">{t('login.brand_sub')}</div>
          </div>
        </div>

        {phase === 'sent' ? (
          <div className="login-sent">
            <div className="login-sent-icon">
              <Icon name="mail-check" size={36} />
            </div>
            <h2>{t('login.sent_title')}</h2>
            <p>{t('login.sent_body', { email })}</p>

            <form onSubmit={verifyCode} className="login-code-form">
              <label className="login-label" htmlFor="login-code">
                {t('login.code_label')}
              </label>
              <input
                id="login-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={verifying}
                className="login-input login-code-input"
                autoFocus
              />
              {errorMsg && <div className="login-error">{errorMsg}</div>}
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="login-btn-primary"
              >
                {verifying ? (
                  <>
                    <Icon name="loader-2" size={14} className="login-spin" /> {t('login.code_verifying')}
                  </>
                ) : (
                  <>
                    <Icon name="key" size={14} /> {t('login.code_submit')}
                  </>
                )}
              </button>
            </form>

            <p className="login-sent-hint">{t('login.sent_hint')}</p>
            <button
              type="button"
              className="login-btn-secondary"
              onClick={() => {
                setPhase('idle');
                setEmail('');
                setCode('');
                setErrorMsg(null);
              }}
            >
              {t('login.other_email')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="login-form">
            <h1>{t('login.title')}</h1>
            <p className="login-lead">{t('login.lead')}</p>

            <label className="login-label" htmlFor="login-email">
              {t('login.email_label')}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder={t('login.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={phase === 'sending'}
              className="login-input"
            />

            {phase === 'error' && errorMsg && <div className="login-error">{errorMsg}</div>}

            <button
              type="submit"
              disabled={phase === 'sending' || !email.includes('@')}
              className="login-btn-primary"
            >
              {phase === 'sending' ? (
                <>
                  <Icon name="loader-2" size={14} className="login-spin" /> {t('login.submitting')}
                </>
              ) : (
                <>
                  <Icon name="sparkles" size={14} /> {t('login.submit')}
                </>
              )}
            </button>

            <p className="login-foot">{t('login.foot')}</p>
          </form>
        )}
      </div>
    </div>
  );
}
