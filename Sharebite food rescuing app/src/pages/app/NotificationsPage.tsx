import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NotificationsService } from '../../services/notifications';
import { EmptyState } from '../../components/states/EmptyState';
import { PageLoader } from '../../components/states/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import type { AppNotification } from '../../types';
import styles from './AppPage.module.css';
import nstyles from './NotificationsPage.module.css';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    NotificationsService.getNotifications(user.id).then(setNotifs).finally(() => setLoading(false));

    const sub = NotificationsService.subscribeToNotifications(user.id, n => {
      setNotifs(prev => [n, ...prev]);
    });
    return () => { sub.unsubscribe(); };
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    await NotificationsService.markAllAsRead(user.id);
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const navigate = useNavigate();

  const markOne = async (n: AppNotification) => {
    await NotificationsService.markAsRead(n.id);
    setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item));

    // Smart navigation
    if (n.data?.url) {
      navigate(n.data.url);
    } else if (n.data?.claimId || n.type?.includes('claim')) {
      if (user?.role === 'donor') navigate('/donor-donations');
      else navigate('/my-claims');
    } else if (n.data?.taskId || n.type?.includes('rider') || n.type?.includes('transit')) {
      if (user?.role === 'rider') navigate('/rider-dashboard');
      else if (user?.role === 'donor') navigate('/donor-donations');
      else navigate('/my-claims');
    } else if (n.type?.includes('donation')) {
      navigate('/discover');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Notifications</h1>
          <p className={styles.pageSubtitle}>{notifs.filter(n => !n.isRead).length} unread</p>
        </div>
        {notifs.some(n => !n.isRead) && (
          <button className={styles.primaryBtn} onClick={markAll}>
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>
      {loading ? <PageLoader /> : notifs.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="No notifications yet" description="We will notify you about food listings, pickups, and important updates." />
      ) : (
        <div className={nstyles.list}>
          {notifs.map(n => (
            <div key={n.id} className={`${nstyles.item} ${!n.isRead ? nstyles.unread : ''}`} onClick={() => markOne(n)}>
              <div className={nstyles.dot} style={{ background: n.isRead ? 'var(--color-border)' : 'var(--color-primary)' }} />
              <div className={nstyles.content}>
                <h3 className={nstyles.title}>{n.title}</h3>
                <p className={nstyles.body}>{n.body}</p>
                <span className={nstyles.time}>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
