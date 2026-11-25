import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './VerificationPage.module.css';

export default function VerificationPage() {
  const { user } = useAuth();
  if (user?.isVerified) {
    return (
      <div className={styles.page}>
        <div className={styles.verified}>
          <ShieldCheck size={48} color="var(--color-success)" />
          <h1>You are verified!</h1>
          <p>Your account has been verified. You can claim food donations and access all NGO features.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Apply for Verification</h1>
      <div className={styles.card}>
        <p className={styles.desc}>Verification allows NGOs, shelters, and organizations to claim food donations. To get verified:</p>
        <ol className={styles.steps}>
          <li>Ensure your profile is complete (name, phone, city).</li>
          <li>Email your organization registration documents to <strong>verify@sharebite.in</strong>.</li>
          <li>Our team will review and verify your account within 24-48 hours.</li>
          <li>You will receive a notification once verified.</li>
        </ol>
        <p className={styles.note}>Note: Individual users (donors, volunteers, beneficiaries) do not need verification to use ShareBite.</p>
      </div>
    </div>
  );
}
