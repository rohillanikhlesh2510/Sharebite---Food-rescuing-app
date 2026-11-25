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

export type ValidRole = 'donor' | 'acceptor' | 'rider';

interface RoleAuthPageProps {
  forcedRole?: ValidRole;
  initialMode?: 'signup' | 'login';
}

export default function RoleAuthPage({ forcedRole, initialMode }: RoleAuthPageProps) {
  const { role: routeRole } = useParams<{ role?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup, signInWithGoogle } = useAuth();

  // Mode: Sign up vs Log In
  const isLoginRoute = initialMode === 'login' || location.pathname.startsWith('/login');
  const [isLogin, setIsLogin] = useState(isLoginRoute);

  // Active role for mobile view or highlights
  const rawRole = (forcedRole || routeRole || 'donor').toLowerCase();
  const initialRole: ValidRole = (rawRole === 'acceptor' || rawRole === 'ngo')
    ? 'acceptor'
    : rawRole === 'rider'
    ? 'rider'
    : 'donor';
  const [activeMobileRole, setActiveMobileRole] = useState<ValidRole>(initialRole);

  useEffect(() => {
    setIsLogin(location.pathname.startsWith('/login'));
  }, [location.pathname]);

  useEffect(() => {
    if (routeRole) {
      const r = routeRole.toLowerCase();
      if (r === 'acceptor' || r === 'ngo') setActiveMobileRole('acceptor');
      else if (r === 'rider') setActiveMobileRole('rider');
      else setActiveMobileRole('donor');
    }
  }, [routeRole]);

  // Card 1: Donor State
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPassword, setDonorPassword] = useState('');
  const [donorShowPass, setDonorShowPass] = useState(false);
  const [donorLoading, setDonorLoading] = useState(false);
  const [donorGoogleLoading, setDonorGoogleLoading] = useState(false);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [donorSuccess, setDonorSuccess] = useState(false);

  // Card 2: Acceptor State
  const [acceptorOrgName, setAcceptorOrgName] = useState('');
  const [acceptorContactPerson, setAcceptorContactPerson] = useState('');
  const [acceptorOrgAddress, setAcceptorOrgAddress] = useState('');
  const [acceptorRegNumber, setAcceptorRegNumber] = useState('');
  const [acceptorEmail, setAcceptorEmail] = useState('');
  const [acceptorPhone, setAcceptorPhone] = useState('');
  const [acceptorPassword, setAcceptorPassword] = useState('');
  const [acceptorShowPass, setAcceptorShowPass] = useState(false);
  const [acceptorLoading, setAcceptorLoading] = useState(false);
  const [acceptorGoogleLoading, setAcceptorGoogleLoading] = useState(false);
  const [acceptorError, setAcceptorError] = useState<string | null>(null);
  const [acceptorSuccess, setAcceptorSuccess] = useState(false);

  // Card 3: Rider State
  const [riderName, setRiderName] = useState('');
  const [riderDob, setRiderDob] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [riderPassword, setRiderPassword] = useState('');
  const [riderShowPass, setRiderShowPass] = useState(false);
  const [riderLoading, setRiderLoading] = useState(false);
  const [riderGoogleLoading, setRiderGoogleLoading] = useState(false);
  const [riderError, setRiderError] = useState<string | null>(null);
  const [riderSuccess, setRiderSuccess] = useState(false);

  // Google OAuth triggers
  const handleGoogleAuth = async (role: ValidRole) => {
    if (role === 'donor') setDonorGoogleLoading(true);
    if (role === 'acceptor') setAcceptorGoogleLoading(true);
    if (role === 'rider') setRiderGoogleLoading(true);

    try {
      await signInWithGoogle(role);
    } catch (err: any) {
      const msg = err.message || 'Google sign-in could not be started.';
      if (role === 'donor') setDonorError(msg);
      if (role === 'acceptor') setAcceptorError(msg);
      if (role === 'rider') setRiderError(msg);
    } finally {
      setDonorGoogleLoading(false);
      setAcceptorGoogleLoading(false);
      setRiderGoogleLoading(false);
    }
  };

  // Switch between Login and Signup modes
  const handleModeChange = (targetLogin: boolean) => {
    setIsLogin(targetLogin);
    setDonorError(null);
    setAcceptorError(null);
    setRiderError(null);
    const prefix = targetLogin ? '/login' : '/register';
    navigate(prefix);
  };

  // Submit Handler for Food Donor
  const handleDonorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDonorError(null);

    if (!donorEmail.trim() || !donorPassword) {
      setDonorError('Please enter your email and password.');
      return;
    }

    if (isLogin) {
      setDonorLoading(true);
      try {
        const loggedInUser = await login(donorEmail.trim(), donorPassword, 'donor');
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
      } catch (err: any) {
        setDonorError(err.message || 'Login failed.');
      } finally {
        setDonorLoading(false);
      }
      return;
    }

    if (!donorName.trim()) {
      setDonorError('Please enter your full name.');
      return;
    }
    if (donorPassword.length < 6) {
      setDonorError('Password must be at least 6 characters.');
      return;
    }

    setDonorLoading(true);
    try {
      const res = await signup({
        name: donorName.trim(),
        phone: donorPhone.trim() || '+91 9876543210',
        email: donorEmail.trim(),
        role: 'donor',
        password: donorPassword,
      });

      if (res.sessionExists) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
      } else {
        setDonorSuccess(true);
      }
    } catch (err: any) {
      setDonorError(err.message || 'Signup failed.');
    } finally {
      setDonorLoading(false);
    }
  };

  // Submit Handler for Acceptor
  const handleAcceptorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcceptorError(null);

    if (!acceptorEmail.trim() || !acceptorPassword) {
      setAcceptorError('Please enter organisation email and password.');
      return;
    }

    if (isLogin) {
      setAcceptorLoading(true);
      try {
        const loggedInUser = await login(acceptorEmail.trim(), acceptorPassword, 'acceptor');
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
      } catch (err: any) {
        setAcceptorError(err.message || 'Login failed.');
      } finally {
        setAcceptorLoading(false);
      }
      return;
    }

    if (!acceptorOrgName.trim()) {
      setAcceptorError('Please enter your organisation name.');
      return;
    }
    if (!acceptorContactPerson.trim()) {
      setAcceptorError('Please enter contact person name.');
      return;
    }
    if (!acceptorOrgAddress.trim()) {
      setAcceptorError('Please enter organisation address.');
      return;
    }
    if (acceptorPassword.length < 6) {
      setAcceptorError('Password must be at least 6 characters.');
      return;
    }

    setAcceptorLoading(true);
    try {
      const res = await signup({
        name: acceptorContactPerson.trim(),
        phone: acceptorPhone.trim() || '+91 9876543210',
        email: acceptorEmail.trim(),
        role: 'acceptor',
        password: acceptorPassword,
        organizationName: acceptorOrgName.trim(),
        registrationNumber: acceptorRegNumber.trim() || undefined,
        address: acceptorOrgAddress.trim(),
      });

      if (res.sessionExists) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
      } else {
        setAcceptorSuccess(true);
      }
    } catch (err: any) {
      setAcceptorError(err.message || 'Organisation registration failed.');
    } finally {
      setAcceptorLoading(false);
    }
  };

  // Submit Handler for Rider
  const handleRiderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRiderError(null);

    if (!riderEmail.trim() || !riderPassword) {
      setRiderError('Please enter rider email and password.');
      return;
    }

    if (isLogin) {
      setRiderLoading(true);
      try {
        const loggedInUser = await login(riderEmail.trim(), riderPassword, 'rider');
        navigate(getRoleDashboardPath(loggedInUser.role), { replace: true });
      } catch (err: any) {
        setRiderError(err.message || 'Login failed.');
      } finally {
        setRiderLoading(false);
      }
      return;
    }

    if (!riderName.trim()) {
      setRiderError('Please enter your full name.');
      return;
    }
    if (!riderDob.trim()) {
      setRiderError('Please enter your date of birth (DD/MM/YYYY).');
      return;
    }
    if (riderPassword.length < 6) {
      setRiderError('Password must be at least 6 characters.');
      return;
    }

    setRiderLoading(true);
    try {
      const res = await signup({
        name: riderName.trim(),
        phone: riderPhone.trim() || '+91 9876543210',
        email: riderEmail.trim(),
        role: 'rider',
        password: riderPassword,
        dateOfBirth: riderDob.trim(),
      });

      if (res.sessionExists) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
      } else {
        setRiderSuccess(true);
      }
    } catch (err: any) {
      setRiderError(err.message || 'Rider registration failed.');
    } finally {
      setRiderLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Corner Botanical Leaves matching Screenshot */}
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

        {/* Flanking Rules Banner matching Screenshot */}
        <div className={styles.bannerRow}>
          <div className={styles.bannerLine} />
          <div className={styles.bannerText}>
            Different Roles <span className={styles.bannerDot}>•</span> Same Mission{' '}
            <span className={styles.bannerDot}>•</span> A Hunger Free India
          </div>
          <div className={styles.bannerLine} />
        </div>
      </header>

      {/* Mode Controls & Mobile Role Selector */}
      <div className={styles.controlsBar}>
        {/* Sign Up vs Log In Switch */}
        <div className={styles.modeToggle} role="tablist" aria-label="Authentication Mode">
          <button
            type="button"
            className={`${styles.modeBtn} ${!isLogin ? styles.modeBtnActive : ''}`}
            onClick={() => handleModeChange(false)}
          >
            Create Account
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${isLogin ? styles.modeBtnActive : ''}`}
            onClick={() => handleModeChange(true)}
          >
            Log In
          </button>
        </div>

        {/* Mobile-only Role Tab Selector */}
        <div className={styles.mobileRoleSelector} role="tablist" aria-label="Mobile Role Switcher">
          <button
            type="button"
            className={`${styles.mobileRoleBtn} ${activeMobileRole === 'donor' ? styles.mobileRoleBtnActive : ''}`}
            onClick={() => setActiveMobileRole('donor')}
          >
            🍴 Food Donor
          </button>
          <button
            type="button"
            className={`${styles.mobileRoleBtn} ${activeMobileRole === 'acceptor' ? styles.mobileRoleBtnActive : ''}`}
            onClick={() => setActiveMobileRole('acceptor')}
          >
            👥 NGO / Shelter
          </button>
          <button
            type="button"
            className={`${styles.mobileRoleBtn} ${activeMobileRole === 'rider' ? styles.mobileRoleBtnActive : ''}`}
            onClick={() => setActiveMobileRole('rider')}
          >
            🚲 Rider
          </button>
        </div>
      </div>

      {/* 3-COLUMN DESKTOP GRID — MATCHING THE SCREENSHOT EXACTLY */}
      <main className={styles.desktopGrid}>
        {/* ============================================================
            COLUMN 1: FOOD DONOR
            ============================================================ */}
        <article
          className={`${styles.roleCard} ${activeMobileRole === 'donor' ? styles.roleCardActive : ''}`}
          style={{ display: window.innerWidth <= 1120 && activeMobileRole !== 'donor' ? 'none' : 'flex' }}
        >
          <div className={styles.cardInner}>
            <div className={styles.pillBadge}>
              <Utensils size={13} />
              <span>FOOD DONOR</span>
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

            <h2 className={styles.cardHeadline}>
              {isLogin ? (
                <>Welcome back, <span className={styles.cardHeadlineAccent}>Donor.</span></>
              ) : (
                <>Share surplus <span className={styles.cardHeadlineAccent}>food.</span></>
              )}
            </h2>
            <p className={styles.cardSubtext}>
              For restaurants, hostels, caterers, hotels and event organizers. Turn your extra food into someone&apos;s next meal.
            </p>

            {donorError && (
              <div className={`${styles.cardAlert} ${styles.cardAlertError}`}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{donorError}</span>
              </div>
            )}

            {donorSuccess ? (
              <div className={`${styles.cardAlert} ${styles.cardAlertSuccess}`}>
                <CheckCircle2 size={16} />
                <span>Donor account registered! Check your email to confirm or proceed to log in.</span>
              </div>
            ) : (
              <form onSubmit={handleDonorSubmit} className={styles.authForm} noValidate>
                {!isLogin && (
                  <>
                    <div className={styles.inputWrap}>
                      <User size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Full name"
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <Phone size={16} className={styles.inputIcon} />
                      <input
                        type="tel"
                        placeholder="Mobile number"
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        className={styles.inputField}
                      />
                    </div>
                  </>
                )}

                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={donorShowPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={donorPassword}
                    onChange={(e) => setDonorPassword(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setDonorShowPass(!donorShowPass)}
                    aria-label="Toggle password visibility"
                  >
                    {donorShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {isLogin && (
                  <Link to="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => handleGoogleAuth('donor')}
                  disabled={donorGoogleLoading || donorLoading}
                  className={styles.googleBtn}
                >
                  {donorGoogleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={donorLoading || donorGoogleLoading}
                  className={styles.submitBtn}
                >
                  {donorLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isLogin ? (
                    'Log in as Donor →'
                  ) : (
                    'Create donor account →'
                  )}
                </button>

                <div className={styles.cardFooter}>
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(false)}
                        className={styles.cardFooterLink}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(true)}
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
                src={roleDonorIllus}
                alt="Chef in kitchen cooking surplus meals with love"
                className={styles.cardIllustration}
                loading="lazy"
              />
            </div>
          </div>
        </article>

        {/* ============================================================
            COLUMN 2: NGO / SHELTER / ACCEPTOR
            ============================================================ */}
        <article
          className={`${styles.roleCard} ${activeMobileRole === 'acceptor' ? styles.roleCardActive : ''}`}
          style={{ display: window.innerWidth <= 1120 && activeMobileRole !== 'acceptor' ? 'none' : 'flex' }}
        >
          <div className={styles.cardInner}>
            <div className={styles.pillBadge}>
              <Users size={13} />
              <span>NGO / SHELTER</span>
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

            <h2 className={styles.cardHeadline}>
              {isLogin ? (
                <>Welcome back, <span className={styles.cardHeadlineAccent}>Partner.</span></>
              ) : (
                <>Feed your <span className={styles.cardHeadlineAccent}>community.</span></>
              )}
            </h2>
            <p className={styles.cardSubtext}>
              For NGOs, shelters and community organisations. Get verified, access food donations and help people in need.
            </p>

            {acceptorError && (
              <div className={`${styles.cardAlert} ${styles.cardAlertError}`}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{acceptorError}</span>
              </div>
            )}

            {acceptorSuccess ? (
              <div className={`${styles.cardAlert} ${styles.cardAlertSuccess}`}>
                <CheckCircle2 size={16} />
                <span>Organisation registered! Verification is in review. You can log in to explore available meals.</span>
              </div>
            ) : (
              <form onSubmit={handleAcceptorSubmit} className={styles.authForm} noValidate>
                {!isLogin && (
                  <>
                    <div className={styles.inputWrap}>
                      <Building2 size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Organisation name"
                        value={acceptorOrgName}
                        onChange={(e) => setAcceptorOrgName(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <User size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Owner / Contact person name"
                        value={acceptorContactPerson}
                        onChange={(e) => setAcceptorContactPerson(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <MapPin size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Organisation address"
                        value={acceptorOrgAddress}
                        onChange={(e) => setAcceptorOrgAddress(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <FileText size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Registration number"
                        value={acceptorRegNumber}
                        onChange={(e) => setAcceptorRegNumber(e.target.value)}
                        className={styles.inputField}
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <Phone size={16} className={styles.inputIcon} />
                      <input
                        type="tel"
                        placeholder="Mobile number"
                        value={acceptorPhone}
                        onChange={(e) => setAcceptorPhone(e.target.value)}
                        className={styles.inputField}
                      />
                    </div>
                  </>
                )}

                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={acceptorEmail}
                    onChange={(e) => setAcceptorEmail(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={acceptorShowPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={acceptorPassword}
                    onChange={(e) => setAcceptorPassword(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setAcceptorShowPass(!acceptorShowPass)}
                    aria-label="Toggle password visibility"
                  >
                    {acceptorShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {isLogin && (
                  <Link to="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => handleGoogleAuth('acceptor')}
                  disabled={acceptorGoogleLoading || acceptorLoading}
                  className={styles.googleBtn}
                >
                  {acceptorGoogleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={acceptorLoading || acceptorGoogleLoading}
                  className={styles.submitBtn}
                >
                  {acceptorLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isLogin ? (
                    'Log in as Acceptor →'
                  ) : (
                    'Register organisation →'
                  )}
                </button>

                {!isLogin && (
                  <div className={styles.noticeRow}>
                    <CheckCircle2 size={14} className={styles.noticeIcon} />
                    <span>Verification required before claiming donations.</span>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(false)}
                        className={styles.cardFooterLink}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(true)}
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
                src={roleAcceptorIllus}
                alt="Volunteers packing food donations for communities"
                className={styles.cardIllustration}
                loading="lazy"
              />
            </div>
          </div>
        </article>

        {/* ============================================================
            COLUMN 3: RIDER
            ============================================================ */}
        <article
          className={`${styles.roleCard} ${activeMobileRole === 'rider' ? styles.roleCardActive : ''}`}
          style={{ display: window.innerWidth <= 1120 && activeMobileRole !== 'rider' ? 'none' : 'flex' }}
        >
          <div className={styles.cardInner}>
            <div className={styles.pillBadge}>
              <Bike size={13} />
              <span>RIDER</span>
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

            <h2 className={styles.cardHeadline}>
              {isLogin ? (
                <>Welcome back, <span className={styles.cardHeadlineAccent}>Rider.</span></>
              ) : (
                <>Deliver hope, <span className={styles.cardHeadlineAccent}>one pickup at a time.</span></>
              )}
            </h2>
            <p className={styles.cardSubtext}>
              For food delivery partners. Pick up food from donors and get it to those who need it. Be a part of a kinder, healthier India.
            </p>

            {riderError && (
              <div className={`${styles.cardAlert} ${styles.cardAlertError}`}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{riderError}</span>
              </div>
            )}

            {riderSuccess ? (
              <div className={`${styles.cardAlert} ${styles.cardAlertSuccess}`}>
                <CheckCircle2 size={16} />
                <span>Rider registered! Verification is in progress. You can log in to view active delivery routes.</span>
              </div>
            ) : (
              <form onSubmit={handleRiderSubmit} className={styles.authForm} noValidate>
                {!isLogin && (
                  <>
                    <div className={styles.inputWrap}>
                      <User size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Full name"
                        value={riderName}
                        onChange={(e) => setRiderName(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <Calendar size={16} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Date of birth (DD/MM/YYYY)"
                        value={riderDob}
                        onChange={(e) => setRiderDob(e.target.value)}
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.inputWrap}>
                      <Phone size={16} className={styles.inputIcon} />
                      <input
                        type="tel"
                        placeholder="Mobile number"
                        value={riderPhone}
                        onChange={(e) => setRiderPhone(e.target.value)}
                        className={styles.inputField}
                      />
                    </div>
                  </>
                )}

                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={riderEmail}
                    onChange={(e) => setRiderEmail(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                </div>

                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={riderShowPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={riderPassword}
                    onChange={(e) => setRiderPassword(e.target.value)}
                    className={styles.inputField}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eyeToggle}
                    onClick={() => setRiderShowPass(!riderShowPass)}
                    aria-label="Toggle password visibility"
                  >
                    {riderShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {isLogin && (
                  <Link to="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => handleGoogleAuth('rider')}
                  disabled={riderGoogleLoading || riderLoading}
                  className={styles.googleBtn}
                >
                  {riderGoogleLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={riderLoading || riderGoogleLoading}
                  className={styles.submitBtn}
                >
                  {riderLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isLogin ? (
                    'Log in as Rider →'
                  ) : (
                    'Create rider account →'
                  )}
                </button>

                {!isLogin && (
                  <div className={styles.noticeRow}>
                    <CheckCircle2 size={14} className={styles.noticeIcon} />
                    <span>Rider verification required.</span>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(false)}
                        className={styles.cardFooterLink}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => handleModeChange(true)}
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
                src={roleRiderIllus}
                alt="Delivery rider on bicycle with orange backpack"
                className={styles.cardIllustration}
                loading="lazy"
              />
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
