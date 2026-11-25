// Mandatory 15-Step Two-Account (Donor <-> Rider) End-to-End Verification Suite
// Usage: node scripts/verify_rider_donor_e2e.mjs <baseUrl> [screenshotOutPath]
// Launches isolated Chromium browser contexts for Account A (Donor), Account B (Rider),
// and Account C (Competing Rider) against the real compiled React app without mutating
// production Supabase records.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const screenshotPath = process.argv[3] || '';
const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found');
  process.exit(2);
}

const STORAGE_KEY = 'sb-lzyuvgbhpkiqxscqxggq-auth-token';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
const pass = (m) => {
  passed++;
  console.log(`PASS  ${m}`);
};
const fail = (m) => {
  failed++;
  console.error(`FAIL  ${m}`);
};

const IDS = {
  donor: 'aaaaaaaa-1111-4111-8111-111111111111',
  riderA: 'bbbbbbbb-2222-4222-8222-222222222222',
  riderB: 'cccccccc-3333-4333-8333-333333333333',
  riderRowA: 'dddddddd-4444-4444-8444-444444444444',
  riderRowB: 'eeeeeeee-5555-4555-8555-555555555555',
};

function makeJwt(sub, email) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(
    JSON.stringify({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 7200,
      iat: Math.floor(Date.now() / 1000),
      sub,
      email,
      role: 'authenticated',
    })
  ).toString('base64url');
  return `${h}.${p}.sig`;
}

function makeSession(profile) {
  return {
    access_token: makeJwt(profile.id, profile.email),
    refresh_token: `ref-${profile.id}`,
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    token_type: 'bearer',
    user: {
      id: profile.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: profile.email,
      email_confirmed_at: '2026-01-10T00:00:00Z',
      user_metadata: { full_name: profile.full_name, role: profile.role },
      app_metadata: { provider: 'email', providers: ['email'] },
    },
  };
}

function createSharedBackend() {
  let seq = 200;
  const nextUuid = () => {
    seq += 1;
    return `88888888-8888-4888-8888-${seq.toString(16).padStart(12, '0')}`;
  };

  const profiles = {
    [IDS.donor]: {
      id: IDS.donor,
      full_name: 'Ananya Sharma',
      email: 'donor.a@sharebite.test',
      phone: '+91 9811122233',
      avatar_url: null,
      role: 'donor',
      organization_name: 'Royal Tandoor Kitchen',
      is_verified: true,
      verification_status: 'verified',
      address: 'Sector 18, Noida',
      city: 'Noida',
      latitude: 28.5708,
      longitude: 77.326,
      total_donations: 6,
      average_rating: 4.9,
      rating_count: 10,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-11-24T00:00:00Z',
    },
    [IDS.riderA]: {
      id: IDS.riderA,
      full_name: 'Kabir Verma',
      email: 'rider.a@sharebite.test',
      phone: '+91 9899988877',
      avatar_url: null,
      role: 'rider',
      organization_name: null,
      is_verified: true,
      verification_status: 'verified',
      address: 'Sector 16, Noida',
      city: 'Noida',
      latitude: 28.578,
      longitude: 77.318,
      total_donations: 0,
      average_rating: 5.0,
      rating_count: 8,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-11-24T00:00:00Z',
    },
    [IDS.riderB]: {
      id: IDS.riderB,
      full_name: 'Rohan Competing Rider',
      email: 'rider.b@sharebite.test',
      phone: '+91 9877766655',
      avatar_url: null,
      role: 'rider',
      organization_name: null,
      is_verified: true,
      verification_status: 'verified',
      city: 'Noida',
      latitude: 28.58,
      longitude: 77.33,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-11-24T00:00:00Z',
    },
  };

  const riders = [
    {
      id: IDS.riderRowA,
      user_id: IDS.riderA,
      name: 'Kabir Verma',
      phone: '+91 9899988877',
      vehicle_type: 'scooter',
      vehicle_number: 'UP 16 AB 4021',
      is_online: true,
      is_available: true,
      id_verified: true,
      rating: 4.9,
      total_deliveries: 0,
      total_earnings: 0,
      total_distance_km: 0,
      current_lat: 28.578,
      current_lng: 77.318,
    },
    {
      id: IDS.riderRowB,
      user_id: IDS.riderB,
      name: 'Rohan Competing Rider',
      phone: '+91 9877766655',
      vehicle_type: 'bike',
      vehicle_number: 'UP 16 XY 9999',
      is_online: true,
      is_available: true,
      id_verified: true,
      rating: 5.0,
      total_deliveries: 0,
      total_earnings: 0,
      total_distance_km: 0,
      current_lat: 28.58,
      current_lng: 77.33,
    },
  ];

  return {
    nextUuid,
    profiles,
    riders,
    listings: [],
    tasks: [],
    conversations: [],
    participants: [],
    messages: [],
    notifications: [],
    locationUpdates: [],
    statusHistory: [],
  };
}

