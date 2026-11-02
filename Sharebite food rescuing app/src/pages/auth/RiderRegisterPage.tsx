import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  User, Phone, Mail, MapPin, FileText, Lock, Eye, EyeOff,
  ArrowRight, Loader2, CheckCircle2, AlertCircle,
  Bike, Heart, Leaf,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import riderPhoto from '../../assets/rider_delivery_photo.jpg';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import styles from './RiderRegister.module.css';

/* ─── Official Google Multicolor Icon ─── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

/* ─── ShareBite Logo Component ─── */
function ShareBiteLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.logoFull}>
      <div className={styles.logoIcon}>
        <svg width={compact ? 20 : 24} height={compact ? 20 : 24} viewBox="0 0 40 40" fill="none">
          <path
            d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
            fill="#FF521C"
          />
          <path
            d="M16 12V18M14.5 12V15.5C14.5 16.3 15.2 17 16 17C16.8 17 17.5 16.3 17.5 15.5V12M16 18V23"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M24 12C22.6 12 21.8 13.2 21.8 14.8C21.8 16.4 22.6 17.4 24 17.4V23M24 12C25.4 12 26.2 13.2 26.2 14.8C26.2 16.4 25.4 17.4 24 17.4"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className={styles.logoText}>
        <span className={styles.logoName}>
          <span className={styles.logoShareGreen}>Share</span>
          <span className={styles.logoBiteOrange}>Bite</span>
        </span>
        <span className={styles.logoTagline}>Share Food. Share Hope.</span>
      </div>
    </div>
  );
}

