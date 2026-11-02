import { useEffect, useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { PartnersService } from '../../services/partners';
import type { Partner } from '../../types';
import styles from './SimplePublicPage.module.css';

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PartnersService.getVerifiedPartners().then(d => { setPartners(d); setLoading(false); });
  }, []);

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Our Partners</h1>
          <p className={styles.lead}>Verified organizations working with ShareBite to rescue food and feed communities.</p>
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading partners...</p>
          ) : partners.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '3rem' }}>
              No verified partners listed yet. Partner organizations will appear here once verified.
            </p>
          ) : (
            <div className={styles.partnerGrid}>
              {partners.map(p => (
                <div key={p.id} className={styles.partnerCard}>
                  {p.logoUrl && <img src={p.logoUrl} alt={p.organizationName} />}
                  <h3>{p.organizationName}</h3>
                  <p className={styles.partnerType}>{p.organizationType}</p>
                  {p.city && <p className={styles.partnerCity}>{p.city}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
