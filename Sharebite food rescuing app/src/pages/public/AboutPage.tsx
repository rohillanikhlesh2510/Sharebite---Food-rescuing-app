import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import styles from './SimplePublicPage.module.css';

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.title}>About ShareBite</h1>
          <p className={styles.lead}>ShareBite is a real-world food rescue platform built to connect surplus food with communities in need across India.</p>
          <div className={styles.content}>
            <h2>Our Mission</h2>
            <p>India faces a stark paradox: significant quantities of edible food go to waste daily while millions struggle with food insecurity. ShareBite is the technology layer that bridges this gap — connecting restaurants, hotels, hostels, caterers, and households who have surplus food with NGOs, shelters, and community organizations who need it.</p>
            <h2>How We Work</h2>
            <p>We operate as a neutral platform — we do not own or handle food ourselves. We provide the technology infrastructure for donors to list food quickly, for NGOs to discover it in real time, and for both sides to coordinate pickup efficiently and safely.</p>
            <h2>Our Values</h2>
            <ul>
              <li><strong>Transparency:</strong> Every meal rescued is tracked and visible.</li>
              <li><strong>Trust:</strong> We verify organizations before they can claim food.</li>
              <li><strong>Speed:</strong> Food rescue must happen quickly. Our platform is designed for speed.</li>
              <li><strong>Safety:</strong> We encourage safe food handling and honest food condition reporting.</li>
              <li><strong>Community:</strong> We build networks, not just transactions.</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
