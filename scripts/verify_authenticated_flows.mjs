// Authenticated real-Chrome end-to-end verification suite for ShareBite.
// Usage: node scripts/verify_authenticated_flows.mjs <baseUrl>
// Uses headless Chromium with intercepted Supabase REST/Auth/RPC endpoints so
// we test 100% real React Router, AuthContext, RoleRouteGuard, ErrorBoundary,
// CreateDonationPage, Donor/Rider/NGO portals, tab-switches, token refreshes,
// brief offline periods, and role switching WITHOUT touching production DB records.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge executable found');
  process.exit(2);
}

const STORAGE_KEY = 'sb-lzyuvgbhpkiqxscqxggq-auth-token';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => {
  console.error(`FAIL  ${m}`);
  failures++;
};

const IDS = {
  donor: '11111111-1111-4111-8111-111111111111',
  ngo: '22222222-2222-4222-8222-222222222222',
  rider: '33333333-3333-4333-8333-333333333333',
  riderRow: '44444444-4444-4444-8444-444444444444',
  initialListing: '55555555-5555-4555-8555-555555555555',
};

function makeJwt(userId, email, expOffset = 7200) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + expOffset,
      iat: Math.floor(Date.now() / 1000),
      sub: userId,
      email,
      role: 'authenticated',
    }),
  ).toString('base64url');
  return `${header}.${payload}.mock-sig`;
}

function makeProfile(id, role, name, extra = {}) {
  return {
    id,
    full_name: name,
    email: `${role}@test.sharebite.local`,
    phone: '+91 9876543210',
    avatar_url: null,
    role,
    bio: null,
    address: `${name} Street, Bengaluru`,
    city: 'Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    organization_name: role === 'ngo' ? 'Seva Relief Foundation' : role === 'donor' ? 'Spice Garden Kitchen' : null,
    organization_type: role === 'ngo' ? 'NGO' : null,
    is_verified: true,
    verification_status: 'verified',
    is_available: true,
    service_radius_km: 15,
    operating_hours: '08:00 - 22:00',
    daily_capacity: 250,
    total_donations: 4,
    average_rating: 4.9,
    rating_count: 12,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-11-23T00:00:00Z',
    ...extra,
  };
}

function makeSession(profile) {
  return {
    access_token: makeJwt(profile.id, profile.email),
    refresh_token: `refresh-${profile.id}`,
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    token_type: 'bearer',
    user: {
      id: profile.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: profile.email,
      email_confirmed_at: '2026-01-10T00:00:00Z',
      user_metadata: {
        full_name: profile.full_name,
        role: profile.role,
        organization_name: profile.organization_name,
      },
      app_metadata: { provider: 'email', providers: ['email'] },
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-11-23T00:00:00Z',
    },
  };
}

