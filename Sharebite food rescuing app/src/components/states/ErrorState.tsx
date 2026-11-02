import { AlertCircle, RefreshCw } from 'lucide-react';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "Couldn't load this right now. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <AlertCircle size={28} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}
