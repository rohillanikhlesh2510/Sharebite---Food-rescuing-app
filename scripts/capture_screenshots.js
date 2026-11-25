import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'docs', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const DEMO_USERS = {
  donor: {
    id: '00000000-0000-4000-a000-000000000001',
    name: 'Anubhav',
    email: 'anubhav@sharebite.org',
    phone: '+91 98101 23456',
    role: 'donor',
    organizationName: 'Community Kitchen',
    avatar: '',
    bio: 'Doing good today! 🌱 Committed to zero food waste and daily food drives.',
    location: {
      latitude: 28.6315,
      longitude: 77.2167,
      address: 'Connaught Place, Central Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 14,
    totalRescues: 0,
  },
  rider: {
    id: '00000000-0000-4000-a000-000000000004',
    name: 'Kabir Sharma',
    email: 'rider@sharebite.org',
    phone: '+91 98505 67890',
    role: 'rider',
    organizationName: 'ShareBite Logistics Fleet',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    bio: 'Dedicated delivery rider transporting fresh surplus meals across Delhi NCR.',
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      address: 'Central Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 0,
    totalRescues: 48,
  },
  ngo: {
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Robin Hood Army Delhi',
    email: 'ngo@sharebite.org',
    phone: '+91 98202 34567',
    role: 'ngo',
    organizationName: 'Robin Hood Army (Delhi Chapter)',
    registrationNumber: 'NGO-DEL-8921',
    avatar: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150',
    bio: 'Volunteer organization distributing food to homeless shelters, orphanages and slum clusters.',
    location: {
      latitude: 28.5244,
      longitude: 77.2066,
      address: 'Saket, South Delhi',
      city: 'Delhi',
      pincode: '110017',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 0,
    totalRescues: 54,
  },
  admin: {
    id: '00000000-0000-4000-a000-000000000005',
    name: 'ShareBite Operations Admin',
    email: 'admin@sharebite.org',
    phone: '+91 98404 56789',
    role: 'admin',
    organizationName: 'ShareBite Operations Central',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    bio: 'Platform administration, verification verification, and safety operations.',
    location: {
      latitude: 28.6315,
      longitude: 77.2167,
      address: 'Barakhamba Road, New Delhi',
      city: 'Delhi',
      pincode: '110001',
    },
    isVerified: true,
    verificationStatus: 'verified',
    totalDonations: 0,
    totalRescues: 120,
  }
};

const pagesToCapture = [
  {
    name: '01-landing-hero.png',
    path: '/',
    user: null,
    title: 'Landing Page Hero & Food Rescue Mission',
  },
  {
    name: '02-role-selection.png',
    path: '/register',
    user: null,
    title: 'Multi-Role Onboarding Portal',
  },
  {
    name: '03-donor-register.png',
    path: '/register/donor',
    user: null,
    title: 'High-Fidelity Food Donor Registration',
  },
  {
    name: '04-rider-register.png',
    path: '/register/rider',
    user: null,
    title: 'Volunteer & Rider Registration',
  },
  {
    name: '05-ngo-register.png',
    path: '/register/ngo',
    user: null,
    title: 'NGO & Shelter Registration Portal',
  },
  {
    name: '06-donor-dashboard.png',
    path: '/donor-dashboard',
    user: DEMO_USERS.donor,
    title: 'Food Donor Dashboard & Surplus Management',
  },
  {
    name: '07-create-donation.png',
    path: '/donations/new',
    user: DEMO_USERS.donor,
    title: 'Surplus Food Donation Creation Form',
  },
  {
    name: '08-ngo-claims.png',
    path: '/ngo-dashboard',
    user: DEMO_USERS.ngo,
    title: 'NGO Claims & Surplus Rescue Feed',
  },
  {
    name: '09-rider-dashboard.png',
    path: '/rider-dashboard',
    user: DEMO_USERS.rider,
    title: 'Delivery Rider Logistics & Dispatch',
  },
  {
    name: '10-interactive-map.png',
    path: '/map',
    user: DEMO_USERS.donor,
    title: 'GIS Real-Time Food Rescue Map',
  },
  {
    name: '11-ngo-discovery.png',
    path: '/ngos',
    user: DEMO_USERS.donor,
    title: 'Verified NGO Directory & Discovery',
  },
  {
    name: '12-impact-dashboard.png',
    path: '/impact-dashboard',
    user: DEMO_USERS.donor,
    title: 'Platform Impact Analytics & Metrics',
  },
  {
    name: '13-chat-coordination.png',
    path: '/chat',
    user: DEMO_USERS.donor,
    title: 'Real-Time In-App Chat & Coordination',
  },
];

async function main() {
  console.log('Starting Vite preview server on port 4173...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: rootDir,
    shell: true,
    stdio: 'ignore',
  });

  // Wait 3s for server to start
  await new Promise((r) => setTimeout(r, 3000));

  console.log('Launching Chrome browser via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1.5,
    },
  });

  try {
    const page = await browser.newPage();

    for (const item of pagesToCapture) {
      console.log(`Capturing: ${item.title} -> ${item.name}`);
      const url = `http://localhost:4173${item.path}`;

      // Open initial page
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });

      // Set user session
      await page.evaluate((u) => {
        if (u) {
          localStorage.setItem('sharebite_mock_session_user', JSON.stringify(u));
        } else {
          localStorage.removeItem('sharebite_mock_session_user');
        }
      }, item.user);

      // Navigate to target path
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));

      const filePath = path.join(outDir, item.name);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Saved ${item.name} (${fs.statSync(filePath).size} bytes)`);
    }
  } catch (err) {
    console.error('Error taking screenshots:', err);
  } finally {
    await browser.close();
    server.kill();
    console.log('Screenshots capture complete!');
    process.exit(0);
  }
}

main();
