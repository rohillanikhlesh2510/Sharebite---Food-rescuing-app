import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { ChatService } from '../../services/chat';
import { NGOService } from '../../services/ngo';
import LiveTrackingMap from '../../components/map/LiveTrackingMap';
import { formatDistanceToNow } from 'date-fns';
import type { FoodListing, ImpactStats, NearbyNGO } from '../../types';
import styles from './DonorDashboardPage.module.css';

interface DonorLiveTask extends DeliveryTask {
  pickupCode?: string;
  riderUserId?: string;
}

interface DonorDashboardProps {
  // Optional props
}

export default function DonorDashboardPage(_props: DonorDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [activeTasks, setActiveTasks] = useState<DonorLiveTask[]>([]);
  const [nearbyNgos, setNearbyNgos] = useState<NearbyNGO[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userLocationRef = useRef(user?.location);

  useEffect(() => {
    userLocationRef.current = user?.location;
  }, [user?.location]);

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

      // Extract active delivery tasks with real coordinates, codes & rider details
      const liveTasks: DonorLiveTask[] = [];
      for (const row of donorDashboardRows) {
        if (
          row.delivery_task_id &&
          ['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit'].includes(row.delivery_status)
        ) {
          liveTasks.push({
            id: row.delivery_task_id,
            foodListingId: row.id,
            donorId: row.donor_id,
            ngoId: row.ngo_id || undefined,
            assignmentType: row.assignment_type,
            foodTitle: row.title,
            servingsRequired: row.servings_claimed || row.servings || 1,
            quantityUnit: 'servings',
            status: row.delivery_status,
            pickupAddress: row.pickup_address,
            pickupLat: row.latitude,
            pickupLng: row.longitude,
            dropoffAddress: row.dropoff_address,
            dropoffLat: row.dropoff_lat,
            dropoffLng: row.dropoff_lng,
            pickupCode: row.pickup_code || undefined,
            riderUserId: row.rider_user_id || undefined,
            riderName: row.rider_name || 'Assigned Rider',
            riderPhone: row.rider_phone || undefined,
            ngoName: row.ngo_name || (row.assignment_type === 'rider_direct_pickup' ? 'Community Relief Dropoff' : 'Accepted NGO'),
            createdAt: row.created_at,
            updatedAt: row.updated_at || new Date().toISOString(),
            incidentReported: false,
          });
        }
      }
      setActiveTasks(liveTasks);

      // Load real nearby verified NGOs based on donor's latest listing or profile location
      const refLat = listingsData.find((l) => l.latitude)?.latitude ?? userLocationRef.current?.latitude;
      const refLng = listingsData.find((l) => l.longitude)?.longitude ?? userLocationRef.current?.longitude;
      if (typeof refLat === 'number' && typeof refLng === 'number' && refLat !== 0 && refLng !== 0) {
        NGOService.getNearbyNGOs(refLat, refLng, 20, true).then(setNearbyNgos).catch(() => {});
      }
    } catch (err) {
      console.warn('Error loading donor dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const fetchDonorDataRef = useRef(fetchDonorData);
  useEffect(() => {
    fetchDonorDataRef.current = fetchDonorData;
  }, [fetchDonorData]);

  useEffect(() => {
    fetchDonorDataRef.current(false);

    if (!userId) return;
    // Subscribe to donor listings & task updates
    const sub = ClaimsService.subscribeToDonorListings(userId, () => {
      fetchDonorDataRef.current(true);
    });

    return () => {
      sub.unsubscribe();
    };
  }, [userId]);

  const handleOpenChat = async (task: DonorLiveTask) => {
    if (!userId) return;
    const recipientId = task.riderUserId || task.ngoId;
    if (!recipientId) {
      navigate('/chat');
      return;
    }
    try {
      const conv = await ChatService.getOrCreateDirectConversation(userId, recipientId, {
        type: 'delivery',
        relatedListingId: task.foodListingId,
        relatedTaskId: task.id,
        title: task.foodTitle || 'Pickup Coordination',
      });
      navigate(`/chat/${conv.id}`);
    } catch {
      navigate('/chat');
    }
  };

  // Donations waiting for acceptance
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
            <div className={styles.statValue}>{impact?.foodRedistributedKg ?? 0} kg</div>
            <div className={styles.statLabel}>Food Rescued</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <Users size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{impact?.peopleReached ?? 0}</div>
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
            const statusLabel =
              task.status === 'delivered'
                ? 'Delivered to NGO'
                : task.status === 'in_transit' || task.status === 'food_collected'
                ? 'In Transit to NGO'
                : task.status === 'going_to_pickup'
                ? 'Rider Arriving for Pickup'
                : 'Rider Assigned — Heading to Pickup';

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
                    <span>{statusLabel}</span>
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
                        onClick={() => handleOpenChat(task)}
                        className={styles.chatBtn}
                      >
                        <MessageSquare size={14} /> Chat
                      </button>
                    </div>
                  </div>

                  {/* Live Zomato-Style GPS Map */}
                  <LiveTrackingMap
                    deliveryTaskId={task.id}
                    taskStatus={task.status}
                    pickupLat={task.pickupLat}
                    pickupLng={task.pickupLng}
                    pickupLabel={task.pickupAddress || 'Your Pickup Location'}
                    dropoffLat={task.dropoffLat}
                    dropoffLng={task.dropoffLng}
                    dropoffLabel={task.ngoName || 'Destination'}
                    height={220}
                  />

                  {/* Pickup Verification Code Box (only when real code exists) */}
                  {task.pickupCode && (
                    <div className={styles.pickupCodeBox}>
                      <div className={styles.codeExplainer}>
                        <strong>Pickup Handover Verification Code</strong>
                        Share this 6-character code with your rider upon arrival to verify food collection.
                      </div>
                      <div className={styles.secretCode}>
                        {task.pickupCode}
                      </div>
                    </div>
                  )}

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
                      <MapPin size={14} /> {listing.city || 'Pickup location set'}
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

      {/* ── Nearby Verified NGOs Strip (Real Supabase data) ── */}
      {nearbyNgos.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ShieldCheck size={20} color="#16a34a" /> Nearby Verified NGOs ({nearbyNgos.length})
            </h2>
            <Link to="/ngos" style={{ color: '#ea580c', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              View NGO Map &rarr;
            </Link>
          </div>
          <div className={styles.donationsGrid}>
            {nearbyNgos.slice(0, 3).map((ngo) => (
              <div key={ngo.id} className={styles.donationCard}>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{ngo.organizationName || ngo.fullName}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <MapPin size={14} /> {ngo.distanceKm} km away · {ngo.city || ngo.address || 'Nearby'}
                    </span>
                    {ngo.operatingHours && (
                      <span className={styles.metaItem}>
                        <Clock size={14} /> {ngo.operatingHours}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
