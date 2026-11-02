import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { EmptyState } from '../../components/states/EmptyState';
import { PageLoader } from '../../components/states/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import styles from './AppPage.module.css';
import rstyles from './RequestsPage.module.css';

export default function RequestsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    DonationService.getMyReservations(user.id).then(setReservations).finally(() => setLoading(false));
  }, [user]);

  const handleUpdate = async (id: string, status: string) => {
    await DonationService.updateReservationStatus(id, status);
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Reservations</h1>
          <p className={styles.pageSubtitle}>Food reservations and pickup requests</p>
        </div>
      </div>

      {loading ? <PageLoader /> : reservations.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No reservations yet"
          description="Go to Discover to find and reserve available food near you."
        />
      ) : (
        <div className={rstyles.list}>
          {reservations.map(r => (
            <div key={r.id} className={rstyles.item}>
              <div className={rstyles.itemLeft}>
                {r.foodListing?.imageUrl && <img src={r.foodListing.imageUrl} alt={r.foodListing.title} className={rstyles.thumb} />}
                <div className={rstyles.itemInfo}>
                  <h3 className={rstyles.itemTitle}>{r.foodListing?.title || 'Food listing'}</h3>
                  <p className={rstyles.itemMeta}>{r.servings} servings · {r.foodListing?.city}</p>
                  <p className={rstyles.itemTime}>
                    <Clock size={11} /> Reserved {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className={rstyles.itemRight}>
                <span className={`${rstyles.statusBadge} ${rstyles[`status_${r.status}`]}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
                {['pending', 'confirmed', 'ready_for_pickup'].includes(r.status) && (
                  <div className={rstyles.actions}>
                    <button className={rstyles.confirmBtn} onClick={() => handleUpdate(r.id, 'picked_up')}>
                      <Check size={14} /> Mark Picked Up
                    </button>
                    <button className={rstyles.cancelBtn2} onClick={() => handleUpdate(r.id, 'cancelled')}>
                      <X size={14} /> Cancel
                    </button>
                  </div>
                )}
                {r.status === 'picked_up' && (
                  <div className={rstyles.actions}>
                    <button className={rstyles.confirmBtn} onClick={() => handleUpdate(r.id, 'completed')}>
                      <Check size={14} /> Mark Completed
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
