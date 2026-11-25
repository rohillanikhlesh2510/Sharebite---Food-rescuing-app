import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Clock, Package, Truck, CheckCircle, AlertTriangle,
  Navigation, Phone, ChevronRight, X, Loader2, RefreshCw, MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClaimsService, type DeliveryTask } from '../../services/claims';
import { LocationService } from '../../services/location';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import styles from './RiderDashboard.module.css';

const STATUS_LABELS: Record<string, string> = {
  awaiting_rider: 'Available',
  rider_assigned: 'Assigned to You',
  going_to_pickup: 'Going to Pickup',
  food_collected: 'Food Collected',
  in_transit: 'In Transit',
  delivered: 'Delivered — Pending NGO Confirm',
  completed: 'Completed',
  incident: 'Incident Reported',
  cancelled: 'Cancelled',
};

interface PickupModalProps {
  task: DeliveryTask;
  onClose: () => void;
  onSuccess: () => void;
}

function PickupConfirmModal({ task, onClose, onSuccess }: PickupModalProps) {
  const [code, setCode] = useState('');
  const [servings, setServings] = useState(task.servingsRequired);
  const [discrepancy, setDiscrepancy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!code.trim()) { setError('Enter the pickup verification code'); return; }
    setLoading(true);
    try {
      await ClaimsService.confirmPickup(task.id, code, servings, discrepancy || undefined);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalCard}>
        <button className={styles.modalClose} onClick={onClose}><X size={14} /></button>
        <h3 className={styles.modalTitle}>Confirm Food Pickup</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Get the 6-character code from the donor to verify the handover.
        </p>
        <label className={styles.modalLabel}>Pickup Verification Code</label>
        <input
          className={styles.modalInput}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          style={{ letterSpacing: 4, fontFamily: 'monospace', fontSize: 18 }}
        />
        <label className={styles.modalLabel}>Servings Actually Collected</label>
        <input
          className={styles.modalInput}
          type="number"
          min={1}
          value={servings}
          onChange={e => setServings(parseInt(e.target.value) || 1)}
        />
        {servings !== task.servingsRequired && (
          <>
            <label className={styles.modalLabel}>Discrepancy Reason</label>
            <textarea
              className={`${styles.modalInput} ${styles.incidentTextarea}`}
              value={discrepancy}
              onChange={e => setDiscrepancy(e.target.value)}
              placeholder="Explain the quantity difference..."
            />
          </>
        )}
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.modalActions}>
          <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Confirm Pickup
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeliveryModalProps {
  task: DeliveryTask;
  onClose: () => void;
  onSuccess: () => void;
}

function DeliveryConfirmModal({ task, onClose, onSuccess }: DeliveryModalProps) {
  const [code, setCode] = useState('');
  const [servings, setServings] = useState(task.servingsCollected || task.servingsRequired);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!code.trim()) { setError('Enter the delivery verification code from the NGO'); return; }
    setLoading(true);
    try {
      await ClaimsService.confirmDeliveryToNgo(task.id, code, servings);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalCard}>
        <button className={styles.modalClose} onClick={onClose}><X size={14} /></button>
        <h3 className={styles.modalTitle}>Confirm Delivery to NGO</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Get the 6-character code from the NGO staff to confirm the handover.
        </p>
        <label className={styles.modalLabel}>Delivery Verification Code</label>
        <input
          className={styles.modalInput}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="XYZ456"
          maxLength={6}
          style={{ letterSpacing: 4, fontFamily: 'monospace', fontSize: 18 }}
        />
        <label className={styles.modalLabel}>Servings Actually Delivered</label>
        <input
          className={styles.modalInput}
          type="number"
          min={1}
          value={servings}
          onChange={e => setServings(parseInt(e.target.value) || 1)}
        />
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.modalActions}>
          <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={14} /> : <CheckCircle size={14} />} Confirm Delivery
          </button>
        </div>
      </div>
    </div>
  );
}

interface IncidentModalProps {
  task: DeliveryTask;
  onClose: () => void;
  onSuccess: () => void;
}

