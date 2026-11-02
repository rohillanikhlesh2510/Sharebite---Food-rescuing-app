import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Menu, ChevronDown, User, LogOut, Settings, Search, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboardPath } from '../../services/auth';
import { NotificationsService } from '../../services/notifications';
import UserAvatar from '../ui/UserAvatar';
import styles from './Navbar.module.css';

export function ShareBiteLogo() {
  return (
    <div className={styles.brandContainer}>
      <div className={styles.logoBadge}>
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Heart shaped background with warm orange gradient */}
          <path
            d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
            fill="#EA580C"
          />
          {/* White fork & spoon / leaf inner cut */}
          <path
            d="M16 12V18M14.5 12V15.5C14.5 16.3 15.2 17 16 17C16.8 17 17.5 16.3 17.5 15.5V12M16 18V23"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M24 12C22.6 12 21.8 13.2 21.8 14.8C21.8 16.4 22.6 17.4 24 17.4V23M24 12C25.4 12 26.2 13.2 26.2 14.8C26.2 16.4 25.4 17.4 24 17.4"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className={styles.brandText}>
        <span className={styles.brandTitle}>ShareBite</span>
        <span className={styles.brandTagline}>Share Food. Share Hope.</span>
      </div>
    </div>
  );
}

export default function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(3);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isApp = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/donations') ||
    location.pathname.startsWith('/discover') ||
    location.pathname.startsWith('/map') ||
    location.pathname.startsWith('/requests') ||
    location.pathname.startsWith('/notifications') ||
    location.pathname.startsWith('/impact-dashboard') ||
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/admin');

  const userId = user?.id;

  useEffect(() => {
    if (userId) {
      NotificationsService.getUnreadCount(userId).then(count => {
        setUnreadCount(count > 0 ? count : 0);
      });
    }
  }, [userId]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navInner}>
        {/* Left: Brand Logo */}
        <div className={styles.navLeft}>
          {isApp && onToggleSidebar && (
            <button className={styles.menuBtn} onClick={onToggleSidebar} aria-label="Toggle sidebar">
              <Menu size={20} />
            </button>
          )}
          <Link to="/" className={styles.logoLink}>
            <ShareBiteLogo />
          </Link>
        </div>

        {/* Center: Dynamic Role-Specific Navigation links */}
        <div className={styles.navLinks}>
          {!user ? (
            <>
              <Link to="/" className={`${styles.navLink} ${location.pathname === '/' ? styles.navLinkActive : ''}`}>Home</Link>
              <Link to="/discover" className={`${styles.navLink} ${location.pathname === '/discover' ? styles.navLinkActive : ''}`}>Discover</Link>
              <Link to="/impact" className={`${styles.navLink} ${location.pathname === '/impact' ? styles.navLinkActive : ''}`}>Impact</Link>
              <Link to="/about" className={`${styles.navLink} ${location.pathname === '/about' ? styles.navLinkActive : ''}`}>About</Link>
              <Link to="/partners" className={`${styles.navLink} ${location.pathname === '/partners' ? styles.navLinkActive : ''}`}>Partners</Link>
            </>
          ) : user.role === 'rider' || user.role === 'volunteer' ? (
            <>
              <Link to="/rider-dashboard" className={`${styles.navLink} ${location.pathname === '/rider-dashboard' ? styles.navLinkActive : ''}`}>Rider Home</Link>
              <Link to="/map" className={`${styles.navLink} ${location.pathname === '/map' ? styles.navLinkActive : ''}`}>Live Map</Link>
              <Link to="/chat" className={`${styles.navLink} ${location.pathname === '/chat' ? styles.navLinkActive : ''}`}>Messages</Link>
              <Link to="/impact-dashboard" className={`${styles.navLink} ${location.pathname === '/impact-dashboard' ? styles.navLinkActive : ''}`}>Fleet Stats</Link>
            </>
          ) : user.role === 'ngo' || user.role === 'receiver' || user.role === 'acceptor' ? (
            <>
              <Link to="/ngo-dashboard" className={`${styles.navLink} ${location.pathname === '/ngo-dashboard' ? styles.navLinkActive : ''}`}>NGO Hub</Link>
              <Link to="/discover" className={`${styles.navLink} ${location.pathname === '/discover' ? styles.navLinkActive : ''}`}>Claim Food</Link>
              <Link to="/my-claims" className={`${styles.navLink} ${location.pathname === '/my-claims' ? styles.navLinkActive : ''}`}>Incoming Deliveries</Link>
              <Link to="/requests" className={`${styles.navLink} ${location.pathname === '/requests' ? styles.navLinkActive : ''}`}>Distribution Log</Link>
              <Link to="/chat" className={`${styles.navLink} ${location.pathname === '/chat' ? styles.navLinkActive : ''}`}>Chat</Link>
            </>
          ) : user.role === 'community' ? (
            <>
              <Link to="/community-dashboard" className={`${styles.navLink} ${location.pathname === '/community-dashboard' ? styles.navLinkActive : ''}`}>Community Home</Link>
              <Link to="/discover" className={`${styles.navLink} ${location.pathname === '/discover' ? styles.navLinkActive : ''}`}>Find Free Meals</Link>
              <Link to="/requests" className={`${styles.navLink} ${location.pathname === '/requests' ? styles.navLinkActive : ''}`}>My Requests</Link>
              <Link to="/map" className={`${styles.navLink} ${location.pathname === '/map' ? styles.navLinkActive : ''}`}>Distribution Centers</Link>
            </>
          ) : (
            /* Donor / Partner Default */
            <>
              <Link to="/donor-dashboard" className={`${styles.navLink} ${location.pathname === '/donor-dashboard' ? styles.navLinkActive : ''}`}>Donor Dashboard</Link>
              <Link to="/donations/new" className={`${styles.navLink} ${location.pathname === '/donations/new' ? styles.navLinkActive : ''}`} style={{ color: '#ea580c', fontWeight: 700 }}>+ Donate Food</Link>
              <Link to="/donor-donations" className={`${styles.navLink} ${location.pathname === '/donor-donations' ? styles.navLinkActive : ''}`}>Track Deliveries</Link>
              <Link to="/discover" className={`${styles.navLink} ${location.pathname === '/discover' ? styles.navLinkActive : ''}`}>Network</Link>
              <Link to="/chat" className={`${styles.navLink} ${location.pathname === '/chat' ? styles.navLinkActive : ''}`}>Chat</Link>
            </>
          )}
        </div>

        {/* Right: Search, Notifications, Auth */}
        <div className={styles.navRight}>
          {/* Search pill */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search food, NGOs, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Bell Icon with red badge */}
          <Link to="/notifications" className={styles.notifBtn} aria-label="Notifications">
            <Bell size={19} className={styles.bellIcon} />
            <span className={styles.badge}>{unreadCount > 0 ? unreadCount : 0}</span>
          </Link>

          {user ? (
            <div className={styles.userMenuWrap}>
              <button className={styles.userBtn} onClick={() => setShowUserMenu(s => !s)}>
                <UserAvatar size={34} src={user.avatar} name={user.name} />
                <div className={styles.userMetaCol}>
                  <span className={styles.userNameText}>{user.name || 'Anubhav'}</span>
                  <span className={styles.userRolePill}>
                    {user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Donor'}
                  </span>
                </div>
                <ChevronDown size={14} className={styles.userChevron} />
              </button>
              {showUserMenu && (
                <div className={styles.userMenu}>
                  <div className={styles.userMenuHeader}>
                    <p className={styles.userMenuName}>{user.name}</p>
                    <p className={styles.userMenuRole}>{user.role}</p>
                  </div>
                  <Link to={getRoleDashboardPath(user.role)} className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                    Dashboard
                  </Link>
                  <Link to="/chat" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                    <MessageSquare size={14} /> Messages
                  </Link>
                  {user.role === 'rider' && (
                    <Link to="/rider-dashboard" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                      Rider Tasks
                    </Link>
                  )}
                  {(user.role === 'ngo' || user.role === 'volunteer') && (
                    <Link to="/my-claims" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                      NGO Claims
                    </Link>
                  )}
                  {user.role === 'donor' && (
                    <Link to="/donor-donations" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                      My Food Donations
                    </Link>
                  )}
                  <Link to="/profile" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                    <User size={14} /> Profile
                  </Link>
                  <Link to="/settings" className={styles.menuItem} onClick={() => setShowUserMenu(false)}>
                    <Settings size={14} /> Settings
                  </Link>
                  <div className={styles.menuDivider} />
                  <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleLogout}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authBtns}>
              <Link to="/register" className={styles.signupBtn}>Get Started →</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
