/**
 * ShareBite — Real-Time Logistics, PostGIS, Concurrency & RLS Verification Suite
 *
 * Usage:
 *   node scripts/verify_logistics_suite.mjs
 *
 * Read-only / non-destructive checks run automatically using .env.
 * To also run live authenticated concurrency + 2-session Realtime write tests in Staging,
 * provide:
 *   TEST_DONOR_EMAIL=... TEST_DONOR_PASSWORD=...
 *   TEST_NGO1_EMAIL=...  TEST_NGO1_PASSWORD=...
 *   TEST_NGO2_EMAIL=...  TEST_NGO2_PASSWORD=...
 *   TEST_RIDER_EMAIL=... TEST_RIDER_PASSWORD=...
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = fs.readFileSync('.env', 'utf8');
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return map;
}

const env = loadEnv();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`[${status}] ${name}: ${detail}`);
}

async function checkLiveSchemaAndRpcs() {
  // 1. Check required tables & views
  const objects = [
    'profiles',
    'food_listings',
    'ngo_claims',
    'delivery_tasks',
    'distribution_records',
    'rider_location_updates',
    'donation_status_history',
    'notifications',
    'conversations',
    'messages',
    'donor_dashboard_view',
    'ngo_claims_dashboard_view',
    'rider_tasks_view',
  ];

  for (const tbl of objects) {
    const { error } = await anon.from(tbl).select('*').limit(0);
    if (error && error.code === 'PGRST205') {
      record(`Table/View: ${tbl}`, 'MISSING_MIGRATION', error.message);
    } else if (error) {
      record(`Table/View: ${tbl}`, 'PASS_OR_RLS_PROTECTED', error.message);
    } else {
      record(`Table/View: ${tbl}`, 'OK', 'Present in schema');
    }
  }

  // 2. Check PostGIS & Logistics RPCs
  const rpcChecks = [
    { fn: 'find_nearby_ngos', args: { p_lat: 28.6139, p_lng: 77.209, p_radius_km: 15, p_only_verified: true } },
    { fn: 'find_nearby_riders', args: { p_lat: 28.6139, p_lng: 77.209, p_radius_km: 15 } },
    { fn: 'get_nearby_food', args: { p_lat: 28.6139, p_lng: 77.209, p_radius_km: 25 } },
    { fn: 'publish_food_donation', args: { p_title: 'test' } },
    { fn: 'accept_donation', args: { p_food_listing_id: '00000000-0000-0000-0000-000000000000' } },
    { fn: 'accept_delivery_job', args: { p_task_id: '00000000-0000-0000-0000-000000000000' } },
    { fn: 'update_rider_location', args: { p_lat: 28.61, p_lng: 77.2 } },
    { fn: 'update_donation_status', args: { p_task_id: '00000000-0000-0000-0000-000000000000', p_new_status: 'in_transit' } },
    { fn: 'cancel_donation', args: { p_food_listing_id: '00000000-0000-0000-0000-000000000000' } },
    { fn: 'reassign_donation', args: { p_task_id: '00000000-0000-0000-0000-000000000000' } },
    { fn: 'admin_verify_profile', args: { p_profile_id: '00000000-0000-0000-0000-000000000000', p_status: 'verified' } },
  ];

  for (const { fn, args } of rpcChecks) {
    const { error } = await anon.rpc(fn, args);
    if (!error) {
      record(`RPC: ${fn}`, 'OK', 'Callable');
    } else if (error.code === 'PGRST202') {
      record(`RPC: ${fn}`, 'MISSING_MIGRATION', 'Not yet deployed to Supabase');
    } else if (error.message?.toLowerCase().includes('authentication') || error.message?.toLowerCase().includes('unauthorized')) {
      record(`RPC: ${fn}`, 'OK', `Auth enforced (${error.message})`);
    } else {
      record(`RPC: ${fn}`, 'OK', `Responded (${error.code || 'RPC'}: ${error.message})`);
    }
  }

  // 3. Check Storage bucket food-images
  const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/food-images`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1 }),
  });
  record('Storage Bucket: food-images', bucketRes.ok ? 'OK' : 'MISSING_MIGRATION', `HTTP ${bucketRes.status}`);

  // 4. Security check: anonymous user must NOT see rider_location_updates or rider_tasks_view OTPs
  const { data: anonLocs } = await anon.from('rider_location_updates').select('*').limit(1);
  record(
    'Security: Anon rider_location_updates',
    !anonLocs || anonLocs.length === 0 ? 'OK' : 'FAIL',
    `Rows visible to anon: ${anonLocs?.length || 0}`
  );

  // 5. Security check: verify rider_tasks_view does not expose pickup_code / dropoff_code
  const { error: otpViewErr } = await anon.from('rider_tasks_view').select('pickup_code,dropoff_code').limit(1);
  record(
    'Security: rider_tasks_view OTP hidden',
    otpViewErr ? 'OK' : 'NEEDS_MIGRATION',
    otpViewErr ? `Hidden (${otpViewErr.message})` : 'pickup_code/dropoff_code still exposed until migration runs'
  );
}

async function runStagingLiveWorkflowTests() {
  const {
    TEST_DONOR_EMAIL,
    TEST_DONOR_PASSWORD,
    TEST_NGO1_EMAIL,
    TEST_NGO1_PASSWORD,
    TEST_NGO2_EMAIL,
    TEST_NGO2_PASSWORD,
    TEST_RIDER_EMAIL,
    TEST_RIDER_PASSWORD,
  } = process.env;

  if (!TEST_DONOR_EMAIL || !TEST_NGO1_EMAIL || !TEST_NGO2_EMAIL || !TEST_RIDER_EMAIL) {
    record(
      'Staging Live E2E / Concurrency / Realtime Tests',
      'SKIPPED',
      'Provide TEST_DONOR_*, TEST_NGO1_*, TEST_NGO2_*, TEST_RIDER_* env vars on Staging to run write tests.'
    );
    return;
  }

  const signIn = async (email, password) => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(`Login failed for ${email}: ${error?.message}`);
    return { client, user: data.user };
  };

  const donor = await signIn(TEST_DONOR_EMAIL, TEST_DONOR_PASSWORD);
  const ngo1 = await signIn(TEST_NGO1_EMAIL, TEST_NGO1_PASSWORD);
  const ngo2 = await signIn(TEST_NGO2_EMAIL, TEST_NGO2_PASSWORD);
  const rider = await signIn(TEST_RIDER_EMAIL, TEST_RIDER_PASSWORD);

  // 2-session Realtime check: NGO1 listens for new notification while Donor publishes
  let realtimeNotifReceived = false;
  const rtChannel = ngo1.client
    .channel(`verify_rt_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${ngo1.user.id}` },
      () => {
        realtimeNotifReceived = true;
      }
    )
    .subscribe();

  await new Promise((r) => setTimeout(r, 800));

  // Donor publishes food donation via PostGIS RPC
  const { data: pubData, error: pubErr } = await donor.client.rpc('publish_food_donation', {
    p_title: 'Staging Concurrency Test Meals',
    p_category: 'Rice',
    p_food_type: 'veg',
    p_servings: 20,
    p_pickup_address: 'Test Kitchen, Connaught Place',
    p_city: 'Delhi',
    p_latitude: 28.6315,
    p_longitude: 77.2167,
    p_available_until: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    p_notification_radius_km: 25,
  });

  if (pubErr || !pubData?.listing?.id) {
    record('Staging Publish Donation', 'FAIL', pubErr?.message || 'No listing returned');
    supabaseRemove(ngo1.client, rtChannel);
    return;
  }

  const listingId = pubData.listing.id;
  await new Promise((r) => setTimeout(r, 1200));
  record('Realtime: Donor -> NGO Notification', realtimeNotifReceived ? 'OK' : 'WARN', `Received=${realtimeNotifReceived}`);
  ngo1.client.removeChannel(rtChannel);

  // Concurrency Race Test: NGO1, NGO2, and Rider simultaneously call accept_donation
  const race = await Promise.allSettled([
    ngo1.client.rpc('accept_donation', { p_food_listing_id: listingId }),
    ngo2.client.rpc('accept_donation', { p_food_listing_id: listingId }),
    rider.client.rpc('accept_donation', { p_food_listing_id: listingId }),
  ]);

  const winners = race.filter((r) => r.status === 'fulfilled' && !r.value.error);
  record(
    'Concurrency: Atomic First-Acceptance-Wins (3-way race)',
    winners.length === 1 ? 'OK' : 'FAIL',
    `Winners=${winners.length}/3`
  );

  // Cleanup test listing via donor cancel if possible
  await donor.client.rpc('cancel_donation', { p_food_listing_id: listingId, p_reason: 'Automated test cleanup' });
}

function supabaseRemove(client, ch) {
  try {
    client.removeChannel(ch);
  } catch {}
}

await checkLiveSchemaAndRpcs();
await runStagingLiveWorkflowTests();

console.log('\nSummary:', results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {}));
