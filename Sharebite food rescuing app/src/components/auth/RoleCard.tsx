import React, { useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import styles from './RoleCard.module.css';

export interface RoleConfigItem {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  image: string;
  icon: React.ReactNode;
  themeColor: string;
  arrowBg: string;
  checkColor: string;
  url: string;
  isRecommended?: boolean;
}

export interface RoleCardProps {
  role: RoleConfigItem;
  isSelected: boolean;
  onSelect: (roleId: string) => void;
  onContinue: (role: RoleConfigItem) => void;
  index: number;
  selectedIndex: number;
}

export default function RoleCard({
  role,
  isSelected,
  onSelect,
  onContinue,
  index,
  selectedIndex,
}: RoleCardProps) {
  const [imgError, setImgError] = useState(false);

  const handleCardClick = () => {
    if (!isSelected) {
      onSelect(role.id);
    } else {
      onContinue(role);
    }
  };

  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(role.id);
    onContinue(role);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isSelected) {
        onSelect(role.id);
      } else {
        onContinue(role);
      }
    }
  };

  // Determine dynamic 3D transform relative to the active selected card
  const diffFromSelected = index - selectedIndex;
  let dynamicTransformClass = '';
  if (isSelected) {
    dynamicTransformClass = styles.cardSelected;
  } else if (diffFromSelected < 0) {
    // To the left of selected
    dynamicTransformClass = diffFromSelected === -1 ? styles.cardLeft1 : styles.cardLeft2;
  } else {
    // To the right of selected
    dynamicTransformClass = diffFromSelected === 1 ? styles.cardRight1 : styles.cardRight2;
  }

  return (
    <div
      className={`${styles.cardWrapper} ${dynamicTransformClass}`}
      style={{ zIndex: isSelected ? 12 : 5 - Math.abs(diffFromSelected) }}
    >
      <div
        className={`${styles.card} ${isSelected ? styles.cardActive : ''}`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        aria-label={`${role.title}. ${role.description}. ${isSelected ? 'Currently selected. Press Enter to proceed.' : 'Press Enter to select this role.'}`}
      >
        {/* Recommended Pill Badge */}
        {role.isRecommended && (
          <div className={styles.recommendedBadge} aria-label="Recommended option">
            Recommended
          </div>
        )}

        {/* Top Photo Section with Overlapping Icon Badge */}
        <div className={styles.imageContainer}>
          {!imgError ? (
            <img
              src={role.image}
              alt={role.title}
              className={styles.cardPhoto}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className={styles.imageFallback}
              style={{ backgroundColor: role.themeColor }}
              aria-label={`${role.title} illustration`}
            >
              <div className={styles.fallbackIcon}>{role.icon}</div>
              <span className={styles.fallbackText}>{role.title}</span>
            </div>
          )}

          {/* Overlapping Icon Badge */}
          <div
            className={styles.floatingIconBadge}
            style={{ backgroundColor: role.themeColor }}
            aria-hidden="true"
          >
            {role.icon}
          </div>
        </div>

        {/* Card Body Details */}
        <div className={styles.cardBody}>
          <div className={styles.headingGroup}>
            <h2 className={styles.cardTitle}>{role.title}</h2>
            <p className={styles.cardDescription}>{role.description}</p>
          </div>

          {/* Benefits Bullet Checklist */}
          <ul className={styles.benefitsList} aria-label={`Benefits for ${role.title}`}>
            {role.benefits.map((benefit, bIdx) => (
              <li key={bIdx} className={styles.benefitItem}>
                <CheckCircle2
                  size={15}
                  className={styles.checkIcon}
                  style={{ color: role.checkColor }}
                  aria-hidden="true"
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Action Row with Circular Arrow Button */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={`${styles.arrowButton} ${isSelected ? styles.arrowButtonSelected : ''}`}
              style={{ backgroundColor: role.arrowBg }}
              onClick={handleArrowClick}
              aria-label={`Continue with ${role.title}`}
              tabIndex={0}
            >
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
