import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { catalogueResponses } from '../fixtures.js';

async function installFixtures(page: Page) {
  const responses = catalogueResponses();
  const requests: string[] = [];
  const externalMetadata: string[] = [];
  await page.route('https://fakestoreapi.com/**', async (route) => {
    if (route.request().resourceType() !== 'image') {
      externalMetadata.push(route.request().url());
      return route.abort();
    }
    await route.fulfill({ contentType: 'image/png', body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYZkAAAAASUVORK5CYII=', 'base64',
    ) });
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = `${url.pathname}${url.search}`;
    requests.push(path);
    if (!responses.has(path)) {
      await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Not found', details: null } } });
      return;
    }
    await route.fulfill({ json: responses.get(path) });
  });
  return { requests, externalMetadata };
}

async function expectAccessibleLayout(page: Page) {
  expect(await page.locator('.catalogue-app').evaluate((app) => getComputedStyle(app).backgroundColor)).toBe('rgb(245, 247, 246)');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

test('fixture catalogue: ordering, categories, explicit search, keyboard, back and refresh', async ({ page }, testInfo) => {
  const { requests, externalMetadata } = await installFixtures(page);
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
  await expect(products).toHaveCount(3);
  await page.getByRole('searchbox').fill('telescope');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'No matching products' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('cotton');
  await page.reload();
  await expect(products).toHaveCount(3);
  await expectAccessibleLayout(page);
  expect(externalMetadata).toEqual([]);
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
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toBeFocused();
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
  await page.goto('/products/0');
  await expect(page.getByRole('heading', { name: 'Invalid address' })).toBeVisible();
  await expectAccessibleLayout(page);
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await page.goto('/products/3');
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await page.getByRole('textbox', { name: /^Name/ }).fill('Alex Example');
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