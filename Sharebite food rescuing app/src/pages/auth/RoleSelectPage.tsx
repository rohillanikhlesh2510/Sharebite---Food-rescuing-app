import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Utensils,
  Bike,
  Users,
  User,
  Heart,
} from 'lucide-react';
import RoleCard, { type RoleConfigItem } from '../../components/auth/RoleCard';

// Authentic photography
import donorChefPhoto from '../../assets/donor_chef_photo.jpg';
import riderPhoto from '../../assets/rider_delivery_photo.jpg';
import ngoPhoto from '../../assets/ngo_volunteers_photo.jpg';
import communityMemberPhoto from '../../assets/community_member_photo.jpg';

// Atmosphere & Decorative Assets
import leafTopLeft from '../../assets/leaf_tl_pure.png';
import leafTopRight from '../../assets/leaf_tr_pure.png';
import leafBottomLeft from '../../assets/leaf_bl_pure.png';
import indiaGateWatermark from '../../assets/watermark_india_gate_clean.png';
import skylineWatermark from '../../assets/watermark_skyline_clean.png';
import doodleLeftHeart from '../../assets/doodle_left_heart_clean.png';

import styles from './RoleSelect.module.css';

const ROLES: RoleConfigItem[] = [
  {
    id: 'donor',
    title: 'Food Donor',
    description: 'Share surplus food. Reduce waste.',
    benefits: [
      'List surplus food in minutes',
      'Track real-time impact',
      'Get impact certificates',
    ],
    image: donorChefPhoto,
    icon: <Utensils size={17} strokeWidth={2.4} />,
    themeColor: '#2D4A3E',
    arrowBg: '#3F5B4E',
    checkColor: '#2D4A3E',
    url: '/register/donor',
  },
  {
    id: 'rider',
    title: 'Rider',
    description: 'Deliver hope, one meal at a time.',
    benefits: [
      'Flexible working hours',
      'Earn good income',
      'Be a part of a bigger cause',
    ],
    image: riderPhoto,
    icon: <Bike size={18} strokeWidth={2.4} />,
    themeColor: '#FF521C',
    arrowBg: '#FF521C',
    checkColor: '#FF521C',
    url: '/register/rider',
    isRecommended: true,
  },
  {
    id: 'acceptor',
    title: 'NGO / Shelter',
    description: 'Connect people with food and support.',
    benefits: [
      'Get verified donations',
      'Manage food distribution',
      'Build stronger communities',
    ],
    image: ngoPhoto,
    icon: <Users size={18} strokeWidth={2.4} />,
    themeColor: '#5C3F68',
    arrowBg: '#A684B0',
    checkColor: '#5C3F68',
    url: '/register/acceptor',
  },
  {
    id: 'community',
    title: 'Community Member',
    description: 'Support, donate, make a difference.',
    benefits: [
      'Find nearby food drives',
      'Request food support',
      'Be part of the change',
    ],
    image: communityMemberPhoto,
    icon: <User size={18} strokeWidth={2.4} />,
    themeColor: '#546A42',
    arrowBg: '#6B8058',
    checkColor: '#546A42',
    url: '/register/community',
  },
];

