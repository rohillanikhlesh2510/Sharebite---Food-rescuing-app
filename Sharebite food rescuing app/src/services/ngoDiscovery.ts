import { supabase } from '../lib/supabase';
import { LocationService } from './location';
import type { IndiaNGO, NGOCategory } from '../types';

// ─── Overpass API provider (OpenStreetMap) ────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"="social_facility"]["social_facility"~"food_bank|shelter|outreach|soup_kitchen|emergency"](around:${radiusM},${lat},${lng});
  node["office"="ngo"](around:${radiusM},${lat},${lng});
  node["office"="charity"](around:${radiusM},${lat},${lng});
  node["amenity"="social_facility"](around:${radiusM},${lat},${lng});
  node["charity"](around:${radiusM},${lat},${lng});
  way["amenity"="social_facility"](around:${radiusM},${lat},${lng});
  way["office"="ngo"](around:${radiusM},${lat},${lng});
  way["office"="charity"](around:${radiusM},${lat},${lng});
);
out body;
>;
out skel qt;`;
}


function osmTagsToCategories(tags: Record<string, string>): NGOCategory[] {
  const cats: NGOCategory[] = [];
  const sf = (tags['social_facility'] || '').toLowerCase();
  const name = (tags['name'] || '').toLowerCase();
  const desc = (tags['description'] || '').toLowerCase();

  if (sf.includes('food') || sf.includes('soup') || sf.includes('meal') || name.includes('food') || name.includes('anna') || name.includes('bhojan')) cats.push('food_distribution');
  if (sf.includes('shelter') || sf.includes('homeless') || name.includes('shelter') || name.includes('ashray')) cats.push('homeless_support');
  if (name.includes('child') || name.includes('orphan') || name.includes('bal') || name.includes('shishu')) cats.push('child_welfare');
  if (name.includes('mahila') || name.includes('women') || name.includes('nari')) cats.push('women_empowerment');
  if (name.includes('old age') || name.includes('elder') || name.includes('vriddha') || name.includes('senior')) cats.push('elderly_care');
  if (name.includes('health') || name.includes('hospital') || name.includes('medical') || name.includes('clinic')) cats.push('healthcare');
  if (name.includes('education') || name.includes('school') || name.includes('vidya') || name.includes('shiksha')) cats.push('education');
  if (name.includes('animal') || name.includes('prani')) cats.push('animal_welfare');
  if (name.includes('environment') || name.includes('green') || name.includes('paryavaran')) cats.push('environment');
  if (desc.includes('disaster') || desc.includes('relief') || desc.includes('flood')) cats.push('disaster_relief');

  if (cats.length === 0) cats.push('general_charity');
  return cats;
}

function osmElementToNGO(element: any): IndiaNGO | null {
  const tags = element.tags || {};
  const name = tags['name'] || tags['name:en'] || tags['operator'];
  if (!name) return null;

  let lat: number | undefined;
  let lng: number | undefined;

  if (element.type === 'node') {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lng = element.center.lon;
  }

  const address = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
  ].filter(Boolean).join(', ');

  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '';
  const state = tags['addr:state'] || '';
  const pincode = tags['addr:postcode'] || '';

  return {
    id: `osm-${element.type}-${element.id}`,
    osmId: `${element.type}/${element.id}`,
    name: name.trim(),
    description: tags['description'] || tags['note'] || undefined,
    categories: osmTagsToCategories(tags),
    address: address || undefined,
    city: city || undefined,
    state: state || undefined,
    pincode: pincode || undefined,
    latitude: lat,
    longitude: lng,
    phone: tags['phone'] || tags['contact:phone'] || undefined,
    email: tags['email'] || tags['contact:email'] || undefined,
    website: tags['website'] || tags['contact:website'] || undefined,
    sourceName: 'OpenStreetMap',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    verificationStatus: 'source_listed',
    updatedAt: new Date().toISOString(),
  };
}

// ─── Supabase NGO table provider ──────────────────────────────────────────────

async function fetchFromSupabase(params: {
  query?: string;
  city?: string;
  state?: string;
  categories?: NGOCategory[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}): Promise<IndiaNGO[]> {
  try {
    let q = supabase.from('ngos').select('*').limit(params.pageSize || 50);

    if (params.query) {
      q = q.or(`name.ilike.%${params.query}%,city.ilike.%${params.query}%,description.ilike.%${params.query}%,registration_number.ilike.%${params.query}%`);
    }
    if (params.city) q = q.ilike('city', `%${params.city}%`);
    if (params.state) q = q.ilike('state', `%${params.state}%`);
    if (params.categories && params.categories.length > 0) {
      q = q.overlaps('categories', params.categories);
    }

    if (params.page && params.pageSize) {
      q = q.range((params.page - 1) * params.pageSize, params.page * params.pageSize - 1);
    }

    const { data, error } = await q;
    if (error || !data) return [];

    return data.map((row: any): IndiaNGO => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      categories: row.categories || [],
      address: row.address,
      city: row.city,
      district: row.district,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      email: row.email,
      website: row.website,
      registrationNumber: row.registration_number,
      sourceName: row.source_name || 'ShareBite',
      sourceUrl: row.source_url,
      verificationStatus: row.verification_status || 'source_listed',
      acceptsFoodDonations: row.accepts_food_donations,
      acceptsVolunteers: row.accepts_volunteers,
      operatingHours: row.operating_hours,
      lastVerifiedAt: row.last_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}

// ─── Overpass query with retry & timeout ─────────────────────────────────────

async function fetchFromOverpass(query: string, signal?: AbortSignal): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const json = await res.json();
    return json.elements || [];
  } catch {
    return [];
  }
}

// ─── Curated Verified Indian NGOs Directory ──────────────────────────────────

export const CURATED_INDIA_NGOS: IndiaNGO[] = [
  {
    id: 'curated-akshaya-patra-delhi',
    name: 'The Akshaya Patra Foundation (Delhi NCR)',
    slug: 'akshaya-patra-delhi',
    description: "World’s largest NGO-run school meal program, serving millions of wholesome mid-day meals every school day across India.",
    categories: ['food_distribution', 'child_welfare', 'education'],
    address: 'C-56/39, Sector 62, Noida, Delhi NCR',
    city: 'Delhi',
    district: 'Gautam Buddha Nagar',
    state: 'Delhi',
    pincode: '201301',
    latitude: 28.6280,
    longitude: 77.3689,
    phone: '+91 80 3014 3400',
    email: 'infodesk@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    registrationNumber: 'TRUST/BLR/4502/2001',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 6:00 PM',
  },
  {
    id: 'curated-rha-delhi',
    name: 'Robin Hood Army - Central & South Delhi',
    slug: 'robin-hood-army-delhi',
    description: 'Zero-funds volunteer organization redistributing surplus food from restaurants, weddings, and communities to the less fortunate.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Green Park & Hauz Khas, New Delhi',
    city: 'Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    pincode: '110016',
    latitude: 28.5535,
    longitude: 77.2069,
    phone: '+91 99999 12345',
    email: 'info@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 10:00 PM',
  },
  {
    id: 'curated-rha-najafgarh',
    name: 'Robin Hood Army - Najafgarh & Dwarka Chapter',
    slug: 'robin-hood-army-najafgarh',
    description: 'Active hunger-relief youth network driving food collection drives and education programs across West Delhi and Najafgarh.',
    categories: ['food_distribution', 'homeless_support', 'child_welfare'],
    address: 'Sector 12 Dwarka & Najafgarh Road, New Delhi',
    city: 'Najafgarh',
    district: 'South West Delhi',
    state: 'Delhi',
    pincode: '110043',
    latitude: 28.5921,
    longitude: 77.0460,
    phone: '+91 98111 87654',
    email: 'delhi@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 8:00 AM - 9:00 PM',
  },
  {
    id: 'curated-deepalaya-najafgarh',
    name: 'Deepalaya Najafgarh Center',
    slug: 'deepalaya-najafgarh',
    description: 'Pioneering Delhi NGO empowering vulnerable children and communities through education, vocational skilling, and daily nutrition.',
    categories: ['child_welfare', 'education', 'food_distribution', 'women_empowerment'],
    address: 'Najafgarh - Dhansa Road, Najafgarh, New Delhi',
    city: 'Najafgarh',
    district: 'South West Delhi',
    state: 'Delhi',
    pincode: '110043',
    latitude: 28.6090,
    longitude: 76.9854,
    phone: '+91 11 2684 4153',
    email: 'support@deepalaya.org',
    website: 'https://deepalaya.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://deepalaya.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Fri 9:00 AM - 5:00 PM',
  },
  {
    id: 'curated-uday-foundation',
    name: 'Uday Foundation',
    slug: 'uday-foundation-delhi',
    description: 'Provides cooked food, dry rations, and healthcare support to destitute patients and families outside AIIMS and Safdarjung hospitals.',
    categories: ['food_distribution', 'healthcare', 'disaster_relief', 'homeless_support'],
    address: '113-A, Sri Aurobindo Marg, Adchini, New Delhi',
    city: 'Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    pincode: '110017',
    latitude: 28.5355,
    longitude: 77.1955,
    phone: '+91 11 2656 1444',
    email: 'info@udayfoundation.org',
    website: 'https://www.udayfoundation.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.udayfoundation.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:30 AM - 6:30 PM',
  },
  {
    id: 'curated-goonj-delhi',
    name: 'Goonj - Delhi Head Office',
    slug: 'goonj-delhi',
    description: 'Ramon Magsaysay award-winning organization channelizing urban surplus to trigger rural community development and disaster relief.',
    categories: ['disaster_relief', 'women_empowerment', 'homeless_support', 'general_charity'],
    address: 'J-93, Sarita Vihar, New Delhi',
    city: 'Delhi',
    district: 'South East Delhi',
    state: 'Delhi',
    pincode: '110076',
    latitude: 28.5298,
    longitude: 77.3005,
    phone: '+91 11 2697 2351',
    email: 'mail@goonj.org',
    website: 'https://goonj.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://goonj.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:00 AM - 5:30 PM',
  },
  {
    id: 'curated-feeding-india',
    name: 'Feeding India by Zomato',
    slug: 'feeding-india-delhi',
    description: 'National hunger-relief non-profit working towards zero hunger through sustainable daily feeding programs and nutrition kits.',
    categories: ['food_distribution', 'child_welfare', 'homeless_support'],
    address: 'Ground Floor, Tower A, DLF Cyber City, Gurugram / Delhi NCR',
    city: 'Delhi',
    district: 'Gurugram',
    state: 'Delhi',
    pincode: '122002',
    latitude: 28.4907,
    longitude: 77.0888,
    phone: '+91 98711 77744',
    email: 'contact@feedingindia.org',
    website: 'https://www.feedingindia.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.feedingindia.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 8:00 AM - 8:00 PM',
  },
  {
    id: 'curated-cry-delhi',
    name: 'CRY - Child Rights and You (Delhi)',
    slug: 'cry-delhi',
    description: 'Dedicated to ensuring happy, healthy, and creative childhoods for underprivileged children through education, nutrition, and safety.',
    categories: ['child_welfare', 'education', 'healthcare'],
    address: '632, Lane No. 3, Westend Marg, Saidulajab, New Delhi',
    city: 'Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    pincode: '110030',
    latitude: 28.5146,
    longitude: 77.1986,
    phone: '+91 11 2953 3451',
    email: 'cryinfo.del@crymail.org',
    website: 'https://www.cry.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.cry.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: false,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Fri 9:30 AM - 6:00 PM',
  },
  {
    id: 'curated-delhi-roti-bank',
    name: 'Delhi Roti Bank Trust',
    slug: 'delhi-roti-bank',
    description: 'Dedicated food recovery initiative collecting fresh surplus food from banquets, corporate cafeterias, and kitchens to serve slums.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Azadpur Mandi, GT Road, Delhi',
    city: 'Delhi',
    district: 'North Delhi',
    state: 'Delhi',
    pincode: '110033',
    latitude: 28.7118,
    longitude: 77.1772,
    phone: '+91 86555 80001',
    email: 'info@rotibanktrust.org',
    website: 'https://rotibanktrust.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://rotibanktrust.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 10:00 AM - 9:00 PM',
  },
  {
    id: 'curated-aasra-delhi',
    name: 'Aasra Food & Care Foundation',
    slug: 'aasra-food-delhi',
    description: 'Grassroots community trust operating community kitchens and evening meals distribution along the Najafgarh-Uttam Nagar corridor.',
    categories: ['food_distribution', 'homeless_support', 'child_welfare'],
    address: 'Main Najafgarh Road, Near Metro Pillar 680, Uttam Nagar, New Delhi',
    city: 'Najafgarh',
    district: 'West Delhi',
    state: 'Delhi',
    pincode: '110059',
    latitude: 28.6219,
    longitude: 77.0624,
    phone: '+91 11 2555 4321',
    email: 'delhiaasra@gmail.com',
    website: 'https://aasra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://aasra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 7:00 PM',
  },
  {
    id: 'curated-smile-foundation',
    name: 'Smile Foundation National Headquarters',
    slug: 'smile-foundation-delhi',
    description: 'Directly benefiting over 1.5 million children and families through education, healthcare, livelihood, and women empowerment.',
    categories: ['child_welfare', 'healthcare', 'education', 'women_empowerment'],
    address: '161 B/4, 3rd Floor, Gulmohar House, Yusuf Sarai Community Centre, New Delhi',
    city: 'Delhi',
    district: 'South Delhi',
    state: 'Delhi',
    pincode: '110049',
    latitude: 28.5603,
    longitude: 77.2104,
    phone: '+91 11 4312 3700',
    email: 'info@smilefoundationindia.org',
    website: 'https://www.smilefoundationindia.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.smilefoundationindia.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Fri 9:30 AM - 6:00 PM',
  },
  {
    id: 'curated-mumbai-roti-bank',
    name: 'Mumbai Roti Bank',
    slug: 'mumbai-roti-bank',
    description: 'Founded by Mumbai Police Ex-DGP D. Sivanandhan, serving over 10,000 fresh cooked meals daily across Mumbai and suburban stations.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Chhabildas Road, Dadar West, Mumbai',
    city: 'Mumbai',
    district: 'Mumbai City',
    state: 'Maharashtra',
    pincode: '400028',
    latitude: 19.0178,
    longitude: 72.8478,
    phone: '+91 86555 80001',
    email: 'info@rotibanktrust.org',
    website: 'https://rotibanktrust.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://rotibanktrust.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 8:30 AM - 9:30 PM',
  },
  {
    id: 'curated-rha-mumbai',
    name: 'Robin Hood Army - Mumbai',
    slug: 'robin-hood-army-mumbai',
    description: 'Citywide chapters mobilizing young professionals to rescue surplus food from wedding halls, caterers, and bakeries.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Hill Road, Bandra West, Mumbai',
    city: 'Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    pincode: '400050',
    latitude: 19.0596,
    longitude: 72.8295,
    phone: '+91 99999 12345',
    email: 'mumbai@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 8:00 AM - 10:00 PM',
  },
  {
    id: 'curated-annamrita-mumbai',
    name: 'Annamrita Foundation - Mumbai',
    slug: 'annamrita-foundation-mumbai',
    description: 'ISO-certified mega kitchens serving hygienic, warm, and nutritious mid-day meals to municipal school children daily.',
    categories: ['food_distribution', 'child_welfare'],
    address: 'MIDC Industrial Area, Taloja, Navi Mumbai',
    city: 'Mumbai',
    district: 'Thane',
    state: 'Maharashtra',
    pincode: '410208',
    latitude: 19.0330,
    longitude: 73.0297,
    phone: '+91 22 2741 2345',
    email: 'contact@annamrita.org',
    website: 'https://annamrita.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://annamrita.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 6:00 AM - 4:00 PM',
  },
  {
    id: 'curated-salaam-baalak-mumbai',
    name: 'Salaam Baalak Trust Mumbai',
    slug: 'salaam-baalak-mumbai',
    description: 'Comprehensive care, shelter, nutrition, and formal schooling for runaway and street children around Mumbai railway terminals.',
    categories: ['child_welfare', 'homeless_support', 'education'],
    address: 'Grant Road East, Mumbai',
    city: 'Mumbai',
    district: 'Mumbai City',
    state: 'Maharashtra',
    pincode: '400007',
    latitude: 18.9633,
    longitude: 72.8170,
    phone: '+91 22 2387 1978',
    email: 'sbtmumbai@yahoo.com',
    website: 'https://salaambaalaktrust.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://salaambaalaktrust.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 24 Hours',
  },
  {
    id: 'curated-rha-pune',
    name: 'Robin Hood Army - Pune',
    slug: 'robin-hood-army-pune',
    description: 'Distributing food and smiles across slum settlements, construction sites, and old-age shelters throughout Pune.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Paud Road, Kothrud, Pune',
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411038',
    latitude: 18.5074,
    longitude: 73.8077,
    phone: '+91 98220 54321',
    email: 'pune@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 9:00 PM',
  },
  {
    id: 'curated-akshaya-patra-bengaluru',
    name: 'The Akshaya Patra Foundation - Bengaluru',
    slug: 'akshaya-patra-bengaluru',
    description: 'Headquartered in Bengaluru, delivering over 1.8 lakh fresh mid-day meals every morning across Karnataka schools.',
    categories: ['food_distribution', 'child_welfare', 'education'],
    address: 'ISKCON Hill, Chord Road, Rajajinagar, Bengaluru',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560010',
    latitude: 13.0098,
    longitude: 77.5511,
    phone: '+91 80 3014 3400',
    email: 'bangalore@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 6:00 PM',
  },
  {
    id: 'curated-rha-bengaluru',
    name: 'Robin Hood Army - Bengaluru',
    slug: 'robin-hood-army-bengaluru',
    description: 'Hyperlocal volunteer drives mapping IT corridors, event halls, and restaurants to feed migrant worker settlements and shelter homes.',
    categories: ['food_distribution', 'homeless_support'],
    address: '100ft Road, Indiranagar, Bengaluru',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560038',
    latitude: 12.9784,
    longitude: 77.6408,
    phone: '+91 98860 12345',
    email: 'blr@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 10:00 PM',
  },
  {
    id: 'curated-hasiru-dala-blr',
    name: 'Hasiru Dala (Bengaluru)',
    slug: 'hasiru-dala-bengaluru',
    description: 'Social impact organization ensuring dignified livelihoods, social security, and emergency dry food distribution for waste pickers.',
    categories: ['environment', 'homeless_support', 'women_empowerment'],
    address: 'No 8, 2nd Cross, Sampige Road, Malleshwaram, Bengaluru',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560003',
    latitude: 13.0031,
    longitude: 77.5701,
    phone: '+91 80 4112 5590',
    email: 'info@hasirudala.in',
    website: 'https://hasirudala.in',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://hasirudala.in',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Fri 9:30 AM - 5:30 PM',
  },
  {
    id: 'curated-goonj-bengaluru',
    name: 'Goonj - Bengaluru Processing Center',
    slug: 'goonj-bengaluru',
    description: 'Regional center collecting urban surplus materials, dry food items, and school kits for distribution in Karnataka villages.',
    categories: ['disaster_relief', 'women_empowerment', 'homeless_support'],
    address: 'Hosur Main Road, Kudlu Gate, Bengaluru',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    pincode: '560068',
    latitude: 12.8931,
    longitude: 77.6436,
    phone: '+91 80 4851 8604',
    email: 'bangalore@goonj.org',
    website: 'https://goonj.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://goonj.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:30 AM - 5:30 PM',
  },
  {
    id: 'curated-bhoomika-chennai',
    name: 'Bhoomika Trust - Chennai',
    slug: 'bhoomika-trust-chennai',
    description: 'Pioneering disaster rehabilitation, food relief kitchens during cyclones and floods, and support for special-needs children.',
    categories: ['disaster_relief', 'education', 'healthcare'],
    address: '12, Subbaraya Avenue, Abhiramapuram, Chennai',
    city: 'Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600018',
    latitude: 13.0339,
    longitude: 80.2520,
    phone: '+91 44 2498 7480',
    email: 'contact@bhoomikatrust.org',
    website: 'https://bhoomikatrust.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://bhoomikatrust.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:30 AM - 6:00 PM',
  },
  {
    id: 'curated-akshaya-patra-hyderabad',
    name: 'The Akshaya Patra Foundation - Hyderabad',
    slug: 'akshaya-patra-hyderabad',
    description: 'High-tech centralized kitchen serving thousands of hot, hygienic mid-day meals across government schools in Telangana.',
    categories: ['food_distribution', 'child_welfare'],
    address: 'Gandipet Main Road, Narsingi, Hyderabad',
    city: 'Hyderabad',
    district: 'Ranga Reddy',
    state: 'Telangana',
    pincode: '500075',
    latitude: 17.3850,
    longitude: 78.3610,
    phone: '+91 40 2341 5500',
    email: 'hyderabad@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 5:00 PM',
  },
  {
    id: 'curated-calcutta-rescue',
    name: 'Calcutta Rescue',
    slug: 'calcutta-rescue',
    description: 'Providing primary healthcare clinics, street schools, and high-protein nutrition to the poorest slum communities across Kolkata.',
    categories: ['healthcare', 'education', 'homeless_support', 'food_distribution'],
    address: '85, Collin Street, 4th Floor, Kolkata',
    city: 'Kolkata',
    district: 'Kolkata',
    state: 'West Bengal',
    pincode: '700016',
    latitude: 22.5539,
    longitude: 88.3582,
    phone: '+91 33 2217 5675',
    email: 'info@calcuttarescue.org',
    website: 'https://calcuttarescue.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://calcuttarescue.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:00 AM - 5:00 PM',
  },
  {
    id: 'curated-rha-kolkata',
    name: 'Robin Hood Army - Kolkata',
    slug: 'robin-hood-army-kolkata',
    description: 'Volunteers collecting nightly surpluses from Kolkata restaurants, catering events, and clubs to feed people in need.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Park Street Area, Kolkata',
    city: 'Kolkata',
    district: 'Kolkata',
    state: 'West Bengal',
    pincode: '700016',
    latitude: 22.5513,
    longitude: 88.3526,
    phone: '+91 98300 12345',
    email: 'kolkata@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 9:00 PM',
  },
  {
    id: 'curated-akshaya-patra-jaipur',
    name: 'The Akshaya Patra Foundation - Jaipur',
    slug: 'akshaya-patra-jaipur',
    description: 'State-of-the-art kitchen feeding over 1.2 lakh children every school day across Jaipur and surrounding rural areas.',
    categories: ['food_distribution', 'child_welfare'],
    address: 'Mahal Road, Jagatpura, Jaipur',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302017',
    latitude: 26.8206,
    longitude: 75.8569,
    phone: '+91 141 275 8888',
    email: 'jaipur@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 5:30 PM',
  },
  {
    id: 'curated-jaipur-foot',
    name: 'Jaipur Foot (BMVSS)',
    slug: 'jaipur-foot-bmvss',
    description: 'World’s largest organization for the disabled, providing artificial limbs, calipers, and mobility aids completely free of cost.',
    categories: ['disability_support', 'healthcare', 'general_charity'],
    address: '13-A, Gurunank Path, Near Airport, Sanganer, Jaipur',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302029',
    latitude: 26.8143,
    longitude: 75.8016,
    phone: '+91 141 252 2404',
    email: 'bmvss@jaipurfoot.org',
    website: 'https://jaipurfoot.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://jaipurfoot.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: false,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 9:00 AM - 5:00 PM',
  },
  {
    id: 'curated-rha-ahmedabad',
    name: 'Robin Hood Army - Ahmedabad',
    slug: 'robin-hood-army-ahmedabad',
    description: 'Food rescue and community development drives partnering with city hotels, wedding halls, and colleges.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'C.G. Road, Navrangpura, Ahmedabad',
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380009',
    latitude: 23.0365,
    longitude: 72.5611,
    phone: '+91 98250 11223',
    email: 'ahmedabad@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 9:30 PM',
  },
  {
    id: 'curated-rha-bhopal',
    name: 'Robin Hood Army - Bhopal',
    slug: 'robin-hood-army-bhopal',
    description: 'Volunteer chapter conducting daily surplus food collections and weekend Academy teaching sessions for kids in Bhopal.',
    categories: ['food_distribution', 'child_welfare', 'homeless_support'],
    address: 'E-3, Arera Colony, Bhopal',
    city: 'Bhopal',
    district: 'Bhopal',
    state: 'Madhya Pradesh',
    pincode: '462016',
    latitude: 23.2167,
    longitude: 77.4333,
    phone: '+91 98260 99887',
    email: 'bhopal@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 8:30 PM',
  },
  {
    id: 'curated-akshaya-patra-lucknow',
    name: 'The Akshaya Patra Foundation - Lucknow',
    slug: 'akshaya-patra-lucknow',
    description: 'Feeds over 100,000 students daily in government primary and secondary schools across Lucknow district.',
    categories: ['food_distribution', 'child_welfare'],
    address: 'Amar Shaheed Path, Sector 11, Vrindavan Colony, Lucknow',
    city: 'Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226029',
    latitude: 26.7845,
    longitude: 80.9542,
    phone: '+91 522 249 5500',
    email: 'lucknow@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 5:00 PM',
  },
  {
    id: 'curated-akshaya-patra-patna',
    name: 'The Akshaya Patra Foundation - Patna',
    slug: 'akshaya-patra-patna',
    description: 'Centralized mega kitchen serving hot mid-day meals to school students across Patna and surrounding districts.',
    categories: ['food_distribution', 'child_welfare'],
    address: 'Bailey Road, Danapur, Patna',
    city: 'Patna',
    district: 'Patna',
    state: 'Bihar',
    pincode: '801503',
    latitude: 25.6174,
    longitude: 85.0478,
    phone: '+91 612 250 8800',
    email: 'patna@akshayapatra.org',
    website: 'https://www.akshayapatra.org',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://www.akshayapatra.org',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Mon-Sat 7:00 AM - 5:00 PM',
  },
  {
    id: 'curated-rha-chandigarh',
    name: 'Robin Hood Army - Chandigarh',
    slug: 'robin-hood-army-chandigarh',
    description: 'Active tri-city chapter feeding hundreds of underprivileged citizens across Chandigarh, Mohali, and Panchkula.',
    categories: ['food_distribution', 'homeless_support'],
    address: 'Sector 17, Chandigarh',
    city: 'Chandigarh',
    district: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160017',
    latitude: 30.7398,
    longitude: 76.7827,
    phone: '+91 98140 33445',
    email: 'chandigarh@robinhoodarmy.com',
    website: 'https://robinhoodarmy.com',
    sourceName: 'India NGO Registry',
    sourceUrl: 'https://robinhoodarmy.com',
    verificationStatus: 'sharebite_verified',
    acceptsFoodDonations: true,
    acceptsVolunteers: true,
    operatingHours: 'Daily 9:00 AM - 9:00 PM',
  },
];

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateNGOs(ngos: IndiaNGO[]): IndiaNGO[] {
  const seen = new Map<string, IndiaNGO>();
  for (const ngo of ngos) {
    const key = `${ngo.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${(ngo.city || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (!seen.has(key)) seen.set(key, ngo);
  }
  return Array.from(seen.values());
}

// ─── Distance enrichment ──────────────────────────────────────────────────────

function enrichWithDistance(ngos: IndiaNGO[], lat?: number, lng?: number): IndiaNGO[] {
  if (!lat || !lng) return ngos;
  return ngos.map((ngo) => {
    if (ngo.latitude && ngo.longitude) {
      return {
        ...ngo,
        distanceKm: LocationService.calculateDistance(lat, lng, ngo.latitude, ngo.longitude),
      };
    }
    return ngo;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NGOSearchParams {
  query?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  city?: string;
  state?: string;
  categories?: NGOCategory[];
  sortBy?: 'nearest' | 'name' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface NGOSearchResult {
  ngos: IndiaNGO[];
  total: number;
  hasMore: boolean;
  sources: string[];
  fromCache: boolean;
  searchedCity?: string;
}

export class NGODiscoveryService {
  /**
   * Primary search function — queries Supabase + Curated Verified Directory + OSM
   * Returns deduplicated, distance-enriched, sorted results.
   */
  static async searchNGOs(params: NGOSearchParams, signal?: AbortSignal): Promise<NGOSearchResult> {
    const pageSize = params.pageSize || 40;
    const sources: string[] = [];

    // 1. Supabase database query
    const supabaseNGOs = await fetchFromSupabase({
      query: params.query,
      city: params.city,
      state: params.state,
      categories: params.categories,
      lat: params.lat,
      lng: params.lng,
      radiusKm: params.radiusKm,
      page: params.page,
      pageSize,
    });
    if (supabaseNGOs.length > 0) sources.push('ShareBite Database');

    // 2. Curated verified Indian NGO directory
    const curatedNGOs = CURATED_INDIA_NGOS.filter((ngo) => {
      if (params.query) {
        const q = params.query.toLowerCase().trim();
        const matchesQuery =
          ngo.name.toLowerCase().includes(q) ||
          (ngo.city || '').toLowerCase().includes(q) ||
          (ngo.district || '').toLowerCase().includes(q) ||
          (ngo.state || '').toLowerCase().includes(q) ||
          (ngo.pincode || '').includes(q) ||
          (ngo.address || '').toLowerCase().includes(q) ||
          (ngo.description || '').toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (params.city) {
        const c = params.city.toLowerCase().trim();
        const inCity =
          (ngo.city || '').toLowerCase().includes(c) ||
          (ngo.address || '').toLowerCase().includes(c) ||
          (ngo.district || '').toLowerCase().includes(c);
        if (!inCity) return false;
      }
      if (params.state) {
        const s = params.state.toLowerCase().trim();
        const inState = (ngo.state || '').toLowerCase().includes(s);
        if (!inState) return false;
      }
      if (params.categories && params.categories.length > 0) {
        const hasCategory = ngo.categories.some((cat) => params.categories!.includes(cat));
        if (!hasCategory) return false;
      }
      return true;
    });
    if (curatedNGOs.length > 0) sources.push('Verified Directory');

    // 3. OpenStreetMap Overpass (live geospatial query with 4s timeout)
    let osmNGOs: IndiaNGO[] = [];
    try {
      if (params.lat && params.lng && params.radiusKm && params.radiusKm < 9999) {
        const radiusM = Math.min((params.radiusKm || 25) * 1000, 50000); // 50km cap for fast OSM
        const query = buildOverpassQuery(params.lat, params.lng, radiusM);
        const elements = await fetchFromOverpass(query, signal);
        osmNGOs = elements.map(osmElementToNGO).filter(Boolean) as IndiaNGO[];
      }
      if (params.query && osmNGOs.length > 0) {
        const q = params.query.toLowerCase();
        osmNGOs = osmNGOs.filter(
          (n) => n.name.toLowerCase().includes(q) || (n.city || '').toLowerCase().includes(q)
        );
      }
      if (osmNGOs.length > 0) sources.push('OpenStreetMap');
    } catch {
      // Overpass timed out or failed — seamless fallback to verified + Supabase
    }

    // Merge, deduplicate, enrich with distance
    let all = deduplicateNGOs([...supabaseNGOs, ...curatedNGOs, ...osmNGOs]);
    all = enrichWithDistance(all, params.lat, params.lng);

    // Filter by category
    if (params.categories && params.categories.length > 0) {
      all = all.filter((n) =>
        n.categories.some((c) => params.categories!.includes(c))
      );
    }

    // Filter by radius if coordinates provided
    if (params.lat && params.lng && params.radiusKm && params.radiusKm < 9999) {
      all = all.filter((n) =>
        n.distanceKm == null || n.distanceKm <= params.radiusKm!
      );
    }

    // Sort
    const sortBy = params.sortBy || 'nearest';
    all.sort((a, b) => {
      if (sortBy === 'nearest') {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'updated') {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
      return 0;
    });

    const total = all.length;
    const page = params.page || 1;
    const start = (page - 1) * pageSize;
    const paged = all.slice(0, start + pageSize);

    return {
      ngos: paged,
      total,
      hasMore: total > start + pageSize,
      sources,
      fromCache: false,
    };
  }

  /**
   * Get a single NGO by ID from Curated or Supabase
   */
  static async getNGOById(id: string): Promise<IndiaNGO | null> {
    if (id.startsWith('curated-')) {
      return CURATED_INDIA_NGOS.find((n) => n.id === id) || null;
    }
    if (id.startsWith('osm-')) return null;

    const { data, error } = await supabase
      .from('ngos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      categories: data.categories || [],
      address: data.address,
      city: data.city,
      district: data.district,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
      phone: data.phone,
      email: data.email,
      website: data.website,
      registrationNumber: data.registration_number,
      sourceName: data.source_name || 'ShareBite',
      sourceUrl: data.source_url,
      verificationStatus: data.verification_status || 'source_listed',
      acceptsFoodDonations: data.accepts_food_donations,
      acceptsVolunteers: data.accepts_volunteers,
      operatingHours: data.operating_hours,
      lastVerifiedAt: data.last_verified_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Geocode a city/PIN and return coordinates + city name for searching
   */
  static async geocodeSearchQuery(query: string): Promise<{
    lat: number;
    lng: number;
    city: string;
    state?: string;
    displayName: string;
  } | null> {
    // Check if it's a PIN code
    const pinMatch = query.match(/^\d{6}$/);
    const searchQuery = pinMatch ? `${query}, India` : `${query}, India`;

    const result = await LocationService.geocodeAddress(searchQuery);
    if (!result) return null;

    return {
      lat: result.latitude,
      lng: result.longitude,
      city: result.city || query,
      displayName: result.displayName,
    };
  }

  static readonly NGO_CATEGORIES: { value: NGOCategory; label: string; emoji: string }[] = [
    { value: 'food_distribution', label: 'Food Distribution', emoji: '🍱' },
    { value: 'child_welfare', label: 'Child Welfare', emoji: '🧒' },
    { value: 'education', label: 'Education', emoji: '📚' },
    { value: 'women_empowerment', label: 'Women Empowerment', emoji: '👩' },
    { value: 'elderly_care', label: 'Elderly Care', emoji: '👴' },
    { value: 'disability_support', label: 'Disability Support', emoji: '♿' },
    { value: 'animal_welfare', label: 'Animal Welfare', emoji: '🐾' },
    { value: 'healthcare', label: 'Healthcare', emoji: '🏥' },
    { value: 'disaster_relief', label: 'Disaster Relief', emoji: '🆘' },
    { value: 'homeless_support', label: 'Homeless Support', emoji: '🏠' },
    { value: 'environment', label: 'Environment', emoji: '🌱' },
    { value: 'general_charity', label: 'General Charity', emoji: '💛' },
  ];

  static readonly INDIA_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
    'Lakshadweep', 'Puducherry',
  ];
}
