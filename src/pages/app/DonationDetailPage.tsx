import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapPin, Clock, Users, CheckCircle, ArrowLeft, Utensils, AlertTriangle, ShieldAlert, ArrowRight, Edit, Truck, Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../services/auth';
import { DonationService } from '../../services/donations';
import { ClaimsService } from '../../services/claims';
import { supabase } from '../../lib/supabase';
import LiveTrackingMap from '../../components/map/LiveTrackingMap';
import { PageLoader } from '../../components/states/LoadingState';
import { EmptyState } from '../../components/states/EmptyState';
import type { FoodListing, DonationStatusHistoryItem } from '../../types';
import styles from './DonationDetailPage.module.css';

export default function DonationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claimPanelRef = useRef<HTMLDivElement>(null);

  const [listing, setListing] = useState<FoodListing | null>(null);
  const [history, setHistory] = useState<DonationStatusHistoryItem[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimResultRole, setClaimResultRole] = useState<'ngo' | 'rider'>('ngo');
  const [claimMethod, setClaimMethod] = useState<'direct_ngo_pickup' | 'ngo_delivery'>('direct_ngo_pickup');
  const [claimServings, setClaimServings] = useState(1);
  const [claimNotes, setClaimNotes] = useState('');
  const [error, setError] = useState('');

  const userId = user?.id;
  const canonicalRole = normalizeRole(user?.role);

  const fetchListing = useCallback(() => {
    if (!id) return Promise.resolve();
    return Promise.all([
      DonationService.getListingById(id),
      DonationService.getStatusHistory(id),
      supabase
        .from('delivery_tasks')
        .select('*')
        .eq('food_listing_id', id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      userId
        ? supabase
            .from('ngo_claims')
            .select('id, ngo_id')
            .eq('food_listing_id', id)
            .eq('ngo_id', userId)
            .neq('status', 'cancelled')
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])
      .then(([data, hist, taskRes, claimRes]) => {
        setListing(data);
        setHistory(hist);
        const taskRow = (taskRes as any)?.data || null;
        setActiveTask(taskRow);
        const userHasClaim = !!(claimRes as any)?.data;
        const isAssignedParticipant =
          userHasClaim ||
          (taskRow && userId && (taskRow.donor_id === userId || taskRow.ngo_id === userId));
        setIsParticipant(!!isAssignedParticipant);
        if (data && data.availableServings > 0) {
          setClaimServings(data.availableServings);
        }
      })
      .finally(() => setLoading(false));
  }, [id, userId]);

  useEffect(() => {
    void fetchListing();
  }, [fetchListing]);

  useEffect(() => {
    if (!loading && searchParams.get('action') === 'claim' && claimPanelRef.current) {
      claimPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, searchParams]);

  const handleClaim = async (methodOverride?: 'direct_ngo_pickup' | 'ngo_delivery') => {
    if (!listing || !user) return;
    const chosenMethod = methodOverride || claimMethod;
    setClaimMethod(chosenMethod);
    setClaiming(true);
    setError('');
    try {
      const res = await ClaimsService.acceptDonation(
        listing.id,
        claimServings,
        undefined,
        claimNotes || undefined,
        chosenMethod
      );
      setClaimResultRole(res.acceptedBy);
      setClaimed(true);
      await fetchListing();
    } catch (err: any) {
      setError(err.message || 'Failed to accept donation. Another user may have claimed it first.');
      await fetchListing();
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!listing) return <EmptyState icon={<Utensils size={28} />} title="Donation not found" description="This listing may have been removed or completed." />;

  const isExpired = new Date(listing.availableUntil).getTime() <= Date.now();
  const hoursLeft = (new Date(listing.availableUntil).getTime() - Date.now()) / (1000 * 60 * 60);
  const isExpiringSoon = !isExpired && hoursLeft <= 2;
  const expiryText = isExpired ? 'Expired' : formatDistanceToNow(new Date(listing.availableUntil), { addSuffix: true });
  const isNGO = canonicalRole === 'ngo';
  const isRider = canonicalRole === 'rider';
  const isDonor = listing.donorId === user?.id;
  // Privacy guard: exact address only revealed to Donor, Admin, or assigned Claiming NGO / Rider
  const canSeeExactAddress = isDonor || canonicalRole === 'admin' || claimed || isParticipant;

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Urgent / Expiry Alert Banner */}
      {isExpiringSoon && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          color: '#b45309',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <AlertTriangle size={18} color="#d97706" />
          <span><strong>Expiring Soon!</strong> This food will expire within 2 hours. Prompt pickup requested.</span>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          {listing.imageUrl && (
            <img src={listing.imageUrl} alt={listing.title} className={styles.image} />
          )}
          <div className={styles.content}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{listing.title}</h1>
              <span className={`${styles.foodTypeTag} ${listing.foodType === 'veg' || listing.foodType === 'vegan' ? styles.veg : styles.nonveg}`}>
                {listing.foodType}
              </span>
            </div>
            {listing.description && <p className={styles.description}>{listing.description}</p>}

            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <Users size={16} color="var(--color-primary)" />
                <div>
                  <p className={styles.metaValue}>{listing.availableServings} / {listing.servings}</p>
                  <p className={styles.metaLabel}>Servings available</p>
                </div>
              </div>
              <div className={styles.metaCard}>
                <Clock size={16} color="var(--color-warning)" />
                <div>
                  <p className={styles.metaValue}>Expires {expiryText}</p>
                  <p className={styles.metaLabel}>{new Date(listing.availableUntil).toLocaleString()}</p>
                </div>
              </div>
              {listing.city && (
                <div className={styles.metaCard}>
                  <MapPin size={16} color="var(--color-secondary)" />
                  <div>
                    <p className={styles.metaValue}>{listing.city}</p>
                    <p className={styles.metaLabel}>
                      {canSeeExactAddress ? listing.pickupAddress : 'Exact address shared once accepted'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Food Safety & Dietary Info */}
            <div style={{
              marginTop: 20,
              padding: 16,
              background: '#fafaf9',
              borderRadius: 8,
              border: '1px solid #e7e5e4',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#444' }}>
                <ShieldAlert size={15} color="#ea580c" />
                <span>Food Safety & Handling Specifications</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#666' }}>
                <div>
                  <strong>Storage: </strong>
                  <span style={{ textTransform: 'capitalize' }}>
                    {listing.storageType ? listing.storageType.replace(/_/g, ' ') : 'Room Temperature'}
                  </span>
                </div>
                {listing.allergens && listing.allergens.length > 0 && (
                  <div>
                    <strong>Allergens: </strong>
                    <span>{listing.allergens.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {listing.donor && (
              <div className={styles.donorCard}>
                <div className={styles.donorAvatar}>
                  {listing.donor.avatar
                    ? <img src={listing.donor.avatar} alt={listing.donor.name || 'Donor'} />
                    : <span>{(listing.donor.name || 'D').charAt(0).toUpperCase()}</span>}
                </div>
                <div>
                  <p className={styles.donorName}>{listing.donor.name}</p>
                  <p className={styles.donorRole}>{listing.donor.role}</p>
                </div>
                {listing.donor.isVerified && (
                  <CheckCircle size={16} color="var(--color-success)" className={styles.verifiedIcon} />
                )}
              </div>
            )}

            {activeTask && canSeeExactAddress && (
              <div style={{ marginTop: 20 }}>
                <LiveTrackingMap
                  deliveryTaskId={activeTask.id}
                  taskStatus={activeTask.status}
                  pickupLat={activeTask.pickup_lat ?? listing.latitude}
                  pickupLng={activeTask.pickup_lng ?? listing.longitude}
                  pickupLabel={listing.pickupAddress || 'Donor Pickup'}
                  dropoffLat={activeTask.dropoff_lat}
                  dropoffLng={activeTask.dropoff_lng}
                  dropoffLabel={activeTask.dropoff_address || 'NGO Destination'}
                  height={220}
                />
              </div>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: 20, padding: 16, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: '#374151' }}>Live Status History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#4b5563' }}>
                  {history.map((h) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span><strong>{h.newStatus.replace(/_/g, ' ')}</strong>{h.notes ? ` — ${h.notes}` : ''}</span>
                      <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3>Status</h3>
            <span className={`${styles.statusBadge} ${styles[`status_${listing.status}`]}`}>
              {listing.status.replace(/_/g, ' ')}
            </span>
            <div className={styles.servingBar}>
              <div
                className={styles.servingFill}
                style={{ width: `${(listing.availableServings / listing.servings) * 100}%` }}
              />
            </div>
            <p className={styles.servingText}>
              {listing.availableServings} of {listing.servings} servings still available
            </p>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {claimed ? (
            <div className={styles.successBanner} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={20} />
                <strong>{claimResultRole === 'rider' ? 'Pickup Accepted Successfully!' : 'Food Accepted Successfully!'}</strong>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>
                {claimResultRole === 'rider'
                  ? 'You won this pickup assignment. Head to your Rider Dashboard for live navigation and verification.'
                  : claimMethod === 'direct_ngo_pickup'
                  ? 'Assigned directly to your NGO for self-pickup. Open My Claims to navigate to the donor and confirm receipt.'
                  : 'A delivery task has been created and nearby riders have been notified. Track live progress in My Claims.'}
              </p>
              <Link
                to={claimResultRole === 'rider' ? '/rider-dashboard' : '/my-claims'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: '#16a34a',
                  color: '#ffffff',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: 'none',
                  marginTop: 4,
                }}
              >
                {claimResultRole === 'rider' ? 'Open Rider Dashboard' : 'Track in My Claims'} <ArrowRight size={14} />
              </Link>
            </div>
          ) : (isNGO || isRider) && (listing.status === 'available' || listing.status === 'partially_reserved') && !isDonor && !isExpired ? (
            <div ref={claimPanelRef} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {isRider ? 'Accept Food Pickup' : 'Accept Food for Your NGO'}
              </h4>
              
              {isNGO && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    Servings to claim (Max: {listing.availableServings})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={listing.availableServings}
                    value={claimServings}
                    onChange={(e) => setClaimServings(Math.max(1, Math.min(listing.availableServings, parseInt(e.target.value) || 1)))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  Pickup Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arriving within 20 minutes"
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>

              {isNGO ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    className={styles.claimBtn}
                    onClick={() => handleClaim('direct_ngo_pickup')}
                    disabled={claiming || listing.availableServings <= 0}
                  >
                    <Navigation size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {claiming && claimMethod === 'direct_ngo_pickup'
                      ? 'Confirming Direct Pickup...'
                      : `Collect Directly (${claimServings} Serving${claimServings > 1 ? 's' : ''})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClaim('ngo_delivery')}
                    disabled={claiming || listing.availableServings <= 0}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1.5px solid #ea580c',
                      background: '#fff7ed',
                      color: '#ea580c',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: claiming ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Truck size={15} />
                    {claiming && claimMethod === 'ngo_delivery' ? 'Requesting Rider...' : 'Accept & Request Rider Delivery'}
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.claimBtn} onClick={() => handleClaim('ngo_delivery')} disabled={claiming || listing.availableServings <= 0}>
                  {claiming ? 'Confirming...' : `Accept Pickup (${listing.availableServings} Servings)`}
                </button>
              )}
            </div>
          ) : null}

          {isDonor && (listing.status === 'available' || listing.status === 'partially_reserved') && (
            <Link
              to={`/donations/${listing.id}/edit`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                background: '#fff',
                border: '1.5px solid #ea580c',
                color: '#ea580c',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                marginTop: 8,
                cursor: 'pointer',
              }}
            >
              <Edit size={16} /> Edit Listing
            </Link>
          )}

          {isDonor && ['available', 'partially_reserved'].includes(listing.status) && (
            <button
              type="button"
              className={styles.cancelBtn}
              disabled={cancelling}
              onClick={async () => {
                if (!window.confirm('Cancel this donation?')) return;
                setError('');
                setCancelling(true);
                try {
                  await DonationService.cancelListing(listing.id);
                  navigate('/donor-donations');
                } catch (err: any) {
                  setError(err?.message || 'Unable to cancel this donation.');
                } finally {
                  setCancelling(false);
                }
              }}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Donation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
