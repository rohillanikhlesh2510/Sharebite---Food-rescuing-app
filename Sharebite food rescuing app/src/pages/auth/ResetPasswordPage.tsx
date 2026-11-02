import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './AuthPage.module.css';

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
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
            <h2 className={styles.cardTitle}>Set New Password</h2>
            <p className={styles.cardSubtitle}>
              Please enter your new password below to secure your account.
            </p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Password Updated!</h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 20 }}>
                Your password has been changed successfully. Redirecting you to your dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.authForm}>
              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="Enter new password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <span>Updating password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
