import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { deferred, pageFixture, product, productsById } from '../../../../tests/fixtures.js';
import { productLinks, renderCatalogue } from '../../../../tests/web-harness.js';

beforeAll(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) { this.open = true; },
    close(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); },
  });
});
afterEach(() => localStorage.clear());

it('opens recent searches from the search control without submitting an empty query', async () => {
  localStorage.setItem('linden:recent-searches:v1', JSON.stringify(['cotton', 'jacket']));
  const { user, router, fetcher } = renderCatalogue('/category/electronics');
  await screen.findByRole('heading', { name: 'electronics', level: 1 });
  const input = screen.getByRole('searchbox');
  const requestCount = fetcher.mock.calls.length;
  await user.click(screen.getByRole('button', { name: 'Search' }));
  const history = await screen.findByRole('region', { name: 'Recent searches' });
  expect(within(history).getByRole('link', { name: 'cotton' })).toBeVisible();
  expect(input).toHaveFocus();
  expect(router.state.location.pathname).toBe('/category/electronics');
  expect(fetcher).toHaveBeenCalledTimes(requestCount);
  expect(screen.queryByRole('button', { name: 'Recent searches' })).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region', { name: 'Recent searches' })).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  await waitFor(() => expect(screen.getByRole('link', { name: 'cotton' })).toHaveFocus());
  await user.keyboard('{Escape}');
  await user.click(input);
  expect(screen.getByRole('region', { name: 'Recent searches' })).toBeVisible();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('link', { name: 'cotton' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('link', { name: 'jacket' })).toHaveFocus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  expect(input).toHaveFocus();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('region', { name: 'Recent searches' })).not.toBeInTheDocument();
  await user.click(input);
  await user.type(input, 'cotton{Enter}');
  await screen.findByRole('heading', { name: 'Search results', level: 1 });
  expect(router.state.location.search).toBe('?q=cotton');
  expect(screen.queryByRole('region', { name: 'Recent searches' })).not.toBeInTheDocument();
});

it('repairs an out-of-range deep link to the actual last page without losing the category or filters', async () => {
  const page = pageFixture(productsById([3]), [3]);
  const { router } = renderCatalogue('/category/electronics?minRating=4&page=999', {
    '/api/products?category=electronics&minRating=4&page=999': async () => Response.json(page),
    '/api/products?category=electronics&minRating=4&page=1': async () => Response.json(page),
  });
  await screen.findByRole('heading', { name: 'electronics', level: 1 });
  expect(router.state.location.pathname + router.state.location.search).toBe('/category/electronics?minRating=4');
});

it('pages by URL, marks the current page, changes sorting and resets to page one', async () => {
  const items = Array.from({ length: 49 }, (_, index) => product({ id: index + 1, title: `Item ${index + 1}` }));
  const { user, router, responses } = renderCatalogue('/search?page=4', {
    '/api/products?page=4': async () => Response.json(pageFixture(items, [], 4)),
  });
  responses.set('/api/products?page=5', pageFixture(items, [], 5));
  responses.set('/api/products?sort=price-desc&page=1', pageFixture([...items].reverse(), []));
  await screen.findByRole('navigation', { name: 'Result pages' });
  expect(screen.getByRole('link', { name: 'Page 4' })).toHaveAttribute('aria-current', 'page');
  await user.click(screen.getByRole('link', { name: 'Next page' }));
  expect(await screen.findByRole('link', { name: 'Item 33' })).toHaveAttribute('href', '/products/33');
  await user.click(screen.getByRole('link', { name: 'Previous page' }));
  expect(await screen.findByRole('link', { name: 'Item 25' })).toBeVisible();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'price-desc');
  expect(await screen.findByRole('link', { name: 'Item 49' })).toBeVisible();
  expect(router.state.location.search).toBe('?sort=price-desc');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), '');
  await waitFor(() => expect(productLinks()).toHaveLength(7));
});