export default function RiderRegisterPage({ initialMode }: { initialMode?: 'register' | 'login' } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, signInWithGoogle } = useAuth();

  const isLoginRoute = initialMode === 'login' || location.pathname.startsWith('/login');
  const [mode, setMode] = useState<'register' | 'login'>(isLoginRoute ? 'login' : 'register');

  // 6 Form fields as defined in the reference screenshot
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'login') {
      if (!email.trim() || !password) {
        setError('Please enter your email and password.');
        return;
      }
      setLoading(true);
      try {
        const loggedInUser = await login(email.trim(), password, 'rider');
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
      } catch (err: any) {
        setError(err.message || 'Login failed. Please check your credentials.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Register mode
    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const fullAddress = address.trim()
        ? regNumber.trim()
          ? `${address.trim()} (Reg: ${regNumber.trim()})`
          : address.trim()
        : regNumber.trim()
        ? `Reg: ${regNumber.trim()}`
        : undefined;

      const res = await signup({
        name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: 'rider',
        password,
        address: fullAddress,
      });

      if (res.sessionExists) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
        return;
      }

      // Try automatic login
      try {
        const loggedInUser = await login(email.trim(), password, 'rider');
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
        return;
      } catch {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle('rider');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Botanical Corner Leaves */}
      <img src={leafTopLeft} className={styles.leafTL} alt="" aria-hidden="true" />
      <img src={leafBottomLeft} className={styles.leafBL} alt="" aria-hidden="true" />
      <img src={authLeavesTopRight} className={styles.leafBR} alt="" aria-hidden="true" />

      {/* ══════════════════════════════ NAVBAR ══════════════════════════════ */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          {/* Brand Logo */}
          <Link to="/" className={styles.navLogoLink}>
            <ShareBiteLogo />
          </Link>

          {/* Navigation links */}
          <nav className={styles.navLinks}>
            <Link to="/" className={`${styles.navLink} ${styles.navLinkActive}`}>Home</Link>
            <Link to="/about" className={styles.navLink}>About</Link>
            <Link to="/how-it-works" className={styles.navLink}>How It Works</Link>
            <Link to="/impact" className={styles.navLink}>Impact</Link>
            <Link to="/contact" className={styles.navLink}>Contact</Link>
          </nav>

          {/* Right badge */}
          <div className={styles.navRight}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.5 2 2 6.5 2 12c0 3.5 1.8 6.6 4.5 8.4C6.2 19 6 17.5 6 16c0-4.4 3.6-8 8-8 1.5 0 3 .4 4.4 1.1C18 4.7 15.3 2 12 2z"
                fill="#064E3B"
              />
              <path
                d="M17 12c-2.8 0-5 2.2-5 5 0 1.2.4 2.3 1.1 3.2 2.8-.7 5-2.8 5.7-5.6-.6-.4-1.2-.6-1.8-.6z"
                fill="#10B981"
              />
            </svg>
            <span className={styles.navHungerText}>A Hunger Free India</span>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════ MAIN ══════════════════════════════ */}
      <main className={styles.main}>
        {/* ─── LEFT HERO SECTION ─── */}
        <section className={styles.hero}>
          {/* Rider Badge */}
          <div className={styles.riderBadge}>
            <Bike size={13} strokeWidth={2.5} />
            <span>RIDER</span>
          </div>

          {/* Main Heading */}
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleGreen}>Ride for a</span>
            <span className={styles.heroTitleOrange}>bigger purpose.</span>
          </h1>

          {/* Description */}
          <p className={styles.heroDesc}>
            Join as a rider and help deliver food to those in need. Be a part of a kinder, healthier India by turning your ride into real impact.
          </p>

          {/* 3 Rider Benefits */}
          <div className={styles.benefitsRow}>
            <div className={styles.benefitItem}>
              <div className={styles.benefitIconCircle}>
                <Bike size={14} strokeWidth={2.2} />
              </div>
              <span>Earn Income</span>
            </div>

            <div className={styles.benefitItem}>
              <div className={styles.benefitIconCircle}>
                <Heart size={13} strokeWidth={2.2} fill="#064E3B" />
              </div>
              <span>Help Communities</span>
            </div>

            <div className={styles.benefitItem}>
              <div className={styles.benefitIconCircle}>
                <Leaf size={13} strokeWidth={2.2} fill="#064E3B" />
              </div>
              <span>Support a Greener Planet</span>
            </div>
          </div>

          {/* Center-Left Rider Photograph Container */}
          <div className={styles.riderPhotoContainer}>
            {/* Background Soft Glow Blob */}
            <div className={styles.photoBlob} />

            {/* Circular photo */}
            <div className={styles.photoCircle}>
              <img
                src={riderPhoto}
                alt="Smiling Indian food delivery rider on motorcycle with orange backpack"
                className={styles.photoImg}
              />
            </div>

            {/* Doodles around photo */}
            {/* Top left curved arrow pointing towards photo */}
            <svg className={styles.decArrowTop} width="36" height="32" viewBox="0 0 45 40" fill="none">
              <path
                d="M5 28C14 12 28 6 38 8"
                stroke="#FF521C"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M31 5L39 8L34 15"
                stroke="#FF521C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Hand-drawn orange heart next to title */}
            <svg className={styles.decHeartCenter} width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 23.5S3 16.5 3 9.5a6 6 0 0 1 10.5-4.2A6 6 0 0 1 24 9.5c0 7-10 14-10 14z"
                stroke="#FF521C"
                strokeWidth="2.2"
                fill="#FF521C"
                fillOpacity="0.15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Floating leaf top right */}
            <svg className={styles.decLeafTopRight} width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M19.5 4.5c-4.5 0-9 2.5-11.5 6.5C6 14.5 5 18 5 19.5c1.5 0 5-1 8.5-3 4-2.5 6-7 6-12z"
                fill="#064E3B"
                opacity="0.85"
              />
            </svg>

            {/* Floating leaf bottom left */}
            <svg className={styles.decLeafBottomLeft} width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 19.5c0-4.5 2.5-9 6.5-11.5C14.5 6 18 5 19.5 5c0 1.5-1 5-3 8.5-2.5 4-7 6-12 6z"
                fill="#064E3B"
                opacity="0.8"
              />
            </svg>

            {/* Curved arrow right */}
            <svg className={styles.decArrowRight} width="30" height="30" viewBox="0 0 35 35" fill="none">
              <path
                d="M10 26C18 25 24 19 25 10"
                stroke="#FF521C"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M20 9L25 9L26 14"
                stroke="#FF521C"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Bottom-left handwritten message */}
          <div className={styles.handwrittenBox}>
            <div className={styles.handwrittenText}>
              Safe rides.<br />
              Fresh meals.<br />
              Happy communities.
            </div>
            <div className={styles.handwrittenDoodle}>
              <svg width="45" height="24" viewBox="0 0 50 26" fill="none">
                <path
                  d="M12 14c-3-3-5-6-5-9a4 4 0 0 1 7-2.5A4 4 0 0 1 21 5c0 3-2 6-5 9z"
                  stroke="#FF521C"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M26 14c4 3 10 4 18 1"
                  stroke="#FF521C"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ─── RIGHT-SIDE REGISTRATION CARD ─── */}
        <aside className={styles.cardCol}>
          <div className={styles.cardInner}>
            {/* A. ShareBite Logo Centered */}
            <div className={styles.cardLogoCenter}>
              <ShareBiteLogo compact />
            </div>

            {/* B. Rider Badge */}
            <div className={styles.cardBadge}>
              <Bike size={11} strokeWidth={2.4} />
              <span>RIDER</span>
            </div>

            {/* C. Registration Heading */}
            <h2 className={styles.cardHeading}>
              {mode === 'login' ? (
                <>
                  <span className={styles.cardHeadingGreen}>Log In to </span>
                  <span className={styles.cardHeadingOrange}>Rider </span>
                  <span className={styles.cardHeadingGreen}>Account</span>
                </>
              ) : (
                <>
                  <span className={styles.cardHeadingGreen}>Register Your </span>
                  <span className={styles.cardHeadingOrange}>Rider </span>
                  <span className={styles.cardHeadingGreen}>Account</span>
                </>
              )}
            </h2>

            {/* D. Subtitle */}
            <p className={styles.cardSubtitle}>
              {mode === 'login'
                ? 'Welcome back! Enter your email and password to start delivering.'
                : 'Join hands with us and help deliver food to those in need.'}
            </p>

            {/* Error & Success States */}
            {error && (
              <div className={styles.alertError} role="alert">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className={styles.alertSuccess} role="status">
                <CheckCircle2 size={15} />
                <div>
                  <span>Account created! Please check your email to confirm, then log in here.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(false);
                      setMode('login');
                    }}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      background: '#15803D',
                      color: '#FFF',
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Log In Here →
                  </button>
                </div>
              </div>
            )}

            {/* E. Form */}
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {/* Register Mode Only Fields */}
              {mode === 'register' && (
                <>
                  {/* Field 1: Full Name */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="rider-fullName">Full Name</label>
                    <div className={styles.inputWrap}>
                      <User size={14} className={styles.inputIcon} />
                      <input
                        id="rider-fullName"
                        type="text"
                        className={styles.input}
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Field 2: Mobile Number */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="rider-phone">Mobile Number</label>
                    <div className={styles.inputWrap}>
                      <Phone size={14} className={styles.inputIcon} />
                      <input
                        id="rider-phone"
                        type="tel"
                        className={styles.input}
                        placeholder="Enter 10 digit mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Field 3: Email Address (Both modes) */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rider-email">Email Address</label>
                <div className={styles.inputWrap}>
                  <Mail size={14} className={styles.inputIcon} />
                  <input
                    id="rider-email"
                    type="email"
                    className={styles.input}
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  {/* Field 4: Address */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="rider-address">Address</label>
                    <div className={styles.inputWrap}>
                      <MapPin size={14} className={styles.inputIcon} />
                      <input
                        id="rider-address"
                        type="text"
                        className={styles.input}
                        placeholder="Enter your complete address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Field 5: Registration Number */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="rider-reg">Registration Number</label>
                    <div className={styles.inputWrap}>
                      <FileText size={14} className={styles.inputIcon} />
                      <input
                        id="rider-reg"
                        type="text"
                        className={styles.input}
                        placeholder="Enter your registration number"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Field 6: Password (Both modes) */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="rider-pass">Password</label>
                <div className={styles.inputWrap}>
                  <Lock size={14} className={styles.inputIcon} />
                  <input
                    id="rider-pass"
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder={mode === 'login' ? 'Enter your password' : 'Create a strong password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* 6. Register CTA Button */}
              <button
                type="submit"
                className={styles.btnRegister}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className={styles.spinner} />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Log In as Rider' : 'Register as Rider'}</span>
                    <ArrowRight size={15} strokeWidth={2.4} />
                  </>
                )}
              </button>

              {/* 7. Divider */}
              <div className={styles.divider}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerText}>Or continue with</span>
                <div className={styles.dividerLine} />
              </div>

              {/* Continue with Google Button */}
              <button
                type="button"
                className={styles.btnGoogle}
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </form>

            {/* 8. Bottom Login Link */}
            <div className={styles.cardFooter}>
              {mode === 'login' ? (
                <>
                  <span>Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className={styles.loginLink}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  <span>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className={styles.loginLink}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
