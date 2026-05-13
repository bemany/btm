import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { LandingPage } from '../landing/LandingPage';
import { InvitePage } from './InvitePage';
import { useServerSync } from '../data/sync';
import { useEventStream } from '../data/sse';
import { isLoginPath, matchInvite, matchTVFullscreen, navigate, useLocation } from '../router';
import { TVRoute } from '../landing/TVRoute';

function AuthenticatedShell({ children }: { children: ReactNode }) {
  useServerSync();
  useEventStream(true); // SSE — invalidiert TanStack-Queries live
  return <>{children}</>;
}

export function AppGate({ children }: { children: ReactNode }) {
  const { status, refresh } = useAuth();
  const location = useLocation();

  // Better-Auth callback redirect → ?token=… in der URL → einmal refreshen + cleanup.
  // ABER: /tv?token=… ist ein API-Token für Fullscreen-Display, NICHT zum Aufräumen.
  // Auch /invite/<token> hat einen Token im Pfad, aber kein Query-Param.
  useEffect(() => {
    if (status === 'anon') {
      const url = new URL(window.location.href);
      const hasToken = url.searchParams.has('token');
      const fromMagic = url.pathname.startsWith('/login-success');
      const isTvRoute = url.pathname === '/tv' || url.pathname === '/tv/';
      if ((hasToken && !isTvRoute) || fromMagic) {
        url.searchParams.delete('token');
        history.replaceState({}, '', url.pathname + url.search);
        refresh();
        if (!isLoginPath(window.location.pathname)) navigate('/login', { replace: true });
      }
    }
  }, [status, refresh]);

  // Hash-Deeplink #login (von der Mail z.B.) → /login
  useEffect(() => {
    if (window.location.hash === '#login' && !isLoginPath(window.location.pathname)) {
      navigate('/login', { replace: true });
    }
  }, []);

  // Eingeloggte User sollten nicht auf /login oder Landing rumstehen
  useEffect(() => {
    if (status === 'authenticated' && isLoginPath(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [status, location.pathname]);

  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <div className="auth-loading-inner">
          <svg className="auth-loading-mark" viewBox="0 0 32 32" fill="none">
            <rect x="0" y="0" width="32" height="32" rx="8" fill="#1C1A17" />
            <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.3" />
            <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.3" />
            <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.3" />
            <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
          </svg>
          <div className="auth-loading-text">BTM lädt …</div>
        </div>
      </div>
    );
  }

  // /tv?token=… → Fullscreen-Modus (Bearer-Auth, kein Login nötig).
  // /tv ohne Token + nicht eingeloggt → Token-Hinweis.
  // /tv ohne Token + eingeloggt → fällt durch zur normalen App (Sidebar + TV-Screen).
  const tvToken = matchTVFullscreen(location.pathname, location.search);
  if (tvToken) {
    return <TVRoute token={tvToken} />;
  }
  if ((location.pathname === '/tv' || location.pathname === '/tv/') && status === 'anon') {
    return <TVRoute token={null} />;
  }

  // /invite/:token funktioniert für anon UND auth (auch ein eingeloggter User
  // kann eine Einladung über den Token-Link annehmen, z.B. Rolle/Team-Update).
  const inviteToken = matchInvite(location.pathname);
  if (inviteToken) {
    return <InvitePage token={inviteToken} />;
  }

  if (status === 'anon') {
    // Admin-Magic-Link: URL hat ?as=email&code=123456 (Bug FKMsD4WmmOX).
    // Auch ohne /login-Pfad zum LoginScreen routen damit der dortige
    // Auto-Login-Pfad greift — sonst landet der Empfaenger auf der
    // Landing und die Query-Params gehen beim ersten Klick verloren.
    const params = new URLSearchParams(location.search);
    const hasMagic = !!params.get('as') && /^\d{6}$/.test(params.get('code') ?? '');
    if (hasMagic || isLoginPath(location.pathname)) return <LoginScreen />;
    return <LandingPage onLogin={() => navigate('/login')} />;
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
