// Acceptance smoke: node e2e/smoke.mjs [baseUrl]   (exit code 1 if any check fails)
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://localhost:8081').replace(/\/$/, '');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OUT, { recursive: true });
// ODsay is 30 calls/day for the whole project: transit is answered from fixtures unless LIVE_TRANSIT=1.
const LIVE = process.env.LIVE_TRANSIT === '1';
const ODSAY_CITY = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/odsay-city.json'), 'utf8');
const FIXTURE_MIN = JSON.parse(ODSAY_CITY).result.path[0].info.totalTime;

const browser = await chromium.launch({
  // PW_CHROMIUM overrides; default = playwright's own browser, else the cached chromium-1228
  executablePath: process.env.PW_CHROMIUM || undefined,
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
}).catch(() => chromium.launch({
  executablePath: join(homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'),
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
}));

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };
// Real phone UA: Kakao web map only wires touch handlers for mobile user agents.
const { defaultBrowserType: _, ...PIXEL7 } = devices['Pixel 7'];
// Transit request counters (ODsay search / loadLane / proxy transit fallback, which also spends ODsay quota).
const calls = { search: 0, lane: 0, proxyTransit: 0 };
const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
const newPage = async (device = PHONE) => {
  const ctx = await browser.newContext({
    ...device, locale: 'ko-KR',
    geolocation: { latitude: 37.4849, longitude: 126.8963 }, permissions: ['geolocation'],
  });
  ctx.on('request', (r) => {
    const u = r.url();
    if (/api\.odsay\.com\/.*searchPubTransPath/.test(u)) calls.search++;
    else if (/api\.odsay\.com\/.*loadLane/.test(u)) calls.lane++;
    else if (/\/v1\/routes$/.test(u) && /"mode":"transit"/.test(r.postData() || '')) calls.proxyTransit++;
  });
  if (!LIVE) {
    // loadLane answers with an ODsay error body -> the app keeps the original leg geometry.
    await ctx.route(/api\.odsay\.com\//, (r) => r.fulfill(/loadLane/.test(r.request().url())
      ? json('{"error":[{"code":"-98","message":"e2e fixture"}]}') : json(ODSAY_CITY)));
    await ctx.route('**/v1/routes', (r) => (/"mode":"transit"/.test(r.request().postData() || '')
      ? r.fulfill(json('{"error":"e2e: transit via proxy is blocked"}', 502)) : r.continue()));
  }
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  });
  return page;
};

// Map-moved detection: Kakao web map renders <img> tiles whose URL encodes level/x/y, and the
// tile pane is positioned by transform. Signature = tile URLs + first tile's on-screen rect.
// Reliable for zoom/tile changes and pans >= ~1px; blind to a "move" that lands on the same view.
const mapSig = (page) => page.evaluate(() => {
  const t = [...document.querySelectorAll('img')].filter((i) => /kakaocdn|daumcdn/.test(i.src));
  const r = t[0] ? t[0].getBoundingClientRect() : { x: 0, y: 0 };
  return t.map((i) => i.src.split('/').slice(-3).join('/')).sort().join(',') + `@${Math.round(r.x)},${Math.round(r.y)}`;
});
// Kakao draws polylines as SVG <path> with a stroke inside the map container.
const polylines = (page) => page.evaluate(() =>
  [...document.querySelectorAll('svg path')].filter((p) => {
    // Kakao sets stroke via attribute or inline style depending on version — use the computed value.
    const s = p.getAttribute('stroke') || getComputedStyle(p).stroke;
    return s && s !== 'none' && (p.getAttribute('d') || '').length > 20;
  }).length);

