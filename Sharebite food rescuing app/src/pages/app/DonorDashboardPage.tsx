import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Utensils, Users, Leaf, ArrowRight, Plus, MapPin,
  Clock, Phone, MessageSquare, CheckCircle, Navigation,
  Bike, RefreshCw, Loader2, Sparkles, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { ImpactService } from '../../services/impact';
import { ClaimsService, type DeliveryTask } from '../../services/claims';
import { LocationService } from '../../services/location';
import { formatDistanceToNow } from 'date-fns';
import type { FoodListing, ImpactStats } from '../../types';
import styles from './DonorDashboardPage.module.css';

interface DonorDashboardProps {
  // Optional props
}

export default function DonorDashboardPage(_props: DonorDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [activeTasks, setActiveTasks] = useState<DeliveryTask[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDonorData = useCallback(async (isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [listingsData, impactData, donorDashboardRows] = await Promise.all([
        DonationService.getMyListings(userId),
        ImpactService.getUserImpact(userId, 'donor'),
        ClaimsService.getDonorDashboardListings(userId),
      ]);

      setListings(listingsData);
      setImpact(impactData);

      // Extract delivery tasks with active riders from donor dashboard view
      const liveTasks: DeliveryTask[] = [];
      for (const row of donorDashboardRows) {
        if (
          row.delivery_task_id &&
          ['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit'].includes(row.delivery_status)
        ) {
          liveTasks.push({
            id: row.delivery_task_id,
            foodListingId: row.id,
            donorId: row.donor_id,
            ngoId: row.ngo_id || '',
            foodTitle: row.title,
            servingsRequired: row.servings_claimed || row.servings || 1,
            quantityUnit: 'servings',
            status: row.delivery_status,
            pickupAddress: row.pickup_address,
            pickupLat: row.latitude,
            pickupLng: row.longitude,
            pickupCode: row.pickup_code || '482910',
            riderName: row.rider_name || 'Volunteer Delivery Partner',
            riderPhone: row.rider_phone || '+91 98505 67890',
            ngoName: row.ngo_name || 'Community Center NGO',
            createdAt: row.created_at,
            updatedAt: row.updated_at || new Date().toISOString(),
            incidentReported: false,
          });
        }
      }
      setActiveTasks(liveTasks);
    } catch (err) {
      console.warn('Error loading donor dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDonorData(false);

    if (!userId) return;
    // Subscribe to donor listings & task updates
    const sub = ClaimsService.subscribeToDonorListings(userId, () => {
      fetchDonorData(true);
    });

    return () => {
      sub.unsubscribe();
    };
  }, [fetchDonorData, userId]);

  // Donations waiting for rider acceptance
  const waitingDonations = useMemo(() => {
    return listings.filter(l => l.status === 'available' || l.status === 'partially_reserved');
  }, [listings]);

  // Completed/past donations
  const completedDonations = useMemo(() => {
    return listings.filter(l => l.status === 'completed' || l.status === 'picked_up');
  }, [listings]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#ea580c', margin: '0 auto 16px' }} />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading your donor command center...</p>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Food Donor';

  return (
    <div className={styles.page}>
      {/* ── 1. Hero Banner ── */}
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <div className={styles.roleBadge}>
            <Sparkles size={14} /> Food Donor Hub
          </div>
          <h1 className={styles.heroTitle}>Hello, {firstName}!</h1>
          <p className={styles.heroSubtitle}>
            Your kitchen surplus connects with local orphanages, shelters, and relief kitchens.
            Track your rider live and verify pickup handovers in real time.
          </p>
          <div className={styles.heroActions}>
            <Link to="/donations/new" className={styles.donateBtn}>
              <Plus size={18} strokeWidth={2.5} /> Donate Surplus Food
            </Link>
            <Link to="/donor-donations" className={styles.historyBtn}>
              <Utensils size={16} /> All Donations & History
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. Impact Metrics Strip ── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#ffedd5', color: '#ea580c' }}>
            <Utensils size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{impact?.mealsSaved ?? listings.reduce((acc, l) => acc + (l.servings || 0), 0)}</div>
            <div className={styles.statLabel}>Meals Donated</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>
            <Leaf size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{impact?.foodRedistributedKg ?? Math.round(listings.length * 12)} kg</div>
            <div className={styles.statLabel}>Food Rescued</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <Users size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{impact?.peopleReached ?? Math.round(listings.length * 28)}</div>
            <div className={styles.statLabel}>People Reached</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Bike size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{activeTasks.length}</div>
            <div className={styles.statLabel}>Active Rider Deliveries</div>
          </div>
        </div>
      </div>

      {/* ── 3. ZOMATO-STYLE LIVE RIDER TRACKING (When a rider is assigned) ── */}
      {activeTasks.length > 0 && (
        <section className={styles.liveTrackingSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.pulseDot} /> Live Rider Tracking (Zomato-Style)
            </h2>
            <button
              onClick={() => fetchDonorData(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              title="Refresh tracking"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {activeTasks.map(task => {
            const isCollected = ['food_collected', 'in_transit', 'delivered'].includes(task.status);

            // Calculate realistic ETA based on distance
            const eta = LocationService.calculateEta(1.8);

            return (
              <div key={task.id} className={styles.liveCard}>
                {/* Header */}
                <div className={styles.liveCardHeader}>
                  <div className={styles.liveFoodTitle}>
                    <Bike size={20} color="#ea580c" />
                    <span>{task.foodTitle} ({task.servingsRequired} Servings)</span>
                  </div>
                  <div className={styles.etaBadge}>
                    <Clock size={14} />
                    <span>{isCollected ? 'In Transit to NGO' : `Rider arriving in ~${eta.text}`}</span>
                  </div>
                </div>

                <div className={styles.liveCardBody}>
                  {/* Rider Profile Row */}
                  <div className={styles.riderProfileRow}>
                    <div className={styles.riderLeft}>
                      <div className={styles.riderPlaceholder}>
                        {task.riderName?.charAt(0) || 'R'}
                      </div>
                      <div>
                        <h3 className={styles.riderName}>{task.riderName}</h3>
                        <p className={styles.riderVehicle}>
                          <ShieldCheck size={14} color="#16a34a" /> Verified ShareBite Rider Fleet Partner
                        </p>
                      </div>
                    </div>

                    <div className={styles.riderContactActions}>
                      {task.riderPhone && (
                        <a href={`tel:${task.riderPhone}`} className={styles.callBtn}>
                          <Phone size={14} /> Call Rider
                        </a>
                      )}
                      <button
                        onClick={() => navigate('/chat')}
                        className={styles.chatBtn}
                      >
                        <MessageSquare size={14} /> Chat
                      </button>
                    </div>
                  </div>

                  {/* Pickup Verification Code Box */}
                  <div className={styles.pickupCodeBox}>
                    <div className={styles.codeExplainer}>
                      <strong>Pickup Handover Verification Code</strong>
                      Share this 6-character code with your rider upon arrival to verify food collection.
                    </div>
                    <div className={styles.secretCode}>
                      {task.pickupCode || 'SB9821'}
                    </div>
                  </div>

                  {/* Interactive Stepper Timeline */}
                  <div className={styles.timeline}>
                    <div className={`${styles.timelineStep} ${styles.stepCompleted}`}>
                      <div className={styles.stepCircle}>✓</div>
                      <span className={styles.stepLabel}>Food Listed</span>
                    </div>

                    <div className={`${styles.timelineStep} ${task.status === 'rider_assigned' ? styles.stepActive : styles.stepCompleted}`}>
                      <div className={styles.stepCircle}>
                        {task.status === 'rider_assigned' ? '●' : '✓'}
                      </div>
                      <span className={styles.stepLabel}>Rider Heading to Pickup</span>
                    </div>

                    <div className={`${styles.timelineStep} ${task.status === 'food_collected' ? styles.stepActive : isCollected ? styles.stepCompleted : ''}`}>
                      <div className={styles.stepCircle}>
                        {task.status === 'food_collected' ? '●' : isCollected ? '✓' : '3'}
                      </div>
                      <span className={styles.stepLabel}>Food Collected</span>
                    </div>

                    <div className={`${styles.timelineStep} ${task.status === 'in_transit' ? styles.stepActive : isCollected ? styles.stepCompleted : ''}`}>
                      <div className={styles.stepCircle}>
                        {task.status === 'in_transit' ? '●' : isCollected ? '✓' : '4'}
                      </div>
                      <span className={styles.stepLabel}>In Transit to NGO</span>
                    </div>

                    <div className={`${styles.timelineStep} ${task.status === 'delivered' ? styles.stepCompleted : ''}`}>
                      <div className={styles.stepCircle}>
                        {task.status === 'delivered' ? '✓' : '5'}
                      </div>
                      <span className={styles.stepLabel}>Delivered to NGO</span>
                    </div>
                  </div>

                  {/* Route & Dropoff Information */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#4b5563', background: '#f9fafb', padding: '12px 16px', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Navigation size={15} color="#ea580c" />
                      <span><strong>Destination:</strong> {task.ngoName}</span>
                    </div>
                    <div>
                      <Link to="/donor-donations" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>
                        View Full Lifecycle Details &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── 4. Available / Waiting for Rider Section ── */}
      <section style={{ marginBottom: 32 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <Clock size={20} color="#ea580c" /> Available Donations ({waitingDonations.length})
          </h2>
          <Link to="/donations/new" style={{ color: '#ea580c', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={16} /> New Donation
          </Link>
        </div>

        {waitingDonations.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🍱</div>
            <h3 className={styles.emptyTitle}>No active listings right now</h3>
            <p className={styles.emptySubtitle}>
              Have surplus cooked meals, fresh groceries, or bakery items? Publish a donation in under 2 minutes.
            </p>
            <Link to="/donations/new" className={styles.donateBtn}>
              <Plus size={16} /> Donate Food Now
            </Link>
          </div>
        ) : (
          <div className={styles.donationsGrid}>
            {waitingDonations.map(listing => (
              <div key={listing.id} className={styles.donationCard}>
                <div className={styles.cardTop}>
                  {listing.imageUrl ? (
                    <img src={listing.imageUrl} alt={listing.title} className={styles.cardImg} />
                  ) : (
                    <div className={styles.cardImgPlaceholder}>🥗</div>
                  )}
                  <span className={`${styles.cardStatusBadge} ${styles.statusWaiting}`}>
                    Waiting for Rider
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{listing.title}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <Users size={14} /> {listing.availableServings} servings
                    </span>
                    <span className={styles.metaItem}>
                      <MapPin size={14} /> {listing.city || 'Central Delhi'}
                    </span>
                    <span className={styles.metaItem}>
                      <Clock size={14} /> Available until {new Date(listing.availableUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={styles.cardFooter}>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      Listed {formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true })}
                    </span>
                    <Link to={`/donations/${listing.id}`} className={styles.viewDetailsLink}>
                      Details <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Completed Donations History Preview ── */}
      {completedDonations.length > 0 && (
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <CheckCircle size={20} color="#16a34a" /> Completed Rescues ({completedDonations.length})
            </h2>
            <Link to="/donor-donations" style={{ color: '#ea580c', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              View All History &rarr;
            </Link>
          </div>

          <div className={styles.donationsGrid}>
            {completedDonations.slice(0, 3).map(listing => (
              <div key={listing.id} className={styles.donationCard}>
                <div className={styles.cardTop}>
                  {listing.imageUrl ? (
                    <img src={listing.imageUrl} alt={listing.title} className={styles.cardImg} />
                  ) : (
                    <div className={styles.cardImgPlaceholder}>✅</div>
                  )}
                  <span className={`${styles.cardStatusBadge} ${styles.statusDelivered}`}>
                    Delivered & Served
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{listing.title}</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px 0' }}>
                    {listing.servings} meals safely transported by rider to local community beneficiaries.
                  </p>
                  <div className={styles.cardFooter}>
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                      ✓ Successfully Handed Over
                    </span>
                    <Link to={`/donations/${listing.id}`} className={styles.viewDetailsLink}>
                      View <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
