import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Email address</p>
            <p className={styles.settingValue}>{user?.email}</p>
          </div>
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Role</p>
            <p className={styles.settingValue} style={{ textTransform: 'capitalize' }}>{user?.role}</p>
          </div>
        </div>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Verification status</p>
            <p className={styles.settingValue}>{user?.isVerified ? 'Verified ✓' : 'Not verified'}</p>
          </div>
          {!user?.isVerified && (
            <button className={styles.actionBtn} onClick={() => navigate('/verification')}>Apply</button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Danger Zone</h2>
        <div className={styles.settingRow}>
          <div>
            <p className={styles.settingLabel}>Sign out of ShareBite</p>
            <p className={styles.settingDesc}>You will be redirected to the homepage.</p>
          </div>
          <button className={styles.dangerBtn} onClick={handleLogout} disabled={logoutLoading}>
            {logoutLoading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
