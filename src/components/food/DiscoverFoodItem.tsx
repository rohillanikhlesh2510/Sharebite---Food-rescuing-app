import { useState } from 'react';
import { Users, MapPin, Clock, Heart, Package } from 'lucide-react';
import type { FoodListing } from '../../types';
import styles from './DiscoverFoodItem.module.css';

interface Props {
  listing: FoodListing;
  isActive?: boolean;
  onSelect?: () => void;
  onViewDetails?: () => void;
  onClaim?: () => void;
}

export default function DiscoverFoodItem({
  listing,
  isActive = false,
  onSelect,
  onViewDetails,
  onClaim,
}: Props) {
  const [isFavorited, setIsFavorited] = useState(false);

  // Real derived values from Supabase listing (never hardcoded dummy distances or times)
  const isExpiring = listing.isUrgent;
  const distance = listing.distanceKm != null ? `${listing.distanceKm} km` : null;
  const estMins = listing.distanceKm != null ? Math.max(3, Math.round(listing.distanceKm * 2.8)) : null;
  const mealsCount = listing.availableServings ?? listing.servings ?? 0;
  const approxKg = mealsCount > 0 ? Math.max(1, Math.round(mealsCount * 0.25)) : 0;

  const donorType =
    listing.donor?.organizationName ||
    listing.donor?.name ||
    'Food Donor';

  const timeWindow = listing.availableUntil
    ? `Until ${new Date(listing.availableUntil).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Available now';

  const categoryTag = listing.category ? listing.category.replace(/_/g, ' ') : 'Food';

  return (
    <div
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={onSelect}
    >
      {/* Left: Circular thumbnail image with freshness pill badge */}
      <div className={styles.thumbCol}>
        <img
          src={
            listing.imageUrl ||
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'
          }
          alt={listing.title}
          className={styles.thumbImg}
          loading="lazy"
        />
        <span
          className={`${styles.freshnessBadge} ${
            isExpiring ? styles.urgentBadge : styles.freshBadge
          }`}
        >
          {isExpiring ? 'Expiring Soon' : 'Fresh'}
        </span>
      </div>

      {/* Center: Details */}
      <div className={styles.infoCol}>
        <div className={styles.titleRow}>
          <h3 className={styles.foodTitle}>{listing.title}</h3>
          <button
            type="button"
            className={`${styles.favBtn} ${isFavorited ? styles.favBtnActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsFavorited(!isFavorited);
            }}
            title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            aria-label="Save to favorites"
          >
            <Heart size={16} fill={isFavorited ? '#ef4444' : 'none'} />
          </button>
        </div>

        {/* Source type */}
        <div className={styles.metaRow}>
          <Users size={13} />
          <span>{donorType}</span>
        </div>

        {/* Distance / City + Drive Time */}
        <div className={styles.metaRow}>
          <MapPin size={13} />
          <span>
            {distance && estMins != null
              ? `${distance} (approx. ${estMins} mins)`
              : listing.city || listing.pickupAddress || 'Location set on map'}
          </span>
        </div>

        {/* Quantity (kg + meals) */}
        <div className={styles.metaRow}>
          <Package size={13} />
          <span>
            {approxKg} kg (approx. {mealsCount} meals)
          </span>
        </div>

        {/* Time window */}
        <div className={styles.metaRow}>
          <Clock size={13} />
          <span>{timeWindow}</span>
        </div>

        {/* Tags */}
        <div className={styles.tagsRow}>
          <span
            className={
              listing.foodType === 'veg' || listing.foodType === 'vegan'
                ? styles.tagVeg
                : styles.tagNonVeg
            }
          >
            {listing.foodType === 'veg' ? 'Veg' : listing.foodType === 'vegan' ? 'Vegan' : 'Non-veg'}
          </span>
          <span className={styles.tagCategory}>{categoryTag}</span>
        </div>

        {/* Actions */}
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.viewBtn}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.();
            }}
          >
            View details
          </button>
          <button
            type="button"
            className={styles.claimBtn}
            onClick={(e) => {
              e.stopPropagation();
              onClaim?.();
            }}
          >
            Claim food
          </button>
        </div>
      </div>
    </div>
  );
}
