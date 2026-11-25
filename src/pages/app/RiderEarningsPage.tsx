import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Truck, CheckCircle2, Clock, MapPin, Package, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClaimsService, type DeliveryTask, type RiderProfileRecord } from '../../services/claims';
import styles from './RiderDeliveriesPage.module.css';

export default function RiderEarningsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [rider, setRider] = useState<RiderProfileRecord | null>(null);
  const [tasks, setTasks] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([
      ClaimsService.getOrEnsureRiderProfile(userId, user?.name, user?.phone),
      ClaimsService.getMyDeliveryTasks(userId),
    ])
      .then(([riderProf, taskRows]) => {
        if (!active) return;
        setRider(riderProf);
        setTasks(taskRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, user?.name, user?.phone]);

  const completedTasks = tasks.filter((t) => ['delivered', 'completed'].includes(t.status));
  const totalCompleted = Math.max(rider?.totalDeliveries ?? 0, completedTasks.length);
  const totalEarnings = rider?.totalEarnings ?? 0;
  const totalServings = completedTasks.reduce(
    (sum, t) => sum + (t.servingsDelivered ?? t.servingsCollected ?? t.servingsRequired ?? 0),
    0
  );
  const computedDistance = completedTasks.reduce((sum, t) => sum + (t.estimatedKm ?? 0), 0);
  const totalDistanceKm = Math.max(rider?.totalDistanceKm ?? 0, Number(computedDistance.toFixed(1)));

  if (loading) {
    return (
      <div className={styles.centerBox}>
        <Loader2 size={30} className="animate-spin" style={{ color: '#ea580c' }} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Earnings & Rescue Ledger</h1>
          <p className={styles.subtitle}>
            Verified completed deliveries, distance covered, and payout ledger from your account
          </p>
        </div>
        <Link to="/rider/deliveries" className={styles.navBtn}>
          <Truck size={15} /> View My Deliveries
        </Link>
      </div>

      {/* Summary Stat Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className={styles.deliveryCard} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
            <Truck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{totalCompleted}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Completed Deliveries</div>
          </div>
        </div>

        <div className={styles.deliveryCard} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontWeight: 800, fontSize: 20 }}>
            ₹
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
              ₹{totalEarnings.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Recorded Rider Earnings</div>
          </div>
        </div>

        <div className={styles.deliveryCard} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{totalServings}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Meals Rescued</div>
          </div>
        </div>

        <div className={styles.deliveryCard} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>{totalDistanceKm} km</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Total Distance</div>
          </div>
        </div>
      </div>

      {/* Honest Model Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 22,
          color: '#9a3412',
          fontSize: 13,
        }}
      >
        <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Community Food Rescue Ledger:</strong> ShareBite operates as a volunteer & community food rescue network. Monetary balances reflect only verified database credits (`riders.total_earnings`); volunteer rescues record `₹0` with full meal-impact attribution.
        </div>
      </div>

      {/* Delivery & Transaction History */}
      <div className={styles.deliveryCard}>
        <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wallet size={18} color="#ea580c" /> Delivery & Transaction History
        </h2>

        {completedTasks.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            No completed deliveries recorded yet. Once you complete a food pickup & dropoff, your verified rescue record appears here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completedTasks.map((t) => {
              const dt = t.completedAt || t.deliveryConfirmedAt || t.updatedAt;
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#fcfaf7',
                    border: '1px solid #f1eae0',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>
                        {t.foodTitle || 'Food Donation'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span><MapPin size={11} /> {t.pickupAddress || t.donorName || 'Donor'}</span>
                        <span>· {t.servingsDelivered ?? t.servingsRequired} {t.quantityUnit}</span>
                        {t.estimatedKm != null && <span>· {t.estimatedKm} km</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className={`${styles.statusBadge} ${styles.st_completed}`}>Delivered</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })},{' '}
                      {new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#475569' }}>
                      Volunteer Rescue
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
