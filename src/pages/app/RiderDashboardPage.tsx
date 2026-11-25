import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck, Package, MapPin, Clock, CheckCircle2, Star, Navigation,
  MessageSquare, Loader2, ArrowRight, ShieldCheck, X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import {
  ClaimsService,
  openGoogleMapsNavigation,
  buildGoogleMapsNavigationUrl,
  type DeliveryTask,
  type RiderProfileRecord,
} from '../../services/claims';
import { LocationService, type Coordinates } from '../../services/location';
import { ChatService } from '../../services/chat';
import LiveTrackingMap from '../../components/map/LiveTrackingMap';
import riderHeroBannerImg from '../../assets/rider_scooter_hero.jpg';
import styles from './RiderDashboardPage.module.css';

const STATUS_BADGES: Record<string, string> = {
  rider_assigned: 'Accepted',
  going_to_pickup: 'On the Way to Donor',
  arrived_at_pickup: 'Arrived at Pickup',
  food_collected: 'Picked Up',
  in_transit: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
};

function formatPickupWindow(deadlineIso?: string, createdIso?: string): string {
  if (!deadlineIso) {
    return createdIso
      ? `Posted ${formatDistanceToNow(new Date(createdIso), { addSuffix: true })}`
      : 'Ready for pickup';
  }
  const diffMs = new Date(deadlineIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Urgent pickup window';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Pickup within ${Math.max(5, mins)} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `Pickup within ${hrs}h ${remMins}m` : `Pickup within ${hrs} hr${hrs > 1 ? 's' : ''}`;
}

function FoodFallbackThumb() {
  return (
    <div className={styles.foodThumbFallback} aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="#FFEDD5" stroke="#FB923C" strokeWidth="2" />
        <path d="M14 26C14 31.5 18.5 35 24 35C29.5 35 34 31.5 34 26H14Z" fill="#EA580C" />
        <circle cx="20" cy="22" r="3" fill="#F59E0B" />
        <circle cx="25" cy="20" r="3.2" fill="#16A34A" />
        <circle cx="29" cy="22.5" r="2.8" fill="#FB923C" />
      </svg>
    </div>
  );
}

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();

  const [riderProfile, setRiderProfile] = useState<RiderProfileRecord | null>(null);
  const [availableTasks, setAvailableTasks] = useState<DeliveryTask[]>([]);
  const [myTasks, setMyTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [riderCoords, setRiderCoords] = useState<Coordinates | null>(null);
  const riderCoordsRef = useRef<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setLoading(true);

    try {
      const currentCoords = riderCoordsRef.current;
      const [available, mine, rProf] = await Promise.all([
        ClaimsService.getAvailableDeliveryTasks(currentCoords?.latitude, currentCoords?.longitude),
        ClaimsService.getMyDeliveryTasks(userId),
        ClaimsService.getOrEnsureRiderProfile(userId, user?.name, user?.phone),
      ]);
      setAvailableTasks(available);
      setMyTasks(mine);
      if (rProf) {
        setRiderProfile(rProf);
        setIsOnline(rProf.isOnline);
        if (!riderCoordsRef.current && rProf.currentLat != null && rProf.currentLng != null) {
          const savedCoords = { latitude: rProf.currentLat, longitude: rProf.currentLng };
          riderCoordsRef.current = savedCoords;
          setRiderCoords(savedCoords);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, user?.name, user?.phone]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial load + realtime subscription to new donations & delivery tasks
  useEffect(() => {
    fetchDataRef.current(false);
    if (!userId) return;

    // Capture a single GPS reading once so distances to available pickups are accurate
    LocationService.detectCurrentGPS().then((gps) => {
      if (gps.status === 'granted' && gps.latitude !== null && gps.longitude !== null) {
        const coords = {
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy ?? undefined,
        };
        riderCoordsRef.current = coords;
        setRiderCoords(coords);
        fetchDataRef.current(true);
      }
    });

    const sub = ClaimsService.subscribeToAvailableTasks(() => {
      fetchDataRef.current(true);
    });

    const onOnlineSync = (ev: Event) => {
      const custom = ev as CustomEvent<{ isOnline: boolean }>;
      if (typeof custom.detail?.isOnline === 'boolean') {
        setIsOnline(custom.detail.isOnline);
      }
    };
    window.addEventListener('sharebite:rider-online', onOnlineSync);

    return () => {
      sub.unsubscribe();
      window.removeEventListener('sharebite:rider-online', onOnlineSync);
    };
  }, [userId]);

  const activeTask = useMemo(
    () =>
      myTasks.find(
        (t) =>
          ['rider_assigned', 'going_to_pickup', 'arrived_at_pickup', 'food_collected', 'in_transit'].includes(
            t.status
          ) ||
          (t.status === 'delivered' && !t.ngoId)
      ) || null,
    [myTasks]
  );

  const activeTaskId =
    activeTask && activeTask.status !== 'delivered' ? activeTask.id : undefined;

  // Live GPS Tracking: ONLY track continuously when rider is online AND has an active in-transit delivery!
  useEffect(() => {
    if (!isOnline || !activeTaskId || !userId) return;
    setGpsError('');

    const stopWatching = LocationService.watchAndBroadcastRiderLocation({
      riderUserId: userId,
      deliveryTaskId: activeTaskId,
      minIntervalMs: 5000,
      minDistanceMeters: 15,
      onPosition: (coords) => {
        const prev = riderCoordsRef.current;
        riderCoordsRef.current = coords;
        const movedKm = prev
          ? LocationService.calculateDistance(prev.latitude, prev.longitude, coords.latitude, coords.longitude)
          : Infinity;
        if (!prev || movedKm >= 0.01) {
          setRiderCoords(coords);
        }
        setGpsError('');
      },
      onError: (err) => {
        setGpsError(err.message || 'Location permission denied. Enable GPS to share live route with donor.');
      },
    });

    return () => {
      stopWatching();
    };
  }, [isOnline, activeTaskId, userId]);

  const completedDeliveries = useMemo(
    () => myTasks.filter((t) => t.status === 'completed' || (t.status === 'delivered' && Boolean(t.ngoId))),
    [myTasks]
  );

  const totalDeliveriesCount = Math.max(
    riderProfile?.totalDeliveries ?? 0,
    completedDeliveries.length
  );
  const totalEarnings = riderProfile?.totalEarnings ?? 0;
  const computedDistance = useMemo(
    () =>
      completedDeliveries.reduce(
        (sum, t) => sum + (t.estimatedKm ?? t.distanceKm ?? 0),
        0
      ),
    [completedDeliveries]
  );
  const totalDistanceKm = Math.max(
    riderProfile?.totalDistanceKm ?? 0,
    Number(computedDistance.toFixed(1))
  );
  const ratingDisplay =
    totalDeliveriesCount > 0
      ? Number(riderProfile?.rating ?? 5.0).toFixed(1)
      : 'New';

  const handleAcceptPickup = async (task: DeliveryTask) => {
    if (!userId) return;
    setBusyId(task.id);
    setActionBanner(null);
    try {
      let pickupLat = task.pickupLat;
      let pickupLng = task.pickupLng;
      let pickupAddr = task.pickupAddress;
      let assignedTaskId: string | undefined = task.isDirectFoodOpportunity ? undefined : task.id;

      if (task.isDirectFoodOpportunity) {
        const res = await ClaimsService.acceptDonation(task.foodListingId);
        assignedTaskId = res.deliveryTaskId;
        if (res.pickupLat != null) pickupLat = res.pickupLat;
        if (res.pickupLng != null) pickupLng = res.pickupLng;
        if (res.pickupAddress) pickupAddr = res.pickupAddress;
      } else {
        await ClaimsService.acceptDeliveryJob(task.id);
      }

      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('sharebite:rider-online', { detail: { isOnline: true } }));

      // Create / ensure Donor <-> Rider private chat channel
      if (task.donorId) {
        ChatService.openDeliveryConversation(userId, task.donorId, {
          relatedListingId: task.foodListingId,
          relatedTaskId: assignedTaskId,
          title: task.foodTitle || 'Food Pickup',
        }).catch(() => {});
      }

      // Automatically open Google Maps Directions to Donor pickup coordinates
      openGoogleMapsNavigation(pickupLat, pickupLng, pickupAddr);

      setActionBanner({
        kind: 'ok',
        text: `Pickup accepted! Google Maps directions opened for ${pickupAddr || 'donor location'}.`,
      });
      await fetchData(true);
    } catch (e: any) {
      setActionBanner({
        kind: 'err',
        text: e?.message || 'This donation was already accepted by another rider.',
      });
      await fetchData(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateActiveStatus = async (task: DeliveryTask, nextStatus: string) => {
    setBusyId(task.id);
    setActionBanner(null);
    try {
      await ClaimsService.updateDeliveryTaskStatus(task.id, nextStatus);
      setActionBanner({
        kind: 'ok',
        text: `Delivery status updated to ${STATUS_BADGES[nextStatus] || nextStatus}.`,
      });
      await fetchData(true);
    } catch (e: any) {
      setActionBanner({
        kind: 'err',
        text: e?.message || 'Could not update delivery status.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenDonorChat = async (task: DeliveryTask) => {
    if (!userId || !task.donorId) {
      navigate('/chat');
      return;
    }
    try {
      const conv = await ChatService.openDeliveryConversation(userId, task.donorId, {
        relatedListingId: task.foodListingId,
        relatedTaskId: task.id,
        title: task.foodTitle || 'Pickup Chat',
      });
      navigate(`/chat/${conv.id}`);
    } catch {
      navigate('/chat');
    }
  };

  // Determine next workflow action for Active Delivery
  const getNextStatusAction = (task: DeliveryTask): { next: string; label: string } | null => {
    switch (task.status) {
      case 'rider_assigned':
        return { next: 'going_to_pickup', label: 'Start — On the Way to Donor' };
      case 'going_to_pickup':
        return { next: 'arrived_at_pickup', label: 'Mark Arrived at Pickup' };
      case 'arrived_at_pickup':
        return { next: 'food_collected', label: 'Confirm Food Collected' };
      case 'food_collected':
        return { next: 'in_transit', label: 'Start — On the Way to Destination' };
      case 'in_transit':
        return { next: 'delivered', label: 'Mark Delivered' };
      case 'delivered':
        return { next: 'completed', label: 'Complete Delivery' };
      default:
        return null;
    }
  };

  const activeNavUrl = activeTask
    ? ['food_collected', 'in_transit'].includes(activeTask.status)
      ? buildGoogleMapsNavigationUrl(activeTask.dropoffLat, activeTask.dropoffLng, activeTask.dropoffAddress) ||
        buildGoogleMapsNavigationUrl(activeTask.pickupLat, activeTask.pickupLng, activeTask.pickupAddress)
      : buildGoogleMapsNavigationUrl(activeTask.pickupLat, activeTask.pickupLng, activeTask.pickupAddress)
    : null;

  const isPickedUpDone = activeTask
    ? ['food_collected', 'in_transit', 'delivered', 'completed'].includes(activeTask.status)
    : false;
  const isInTransitDone = activeTask
    ? ['in_transit', 'delivered', 'completed'].includes(activeTask.status)
    : false;
  const isDeliveredDone = activeTask
    ? ['delivered', 'completed'].includes(activeTask.status)
    : false;

  return (
    <div className={styles.dashboard}>
      {/* Feedback & GPS Permissions Alerts */}
      {actionBanner && (
        <div className={actionBanner.kind === 'ok' ? styles.bannerOk : styles.bannerErr}>
          <span>{actionBanner.text}</span>
          <button onClick={() => setActionBanner(null)} className={styles.bannerClose} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {gpsError && <div className={styles.bannerErr}>{gpsError}</div>}

      {/* ─── Hero Banner: Deliver Food, Spread Happiness ─────────────────── */}
      <section className={styles.heroBanner}>
        <img
          src={riderHeroBannerImg}
          alt="ShareBite Delivery Rider"
          className={styles.heroBgArt}
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroHeading}>
            Deliver Food,
            <br />
            Spread <span className={styles.heroAccent}>Happiness</span>{' '}
            <span className={styles.heartIcon} aria-hidden="true">❤️</span>
          </h1>
          <p className={styles.heroSubtext}>Every delivery helps someone in need.</p>
          <Link to="/rider/deliveries" className={styles.heroCta}>
            View My Deliveries <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── 4 Real KPI Metric Cards ─────────────────────────────────────── */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconOrange}`}>
            <Truck size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{totalDeliveriesCount}</div>
            <div className={styles.statLabel}>Total Deliveries</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconGreen}`}>
            <span className={styles.rupeeGlyph}>₹</span>
          </div>
          <div>
            <div className={styles.statValue}>₹{totalEarnings.toLocaleString('en-IN')}</div>
            <div className={styles.statLabel}>Total Earnings</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconAmber}`}>
            <Star size={22} fill="#f59e0b" color="#f59e0b" />
          </div>
          <div>
            <div className={styles.statValue}>{ratingDisplay}</div>
            <div className={styles.statLabel}>Your Rating</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIconWrap} ${styles.statIconCoral}`}>
            <Clock size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{totalDistanceKm} km</div>
            <div className={styles.statLabel}>Total Distance</div>
          </div>
        </div>
      </section>

      {/* ─── Middle Grid: Available Pickups + Active Delivery ────────────── */}
      <section className={styles.mainGrid}>
        {/* Left: Available Pickups */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <span className={styles.panelIconBox}>
                <Package size={18} />
              </span>
              <h2 className={styles.panelTitle}>Available Pickups</h2>
            </div>
            <Link to="/rider/deliveries?tab=available" className={styles.viewAllLink}>
              View All <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className={styles.loadingBlock}>
              <Loader2 size={26} className="animate-spin" style={{ color: '#ea580c' }} />
            </div>
          ) : availableTasks.length === 0 ? (
            <div className={styles.emptyBox}>
              <Package size={32} color="#fb923c" />
              <p className={styles.emptyHeading}>No available pickups right now</p>
              <span className={styles.emptySub}>
                New food donations posted by donors appear here automatically in real time.
              </span>
            </div>
          ) : (
            <div className={styles.pickupList}>
              {availableTasks.slice(0, 5).map((item) => {
                const distKm =
                  riderCoords && item.pickupLat != null && item.pickupLng != null
                    ? LocationService.calculateDistance(
                        riderCoords.latitude,
                        riderCoords.longitude,
                        item.pickupLat,
                        item.pickupLng
                      )
                    : item.distanceKm;
                const isAccepting = busyId === item.id;
                const donorTitle = item.donorName
                  ? `${item.foodTitle || 'Food'} · ${item.donorName}`
                  : item.foodTitle || 'Food Donation';

                return (
                  <div key={item.id} className={styles.pickupRow}>
                    <div className={styles.pickupThumb}>
                      {item.foodImageUrl ? (
                        <img src={item.foodImageUrl} alt={item.foodTitle} className={styles.pickupImg} />
                      ) : (
                        <FoodFallbackThumb />
                      )}
                    </div>

                    <div className={styles.pickupDetails}>
                      <h3 className={styles.pickupName} title={donorTitle}>
                        {donorTitle}
                      </h3>
                      <p className={styles.pickupMetaLine}>
                        <MapPin size={12} color="#64748b" />
                        <span>
                          {item.pickupAddress || 'Donor pickup point'}
                          {distKm != null ? ` • ${distKm} km` : ''}
                        </span>
                      </p>
                      <p className={styles.pickupMetaLine}>
                        <Clock size={12} color="#64748b" />
                        <span>
                          {formatPickupWindow(item.collectionDeadline, item.createdAt)} ·{' '}
                          <strong>
                            {item.servingsRequired} {item.quantityUnit}
                          </strong>
                        </span>
                      </p>
                      {item.instructions && (
                        <p className={styles.pickupInstruction} title={item.instructions}>
                          {item.instructions}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.acceptBtn}
                      disabled={isAccepting || Boolean(activeTask)}
                      title={
                        activeTask
                          ? 'Complete your active delivery before accepting another'
                          : 'Accept pickup & launch Google Maps navigation'
                      }
                      onClick={() => handleAcceptPickup(item)}
                    >
                      {isAccepting ? <Loader2 size={15} className="animate-spin" /> : 'Accept'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Delivery */}
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <span className={styles.panelIconBox}>
                <Truck size={18} />
              </span>
              <h2 className={styles.panelTitle}>Active Delivery</h2>
            </div>
            {activeTask ? (
              <span className={styles.inProgressPill}>
                <span className={styles.pulseDot} />{' '}
                {STATUS_BADGES[activeTask.status] || 'In Progress'}
              </span>
            ) : (
              <span className={styles.idlePill}>Standby</span>
            )}
          </div>

          {!activeTask ? (
            <div className={styles.emptyBox}>
              <Truck size={34} color="#fb923c" />
              <p className={styles.emptyHeading}>No active delivery assigned</p>
              <span className={styles.emptySub}>
                Click <strong>Accept</strong> on any available donation to lock the pickup, notify the donor, and launch Google Maps navigation.
              </span>
            </div>
          ) : (
            <div className={styles.activeBody}>
              <div className={styles.timelineCol}>
                <div className={styles.activeFoodSummary}>
                  <strong>{activeTask.foodTitle || 'Food Pickup'}</strong>
                  <span>
                    {activeTask.servingsRequired} {activeTask.quantityUnit} · Donor:{' '}
                    {activeTask.donorName || 'Verified Donor'}
                  </span>
                </div>

                {/* Vertical Milestone Stepper */}
                <div className={styles.vTimeline}>
                  <div className={styles.vStep}>
                    <div className={`${styles.vDot} ${styles.vDotDone}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className={styles.vStepContent}>
                      <div className={styles.vStepTitle}>
                        {activeTask.status === 'arrived_at_pickup'
                          ? 'Arrived at Pickup'
                          : activeTask.status === 'going_to_pickup'
                          ? 'On the Way to Donor'
                          : 'Accepted Pickup'}
                      </div>
                      <div className={styles.vStepSub}>
                        {activeTask.pickupAddress || 'Donor location'}
                      </div>
                      {activeTask.riderAssignedAt && (
                        <div className={styles.vStepTime}>
                          {new Date(activeTask.riderAssignedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.vStep}>
                    <div className={`${styles.vDot} ${isPickedUpDone ? styles.vDotDone : ''}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className={styles.vStepContent}>
                      <div className={styles.vStepTitle}>Picked Up</div>
                      <div className={styles.vStepSub}>
                        Food collected from {activeTask.donorName || 'Donor'}
                      </div>
                      {activeTask.pickupConfirmedAt && (
                        <div className={styles.vStepTime}>
                          {new Date(activeTask.pickupConfirmedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.vStep}>
                    <div className={`${styles.vDot} ${isInTransitDone ? styles.vDotDone : ''}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className={styles.vStepContent}>
                      <div className={styles.vStepTitle}>On the Way</div>
                      <div className={styles.vStepSub}>
                        Delivering to{' '}
                        {activeTask.ngoOrgName ||
                          activeTask.ngoName ||
                          activeTask.dropoffAddress ||
                          'destination'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.vStep}>
                    <div className={`${styles.vDot} ${isDeliveredDone ? styles.vDotDone : ''}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <div className={styles.vStepContent}>
                      <div className={styles.vStepTitle}>Delivered</div>
                      <div className={styles.vStepSub}>Complete delivery</div>
                    </div>
                  </div>
                </div>

                {/* Next Step Action + Chat + Directions */}
                <div className={styles.activeControls}>
                  {(() => {
                    const nextStep = getNextStatusAction(activeTask);
                    if (!nextStep) return null;
                    return (
                      <button
                        type="button"
                        className={styles.nextStatusBtn}
                        disabled={busyId === activeTask.id}
                        onClick={() => handleUpdateActiveStatus(activeTask, nextStep.next)}
                      >
                        {busyId === activeTask.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={15} />
                        )}
                        {nextStep.label}
                      </button>
                    );
                  })()}

                  <div className={styles.secondaryActionRow}>
                    {activeNavUrl && (
                      <a
                        href={activeNavUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.liveTrackBtn}
                      >
                        <Navigation size={13} /> Open Directions
                      </a>
                    )}
                    <button
                      type="button"
                      className={styles.liveTrackBtn}
                      onClick={() => handleOpenDonorChat(activeTask)}
                    >
                      <MessageSquare size={13} /> Chat
                    </button>
                  </div>

                  <Link to="/rider/deliveries?tab=active" className={styles.viewTrackingPill}>
                    <MapPin size={13} color="#ea580c" /> View Live Tracking <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              <div className={styles.mapCol}>
                <LiveTrackingMap
                  deliveryTaskId={activeTask.id}
                  taskStatus={activeTask.status}
                  pickupLat={activeTask.pickupLat}
                  pickupLng={activeTask.pickupLng}
                  pickupLabel={activeTask.pickupAddress || activeTask.donorName || 'Donor Pickup'}
                  dropoffLat={activeTask.dropoffLat}
                  dropoffLng={activeTask.dropoffLng}
                  dropoffLabel={
                    activeTask.ngoOrgName ||
                    activeTask.ngoName ||
                    activeTask.dropoffAddress ||
                    'Destination'
                  }
                  height={250}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Bottom Row: Recent Deliveries + Motivational Card ───────────── */}
      <section className={styles.bottomGrid}>
        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <span className={styles.panelIconBox}>
                <Clock size={17} />
              </span>
              <h2 className={styles.panelTitle}>Recent Deliveries</h2>
            </div>
            <Link to="/rider/deliveries?tab=completed" className={styles.viewAllLink}>
              View All <ArrowRight size={13} />
            </Link>
          </div>

          {completedDeliveries.length === 0 ? (
            <div className={styles.recentEmpty}>
              Your completed food rescues will appear here once delivered.
            </div>
          ) : (
            <div className={styles.recentList}>
              {completedDeliveries.slice(0, 3).map((rec) => {
                const ts = rec.completedAt || rec.deliveryConfirmedAt || rec.updatedAt;
                return (
                  <div key={rec.id} className={styles.recentRow}>
                    <div className={styles.recentLeft}>
                      <div className={styles.recentThumb}>
                        {rec.foodImageUrl ? (
                          <img src={rec.foodImageUrl} alt={rec.foodTitle} className={styles.pickupImg} />
                        ) : (
                          <FoodFallbackThumb />
                        )}
                      </div>
                      <span className={styles.recentTitle}>
                        {rec.foodTitle || 'Food Rescue'}
                      </span>
                    </div>

                    <span className={styles.deliveredBadge}>Delivered</span>

                    <span className={styles.recentDate}>
                      {new Date(ts).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                      ,{' '}
                      {new Date(ts).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <span className={styles.recentRightStat}>
                      {rec.servingsDelivered ?? rec.servingsRequired} {rec.quantityUnit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.motivationCard}>
          <div className={styles.trophyWrap} aria-hidden="true">
            🏆
          </div>
          <div>
            <h3 className={styles.motivationTitle}>Great Work, Rider!</h3>
            <p className={styles.motivationSub}>
              {totalDeliveriesCount > 0
                ? `You've completed ${totalDeliveriesCount} rescue${totalDeliveriesCount > 1 ? 's' : ''} — keep spreading happiness ❤️`
                : 'Go online and accept a pickup nearby to rescue meals ❤️'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
