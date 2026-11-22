import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect, firefox, webkit } from '@playwright/test';

function loopback(port) {
  assert.match(String(port), /^[1-9]\d{0,4}$/);
  assert(Number(port) <= 65535);
  return `http://127.0.0.1:${port}`;
}

const web = loopback(process.env.WEB_PORT ?? 3000);
const inbox = loopback(process.env.MAILPIT_HTTP_PORT ?? 8025);
const picks = (process.env.FEATURED_PRODUCT_IDS ?? '3,5,11,18,20').split(',').map(Number);
const verify = expect.configure({ timeout: 15000 });
const marker = `reviewer-${randomUUID()}`;
const replyTo = `${marker}@example.test`;
const controlled = process.env.REVIEWER_CONTROLLED_SUPPLIER === 'true';
const sourceLabel = controlled ? 'controlled supplier and photo' : 'live Fake Store';
const width = Number(process.env.REVIEWER_WIDTH ?? 1440);
assert([320, 390, 1440].includes(width), 'REVIEWER_WIDTH must be 320, 390 or 1440');
const engines = { chromium, firefox, webkit };
const engine = process.env.REVIEWER_BROWSER ?? 'chromium';
assert(Object.hasOwn(engines, engine), 'REVIEWER_BROWSER must be chromium, firefox or webkit');
assert(engine !== 'firefox' || width === 1440, 'Use the desktop width for Firefox (no Playwright mobile emulation)');

async function json(url, status = 200) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  const body = await response.json();
  const code = body?.error?.code;
  assert.equal(response.status, status, `${new URL(url).pathname}: HTTP ${response.status}${typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code) ? ` (${code})` : ''}`);
  return body;
}

async function checkTiles(list, ids) {
  const links = list.getByRole('link');
  await verify(links).toHaveCount(ids.length);
  await verify.poll(() => links.evaluateAll((items) => items.map((item) => item.getAttribute('href'))))
    .toEqual(ids.map((id) => `/products/${id}`));
}

async function checkViewport(page) {
  const actual = await page.evaluate(() => globalThis.document.documentElement.scrollWidth);
  assert(actual <= width, `Page layout is ${actual}px wide on a ${width}px viewport`);
}

async function checkPhoto(image) {
  await verify(image).toHaveJSProperty('complete', true);
  const width = await image.evaluate(async (element) => { await element.decode(); return element.naturalWidth; });
  assert(width > 0, 'The product photo must decode into visible pixels');
}

async function checkMail(product) {
  const search = new URLSearchParams({ query: marker });
  const receipts = async () => (await json(`${inbox}/api/v1/search?${search}`)).messages;
  await verify.poll(async () => (await receipts()).length).toBe(1);
  const [receipt] = await receipts();
  const mail = await json(`${inbox}/api/v1/message/${encodeURIComponent(receipt.ID)}`);
  assert.equal(mail.Subject, `Product enquiry #${product.id}`);
  assert.deepEqual(mail.To.map((contact) => contact.Address), [process.env.SALES_EMAIL ?? 'sales@lindenshelf.test']);
  assert.deepEqual(mail.ReplyTo.map((contact) => contact.Address), [replyTo]);
  assert(mail.Text.includes(`Product: ${product.id} - ${product.title}`));
  assert(mail.Text.includes(`Price (USD): ${product.price.toFixed(2)}`));
  assert(mail.Text.includes(`Message: ${marker}`));
}

