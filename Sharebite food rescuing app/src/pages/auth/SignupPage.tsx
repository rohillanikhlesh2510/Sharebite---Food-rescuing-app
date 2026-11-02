import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Building2, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Leaf, 
  Users, 
  Cloud, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';
import { GoogleIcon } from './LoginPage';
import authFoodSharingImg from '../../assets/auth_food_sharing.png';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './AuthPage.module.css';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'donor', label: 'Food Donor', desc: 'Restaurant, caterer, home' },
  { value: 'ngo', label: 'NGO / Shelter', desc: 'Rescue & distribute' },
  { value: 'volunteer', label: 'Volunteer', desc: 'Help transport food' },
];

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState<UserRole>((searchParams.get('role') as UserRole) || 'donor');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const needsOrg = role === 'ngo' || role === 'donor';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !phone || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await signup({
        name,
        email,
        phone,
        password,
        role,
        organizationName: needsOrg ? orgName : undefined,
      });
      if (result.sessionExists) {
        navigate('/dashboard');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <header className={styles.topNav}>
          <Link to="/" className={styles.brandLink}>
            <div className={styles.logoBadge}>SB</div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>ShareBite</span>
              <span className={styles.brandTagline}>Share Food. Share Hope.</span>
            </div>
          </Link>
        </header>
        <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <div className={styles.authCard}>
            <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 16px auto' }} />
            <h2 className={styles.cardTitle}>Account Created!</h2>
            <p className={styles.cardSubtitle} style={{ marginBottom: 24 }}>
              We have sent a verification email to <strong>{email}</strong>. Please check your inbox to activate your account.
            </p>
            <Link to="/login" className={styles.submitBtn}>
              <span>Go to Log In</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              <h2 className={styles.cardTitle}>Create an account</h2>
              <p className={styles.cardSubtitle}>
                Join our community to start sharing or receiving surplus food.
              </p>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className={styles.form}>
              
              {/* Role Selection */}
              <div className={styles.field}>
                <label className={styles.label}>I want to join as</label>
                <div className={styles.roleGrid}>
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={`${styles.roleBtn} ${role === r.value ? styles.roleBtnActive : ''}`}
                      onClick={() => setRole(r.value)}
                    >
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <div className={styles.inputWrap}>
                  <User size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Organization Name (if donor or NGO) */}
              {needsOrg && (
                <div className={styles.field}>
                  <label className={styles.label}>Organization / Restaurant name</label>
                  <div className={styles.inputWrap}>
                    <Building2 size={16} className={styles.inputIcon} />
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Green Bowl Cafe or Seva Foundation"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className={styles.field}>
                <label className={styles.label}>Email address</label>
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className={styles.field}>
                <label className={styles.label}>Phone number</label>
                <div className={styles.inputWrap}>
                  <Phone size={16} className={styles.inputIcon} />
                  <input
                    type="tel"
                    className={styles.input}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
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
                    placeholder="Create a password (min 6 chars)"
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

              {/* Submit Button */}
              <button 
                type="submit" 
                className={styles.submitBtn} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Get Started</span>
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

              {/* Switch to Login */}
              <p className={styles.switchFooter}>
                Already have an account?
                <Link to="/login" className={styles.switchLink}>Log in</Link>
              </p>

            </form>

          </div>
        </section>

      </main>
    </div>
  );
}
