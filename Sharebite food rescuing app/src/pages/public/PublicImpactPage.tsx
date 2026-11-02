import { useEffect, useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { ImpactService } from '../../services/impact';
import type { CommunityImpact } from '../../types';
import styles from './SimplePublicPage.module.css';

export default function PublicImpactPage() {
  const [impact, setImpact] = useState<CommunityImpact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ImpactService.getCommunityImpact().then(d => { setImpact(d); setLoading(false); });
  }, []);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.title}>ShareBite Impact</h1>
          <p className={styles.lead}>Real numbers from our community. Updated in real time from our database.</p>
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading impact data...</p>
          ) : (
            <div className={styles.impactGrid}>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.mealsSaved ?? 0}</span><span>Meals Rescued</span></div>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.foodRedistributedKg ?? 0} kg</span><span>Food Redistributed</span></div>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.co2SavedKg ?? 0} kg</span><span>CO₂ Prevented</span></div>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.activeDonors ?? 0}</span><span>Active Donors</span></div>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.activeNGOs ?? 0}</span><span>Partner NGOs</span></div>
              <div className={styles.impactStat}><span className={styles.bigNum}>{impact?.donationsCount ?? 0}</span><span>Total Donations</span></div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
