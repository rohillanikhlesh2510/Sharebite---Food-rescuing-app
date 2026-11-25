import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, MapPin, Clock, Utensils, RefreshCw, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import type { FoodListing } from '../../types';
import styles from './DonorDashboardPage.module.css';

export default function BeneficiaryDashboardPage() {
  const { user } = useAuth();
  const [availableFood, setAvailableFood] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const fetchFood = useCallback(async () => {
    setLoading(true);
    try {
      const listings = await DonationService.getActiveListings();
      setAvailableFood(listings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFood();
  }, [fetchFood]);

  const handleRequestMeal = async (listingId: string) => {
    if (!user) return;
    setRequestingId(listingId);
    try {
      await DonationService.reserveFood(listingId, 1);
      alert('Meal requested successfully! The donor and local relief volunteers have been notified.');
      fetchFood();
    } catch (e: any) {
      alert(e.message || 'Failed to request food.');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.heroBanner} style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)' }}>
        <div className={styles.heroContent}>
          <div className={styles.roleBadge} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
            <Heart size={14} /> Community Meal Hub
          </div>
          <h1 className={styles.heroTitle}>Free Fresh Meals Nearby</h1>
          <p className={styles.heroSubtitle}>
            Nutritious food shared with love by verified donors, community kitchens, and NGOs across Delhi NCR.
          </p>
          <div className={styles.heroActions}>
            <Link to="/map" className={styles.donateBtn} style={{ background: '#2563eb' }}>
              <MapPin size={18} /> View Meal Distribution Map
            </Link>
            <Link to="/requests" className={styles.historyBtn}>
              <Utensils size={16} /> My Food Requests
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Utensils size={20} color="#2563eb" /> Available Food Distributions ({availableFood.length})
        </h2>
        <button
          onClick={fetchFood}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={32} className="animate-spin" color="#2563eb" /></div>
      ) : availableFood.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🍲</div>
          <h3 className={styles.emptyTitle}>No free meals available right now</h3>
          <p className={styles.emptySubtitle}>Please check back soon. Local community donors add fresh meals regularly throughout the day.</p>
        </div>
      ) : (
        <div className={styles.donationsGrid}>
          {availableFood.map(item => (
            <div key={item.id} className={styles.donationCard}>
              <div className={styles.cardTop}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className={styles.cardImg} />
                ) : (
                  <div className={styles.cardImgPlaceholder}>🍲</div>
                )}
                <span className={`${styles.cardStatusBadge} ${styles.statusWaiting}`} style={{ background: '#dbeafe', color: '#1e40af', borderColor: '#bfdbfe' }}>
                  {item.availableServings} Servings Free
                </span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}><MapPin size={13} /> {item.pickupAddress || item.city}</span>
                  <span className={styles.metaItem}><Clock size={13} /> Available until {new Date(item.availableUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                  {item.description || 'Fresh nutritious food prepared with food-safety standards.'}
                </p>
                <div className={styles.cardFooter}>
                  <button
                    onClick={() => handleRequestMeal(item.id)}
                    disabled={requestingId === item.id}
                    style={{
                      background: '#2563eb', color: '#fff', border: 'none',
                      padding: '8px 16px', borderRadius: 8, fontWeight: 600,
                      cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    {requestingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />} Request Portion
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
