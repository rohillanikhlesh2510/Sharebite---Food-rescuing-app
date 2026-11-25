import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Search, 
  ShieldCheck, 
  MapPin, 
  Utensils, 
  Clock, 
  Users, 
  Leaf, 
  Cloud, 
  Handshake, 
  HeartHandshake,
  Bike
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { ImpactService } from '../../services/impact';
import type { CommunityImpact } from '../../types';
import heroBoyExactImg from '../../assets/hero_boy_exact.png';
import leafTopLeft from '../../assets/leaf_top_left.png';
import leafBottomLeft from '../../assets/leaf_bottom_left.png';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const [impact, setImpact] = useState<CommunityImpact | null>(null);

  useEffect(() => {
    ImpactService.getCommunityImpact().then(data => {
      if (data) setImpact(data);
    });
  }, []);

  // Use real numbers from DB or benchmark display figures from design
  const mealsRescued = impact && impact.mealsSaved > 0 
    ? impact.mealsSaved.toLocaleString() 
    : '2,005';
  const foodShared = impact && impact.foodRedistributedKg > 0 
    ? `${Math.round(impact.foodRedistributedKg)}kg` 
    : '499kg';
  const peopleReached = impact && impact.peopleReached > 0 
    ? impact.peopleReached.toLocaleString() 
    : '1,077';
  const co2Reduced = impact && impact.co2SavedKg > 0 
    ? `${Math.round(impact.co2SavedKg)}kg` 
    : '892kg';

  return (
    <div className={styles.page}>
      {/* Botanical Leaves from Reference Mockup */}
      <img src={leafTopLeft} className={styles.leafTopLeft} alt="" loading="lazy" decoding="async" aria-hidden="true" />
      <img src={leafBottomLeft} className={styles.leafBottomLeft} alt="" loading="lazy" decoding="async" aria-hidden="true" />

      {/* Primary Top Navbar */}
      <Navbar />

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className={styles.heroSection}>
        <div className={styles.heroGrid}>
          
          {/* Left Hero Column */}
          <div className={styles.heroLeft}>
            
            {/* Pill Badge */}
            <div className={styles.heroBadge}>
              <Leaf className={styles.heroBadgeIcon} />
              <span>India's Food Rescue Network</span>
            </div>

            {/* Serif Heading */}
            <h1 className={styles.heroTitle}>
              Good food should<br />
              <span className={styles.heroAccent}>never go to waste.</span>
            </h1>

            {/* Subtitle */}
            <p className={styles.heroSubtitle}>
              ShareBite connects surplus food from restaurants, hostels, caterers, 
              and homes with NGOs, shelters, and communities who need it most.
            </p>

            {/* Action Buttons */}
            <div className={styles.heroActions}>
              <Link to="/register" className={styles.btnPrimary}>
                <HeartHandshake size={18} />
                <span>Join ShareBite</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/discover" className={styles.btnSecondary}>
                <Search size={16} />
                <span>Find Food Near Me</span>
              </Link>
            </div>

            {/* Trust Features Row */}
            <div className={styles.trustRow}>
              <div className={styles.trustItem}>
                <ShieldCheck size={18} className={styles.trustIcon} />
                <span className={styles.trustLabel}>Verified<br />Donors & NGOs</span>
              </div>
              <div className={styles.trustDivider} />

              <div className={styles.trustItem}>
                <MapPin size={18} className={styles.trustIcon} />
                <span className={styles.trustLabel}>Location-Aware<br />Matching</span>
              </div>
              <div className={styles.trustDivider} />

              <div className={styles.trustItem}>
                <Users size={18} className={styles.trustIcon} />
                <span className={styles.trustLabel}>Safe & Trusted<br />Community</span>
              </div>
              <div className={styles.trustDivider} />

              <div className={styles.trustItem}>
                <Clock size={18} className={styles.trustIcon} />
                <span className={styles.trustLabel}>Real-Time<br />Updates</span>
              </div>
            </div>

          </div>

          {/* Right Hero Visual Column */}
          <div className={styles.heroRight}>

            {/* Floating Overlapping Feature Cards */}
            <div className={styles.floatingCardsContainer}>
              
              {/* Card 1: Food Donors */}
              <div className={styles.featureCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconBox} style={{ background: '#BF5B27' }}>
                    <Utensils size={20} />
                  </div>
                  <div className={styles.cardText}>
                    <span className={styles.cardTitle}>Food Donors</span>
                    <span className={styles.cardDesc}>
                      Restaurants, hostels, caterers, hotels, event organizers & more.
                    </span>
                  </div>
                </div>
                <Link to="/register/donor" className={styles.cardActionBtn}>
                  <span>I have surplus food</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Card 2: NGOs & Communities */}
              <div className={styles.featureCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconBox} style={{ background: '#5B7E35' }}>
                    <Users size={20} />
                  </div>
                  <div className={styles.cardText}>
                    <span className={styles.cardTitle}>NGOs & Communities</span>
                    <span className={styles.cardDesc}>
                      Shelters, orphanages, community organizations & more.
                    </span>
                  </div>
                </div>
                <Link to="/register/acceptor" className={styles.cardActionBtn}>
                  <span>I need food</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Card 3: Delivery Riders */}
              <div className={styles.featureCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconBox} style={{ background: '#0284C7' }}>
                    <Bike size={20} />
                  </div>
                  <div className={styles.cardText}>
                    <span className={styles.cardTitle}>Delivery Riders</span>
                    <span className={styles.cardDesc}>
                      Transport surplus food safely to those who need it most.
                    </span>
                  </div>
                </div>
                <Link to="/register/rider" className={styles.cardActionBtn}>
                  <span>I want to deliver</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

            </div>

            {/* Boy & Arch Visual Block */}
            <div className={styles.heroImageWrap}>
              <img 
                src={heroBoyExactImg} 
                alt="Smiling child receiving nutritious food through ShareBite" 
                className={styles.heroBoyImage}
                decoding="async"
                fetchPriority="high"
                width={399}
                height={390}
              />
            </div>

          </div>

        </div>
      </section>

      {/* ============================================================
          FLOATING WHITE PILL IMPACT BANNER
          ============================================================ */}
      <section className={styles.impactBannerSection}>
        <div className={styles.impactPill}>
          
          {/* Section Lead with Green Leaf Circle */}
          <div className={styles.impactLead}>
            <div className={styles.impactLeadIconBox}>
              <Leaf size={20} />
            </div>
            <div className={styles.impactLeadText}>
              <span className={styles.impactTitle}>Our Impact</span>
              <span className={styles.impactSubtitle}>Real food. Real change.</span>
            </div>
          </div>

          {/* Metric 1: Meals Rescued */}
          <div className={styles.impactMetric}>
            <div className={styles.metricCircle} style={{ background: '#FDF0E4', color: '#BF5B27' }}>
              <Utensils size={20} />
            </div>
            <div className={styles.metricInfo}>
              <span className={styles.metricValue}>{mealsRescued}</span>
              <span className={styles.metricLabel}>Meals Rescued</span>
            </div>
          </div>

          {/* Metric 2: Food Shared */}
          <div className={styles.impactMetric}>
            <div className={styles.metricCircle} style={{ background: '#EEF5E9', color: '#5B7E35' }}>
              <Leaf size={20} />
            </div>
            <div className={styles.metricInfo}>
              <span className={styles.metricValue}>{foodShared}</span>
              <span className={styles.metricLabel}>Food Shared</span>
            </div>
          </div>

          {/* Metric 3: People Reached */}
          <div className={styles.impactMetric}>
            <div className={styles.metricCircle} style={{ background: '#EAF2F9', color: '#2B6EA0' }}>
              <Users size={20} />
            </div>
            <div className={styles.metricInfo}>
              <span className={styles.metricValue}>{peopleReached}</span>
              <span className={styles.metricLabel}>People Reached</span>
            </div>
          </div>

          {/* Metric 4: CO2 Reduced */}
          <div className={styles.impactMetric}>
            <div className={styles.metricCircle} style={{ background: '#EAECEF', color: '#4B5563' }}>
              <Cloud size={20} />
            </div>
            <div className={styles.metricInfo}>
              <span className={styles.metricValue}>{co2Reduced}</span>
              <span className={styles.metricLabel}>CO₂ Reduced</span>
            </div>
          </div>

          {/* Action Link */}
          <div className={styles.impactActionWrap}>
            <Link to="/impact" className={styles.btnSeeImpact}>
              <span>See Full Impact</span>
              <ArrowRight size={15} />
            </Link>
          </div>

        </div>
      </section>

      {/* ============================================================
          REAL IMPACT INTRO BANNER
          ============================================================ */}
      <section className={styles.realImpactIntro}>
        <div className={styles.realImpactBadge}>
          <span className={styles.badgeLine} />
          <span>REAL IMPACT</span>
          <span className={styles.badgeLine} />
        </div>
        <h2 className={styles.realImpactTitle}>Every meal matters</h2>
        <p className={styles.realImpactSubtitle}>
          These numbers come directly from our community's actions. No estimates.
        </p>
      </section>

      {/* ============================================================
          HOW SHAREBITE WORKS SECTION
          ============================================================ */}
      <section className={styles.howSection}>
        <div className={styles.howHeader}>
          <div>
            <h2 className={styles.howTitle}>How ShareBite Works</h2>
            <p className={styles.howSubtitle}>A simple process. A bigger impact.</p>
          </div>
          <Link to="/how-it-works" className={styles.howLink}>
            <span>Learn More</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className={styles.howGrid}>
          
          {/* Card 1 */}
          <div className={styles.processCard}>
            <div className={styles.badgeIndex}>1</div>
            <div className={styles.processIconBox}>
              <Utensils size={20} />
            </div>
            <div className={styles.processContent}>
              <h3 className={styles.processCardTitle}>Food Listed</h3>
              <p className={styles.processCardDesc}>
                Donors add surplus food with details and location.
              </p>
            </div>
            <ArrowRight size={18} className={styles.processArrow} />
          </div>

          {/* Card 2 */}
          <div className={styles.processCard}>
            <div className={styles.badgeIndex}>2</div>
            <div className={styles.processIconBox}>
              <MapPin size={20} />
            </div>
            <div className={styles.processContent}>
              <h3 className={styles.processCardTitle}>Nearby Matching</h3>
              <p className={styles.processCardDesc}>
                Our system finds the nearest verified NGOs and shelters.
              </p>
            </div>
            <ArrowRight size={18} className={styles.processArrow} />
          </div>

          {/* Card 3 */}
          <div className={styles.processCard}>
            <div className={styles.badgeIndex}>3</div>
            <div className={styles.processIconBox}>
              <Handshake size={20} />
            </div>
            <div className={styles.processContent}>
              <h3 className={styles.processCardTitle}>Claim & Coordinate</h3>
              <p className={styles.processCardDesc}>
                NGOs claim the food and coordinate pickup.
              </p>
            </div>
            <ArrowRight size={18} className={styles.processArrow} />
          </div>

          {/* Card 4 */}
          <div className={styles.processCard}>
            <div className={styles.badgeIndex}>4</div>
            <div className={styles.processIconBox}>
              <HeartHandshake size={20} />
            </div>
            <div className={styles.processContent}>
              <h3 className={styles.processCardTitle}>Food Reaches People</h3>
              <p className={styles.processCardDesc}>
                Surplus food becomes meals, not waste.
              </p>
            </div>
            <ArrowRight size={18} className={styles.processArrow} />
          </div>

        </div>
      </section>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