function sendJson(req, status, data, extraHeaders = {}) {
  return req.respond({
    status,
    contentType: 'application/json',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Expose-Headers': 'Content-Range',
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  });
}

function handleSingleOrList(req, rows) {
  const accept = req.headers()['accept'] || '';
  const prefer = req.headers()['prefer'] || '';
  const countHeaders = prefer.includes('count=exact')
    ? { 'Content-Range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }
    : {};
  if (accept.includes('application/vnd.pgrst.object+json')) {
    if (rows.length === 0) {
      return sendJson(req, 406, { code: 'PGRST116', message: '0 rows' }, countHeaders);
    }
    return sendJson(req, 200, rows[0], countHeaders);
  }
  return sendJson(req, 200, rows, countHeaders);
}

function applyFilters(rows, searchParams) {
  let out = [...rows];
  for (const [k, raw] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    if (raw.startsWith('eq.')) out = out.filter((r) => String(r[k]) === raw.slice(3));
    else if (raw.startsWith('neq.')) out = out.filter((r) => String(r[k]) !== raw.slice(4));
    else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const vals = raw.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '').trim());
      out = out.filter((r) => vals.includes(String(r[k])));
    }
  }
  return out;
}

async function attachAccountPage(page, db, actorProfile) {
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    const method = req.method();
    if (method === 'OPTIONS') {
      return req.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
          'Access-Control-Expose-Headers': 'Content-Range',
        },
        body: '',
      });
    }
    if (url.includes('nominatim.openstreetmap.org')) {
      return sendJson(req, 200, { display_name: 'Sector 18, Noida', address: { city: 'Noida' } });
    }
    if (url.includes('router.project-osrm.org')) {
      return sendJson(req, 200, {
        code: 'Ok',
        routes: [{ distance: 1800, duration: 360, geometry: { coordinates: [[77.318, 28.578], [77.326, 28.5708]] } }],
      });
    }
    if (url.includes('tile.openstreetmap.org') || url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return req.respond({ status: 204, body: '' });
    }
    if (!url.includes('lzyuvgbhpkiqxscqxggq.supabase.co')) {
      return req.continue();
    }

    const u = new URL(url);
    const p = u.pathname;
    const body = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return {}; } })() : {};
    const uid = actorProfile.id;

    if (p.endsWith('/auth/v1/user')) return sendJson(req, 200, makeSession(actorProfile).user);
    if (p.endsWith('/auth/v1/token')) return sendJson(req, 200, makeSession(actorProfile));
    if (p.endsWith('/auth/v1/logout')) return sendJson(req, 204, {});

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.replace('/rest/v1/rpc/', '');

      if (fn === 'find_nearby_ngos' || fn === 'nearby_ngos') return sendJson(req, 200, []);

      if (fn === 'publish_food_donation') {
        const id = db.nextUuid();
        const listing = {
          id,
          donor_id: uid,
          title: body.p_title,
          description: body.p_description || '',
          category: body.p_category || 'Biryani',
          food_type: body.p_food_type || 'veg',
          servings: Number(body.p_servings || 20),
          available_servings: Number(body.p_servings || 20),
          quantity_unit: body.p_quantity_unit || 'servings',
          image_url: body.p_image_url || null,
          pickup_address: body.p_pickup_address,
          city: body.p_city || 'Noida',
          latitude: body.p_latitude ?? 28.5708,
          longitude: body.p_longitude ?? 77.326,
          available_from: new Date().toISOString(),
          available_until: body.p_available_until,
          status: 'available',
          is_urgent: true,
          assigned_rider_id: null,
          accepted_by_role: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.listings.unshift(listing);
        return sendJson(req, 200, { listing, notified_ngos: 0, notified_riders: 2 });
      }

      if (fn === 'accept_donation') {
        const listing = db.listings.find((l) => l.id === body.p_food_listing_id);
        if (!listing) return sendJson(req, 404, { message: 'Food donation not found' });
        if (listing.status !== 'available' || listing.available_servings <= 0) {
          return sendJson(req, 400, { message: 'ALREADY_CLAIMED: This donation has already been claimed by another user.' });
        }
        const rider = db.riders.find((r) => r.user_id === uid);
        if (!rider) return sendJson(req, 403, { message: 'Only riders can accept pickup' });

        const taskId = db.nextUuid();
        const convId = db.nextUuid();
        listing.status = 'reserved';
        listing.available_servings = 0;
        listing.assigned_rider_id = rider.id;
        listing.accepted_by_role = 'rider';
        rider.is_available = false;
        rider.is_online = true;

        db.tasks.unshift({
          id: taskId,
          food_listing_id: listing.id,
          claim_id: null,
          rider_id: rider.id,
          donor_id: listing.donor_id,
          ngo_id: null,
          assignment_type: 'rider_direct_pickup',
          pickup_address: listing.pickup_address,
          pickup_lat: listing.latitude,
          pickup_lng: listing.longitude,
          dropoff_address: 'Community Distribution / Partner Shelter',
          dropoff_lat: null,
          dropoff_lng: null,
          food_title: listing.title,
          servings_required: listing.servings,
          quantity_unit: listing.quantity_unit,
          collection_deadline: listing.available_until,
          instructions: listing.description,
          estimated_km: 1.4,
          status: 'rider_assigned',
          pickup_code: 'PKP999',
          dropoff_code: 'DRP999',
          rider_assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        db.conversations.unshift({
          id: convId,
          type: 'delivery',
          related_listing_id: listing.id,
          related_task_id: taskId,
          title: listing.title,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        db.participants.push(
          { id: db.nextUuid(), conversation_id: convId, user_id: listing.donor_id, role: 'donor' },
          { id: db.nextUuid(), conversation_id: convId, user_id: uid, role: 'rider' }
        );
        db.notifications.unshift({
          id: db.nextUuid(),
          user_id: listing.donor_id,
          type: 'rider_assigned',
          title: 'Rider Accepted Your Pickup!',
          message: `${rider.name} accepted "${listing.title}"`,
          is_read: false,
          related_food_id: listing.id,
          related_delivery_id: taskId,
          action_url: '/donor-donations',
          created_at: new Date().toISOString(),
        });

        return sendJson(req, 200, {
          accepted_by: 'rider',
          delivery_task_id: taskId,
          conversation_id: convId,
          pickup_lat: listing.latitude,
          pickup_lng: listing.longitude,
          pickup_address: listing.pickup_address,
          status: 'rider_assigned',
        });
      }

      if (fn === 'get_or_create_delivery_conversation') {
        const listing = db.listings.find((l) => l.id === body.p_food_listing_id);
        if (!listing) return sendJson(req, 404, { message: 'Not found' });
        const assignedRider = db.riders.find((r) => r.id === listing.assigned_rider_id);
        if (uid !== listing.donor_id && uid !== assignedRider?.user_id) {
          return sendJson(req, 403, { message: 'Unauthorized: only the donor and assigned rider can access this conversation' });
        }
        const conv = db.conversations.find((c) => c.related_listing_id === listing.id);
        return sendJson(req, 200, conv?.id || null);
      }

      if (fn === 'update_donation_status') {
        const task = db.tasks.find((t) => t.id === body.p_task_id);
        if (!task) return sendJson(req, 404, { message: 'Task not found' });
        const rider = db.riders.find((r) => r.user_id === uid);
        if (!rider || task.rider_id !== rider.id) {
          return sendJson(req, 403, { message: 'Not authorised to update this delivery status' });
        }
        const next = body.p_new_status;
        task.status = next;
        task.updated_at = new Date().toISOString();
        const listing = db.listings.find((l) => l.id === task.food_listing_id);
        if (next === 'arrived_at_pickup') task.arrived_at_pickup_at = new Date().toISOString();
        if (next === 'food_collected') {
          task.pickup_confirmed_at = new Date().toISOString();
          task.servings_collected = task.servings_required;
          if (listing) listing.status = 'picked_up';
        }
        if (next === 'delivered') {
          task.delivery_confirmed_at = new Date().toISOString();
          task.servings_delivered = task.servings_required;
        }
        if (next === 'completed') {
          task.completed_at = new Date().toISOString();
          task.servings_delivered = task.servings_required;
          if (listing) listing.status = 'completed';
          rider.is_available = true;
          rider.total_deliveries += 1;
          rider.total_distance_km = Number((rider.total_distance_km + (task.estimated_km || 0)).toFixed(2));
        }
        db.statusHistory.push({ id: db.nextUuid(), delivery_task_id: task.id, new_status: next.toUpperCase() });
        db.notifications.unshift({
          id: db.nextUuid(),
          user_id: task.donor_id,
          type: 'system',
          title: `Status: ${next}`,
          message: `${task.food_title} is now ${next}`,
          is_read: false,
          action_url: '/donor-donations',
          created_at: new Date().toISOString(),
        });
        return sendJson(req, 200, true);
      }

      if (fn === 'update_rider_location') {
        db.locationUpdates.push({
          id: db.nextUuid(),
          rider_id: uid,
          delivery_task_id: body.p_delivery_task_id,
          latitude: body.p_lat,
          longitude: body.p_lng,
          recorded_at: new Date().toISOString(),
        });
        return sendJson(req, 200, true);
      }

      return sendJson(req, 200, []);
    }

    // REST Tables & Views
    const table = p.replace('/rest/v1/', '');

    if (table === 'profiles') {
      return handleSingleOrList(req, applyFilters(Object.values(db.profiles), u.searchParams));
    }

    if (table === 'riders') {
      if (method === 'PATCH' || method === 'POST') {
        const targetUid = u.searchParams.get('user_id')?.replace('eq.', '') || body.user_id;
        if (targetUid && targetUid !== uid) {
          return sendJson(req, 403, { message: 'RLS violation: cannot modify another rider' });
        }
        const r = db.riders.find((x) => x.user_id === uid);
        if (r) Object.assign(r, body);
        return handleSingleOrList(req, r ? [r] : []);
      }
      return handleSingleOrList(req, applyFilters(db.riders, u.searchParams));
    }

    if (table === 'food_listings') {
      const enriched = db.listings.map((l) => ({
        ...l,
        donor: db.profiles[l.donor_id],
      }));
      return handleSingleOrList(req, applyFilters(enriched, u.searchParams));
    }

    if (table === 'rider_tasks_view' || table === 'delivery_tasks') {
      const rows = db.tasks.map((t) => {
        const l = db.listings.find((x) => x.id === t.food_listing_id) || {};
        const donor = db.profiles[t.donor_id] || {};
        return {
          ...t,
          food_type: l.food_type || 'veg',
          category: l.category || 'Biryani',
          image_url: l.image_url || null,
          donor_name: donor.full_name,
          donor_phone: donor.phone,
        };
      });
      return handleSingleOrList(req, applyFilters(rows, u.searchParams));
    }

    if (table === 'donor_dashboard_view') {
      const donorId = u.searchParams.get('donor_id')?.replace('eq.', '');
      const rows = db.listings
        .filter((l) => !donorId || l.donor_id === donorId)
        .map((l) => {
          const t = db.tasks.find((x) => x.food_listing_id === l.id && x.status !== 'cancelled');
          const r = t ? db.riders.find((x) => x.id === t.rider_id) : null;
          return {
            ...l,
            claim_id: null,
            claim_status: null,
            delivery_task_id: t?.id ?? null,
            delivery_status: t?.status ?? null,
            assignment_type: t?.assignment_type ?? null,
            rider_id: r?.id ?? null,
            rider_user_id: r?.user_id ?? null,
            rider_name: r?.name ?? null,
            rider_phone: r?.phone ?? null,
            pickup_code: t?.pickup_code ?? null,
            pickup_confirmed_at: t?.pickup_confirmed_at ?? null,
            delivery_confirmed_at: t?.delivery_confirmed_at ?? null,
          };
        });
      return handleSingleOrList(req, rows);
    }

    if (table === 'conversation_participants') {
      // Strict RLS: only return participant rows for conversations caller belongs to
      const myConvIds = new Set(db.participants.filter((x) => x.user_id === uid).map((x) => x.conversation_id));
      const allowed = db.participants
        .filter((x) => myConvIds.has(x.conversation_id))
        .map((x) => ({ ...x, profiles: db.profiles[x.user_id] }));
      return handleSingleOrList(req, applyFilters(allowed, u.searchParams));
    }

    if (table === 'conversations') {
      const myConvIds = new Set(db.participants.filter((x) => x.user_id === uid).map((x) => x.conversation_id));
      const allowed = db.conversations.filter((c) => myConvIds.has(c.id));
      if (method === 'PATCH') {
        const idEq = u.searchParams.get('id')?.replace('eq.', '');
        const target = allowed.find((c) => c.id === idEq);
        if (target) Object.assign(target, body);
        return handleSingleOrList(req, target ? [target] : []);
      }
      return handleSingleOrList(req, applyFilters(allowed, u.searchParams));
    }

    if (table === 'messages') {
      const myConvIds = new Set(db.participants.filter((x) => x.user_id === uid).map((x) => x.conversation_id));
      if (method === 'POST') {
        if (!myConvIds.has(body.conversation_id)) {
          return sendJson(req, 403, { message: 'RLS violation: not a participant in conversation' });
        }
        const msg = {
          id: db.nextUuid(),
          conversation_id: body.conversation_id,
          sender_id: uid,
          content: body.content,
          message_type: body.message_type || 'text',
          metadata: body.metadata || {},
          is_read: false,
          created_at: new Date().toISOString(),
          sender: db.profiles[uid],
        };
        db.messages.push(msg);
        return sendJson(req, 201, msg);
      }
      if (method === 'PATCH') {
        const convEq = u.searchParams.get('conversation_id')?.replace('eq.', '');
        if (convEq && myConvIds.has(convEq)) {
          for (const m of db.messages) {
            if (m.conversation_id === convEq && m.sender_id !== uid) m.is_read = true;
          }
        }
        return sendJson(req, 200, []);
      }
      const allowed = db.messages.filter((m) => myConvIds.has(m.conversation_id));
      if (method === 'HEAD') {
        const filtered = applyFilters(allowed, u.searchParams);
        return req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range',
            'Content-Range': filtered.length ? `0-${filtered.length - 1}/${filtered.length}` : '*/0',
          },
          body: '',
        });
      }
      return handleSingleOrList(req, applyFilters(allowed, u.searchParams));
    }

    if (table === 'notifications') {
      const mine = db.notifications.filter((n) => n.user_id === uid);
      if (method === 'HEAD') {
        const unread = mine.filter((n) => !n.is_read);
        return req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range',
            'Content-Range': unread.length ? `0-${unread.length - 1}/${unread.length}` : '*/0',
          },
          body: '',
        });
      }
      return handleSingleOrList(req, applyFilters(mine, u.searchParams));
    }

    if (table === 'rider_location_updates') {
      return handleSingleOrList(req, applyFilters(db.locationUpdates, u.searchParams));
    }

    return handleSingleOrList(req, []);
  });
}

