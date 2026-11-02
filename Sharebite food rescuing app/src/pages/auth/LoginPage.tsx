import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Leaf, 
  Users, 
  Cloud, 
  Loader2,
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import authFoodSharingImg from '../../assets/auth_food_sharing.png';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './AuthPage.module.css';

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleDemoLogin = async (role: 'donor' | 'ngo' | 'volunteer' | 'admin') => {
    setError('');
    setDemoLoading(role);
    try {
      const demoUser = await loginAsDemo(role);
      navigate(getRoleDashboardPath(demoUser.role));
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setDemoLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password || 'demo123');
      navigate(getRoleDashboardPath(loggedInUser.role));
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Organic Background Blobs */}
      <div className={styles.bgBlobLeft} aria-hidden="true" />
      <div className={styles.bgBlobRight} aria-hidden="true" />

      {/* Botanical Corner Leaves */}
      <img src={leafTopLeft} className={styles.leafTopLeft} alt="" />
      <img src={leafBottomLeft} className={styles.leafBottomLeft} alt="" />
      <img src={authLeavesTopRight} className={styles.leafTopRight} alt="" />

      {/* Top Bar Logo */}
      <header className={styles.topNav}>
        <Link to="/" className={styles.brandLink}>
          <div className={styles.logoBadge}>SB</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>ShareBite</span>
            <span className={styles.brandTagline}>Share Food. Share Hope.</span>
          </div>
        </Link>
      </header>

      {/* Main Split Content */}
      <main className={styles.authContainer}>
        
        {/* Left Column: Brand Showcase */}
        <section className={styles.leftShowcase}>
          
          {/* Pill Badge */}
          <div className={styles.badge}>
            <Leaf className={styles.badgeIcon} />
            <span>Food Rescue Platform</span>
          </div>

          {/* Editorial Headline */}
          <h1 className={styles.headline}>
            Good food should<br />
            <span className={styles.accent}>never go to waste.</span>
          </h1>

          {/* Subtitle */}
          <p className={styles.subheadline}>
            Share surplus food with people and communities who need it most. 
            Together we can reduce food waste, fight hunger and build a kinder tomorrow.
          </p>

          {/* 3 Impact Pillars Row */}
          <div className={styles.pillarsRow}>
            <div className={styles.pillarItem}>
              <div className={styles.pillarIconBox}>
                <Leaf size={18} />
              </div>
              <div className={styles.pillarLabel}>
                Reduce<br />Food Waste
              </div>
            </div>

            <div className={styles.pillarDivider} />

            <div className={styles.pillarItem}>
              <div className={styles.pillarIconBox}>
                <Users size={18} />
              </div>
              <div className={styles.pillarLabel}>
                Support<br />Communities
              </div>
            </div>

            <div className={styles.pillarDivider} />

            <div className={styles.pillarItem}>
              <div className={styles.pillarIconBox}>
                <Cloud size={18} />
              </div>
              <div className={styles.pillarLabel}>
                Lower<br />CO₂ Emissions
              </div>
            </div>
          </div>

          {/* Handwritten Cursive Note */}
          <div className={styles.scriptHeaderWrap}>
            <div className={styles.scriptNote}>
              Real food.<br />
              Real people.<br />
              Real impact.
              <div className={styles.scriptHeart}>♡</div>
            </div>
          </div>

          {/* Authentic Food Sharing Visual */}
          <div className={styles.foodSharingVisualWrap}>
            <img 
              src={authFoodSharingImg} 
              alt="Hands sharing a warm nutritious bowl of food" 
              className={styles.foodSharingImage}
            />
          </div>

        </section>

        {/* Right Column: Floating Auth Card */}
        <section className={styles.rightCardWrap}>
          <div className={styles.authCard}>
            
            {/* Card Brand Header */}
            <div className={styles.cardTopHeader}>
              <div className={styles.cardLogoContainer}>
                <div className={styles.logoBadge}>SB</div>
                <div className={styles.brandText}>
                  <span className={styles.brandTitle}>ShareBite</span>
                  <span className={styles.brandTagline}>Share Food. Share Hope.</span>
                </div>
              </div>
              <h2 className={styles.cardTitle}>Welcome back</h2>
              <p className={styles.cardSubtitle}>
                Log in to your ShareBite account to continue making an impact.
              </p>
            </div>

            {/* Quick 1-Click Demo Login Box */}
            <div className={styles.demoBanner}>
              <div className={styles.demoBannerHeader}>
                <span className={styles.demoBannerTitle}>
                  <Sparkles size={14} /> Quick Demo Login
                </span>
                <span className={styles.demoBannerBadge}>Instant Access</span>
              </div>
              <p className={styles.demoBannerDesc}>
                Click any role for instant 1-click login without database:
              </p>
              <div className={styles.demoRolesGrid}>
                <button
                  type="button"
                  className={styles.demoRoleCard}
                  onClick={() => handleDemoLogin('donor')}
                  disabled={demoLoading !== null || loading}
                >
                  <span className={styles.demoRoleIcon}>🍱</span>
                  <div className={styles.demoRoleInfo}>
                    <span className={styles.demoRoleName}>Food Donor</span>
                    <span className={styles.demoRoleSub}>Restaurant / Store</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.demoRoleCard}
                  onClick={() => handleDemoLogin('ngo')}
                  disabled={demoLoading !== null || loading}
                >
                  <span className={styles.demoRoleIcon}>🏢</span>
                  <div className={styles.demoRoleInfo}>
                    <span className={styles.demoRoleName}>NGO / Shelter</span>
                    <span className={styles.demoRoleSub}>Claim & Distribute</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.demoRoleCard}
                  onClick={() => handleDemoLogin('volunteer')}
                  disabled={demoLoading !== null || loading}
                >
                  <span className={styles.demoRoleIcon}>🤝</span>
                  <div className={styles.demoRoleInfo}>
                    <span className={styles.demoRoleName}>Volunteer</span>
                    <span className={styles.demoRoleSub}>Rescue Hero</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.demoRoleCard}
                  onClick={() => handleDemoLogin('admin')}
                  disabled={demoLoading !== null || loading}
                >
                  <span className={styles.demoRoleIcon}>🛡️</span>
                  <div className={styles.demoRoleInfo}>
                    <span className={styles.demoRoleName}>Admin</span>
                    <span className={styles.demoRoleSub}>Management</span>
                  </div>
                </button>
              </div>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className={styles.form}>
              
              {/* Email Address */}
              <div className={styles.field}>
                <label className={styles.label}>Or sign in with custom email</label>
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="Enter any email (e.g. test@example.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="Any password (e.g. 123456)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Forgot Password Link */}
              <div className={styles.forgotLinkWrap}>
                <Link to="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className={styles.submitBtn} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className={styles.divider}>or</div>

              {/* Continue with Google */}
              <button
                type="button"
                className={styles.googleBtn}
                onClick={() => alert('Google authentication is integrated with Supabase OAuth.')}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>

              {/* Switch to Signup */}
              <p className={styles.switchFooter}>
                Don't have an account?
                <Link to="/signup" className={styles.switchLink}>Sign up</Link>
              </p>

            </form>

          </div>
        </section>

      </main>
    </div>
  );
}