function IncidentModal({ task, onClose, onSuccess }: IncidentModalProps) {
  const [type, setType] = useState('vehicle_issue');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!notes.trim()) { setError('Please describe the incident'); return; }
    setLoading(true);
    try {
      await ClaimsService.reportIncident(task.id, type, notes);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalCard}>
        <button className={styles.modalClose} onClick={onClose}><X size={14} /></button>
        <h3 className={styles.modalTitle}>Report Incident</h3>
        <label className={styles.modalLabel}>Incident Type</label>
        <select className={styles.incidentSelect} value={type} onChange={e => setType(e.target.value)}>
          <option value="vehicle_issue">Vehicle Issue</option>
          <option value="donor_unavailable">Donor Unavailable</option>
          <option value="ngo_unavailable">NGO Unavailable</option>
          <option value="quantity_mismatch">Quantity Mismatch</option>
          <option value="food_damaged">Food Packaging Damaged</option>
          <option value="delivery_delayed">Delivery Delayed</option>
          <option value="cannot_complete">Cannot Complete Delivery</option>
          <option value="other">Other</option>
        </select>
        <label className={styles.modalLabel}>Describe the Incident</label>
        <textarea
          className={styles.incidentTextarea}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Provide details about what happened..."
          rows={4}
        />
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.modalActions}>
          <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={14} /> : <AlertTriangle size={14} />} Report Incident
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onRefresh }: { task: DeliveryTask; onRefresh: () => void }) {
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [riderCoords, setRiderCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    LocationService.getCurrentCoordinates()
      .then(c => setRiderCoords(c))
      .catch(() => {});
  }, []);

  const acceptJob = async () => {
    setError(''); setLoading(true);
    try {
      const ok = await ClaimsService.acceptDeliveryJob(task.id);
      if (ok) { setSuccess('Job accepted! Navigate to pickup.'); onRefresh(); }
      else setError('This job was already taken. Refresh for available tasks.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startTransit = async () => {
    setError(''); setLoading(true);
    try {
      await ClaimsService.updateDeliveryTaskStatus(task.id, 'in_transit');
      onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const markArrived = async () => {
    setError(''); setLoading(true);
    try {
      await ClaimsService.updateDeliveryTaskStatus(task.id, 'going_to_pickup');
      setSuccess("Arrival recorded! Request the 6-digit pickup code from donor.");
      onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deadline = task.collectionDeadline
    ? formatDistanceToNow(new Date(task.collectionDeadline), { addSuffix: true })
    : 'No deadline';

  const isOverdue = task.collectionDeadline && new Date(task.collectionDeadline) < new Date();

  // Calculated distance & ETA using live rider coordinates when available
  const etaInfo = (task.pickupLat && task.pickupLng)
    ? LocationService.calculateEtaBetween(
        riderCoords ? riderCoords.latitude : 23.2599,
        riderCoords ? riderCoords.longitude : 77.4126,
        task.pickupLat,
        task.pickupLng
      )
    : { distanceKm: 2.1, text: '7 mins' };

  return (
    <div className={styles.taskCard}>
      {showPickupModal && <PickupConfirmModal task={task} onClose={() => setShowPickupModal(false)} onSuccess={onRefresh} />}
      {showDeliveryModal && <DeliveryConfirmModal task={task} onClose={() => setShowDeliveryModal(false)} onSuccess={onRefresh} />}
      {showIncident && <IncidentModal task={task} onClose={() => setShowIncident(false)} onSuccess={onRefresh} />}

      <div className={styles.taskCardHeader}>
        <div>
          <h3 className={styles.taskTitle}>{task.foodTitle || 'Food Delivery'}</h3>
          <div className={styles.taskMeta}>
            <span className={styles.taskMetaItem}><Package size={12} /> {task.servingsRequired} {task.quantityUnit}</span>
            <span className={styles.taskMetaItem}>
              <Clock size={12} />
              <span style={{ color: isOverdue ? '#dc2626' : undefined }}>
                Deadline {deadline}
              </span>
            </span>
            <span className={styles.taskMetaItem} style={{ color: '#0284c7', fontWeight: 600 }}>
              📍 ~{etaInfo.distanceKm} km ({etaInfo.text})
            </span>
          </div>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${task.status}`] || styles.status_pending}`}>
          {STATUS_LABELS[task.status] || task.status}
        </span>
      </div>

      <div className={styles.routeRow}>
        <div className={styles.locationPin}>
          <MapPin size={12} color="#ea580c" style={{ marginRight: 4 }} />
          <strong>Pickup:</strong> {task.pickupAddress || task.donorName || 'Donor location'}
        </div>
        <span className={styles.arrow}><ChevronRight size={16} /></span>
        <div className={styles.locationPin}>
          <MapPin size={12} color="#10b981" style={{ marginRight: 4 }} />
          <strong>Deliver:</strong> {task.dropoffAddress || task.ngoOrgName || task.ngoName || 'NGO location'}
        </div>
      </div>

      {/* Pickup code (shown to rider for donor verification) */}
      {(task.status === 'rider_assigned' || task.status === 'going_to_pickup') && task.pickupCode && (
        <div className={styles.codeBox}>
          <div>
            <div className={styles.codeLabel}>Show this code to the DONOR to verify pickup:</div>
            <div className={styles.codeValue}>{task.pickupCode}</div>
          </div>
        </div>
      )}

      {/* Dropoff code (shown to rider for NGO verification) */}
      {(task.status === 'food_collected' || task.status === 'in_transit') && task.dropoffCode && (
        <div className={styles.codeBox} style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div>
            <div className={styles.codeLabel}>Show this code to the NGO to verify delivery:</div>
            <div className={styles.codeValue} style={{ color: '#1e40af' }}>{task.dropoffCode}</div>
          </div>
        </div>
      )}

      {error && <div className={styles.errorMsg}>{error}</div>}
      {success && <div className={styles.successMsg}>{success}</div>}

      <div className={styles.actionsRow}>
        {/* Accept job */}
        {task.status === 'awaiting_rider' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={acceptJob} disabled={loading}>
            {loading ? <Loader2 size={14} /> : <Truck size={14} />} Accept Job
          </button>
        )}

        {/* Navigate to pickup */}
        {(task.status === 'rider_assigned' || task.status === 'going_to_pickup') && task.pickupLat && task.pickupLng && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.pickupLat},${task.pickupLng}`}
            target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnWarning}`}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Navigation size={14} /> Navigate to Pickup
          </a>
        )}

        {/* I've Arrived */}
        {task.status === 'rider_assigned' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={markArrived} disabled={loading}>
            <CheckCircle size={14} /> I've Arrived
          </button>
        )}

        {/* Confirm pickup */}
        {(task.status === 'rider_assigned' || task.status === 'going_to_pickup') && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => setShowPickupModal(true)}>
            <CheckCircle size={14} /> Confirm Pickup
          </button>
        )}

        {/* Start transit */}
        {task.status === 'food_collected' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={startTransit} disabled={loading}>
            <Truck size={14} /> Start Delivery
          </button>
        )}

        {/* Navigate to NGO */}
        {(task.status === 'food_collected' || task.status === 'in_transit') && task.dropoffLat && task.dropoffLng && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.dropoffLat},${task.dropoffLng}`}
            target="_blank" rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnWarning}`}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Navigation size={14} /> Navigate to NGO
          </a>
        )}

        {/* Confirm delivery */}
        {(task.status === 'food_collected' || task.status === 'in_transit') && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => setShowDeliveryModal(true)}>
            <CheckCircle size={14} /> Confirm Delivery
          </button>
        )}

        {/* Chat with participants */}
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <Link
            to="/chat"
            className={`${styles.btn} ${styles.btnOutline}`}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={14} /> Chat
          </Link>
        )}

        {/* Report incident */}
        {['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit'].includes(task.status) && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setShowIncident(true)} style={{ marginLeft: 'auto' }}>
            <AlertTriangle size={14} /> Report Issue
          </button>
        )}

        {/* Contact NGO */}
        {task.riderPhone && task.status !== 'completed' && task.status !== 'cancelled' && (
          <a
            href={`tel:${task.riderPhone}`}
            className={`${styles.btn} ${styles.btnOutline}`}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Phone size={14} /> Call
          </a>
        )}
      </div>

      {task.incidentReported && (
        <div className={styles.errorMsg} style={{ marginTop: 10 }}>
          <AlertTriangle size={14} style={{ marginRight: 4 }} />
          <strong>Incident reported:</strong> {task.incidentType?.replace(/_/g, ' ')} — {task.incidentNotes}
        </div>
      )}
    </div>
  );
}

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [tab, setTab] = useState<'available' | 'mine' | 'history'>('available');
  const [availableTasks, setAvailableTasks] = useState<DeliveryTask[]>([]);
  const [myTasks, setMyTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [available, mine] = await Promise.all([
        ClaimsService.getAvailableDeliveryTasks(),
        ClaimsService.getMyDeliveryTasks(userId),
      ]);
      setAvailableTasks(available);
      setMyTasks(mine);

      // Get rider online status
      const { data: riderData } = await supabase
        .from('riders')
        .select('is_online')
        .eq('user_id', userId)
        .maybeSingle();
      if (riderData) setIsOnline(riderData.is_online);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData(false);
    const sub = ClaimsService.subscribeToAvailableTasks(() => {
      fetchData(true);
    });
    return () => { sub.unsubscribe(); };
  }, [fetchData]);

  // Live GPS Tracking: Broadcast location updates when online and on active task
  useEffect(() => {
    const activeTask = myTasks.find(t => ['rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit'].includes(t.status));
    if (!isOnline || !activeTask || !userId) return;

    const watchId = LocationService.watchLocation((coords) => {
      LocationService.updateRiderLocation({
        riderId: userId,
        deliveryTaskId: activeTask.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }).catch(() => {});
    });

    return () => {
      LocationService.clearWatch(watchId);
    };
  }, [isOnline, myTasks, userId]);

  const toggleOnline = async () => {
    if (!userId) return;
    setTogglingOnline(true);
    try {
      await supabase
        .from('riders')
        .update({ is_online: !isOnline, is_available: !isOnline })
        .eq('user_id', userId);
      setIsOnline(o => !o);
    } finally {
      setTogglingOnline(false);
    }
  };

  const activeTasks = myTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
  const historyTasks = myTasks.filter(t => ['completed', 'cancelled', 'incident'].includes(t.status));
  const displayTasks = tab === 'available' ? availableTasks : tab === 'mine' ? activeTasks : historyTasks;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Rider Dashboard</h1>
        <p className={styles.pageSubtitle}>Manage your food delivery assignments</p>
      </div>

      {/* Online Status */}
      <div className={styles.statusRow}>
        <div className={isOnline ? styles.onlineDot : styles.offlineDot} />
        <span className={styles.statusText}>
          {isOnline ? 'You are online — visible for delivery jobs' : 'You are offline — go online to receive jobs'}
        </span>
        <button
          className={`${styles.toggleBtn} ${isOnline ? styles.goOffline : styles.goOnline}`}
          onClick={toggleOnline}
          disabled={togglingOnline}
        >
          {isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'available' ? styles.tabActive : ''}`} onClick={() => setTab('available')}>
          Available Jobs {availableTasks.length > 0 && `(${availableTasks.length})`}
        </button>
        <button className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => setTab('mine')}>
          My Active Jobs {activeTasks.length > 0 && `(${activeTasks.length})`}
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`} onClick={() => setTab('history')}>
          History
        </button>
        <button
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#6b7280' }}
          onClick={() => fetchData(false)}
          title="Refresh tasks"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Loader2 size={32} className="animate-spin" style={{ color: '#ea580c' }} /></div>
      ) : displayTasks.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{tab === 'available' ? '🚴' : tab === 'mine' ? '📦' : '📋'}</div>
          <h3 className={styles.emptyTitle}>
            {tab === 'available' ? 'No available jobs right now' : tab === 'mine' ? 'No active deliveries' : 'No delivery history yet'}
          </h3>
          <p className={styles.emptyText}>
            {tab === 'available' ? 'Check back soon — new delivery tasks appear when NGOs claim food.' : tab === 'mine' ? 'Accept a job from the Available tab to get started.' : 'Your completed deliveries will appear here.'}
          </p>
        </div>
      ) : (
        displayTasks.map(task => (
          <TaskCard key={task.id} task={task} onRefresh={fetchData} />
        ))
      )}
    </div>
  );
}
