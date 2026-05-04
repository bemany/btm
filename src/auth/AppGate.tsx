import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';

export function AppGate({ children }: { children: ReactNode }) {
  const { status, refresh } = useAuth();

  // Better-Auth schickt nach erfolgreichem Magic-Link-Verify auf callbackURL=/
  // mit Query-Param `?token=…` zurück. In dem Fall noch ein refresh, danach Cleanup.
  useEffect(() => {
    if (status === 'anon') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token') || url.pathname.startsWith('/login-success')) {
        url.searchParams.delete('token');
        history.replaceState({}, '', url.pathname + url.search);
        refresh();
      }
    }
  }, [status, refresh]);

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

  if (status === 'anon') {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
