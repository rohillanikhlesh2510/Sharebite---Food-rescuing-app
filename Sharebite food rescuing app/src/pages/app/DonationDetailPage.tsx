import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Clock, Users, CheckCircle, ArrowLeft, Utensils, AlertTriangle, ShieldAlert, ArrowRight, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { ClaimsService } from '../../services/claims';
import { PageLoader } from '../../components/states/LoadingState';
import { EmptyState } from '../../components/states/EmptyState';
import type { FoodListing } from '../../types';
import styles from './DonationDetailPage.module.css';

export default function DonationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<FoodListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimServings, setClaimServings] = useState(1);
  const [claimNotes, setClaimNotes] = useState('');
  const [error, setError] = useState('');

  const fetchListing = useCallback(() => {
    if (!id) return;
    DonationService.getListingById(id)
      .then(data => {
        setListing(data);
        if (data && data.availableServings > 0) {
          setClaimServings(Math.min(data.availableServings, 1));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  const handleClaim = async () => {
    if (!listing || !user) return;
    setClaiming(true);
    setError('');
    try {
      // Use the secure transactional RPC for NGO claims
      await ClaimsService.claimFood(listing.id, claimServings, undefined, claimNotes || undefined);
      setClaimed(true);
      fetchListing();
    } catch (err: any) {
      setError(err.message || 'Failed to claim. Please try again.');
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
  const isNGO = user?.role === 'ngo' || user?.role === 'receiver';
  const isVolunteer = user?.role === 'volunteer';
  const isDonor = listing.donorId === user?.id;

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
                    <p className={styles.metaLabel}>{listing.pickupAddress}</p>
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
                    ? <img src={listing.donor.avatar} alt={listing.donor.name} />
                    : <span>{listing.donor.name.charAt(0)}</span>}
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
                <strong>Food Reserved Successfully!</strong>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>
                A delivery task has been created for verified volunteer riders. You can track pickup progress and delivery verification in your claims dashboard.
              </p>
              <Link
                to="/my-claims"
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
                Track in My Claims <ArrowRight size={14} />
              </Link>
            </div>
          ) : (isNGO || isVolunteer) && (listing.status === 'available' || listing.status === 'partially_reserved') && !isDonor ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Reserve for Your Community</h4>
              
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

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  Pickup Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Volunteer arriving by 4:00 PM"
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>

              <button className={styles.claimBtn} onClick={handleClaim} disabled={claiming || listing.availableServings <= 0}>
                {claiming ? 'Reserving...' : `Reserve ${claimServings} Serving${claimServings > 1 ? 's' : ''}`}
              </button>
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

          {isDonor && (
            <button
              className={styles.cancelBtn}
              onClick={async () => {
                if (window.confirm('Cancel this donation?')) {
                  await DonationService.cancelListing(listing.id);
                  navigate('/donations');
                }
              }}
            >
              Cancel Donation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
