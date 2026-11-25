import { MapPin, Clock, Users, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FoodListing } from '../../types';
import styles from './FoodCard.module.css';

interface FoodCardProps {
  listing: FoodListing;
  onClick?: () => void;
  onClaim?: () => void;
  compact?: boolean;
}

function getFreshnessLabel(listing: FoodListing) {
  const now = new Date();
  const expiry = new Date(listing.availableUntil);
  const msLeft = expiry.getTime() - now.getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (msLeft <= 0) return { label: 'Expired', color: 'expired' };
  if (hoursLeft <= 1) return { label: 'Urgent', color: 'urgent' };
  if (hoursLeft <= 3) return { label: 'Pickup Soon', color: 'soon' };
  return { label: 'Fresh', color: 'fresh' };
}

export function FoodCard({ listing, onClick, onClaim, compact }: FoodCardProps) {
  const freshness = getFreshnessLabel(listing);
  const expiryText = formatDistanceToNow(new Date(listing.availableUntil), { addSuffix: true });

  return (
    <div
      className={`${styles.card} ${compact ? styles.compact : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.imageWrap}>
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.title} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>{listing.category?.charAt(0).toUpperCase() || 'F'}</span>
          </div>
        )}
        <span className={`${styles.badge} ${styles[`badge_${freshness.color}`]}`}>
          {freshness.label}
        </span>
        {listing.isUrgent && (
          <span className={styles.urgentTag}>Urgent</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.header}>
          <h3 className={styles.title}>{listing.title}</h3>
          <span className={`${styles.foodTypeTag} ${listing.foodType === 'veg' || listing.foodType === 'vegan' ? styles.veg : styles.nonveg}`}>
            {listing.foodType === 'veg' ? 'Veg' : listing.foodType === 'vegan' ? 'Vegan' : 'Non-veg'}
          </span>
        </div>

        {listing.description && !compact && (
          <p className={styles.description}>{listing.description}</p>
        )}

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <Users size={13} />
            <span>{listing.availableServings} / {listing.servings} servings</span>
          </div>
          {listing.city && (
            <div className={styles.metaItem}>
              <MapPin size={13} />
              <span>{listing.city}</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <Clock size={13} />
            <span>Expires {expiryText}</span>
          </div>
        </div>

        {listing.donor && !compact && (
          <div className={styles.donorRow}>
            <div className={styles.donorAvatar}>
              {listing.donor.avatar
                ? <img src={listing.donor.avatar} alt={listing.donor.name} />
                : <span>{listing.donor.name.charAt(0)}</span>
              }
            </div>
            <span className={styles.donorName}>{listing.donor.name}</span>
            {listing.donor.isVerified && (
              <CheckCircle size={12} className={styles.verifiedIcon} />
            )}
          </div>
        )}

        {onClaim && (
          <button
            className={styles.claimBtn}
            onClick={(e) => { e.stopPropagation(); onClaim(); }}
          >
            Reserve Food
          </button>
        )}
      </div>
    </div>
  );
}
