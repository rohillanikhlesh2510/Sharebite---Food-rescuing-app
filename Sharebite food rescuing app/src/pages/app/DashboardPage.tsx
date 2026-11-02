import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Utensils, Users, Leaf, ArrowRight, Plus, MapPin,
  Clock, Bell, Search, BarChart2, Zap,
  Truck, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DonationService } from '../../services/donations';
import { ImpactService } from '../../services/impact';
import { NotificationsService } from '../../services/notifications';
import { FoodCard } from '../../components/food/FoodCard';
import { PageLoader } from '../../components/states/LoadingState';
import type { FoodListing, ImpactStats, AppNotification } from '../../types';
import heroFoodImg from '../../assets/dashboard_hero_food.jpg';
import emptyFoodBoxImg from '../../assets/empty_food_box.jpg';
import styles from './DashboardPage.module.css';

interface MetricCardProps {
  value: string | number;
  label: string;
  subtext: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  cornerGradient: string;
}

function MetricCard({
  value,
  label,
  subtext,
  icon,
  iconBg,
  iconColor,
  cornerGradient,
}: MetricCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.cornerBlob} style={{ background: cornerGradient }} />
      <div className={styles.statCardIcon} style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className={styles.statCardBody}>
        <div className={styles.statCardValue}>{value}</div>
        <div className={styles.statCardLabel}>{label}</div>
        <div className={styles.statCardSub}>{subtext}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const userRole = user?.role;
  const isDonor = userRole === 'donor' || userRole === 'partner';
  const isNGO = userRole === 'ngo' || userRole === 'receiver';
  const isRider = userRole === 'rider' || userRole === 'volunteer';

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const fetchAll = async () => {
      try {
        const [listingsData, impactData, notifsData] = await Promise.all([
          isDonor ? DonationService.getMyListings(userId) : DonationService.getActiveListings(),
          ImpactService.getUserImpact(userId, userRole || 'donor'),
          NotificationsService.getNotifications(userId),
        ]);
        if (!cancelled) {
          setListings(listingsData.slice(0, 6));
          setImpact(impactData);
          setNotifs(notifsData.slice(0, 5));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId, isDonor, userRole]);

  if (!user) return <PageLoader />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name ? user.name.split(' ')[0] : 'ShareBite Member';
  const isPendingVerification = user.verificationStatus === 'pending' || !user.isVerified;

  return (
    <div className={styles.dashboardPage}>
      {/* Verification Notice Banner */}
      {isPendingVerification && (isNGO || isRider) && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 14,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#92400E',
          fontSize: '0.9rem',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)'
        }}>
          <Clock size={20} color="#D97706" style={{ flexShrink: 0 }} />
          <div>
            <strong>Account Verification Pending: </strong>
            {isNGO && 'Your organisation registration is being verified by ShareBite safety operations. You can browse all active food donations; claiming will unlock once approved.'}
            {isRider && 'Your rider delivery partner account is currently being verified. You can preview available food rescue locations, and pickup assignments will unlock upon approval.'}
          </div>
        </div>
      )}

      {/* 1. Hero Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>
            {isDonor ? 'FOOD DONOR DASHBOARD' : isNGO ? 'COMMUNITY ACCEPTOR DASHBOARD' : isRider ? 'DELIVERY RIDER DASHBOARD' : 'MAKE A DIFFERENCE TODAY'}
          </span>
          <h1 className={styles.heroGreeting}>
            {greeting}, {firstName}!
          </h1>
          <p className={styles.heroSubtitle}>
            {isDonor && 'Share your surplus food with communities nearby.'}
            {isNGO && 'Connect with verified donors and rescue surplus food for your community.'}
            {isRider && 'Deliver hope, one pickup at a time. Transport food safely to people in need.'}
          </p>
          <div className={styles.heroQuote}>
            <span className={styles.quoteDash}>•—</span>
            <span className={styles.quoteText}>
              &ldquo;No food should go to waste, while someone goes hungry.&rdquo;
            </span>
          </div>
          <div className={styles.heroActions}>
            {isDonor && (
              <>
                <Link to="/donations/new" className={styles.heroDonateBtn}>
                  <Plus size={18} strokeWidth={2.5} /> Donate Food
                </Link>
                <Link to="/donor-donations" className={styles.heroDiscoverBtn}>
                  <Utensils size={18} strokeWidth={2} /> Track My Donations
                </Link>
              </>
            )}
            {isNGO && (
              <>
                <Link to="/discover" className={styles.heroDonateBtn}>
                  <Search size={18} strokeWidth={2.5} /> Claim Surplus Food
                </Link>
                <Link to="/my-claims" className={styles.heroDiscoverBtn}>
                  <ClipboardList size={18} strokeWidth={2} /> Claims & Distribution
                </Link>
              </>
            )}
            {isRider && (
              <>
                <Link to="/rider-dashboard" className={styles.heroDonateBtn}>
                  <Truck size={18} strokeWidth={2.5} /> Rider Jobs Dashboard
                </Link>
                <Link to="/map" className={styles.heroDiscoverBtn}>
                  <MapPin size={18} strokeWidth={2} /> Live Food Map
                </Link>
              </>
            )}
          </div>
        </div>

        <div className={styles.heroVisual}>
          <img src={heroFoodImg} alt="Food connects people" className={styles.heroImg} loading="lazy" decoding="async" />
          <div className={styles.heroImgFade} />
          <div className={styles.heroScriptOverlay}>
            <span>Food Connects People</span> <span className={styles.scriptHeart}>♡</span>
          </div>
        </div>
      </div>

      {/* 2. Impact Metric Stats */}
      {loading ? (
        <PageLoader />
      ) : (
        <>
          <div className={styles.statsGrid}>
            <MetricCard
              value={impact?.mealsSaved ?? 0}
              label="Meals Rescued"
              subtext="Good food. Real impact."
              icon={<Utensils size={20} strokeWidth={2.2} />}
              iconBg="#FFEDD5"
              iconColor="#EA580C"
              cornerGradient="radial-gradient(circle at 100% 100%, rgba(254, 215, 170, 0.55) 0%, transparent 70%)"
            />
            <MetricCard
              value={`${impact?.foodRedistributedKg ?? 0} kg`}
              label="Food Redistributed"
              subtext="Less waste. More smiles."
              icon={<Leaf size={20} strokeWidth={2.2} />}
              iconBg="#DCFCE7"
              iconColor="#16A34A"
              cornerGradient="radial-gradient(circle at 100% 100%, rgba(187, 247, 208, 0.55) 0%, transparent 70%)"
            />
            <MetricCard
              value={impact?.peopleReached ?? 0}
              label="People Reached"
              subtext="Stronger communities."
              icon={<Users size={20} strokeWidth={2.2} />}
              iconBg="#FEF3C7"
              iconColor="#D97706"
              cornerGradient="radial-gradient(circle at 100% 100%, rgba(254, 240, 138, 0.55) 0%, transparent 70%)"
            />
            <MetricCard
              value={`${impact?.co2SavedKg ?? 0} kg`}
              label="CO₂ Saved"
              subtext="A cleaner, greener planet."
              icon={
                <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 13, letterSpacing: -0.5 }}>
                  CO<span style={{ fontSize: 9, marginTop: 4 }}>2</span>
                </div>
              }
              iconBg="#E6F4EA"
              iconColor="#0D9488"
              cornerGradient="radial-gradient(circle at 100% 100%, rgba(167, 243, 208, 0.55) 0%, transparent 70%)"
            />
          </div>

          {/* 3. Main Split Grid */}
          <div className={styles.mainGrid}>
            {/* Left Column: My Food Listings */}
            <div className={styles.listingsCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleWrap}>
                  <Utensils size={20} color="#EA580C" />
                  <h2 className={styles.cardHeading}>
                    {isDonor ? 'My Food Listings' : isRider ? 'Rescue Pickups Near You' : 'Available Food Near You'}
                  </h2>
                </div>
                <Link to={isDonor ? '/donations' : '/discover'} className={styles.seeAllLink}>
                  See all <ArrowRight size={14} />
                </Link>
              </div>

              {listings.length === 0 ? (
                <div className={styles.emptyBoxContainer}>
                  <div className={styles.emptyIllustrationWrap}>
                    <img
                      src={emptyFoodBoxImg}
                      alt="No listings yet"
                      className={styles.emptyFoodBoxImg}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3 className={styles.emptyBoxTitle}>
                    {isDonor ? 'No listings yet' : 'Nothing available nearby'}
                  </h3>
                  <p className={styles.emptyBoxSub}>
                    {isDonor
                      ? 'Share your first food donation. It takes under 2 minutes.'
                      : 'Check back soon — donors are active in your area.'}
                  </p>
                  {isDonor && (
                    <Link to="/donations/new" className={styles.boxDonateBtn}>
                      <Plus size={16} strokeWidth={2.5} /> Donate Food
                    </Link>
                  )}
                </div>
              ) : (
                <div className={styles.listingsGrid}>
                  {listings.map(l => (
                    <FoodCard
                      key={l.id}
                      listing={l}
                      onClick={() => navigate(`/donations/${l.id}`)}
                      onClaim={
                        isNGO
                          ? async () => {
                              if (isPendingVerification) {
                                alert('Organisation verification is pending approval. You will be able to claim food once verified.');
                                return;
                              }
                              try {
                                await DonationService.reserveFood(l.id, 1);
                                alert('Food reserved successfully!');
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}

              {/* Bottom 3 Feature Pillars */}
              <div className={styles.listingFeaturesStrip}>
                <div className={styles.featurePillar}>
                  <div className={styles.pillarIconOrange}>
                    <Clock size={16} />
                  </div>
                  <div className={styles.pillarMeta}>
                    <p className={styles.pillarTitle}>Quick & Easy</p>
                    <p className={styles.pillarSub}>List in 2 minutes</p>
                  </div>
                </div>

                <div className={styles.featurePillar}>
                  <div className={styles.pillarIconPeach}>
                    <Users size={16} />
                  </div>
                  <div className={styles.pillarMeta}>
                    <p className={styles.pillarTitle}>Help Communities</p>
                    <p className={styles.pillarSub}>Support those in need</p>
                  </div>
                </div>

                <div className={styles.featurePillar}>
                  <div className={styles.pillarIconGreen}>
                    <Leaf size={16} />
                  </div>
                  <div className={styles.pillarMeta}>
                    <p className={styles.pillarTitle}>Reduce Food Waste</p>
                    <p className={styles.pillarSub}>Create a greener future</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activity & Quick Actions */}
            <div className={styles.rightCol}>
              {/* Recent Activity Card */}
              <div className={styles.activityCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleWrap}>
                    <Zap size={18} color="#EA580C" />
                    <h3 className={styles.cardHeading}>Recent Activity</h3>
                  </div>
                  <Link to="/notifications" className={styles.seeAllOrange}>
                    <Bell size={13} /> View All
                  </Link>
                </div>

                <div className={styles.emptyActivityWrap}>
                  <div className={styles.emptyBellCircle}>
                    <Bell size={20} color="#9CA3AF" />
                  </div>
                  <p className={styles.emptyActivityTitle}>No recent activity</p>
                  <p className={styles.emptyActivitySub}>
                    Your donation activity, updates and notifications will appear here.
                  </p>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className={styles.quickActionsCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleWrap}>
                    <Zap size={18} color="#EA580C" />
                    <h3 className={styles.cardHeading}>Quick Actions</h3>
                  </div>
                </div>

                <div className={styles.quickActionsGrid}>
                  <Link to="/donations/new" className={styles.actionBtnPeach}>
                    <Plus size={16} strokeWidth={2.5} />
                    <span>New Donation</span>
                  </Link>
                  <Link to="/discover" className={styles.actionBtnMint}>
                    <Search size={16} strokeWidth={2} />
                    <span>Discover Food</span>
                  </Link>
                  <Link to="/map" className={styles.actionBtnBlue}>
                    <MapPin size={16} strokeWidth={2} />
                    <span>Live Map</span>
                  </Link>
                  <Link to="/impact-dashboard" className={styles.actionBtnPurple}>
                    <BarChart2 size={16} strokeWidth={2} />
                    <span>View Impact</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Bottom Full-Width Banner */}
          <div className={styles.bottomBanner}>
            <div className={styles.bottomBannerLeft}>
              <div className={styles.bottomLeafCircle}>
                <Leaf size={18} color="#16A34A" />
              </div>
              <div className={styles.bottomBannerInfo}>
                <p className={styles.bottomBannerTitle}>Small actions make a big difference.</p>
                <p className={styles.bottomBannerSub}>
                  Join thousands of donors in building a hunger-free tomorrow.
                </p>
              </div>
            </div>

            <div className={styles.bottomBannerRight}>
              <Link to="/donations/new" className={styles.bottomDonateBtn}>
                Donate Now <ArrowRight size={14} />
              </Link>
              <div className={styles.bottomScriptNote}>
                <span>Share. Care. Change.</span> <span className={styles.scriptHeart}>♡</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
