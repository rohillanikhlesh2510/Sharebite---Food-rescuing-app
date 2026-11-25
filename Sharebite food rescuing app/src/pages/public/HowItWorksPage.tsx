import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import styles from './SimplePublicPage.module.css';

export default function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.title}>How ShareBite Works</h1>
          <p className={styles.lead}>A simple, fast process that connects surplus food with people who need it.</p>
          <div className={styles.content}>
            <h2>For Donors (Restaurants, Homes, Events)</h2>
            <ol>
              <li><strong>Sign up</strong> as a Donor. It takes under a minute.</li>
              <li><strong>Create a food listing</strong> — add title, photo, quantity, and pickup window.</li>
              <li><strong>Wait for a claim</strong> — nearby NGOs will see your listing and reserve it.</li>
              <li><strong>Coordinate pickup</strong> — confirm the time and the NGO picks up the food.</li>
              <li><strong>Track your impact</strong> — see how many meals you have rescued over time.</li>
            </ol>
            <h2>For NGOs & Shelters</h2>
            <ol>
              <li><strong>Sign up</strong> as an NGO and complete verification.</li>
              <li><strong>Discover food</strong> — browse nearby available donations on the map or feed.</li>
              <li><strong>Reserve food</strong> — claim the serving size you need.</li>
              <li><strong>Pickup</strong> — coordinate with the donor and complete the rescue.</li>
              <li><strong>Report impact</strong> — mark the pickup complete to log community impact.</li>
            </ol>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
