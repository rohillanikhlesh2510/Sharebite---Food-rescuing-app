import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, LogOut, RefreshCw, Home } from 'lucide-react';

interface AuthStateScreenProps {
  mode: 'loading' | 'error' | 'profile_missing' | 'invalid_role';
  title?: string;
  message?: string | null;
  onRetry?: () => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
}

export function AuthStateScreen({
  mode,
  title,
  message,
  onRetry,
  onSignOut,
}: AuthStateScreenProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'retry' | 'signout' | null>(null);

  if (mode === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 24,
          background: 'var(--color-bg, #FFFDF9)',
          color: 'var(--color-text, #1C1917)',
        }}
      >
        <Loader2
          size={36}
          color="#EA580C"
          style={{ animation: 'spin 0.9s linear infinite' }}
        />
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#57534E' }}>
          {message || 'Verifying your ShareBite session & role...'}
        </p>
      </div>
    );
  }

  const resolvedTitle =
    title ||
    (mode === 'profile_missing'
      ? 'Account Profile Incomplete'
      : mode === 'invalid_role'
        ? 'Account Role Unrecognized'
        : 'Unable to Load Your Account');

  const resolvedMessage =
    message ||
    (mode === 'profile_missing'
      ? 'We signed you in, but your ShareBite profile record could not be located. Please retry or sign out.'
      : mode === 'invalid_role'
        ? 'Your account does not have a valid role assigned. Rather than redirecting you to the wrong dashboard, please retry or sign out.'
        : 'There was a problem loading your account details. Please check your connection and try again.');

  const handleRetry = async () => {
    if (!onRetry || busy) return;
    setBusy('retry');
    try {
      await onRetry();
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    if (!onSignOut || busy) return;
    setBusy('signout');
    try {
      await onSignOut();
      navigate('/register', { replace: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg, #FFFDF9)',
        color: '#1C1917',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #FECACA',
          boxShadow: '0 10px 30px rgba(28, 25, 23, 0.08)',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#FEF2F2',
            color: '#DC2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <AlertCircle size={28} />
        </div>

        <h1 style={{ margin: '0 0 8px 0', fontSize: '1.35rem', fontWeight: 700 }}>
          {resolvedTitle}
        </h1>
        <p style={{ margin: '0 0 22px 0', fontSize: '0.94rem', color: '#57534E', lineHeight: 1.5 }}>
          {resolvedMessage}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={busy !== null}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 10,
                border: 'none',
                background: '#EA580C',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={16} />
              <span>{busy === 'retry' ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={busy !== null}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 10,
                border: '1px solid #E7E5E4',
                background: '#FFFFFF',
                color: '#1C1917',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              <LogOut size={16} />
              <span>{busy === 'signout' ? 'Signing out...' : 'Sign Out & Switch Account'}</span>
            </button>
          )}

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 4,
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#57534E',
              textDecoration: 'none',
            }}
          >
            <Home size={15} />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AuthStateScreen;