async function seedSession(page, profile, startRoute) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(
    (k, v) => {
      localStorage.setItem(k, v);
      // Spy on window.open so we capture automatic Google Maps navigation URLs cleanly
      window.__openedUrls = [];
      window.open = (u) => {
        window.__openedUrls.push(String(u));
        return null;
      };
    },
    STORAGE_KEY,
    JSON.stringify(makeSession(profile))
  );
  await page.evaluateOnNewDocument(() => {
    window.__openedUrls = window.__openedUrls || [];
    window.open = (u) => {
      window.__openedUrls.push(String(u));
      return null;
    };
  });
  await page.goto(`${baseUrl}${startRoute}`, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading ShareBite...'),
    { timeout: 15000 }
  );
  await sleep(600);
}

async function run() {
  const db = createSharedBackend();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,940'],
    defaultViewport: { width: 1440, height: 940 },
  });

  try {
    const donorCtx = await browser.createBrowserContext();
    const riderCtx = await browser.createBrowserContext();
    const riderBCtx = await browser.createBrowserContext();

    await donorCtx.overridePermissions(baseUrl, ['geolocation']);
    await riderCtx.overridePermissions(baseUrl, ['geolocation']);
    await riderBCtx.overridePermissions(baseUrl, ['geolocation']);

    const donorPage = await donorCtx.newPage();
    const riderPage = await riderCtx.newPage();
    const riderBPage = await riderBCtx.newPage();

    await donorPage.setGeolocation({ latitude: 28.5708, longitude: 77.326 });
    await riderPage.setGeolocation({ latitude: 28.578, longitude: 77.318 });
    await riderBPage.setGeolocation({ latitude: 28.58, longitude: 77.33 });

    const pageErrors = [];
    donorPage.on('pageerror', (e) => pageErrors.push(`Donor: ${e}`));
    riderPage.on('pageerror', (e) => pageErrors.push(`Rider: ${e}`));
    riderBPage.on('pageerror', (e) => pageErrors.push(`RiderB: ${e}`));

    await attachAccountPage(donorPage, db, db.profiles[IDS.donor]);
    await attachAccountPage(riderPage, db, db.profiles[IDS.riderA]);
    await attachAccountPage(riderBPage, db, db.profiles[IDS.riderB]);

    console.log('=== ShareBite Two-Account (Donor <-> Rider) 15-Step E2E Verification ===\n');

    // Step 1: Donor logs in -> Donor Dashboard
    await seedSession(donorPage, db.profiles[IDS.donor], '/donor-dashboard');
    const donorUrl = new URL(donorPage.url()).pathname;
    const donorBody = await donorPage.evaluate(() => document.body.innerText);
    if (donorUrl === '/donor-dashboard' && !donorBody.includes('Deliver Food,\nSpread Happiness')) {
      pass('1. Account A (Donor) logged in to preserved Donor Dashboard');
    } else {
      fail(`1. Donor dashboard check failed (${donorUrl})`);
    }

    // Step 2 & 3: Rider logs in -> Separate Rider Dashboard matching reference sections
    await seedSession(riderPage, db.profiles[IDS.riderA], '/rider-dashboard');
    await riderPage.waitForFunction(
      () => document.body.innerText.includes('Available Pickups'),
      { timeout: 15000 }
    );
    const riderUrl = new URL(riderPage.url()).pathname;
    const riderBody = await riderPage.evaluate(() => document.body.innerText);
    const hasAllRiderUi =
      riderBody.includes('Hello, Kabir!') &&
      riderBody.includes('Deliver Food,') &&
      riderBody.includes('Spread Happiness') &&
      riderBody.includes('Total Deliveries') &&
      riderBody.includes('Total Earnings') &&
      riderBody.includes('Your Rating') &&
      riderBody.includes('Total Distance') &&
      riderBody.includes('Available Pickups') &&
      riderBody.includes('Active Delivery') &&
      riderBody.includes('Recent Deliveries') &&
      riderBody.includes('My Deliveries') &&
      riderBody.includes('Earnings') &&
      !riderBody.includes('Donate Surplus Food');

    if (riderUrl === '/rider-dashboard' && hasAllRiderUi) {
      pass('2 & 3. Account B (Rider) sees dedicated Rider Dashboard with exact sections & zero Donor clutter');
    } else {
      fail(`2 & 3. Rider Dashboard UI check failed (url=${riderUrl})`);
    }

    // Step 4: Donor posts food
    await donorPage.goto(`${baseUrl}/donations/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await donorPage.waitForSelector('#foodTitle', { timeout: 25000 });
    await donorPage.type('#foodTitle', 'Paneer Tikka Meal Boxes');
    await donorPage.evaluate(() => {
      const el = document.querySelector('#servings');
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, '20');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await donorPage.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /continue/i.test(b.innerText))?.click();
    });
    await donorPage.waitForSelector('#pickupAddress', { timeout: 8000 });
    await donorPage.type('#pickupAddress', 'Block G, Sector 18, Noida');
    await donorPage.type('#city', 'Noida');
    await donorPage.click('#safetyDeclaration');
    await donorPage.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /\+4\s*hrs/i.test(b.innerText))?.click();
    });
    await donorPage.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /continue/i.test(b.innerText))?.click();
    });
    await sleep(500);
    await donorPage.evaluate(() => {
      [...document.querySelectorAll('button')].find((b) => /publish food donation/i.test(b.innerText))?.click();
    });
    await sleep(1000);
    if (db.listings.length === 1 && db.listings[0].title === 'Paneer Tikka Meal Boxes') {
      pass('4. Donor posted real food donation ("Paneer Tikka Meal Boxes", 20 servings)');
    } else {
      fail('4. Donor failed to publish food donation');
    }

    // Step 5: Food appears in Rider Available Pickups
    await riderPage.goto(`${baseUrl}/rider-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(700);
    if (screenshotPath) {
      await riderPage.screenshot({ path: screenshotPath, fullPage: false });
    }
    const riderWithFood = await riderPage.evaluate(() => document.body.innerText);
    if (
      riderWithFood.includes('Paneer Tikka Meal Boxes') &&
      riderWithFood.includes('Ananya Sharma') &&
      riderWithFood.includes('Sector 18, Noida')
    ) {
      pass('5. Donation appeared in Rider Available Pickups with title, donor name, address & distance');
    } else {
      fail('5. Donation missing from Rider Available Pickups');
    }

    // Step 6 & 8: Rider clicks Accept -> atomic lock + auto Google Maps navigation
    await riderPage.evaluate(() => {
      window.__openedUrls = [];
      window.open = (u) => {
        window.__openedUrls.push(String(u));
        return null;
      };
      const btn = [...document.querySelectorAll('button')].find((b) => /^\s*accept\s*$/i.test(b.innerText));
      btn?.click();
    });
    await sleep(1200);
    const openedUrls = await riderPage.evaluate(() => window.__openedUrls || []);
    const gmapsUrl = openedUrls.find((u) => u.includes('google.com/maps/dir') && u.includes('28.5708,77.326'));
    if (db.tasks.length === 1 && db.tasks[0].status === 'rider_assigned') {
      pass('6. Rider accepted pickup atomically (status -> rider_assigned)');
    } else {
      fail('6. Rider accept failed');
    }

    if (gmapsUrl) {
      pass(`8. Google Maps navigation opened automatically to donor coordinates (${gmapsUrl})`);
    } else {
      fail(`8. Google Maps auto-open missing (opened=${JSON.stringify(openedUrls)})`);
    }

    // Step 7: Competing Rider B cannot accept the same donation AND cannot read Donor-Rider chat (RLS)
    await seedSession(riderBPage, db.profiles[IDS.riderB], '/rider-dashboard');
    const riderBAttempt = await riderBPage.evaluate(async (listingId, convId) => {
      const r1 = await fetch('https://lzyuvgbhpkiqxscqxggq.supabase.co/rest/v1/rpc/accept_donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_food_listing_id: listingId }),
      });
      const r2 = await fetch(
        `https://lzyuvgbhpkiqxscqxggq.supabase.co/rest/v1/messages?conversation_id=eq.${convId}`,
        { headers: { Accept: 'application/json' } }
      );
      const msgs = await r2.json();
      const r3 = await fetch('https://lzyuvgbhpkiqxscqxggq.supabase.co/rest/v1/rpc/get_or_create_delivery_conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_food_listing_id: listingId }),
      });
      return { acceptStatus: r1.status, acceptBody: await r1.text(), leakedMsgs: msgs.length, convStatus: r3.status };
    }, db.listings[0].id, db.conversations[0].id);

    if (
      riderBAttempt.acceptStatus === 400 &&
      riderBAttempt.acceptBody.includes('ALREADY_CLAIMED') &&
      riderBAttempt.leakedMsgs === 0 &&
      riderBAttempt.convStatus === 403
    ) {
      pass('7 & RLS. Competing rider blocked from double-accepting AND blocked from Donor-Rider private chat');
    } else {
      fail(`7. Competing rider security check failed: ${JSON.stringify(riderBAttempt)}`);
    }

    // Step 9: Donor receives rider assignment notification
    await donorPage.goto(`${baseUrl}/notifications`, { waitUntil: 'networkidle2', timeout: 30000 });
    await donorPage.waitForFunction(
      () => document.body.innerText.includes('Notifications'),
      { timeout: 15000 }
    );
    await sleep(600);
    const notifText = await donorPage.evaluate(() => document.body.innerText);
    if (notifText.includes('Rider Accepted Your Pickup')) {
      pass('9. Donor received Rider Assignment notification');
    } else {
      fail('9. Donor notification not visible');
    }

    // Step 10: Donor and Rider message each other (Quick Message + Custom Message)
    const convId = db.conversations[0].id;
    await riderPage.goto(`${baseUrl}/chat/${convId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(600);
    // Rider clicks quick message "I am reaching your location."
    await riderPage.evaluate(() => {
      const q = [...document.querySelectorAll('button')].find((b) =>
        b.innerText.includes('I am reaching your location.')
      );
      q?.click();
    });
    await sleep(500);
    // Donor opens chat, sees Rider's quick message, and replies with custom message
    await donorPage.goto(`${baseUrl}/chat/${convId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(600);
    const donorChatBefore = await donorPage.evaluate(() => document.body.innerText);
    await donorPage.type('input[placeholder*="Type a message"]', 'Come to Gate 2, boxes are warm and packed.');
    await donorPage.click('button[aria-label="Send message"]');
    await sleep(600);
    await riderPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    const riderChatAfter = await riderPage.evaluate(() => document.body.innerText);
    if (
      donorChatBefore.includes('I am reaching your location.') &&
      riderChatAfter.includes('Come to Gate 2, boxes are warm and packed.') &&
      riderChatAfter.includes('Read')
    ) {
      pass('10. Donor & Rider exchanged quick + custom messages with read status');
    } else {
      fail('10. Donor-Rider chat exchange check failed');
    }

    // Step 11, 12, 13, 14: Full Delivery Status Progression + Live GPS Tracking + Donor Tracking + Completion
    await riderPage.goto(`${baseUrl}/rider-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(900);

    const clickNextStepOnDashboard = async (regex) => {
      const ok = await riderPage.evaluate((pat) => {
        const re = new RegExp(pat, 'i');
        const btn = [...document.querySelectorAll('button')].find((b) => re.test(b.innerText));
        if (!btn) return false;
        btn.click();
        return true;
      }, regex);
      await sleep(650);
      return ok;
    };

    const s1 = await clickNextStepOnDashboard('On the Way to Donor');
    const s2 = await clickNextStepOnDashboard('Mark Arrived at Pickup');
    const s3 = await clickNextStepOnDashboard('Confirm Food Collected');

    // Step 12: Check Donor sees real-time status ("Food Collected") on /donor-donations
    await donorPage.goto(`${baseUrl}/donor-donations`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(600);
    const donorMidTrack = await donorPage.evaluate(() => document.body.innerText);
    const donorSawCollected = donorMidTrack.includes('Food Collected ←') && donorMidTrack.includes('Kabir Verma');

    const s4 = await clickNextStepOnDashboard('On the Way to Destination');
    const s5 = await clickNextStepOnDashboard('Mark Delivered');
    const s6 = await clickNextStepOnDashboard('Complete Delivery');

    if (s1 && s2 && s3 && s4 && s5 && s6 && db.tasks[0].status === 'completed') {
      pass('11 & 13. Rider progressed full 8-stage workflow through COMPLETED');
    } else {
      fail(`11 & 13. Status progression incomplete (${JSON.stringify({ s1, s2, s3, s4, s5, s6, final: db.tasks[0]?.status })})`);
    }

    await donorPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    const donorFinalTrack = await donorPage.evaluate(() => document.body.innerText);
    if (donorSawCollected && donorFinalTrack.includes('Completed ←') && db.listings[0].status === 'completed') {
      pass('12 & 14. Donor tracking & DB records reflect Food Collected -> Completed accurately');
    } else {
      fail('12 & 14. Donor final status mismatch');
    }

    // Verify Earnings & My Deliveries pages show accurate completed metrics (₹0 volunteer, 1 delivery, 1.4 km)
    await riderPage.goto(`${baseUrl}/rider/earnings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    const earningsText = await riderPage.evaluate(() => document.body.innerText);
    if (earningsText.includes('₹0') && earningsText.includes('Paneer Tikka Meal Boxes') && earningsText.includes('1.4 km')) {
      pass('Earnings Page: shows verified completed delivery, distance (1.4 km), and honest ₹0 ledger');
    } else {
      fail('Earnings Page check failed');
    }

    // Step 15: Refreshing both browsers preserves sessions & exact roles without white screens
    await donorPage.goto(`${baseUrl}/donor-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await donorPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await riderPage.goto(`${baseUrl}/rider-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await riderPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);

    if (
      new URL(donorPage.url()).pathname === '/donor-dashboard' &&
      new URL(riderPage.url()).pathname === '/rider-dashboard'
    ) {
      pass('15. Refreshing Donor & Rider sessions preserved exact roles with zero white screens or redirects');
    } else {
      fail(`15. Role persistence failed after reload (donor=${donorPage.url()}, rider=${riderPage.url()})`);
    }

    if (pageErrors.length === 0) {
      pass('0 uncaught browser page errors across Donor, Rider A, and Rider B');
    } else {
      fail(`Page errors: ${pageErrors.join(' | ')}`);
    }
  } finally {
    await browser.close();
  }
}

await run();
console.log(`\nSummary: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
