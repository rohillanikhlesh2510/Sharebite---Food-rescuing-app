import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>SB</div>
          <div>
            <p className={styles.brandName}>ShareBite</p>
            <p className={styles.brandTagline}>Share Food. Share Hope.</p>
          </div>
        </div>

        <div className={styles.links}>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupTitle}>Platform</p>
            <Link to="/how-it-works" className={styles.link}>How It Works</Link>
            <Link to="/discover" className={styles.link}>Find Food</Link>
            <Link to="/donations/new" className={styles.link}>Donate Food</Link>
            <Link to="/map" className={styles.link}>Live Map</Link>
          </div>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupTitle}>Company</p>
            <Link to="/about" className={styles.link}>About</Link>
            <Link to="/impact" className={styles.link}>Impact</Link>
            <Link to="/partners" className={styles.link}>Partners</Link>
          </div>
          <div className={styles.linkGroup}>
            <p className={styles.linkGroupTitle}>Account</p>
            <Link to="/login" className={styles.link}>Log In</Link>
            <Link to="/register" className={styles.link}>Join ShareBite</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p className={styles.copyright}>© {new Date().getFullYear()} ShareBite. Good food should never go to waste.</p>
      </div>
    </footer>
  );
}
