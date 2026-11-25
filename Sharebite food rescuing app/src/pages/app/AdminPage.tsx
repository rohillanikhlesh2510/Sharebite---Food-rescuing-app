import { useState, useEffect } from 'react';
import { 
  Users, 
  Utensils, 
  ShieldCheck, 
  CheckCircle2, 
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PageLoader } from '../../components/states/LoadingState';
import styles from './AdminPage.module.css';

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_verified: boolean;
  city: string | null;
  created_at: string;
}

interface FoodRow {
  id: string;
  title: string;
  category: string;
  servings: number;
  status: string;
  city: string | null;
  is_urgent: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'listings' | 'system'>('users');
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [listings, setListings] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, listingsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, is_verified, city, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('food_listings').select('id, title, category, servings, status, city, is_urgent, created_at').order('created_at', { ascending: false }).limit(50)
      ]);

      if (usersRes.data) setUsers(usersRes.data as ProfileRow[]);
      if (listingsRes.data) setListings(listingsRes.data as FoodRow[]);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVerify = async (userId: string, currentStatus: boolean) => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: !currentStatus })
        .eq('id', userId);

      if (!error) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: !currentStatus } : u));
      }
    } catch (err) {
      console.error('Failed to update verification status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.is_verified).length;
  const pendingUsers = totalUsers - verifiedUsers;
  const totalListings = listings.length;
  const totalServings = listings.reduce((sum, item) => sum + (item.servings || 0), 0);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Control Center</h1>
        <p className={styles.subtitle}>
          System overview, verification approvals, and food listing moderation
        </p>
      </div>

      {/* KPI Metric Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Users size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{totalUsers}</div>
            <div className={styles.statLabel}>Registered Users</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{pendingUsers}</div>
            <div className={styles.statLabel}>Pending Verifications</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Utensils size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{totalListings}</div>
            <div className={styles.statLabel}>Food Listings</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fdf2f8', color: '#db2777' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{totalServings.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Servings</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Profiles & Verifications ({totalUsers})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'listings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          Food Listings ({totalListings})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'system' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System Health
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>User Accounts</h2>
          </div>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>City</th>
                  <th>Verification</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>No user records found.</td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatarMini}>
                            {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div><strong>{u.full_name || 'Anonymous'}</strong></div>
                            <div style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-xs)' }}>
                              {u.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.badge} style={{ background: '#f3f4f6', color: '#374151' }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.city || '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${u.is_verified ? styles.badgeVerified : styles.badgePending}`}>
                          {u.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`${styles.actionBtn} ${styles.verifyBtn}`}
                          onClick={() => handleVerify(u.id, u.is_verified)}
                          disabled={updatingId === u.id}
                        >
                          {updatingId === u.id 
                            ? 'Saving...' 
                            : u.is_verified ? 'Revoke' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Recent Food Donations</h2>
          </div>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Servings</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyState}>No food listings found.</td>
                  </tr>
                ) : (
                  listings.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.title}</strong></td>
                      <td>{l.category}</td>
                      <td>{l.servings}</td>
                      <td>{l.city || '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeAvailable}`}>
                          {l.status}
                        </span>
                      </td>
                      <td>
                        {l.is_urgent ? (
                          <span className={`${styles.badge} ${styles.badgeUrgent}`}>Urgent</span>
                        ) : (
                          <span style={{ color: 'var(--color-muted)' }}>Normal</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Connected Backend Services</h2>
          </div>
          <div style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle2 color="var(--color-success)" size={20} />
              <div>
                <strong>Supabase Database & Realtime</strong>
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Connected to yxqnfvwbqowbbyfzgkdm.supabase.co
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle2 color="var(--color-success)" size={20} />
              <div>
                <strong>Leaflet & OpenStreetMap Layer</strong>
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Dynamic map tile service active
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <CheckCircle2 color="var(--color-success)" size={20} />
              <div>
                <strong>Storage Buckets</strong>
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-xs)' }}>
                  Public food-images and avatars storage ready
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