it('does not let sorting replace an in-flight filter change with stale criteria', async () => {
  const pending = deferred<Response>();
  const result = pageFixture(productsById([2]), []);
  const { user, router, responses } = renderCatalogue('/search', { '/api/products?maxPrice=60&page=1': () => pending.promise });
  await screen.findByRole('heading', { name: 'All products', level: 1 });
  await user.type(screen.getByRole('spinbutton', { name: 'Maximum price' }), '60');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  const sort = screen.getByRole('combobox', { name: 'Sort by' });
  await user.selectOptions(sort, 'price-desc');
  expect(router.state.navigation.location?.search ?? router.state.location.search).toContain('maxPrice=60');
  await act(() => pending.resolve(Response.json(result)));
  await screen.findByRole('link', { name: /remove filter: maximum price/i });
  responses.set('/api/products?maxPrice=60&sort=price-desc&page=1', result);
  await user.selectOptions(sort, 'price-desc');
  await waitFor(() => expect(router.state.location.search).toBe('?maxPrice=60&sort=price-desc'));
});

it('validates a price range in the filter sheet, supports cancel, apply and clear', async () => {
  const { user, responses, router } = renderCatalogue('/category/electronics');
  await screen.findByRole('heading', { name: 'electronics', level: 1 });
  const openSheet = async () => {
    await user.click(screen.getByText(/^Filters(?: \(\d+\))?$/, { selector: 'button' }));
    return within(screen.getByRole('dialog', { name: 'Product filters' }));
  };
  await user.click((await openSheet()).getByRole('button', { name: 'Close filters' }));
  const sheet = await openSheet();
  const min = sheet.getByRole('spinbutton', { name: 'Minimum price' });
  const max = sheet.getByRole('spinbutton', { name: 'Maximum price' });
  await user.type(min, '70'); await user.type(max, '60');
  await user.click(sheet.getByRole('button', { name: 'Apply filters' }));
  expect(sheet.getByRole('alert')).toBeVisible(); expect(max).toHaveFocus();
  await user.type(min, '1');
  expect(sheet.getByRole('alert')).toBeVisible();
  await user.clear(min);
  expect(sheet.queryByRole('alert')).not.toBeInTheDocument();
  expect(max).not.toBeInvalid();
  expect(router.state.location.search).toBe('');
  await user.click(sheet.getByRole('checkbox', { name: 'Editorial picks only' }));
  responses.set('/api/products?category=electronics&maxPrice=60&featured=1&page=1', pageFixture(productsById([11]), [11]));
  await user.click(sheet.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(router.state.location.search).toBe('?maxPrice=60&featured=1'));
  await screen.findByRole('link', { name: 'Remove filter: Editorial picks only' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click((await openSheet()).getByRole('button', { name: 'Clear filters' }));
  expect(await screen.findByRole('heading', { name: 'All products' })).toBeVisible();
});

it('offers one link per applied filter, removing only that filter and resetting the page', async () => {
  const query = 'category=electronics&q=cotton&minPrice=0&maxPrice=60&minRating=4&featured=1&sort=price-desc&page=2';
  const items = Array.from({ length: 9 }, (_, index) => product({ id: index + 1 }));
  renderCatalogue(`/search?${query}`, { [`/api/products?${query}`]: async () => Response.json(pageFixture(items, [], 2)) });
  const applied = within(await screen.findByRole('list', { name: 'Applied filters' }));
  const facets = { category: /electronics/i, minPrice: /minimum price/i, maxPrice: /maximum price/i, minRating: /rating/i, featured: /editorial picks/i };
  for (const [key, name] of Object.entries(facets)) {
    const retained = new URLSearchParams(query);
    retained.delete(key); retained.delete('page');
    expect(applied.getByRole('link', { name })).toHaveAttribute('href', `/search?${retained}`);
  }
  expect(applied.getAllByRole('link')).toHaveLength(5);
});

it('opens the large photo on request and returns focus after closing', async () => {
  const { user } = renderCatalogue('/products/3');
  const zoom = await screen.findByRole('button', { name: 'Enlarge product photo' });
  await user.click(zoom);
  const view = within(screen.getByRole('dialog', { name: 'Cotton jacket' }));
  expect(view.getByRole('img', { name: 'Cotton jacket' })).toBeVisible();
  await user.click(view.getByRole('button', { name: 'Close photo' }));
  expect(zoom).toHaveFocus();
});

it('returns through history on a normal click but preserves modified link clicks', async () => {
  const { user } = renderCatalogue('/search?q=cotton');
  await user.click(await screen.findByRole('link', { name: 'Cotton jacket' }));
  const back = await screen.findByRole('link', { name: 'Back to results' });
  const previous = window.history.state;
  window.history.replaceState({ idx: 1 }, '');
  try {
    for (const options of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      let browserHandlesClick = false;
      document.addEventListener('click', (event) => { browserHandlesClick = !event.defaultPrevented; event.preventDefault(); }, { once: true });
      fireEvent.click(back, options);
      expect(browserHandlesClick).toBe(true);
    }
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Search results' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Cotton jacket' })).toHaveFocus());
  } finally { window.history.replaceState(previous, ''); }
});

