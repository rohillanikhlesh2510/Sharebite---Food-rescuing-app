// Real-browser reload/refresh detector for ShareBite.
// Usage: node scripts/verify_no_reload.mjs <baseUrl> [holdSeconds]
// Launches local Chrome via puppeteer-core, loads several routes, fires synthetic
// tab-switch / focus / pageshow events and counts main-frame navigations,
// document requests, Supabase requests, console errors and page errors.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const baseUrl = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const holdSeconds = Number(process.argv[3] || 20);

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const fail = (m) => { console.error(`FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`PASS  ${m}`);

async function probeRoute(browser, route, expectFinalPathPrefix) {
  const page = await browser.newPage();
  const stats = { navigations: 0, docRequests: 0, supaAuth: 0, supaRest: 0, supaRealtime: 0, errors: [], pageErrors: [] };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) stats.navigations++; });
  page.on('request', (r) => {
    if (r.resourceType() === 'document' && r.frame() === page.mainFrame()) stats.docRequests++;
    const u = r.url();
    if (u.includes('/auth/v1/')) stats.supaAuth++;
    else if (u.includes('/rest/v1/')) stats.supaRest++;
    else if (u.includes('/realtime/')) stats.supaRealtime++;
  });
  page.on('console', (m) => { if (m.type() === 'error') stats.errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => stats.pageErrors.push(String(e).slice(0, 200)));

  await page.goto(baseUrl + route, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate(() => { window.__sbMarker = Math.random().toString(36).slice(2); });
  const marker = await page.evaluate(() => window.__sbMarker);
  const afterLoad = { ...stats };

  // Hold idle: any autonomous reload/redirect loop shows up here
  await sleep(holdSeconds * 1000);

  // Synthetic tab switch away and back, focus/blur, pagehide/pageshow
  await page.evaluate(async () => {
    const setVis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.dispatchEvent(new Event('blur'));
    setVis('hidden');
    await new Promise((r) => setTimeout(r, 3000));
    setVis('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await sleep(5000);

  const markerAfter = await page.evaluate(() => window.__sbMarker).catch(() => null);
  const finalPath = new URL(page.url()).pathname;
  const bodyLen = await page.evaluate(() => document.body.innerText.trim().length);

  const label = `${route}`;
  if (markerAfter === marker) pass(`${label}: JS state survived tab-switch (no full-page reload)`);
  else fail(`${label}: page was RELOADED (marker lost)`);

  if (stats.navigations === afterLoad.navigations) pass(`${label}: 0 extra main-frame navigations during ${holdSeconds}s idle + tab switch`);
  else fail(`${label}: ${stats.navigations - afterLoad.navigations} extra navigation(s) after initial load`);

  if (stats.docRequests <= afterLoad.docRequests) pass(`${label}: 0 extra document requests after load`);
  else fail(`${label}: ${stats.docRequests - afterLoad.docRequests} extra document request(s)`);

  if (!expectFinalPathPrefix || finalPath.startsWith(expectFinalPathPrefix)) pass(`${label}: final path ${finalPath}`);
  else fail(`${label}: expected path ${expectFinalPathPrefix}* but ended on ${finalPath}`);

  if (bodyLen > 20) pass(`${label}: page not blank (${bodyLen} chars of text)`);
  else fail(`${label}: page looks BLANK (${bodyLen} chars)`);

  const extraAuth = stats.supaAuth - afterLoad.supaAuth;
  const extraRest = stats.supaRest - afterLoad.supaRest;
  console.log(`INFO  ${label}: supabase auth calls total=${stats.supaAuth} (+${extraAuth} after tab switch), rest total=${stats.supaRest} (+${extraRest}), realtime=${stats.supaRealtime}`);
  if (stats.pageErrors.length) fail(`${label}: uncaught page errors: ${stats.pageErrors.join(' | ')}`);
  else pass(`${label}: no uncaught page errors`);
  if (stats.errors.length) console.log(`INFO  ${label}: console errors: ${[...new Set(stats.errors)].join(' | ')}`);

  await page.close();
}

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
console.log(`=== Reload/refresh probe against ${baseUrl} (idle ${holdSeconds}s per route) ===\n`);
try {
  await probeRoute(browser, '/', '/');
  await probeRoute(browser, '/register', '/register');
  await probeRoute(browser, '/login/donor', '/login/donor');
  await probeRoute(browser, '/donor-dashboard', '/register');
  await probeRoute(browser, '/rider-dashboard', '/register');
  await probeRoute(browser, '/ngo-dashboard', '/register');
  await probeRoute(browser, '/does-not-exist', '/does-not-exist');
} finally {
  await browser.close();
}
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures ? 1 : 0);
