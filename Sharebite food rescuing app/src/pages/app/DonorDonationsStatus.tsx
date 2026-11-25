import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Package, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClaimsService } from '../../services/claims';
import { DonationService } from '../../services/donations';
import { formatDistanceToNow } from 'date-fns';
import styles from './DonorDonationsStatus.module.css';

const LIFECYCLE_STEPS = [
  { key: 'available',   label: 'Listed & Available' },
  { key: 'claimed',     label: 'Claimed by NGO' },
  { key: 'rider',       label: 'Rider Assigned' },
  { key: 'collected',   label: 'Food Collected' },
  { key: 'delivered',   label: 'Delivered to NGO' },
  { key: 'distributed', label: 'Distributed to Community' },
];

function getActiveStep(row: any): number {
  const cs = row.claim_status;
  const ds = row.delivery_status;
  if (!cs || cs === 'cancelled' || cs === 'expired') return 0;
  if (cs === 'pending' || cs === 'confirmed') return 1;
  if (cs === 'rider_assigned' || ds === 'rider_assigned') return 2;
  if (cs === 'food_collected' || ds === 'food_collected') return 3;
  if (cs === 'delivered' || ds === 'delivered' || ds === 'completed') return 4;
  if (cs === 'distributed') return 5;
  return 1;
}

export default function DonorDonationsStatus() {
  const { user } = useAuth();
  const userId = user?.id;
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Use the donor dashboard view
      const data = await ClaimsService.getDonorDashboardListings(userId);
      // Deduplicate by listing id (view may have multiple rows for multiple claims)
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const row of data) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          deduped.push(row);
        }
      }
      setRows(deduped);
    } catch {
      // fallback: use donations service
      const listings = await DonationService.getMyListings(userId);
      setRows(listings.map(l => ({ ...l, id: l.id, title: l.title, status: l.status })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData(false);
    if (!userId) return;
    const sub = ClaimsService.subscribeToDonorListings(userId, () => {
      fetchData(true);
    });
    return () => { sub.unsubscribe(); };
  }, [fetchData, userId]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <Loader2 size={32} className="animate-spin" style={{ color: '#ea580c' }} />
    </div>
  );

  if (rows.length === 0) return (
    <div className={styles.page}>
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🍱</div>
        <h2 className={styles.emptyTitle}>No donations yet</h2>
        <p className={styles.emptyText}>Create your first food donation to help communities near you.</p>
        <Link to="/donations/new" className={styles.createBtn}><Plus size={16} /> Create Donation</Link>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.pageTitle}>My Donations</h1>
            <p className={styles.pageSubtitle}>Track your food listings through the full rescue lifecycle</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
              onClick={() => fetchData(false)}
              title="Refresh listings"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Link to="/donations/new" className={styles.createBtn}><Plus size={16} /> New Donation</Link>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {rows.map(row => {
          const activeStep = getActiveStep(row);
          const deadline = row.available_until || row.availableUntil;
          const isExpired = deadline && new Date(deadline) < new Date();
          const title = row.title || row.food_title || 'Food Donation';
          const status = row.status || 'available';
          const city = row.city || row.pickup_city;

          return (
            <div key={row.id} className={styles.donationCard}>
              {row.image_url && <img src={row.image_url} alt={title} className={styles.cardImage} />}
              <div className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <span className={`${styles.statusBadge} ${styles[`status_${status}`] || styles.status_available}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  {city && <span className={styles.cardMetaItem}><MapPin size={12} />{city}</span>}
                  <span className={styles.cardMetaItem}>
                    <Package size={12} />
                    {row.servings_claimed || row.servings || row.available_servings || '?'} servings
                  </span>
                  {deadline && (
                    <span className={styles.cardMetaItem}>
                      <Clock size={12} />
                      {isExpired ? 'Expired' : formatDistanceToNow(new Date(deadline), { addSuffix: true })}
                    </span>
                  )}
                  {row.ngo_name && (
                    <span className={styles.claimBadge}>
                      Claimed by {row.ngo_name}
                    </span>
                  )}
                  {row.rider_name && (
                    <span style={{ fontSize: 12, color: '#059669' }}>
                      🚴 {row.rider_name}
                    </span>
                  )}
                </div>

                {/* Handover Code Card for Arriving Rider (Phase 5) */}
                {row.pickup_code && activeStep >= 1 && activeStep <= 2 && (
                  <div style={{
                    background: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    borderRadius: 8,
                    padding: '8px 12px',
                    margin: '10px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                        Pickup Handover Code
                      </span>
                      <span style={{ fontSize: 12, color: '#7c2d12' }}>Give this code to the arriving rider</span>
                    </div>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#ea580c',
                      letterSpacing: 3,
                      background: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #fdba74',
                    }}>
                      {row.pickup_code}
                    </span>
                  </div>
                )}

                {/* Lifecycle timeline */}
                <div className={styles.timeline}>
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const isDone = idx < activeStep;
                    const isActive = idx === activeStep;
                    return (
                      <div key={step.key} className={styles.timelineStep}>
                        <div className={`${styles.timelineDot} ${isDone ? styles.timelineDotDone : isActive ? styles.timelineDotActive : ''}`} />
                        <span className={`${styles.timelineText} ${isDone ? styles.timelineTextDone : isActive ? styles.timelineTextActive : ''}`}>
                          {step.label}
                          {isActive && ' ←'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={`/donations/${row.id}`} className={`${styles.btn} ${styles.btnView}`}>
                    View Details
                  </Link>
                  {['available', 'partially_reserved'].includes(status) && (
                    <Link to={`/donations/${row.id}/edit`} className={`${styles.btn} ${styles.btnView}`}>
                      Edit
                    </Link>
                  )}
                  {['available', 'partially_reserved'].includes(status) && (
                    <button
                      className={`${styles.btn} ${styles.btnCancel}`}
                      onClick={async () => {
                        if (window.confirm('Cancel this donation?')) {
                          await DonationService.cancelListing(row.id);
                          fetchData();
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
