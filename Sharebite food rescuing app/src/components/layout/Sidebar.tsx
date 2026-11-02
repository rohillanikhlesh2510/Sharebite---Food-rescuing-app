import { useMemo } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutGrid, Search, Utensils, MapPin, ClipboardList,
  BarChart2, User, Settings, ShieldCheck, ShieldAlert, X, Leaf,
  Truck, Package, Plus, MessageSquare, Heart, Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ShareBiteLogo } from './Navbar';
import UserAvatar from '../ui/UserAvatar';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  highlight?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const { user } = useAuth();
  const role = user?.role || 'donor';

  // Purpose-built navigation strictly segregated by trusted role
  const roleNavItems = useMemo<NavItem[]>(() => {
    switch (role) {
      case 'rider':
      case 'volunteer':
        return [
          { to: '/rider-dashboard', icon: <Truck size={18} />, label: 'Rider Dashboard' },
          { to: '/ngos', icon: <Building2 size={18} />, label: 'Find NGOs' },
          { to: '/map', icon: <MapPin size={18} />, label: 'Live Rescue Map' },
          { to: '/chat', icon: <MessageSquare size={18} />, label: 'Messages & Dispatch' },
          { to: '/impact-dashboard', icon: <BarChart2 size={18} />, label: 'Fleet Impact' },
          { to: '/profile', icon: <User size={18} />, label: 'Rider Profile' },
          { to: '/verification', icon: <ShieldCheck size={18} />, label: 'ID Verification' },
          { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
        ];

      case 'ngo':
      case 'receiver':
      case 'acceptor':
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
      case 'partner':
      default:
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
    switch (role) {
      case 'rider':
      case 'volunteer':
        return '🚴 Logistics Fleet Partner';
      case 'ngo':
      case 'receiver':
      case 'acceptor':
        return '🏛️ Community NGO Relief';
      case 'community':
        return '🤝 Community Member';
      case 'admin':
        return '🛡️ Platform Administrator';
      case 'donor':
      case 'partner':
      default:
        return '🌱 Verified Food Donor';
    }
  }, [role]);

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarBrand}>
            <ShareBiteLogo />
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        {user && (
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
                {role === 'rider' ? 'Ready for deliveries ⚡' : role === 'ngo' ? 'Feeding communities 🍲' : 'Sharing food, saving lives 🌱'}
              </p>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          {roleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''} ${item.highlight ? styles.navItemHighlight : ''}`
              }
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
          ))}
        </nav>

        {/* Role-Specific Action Card */}
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

        {role === 'rider' && (
          <div style={{ margin: '16px 14px', padding: 14, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12 }}>
            <p style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 700, color: '#166534' }}>Delivery Fleet Active</p>
            <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#14532d' }}>Check available pickup jobs near your current GPS location.</p>
            <Link
              to="/rider-dashboard"
              onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#16a34a', color: '#fff', padding: '6px 12px',
                borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none'
              }}
            >
              <Package size={14} /> View Available Jobs
            </Link>
          </div>
        )}

        {/* Promo card */}
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
      </aside>
    </>
  );
}