const text = (page) => page.evaluate(() => document.body.innerText);
const results = [];
const info = [];
async function check(name, fn, device) {
  const page = await newPage(device);
  const slug = name.replace(/[^a-z0-9]+/gi, '-');
  let err = null;
  try { await fn(page); } catch (e) { err = e.message.split('\n')[0]; }
  await page.screenshot({ path: join(OUT, `${slug}-${err ? 'FAIL' : 'PASS'}.png`) }).catch(() => {});
  results.push(!err);
  console.log(`${err ? 'FAIL' : 'PASS'}  ${name}${err ? '  -- ' + err : ''}`);
  await page.context().close();
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const skip = (name, why) => console.log(`SKIP  ${name}  -- ${why}`);
// Touch drag via CDP (a real phone gesture, not mouse emulation).
async function touchDrag(page, x, y, dx, dy) {
  const cdp = await page.context().newCDPSession(page);
  const t = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py, id: 1 }] });
  await t('touchStart', x, y);
  for (let i = 1; i <= 20; i++) { await t('touchMove', x + (dx * i) / 20, y + (dy * i) / 20); await page.waitForTimeout(30); }
  await t('touchEnd');
  await page.waitForTimeout(1500);
}
// The home screen is aria-hidden while a panel route is focused, so role queries miss its FABs.
const fab = (page, label) => page.locator(`[aria-label="${label}"]`).first();
const typeSlow = (page, q) => page.keyboard.type(q, { delay: 80 });

async function pick(page, label, q, name) {
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(600);
  await page.locator('input:visible').last().click();
  await typeSlow(page, q);
  const row = page.getByText(name).first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await page.waitForTimeout(600);
}
async function fillRoute(page, mode) {
  await page.goto(BASE + '/route/input', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await pick(page, '출발지 선택', '구로디지털단지역', '구로디지털단지역');
  await pick(page, '도착지 선택', '강남역', '강남역');
  if (mode) await page.getByRole('button', { name: mode }).or(page.getByText(mode, { exact: true })).first().click();
  await page.getByRole('button', { name: '경로 탐색' }).click();
}

await check('1 search 강남역 shows result <=5s', async (page) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.getByRole('search', { name: '장소 검색' }).click();
  const input = page.getByRole('textbox').first();
  await input.click();
  await typeSlow(page, '강남역');
  const t0 = Date.now();
  await page.getByRole('button', { name: /강남역/ }).first().waitFor({ timeout: 5000 });
  info.push(`last keystroke -> first result row: ${Date.now() - t0}ms`);
});

await check('2 place detail 200 + name + map moved', async (page) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const before = await mapSig(page);
  await page.getByRole('search', { name: '장소 검색' }).click();
  await page.getByRole('textbox').first().click();
  await typeSlow(page, '강남역');
  const row = page.getByRole('button', { name: /강남역/ }).first();
  await row.waitFor({ timeout: 10000 });
  const name = (await row.getAttribute('aria-label')) || '강남역';
  const resp = page.waitForResponse((r) => /\/v1\/places\//.test(r.url()), { timeout: 15000 });
  await row.click();
  const status = (await resp).status();
  assert(status === 200, `detail request status ${status}`);
  await page.waitForTimeout(3000);
  assert((await text(page)).includes(name.split(' ')[0]), 'place name not visible');
  assert((await mapSig(page)) !== before, 'map did not move');
});

await check('3 my-location button moves map', async (page) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  // first move away so "no change" can't be mistaken for success when already centered
  await page.mouse.move(195, 400);
  await page.mouse.down(); await page.mouse.move(195, 700, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(1000);
  const before = await mapSig(page);
  await page.getByRole('button', { name: '현재 위치' }).tap();
  await page.waitForTimeout(3000);
  assert((await mapSig(page)) !== before, 'map unchanged after tapping 현재 위치');
});

