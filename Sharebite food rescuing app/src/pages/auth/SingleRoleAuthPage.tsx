import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  MapPin,
  FileText,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Utensils,
  Users,
  Bike,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import leafTopLeft from '../../assets/leaf_top_left.png';
import authLeavesTopRight from '../../assets/auth_leaves_top_right.png';
import roleDonorIllus from '../../assets/role_donor_illus.png';
import roleAcceptorIllus from '../../assets/role_acceptor_illus.png';
import roleRiderIllus from '../../assets/role_rider_illus.png';
import styles from './RoleAuth.module.css';

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export type ValidRole = 'donor' | 'acceptor' | 'rider' | 'community';

interface SingleRoleAuthPageProps {
  forcedRole?: ValidRole;
  initialMode?: 'signup' | 'login';
}

export default function SingleRoleAuthPage({ forcedRole, initialMode }: SingleRoleAuthPageProps) {
  const { role: routeRole } = useParams<{ role?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup, signInWithGoogle } = useAuth();

  // Mode: Sign up vs Log In
  const isLoginRoute = initialMode === 'login' || location.pathname.startsWith('/login');
  const [isLogin, setIsLogin] = useState(isLoginRoute);

  useEffect(() => {
    setIsLogin(location.pathname.startsWith('/login'));
  }, [location.pathname]);

  // Determine active single role
  const rawRole = (forcedRole || routeRole || 'donor').toLowerCase();
  const activeRole: ValidRole = (rawRole === 'acceptor' || rawRole === 'ngo')
    ? 'acceptor'
    : rawRole === 'rider'
    ? 'rider'
    : rawRole === 'community' || rawRole === 'volunteer'
    ? 'community'
    : 'donor';

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Acceptor specific fields
  const [orgName, setOrgName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [regNumber, setRegNumber] = useState('');

  // Rider specific fields
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Status state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchRedirect, setMismatchRedirect] = useState<{ path: string; label: string } | null>(null);
  const [successConfirmation, setSuccessConfirmation] = useState(false);

  // Google OAuth
  const handleGoogleAuth = async () => {
    setError(null);
    setMismatchRedirect(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(activeRole === 'community' ? 'donor' : activeRole);
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be started.');
      setGoogleLoading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMismatchRedirect(null);

    if (!email.trim() || !password) {
      setError('Please provide your email and password.');
      return;
    }

    if (isLogin) {
      setLoading(true);
      try {
        const loggedInUser = await login(email.trim(), password, activeRole === 'community' ? 'volunteer' : activeRole);
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
      } catch (err: any) {
        const msg = err.message || 'Login failed. Please check your credentials.';
        if (msg.includes('ROLE_MISMATCH:')) {
          const match = msg.match(/portal at (\/login\/[a-z]+)/);
          const redirectPath = match ? match[1] : '/login';
          const readableRole = redirectPath.includes('acceptor')
            ? 'Acceptor (NGO) Portal'
            : redirectPath.includes('rider')
            ? 'Rider Portal'
            : 'Food Donor Portal';
          setMismatchRedirect({ path: redirectPath, label: readableRole });
          setError(msg.replace('ROLE_MISMATCH: ', ''));
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Signup Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if ((activeRole === 'donor' || activeRole === 'community') && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (activeRole === 'acceptor') {
      if (!orgName.trim()) {
        setError('Please enter your organisation name.');
        return;
      }
      if (!contactPerson.trim()) {
        setError('Please enter the contact person name.');
        return;
      }
      if (!orgAddress.trim()) {
        setError('Please enter organisation address.');
        return;
      }
    }

    if (activeRole === 'rider') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!dateOfBirth.trim()) {
        setError('Please enter your date of birth (DD/MM/YYYY).');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await signup({
        name: activeRole === 'acceptor' ? contactPerson : fullName,
        phone: phone.trim() || '+91 9876543210',
        email: email.trim(),
        role: activeRole === 'community' ? 'volunteer' : activeRole,
        password,
        organizationName: activeRole === 'acceptor' ? orgName : undefined,
        registrationNumber: activeRole === 'acceptor' ? regNumber : undefined,
        address: activeRole === 'acceptor' ? orgAddress : undefined,
        dateOfBirth: activeRole === 'rider' ? dateOfBirth : undefined,
      });

      if (res.sessionExists) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
      } else {
        setSuccessConfirmation(true);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Role Metadata Config
  const roleConfig = {
    donor: {
      pill: 'FOOD DONOR',
      pillIcon: <Utensils size={13} />,
      signupHeadline: (
        <>
          Share surplus <span style={{ color: '#BD5927' }}>food.</span>
        </>
      ),
      loginHeadline: (
        <>
          Welcome back, <span style={{ color: '#BD5927' }}>Donor.</span>
        </>
      ),
      subtext:
        'For restaurants, hostels, caterers, hotels and event organizers. Turn your extra food into someone’s next meal.',
      signupBtn: 'Create donor account →',
      loginBtn: 'Log In as Donor →',
      illustration: roleDonorIllus,
      alt: 'Chef in kitchen preparing food trays',
      notice: null,
    },
    acceptor: {
      pill: 'NGO / SHELTER',
      pillIcon: <Users size={13} />,
      signupHeadline: (
        <>
          Feed your <span style={{ color: '#BD5927' }}>community.</span>
        </>
      ),
      loginHeadline: (
        <>
          Welcome back, <span style={{ color: '#BD5927' }}>Partner.</span>
        </>
      ),
      subtext:
        'For NGOs, shelters and community organisations. Get verified, access food donations and help people in need.',
      signupBtn: 'Register organisation →',
      loginBtn: 'Log In as Acceptor →',
      illustration: roleAcceptorIllus,
      alt: 'Volunteers packing meals with boxes',
      notice: 'Verification required before claiming donations.',
    },
    rider: {
      pill: 'RIDER',
      pillIcon: <Bike size={13} />,
      signupHeadline: (
        <>
          Deliver hope, <span style={{ color: '#BD5927' }}>one pickup at a time.</span>
        </>
      ),
      loginHeadline: (
        <>
          Welcome back, <span style={{ color: '#BD5927' }}>Rider.</span>
        </>
      ),
      subtext:
        'For food delivery partners. Pick up food from donors and get it to those who need it. Be a part of a kinder, healthier India.',
      signupBtn: 'Create rider account →',
      loginBtn: 'Log In as Rider →',
      illustration: roleRiderIllus,
      alt: 'Delivery rider with bicycle and backpack',
      notice: 'Rider verification required.',
    },
    community: {
      pill: 'COMMUNITY MEMBER',
      pillIcon: <User size={13} />,
      signupHeadline: (
        <>
          Support, donate, <span style={{ color: '#BD5927' }}>make a difference.</span>
        </>
      ),
      loginHeadline: (
        <>
          Welcome back, <span style={{ color: '#BD5927' }}>Community Member.</span>
        </>
      ),
      subtext:
        'For individuals, volunteers and community champions. Find nearby food drives, request food support, and make a real difference in people’s lives.',
      signupBtn: 'Join the community →',
      loginBtn: 'Log In as Community Member →',
      illustration: roleDonorIllus,
      alt: 'Community volunteers sharing food with locals',
      notice: null,
    },
  }[activeRole];

  return (
    <div className={styles.page}>
      {/* Corner Botanical Leaves */}
      <img src={leafTopLeft} className={styles.leafTopLeft} alt="" />
      <img src={authLeavesTopRight} className={styles.leafTopRight} alt="" />

      {/* Main Top Header */}
      <header className={styles.header}>
        <Link to="/" className={styles.logoRow}>
          <div className={styles.logoBadge}>
            <svg width="25" height="25" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
                fill="#FFFFFF"
              />
              <path
                d="M16 12V18M14.5 12V15.5C14.5 16.3 15.2 17 16 17C16.8 17 17.5 16.3 17.5 15.5V12M16 18V23"
                stroke="#BD5927"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M24 12C22.6 12 21.8 13.2 21.8 14.8C21.8 16.4 22.6 17.4 24 17.4V23M24 12C25.4 12 26.2 13.2 26.2 14.8C26.2 16.4 25.4 17.4 24 17.4"
                stroke="#BD5927"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className={styles.logoTextCol}>
            <span className={styles.logoTitle}>ShareBite</span>
            <span className={styles.logoTagline}>Share Food. Share Hope.</span>
          </div>
        </Link>

        {/* Flanking Rules Banner */}
        <div className={styles.bannerRow}>
          <div className={styles.bannerLine} />
          <div className={styles.bannerText}>
            Different Roles <span className={styles.bannerDot}>•</span> Same Mission{' '}
            <span className={styles.bannerDot}>•</span> A Hunger Free India
          </div>
          <div className={styles.bannerLine} />
        </div>
      </header>

      {/* Top Navigation: Change Role and Mode */}
      <div className={styles.controlsBar}>
        <Link
          to={isLogin ? '/login' : '/register'}
          className={styles.modeBtn}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#FFFFFF',
            border: '1px solid #DDD7CD',
            textDecoration: 'none',
            color: '#2F3530',
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={14} />
          <span>← Choose Another Role / Role Badlein</span>
        </Link>

        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${!isLogin ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setIsLogin(false);
              navigate(`/register/${activeRole}`);
            }}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${isLogin ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setIsLogin(true);
              navigate(`/login/${activeRole}`);
            }}
          >
            Log In
          </button>
        </div>
      </div>

      {/* SINGLE DEDICATED CENTERED CARD */}
      <main
        style={{
          maxWidth: 480,
          margin: '12px auto 0 auto',
          padding: '0 20px',
          width: '100%',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div className={styles.roleCard} style={{ width: '100%' }}>
          <div className={styles.cardInner}>
            <div className={styles.pillBadge}>
              {roleConfig.pillIcon}
              <span>{roleConfig.pill}</span>
            </div>

            <div className={styles.miniBrand}>
              <div className={styles.miniBrandBadge}>
                <svg width="15" height="15" viewBox="0 0 40 40" fill="none">
                  <path
                    d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
                    fill="#FFFFFF"
                  />
                </svg>
              </div>
              <div className={styles.miniBrandText}>
                <span className={styles.miniBrandTitle}>ShareBite</span>
                <span className={styles.miniBrandTag}>Share Food. Share Hope.</span>
              </div>
            </div>

            <h1 className={styles.cardHeadline}>
              {isLogin ? roleConfig.loginHeadline : roleConfig.signupHeadline}
            </h1>
            <p className={styles.cardSubtext}>{roleConfig.subtext}</p>

            {error && (
              <div className={`${styles.cardAlert} ${styles.cardAlertError}`}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <span>{error}</span>
                  {mismatchRedirect && (
                    <div>
                      <Link to={mismatchRedirect.path} className={styles.mismatchBtn}>
                        Go to {mismatchRedirect.label} →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {successConfirmation ? (
              <div className={`${styles.cardAlert} ${styles.cardAlertSuccess}`}>
                <CheckCircle2 size={18} />
                <div>
                  <strong>Account Created!</strong>
                  <p style={{ marginTop: 4, fontSize: '0.8rem' }}>
                    Registration successful. Please proceed to log in with your email and password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessConfirmation(false);
                      setIsLogin(true);
                      navigate(`/login/${activeRole}`);
                    }}
                    className={styles.mismatchBtn}
                    style={{ marginTop: 8 }}
                  >
                    Proceed to Log In →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
                {/* 1. ROLE SPECIFIC SIGNUP FIELDS */}
                {!isLogin && (
                  <>
                    {/* Donor fields */}
                    {activeRole === 'donor' && (
                      <>
                        <div className={styles.inputWrap}>
                          <User size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <Phone size={16} className={styles.inputIcon} />
                          <input
                            type="tel"
                            placeholder="Mobile number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={styles.inputField}
                          />
                        </div>
                      </>
                    )}

                    {/* Acceptor fields */}
                    {activeRole === 'acceptor' && (
                      <>
                        <div className={styles.inputWrap}>
                          <Building2 size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Organisation name"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <User size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Owner / Contact person name"
                            value={contactPerson}
                            onChange={(e) => setContactPerson(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <MapPin size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Organisation address"
                            value={orgAddress}
                            onChange={(e) => setOrgAddress(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <FileText size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Registration number"
                            value={regNumber}
                            onChange={(e) => setRegNumber(e.target.value)}
                            className={styles.inputField}
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <Phone size={16} className={styles.inputIcon} />
                          <input
                            type="tel"
                            placeholder="Mobile number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={styles.inputField}
                          />
                        </div>
                      </>
                    )}

                    {/* Rider fields */}
                    {activeRole === 'rider' && (
                      <>
                        <div className={styles.inputWrap}>
                          <User size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <Calendar size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder="Date of birth (DD/MM/YYYY)"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className={styles.inputField}
                            required
                          />
                        </div>
                        <div className={styles.inputWrap}>
                          <Phone size={16} className={styles.inputIcon} />
                          <input
                            type="tel"
                            placeholder="Mobile number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={styles.inputField}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* 2. SHARED FIELDS (Email & Password) */}
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {!isLogin && (
                  <div className={styles.inputWrap}>
                    <Lock size={16} className={styles.inputIcon} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={styles.inputField}
                      required
                    />
                    <button
                      type="button"
                      className={styles.eyeToggle}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                {isLogin && (
                  <Link to="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                )}

                {/* Google OAuth Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={googleLoading || loading}
                  className={styles.googleBtn}
                >
                  {googleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Autofill Demo Credentials for Instant Test */}
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRole === 'donor') {
                        setEmail('anubhavt675@gmail.com');
                        setPassword('password123');
                      } else if (activeRole === 'acceptor') {
                        setEmail('nikhleshrohilla2@gmail.com');
                        setPassword('password123');
                      } else {
                        setEmail('rider@sharebite.org');
                        setPassword('password123');
                      }
                    }}
                    style={{
                      background: '#F5F2EB',
                      border: '1px dashed #C8BFB0',
                      borderRadius: '9px',
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      color: '#65503C',
                      cursor: 'pointer',
                      margin: '4px 0 2px 0',
                      textAlign: 'center',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>⚡ Quick Test: Autofill {roleConfig.pill} Demo Credentials</span>
                  </button>
                )}

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className={styles.submitBtn}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isLogin ? (
                    roleConfig.loginBtn
                  ) : (
                    roleConfig.signupBtn
                  )}
                </button>

                {/* Role-specific Notice */}
                {!isLogin && roleConfig.notice && (
                  <div className={styles.noticeRow}>
                    <CheckCircle2 size={14} className={styles.noticeIcon} />
                    <span>{roleConfig.notice}</span>
                  </div>
                )}

                {/* Bottom Toggle Link */}
                <div className={styles.cardFooter}>
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(false);
                          navigate(`/register/${activeRole}`);
                        }}
                        className={styles.cardFooterLink}
                      >
                        Sign up as {roleConfig.pill}
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(true);
                          navigate(`/login/${activeRole}`);
                        }}
                        className={styles.cardFooterLink}
                      >
                        Log in
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {/* Bottom Photo Illustration */}
            <div className={styles.cardIllustrationWrap}>
              <img
                src={roleConfig.illustration}
                alt={roleConfig.alt}
                className={styles.cardIllustration}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
