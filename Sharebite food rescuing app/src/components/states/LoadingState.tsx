import styles from './LoadingState.module.css';

interface SkeletonCardProps { count?: number; }

export function SkeletonCard({ count = 3 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${styles.img} skeleton`} />
          <div className={styles.body}>
            <div className={`${styles.line} ${styles.lineLong} skeleton`} />
            <div className={`${styles.line} ${styles.lineMed} skeleton`} />
            <div className={`${styles.line} ${styles.lineShort} skeleton`} />
          </div>
        </div>
      ))}
    </>
  );
}

export function PageLoader() {
  return (
    <div className={styles.pageLoader}>
      <div className={styles.spinner} />
    </div>
  );
}

export function InlineLoader() {
  return <div className={styles.spinner} />;
}
