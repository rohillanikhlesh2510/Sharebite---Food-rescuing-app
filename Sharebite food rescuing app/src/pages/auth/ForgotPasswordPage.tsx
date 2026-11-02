import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './AuthPage.module.css';

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgBlobLeft} aria-hidden="true" />
      <div className={styles.bgBlobRight} aria-hidden="true" />
      <img src={leafTopLeft} className={styles.leafTopLeft} alt="" />
      <img src={leafBottomLeft} className={styles.leafBottomLeft} alt="" />
      <img src={authLeavesTopRight} className={styles.leafTopRight} alt="" />

      <header className={styles.topNav}>
        <Link to="/" className={styles.brandLink}>
          <div className={styles.logoBadge}>SB</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>ShareBite</span>
            <span className={styles.brandTagline}>Share Food. Share Hope.</span>
          </div>
        </Link>
      </header>

      <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px', width: '100%', zIndex: 2 }}>
        <div className={styles.authCard}>
          <div className={styles.cardTopHeader}>
            <h2 className={styles.cardTitle}>Reset Password</h2>
            <p className={styles.cardSubtitle}>
              Enter your email address and we'll send you a secure link to reset your password.
            </p>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Check your email</h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>
                We've sent a password reset link to <strong>{email}</strong>. Follow the instructions in the email to set a new password.
              </p>
              <Link to="/login" className={styles.submitBtn} style={{ display: 'inline-flex', justifyContent: 'center' }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.authForm}>
              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link to="/login" style={{ fontSize: 14, color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
