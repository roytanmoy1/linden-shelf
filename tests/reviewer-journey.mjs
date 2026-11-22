import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

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
  assert.deepEqual(await links.evaluateAll((items) => items.map((item) => item.getAttribute('href'))),
    ids.map((id) => `/products/${id}`));
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

assert.equal((await json(`${web}/api/health`)).services.api, 'ready');
assert.equal((await json(`${web}/api/not-a-route`, 404)).error.code, 'NOT_FOUND');
const featured = await json(`${web}/api/products/featured`);
assert.deepEqual(featured.products.map((item) => item.id), picks, 'The deployed API must return the chosen IDs before rendering');
await json(`${inbox}/api/v1/info`);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  if (controlled) {
    const { fixturePhotoBase64 } = await import('./fixtures.ts');
    await page.route('https://fakestoreapi.com/img/test-jacket.jpg', (route) =>
      route.fulfill({ contentType: 'image/png', body: Buffer.from(fixturePhotoBase64, 'base64') }));
  }
  page.on('pageerror', (error) => console.error(`Browser error: ${error.message.slice(0, 200)}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === web && response.status() >= 400) console.error(`Browser HTTP ${response.status()}: ${url.pathname}`);
  });
  const externalData = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== web && (['fetch', 'xhr'].includes(request.resourceType())
      || (url.hostname === 'fakestoreapi.com' && !url.pathname.startsWith('/img/')))) externalData.push(url.origin);
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
  const navigation = page.getByRole('navigation', { name: 'Categories' });
  const categories = new Set(products.map((item) => item.category));
  await verify(navigation.getByRole('link')).toHaveCount(categories.size + 1);
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
  await results.locator(`a[href="/products/${product.id}"]`).click();
  await verify(page).toHaveURL(`${web}/products/${product.id}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await verify(page.getByRole('heading', { level: 1, name: product.title, exact: true })).toBeVisible();

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
  assert.deepEqual(externalData, [], 'The browser must not fetch external product metadata');
  console.log(`Passed: five chosen products, every category, search, deep link, thank-you and one local SMTP receipt (${sourceLabel}).`);
} finally {
  await browser.close();
}
