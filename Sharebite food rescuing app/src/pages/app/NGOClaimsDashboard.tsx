import { useEffect, useState, useCallback } from 'react';
import {
  Package, Truck, CheckCircle, X, MapPin, Clock,
  Users, Loader2, RefreshCw, ChevronDown, ChevronUp,
  ShieldCheck, PieChart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClaimsService, type NgoClaim, type DistributionRecord } from '../../services/claims';
import { formatDistanceToNow } from 'date-fns';
import styles from './NGOClaimsDashboard.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  awaiting_rider: 'Awaiting Rider',
  rider_assigned: 'Rider Assigned',
  pickup_in_progress: 'Pickup in Progress',
  food_collected: 'Food Collected',
  in_transit: 'In Transit',
  delivered: 'Delivered — Confirm Receipt',
  distribution_in_progress: 'Distributing',
  distributed: 'Fully Distributed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  disputed: 'Disputed',
};

interface ReceiptModalProps {
  claim: NgoClaim;
  onClose: () => void;
  onSuccess: () => void;
}

function ReceiptConfirmModal({ claim, onClose, onSuccess }: ReceiptModalProps) {
  const [quantity, setQuantity] = useState(claim.servingsClaimed);
  const [conditionNotes, setConditionNotes] = useState('');
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [safetyNotes, setSafetyNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!claim.deliveryTaskId) { setError('No delivery task found for this claim'); return; }
    setError('');
    setLoading(true);
    try {
      await ClaimsService.confirmNgoReceipt(
        claim.deliveryTaskId, quantity, conditionNotes || undefined,
        safetyConcern, safetyNotes || undefined
      );
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.receiptModal}>
      <div className={styles.receiptModalCard}>
        <button className={styles.modalClose} onClick={onClose}><X size={14} /></button>
        <h3 className={styles.modalTitle}>Confirm Food Receipt</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Record the food you actually received from the rider. This starts your distribution workflow.
        </p>

        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Quantity Received (servings)</label>
            <input
              className={styles.formInput}
              type="number"
              min={0}
              value={quantity}
              onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className={styles.formField} style={{ marginBottom: 12 }}>
          <label className={styles.formLabel}>Condition Notes (optional)</label>
          <textarea
            className={styles.formInput}
            value={conditionNotes}
            onChange={e => setConditionNotes(e.target.value)}
            placeholder="Packaging condition, temperature, quality observations..."
            rows={3}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox" id="safety"
            checked={safetyConcern}
            onChange={e => setSafetyConcern(e.target.checked)}
          />
          <label htmlFor="safety" style={{ fontSize: 13, color: '#374151' }}>
            Flag safety concern (food may not be safe to distribute)
          </label>
        </div>

        {safetyConcern && (
          <div className={styles.safetyWarning} style={{ marginBottom: 12 }}>
            <strong>⚠️ Safety Concern Flagged</strong>
            Food flagged with a safety concern cannot be distributed until reviewed.
            <textarea
              className={styles.formInput}
              value={safetyNotes}
              onChange={e => setSafetyNotes(e.target.value)}
              placeholder="Describe the safety concern..."
              rows={2}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.modalActions}>
          <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={14} /> : <CheckCircle size={14} />} Confirm Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

interface DistributionFormProps {
  record: DistributionRecord;
  onSuccess: () => void;
}

function DistributionForm({ record, onSuccess }: DistributionFormProps) {
  const [quantity, setQuantity] = useState(record.quantityRemaining);
  const [peopleServed, setPeopleServed] = useState<number | ''>('');
  const [method, setMethod] = useState('direct');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async () => {
    setError('');
    if (quantity <= 0) { setError('Distribution quantity must be positive'); return; }
    if (quantity > record.quantityRemaining) {
      setError(`Cannot distribute ${quantity} — only ${record.quantityRemaining} remaining`);
      return;
    }
    setLoading(true);
    try {
      await ClaimsService.recordDistribution(
        record.id, quantity,
        peopleServed ? Number(peopleServed) : undefined,
        undefined, method, location || undefined, notes || undefined
      );
      setSuccess(`Successfully distributed ${quantity} ${record.quantityUnit}!`);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pct = record.quantityReceived > 0
    ? ((record.quantityDistributed / record.quantityReceived) * 100)
    : 0;

  return (
    <div className={styles.distributionCard}>
      <h4 className={styles.distributionTitle}>
        <PieChart size={16} /> Record Food Distribution
      </h4>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          <span>{record.quantityDistributed} distributed</span>
          <span>{record.quantityRemaining} remaining of {record.quantityReceived} {record.quantityUnit}</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {record.safetyConcern && (
        <div className={styles.safetyWarning} style={{ marginBottom: 12 }}>
          <strong>⚠️ Safety Concern Flagged</strong>
          Distribution is blocked until an administrator reviews this food.
        </div>
      )}

      {!record.safetyConcern && record.quantityRemaining > 0 && (
        <>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Quantity to Distribute ({record.quantityUnit})</label>
              <input
                className={styles.formInput} type="number" min={0} max={record.quantityRemaining}
                value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>People Served (est.)</label>
              <input
                className={styles.formInput} type="number" min={0}
                value={peopleServed} onChange={e => setPeopleServed(parseInt(e.target.value) || '')}
                placeholder="Optional"
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Distribution Method</label>
              <select className={styles.formSelect} value={method} onChange={e => setMethod(e.target.value)}>
                <option value="direct">Direct Handout</option>
                <option value="shelter_meal">Shelter Meal Service</option>
                <option value="community_kitchen">Community Kitchen</option>
                <option value="food_bank">Food Bank Distribution</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Distribution Location</label>
              <input
                className={styles.formInput}
                value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g., Main shelter hall"
              />
            </div>
          </div>
          <div className={styles.formField} style={{ marginBottom: 12 }}>
            <label className={styles.formLabel}>Notes</label>
            <textarea
              className={styles.formInput}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any relevant notes..."
              rows={2}
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          <div className={styles.actionsRow}>
            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={submit} disabled={loading}>
              {loading ? <Loader2 size={14} /> : <Users size={14} />}
              Record Distribution of {quantity} {record.quantityUnit}
            </button>
          </div>
        </>
      )}

      {record.quantityRemaining <= 0 && (
        <div className={styles.successMsg}>
          <CheckCircle size={14} style={{ marginRight: 4 }} />
          All food has been distributed! Total: {record.quantityDistributed} {record.quantityUnit}
          {record.peopleServed ? ` to ${record.peopleServed} people` : ''}
        </div>
      )}
    </div>
  );
}

function ClaimCard({ claim, onRefresh }: { claim: NgoClaim; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [distribution, setDistribution] = useState<DistributionRecord | null>(null);
  const [loadingDist, setLoadingDist] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const loadDistribution = useCallback(async () => {
    if (!claim.distributionRecordId) return;
    setLoadingDist(true);
    try {
      const dr = await ClaimsService.getDistributionRecord(claim.distributionRecordId);
      setDistribution(dr);
    } finally {
      setLoadingDist(false);
    }
  }, [claim.distributionRecordId]);

  useEffect(() => {
    if (expanded) loadDistribution();
  }, [expanded, loadDistribution]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this claim? This will release the food back to the listing.')) return;
    setCancelling(true);
    try {
      await ClaimsService.cancelClaim(claim.id, 'Cancelled by NGO');
      onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleRequestDelivery = async () => {
    try {
      await ClaimsService.createDeliveryTask(claim.id);
      onRefresh();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const canCancel = ['pending', 'confirmed', 'awaiting_rider'].includes(claim.status);
  const needsDeliveryTask = claim.status === 'confirmed' && !claim.deliveryTaskId;
  const canConfirmReceipt = ['delivered', 'food_collected', 'in_transit'].includes(claim.deliveryStatus || '') && !claim.distributionRecordId;
  const deadline = claim.availableUntil
    ? formatDistanceToNow(new Date(claim.availableUntil), { addSuffix: true })
    : '';

  return (
    <div className={styles.claimCard}>
      {showReceiptModal && (
        <ReceiptConfirmModal claim={claim} onClose={() => setShowReceiptModal(false)} onSuccess={() => { onRefresh(); setShowReceiptModal(false); }} />
      )}

      <div className={styles.claimHeader}>
        {claim.foodImageUrl
          ? <img src={claim.foodImageUrl} alt={claim.foodTitle} className={styles.claimImage} />
          : <div className={styles.claimImageFallback}>🍱</div>
        }
        <div className={styles.claimInfo}>
          <h3 className={styles.claimTitle}>{claim.foodTitle || 'Food Donation'}</h3>
          <div className={styles.claimMeta}>
            {claim.pickupCity && <span><MapPin size={11} /> {claim.pickupCity}</span>}
            {' · '}
            <span><Package size={11} /> {claim.servingsClaimed} servings</span>
            {deadline && <span> · <Clock size={11} /> {deadline}</span>}
          </div>
          {claim.donorName && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Donor: {claim.donorName}</div>
          )}
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${claim.status}`] || styles.status_pending}`}>
          {STATUS_LABELS[claim.status] || claim.status}
        </span>
      </div>

      {/* Info grid */}
      <div className={styles.infoGrid}>
        {claim.riderName && (
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Rider</div>
            <div className={styles.infoValue}>{claim.riderName}</div>
          </div>
        )}
        {claim.deliveryStatus && (
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Delivery Status</div>
            <div className={styles.infoValue}>{STATUS_LABELS[claim.deliveryStatus] || claim.deliveryStatus}</div>
          </div>
        )}
        {claim.quantityReceived !== undefined && (
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Received</div>
            <div className={styles.infoValue}>{claim.quantityReceived} servings</div>
          </div>
        )}
        {claim.quantityRemaining !== undefined && (
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Remaining</div>
            <div className={styles.infoValue}>{claim.quantityRemaining} servings</div>
          </div>
        )}
      </div>

      {/* Delivery codes — show pickup code to NGO for verification */}
      {claim.dropoffCode && ['rider_assigned', 'food_collected', 'in_transit', 'delivered'].includes(claim.deliveryStatus || '') && (
        <div className={`${styles.codeBox} ${styles.codeBoxDropoff}`}>
          <ShieldCheck size={20} color="#1e40af" />
          <div>
            <div className={styles.codeTitle}>Delivery Verification Code (share with rider on arrival):</div>
            <div className={`${styles.codeValue} ${styles.codeDropoffColor}`}>{claim.dropoffCode}</div>
          </div>
        </div>
      )}

      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.actionsRow}>
        {needsDeliveryTask && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleRequestDelivery}>
            <Truck size={14} /> Request Rider
          </button>
        )}

        {canConfirmReceipt && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => setShowReceiptModal(true)}>
            <CheckCircle size={14} /> Confirm Receipt
          </button>
        )}

        {canCancel && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleCancel} disabled={cancelling}>
            <X size={14} /> Cancel Claim
          </button>
        )}

        <button
          className={`${styles.btn} ${styles.btnOutline}`}
          onClick={() => setExpanded(e => !e)}
          style={{ marginLeft: 'auto' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Less' : 'Details & Distribution'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
          {loadingDist ? (
            <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={24} style={{ color: '#ea580c' }} /></div>
          ) : distribution ? (
            <DistributionForm record={distribution} onSuccess={() => { onRefresh(); loadDistribution(); }} />
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 16 }}>
              {claim.status === 'delivered' || claim.distributionRecordId
                ? 'Confirm receipt above to start distribution'
                : 'Distribution records will appear here after food is received.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NGOClaimsDashboard() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tab, setTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [claims, setClaims] = useState<NgoClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClaims = useCallback(async (isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await ClaimsService.getMyClaims(userId);
      setClaims(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchClaims(false);
    const sub = ClaimsService.subscribeToMyClaims(userId || '', () => {
      fetchClaims(true);
    });
    return () => { sub.unsubscribe(); };
  }, [fetchClaims, userId]);

  const activeClaims = claims.filter(c => !['cancelled', 'expired', 'distributed'].includes(c.status));
  const completedClaims = claims.filter(c => c.status === 'distributed');
  const cancelledClaims = claims.filter(c => ['cancelled', 'expired'].includes(c.status));
  const displayClaims = tab === 'active' ? activeClaims : tab === 'completed' ? completedClaims : cancelledClaims;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>My Claims & Distribution</h1>
        <p className={styles.pageSubtitle}>Manage your food claims and record distribution to beneficiaries</p>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'active' ? styles.tabActive : ''}`} onClick={() => setTab('active')}>
          Active {activeClaims.length > 0 && `(${activeClaims.length})`}
        </button>
        <button className={`${styles.tab} ${tab === 'completed' ? styles.tabActive : ''}`} onClick={() => setTab('completed')}>
          Completed {completedClaims.length > 0 && `(${completedClaims.length})`}
        </button>
        <button className={`${styles.tab} ${tab === 'cancelled' ? styles.tabActive : ''}`} onClick={() => setTab('cancelled')}>
          Cancelled/Expired
        </button>
        <button
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#6b7280' }}
          onClick={() => fetchClaims(false)}
          title="Refresh claims"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Loader2 size={32} style={{ color: '#ea580c' }} /></div>
      ) : displayClaims.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{tab === 'active' ? '📋' : tab === 'completed' ? '✅' : '❌'}</div>
          <h3 className={styles.emptyTitle}>
            {tab === 'active' ? 'No active claims' : tab === 'completed' ? 'No completed distributions yet' : 'No cancelled claims'}
          </h3>
          <p className={styles.emptyText}>
            {tab === 'active' ? 'Go to Discover to find and claim available food donations.' : ''}
          </p>
        </div>
      ) : (
        displayClaims.map(claim => (
          <ClaimCard key={claim.id} claim={claim} onRefresh={fetchClaims} />
        ))
      )}
    </div>
  );
}
