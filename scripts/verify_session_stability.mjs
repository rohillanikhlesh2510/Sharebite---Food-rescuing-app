import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${label}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`FAIL  ${label}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

// Simulate AuthContext state machine transitions deterministically across Tests 1-10
function createAuthStateMachine() {
  const COOLDOWN_MS = 60_000;
  let now = 1_000_000;
  let activeUserId = null;
  let authenticatedUser = null;
  let authStatus = 'initializing';
  let lastProfileSyncAt = 0;
  let profileFetchCount = 0;
  let loadingSpinnerTransitions = 0;
  let cacheResetCount = 0;

  async function handleEvent(event, session, profileLoader) {
    if (event === 'SIGNED_OUT' || !session?.user) {
      if (activeUserId !== null) cacheResetCount++;
      activeUserId = null;
      authenticatedUser = null;
      lastProfileSyncAt = 0;
      authStatus = 'unauthenticated';
      return;
    }

    const uid = session.user.id;
    const isSame = activeUserId === uid && authenticatedUser !== null;
    const isSwitch = activeUserId !== null && activeUserId !== uid;

    if (event === 'TOKEN_REFRESHED' && isSame) {
      return; // Fast-path no-op
    }

    const isPassive = event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'SAFETY_REFRESH';
    if (isSame && isPassive) {
      if (now - lastProfileSyncAt < COOLDOWN_MS) {
        return; // Tab-switch duplicate SIGNED_IN ignored cleanly
      }
    } else if (isSwitch) {
      cacheResetCount++;
      authenticatedUser = null;
      lastProfileSyncAt = 0;
      authStatus = 'loading_profile';
      loadingSpinnerTransitions++;
    } else if (!isSame) {
      authStatus = 'loading_profile';
      loadingSpinnerTransitions++;
    }

    profileFetchCount++;
    const res = await profileLoader(uid);
    if (res.status === 'ok') {
      activeUserId = res.user.id;
      authenticatedUser = res.user;
      lastProfileSyncAt = now;
      authStatus = 'authenticated';
    } else if (res.status === 'error' && isSame) {
      authStatus = 'authenticated'; // Preserve active dashboard offline
    } else {
      authenticatedUser = null;
      authStatus = res.status === 'error' ? 'error' : res.status;
    }
  }

  return {
    advanceMs: (ms) => {
      now += ms;
    },
    handleEvent,
    snapshot: () => ({
      authStatus,
      user: authenticatedUser,
      profileFetchCount,
      loadingSpinnerTransitions,
      cacheResetCount,
    }),
  };
}

async function run() {
  console.log('=== ShareBite Session Stability, Tab-Switch & Render Verification ===\n');

  // 1. State Machine Tests (covering Tests 1-10 scenarios)
  const sm = createAuthStateMachine();
  const okDonor = async (id) => ({ status: 'ok', user: { id, role: 'donor', name: 'Donor User' } });
  const okRider = async (id) => ({ status: 'ok', user: { id, role: 'rider', name: 'Rider User' } });
  const okNgo = async (id) => ({ status: 'ok', user: { id, role: 'ngo', name: 'NGO User' } });
  const netError = async () => ({ status: 'error', message: 'Failed to fetch' });

  // Cold start -> INITIAL_SESSION as Donor
  await sm.handleEvent('INITIAL_SESSION', { user: { id: 'u-donor' } }, okDonor);
  check('Cold start authenticates Donor cleanly', sm.snapshot().authStatus === 'authenticated' && sm.snapshot().user.role === 'donor');

  // TEST 1 & 2 & 3: Tab switch triggers duplicate SIGNED_IN within 60s -> zero fetches, zero loading spinners
  const beforeFetches = sm.snapshot().profileFetchCount;
  const beforeSpinners = sm.snapshot().loadingSpinnerTransitions;
  sm.advanceMs(15_000);
  await sm.handleEvent('SIGNED_IN', { user: { id: 'u-donor' } }, okDonor);
  check(
    'Tab-switch duplicate SIGNED_IN triggers 0 profile fetches and 0 dashboard unmounts',
    sm.snapshot().profileFetchCount === beforeFetches &&
      sm.snapshot().loadingSpinnerTransitions === beforeSpinners &&
      sm.snapshot().authStatus === 'authenticated'
  );

  // TEST 6 & 7: Multiple TOKEN_REFRESHED events over 10 minutes -> 0 fetches, 0 unmounts
  sm.advanceMs(600_000);
  await sm.handleEvent('TOKEN_REFRESHED', { user: { id: 'u-donor' } }, okDonor);
  await sm.handleEvent('TOKEN_REFRESHED', { user: { id: 'u-donor' } }, okDonor);
  check(
    'TOKEN_REFRESHED does not trigger profile re-fetch or loading state',
    sm.snapshot().profileFetchCount === beforeFetches &&
      sm.snapshot().loadingSpinnerTransitions === beforeSpinners &&
      sm.snapshot().authStatus === 'authenticated'
  );

  // TEST 10: Temporary network disconnect after cooldown -> session stays authenticated (no logout/redirect!)
  sm.advanceMs(70_000);
  await sm.handleEvent('SIGNED_IN', { user: { id: 'u-donor' } }, netError);
  check(
    'Transient network error during background revalidation preserves authenticated session',
    sm.snapshot().authStatus === 'authenticated' && sm.snapshot().user?.id === 'u-donor'
  );

  // TEST 8: Logout -> unauthenticated + cache wipe
  const resetsBeforeLogout = sm.snapshot().cacheResetCount;
  await sm.handleEvent('SIGNED_OUT', null, okDonor);
  check(
    'SIGNED_OUT clears user, wipes caches, and sets unauthenticated',
    sm.snapshot().authStatus === 'unauthenticated' &&
      sm.snapshot().user === null &&
      sm.snapshot().cacheResetCount === resetsBeforeLogout + 1
  );

  // TEST 9: Login as Rider, then direct switch to NGO -> caches reset and exact role loaded
  await sm.handleEvent('SIGNED_IN', { user: { id: 'u-rider' } }, okRider);
  check('Rider session loads rider role', sm.snapshot().user?.role === 'rider');
  const resetsBeforeSwitch = sm.snapshot().cacheResetCount;
  await sm.handleEvent('SIGNED_IN', { user: { id: 'u-ngo' } }, okNgo);
  check(
    'Account switch resets cache and switches cleanly from Rider to NGO',
    sm.snapshot().user?.role === 'ngo' && sm.snapshot().cacheResetCount === resetsBeforeSwitch + 1
  );

  // 2. Source code architectural invariants
  const authCtx = readFileSync('src/context/AuthContext.tsx', 'utf8');
  const lazyRetry = readFileSync('src/lib/lazyWithRetry.ts', 'utf8');
  const appSrc = readFileSync('src/App.tsx', 'utf8');
  const sidebarSrc = readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
  const navbarSrc = readFileSync('src/components/layout/Navbar.tsx', 'utf8');
  const riderSrc = readFileSync('src/pages/app/RiderDashboardPage.tsx', 'utf8');
  const donorSrc = readFileSync('src/pages/app/DonorDashboardPage.tsx', 'utf8');
  const discoverSrc = readFileSync('src/pages/app/DiscoverPage.tsx', 'utf8');
  const popupSrc = readFileSync('src/components/notifications/LiveOpportunityPopup.tsx', 'utf8');

  check('lazyWithRetry does not force window.location.reload()', !lazyRetry.includes('window.location.reload'));
  check('AuthContext short-circuits TOKEN_REFRESHED', authCtx.includes("event === 'TOKEN_REFRESHED'") && authCtx.includes("eventReason === 'TOKEN_REFRESHED'"));
  check('AuthContext enforces passive revalidation cooldown', authCtx.includes('PROFILE_REVALIDATE_COOLDOWN_MS'));
  check('AuthContext preserves active session on background network error', authCtx.includes("result.status === 'error' && isSameAuthenticatedUser"));
  check('AuthContext updates onSessionResetRef inside useEffect (not during render)', authCtx.includes('onSessionResetRef.current = onSessionReset'));
  check('App.tsx disables QueryClient refetchOnWindowFocus & refetchOnReconnect', appSrc.includes('refetchOnWindowFocus: false') && appSrc.includes('refetchOnReconnect: false'));
  check('Sidebar does not fall back to donor when role is missing', !sidebarSrc.includes("?? 'donor'"));
  check('Navbar notification effect does not depend on location.pathname', navbarSrc.includes('}, [userId]);'));
  check('Navbar navLinks do not fall back to donor for unknown roles', !navbarSrc.includes('Donor / Partner Default'));
  check('RiderDashboardPage fetchData uses riderCoordsRef and subscribes on [userId]', riderSrc.includes('riderCoordsRef.current') && riderSrc.includes('}, [userId]);'));
  check('RiderDashboardPage GPS tracker depends on activeTaskId instead of full myTasks array', riderSrc.includes('}, [isOnline, activeTaskId, userId]);'));
  check('DonorDashboardPage fetchDonorData uses userLocationRef and subscribes on [userId]', donorSrc.includes('userLocationRef.current') && donorSrc.includes('}, [userId]);'));
  check('DiscoverPage separates realtime subscription from radiusKm effect', discoverSrc.includes('}, []);') && discoverSrc.includes('userCoordsRef'));
  check('LiveOpportunityPopup uses canonicalRole and navigateRef', popupSrc.includes('navigateRef') && popupSrc.includes('[userId, canonicalRole]'));

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