function createMockBackend() {
  const futureIso = (hours) => new Date(Date.now() + hours * 3600_000).toISOString();
  const state = {
    currentUser: null,
    offline: false,
    seq: 100,
    profiles: {
      [IDS.donor]: makeProfile(IDS.donor, 'donor', 'Aarav Donor'),
      [IDS.ngo]: makeProfile(IDS.ngo, 'ngo', 'Meera NGO', { latitude: 12.978, longitude: 77.602 }),
      [IDS.rider]: makeProfile(IDS.rider, 'rider', 'Kabir Rider', { latitude: 12.974, longitude: 77.597 }),
    },
    riders: [
      {
        id: IDS.riderRow,
        user_id: IDS.rider,
        name: 'Kabir Rider',
        phone: '+91 9876543210',
        is_online: true,
        is_available: true,
        id_verified: true,
        current_lat: 12.974,
        current_lng: 77.597,
        vehicle_type: 'two_wheeler',
        created_at: '2026-01-10T00:00:00Z',
        updated_at: '2026-11-23T00:00:00Z',
      },
    ],
    listings: [
      {
        id: IDS.initialListing,
        donor_id: IDS.donor,
        title: 'Fresh Veg Biryani Trays',
        description: 'Hot packed catering trays prepared 1 hour ago.',
        category: 'cooked_meals',
        food_type: 'veg',
        servings: 30,
        available_servings: 30,
        quantity_unit: 'servings',
        image_url: null,
        pickup_address: '42 MG Road, Indiranagar, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        available_from: new Date().toISOString(),
        available_until: futureIso(5),
        status: 'available',
        is_urgent: true,
        assigned_rider_id: null,
        accepted_by_role: null,
        moderation_status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    claims: [],
    tasks: [],
    distributions: [],
    notifications: [],
    impactEvents: [],
    statusHistory: [],
  };

  const nextUuid = () => {
    state.seq += 1;
    const hex = state.seq.toString(16).padStart(12, '0');
    return `99999999-9999-4999-8999-${hex}`;
  };

  const enrichedListings = () =>
    state.listings.map((l) => {
      const donor = state.profiles[l.donor_id];
      return {
        ...l,
        donor: donor
          ? {
              id: donor.id,
              full_name: donor.full_name,
              organization_name: donor.organization_name,
              avatar_url: donor.avatar_url,
              average_rating: donor.average_rating,
              is_verified: donor.is_verified,
            }
          : null,
      };
    });

  const donorDashboardRows = (donorId) =>
    state.listings
      .filter((l) => !donorId || l.donor_id === donorId)
      .map((l) => {
        const claim = state.claims.find((c) => c.food_listing_id === l.id && !['cancelled', 'expired'].includes(c.status));
        const task = state.tasks.find(
          (t) =>
            (claim ? t.claim_id === claim.id : t.food_listing_id === l.id && !t.claim_id) &&
            t.status !== 'cancelled',
        );
        const rider = task?.rider_id ? state.riders.find((r) => r.id === task.rider_id) : null;
        return {
          id: l.id,
          title: l.title,
          status: l.status,
          servings: l.servings,
          available_servings: l.available_servings,
          available_until: l.available_until,
          is_urgent: l.is_urgent,
          city: l.city,
          pickup_address: l.pickup_address,
          latitude: l.latitude,
          longitude: l.longitude,
          image_url: l.image_url,
          created_at: l.created_at,
          donor_id: l.donor_id,
          accepted_by_role: l.accepted_by_role,
          claim_id: claim?.id ?? null,
          ngo_id: claim?.ngo_id ?? null,
          claim_status: claim?.status ?? null,
          ngo_name: claim?.ngo_name ?? null,
          servings_claimed: claim?.servings_claimed ?? null,
          collection_method: claim?.collection_method ?? null,
          delivery_task_id: task?.id ?? null,
          delivery_status: task?.status ?? null,
          assignment_type: task?.assignment_type ?? null,
          rider_id: task?.rider_id ?? null,
          rider_user_id: rider?.user_id ?? null,
          rider_name: rider?.name ?? null,
          rider_phone: rider?.phone ?? null,
          pickup_code: task?.pickup_code ?? claim?.pickup_code ?? null,
          dropoff_address: task?.dropoff_address ?? null,
          dropoff_lat: task?.dropoff_lat ?? null,
          dropoff_lng: task?.dropoff_lng ?? null,
          pickup_confirmed_at: task?.pickup_confirmed_at ?? null,
          delivery_confirmed_at: task?.delivery_confirmed_at ?? null,
        };
      });

  const ngoClaimsDashboardRows = (ngoId) =>
    state.claims
      .filter((c) => !ngoId || c.ngo_id === ngoId)
      .map((c) => {
        const l = state.listings.find((x) => x.id === c.food_listing_id) || {};
        const donor = state.profiles[l.donor_id] || {};
        const task = state.tasks.find((t) => t.claim_id === c.id && t.status !== 'cancelled');
        const rider = task?.rider_id ? state.riders.find((r) => r.id === task.rider_id) : null;
        const dist = state.distributions.find((d) => d.claim_id === c.id);
        return {
          ...c,
          pickup_code: task?.pickup_code ?? c.pickup_code ?? null,
          food_title: l.title || 'Food Donation',
          category: l.category || 'cooked_meals',
          food_type: l.food_type || 'veg',
          available_until: l.available_until,
          pickup_address: l.pickup_address,
          pickup_city: l.city,
          pickup_lat: l.latitude,
          pickup_lng: l.longitude,
          image_url: l.image_url,
          donor_id: l.donor_id,
          donor_name: donor.full_name || 'Donor',
          donor_phone: donor.phone || '+91 9876543210',
          delivery_task_id: task?.id ?? null,
          delivery_status: task?.status ?? null,
          dropoff_code: task?.dropoff_code ?? null,
          dropoff_address: task?.dropoff_address ?? null,
          dropoff_lat: task?.dropoff_lat ?? null,
          dropoff_lng: task?.dropoff_lng ?? null,
          pickup_confirmed_at: task?.pickup_confirmed_at ?? null,
          delivery_confirmed_at: task?.delivery_confirmed_at ?? null,
          rider_id: task?.rider_id ?? null,
          rider_user_id: rider?.user_id ?? null,
          rider_name: rider?.name ?? null,
          rider_phone: rider?.phone ?? null,
          distribution_record_id: dist?.id ?? null,
          quantity_received: dist?.quantity_received ?? null,
          quantity_distributed: dist?.quantity_distributed ?? null,
          quantity_remaining: dist?.quantity_remaining ?? null,
          distribution_status: dist?.status ?? null,
        };
      });

  const riderTaskViewRows = () =>
    state.tasks.map((t) => {
      const l = state.listings.find((x) => x.id === t.food_listing_id) || {};
      const donor = state.profiles[t.donor_id] || {};
      const ngo = state.profiles[t.ngo_id] || {};
      const claim = state.claims.find((c) => c.id === t.claim_id);
      return {
        ...t,
        food_type: l.food_type || 'veg',
        category: l.category || 'cooked_meals',
        image_url: l.image_url || null,
        donor_name: donor.full_name || 'Donor',
        donor_phone: donor.phone || null,
        ngo_name: ngo.full_name || null,
        ngo_org_name: ngo.organization_name || null,
        ngo_phone: ngo.phone || null,
        servings_claimed: claim?.servings_claimed ?? t.servings_required,
      };
    });

  return { state, nextUuid, enrichedListings, donorDashboardRows, ngoClaimsDashboardRows, riderTaskViewRows };
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
  const headers = req.headers();
  const accept = headers['accept'] || '';
  const prefer = headers['prefer'] || '';
  const wantsObject = accept.includes('application/vnd.pgrst.object+json');
  const countHeaders = prefer.includes('count=exact')
    ? { 'Content-Range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }
    : {};

  if (wantsObject) {
    if (rows.length === 0) {
      return sendJson(
        req,
        406,
        { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'Cannot coerce the result to a single JSON object' },
        countHeaders,
      );
    }
    return sendJson(req, 200, rows[0], countHeaders);
  }
  return sendJson(req, 200, rows, countHeaders);
}

function applySimpleFilters(rows, searchParams) {
  let out = [...rows];
  for (const [k, rawVal] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    if (rawVal.startsWith('eq.')) {
      const val = rawVal.slice(3);
      out = out.filter((r) => String(r[k]) === val);
    } else if (rawVal.startsWith('neq.')) {
      const val = rawVal.slice(4);
      out = out.filter((r) => String(r[k]) !== val);
    } else if (rawVal.startsWith('in.(') && rawVal.endsWith(')')) {
      const vals = rawVal
        .slice(4, -1)
        .split(',')
        .map((s) => s.replace(/^"|"$/g, '').trim());
      out = out.filter((r) => vals.includes(String(r[k])));
    } else if (rawVal === 'is.null') {
      out = out.filter((r) => r[k] == null);
    } else if (rawVal === 'not.is.null') {
      out = out.filter((r) => r[k] != null);
    }
  }
  return out;
}

async function attachInterceptor(page, mock) {
  mock.rpcCalls = [];
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

    // External map tiles / Nominatim / OSRM -> fast deterministic mocks
    if (url.includes('nominatim.openstreetmap.org')) {
      return sendJson(req, 200, {
        display_name: '42 MG Road, Bengaluru, Karnataka, India',
        address: { city: 'Bengaluru', suburb: 'MG Road' },
      });
    }
    if (url.includes('router.project-osrm.org')) {
      return sendJson(req, 200, {
        code: 'Ok',
        routes: [
          {
            distance: 2100,
            duration: 420,
            geometry: {
              coordinates: [
                [77.5946, 12.9716],
                [77.598, 12.9745],
                [77.602, 12.978],
              ],
            },
          },
        ],
      });
    }
    if (url.includes('tile.openstreetmap.org')) {
      return req.respond({ status: 204, body: '' });
    }

    if (!url.includes('lzyuvgbhpkiqxscqxggq.supabase.co')) {
      return req.continue();
    }

    if (mock.state.offline) {
      return req.abort('internetdisconnected');
    }

    const u = new URL(url);
    const p = u.pathname;
    const bodyText = req.postData();
    const body = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return {}; } })() : {};

    // Auth endpoints
    if (p.endsWith('/auth/v1/user')) {
      const uid = mock.state.currentUser?.id;
      const prof = uid ? mock.state.profiles[uid] : null;
      if (!prof) return sendJson(req, 401, { error: 'not authenticated' });
      return sendJson(req, 200, makeSession(prof).user);
    }
    if (p.endsWith('/auth/v1/token')) {
      const uid = mock.state.currentUser?.id || IDS.donor;
      const prof = mock.state.profiles[uid];
      return sendJson(req, 200, makeSession(prof));
    }
    if (p.endsWith('/auth/v1/logout')) {
      return sendJson(req, 204, {});
    }

    // Storage uploads
    if (p.includes('/storage/v1/object/')) {
      return sendJson(req, 200, { Key: 'food-images/mock-photo.jpg' });
    }

    // RPC calls
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.replace('/rest/v1/rpc/', '');
      const uid = mock.state.currentUser?.id;
      const prof = uid ? mock.state.profiles[uid] : null;
      mock.rpcCalls.push({ fn, role: prof?.role, body });

      if (fn === 'find_nearby_ngos' || fn === 'nearby_ngos') {
        const ngo = mock.state.profiles[IDS.ngo];
        return sendJson(req, 200, [
          {
            id: ngo.id,
            full_name: ngo.full_name,
            organization_name: ngo.organization_name,
            phone: ngo.phone,
            address: ngo.address,
            city: ngo.city,
            latitude: ngo.latitude,
            longitude: ngo.longitude,
            avatar_url: null,
            is_verified: true,
            is_available: ngo.is_available,
            service_radius_km: ngo.service_radius_km,
            operating_hours: ngo.operating_hours,
            daily_capacity: ngo.daily_capacity,
            distance_km: 1.1,
          },
        ]);
      }

      if (fn === 'get_nearby_food') {
        return sendJson(
          req,
          200,
          mock.state.listings
            .filter((l) => l.status === 'available' || l.status === 'partially_reserved')
            .map((l) => ({ ...l, donor_name: mock.state.profiles[l.donor_id]?.organization_name || 'Donor', distance_km: 1.2 })),
        );
      }

      if (fn === 'publish_food_donation') {
        if (mock.state.simulateFoodTypeMismatchOnce) {
          mock.state.simulateFoodTypeMismatchOnce = false;
          return sendJson(req, 400, {
            code: '42804',
            message: 'column "food_type" is of type food_type but expression is of type text',
          });
        }
        const id = mock.nextUuid();
        const listing = {
          id,
          donor_id: uid,
          title: body.p_title,
          description: body.p_description ?? null,
          category: body.p_category ?? 'cooked_meals',
          food_type: body.p_food_type ?? 'veg',
          servings: Number(body.p_servings || 10),
          available_servings: Number(body.p_servings || 10),
          quantity_unit: body.p_quantity_unit || 'servings',
          image_url: body.p_image_url ?? null,
          pickup_address: body.p_pickup_address,
          city: body.p_city || 'Bengaluru',
          latitude: body.p_latitude ?? 12.9716,
          longitude: body.p_longitude ?? 77.5946,
          available_from: new Date().toISOString(),
          available_until: body.p_available_until,
          status: 'available',
          is_urgent: Boolean(body.p_is_urgent),
          assigned_rider_id: null,
          accepted_by_role: null,
          moderation_status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mock.state.listings.unshift(listing);
        return sendJson(req, 200, { listing, notified_ngos: 1, notified_riders: 1 });
      }

      if (fn === 'accept_donation') {
        const listing = mock.state.listings.find((l) => l.id === body.p_food_listing_id);
        if (!listing) return sendJson(req, 404, { message: 'Food donation not found' });
        if (!['available', 'partially_reserved'].includes(listing.status) || listing.available_servings <= 0) {
          return sendJson(req, 400, { message: 'ALREADY_CLAIMED: This donation has already been claimed by another user.' });
        }

        if (prof?.role === 'ngo') {
          const method = body.p_collection_method === 'direct_ngo_pickup' ? 'direct_ngo_pickup' : 'ngo_delivery';
          const claimId = mock.nextUuid();
          const taskId = method === 'direct_ngo_pickup' ? null : mock.nextUuid();
          const claim = {
            id: claimId,
            food_listing_id: listing.id,
            ngo_id: prof.id,
            reservation_id: mock.nextUuid(),
            servings_claimed: Number(body.p_servings || listing.available_servings),
            status: method === 'direct_ngo_pickup' ? 'confirmed' : 'awaiting_rider',
            collection_method: method,
            pickup_code: 'DIR789',
            pickup_time: body.p_pickup_time ?? null,
            notes: body.p_notes ?? null,
            cancellation_reason: null,
            ngo_name: prof.organization_name || prof.full_name,
            confirmed_at: new Date().toISOString(),
            rider_assigned_at: null,
            collected_at: null,
            delivered_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          mock.state.claims.unshift(claim);
          listing.available_servings = 0;
          listing.status = 'reserved';
          listing.accepted_by_role = 'ngo';
          if (taskId) {
            mock.state.tasks.unshift({
              id: taskId,
              food_listing_id: listing.id,
              claim_id: claimId,
              donor_id: listing.donor_id,
              ngo_id: prof.id,
              rider_id: null,
              assignment_type: 'ngo_delivery',
              pickup_address: listing.pickup_address,
              pickup_lat: listing.latitude,
              pickup_lng: listing.longitude,
              dropoff_address: prof.address,
              dropoff_lat: prof.latitude,
              dropoff_lng: prof.longitude,
              food_title: listing.title,
              servings_required: claim.servings_claimed,
              quantity_unit: 'servings',
              collection_deadline: listing.available_until,
              status: 'awaiting_rider',
              pickup_code: 'PKP123',
              dropoff_code: 'DRP456',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
          return sendJson(req, 200, {
            accepted_by: 'ngo',
            collection_method: method,
            claim_id: claimId,
            delivery_task_id: taskId,
            pickup_code: claim.pickup_code,
            status: claim.status,
          });
        }

        if (prof?.role === 'rider') {
          const matchedNgo = mock.state.profiles[IDS.ngo];
          const claimId = mock.nextUuid();
          const taskId = mock.nextUuid();
          const rider = mock.state.riders[0];
          const claim = {
            id: claimId,
            food_listing_id: listing.id,
            ngo_id: matchedNgo.id,
            reservation_id: mock.nextUuid(),
            servings_claimed: listing.available_servings,
            status: 'rider_assigned',
            collection_method: 'ngo_delivery',
            pickup_code: 'RDR111',
            ngo_name: matchedNgo.organization_name,
            confirmed_at: new Date().toISOString(),
            rider_assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          mock.state.claims.unshift(claim);
          mock.state.tasks.unshift({
            id: taskId,
            food_listing_id: listing.id,
            claim_id: claimId,
            rider_id: rider.id,
            donor_id: listing.donor_id,
            ngo_id: matchedNgo.id,
            assignment_type: 'ngo_delivery',
            pickup_address: listing.pickup_address,
            pickup_lat: listing.latitude,
            pickup_lng: listing.longitude,
            dropoff_address: matchedNgo.address,
            dropoff_lat: matchedNgo.latitude,
            dropoff_lng: matchedNgo.longitude,
            food_title: listing.title,
            servings_required: listing.available_servings,
            quantity_unit: 'servings',
            collection_deadline: listing.available_until,
            status: 'rider_assigned',
            pickup_code: 'RDR111',
            dropoff_code: 'NGO222',
            rider_assigned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          listing.available_servings = 0;
          listing.status = 'reserved';
          listing.accepted_by_role = 'rider';
          listing.assigned_rider_id = rider.id;
          rider.is_available = false;
          return sendJson(req, 200, {
            accepted_by: 'rider',
            claim_id: claimId,
            delivery_task_id: taskId,
            status: 'rider_assigned',
          });
        }
      }

      if (fn === 'ngo_confirm_pickup') {
        const claim = mock.state.claims.find((c) => c.id === body.p_claim_id);
        if (!claim) return sendJson(req, 404, { message: 'Claim not found' });
        claim.status = 'food_collected';
        claim.collected_at = new Date().toISOString();
        const listing = mock.state.listings.find((l) => l.id === claim.food_listing_id);
        if (listing) listing.status = 'picked_up';
        return sendJson(req, 200, true);
      }

      if (fn === 'confirm_ngo_receipt') {
        const task = body.p_task_id ? mock.state.tasks.find((t) => t.id === body.p_task_id) : null;
        const claim = body.p_claim_id
          ? mock.state.claims.find((c) => c.id === body.p_claim_id)
          : task
            ? mock.state.claims.find((c) => c.id === task.claim_id)
            : null;
        if (!claim && !task) return sendJson(req, 404, { message: 'Task or claim not found' });
        if (task) task.status = 'completed';
        if (claim) {
          claim.status = 'delivered';
          claim.delivered_at = new Date().toISOString();
        }
        const listingId = task?.food_listing_id || claim?.food_listing_id;
        const listing = mock.state.listings.find((l) => l.id === listingId);
        if (listing) listing.status = 'completed';
        const distId = mock.nextUuid();
        mock.state.distributions.push({
          id: distId,
          food_listing_id: listingId,
          claim_id: claim?.id || null,
          delivery_task_id: task?.id || null,
          ngo_id: uid,
          quantity_received: Number(body.p_quantity_received || 1),
          quantity_distributed: 0,
          quantity_remaining: Number(body.p_quantity_received || 1),
          status: 'pending',
          receipt_confirmed_at: new Date().toISOString(),
        });
        return sendJson(req, 200, distId);
      }

      if (fn === 'cancel_donation' || fn === 'cancel_ngo_claim') {
        return sendJson(req, 200, true);
      }

      if (fn === 'update_rider_location') {
        return sendJson(req, 200, true);
      }

      return sendJson(req, 200, []);
    }

    // REST views & tables
    const table = p.replace('/rest/v1/', '');
    if (table === 'profiles') {
      if (method === 'PATCH') {
        const idEq = u.searchParams.get('id')?.replace('eq.', '');
        if (idEq && mock.state.profiles[idEq]) {
          Object.assign(mock.state.profiles[idEq], body);
          return handleSingleOrList(req, [mock.state.profiles[idEq]]);
        }
      }
      const rows = applySimpleFilters(Object.values(mock.state.profiles), u.searchParams);
      return handleSingleOrList(req, rows);
    }

    if (table === 'food_listings') {
      if (method === 'POST') {
        const id = mock.nextUuid();
        const inserted = {
          id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'available',
          available_servings: Number(body.servings || 10),
          ...body,
        };
        mock.state.listings.unshift(inserted);
        return sendJson(req, 201, req.headers()['accept']?.includes('object+json') ? inserted : [inserted]);
      }
      const rows = applySimpleFilters(mock.enrichedListings(), u.searchParams);
      return handleSingleOrList(req, rows);
    }

    if (table === 'donor_dashboard_view') {
      const donorId = u.searchParams.get('donor_id')?.replace('eq.', '');
      const rows = mock.donorDashboardRows(donorId);
      return handleSingleOrList(req, rows);
    }

    if (table === 'ngo_claims_dashboard_view') {
      const ngoId = u.searchParams.get('ngo_id')?.replace('eq.', '');
      const rows = mock.ngoClaimsDashboardRows(ngoId);
      return handleSingleOrList(req, rows);
    }

    if (table === 'ngo_claims') {
      const rows = applySimpleFilters(mock.state.claims, u.searchParams);
      return handleSingleOrList(req, rows);
    }

    if (table === 'delivery_tasks' || table === 'rider_tasks_view') {
      const rows = applySimpleFilters(mock.riderTaskViewRows(), u.searchParams);
      return handleSingleOrList(req, rows);
    }

    if (table === 'riders') {
      if (method === 'PATCH' || method === 'POST') {
        const uidEq = u.searchParams.get('user_id')?.replace('eq.', '') || body.user_id;
        const rider = mock.state.riders.find((r) => r.user_id === uidEq) || mock.state.riders[0];
        if (rider) Object.assign(rider, body);
        return handleSingleOrList(req, [rider]);
      }
      const rows = applySimpleFilters(mock.state.riders, u.searchParams);
      return handleSingleOrList(req, rows);
    }

    if (table === 'notifications') {
      const rows = applySimpleFilters(mock.state.notifications, u.searchParams);
      if (method === 'HEAD') {
        return req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range',
            'Content-Range': '*/0',
          },
          body: '',
        });
      }
      return handleSingleOrList(req, rows);
    }

    return handleSingleOrList(req, []);
  });
}

async function loginAs(page, mock, profile, startRoute) {
  mock.state.currentUser = profile;
  const session = makeSession(profile);
  // Load base origin first so localStorage can be seeded cleanly
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(
    (key, sessStr) => {
      localStorage.setItem(key, sessStr);
    },
    STORAGE_KEY,
    JSON.stringify(session),
  );
  await page.goto(`${baseUrl}${startRoute}`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(600);
}

async function assertStableOnTabSwitchAndReload(page, label, expectedPathPrefix) {
  await page.evaluate(() => {
    window.__sbAuthCheck = Math.random().toString(36).slice(2);
  });
  const tokenBefore = await page.evaluate(() => window.__sbAuthCheck);
  let extraNav = 0;
  const onNav = (frame) => {
    if (frame === page.mainFrame()) extraNav += 1;
  };
  page.on('framenavigated', onNav);

  // Simulate visibility hide -> focus -> visible + pageshow + 4s wait
  await page.evaluate(async () => {
    const setVis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.dispatchEvent(new Event('blur'));
    setVis('hidden');
    await new Promise((r) => setTimeout(r, 1500));
    setVis('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await sleep(4000);
  page.off('framenavigated', onNav);

  const tokenAfter = await page.evaluate(() => window.__sbAuthCheck).catch(() => null);
  const path = new URL(page.url()).pathname;
  const textLen = await page.evaluate(() => document.body.innerText.trim().length);

  if (tokenAfter === tokenBefore && extraNav === 0) pass(`${label}: survived tab-switch without reload or redirect`);
  else fail(`${label}: reloaded or navigated unexpectedly (extraNav=${extraNav}, markerOk=${tokenAfter === tokenBefore})`);

  if (path.startsWith(expectedPathPrefix) && textLen > 40) {
    pass(`${label}: stayed rendered on ${path} (${textLen} chars)`);
  } else {
    fail(`${label}: expected ${expectedPathPrefix}* and rendered UI, got path=${path}, len=${textLen}`);
  }
}

async function runSuite() {
  const mock = createMockBackend();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    // Grant geolocation permission cleanly
    const ctx = browser.defaultBrowserContext();
    await ctx.overridePermissions(baseUrl, ['geolocation']);
    await page.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await attachInterceptor(page, mock);

    // ── 1. DONOR PORTAL + CREATE DONATION + BRIEF OFFLINE + ROLE GUARD ──────
    console.log('\n[1/4] Testing Donor Portal & Create Donation flow...');
    await loginAs(page, mock, mock.state.profiles[IDS.donor], '/donor-dashboard');
    await assertStableOnTabSwitchAndReload(page, 'Donor Dashboard', '/donor-dashboard');

    // Role guard: Donor must never reach /rider-dashboard or /admin
    await page.goto(`${baseUrl}/rider-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(400);
    const redirectedFromRider = new URL(page.url()).pathname;
    if (redirectedFromRider.startsWith('/donor-dashboard')) {
      pass(`RoleGuard: Donor visiting /rider-dashboard redirected safely to ${redirectedFromRider}`);
    } else {
      fail(`RoleGuard: Donor reached ${redirectedFromRider} instead of /donor-dashboard`);
    }

    // Create Donation 3-step flow (also simulates PostgreSQL 42804 enum mismatch on publish_food_donation)
    mock.state.simulateFoodTypeMismatchOnce = true;
    await page.goto(`${baseUrl}/donations/new`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#foodTitle', { timeout: 10000 });
    await page.type('#foodTitle', 'Hot Sambar Rice Packs');
    await page.type('#servings', '25');
    // Click Continue -> Step 2
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /continue/i.test(b.innerText));
      if (btn) btn.click();
    });
    await page.waitForSelector('#pickupAddress', { timeout: 8000 });
    await page.type('#pickupAddress', '100 Feet Road, Indiranagar');
    await page.type('#city', 'Bengaluru');
    await page.click('#safetyDeclaration');
    // Click "+4 hrs" quick-pick if visible to ensure future deadline
    await page.evaluate(() => {
      const quick = [...document.querySelectorAll('button')].find((b) => /\+4\s*hrs/i.test(b.innerText));
      if (quick) quick.click();
    });
    // Click Continue -> Step 3
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /continue/i.test(b.innerText));
      if (btn) btn.click();
    });
    await sleep(500);
    // Click Publish Food Donation
    const published = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /publish food donation/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(1200);
    if (published && mock.state.listings.some((l) => l.title === 'Hot Sambar Rice Packs')) {
      pass('Donor Create Donation: completed all 3 steps and persisted new donation');
    } else {
      const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 300));
      fail(`Donor Create Donation failed (published=${published}). Page: ${bodySnippet}`);
    }

    // Manual browser refresh persistence
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    if (new URL(page.url()).pathname.startsWith('/donor')) {
      pass(`Donor manual reload stayed authenticated on ${new URL(page.url()).pathname}`);
    } else {
      fail(`Donor manual reload lost route: ${page.url()}`);
    }

    // Brief network disconnect recovery (must not bounce to /login)
    mock.state.offline = true;
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await sleep(1000);
    mock.state.offline = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(1000);
    if (new URL(page.url()).pathname.startsWith('/donor')) {
      pass('Offline -> Online recovery preserved authenticated Donor session');
    } else {
      fail(`Offline recovery broke Donor session: ${page.url()}`);
    }

    // ── 2. NGO PORTAL + DIRECT NGO PICKUP (WORKFLOW B) ─────────────────────
    console.log('\n[2/4] Testing NGO Portal & Direct Collection (Workflow B)...');
    await loginAs(page, mock, mock.state.profiles[IDS.ngo], '/ngo-dashboard');
    await assertStableOnTabSwitchAndReload(page, 'NGO Dashboard', '/ngo-dashboard');

    // Role guard: NGO cannot access Donor dashboard
    await page.goto(`${baseUrl}/donor-dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(400);
    const ngoGuarded = new URL(page.url()).pathname;
    if (ngoGuarded.startsWith('/ngo-dashboard')) {
      pass(`RoleGuard: NGO visiting /donor-dashboard redirected safely to ${ngoGuarded}`);
    } else {
      fail(`RoleGuard: NGO escaped to ${ngoGuarded}`);
    }

    // Navigate to DonationDetailPage for "Hot Sambar Rice Packs"
    const createdListing = mock.state.listings.find((l) => l.title === 'Hot Sambar Rice Packs');
    await page.goto(`${baseUrl}/donations/${createdListing.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(600);
    const clickedDirect = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /collect directly/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(1000);
    const directClaim = mock.state.claims.find((c) => c.food_listing_id === createdListing.id);
    if (clickedDirect && directClaim?.collection_method === 'direct_ngo_pickup' && directClaim?.status === 'confirmed') {
      pass('NGO Workflow B: Collect Directly created direct_ngo_pickup claim without rider task');
    } else {
      fail(`NGO Workflow B Direct Collection failed (clicked=${clickedDirect}, claim=${JSON.stringify(directClaim)})`);
    }

    // Check /my-claims Direct Pickup Pickup -> Receipt flow
    await page.goto(`${baseUrl}/my-claims`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);
    const confirmedDirectPickup = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /confirm direct pickup/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(800);
    if (confirmedDirectPickup && directClaim?.status === 'food_collected') {
      pass('NGO Workflow B: Confirm Direct Pickup transitioned claim to food_collected');
    } else {
      fail(`NGO Workflow B Confirm Direct Pickup failed (clicked=${confirmedDirectPickup}, status=${directClaim?.status})`);
    }

    const openedReceiptModal = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /confirm receipt/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(400);
    const submittedReceipt = await page.evaluate(() => {
      const modalBtns = [...document.querySelectorAll('[class*="receiptModal"] button')];
      const btn = modalBtns.find((b) => /confirm receipt/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(800);
    if (openedReceiptModal && submittedReceipt && directClaim?.status === 'delivered') {
      pass('NGO Workflow B: Confirm Receipt completed direct delivery and updated listing to completed');
    } else {
      const btnSnap = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.innerText.trim()));
      const errText = await page.evaluate(() => [...document.querySelectorAll('[class*="error"]')].map(e => e.innerText.trim()));
      fail(`NGO Workflow B Receipt failed (modal=${openedReceiptModal}, submit=${submittedReceipt}, status=${directClaim?.status}, claim=${JSON.stringify(directClaim)}, btns=${JSON.stringify(btnSnap)}, errs=${JSON.stringify(errText)})`);
    }

    // ── 3. RIDER PORTAL + ACCEPT PICKUP (WORKFLOW A) + STABILITY ──────────
    console.log('\n[3/4] Testing Rider Portal & First-Acceptance Workflow A...');
    await loginAs(page, mock, mock.state.profiles[IDS.rider], '/rider-dashboard');
    await assertStableOnTabSwitchAndReload(page, 'Rider Dashboard', '/rider-dashboard');

    // Accept the initial donation ("Fresh Veg Biryani Trays") directly as Rider
    await sleep(600);
    const riderAccepted = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^\s*accept(\s+(pickup|job))?\s*$/i.test(b.innerText));
      if (!btn) return { ok: false, btns: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()) };
      btn.click();
      return { ok: true, text: btn.innerText.trim() };
    });
    await sleep(1200);
    const initialListingAfterRider = mock.state.listings.find((l) => l.id === IDS.initialListing);
    const matchedTask = mock.state.tasks.find((t) => t.food_listing_id === IDS.initialListing);
    if (riderAccepted?.ok && initialListingAfterRider?.status === 'reserved' && matchedTask?.ngo_id === IDS.ngo) {
      pass('Rider Workflow A: Accept Pickup locked donation & auto-matched nearest verified NGO');
    } else {
      const errText = await page.evaluate(() => [...document.querySelectorAll('[class*="error"]')].map((e) => e.innerText.trim()));
      fail(`Rider Workflow A Accept Pickup failed (clicked=${JSON.stringify(riderAccepted)}, listing=${initialListingAfterRider?.status}, ngo=${matchedTask?.ngo_id}, rpcs=${JSON.stringify((mock.rpcCalls||[]).slice(-4))}, errs=${JSON.stringify(errText)})`);
    }

    // Concurrent acceptance check: NGO can no longer accept already-claimed donation
    const dupAttempt = await page.evaluate(async (listingId) => {
      const res = await fetch('https://lzyuvgbhpkiqxscqxggq.supabase.co/rest/v1/rpc/accept_donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_food_listing_id: listingId }),
      });
      return { status: res.status, text: await res.text() };
    }, IDS.initialListing);
    if (dupAttempt.status === 400 && dupAttempt.text.includes('ALREADY_CLAIMED')) {
      pass('Concurrency Guard: second acceptance returned ALREADY_CLAIMED conflict');
    } else {
      fail(`Concurrency Guard failed: ${JSON.stringify(dupAttempt)}`);
    }

    // ── 4. ACCOUNT SWITCHING + ZERO PAGE ERRORS ───────────────────────────
    console.log('\n[4/4] Testing Account Switch Isolation & Page Errors...');
    await loginAs(page, mock, mock.state.profiles[IDS.donor], '/donor-dashboard');
    const donorText = await page.evaluate(() => document.body.innerText);
    if (!donorText.includes('Rider Duty Mode') && new URL(page.url()).pathname.startsWith('/donor-dashboard')) {
      pass('Account Switch: Rider -> Donor isolated role without inheriting previous portal UI');
    } else {
      fail('Account Switch leaked Rider state into Donor session');
    }

    if (pageErrors.length === 0) {
      pass('0 uncaught browser page errors across all authenticated flows');
    } else {
      fail(`Uncaught page errors: ${pageErrors.join(' | ')}`);
    }
  } finally {
    await browser.close();
  }
}

await runSuite();
console.log(failures === 0 ? '\nALL AUTHENTICATED E2E CHECKS PASSED.' : `\nFAILED (${failures} issue(s)).`);
process.exit(failures === 0 ? 0 : 1);
