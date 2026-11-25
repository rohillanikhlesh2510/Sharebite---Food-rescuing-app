import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import { supabase } from '../../lib/supabase';
import leafTopLeft from '../../assets/leaf_top_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './RoleAuth.module.css';

function getInitialOAuthError(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.substring(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const errorParam = searchParams.get('error') || hashParams.get('error');
  const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
  if (!errorParam) return null;
  return errorDesc || errorParam || 'Authentication was cancelled or denied.';
}

export default function AuthCallbackPage() {
  const { handleOAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(() => getInitialOAuthError());
  const [attempting, setAttempting] = useState(() => getInitialOAuthError() === null);

  useEffect(() => {
    if (error) return;
    let mounted = true;
    const searchParams = new URLSearchParams(window.location.search);

    async function processAuth() {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.warn('exchangeCodeForSession warning:', exchangeErr.message);
          }
        }

        const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
          setTimeout(() => resolve({ timeout: true }), 8000)
        );

        const authPromise = handleOAuthCallback().then((user) => ({
          timeout: false as const,
          user,
        }));

        const result = await Promise.race([authPromise, timeoutPromise]);

        if (!mounted) return;

        if ('timeout' in result && result.timeout) {
          setError('Authentication verification timed out. Please retry or sign in with email & password.');
          setAttempting(false);
          return;
        }

        if ('user' in result) {
          const targetPath = getRoleDashboardPath(result.user.role);
          if (!targetPath) {
            setError(`Your account role ("${result.user.role}") is unrecognized. Please contact support.`);
            setAttempting(false);
            return;
          }
          navigate(targetPath, { replace: true });
        }
      } catch (err: any) {
        console.error('OAuth callback failed:', err);
        if (mounted) {
          setError(
            err?.message ||
            'Google authentication could not be completed. Please sign in with your email or try again.'
          );
          setAttempting(false);
        }
      }
    }

    void processAuth();

    return () => {
      mounted = false;
    };
  }, [error, handleOAuthCallback, navigate]);

  return (
    <div className={styles.page}>
      <img src={leafTopLeft} className={styles.leafTopLeft} alt="" />
      <img src={authLeavesTopRight} className={styles.leafTopRight} alt="" />

      <header className={styles.header}>
        <div className={styles.logoRow}>
          <div className={styles.logoBadge}>
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
          <div className={styles.logoTextCol}>
            <span className={styles.logoTitle}>ShareBite</span>
            <span className={styles.logoTagline}>Share Food. Share Hope.</span>
          </div>
        </div>
      </header>

      <main className={styles.singleColContainer} style={{ marginTop: 40 }}>
        <div className={styles.roleCard}>
          <div className={styles.cardInner} style={{ textAlign: 'center', padding: '40px 28px' }}>
            {error ? (
              <>
                <div style={{ color: '#DC2626', marginBottom: 16 }}>
                  <AlertCircle size={46} style={{ margin: '0 auto' }} />
                </div>
                <h2 className={styles.cardHeadline} style={{ fontSize: '1.45rem', marginBottom: 8 }}>
                  Authentication Status
                </h2>
                <p className={styles.cardSubtext} style={{ color: '#991B1B', marginBottom: 20 }}>
                  {error}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className={styles.submitBtn}
                  >
                    <span>Proceed to Dashboard</span>
                    <ArrowRight size={16} />
                  </button>

                  <Link
                    to="/register"
                    className={styles.googleBtn}
                    style={{ textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <span>Sign In with Email & Password</span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: '#BD5927', marginBottom: 18 }}>
                  <Loader2
                    size={42}
                    className="animate-spin"
                    style={{ margin: '0 auto', animation: 'spin 1s linear infinite' }}
                  />
                </div>
                <h2 className={styles.cardHeadline} style={{ fontSize: '1.5rem', marginBottom: 8 }}>
                  Verifying your account
                </h2>
                <p className={styles.cardSubtext} style={{ marginBottom: 20 }}>
                  Syncing your authoritative role with ShareBite and preparing your dashboard...
                </p>

                {attempting && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#BD5927',
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Taking too long? Click here to check Dashboard →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
