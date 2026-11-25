import { useMemo } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Search, Utensils, MapPin, ClipboardList,
  BarChart2, User, Settings, ShieldCheck, ShieldAlert, X, Leaf,
  Truck, Plus, MessageSquare, Heart, Building2, Home, Wallet, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { ShareBiteLogo } from './Navbar';
import UserAvatar from '../ui/UserAvatar';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  highlight?: boolean;
  matchPaths?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = normalizeRole(user?.role);
  const isRider = role === 'rider';

  // Purpose-built navigation strictly segregated by trusted role
  // Donor, NGO, Community, and Admin menus remain 100% preserved.
  const roleNavItems = useMemo<NavItem[]>(() => {
    if (!role) return [];
    switch (role) {
      case 'rider':
        return [
          {
            to: '/rider-dashboard',
            icon: <Home size={18} />,
            label: 'Dashboard',
            matchPaths: ['/rider-dashboard', '/rider/dashboard'],
          },
          {
            to: '/rider/deliveries',
            icon: <Truck size={18} />,
            label: 'My Deliveries',
            matchPaths: ['/rider/deliveries', '/rider/available-food'],
          },
          {
            to: '/rider/earnings',
            icon: <Wallet size={18} />,
            label: 'Earnings',
          },
          {
            to: '/profile',
            icon: <User size={18} />,
            label: 'Profile',
          },
          {
            to: '/settings',
            icon: <Settings size={18} />,
            label: 'Settings',
          },
        ];

      case 'ngo':
        return [
          { to: '/ngo-dashboard', icon: <LayoutGrid size={18} />, label: 'NGO Hub' },
          { to: '/discover', icon: <Search size={18} />, label: 'Claim Surplus Food', highlight: true },
          { to: '/ngos', icon: <Building2 size={18} />, label: 'Find NGOs Across India' },
          { to: '/my-claims', icon: <ClipboardList size={18} />, label: 'Incoming Deliveries', badge: 'Active' },
          { to: '/requests', icon: <Utensils size={18} />, label: 'Distribution Log' },
          { to: '/map', icon: <MapPin size={18} />, label: 'Live Food Map' },
          { to: '/chat', icon: <MessageSquare size={18} />, label: 'Coordination Chat' },
          { to: '/impact-dashboard', icon: <BarChart2 size={18} />, label: 'Relief Impact' },
          { to: '/verification', icon: <ShieldCheck size={18} />, label: 'NGO Verification' },
          { to: '/profile', icon: <User size={18} />, label: 'Organisation Profile' },
          { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
        ];

      case 'community':
        return [
          { to: '/community-dashboard', icon: <Heart size={18} />, label: 'Community Meals' },
          { to: '/discover', icon: <Search size={18} />, label: 'Find Free Food' },
          { to: '/requests', icon: <ClipboardList size={18} />, label: 'My Food Requests' },
          { to: '/map', icon: <MapPin size={18} />, label: 'Distribution Centers' },
          { to: '/chat', icon: <MessageSquare size={18} />, label: 'Messages' },
          { to: '/profile', icon: <User size={18} />, label: 'My Profile' },
          { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
        ];

      case 'admin':
        return [
          { to: '/admin', icon: <ShieldAlert size={18} />, label: 'Admin Command Portal' },
          { to: '/donations', icon: <Utensils size={18} />, label: 'All Food Listings' },
          { to: '/rider-dashboard', icon: <Truck size={18} />, label: 'Fleet Operations' },
          { to: '/my-claims', icon: <ClipboardList size={18} />, label: 'NGO Claims' },
          { to: '/impact-dashboard', icon: <BarChart2 size={18} />, label: 'Platform Analytics' },
          { to: '/verification', icon: <ShieldCheck size={18} />, label: 'Partner Verification' },
          { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
        ];

      case 'donor':
        return [
          { to: '/donor-dashboard', icon: <LayoutGrid size={18} />, label: 'Donor Dashboard' },
          { to: '/donations/new', icon: <Plus size={18} />, label: 'Donate Surplus Food', highlight: true },
          { to: '/donor-donations', icon: <Truck size={18} />, label: 'Track Deliveries & History' },
          { to: '/discover', icon: <Search size={18} />, label: 'Explore Network' },
          { to: '/ngos', icon: <Building2 size={18} />, label: 'Find NGOs Across India' },
          { to: '/chat', icon: <MessageSquare size={18} />, label: 'Rider & NGO Chat' },
          { to: '/impact-dashboard', icon: <BarChart2 size={18} />, label: 'Food & CO2 Impact' },
          { to: '/profile', icon: <User size={18} />, label: 'Donor Profile' },
          { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
        ];
    }
  }, [role]);

  const roleLabel = useMemo(() => {
    if (!role) return 'ShareBite Member';
    switch (role) {
      case 'rider':
        return '🚴 Logistics Fleet Partner';
      case 'ngo':
        return '🏛️ Community NGO Relief';
      case 'community':
        return '🤝 Community Member';
      case 'admin':
        return '🛡️ Platform Administrator';
      case 'donor':
        return '🌱 Verified Food Donor';
    }
  }, [role]);

  const handleSidebarLogout = async () => {
    if (window.innerWidth < 1024) onClose();
    await logout();
    navigate('/');
  };

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isRider ? styles.riderSidebar : ''} ${open ? styles.open : ''}`}>
        {isRider ? (
          <div className={styles.riderBrandTop}>
            <Link to="/rider-dashboard" className={styles.riderLogoLink} onClick={() => { if (window.innerWidth < 1024) onClose(); }}>
              <ShareBiteLogo />
            </Link>
            <button className={styles.closeBtnMobileOnly} onClick={onClose} aria-label="Close sidebar">
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarBrand}>
              <ShareBiteLogo />
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
              <X size={18} />
            </button>
          </div>
        )}

        {user && !isRider && (
          <div className={styles.userCard}>
            <UserAvatar size={48} src={user.avatar} name={user.name} />
            <div className={styles.userInfo}>
              <p className={styles.userInfoName}>{user.name || 'Member'}</p>
              <div className={styles.userBadgeRow}>
                <span className={styles.roleBadge}>
                  {roleLabel}
                </span>
              </div>
              <p className={styles.userTagline}>
                {role === 'ngo' ? 'Feeding communities 🍲' : 'Sharing food, saving lives 🌱'}
              </p>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          {roleNavItems.map(item => {
            const customActive = item.matchPaths
              ? item.matchPaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))
              : undefined;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => {
                  const active = customActive ?? isActive;
                  return `${styles.navItem} ${active ? styles.navItemActive : ''} ${item.highlight ? styles.navItemHighlight : ''}`;
                }}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    marginLeft: 'auto',
                    background: '#ea580c',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10
                  }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}

          {isRider && (
            <button
              type="button"
              className={`${styles.navItem} ${styles.logoutNavBtn}`}
              onClick={handleSidebarLogout}
            >
              <span className={styles.navIcon}><LogOut size={18} /></span>
              <span className={styles.navLabel}>Logout</span>
            </button>
          )}
        </nav>

        {/* Donor Action Card (100% preserved) */}
        {role === 'donor' && (
          <div style={{ margin: '16px 14px', padding: 14, background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 12 }}>
            <p style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 700, color: '#9a3412' }}>Have excess food today?</p>
            <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#7c2d12' }}>Publish it now so a rider can collect it before closing.</p>
            <Link
              to="/donations/new"
              onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#ea580c', color: '#fff', padding: '6px 12px',
                borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none'
              }}
            >
              <Plus size={14} /> Donate Surplus Food
            </Link>
          </div>
        )}

        {isRider ? (
          <div className={styles.riderHungerCard}>
            <div className={styles.scooterGraphic} aria-hidden="true">
              <svg width="88" height="58" viewBox="0 0 100 66" fill="none">
                <rect x="14" y="14" width="24" height="20" rx="5" fill="#EA580C" />
                <path d="M26 20C24 18 21 18 20 20C19 22 20 24 26 28C32 24 33 22 32 20C31 18 28 18 26 20Z" fill="#FFFFFF" />
                <path d="M22 36H64L72 22H60" stroke="#F97316" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M30 36C30 28 44 28 48 38H68C74 38 78 43 78 48H24C24 41 27 36 30 36Z" fill="#FB923C" />
                <circle cx="28" cy="50" r="10" fill="#1E293B" />
                <circle cx="28" cy="50" r="4.5" fill="#E2E8F0" />
                <circle cx="72" cy="50" r="10" fill="#1E293B" />
                <circle cx="72" cy="50" r="4.5" fill="#E2E8F0" />
              </svg>
            </div>
            <p className={styles.riderHungerText}>
              Together
              <br />
              for a Hunger-Free
              <br />
              India ❤️
            </p>
          </div>
        ) : (
          <>
            <div className={styles.promoCard}>
              <div className={styles.promoIcon}>
                <Leaf size={18} color="#16A34A" />
              </div>
              <div className={styles.promoContent}>
                <p className={styles.promoTitle}>Zero Food Waste<br />Zero Hunger</p>
                <p className={styles.promoSub}>Real-time food rescue network.</p>
              </div>
            </div>

            <div className={styles.sidebarFooter}>
              <p className={styles.footerText}>ShareBite v2.0</p>
              <p className={styles.footerSub}>Share Food. Share Hope.</p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
