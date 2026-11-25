import { useEffect, useState, lazy, Suspense } from 'react';
import { DonationService } from '../../services/donations';
import { PageLoader } from '../../components/states/LoadingState';
import type { FoodListing } from '../../types';
import styles from './MapPage.module.css';
import { useNavigate } from 'react-router-dom';
import { Utensils } from 'lucide-react';

// Dynamic import for Leaflet to avoid SSR issues
const FoodMap = lazy(() => import('../../components/map/FoodMap'));

export default function MapPage() {
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    DonationService.getActiveListings()
      .then(data => setListings(data.filter(l => l.latitude && l.longitude)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Live Food Map</h1>
        <p className={styles.subtitle}>{listings.length} active listing{listings.length !== 1 ? 's' : ''} with location data</p>
      </div>
      <div className={styles.mapContainer}>
        {loading ? <PageLoader /> : (
          <Suspense fallback={<PageLoader />}>
            <FoodMap listings={listings} onMarkerClick={id => navigate(`/donations/${id}`)} />
          </Suspense>
        )}
      </div>
      {!loading && listings.length === 0 && (
        <div className={styles.emptyMap}>
          <Utensils size={24} />
          <p>No listings with location data yet. Donors need to add their location when posting.</p>
        </div>
      )}
    </div>
  );
}
