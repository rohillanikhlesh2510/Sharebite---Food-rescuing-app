import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ShareBite ErrorBoundary caught an error:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#FFFDF9',
            color: '#1C1917',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              background: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #FDE68A',
              boxShadow: '0 10px 30px rgba(28, 25, 23, 0.08)',
              padding: '32px 28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.35rem', fontWeight: 700 }}>
              {this.props.fallbackTitle || 'Something went wrong'}
            </h1>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.95rem', color: '#57534E', lineHeight: 1.5 }}>
              ShareBite hit an unexpected error while rendering this view. Your account data is safe.
            </p>

            {this.state.error?.message && (
              <div
                style={{
                  background: '#FAFAF9',
                  border: '1px solid #E7E5E4',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: '#78716C',
                  marginBottom: 20,
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                Try Again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid #E7E5E4',
                  background: '#FFFFFF',
                  color: '#1C1917',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #E7E5E4',
                  background: '#FAFAF9',
                  color: '#44403C',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                <Home size={16} />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
