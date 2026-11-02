import { useEffect, useState } from 'react';
import { TrendingUp, Leaf, Users, Utensils, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ImpactService } from '../../services/impact';
import { PageLoader } from '../../components/states/LoadingState';
import type { ImpactStats } from '../../types';
import styles from './ImpactDashboardPage.module.css';

interface ImpactCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  desc: string;
  color: string;
}

function ImpactCard({ icon, value, label, desc, color }: ImpactCardProps) {
  return (
    <div className={styles.card} style={{ borderTop: `3px solid ${color}` }}>
      <div className={styles.cardIcon} style={{ background: `${color}20`, color }}>{icon}</div>
      <div className={styles.cardValue}>{value}</div>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardDesc}>{desc}</div>
    </div>
  );
}

export default function ImpactDashboardPage() {
  const { user } = useAuth();
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    ImpactService.getUserImpact(user.id, user.role)
      .then(setImpact)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageLoader />;

  const meals = impact?.mealsSaved ?? 0;
  const level = meals === 0 ? 'Newcomer' : meals < 10 ? 'Helper' : meals < 50 ? 'Rescuer' : meals < 200 ? 'Champion' : 'Hero';
  const levelColor = meals === 0 ? '#c4b49e' : meals < 10 ? '#6b8e3e' : meals < 50 ? '#c17b3f' : meals < 200 ? '#d4a853' : '#dc2626';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Impact</h1>
        <p className={styles.subtitle}>Real data from your ShareBite activity</p>
      </div>

      {/* Level badge */}
      <div className={styles.levelCard}>
        <div className={styles.levelBadge} style={{ background: levelColor }}>
          <span className={styles.levelEmoji}>🏅</span>
          <span>{level}</span>
        </div>
        <div className={styles.levelInfo}>
          <p className={styles.levelTitle}>{user?.name} — {level}</p>
          <p className={styles.levelDesc}>
            {meals === 0
              ? 'Share your first food to start building your impact!'
              : `You have rescued ${meals} meal${meals !== 1 ? 's' : ''}. Keep going!`}
          </p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{
              width: `${Math.min(100, (meals / (meals < 10 ? 10 : meals < 50 ? 50 : meals < 200 ? 200 : 500)) * 100)}%`,
              background: levelColor,
            }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.grid}>
        <ImpactCard icon={<Utensils size={22} />} value={String(impact?.mealsSaved ?? 0)} label="Meals Rescued" desc="Meals saved from going to waste" color="var(--color-primary)" />
        <ImpactCard icon={<Leaf size={22} />} value={`${impact?.foodRedistributedKg ?? 0} kg`} label="Food Redistributed" desc="Total weight of food rescued" color="var(--color-secondary)" />
        <ImpactCard icon={<Zap size={22} />} value={`${impact?.co2SavedKg ?? 0} kg`} label="CO₂ Saved" desc="Carbon emissions prevented" color="#2563eb" />
        <ImpactCard icon={<Users size={22} />} value={String(impact?.peopleReached ?? 0)} label="People Reached" desc="Estimated beneficiaries" color="var(--color-accent)" />
        <ImpactCard icon={<TrendingUp size={22} />} value={String(impact?.donationsCount ?? 0)} label="Donations Made" desc="Food listings you created" color="#16a34a" />
        <ImpactCard icon={<TrendingUp size={22} />} value={String(impact?.claimsCount ?? 0)} label="Rescues Completed" desc="Reservations you fulfilled" color="#7c3aed" />
      </div>

      {/* UN SDG note */}
      <div className={styles.sdgNote}>
        <span className={styles.sdgIcon}>🌱</span>
        <div>
          <p className={styles.sdgTitle}>Contributing to UN SDG #2 — Zero Hunger</p>
          <p className={styles.sdgDesc}>Every meal you rescue helps fight food insecurity in our communities. Thank you for being part of ShareBite.</p>
        </div>
      </div>
    </div>
  );
}
