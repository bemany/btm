import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

import './styles/globio-tokens.css';
import './styles/btm.css';
import './styles/btm-glass.css';
import './styles/cmdk.css';

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
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
