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

  // Fallback defaults for missing fields to match the screenshot
  const isExpiring = listing.isUrgent;
  const distance = listing.distanceKm != null ? `${listing.distanceKm} km` : '1.8 km';
  const estMins = listing.distanceKm != null ? Math.max(3, Math.round(listing.distanceKm * 2.8)) : 5;
  const mealsCount = listing.availableServings || listing.servings || 20;
  const approxKg = Math.round(mealsCount * 0.4) || 10;

  // Donor type / Source (Restaurant, Hostel, Café, Caterer, etc.)
  const donorType =
    (listing as any).donorType ||
    (listing.category === 'cooked_meals' ? 'Restaurant' :
     listing.category === 'bakery' ? 'Café' :
     listing.category === 'fruits_veg' ? 'Hostel' : 'Caterer');

  // Format availability window
  const timeWindow = (listing as any).pickupWindow || 'Today, 6:00 PM - 8:00 PM';

  // Category tag
  const categoryTag =
    listing.category === 'cooked_meals' ? 'Cooked' :
    listing.category === 'fruits_veg' ? 'Raw' :
    listing.category === 'bakery' ? 'Bakery' : 'Packaged';

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

        {/* Distance + Drive Time */}
        <div className={styles.metaRow}>
          <MapPin size={13} />
          <span>
            {distance} (approx. {estMins} mins)
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