it('focuses the results heading when the product is no longer in the returning list', async () => {
  const { user, responses, router } = renderCatalogue('/search?q=cotton');
  await user.click(await screen.findByRole('link', { name: 'Cotton jacket' }));
  await screen.findByRole('heading', { name: 'Cotton jacket', level: 1 });
  responses.set('/api/products?q=cotton&page=1', pageFixture([], []));
  await act(() => router.navigate(-1));
  expect(await screen.findByRole('heading', { name: 'No matching products' })).toBeVisible();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Search results', level: 1 })).toHaveFocus());
});

it.each(['//outside.example', '/search\\outside', 'x'.repeat(2049)])('never uses an unsafe product return target', async (browseFrom) => {
  const { router } = renderCatalogue();
  await screen.findByRole('heading', { name: 'Top rated' });
  await act(() => router.navigate('/products/3', { state: { browseFrom } }));
  expect(await screen.findByRole('link', { name: 'Back to results' })).toHaveAttribute('href', '/search');
});

it('loads only valid saved terms, handles other-tab changes and closes history with Escape', async () => {
  const key = 'linden:recent-searches:v1';
  localStorage.setItem(key, '{malformed');
  const { user } = renderCatalogue();
  await screen.findByRole('heading', { name: 'Top rated' });
  const field = screen.getByRole('searchbox');
  await user.click(field);
  expect(screen.getByText('No recent searches.')).toBeVisible();
  await user.keyboard('{Escape}{ArrowDown}{ArrowUp}');
  expect(field).toHaveFocus();
  localStorage.setItem(key, JSON.stringify([null, '  ', 'x'.repeat(201), ' cotton ', 'jacket']));
  fireEvent(window, new StorageEvent('storage', { key: 'unrelated' }));
  expect(screen.getByText('No recent searches.')).toBeVisible();
  fireEvent(window, new StorageEvent('storage', { key }));
  expect(screen.getByRole('link', { name: 'cotton' })).toBeVisible();
  await user.keyboard('{Escape}'); expect(field).toHaveFocus();
  await user.click(field); await user.click(screen.getByRole('button', { name: 'Close recent searches' }));
  await user.click(field); await user.click(screen.getByRole('link', { name: 'cotton' }));
  expect(await screen.findByRole('heading', { name: 'Search results' })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['cotton', 'jacket']);
  localStorage.clear(); fireEvent(window, new StorageEvent('storage', { key: null }));
  await user.click(screen.getByRole('searchbox')); expect(screen.getByText('No recent searches.')).toBeVisible();
});

it('keeps search usable with blocked storage, empty query or a fragment target', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  const { user, router } = renderCatalogue('/#main');
  const heading = await screen.findByRole('heading', { name: 'Top rated' });
  expect(heading).not.toHaveFocus();
  const input = screen.getByRole('searchbox');
  await user.type(input, 'cotton{Enter}'); await screen.findByRole('heading', { name: 'Search results' });
  await user.clear(screen.getByRole('searchbox')); await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByRole('region', { name: 'Recent searches' })).toBeVisible();
  expect(router.state.location.search).toBe('?q=cotton');
  await act(() => router.navigate('/category/electronics?category=bad'));
  expect(await screen.findByRole('heading', { name: 'Invalid address' })).toBeVisible();
});