let transitTotalMin = null;
await check('4 transit route shows duration + polyline; ODsay calls per search = 1 route + <=1 loadLane', async (page) => {
  Object.assign(calls, { search: 0, lane: 0, proxyTransit: 0 });
  await fillRoute(page, '대중교통');
  await page.waitForURL(/result/, { timeout: 10000 });
  await page.getByText(/\d+\s*분/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(3000);
  const label = (await page.locator('[aria-label^="경로 1,"]').first().getAttribute('aria-label').catch(() => null)) || '';
  const m = label.match(/(?:(\d+)\s*시간)?\s*(\d+)\s*분/);
  transitTotalMin = m ? Number(m[1] || 0) * 60 + Number(m[2]) : null;
  info.push(`transit calls: search=${calls.search} loadLane=${calls.lane} proxyTransit=${calls.proxyTransit}; card "${label}"`);
  const n = await polylines(page);
  assert(n >= 1, `0 rendered polylines (svg path stroke) in map`);
  assert(calls.search === 1 && calls.lane <= 1 && calls.proxyTransit === 0,
    `ODsay calls search=${calls.search} loadLane=${calls.lane} proxyTransit=${calls.proxyTransit}`);
});

if (LIVE) skip('4c transit total == fixture info.totalTime', 'LIVE_TRANSIT=1');
else await check('4c transit total == fixture info.totalTime', async () => {
  assert(transitTotalMin === FIXTURE_MIN, `card total ${transitTotalMin}분 != fixture ${FIXTURE_MIN}분`);
});

if (LIVE) skip('5 refresh on /route/result recovers', 'LIVE_TRANSIT=1 (would re-spend quota)');
else await check('5 refresh on /route/result recovers (no endless 탐색 중)', async (page) => {
  await fillRoute(page, '대중교통');
  await page.waitForURL(/result/, { timeout: 10000 });
  await page.getByText(/\d+\s*분/).first().waitFor({ timeout: 20000 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(10000);
  const t = await text(page);
  assert(!/탐색 중/.test(t), 'still "탐색 중" 10s after reload');
  assert(/\d+\s*분/.test(t) || !/result/.test(page.url()), 'result gone and not redirected');
});

await check('6 car/bike tabs hidden or no "지원하지 않습니다"', async (page) => {
  await page.goto(BASE + '/route/input', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await pick(page, '출발지 선택', '구로디지털단지역', '구로디지털단지역');
  await pick(page, '도착지 선택', '강남역', '강남역');
  for (const m of ['자동차', '자전거']) {
    const tab = page.getByRole('button', { name: m }).or(page.getByText(m, { exact: true })).first();
    if (!(await tab.count())) continue; // hidden = pass
    await tab.click();
    await page.getByRole('button', { name: '경로 탐색' }).click().catch(() => {});
    await page.waitForTimeout(5000);
    assert(!/지원하지 않/.test(await text(page)), `${m}: "지원하지 않습니다" shown`);
    if (/result/.test(page.url())) { await page.goBack(); await page.waitForTimeout(1500); }
  }
});

await check('7 desktop: /search open, wheel over map zooms + 현재 위치 FAB works', async (page) => {
  await page.goto(BASE + '/search', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const s0 = await mapSig(page);
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(2000);
  const s1 = await mapSig(page);
  assert(s1 !== s0, 'map unchanged after wheel over the map with the panel open');
  await fab(page, '현재 위치').click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  assert((await mapSig(page)) !== s1, 'map unchanged after clicking 현재 위치 with the panel open');
}, DESKTOP);

await check('8 phone: /place peek sheet, dragging the map above the sheet moves it', async (page) => {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  // positive control: the same gesture on the bare map must move it, else the gesture itself is wrong
  let before = await mapSig(page);
  await touchDrag(page, 195, 300, -100, 150);
  assert((await mapSig(page)) !== before, 'control: touch drag on bare home map did not move it');
  await page.getByRole('search', { name: '장소 검색' }).click();
  await page.getByRole('textbox').first().click();
  await typeSlow(page, '강남역');
  const row = page.getByRole('button', { name: /강남역/ }).first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await page.waitForURL(/\/place\//, { timeout: 10000 });
  await page.waitForTimeout(3500);
  before = await mapSig(page);
  await touchDrag(page, 195, 300, -100, 150);
  assert((await mapSig(page)) !== before, 'map did not move when dragged above the place sheet');
}, PIXEL7);

// timing: LCP of a cold home load
{
  const page = await newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  info.push(`home LCP: ${Math.round(await page.evaluate(() => window.__lcp))}ms`);
  await page.context().close();
}

await browser.close();
console.log('\n' + info.join('\n'));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
