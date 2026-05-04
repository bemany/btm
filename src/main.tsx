import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { AppGate } from './auth/AppGate';
import { installErrorToaster } from './lib/errorToaster';

installErrorToaster();

import './styles/globio-tokens.css';
import './styles/btm.css';
import './styles/btm-glass.css';
import './styles/btm-dark.css';
import './styles/btm-admin.css';
import './styles/cmdk.css';
import './styles/sidebar-profile.css';
import './styles/auth.css';
import './styles/api-tokens.css';
import './styles/landing.css';
import './styles/tv-route.css';

// Theme früh setzen — sonst hat der Login-Screen kein Glass.
const VALID_THEMES = ['default', 'glass', 'default-dark', 'glass-dark'] as const;
type ValidTheme = (typeof VALID_THEMES)[number];
try {
  const raw = localStorage.getItem('btm.tweaks.v1');
  const t = raw ? (JSON.parse(raw).theme as string | undefined) : undefined;
  document.body.dataset.theme = (VALID_THEMES as readonly string[]).includes(t ?? '')
    ? (t as ValidTheme)
    : 'glass';
} catch {
  document.body.dataset.theme = 'glass';
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('BTM crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 32,
            fontFamily: 'var(--font-body, system-ui, sans-serif)',
            color: 'var(--ink-900, #1C1A17)',
            background: 'var(--cream-50, #FAF7F2)',
            minHeight: '100vh',
          }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>BTM ist abgestürzt.</h1>
          <p style={{ marginBottom: 16 }}>
            Wahrscheinlich ein korrupter Demo-State. Versuch einmal{' '}
            <button
              onClick={() => {
                localStorage.removeItem('btm.state.v5');
                location.reload();
              }}
              style={{ padding: '6px 12px', borderRadius: 6 }}
            >
              State zurücksetzen
            </button>
            .
          </p>
          <pre style={{ fontSize: 12, color: 'var(--err-700, #842828)', whiteSpace: 'pre-wrap' }}>
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppGate>
            <App />
          </AppGate>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