async function reviewBrowse(page, products, product) {
  const results = page.getByRole('list', { name: 'Search results', exact: true });
  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'All products', exact: true }).click();
  const sorted = [...products].sort((first, second) => first.id - second.id);
  await checkTiles(results, sorted.slice(0, 8).map((item) => item.id));
  if (sorted.length > 8) {
    await page.getByRole('link', { name: 'Next page' }).click();
    const next = sorted.slice(8, 16);
    await checkTiles(results, next.map((item) => item.id));
    await results.getByRole('link').first().click();
    await verify(page.getByRole('heading', { name: next[0].title, level: 1 })).toBeVisible();
    const zoom = page.getByRole('button', { name: 'Enlarge product photo' });
    await zoom.click();
    await checkPhoto(page.getByRole('dialog').getByRole('img'));
    await page.keyboard.press('Escape'); await verify(zoom).toBeFocused();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await verify(page).toHaveURL(`${web}/search?page=2`);
    await checkTiles(results, next.map((item) => item.id));
    await verify(results.getByRole('link', { name: next[0].title, exact: true })).toBeFocused();
  }
  const mobile = width < 801;
  if (mobile) await page.getByRole('button', { name: /^Filters/ }).click();
  const panel = page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'Product filters' });
  const ceiling = Math.ceil(product.price), stars = Math.floor(product.rating.rate);
  await panel.getByRole('combobox', { name: 'Category', exact: true }).selectOption(product.category);
  await panel.getByRole('spinbutton', { name: 'Maximum price' }).fill(String(ceiling));
  if (stars) await panel.getByRole('combobox', { name: 'Minimum rating' }).selectOption(String(stars));
  await panel.getByRole('checkbox', { name: 'Editorial picks only' }).check();
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await verify(page).toHaveURL(/featured=1/);
  const sort = page.getByRole('combobox', { name: 'Sort by' });
  await sort.selectOption('price-desc');
  await verify(page).toHaveURL((url) => url.searchParams.get('sort') === 'price-desc' && url.searchParams.get('category') === product.category
    && url.searchParams.get('maxPrice') === String(ceiling) && url.searchParams.get('featured') === '1');
  const matching = products.filter((item) => item.category === product.category && item.price <= ceiling && item.rating.rate >= stars && picks.includes(item.id))
    .sort((first, second) => second.price - first.price || first.id - second.id).map((item) => item.id);
  await checkTiles(results, matching); await verify(sort).toHaveValue('price-desc');
  const sortedUrl = page.url();
  await page.reload({ waitUntil: 'domcontentloaded' }); await verify(page).toHaveURL(sortedUrl); await checkTiles(results, matching);
  const applied = page.getByRole('list', { name: 'Applied filters' });
  await applied.getByRole('link', { name: /remove filter: maximum price/i }).click();
  await verify(page).toHaveURL((url) => !url.searchParams.has('maxPrice') && url.searchParams.get('category') === product.category
    && url.searchParams.get('featured') === '1' && url.searchParams.get('sort') === 'price-desc');
  await verify(results.getByRole('link', { name: product.title, exact: true })).toBeVisible();
  await checkViewport(page);
}

