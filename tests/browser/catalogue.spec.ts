import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { catalogueFixture, catalogueResponses, fixturePhotoBase64, pageFixture, product } from '../fixtures.js';

async function installFixtures(page: Page) {
  const responses = catalogueResponses();
  const requests: string[] = [];
  const supplierRequests: string[] = [];
  await page.route('https://fakestoreapi.com/**', async (route) => {
    supplierRequests.push(route.request().url());
    await route.abort();
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === 'image' && /^\/api\/products\/\d+\/photo$/.test(url.pathname)) {
      await route.fulfill({ contentType: 'image/png', body: Buffer.from(fixturePhotoBase64, 'base64') });
      return;
    }
    const path = `${url.pathname}${url.search}`;
    requests.push(path);
    if (!responses.has(path)) {
      await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not found', details: null } } });
      return;
    }
    await route.fulfill({ json: responses.get(path) });
  });
  return { requests, supplierRequests, responses };
}

async function expectAccessibleLayout(page: Page) {
  expect(await page.locator('.catalogue-app').evaluate((app) => getComputedStyle(app).backgroundColor)).toBe('rgb(247, 249, 248)');
  expect(await page.locator('.site-header').evaluate((header) => getComputedStyle(header).backgroundColor)).toBe('rgb(255, 255, 255)');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

async function expectSortTextFits(page: Page) {
  const fits = await page.getByRole('combobox', { name: 'Sort by' }).evaluate((element) => {
    const select = element as HTMLSelectElement;
    const style = getComputedStyle(select);
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const longest = Math.max(...Array.from(select.options, (option) => canvas.measureText(option.text).width));
    const textWidth = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return textWidth >= Math.ceil(longest) + (style.appearance === 'auto' ? 16 : 0);
  });
  expect(fits).toBe(true);
}

test('fixture catalogue: ordering, categories, explicit search, keyboard, back and refresh', async ({ page }, testInfo) => {
  const { requests, supplierRequests } = await installFixtures(page);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top rated' })).toBeVisible();
  const products = page.locator('main a[href^="/products/"]');
  await expect(products).toHaveCount(5);
  expect(await products.evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(['/products/3', '/products/5', '/products/11', '/products/18', '/products/20']);
  await page.getByRole('searchbox').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
  const focusWidth = await page.getByRole('button', { name: 'Search', exact: true })
    .evaluate((button) => getComputedStyle(button).outlineWidth);
  expect(focusWidth).not.toBe('0px');
  await page.keyboard.press('Escape');
  await expectAccessibleLayout(page);
  await page.screenshot({ path: testInfo.outputPath('fixture-home.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: "men's clothing", exact: true }).click();
  await expect(page.getByRole('heading', { name: "men's clothing", exact: true })).toBeVisible();
  expect(await products.evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(['/products/3', '/products/1', '/products/2']);
  const calls = requests.length;
  await page.getByRole('searchbox').fill('cotton');
  expect(requests).toHaveLength(calls);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=cotton$/);
  await expect(page.getByRole('heading', { name: 'Search results', level: 1 })).toBeVisible();
  await expect(products).toHaveCount(3);
  await page.getByRole('searchbox').fill('telescope');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'No matching products' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('cotton');
  await page.reload();
  await expect(products).toHaveCount(3);
  await expectAccessibleLayout(page);
  expect(supplierRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('fixture enquiry: focus, validation, retained failure and explicit confirmation', async ({ page }, testInfo) => {
  await installFixtures(page);
  let submissions = 0;
  await page.route('**/api/enquiries', async (route) => {
    submissions += 1;
    expect(route.request().postDataJSON()).toEqual({ productId: 3, name: 'Alex Example', email: 'alex@example.test', message: '' });
    if (submissions === 1) {
      await route.fulfill({ status: 503, json: { error: { code: 'MAIL_UNAVAILABLE', message: 'ignored', details: null } } });
    } else {
      await route.fulfill({ json: { status: 'sent' } });
    }
  });
  await page.goto('/products/3');
  await expect(page.getByRole('heading', { name: 'Cotton jacket' })).toBeVisible();
  const actionColor = await page.getByRole('button', { name: 'Enquire', exact: true }).evaluate((button) => getComputedStyle(button).backgroundColor);
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toBeFocused();
  expect(await page.getByRole('button', { name: 'Send enquiry' }).evaluate((button) => getComputedStyle(button).backgroundColor)).toBe(actionColor);
  expect((await page.locator('.enquiry-form .fui-Input').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('textbox', { name: /^Name/ }).fill('Alex Example');
  await page.getByRole('textbox', { name: /^Email/ }).fill('alex@example.test');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('alert')).toContainText('could not confirm');
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Alex Example');
  await expect(page.getByRole('heading', { name: 'Thank you' })).toHaveCount(0);
  await expectAccessibleLayout(page);
  await page.screenshot({ path: testInfo.outputPath('fixture-enquiry-failure.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Your enquiry has been sent');
  expect(submissions).toBe(2);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await expectAccessibleLayout(page);
});

test('fixture detail: deep-link errors, cancel focus and fresh product state', async ({ page }) => {
  await installFixtures(page);
  let photoAvailable = false;
  await page.route('**/api/products/3/photo', (route) => photoAvailable ? route.fallback()
    : route.fulfill({ status: 504, headers: { 'Cache-Control': 'no-store' }, body: '' }));
  await page.goto('/products/0');
  await expect(page.getByRole('heading', { name: 'Invalid address' })).toBeVisible();
  await expectAccessibleLayout(page);
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await page.goto('/products/3');
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await page.getByRole('textbox', { name: /^Name/ }).fill('Alex Example');
  const retry = page.getByRole('button', { name: 'Retry photo' });
  await expect(retry).toBeVisible();
  photoAvailable = true;
  const restored = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/products/3/photo' && response.status() === 200);
  await retry.click(); await restored;
  await expect(page.getByRole('img', { name: 'Cotton jacket' })).toHaveJSProperty('complete', true);
  expect(await page.getByRole('img', { name: 'Cotton jacket' }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Alex Example');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Enquire', exact: true })).toBeFocused();
  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Top rated' }).click();
  await page.getByRole('link', { name: /Silver bracelet/ }).click();
  await expect(page).toHaveURL(/\/products\/5$/);
  await expect(page.getByRole('heading', { name: 'Silver bracelet', level: 1 })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('');
  await expectAccessibleLayout(page);
});

test('browse controls: pagination, photo inspection, real Back, filters and sorting', async ({ page }, testInfo) => {
  const { responses } = await installFixtures(page);
  const items = [...catalogueFixture(), ...[21, 22, 23].map((id) => product({ id, title: `Edition ${id}`, price: 70 }))]
    .sort((first, second) => first.id - second.id);
  responses.set('/api/products?page=1', pageFixture(items, []));
  responses.set('/api/products?page=2', pageFixture(items, [], 2));
  responses.set('/api/products/22', { product: items.find((item) => item.id === 22) });
  const highRated = items.filter((item) => item.price <= 50 && item.rating.rate >= 4);
  responses.set('/api/products?maxPrice=50&minRating=4&page=1', pageFixture(highRated, []));
  responses.set('/api/products?maxPrice=50&minRating=4&sort=price-desc&page=1', pageFixture(highRated, []));
  await page.goto('/search');
  await expect(page.getByRole('status')).toContainText('1–8 of 10');
  const rail = page.getByRole('complementary', { name: 'Product filters' });
  if (await rail.isVisible()) {
    const railBox = await rail.boundingBox();
    const tileBox = await page.locator('main .product-card').first().boundingBox();
    expect(Math.abs(railBox!.y - tileBox!.y)).toBeLessThanOrEqual(4);
  }
  await expectSortTextFits(page);
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Edition 22' }).click();
  await expect(page.getByRole('heading', { name: 'Edition 22', level: 1 })).toBeVisible();
  const zoom = page.getByRole('button', { name: 'Enlarge product photo' });
  await zoom.click();
  const photo = page.getByRole('dialog', { name: 'Edition 22' });
  await expect(photo.getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(zoom).toBeFocused();
  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page).toHaveURL(/\/search\?page=2$/);
  await expect(page.getByRole('link', { name: 'Edition 22' })).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/products\/22$/);
  await expect(page.getByRole('heading', { name: 'Edition 22', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Edition 22' })).toBeFocused();
  const trigger = page.getByRole('button', { name: /^Filters/ });
  const mobile = await trigger.isVisible();
  const panel = mobile ? page.getByRole('dialog', { name: 'Product filters' }) : page.getByRole('complementary', { name: 'Product filters' });
  if (mobile) {
    await trigger.click(); await expect(panel).toBeVisible();
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click();
  }
  await panel.getByRole('spinbutton', { name: 'Minimum price' }).fill('70');
  await panel.getByRole('spinbutton', { name: 'Maximum price' }).fill('50');
  await panel.getByRole('button', { name: 'Apply filters' }).click(); await expect(panel.getByRole('alert')).toBeVisible();
  await expectAccessibleLayout(page);
  await page.screenshot({ path: testInfo.outputPath('filters.png'), animations: 'disabled' });
  await panel.getByRole('spinbutton', { name: 'Minimum price' }).fill('');
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByRole('spinbutton', { name: 'Maximum price' })).not.toHaveAttribute('aria-invalid', 'true');
  await panel.getByRole('combobox', { name: 'Minimum rating' }).selectOption('4');
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('status')).toContainText(`${highRated.length} product`);
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('price-desc');
  await expect(page).toHaveURL(/maxPrice=50&minRating=4&sort=price-desc$/);
  await page.reload(); await expect(page.getByRole('link', { name: 'Trail trousers' })).toBeVisible();
  expect(await page.locator('main a[href^="/products/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(highRated.map((item) => `/products/${item.id}`));
  await expectAccessibleLayout(page);
});

test('dropdown panels support pointer selection, keyboard selection and Escape without clipping', async ({ page }, testInfo) => {
  const { responses } = await installFixtures(page);
  const products = catalogueFixture();
  for (const sort of ['price-asc', 'title-asc']) responses.set(`/api/products?sort=${sort}&page=1`, pageFixture(products, []));
  responses.set('/api/products?category=electronics&minRating=4&sort=title-asc&page=1', pageFixture(products.filter((item) => item.category === 'electronics' && item.rating.rate >= 4), []));
  await page.goto('/search');
  const sort = page.getByRole('combobox', { name: 'Sort by' });
  await expect(sort).toBeVisible();
  expect(await sort.evaluate((select) => getComputedStyle(select).appearance)).toBe('base-select');
  await sort.click();
  const lowestPrice = page.getByRole('option', { name: 'Price: low to high', exact: true });
  await expect(lowestPrice).toBeVisible();
  const optionBox = await lowestPrice.boundingBox();
  expect(optionBox!.height).toBeGreaterThanOrEqual(40);
  expect(optionBox!.x).toBeGreaterThanOrEqual(0);
  expect(optionBox!.x + optionBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('sort-open.png'), animations: 'disabled' });
  await lowestPrice.click();
  await expect(page).toHaveURL(/sort=price-asc$/); await expect(sort).toHaveValue('price-asc');
  await sort.press('Space'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(sort).toHaveValue('title-asc'); await expect(page).toHaveURL(/sort=title-asc$/);
  await sort.press('Space'); await page.keyboard.press('Escape');
  await expect(sort).toBeFocused(); await expect(sort).toHaveValue('title-asc');
  const trigger = page.getByRole('button', { name: /^Filters/ });
  const mobile = await trigger.isVisible();
  if (mobile) await trigger.click();
  const panel = page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'Product filters' });
  const category = panel.getByRole('combobox', { name: 'Category', exact: true });
  await category.click();
  const electronics = page.getByRole('option', { name: 'electronics', exact: true });
  await expect(electronics).toBeVisible();
  expect(await category.evaluate((select) => getComputedStyle(select, '::picker(select)').borderRadius)).toBe('8px');
  await page.screenshot({ path: testInfo.outputPath('category-open.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(category).toBeFocused(); await expect(panel).toBeVisible();
  await category.click();
  await electronics.click();
  await panel.getByRole('combobox', { name: 'Minimum rating' }).click();
  await page.getByRole('option', { name: '4 stars & up', exact: true }).click();
  await panel.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/category=electronics&minRating=4&sort=title-asc$/);
  await expectAccessibleLayout(page);
});

test('recovers an empty search without losing the search term, sort or browser history', async ({ page }) => {
  const { responses } = await installFixtures(page);
  const empty = '?q=cotton&maxPrice=0&minRating=1&sort=price-desc';
  const remaining = '?q=cotton&minRating=1&sort=price-desc';
  const cleared = '?q=cotton&sort=price-desc';
  const matches = catalogueFixture().filter((item) => item.title.toLowerCase().includes('cotton')).sort((first, second) => second.price - first.price);
  for (const query of [remaining, cleared]) responses.set(`/api/products${query}&page=1`, pageFixture(matches, []));
  responses.set(`/api/products${empty}&page=1`, pageFixture([], []));
  await page.goto(`/search${empty}`);
  const noResults = page.getByRole('heading', { name: 'No matching products' });
  const applied = page.getByRole('list', { name: 'Applied filters' });
  await expect(noResults).toBeVisible();
  await expect(applied.getByRole('link')).toHaveCount(2);
  await expectSortTextFits(page);
  if (page.viewportSize()!.width <= 390) {
    const boxes = await applied.getByRole('link').evaluateAll((links) => links.map((link) => {
      const { top, height } = link.getBoundingClientRect(); return { top, height };
    }));
    expect(boxes[0]!.top).toBe(boxes[1]!.top);
    expect(boxes.every((box) => box.height >= 44)).toBe(true);
  }
  await applied.getByRole('link', { name: /remove.*maximum price/i }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/search' && url.search === remaining);
  await expect(applied.getByRole('link')).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Search results' }).getByRole('link')).toHaveCount(matches.length);
  await page.goBack(); await expect(noResults).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/search' && url.search === cleared);
  await expect(page.getByRole('searchbox')).toHaveValue('cotton');
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('price-desc');
  await expect(applied).toHaveCount(0);
  await page.goBack(); await expect(noResults).toBeVisible();
  await expectAccessibleLayout(page);
});

test('search opens recent terms, supports keyboard and outside dismissal, and clears across tabs', async ({ page, context }) => {
  const { requests } = await installFixtures(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top rated', level: 1 })).toBeVisible();
  const requestCount = requests.length;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const history = page.getByRole('region', { name: 'Recent searches' });
  await expect(history).toContainText('No recent searches.');
  expect(requests).toHaveLength(requestCount);
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(history).toHaveCount(0);
  await page.getByRole('searchbox').fill('  cotton  ');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search results', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/q=cotton$/); await expect(history).toHaveCount(0); await page.reload();
  await page.getByRole('searchbox').click();
  await expect(history.getByRole('link', { name: 'cotton' })).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(history.getByRole('link', { name: 'cotton' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('contentinfo').click();
  await expect(history).toHaveCount(0);
  await page.getByRole('searchbox').click(); await expectAccessibleLayout(page);
  const inputBox = await page.locator('.search-form').boundingBox();
  const historyBox = await history.boundingBox();
  expect(Math.abs(inputBox!.width - historyBox!.width)).toBeLessThanOrEqual(2);
  expect(historyBox!.x).toBeGreaterThanOrEqual(0);
  expect(historyBox!.x + historyBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const other = await context.newPage();
  await installFixtures(other); await other.goto('/');
  await expect(other.getByRole('heading', { name: 'Top rated', level: 1 })).toBeVisible();
  await other.getByRole('searchbox').click();
  await other.getByRole('button', { name: 'Clear history' }).click();
  await page.bringToFront();
  if (!(await history.isVisible())) await page.getByRole('searchbox').click();
  await expect(history).toContainText('No recent searches.');
  await other.close(); await page.bringToFront(); await page.keyboard.press('Escape');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('long history remains scrollable within the viewport and never saves unsubmitted drafts', async ({ page }) => {
  const { requests } = await installFixtures(page);
  const terms = Array.from({ length: 5 }, (_, index) => `Saved search ${index + 1} ${'x'.repeat(170)}`);
  await page.addInitScript((saved) => localStorage.setItem('linden:recent-searches:v1', JSON.stringify(saved)), terms);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top rated', level: 1 })).toBeVisible();
  const requestCount = requests.length;
  await page.getByRole('searchbox').click();
  const history = page.getByRole('region', { name: 'Recent searches' });
  await expect(history.getByRole('link')).toHaveCount(5);
  const bounds = await history.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await history.evaluate((panel) => panel.scrollHeight > panel.clientHeight)).toBe(true);
  for (let index = 0; index < terms.length; index++) await page.keyboard.press('ArrowDown');
  await expect(history.getByRole('link').last()).toBeFocused();
  expect(await history.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0);
  await expectAccessibleLayout(page);
  await page.getByRole('searchbox').fill('Unsubmitted draft');
  expect(requests).toHaveLength(requestCount);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('linden:recent-searches:v1')!))).toEqual(terms);
  await page.keyboard.press('Escape'); await expect(history).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveValue('Unsubmitted draft');
});