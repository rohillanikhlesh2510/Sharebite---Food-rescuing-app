import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Menu, User, Settings, LogOut, MessageSquare } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import LiveOpportunityPopup from '../notifications/LiveOpportunityPopup';
import ErrorBoundary from '../states/ErrorBoundary';
import UserAvatar from '../ui/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { NotificationsService } from '../../services/notifications';
import { ClaimsService } from '../../services/claims';
import { LocationService } from '../../services/location';
import styles from './AppShell.module.css';

function RiderTopHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  const [isOnline, setIsOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    ClaimsService.getOrEnsureRiderProfile(userId, user?.name, user?.phone).then((r) => {
      if (active && r) setIsOnline(r.isOnline);
    });

    NotificationsService.getUnreadCount(userId).then((c) => {
      if (active) setUnreadCount(c > 0 ? c : 0);
    });

    const sub = NotificationsService.subscribeToNotifications(userId, () => {
      if (active) setUnreadCount((c) => c + 1);
    });

    const onOnlineEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{ isOnline: boolean }>;
      if (typeof custom.detail?.isOnline === 'boolean') {
        setIsOnline(custom.detail.isOnline);
      }
    };
    window.addEventListener('sharebite:rider-online', onOnlineEvent);

    return () => {
      active = false;
      sub.unsubscribe();
      window.removeEventListener('sharebite:rider-online', onOnlineEvent);
    };
  }, [userId, user?.name, user?.phone]);

  const handleToggleOnline = async () => {
    if (!userId || toggling) return;
    setToggling(true);
    try {
      const next = !isOnline;
      if (next) {
        const gps = await LocationService.detectCurrentGPS();
        if (gps.status === 'granted' && gps.latitude !== null && gps.longitude !== null) {
          await LocationService.updateRiderLocation({
            riderId: userId,
            latitude: gps.latitude,
            longitude: gps.longitude,
            accuracyM: gps.accuracy ?? undefined,
          }).catch(() => {});
        }
      }
      const myTasks = await ClaimsService.getMyDeliveryTasks(userId);
      const hasActive = myTasks.some((t) =>
        ['rider_assigned', 'going_to_pickup', 'arrived_at_pickup', 'food_collected', 'in_transit'].includes(
          t.status
        )
      );
      await ClaimsService.setRiderOnlineStatus(userId, next, hasActive, user?.name, user?.phone);
      setIsOnline(next);
    } finally {
      setToggling(false);
    }
  };

  const firstName = user?.name?.trim() ? user.name.trim().split(' ')[0] : 'Rider';

  return (
    <header className={styles.riderHeader}>
      <div className={styles.riderHeaderLeft}>
        <button
          type="button"
          className={styles.riderMenuBtn}
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className={styles.riderGreeting}>Hello, {firstName}! 👋</h2>
          <p className={styles.riderSubGreeting}>Keep delivering, make an impact ❤️</p>
        </div>
      </div>

      <div className={styles.riderHeaderRight}>
        <button
          type="button"
          onClick={handleToggleOnline}
          disabled={toggling}
          className={`${styles.onlinePill} ${isOnline ? styles.onlinePillActive : styles.onlinePillOffline}`}
          title="Toggle Rider Online/Offline availability"
        >
          <span className={styles.onlineStatusDot} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
          <ChevronDown size={14} />
        </button>

        <Link to="/notifications" className={styles.riderNotifBtn} aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && <span className={styles.riderNotifDot}>{unreadCount}</span>}
        </Link>

        <div className={styles.riderProfileWrap}>
          <button
            type="button"
            className={styles.riderProfileBtn}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Rider profile menu"
          >
            <UserAvatar size={38} src={user?.avatar} name={user?.name} />
            <ChevronDown size={14} color="#475569" />
          </button>

          {menuOpen && (
            <div className={styles.riderDropdown}>
              <div className={styles.riderDropdownHead}>
                <strong>{user?.name || 'Rider'}</strong>
                <span>Rider Portal</span>
              </div>
              <Link to="/chat" className={styles.riderDropItem} onClick={() => setMenuOpen(false)}>
                <MessageSquare size={14} /> Pickup Messages
              </Link>
              <Link to="/profile" className={styles.riderDropItem} onClick={() => setMenuOpen(false)}>
                <User size={14} /> Profile
              </Link>
              <Link to="/settings" className={styles.riderDropItem} onClick={() => setMenuOpen(false)}>
                <Settings size={14} /> Settings
              </Link>
              <button
                type="button"
                className={`${styles.riderDropItem} ${styles.riderDropDanger}`}
                onClick={async () => {
                  setMenuOpen(false);
                  await logout();
                  navigate('/');
                }}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isRider = normalizeRole(user?.role) === 'rider';

  // Donor, NGO, Community, and Admin keep the exact original Navbar + Sidebar shell untouched.
  if (!isRider) {
    return (
      <div className={styles.shell}>
        <Navbar onToggleSidebar={() => setSidebarOpen(s => !s)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <LiveOpportunityPopup />
        <main className={styles.main}>
          <div className={styles.content}>
            <ErrorBoundary fallbackTitle="Dashboard section could not load">
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.shell} ${styles.riderShellBg}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <LiveOpportunityPopup />
      <main className={`${styles.main} ${styles.riderMain}`}>
        <div className={styles.content}>
          <RiderTopHeader onToggleSidebar={() => setSidebarOpen(s => !s)} />
          <ErrorBoundary fallbackTitle="Rider section could not load">
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