assert.equal((await json(`${web}/api/health`)).services.api, 'ready');
assert.equal((await json(`${web}/api/not-a-route`, 404)).error.code, 'NOT_FOUND');
const featured = await json(`${web}/api/products/featured`);
assert.deepEqual(featured.products.map((item) => item.id), picks, 'The deployed API must return the chosen IDs before rendering');
await json(`${inbox}/api/v1/info`);
const executablePath = engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await engines[engine].launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width, height: width < 801 ? 844 : 1000 }, isMobile: width < 801, hasTouch: width < 801 });
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
  page.on('console', (message) => { if (message.text().startsWith('Catalogue CSP:')) pageErrors.push(message.text()); });
  await page.addInitScript(() => globalThis.document.addEventListener('securitypolicyviolation', (event) => {
    console.error(`Catalogue CSP: ${event.effectiveDirective}`);
  }));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === web && response.status() >= 400) console.error(`Browser HTTP ${response.status()}: ${url.pathname}`);
  });
  const externalData = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== web && (['fetch', 'xhr', 'image'].includes(request.resourceType()) || url.hostname === 'fakestoreapi.com')) externalData.push(url.origin);
  });

  await page.goto(web, { waitUntil: 'domcontentloaded' });
  await checkTiles(page.getByRole('list', { name: 'Selected top-rated products' }), picks);
  const start = process.env.REVIEWER_STARTED_MS;
  if (start !== undefined) {
    const elapsed = Date.now() - Number(start);
    assert(elapsed >= 0 && elapsed < 600000, `Build to usable catalogue took ${elapsed}ms; budget is under 10 minutes`);
    console.log(`Compose build to five browser tiles (${sourceLabel}): ${(elapsed / 1000).toFixed(1)}s`);
  }

  const { products } = await json(`${web}/api/products`);
  const product = products.find((item) => item.id === picks[0]);
  assert(product, 'The first editorial pick must exist in the catalogue');
  await reviewBrowse(page, products, product);
  const navigation = page.getByRole('navigation', { name: 'Categories' });
  const categories = new Set(products.map((item) => item.category));
  await verify(navigation.getByRole('link')).toHaveCount(categories.size + 2);
  for (const name of categories) {
    const members = products.filter((item) => item.category === name).map((item) => item.id);
    const featured = picks.filter((id) => members.includes(id));
    const remaining = members.filter((id) => !picks.includes(id)).sort((first, second) => first - second);
    await navigation.getByRole('link', { name, exact: true }).click();
    await verify(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    if (featured.length) await checkTiles(page.getByRole('list', { name: 'Featured products', exact: true }), featured);
    else await verify(page.getByText('No featured products in this category.', { exact: true })).toBeVisible();
    if (remaining.length) await checkTiles(page.getByRole('list', { name: 'More products', exact: true }), remaining);
    else await verify(page.getByText('No more products in this category.', { exact: true })).toBeVisible();
  }

  const term = product.title.slice(0, 40).toLowerCase();
  const expectedMatches = products.filter((item) => [item.title, item.description, item.category]
    .some((field) => field.toLowerCase().includes(term))).map((item) => item.id).sort((first, second) => first - second);
  assert(expectedMatches.length < products.length, 'The acceptance search must exclude at least one item');
  const searchbox = page.getByRole('searchbox');
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await searchbox.fill(marker);
  await search.click();
  await verify(page.getByRole('heading', { name: 'No matching products' })).toBeVisible();
  await verify(page.locator('main a[href^="/products/"]')).toHaveCount(0);
  await searchbox.fill(`  ${term.toUpperCase()}  `);
  await search.click();
  const results = page.getByRole('list', { name: 'Search results', exact: true });
  await checkTiles(results, expectedMatches);
  await page.getByRole('searchbox').click();
  await verify(page.getByRole('region', { name: 'Recent searches' }).getByRole('link', { name: term.toUpperCase(), exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await results.locator(`a[href="/products/${product.id}"]`).click();
  await verify(page).toHaveURL(`${web}/products/${product.id}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await verify(page.getByRole('heading', { level: 1, name: product.title, exact: true })).toBeVisible();
  const photo = page.getByRole('img', { name: product.title });
  await verify(photo).toHaveAttribute('src', `/api/products/${product.id}/photo`);
  await checkPhoto(photo);
  await checkViewport(page);

  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Send enquiry' });
  await submit.click();
  await verify(page.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('aria-invalid', 'true');
  await verify(page.getByRole('heading', { name: 'Thank you', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: /^Name/ }).fill('Local Reviewer');
  await page.getByRole('textbox', { name: /^Email/ }).fill(replyTo);
  await page.getByRole('textbox', { name: /Message/ }).fill(marker);
  await submit.click();
  await verify(page.getByRole('heading', { name: 'Thank you', exact: true })).toBeFocused();
  await checkMail(product);
  assert.deepEqual(externalData, [], 'The browser must not fetch external product data or photos');
  assert.deepEqual(pageErrors, [], 'Customer journey encountered a browser error');
  console.log(`Passed: five chosen products, every category, filters, sort, pagination when available, search history, detail and one local SMTP receipt (${sourceLabel}, ${width}px, ${engine}).`);
} finally {
  await browser.close();
}