export default function RoleSelectPage({ initialMode: _initialMode }: { initialMode?: 'signup' | 'login' } = {}) {
  const navigate = useNavigate();
  void _initialMode;
  // Rider is selected by default on initial page load (TC-01, TC-03)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('rider');
  const [isNavigating, setIsNavigating] = useState(false);

  const selectedIndex = ROLES.findIndex((r) => r.id === selectedRoleId);

  const handleSelectRole = useCallback((roleId: string) => {
    setSelectedRoleId(roleId);
  }, []);

  const handleContinue = useCallback(
    (role: RoleConfigItem) => {
      if (isNavigating) return;
      setIsNavigating(true);
      navigate(role.url, { state: { selectedRole: role.id } });
    },
    [isNavigating, navigate]
  );

  return (
    <div className={styles.page}>
      {/* ─── BOTANICAL CORNER LEAVES ─── */}
      <img
        src={leafTopLeft}
        className={styles.leafTL}
        alt=""
        aria-hidden="true"
        loading="eager"
      />
      <img
        src={leafTopRight}
        className={styles.leafTR}
        alt=""
        aria-hidden="true"
        loading="eager"
      />
      <img
        src={leafBottomLeft}
        className={styles.leafBL}
        alt=""
        aria-hidden="true"
        loading="eager"
      />

      {/* ─── BACKGROUND WATERMARK MONUMENTS ─── */}
      <div className={styles.watermarkLeft} aria-hidden="true">
        <img
          src={indiaGateWatermark}
          alt=""
          className={styles.watermarkImg}
          loading="lazy"
        />
      </div>

      <div className={styles.watermarkRight} aria-hidden="true">
        <img
          src={skylineWatermark}
          alt=""
          className={styles.watermarkImg}
          loading="lazy"
        />
      </div>

      {/* ─── HAND-DRAWN DOODLES ─── */}
      <div className={styles.doodleHeartLeft} aria-hidden="true">
        <img
          src={doodleLeftHeart}
          alt=""
          className={styles.doodleImg}
          loading="lazy"
        />
      </div>

      <div className={styles.doodleNoteRight} aria-hidden="true">
        <div className={styles.doodleNoteContent}>
          <div className={styles.doodleNoteText}>
            <span>Good Food</span>
            <span>Creates</span>
            <span>Better Tomorrows</span>
          </div>
          <div className={styles.doodleUnderlines}>
            <div className={styles.doodleLine1} />
            <div className={styles.doodleLine2} />
          </div>
        </div>
        <svg
          className={styles.doodleNoteHeart}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8A7B62"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>

      {/* ─── TOP NAVBAR (Clean Horizontal Header) ─── */}
      <header className={styles.navbar}>
        <Link to="/" className={styles.logoLink} aria-label="ShareBite Home">
          <div className={styles.logoWrap}>
            <div className={styles.logoIcon}>
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path
                  d="M20 7.2C16.8 3.5 11.2 3.3 7.6 6.9C4.1 10.4 4.1 16.1 7.6 19.7L20 32.2L32.4 19.7C35.9 16.1 35.9 10.4 32.4 6.9C28.8 3.3 23.2 3.5 20 7.2Z"
                  fill="#FFFFFF"
                />
                <path
                  d="M16 12V18M14.5 12V15.5C14.5 16.3 15.2 17 16 17C16.8 17 17.5 16.3 17.5 15.5V12M16 18V23"
                  stroke="#FF521C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M24 12C22.6 12 21.8 13.2 21.8 14.8C21.8 16.4 22.6 17.4 24 17.4V23M24 12C25.4 12 26.2 13.2 26.2 14.8C26.2 16.4 25.4 17.4 24 17.4"
                  stroke="#FF521C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoName}>ShareBite</span>
              <span className={styles.logoTagline}>Share Food. Share Hope.</span>
            </div>
          </div>
        </Link>

      </header>

      {/* ─── MAIN HEADING ─── */}
      <section className={styles.heroHeader} aria-labelledby="page-title">
        <div className={styles.welcomeBadge}>
          <div className={styles.welcomeLine} aria-hidden="true" />
          <span>Welcome to ShareBite</span>
          <div className={styles.welcomeLine} aria-hidden="true" />
        </div>
        <h1 id="page-title" className={styles.mainTitle}>
          Choose your role to<br />get started
        </h1>
        <p className={styles.subtitle}>
          Join a community that fights food waste and helps people in need.
        </p>
      </section>

      {/* ─── 3D STAGE & ROLE CARDS ─── */}
      <main className={styles.stageContainer}>
        {/* Softly Illuminated 3D Podium Floor */}
        <div className={styles.stagePodium} aria-hidden="true" />

        {/* 4 Role Cards Grid */}
        <div
          className={styles.cardsGrid}
          role="radiogroup"
          aria-label="Select your role"
        >
          {ROLES.map((role, idx) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={selectedRoleId === role.id}
              onSelect={handleSelectRole}
              onContinue={handleContinue}
              index={idx}
              selectedIndex={selectedIndex >= 0 ? selectedIndex : 1}
            />
          ))}
        </div>

        {/* ─── STAGE FOOTER & ORANGE HEART ─── */}
        <footer className={styles.stageFooter}>
          <div className={styles.stageFooterText}>
            <div className={styles.stageFooterLine} aria-hidden="true" />
            <span>Together we can reduce food waste and feed more people.</span>
            <div className={styles.stageFooterLine} aria-hidden="true" />
          </div>
          <Heart
            size={15}
            className={styles.stageHeart}
            fill="#FF521C"
            strokeWidth={0}
            aria-hidden="true"
          />
        </footer>
      </main>
    </div>
  );
}
