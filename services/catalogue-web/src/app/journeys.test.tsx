import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { ENQUIRY_BOUNDS } from '@linden-shelf/contracts';
import { describe, expect, it, vi } from 'vitest';
import { deferred, productsById } from '../../../../tests/fixtures.js';
import { productLinks, renderCatalogue as setup } from '../../../../tests/web-harness.js';
import '../product/enquiry.js';

async function openEnquiry(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Enquire' }));
  return screen.findByRole('form', { name: 'Contact sales' }, { timeout: 10000 });
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /^Name/ }), '  Alex Example  ');
  await user.type(screen.getByRole('textbox', { name: /^Email/ }), 'alex@example.test');
}

describe('catalogue journeys with fake HTTP only', () => {
  it('applies price and rating facets to the URL and restores them on Back', async () => {
    const { user, responses, router } = setup('/search');
    await screen.findByRole('heading', { name: 'All products' });
    responses.set('/api/products?maxPrice=60&minRating=4&page=1', { products: productsById([2]), featuredIds: [],
      pagination: { page: 1, pageSize: 8, pageCount: 1, total: 1 } });
    await user.type(screen.getByRole('spinbutton', { name: /Maximum price/ }), '60');
    await user.selectOptions(screen.getByRole('combobox', { name: /Minimum rating/ }), '4');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(productLinks()).toHaveLength(1));
    expect(router.state.location.search).toBe('?maxPrice=60&minRating=4');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(productLinks()).toHaveLength(7));
    await act(() => router.navigate(-1));
    expect(await screen.findByRole('spinbutton', { name: /Maximum price/ })).toHaveValue(60);
  });

  it('remembers submitted searches but not drafts and lets the customer clear them', async () => {
    localStorage.clear();
    const { user } = setup();
    const field = await screen.findByRole('searchbox');
    await user.type(field, '  cotton  {Enter}');
    await screen.findByRole('heading', { name: 'Search results' });
    await user.click(screen.getByRole('searchbox'));
    const recent = screen.getByRole('region', { name: 'Recent searches' });
    expect(within(recent).getByRole('link', { name: 'cotton' })).toHaveAttribute('href', '/search?q=cotton');
    await user.click(within(recent).getByRole('button', { name: 'Clear history' }));
    expect(localStorage.length).toBe(0);
  });

  it('keeps the current screen until the next navigation commits', async () => {
    const pending = deferred<Response>();
    const { user } = setup('/', { '/api/products?category=electronics&page=1': () => pending.promise });
    await screen.findByRole('heading', { name: 'Top rated' });
    await user.click(screen.getByRole('link', { name: 'electronics' }));
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(productLinks()).toHaveLength(5);
    await act(() => pending.resolve(Response.json({ products: productsById([11]), featuredIds: [11], pagination: { page: 1, pageSize: 8, pageCount: 1, total: 1 } })));
    expect(await screen.findByRole('heading', { level: 1, name: 'electronics' })).toHaveFocus();
  });

  it('renders exactly five semantic product links in server order and real category navigation', async () => {
    setup();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Linden Shelf' })).toHaveAttribute('href', '/');
    await screen.findByRole('heading', { name: 'Top rated' });
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Linden Shelf' })).toBeVisible();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Linden Shelf');
    await waitFor(() => expect(document.title).toBe('Top rated | Linden Shelf'));
    expect(productLinks().map((link) => link.getAttribute('href'))).toEqual(['/products/3', '/products/5', '/products/11', '/products/18', '/products/20']);
    expect(productLinks()[0]).toHaveAccessibleDescription(/^USD\s49\.50 2\.0 out of 5 from 10 reviews$/);
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    expect(within(nav).getAllByRole('link')).toHaveLength(6);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getAllByText('USD 49.50')).toHaveLength(5);
  });

  it('shows the server featured subset then remaining category products once each', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('link', { name: "men's clothing" }));
    await screen.findByRole('heading', { name: "men's clothing", level: 1 });
    expect(productLinks().map((link) => link.getAttribute('href'))).toEqual(['/products/3', '/products/1', '/products/2']);
    expect(within(screen.getByRole('region', { name: 'Featured' })).getByRole('link', { name: /Cotton jacket/ })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'More in this category' })).getAllByRole('link')).toHaveLength(2);
  });

  it('supports empty featured/remainder states without duplicating products', async () => {
    const { router, responses } = setup('/category/electronics');
    await screen.findByRole('heading', { name: 'electronics', level: 1 });
    expect(screen.getByText('No more products in this category.')).toBeVisible();
    responses.set('/api/products?category=electronics&page=1', { products: [], featuredIds: [], pagination: { page: 1, pageSize: 8, pageCount: 1, total: 0 } });
    await act(() => router.revalidate());
    expect(await screen.findByRole('heading', { name: 'No matching products' })).toBeVisible();
  });

  it('sends no search requests while typing, submits via button/Enter, and restores URL state on back', async () => {
    const { user, fetcher, router } = setup();
    const input = await screen.findByRole('searchbox', { name: 'Search products' });
    const callsBeforeTyping = fetcher.mock.calls.length;
    await user.type(input, 'cotton');
    expect(fetcher).toHaveBeenCalledTimes(callsBeforeTyping);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('heading', { name: 'Search results' });
    expect(router.state.location.search).toBe('?q=cotton');
    expect(productLinks().map((link) => link.getAttribute('href'))).toEqual(['/products/1', '/products/3', '/products/20']);
    expect(screen.getAllByText('Selected').map((badge) => within(badge.closest('li')!).getByRole('link').getAttribute('href')))
      .toEqual(['/products/3', '/products/20']);
    const query = screen.getByRole('searchbox', { name: 'Search products' });
    await user.clear(query);
    await user.type(query, 'telescope{Enter}');
    expect(await screen.findByText('No matching products')).toBeVisible();
    await act(() => router.navigate(-1));
    expect(await screen.findByRole('searchbox', { name: 'Search products' })).toHaveValue('cotton');
    await waitFor(() => expect(productLinks()).toHaveLength(3));
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/categories')).toHaveLength(1);
  });

  it('supports a fresh search deep link and empty trimmed browse', async () => {
    const { router } = setup('/search?q=cotton');
    expect(await screen.findByRole('searchbox')).toHaveValue('cotton');
    await waitFor(() => expect(productLinks()).toHaveLength(3));
    await act(() => router.navigate('/search?q=%20%20'));
    await waitFor(() => expect(productLinks()).toHaveLength(7));
    expect(screen.getByRole('heading', { name: 'All products' })).toBeVisible();
  });

  it.each(['/products/0', '/search?q=one&q=two', `/search?q=${'x'.repeat(201)}`, '/search?unknown=yes'])(
    'shows an invalid address for %s without requesting invalid data', async (path) => {
      const { fetcher } = setup(path);
      expect(await screen.findByRole('heading', { name: 'Invalid address' })).toBeVisible();
      expect(fetcher.mock.calls.every(([url]) => url === '/api/categories')).toBe(true);
    },
  );

  it.each(['/products', '/products/999', '/missing', '/category/unknown'])(
    'shows a useful not-found page for %s', async (path) => {
      setup(path);
      expect(await screen.findByRole('heading', { name: 'Not found' })).toBeVisible();
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Back to top rated' })).toHaveAttribute('href', '/');
    },
  );

  it('shows loading, handles a source failure, and retries the same route', async () => {
    const pending = deferred<Response>();
    const override = vi.fn().mockReturnValueOnce(pending.promise)
      .mockResolvedValue(Response.json({ products: productsById([3, 5, 11, 18, 20]) }));
    const { user } = setup('/', { '/api/products/featured': override });
    expect(screen.getByRole('status')).toHaveTextContent('Loading catalogue');
    await act(() => pending.resolve(Response.json({ error: { code: 'UPSTREAM_TIMEOUT', message: 'private', details: null } }, { status: 504 })));
    expect(await screen.findByRole('alert')).toHaveTextContent('The catalogue took too long');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    const restored = await screen.findByRole('heading', { name: 'Top rated' });
    await waitFor(() => expect(document.title).toBe('Top rated | Linden Shelf'));
    expect(restored).toHaveFocus();
    expect(productLinks()).toHaveLength(5);
  });

  it('keeps content usable when categories fail and can retry the navigation', async () => {
    const categories = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'UPSTREAM_ERROR', message: 'ignored', details: null } }, { status: 502 }))
      .mockResolvedValue(Response.json({ categories: ['electronics'] }));
    const { user } = setup('/', { '/api/categories': categories });
    await screen.findByRole('heading', { name: 'Top rated' });
    await user.click(screen.getByRole('button', { name: 'Retry categories' }));
    await waitFor(() => expect(categories).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('link', { name: 'electronics' })).toBeVisible();
  });

  it('renders full product metadata and handles unavailable photography without removing the link', async () => {
    const { user } = setup();
    await screen.findByRole('heading', { name: 'Top rated' });
    const image = screen.getAllByRole('img')[0]!;
    expect(image.parentElement).toHaveClass('image-pending');
    fireEvent.load(image); expect(image.parentElement).not.toHaveClass('image-pending');
    fireEvent.error(image);
    expect(screen.getByText('Image unavailable')).toBeVisible();
    await user.click(productLinks()[0]!);
    expect(await screen.findByRole('heading', { name: 'Cotton jacket', level: 1 })).toBeVisible();
    expect(screen.getByText('A woven outdoor layer')).toBeVisible();
    expect(screen.getByText('2.0 / 5 (10 reviews)')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Cotton jacket' })).toHaveAttribute('src', '/api/products/3/photo');
    expect(screen.getByText('USD 49.50')).toBeVisible();
  });

  it('keeps the originating results link and exposes structured product details', async () => {
    const { user } = setup('/search?q=cotton');
    await user.click(await screen.findByRole('link', { name: /Cotton jacket/ }));
    await screen.findByRole('heading', { level: 1, name: 'Cotton jacket' });
    expect(screen.getByRole('link', { name: 'Back to results' })).toHaveAttribute('href', '/search?q=cotton');
    expect(screen.getByRole('heading', { name: 'About this item' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Product details' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enlarge product photo' })).toBeVisible();
  });

  it('shows a replacement photo after the previous URL failed for the same product', async () => {
    const { router, responses } = setup('/products/3');
    const original = await screen.findByRole('img', { name: 'Cotton jacket' });
    fireEvent.error(original);
    expect(screen.getByText('Image unavailable')).toBeVisible();
    const image = 'https://fakestoreapi.com/img/replacement.jpg';
    const [jacket] = productsById([3]);
    responses.set('/api/products/3', { product: { ...jacket, image } });
    await act(() => router.revalidate());
    expect(screen.getByRole('img', { name: 'Cotton jacket' })).toHaveAttribute('src', '/api/products/3/photo');
  });

  it('retries a failed detail photo without navigating or losing an enquiry draft', async () => {
    const { user, router } = setup('/products/3');
    const image = await screen.findByRole('img', { name: 'Cotton jacket' });
    await openEnquiry(user);
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Local Reviewer');
    fireEvent.error(image);
    await user.click(screen.getByRole('button', { name: 'Retry photo' }));
    const retried = screen.getByRole('img', { name: 'Cotton jacket' });
    expect(retried).not.toBe(image);
    expect(retried).toHaveAttribute('src', '/api/products/3/photo');
    expect(screen.getByRole('button', { name: 'Enlarge product photo' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Local Reviewer');
    expect(router.state.location.pathname).toBe('/products/3');
  });
});

describe('inline enquiry journey', () => {
  it('reveals a labelled form, focuses name, shares bounds and restores focus on cancel', async () => {
    const { user } = setup('/products/3');
    await screen.findByRole('heading', { name: 'Cotton jacket' });
    expect(screen.queryByRole('textbox', { name: /^Name/ })).not.toBeInTheDocument();
    await openEnquiry(user);
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('maxlength', String(ENQUIRY_BOUNDS.name));
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveAttribute('maxlength', String(ENQUIRY_BOUNDS.email));
    expect(screen.getByRole('textbox', { name: 'Message (optional)' })).toHaveAttribute('maxlength', String(ENQUIRY_BOUNDS.message));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enquire' })).toHaveFocus();
  });

  it('validates required fields and optional message bounds before IO with associated errors', async () => {
    const { user, fetcher } = setup('/products/3');
    await openEnquiry(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveAccessibleDescription('Enter a valid email address.');
    await fillContact(user);
    fireEvent.change(screen.getByRole('textbox', { name: 'Message (optional)' }), { target: { value: 'x'.repeat(ENQUIRY_BOUNDS.message + 1) } });
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(screen.getByRole('textbox', { name: 'Message (optional)' })).toHaveAttribute('aria-invalid', 'true');
    expect(fetcher.mock.calls.some(([path]) => path === '/api/enquiries')).toBe(false);
  });

  it('disables concurrent submissions and thanks only after confirmed API success', async () => {
    const pending = deferred<Response>();
    const send = vi.fn().mockReturnValue(pending.promise);
    const { user, fetcher } = setup('/products/3', { '/api/enquiries': send });
    const form = await openEnquiry(user);
    await fillContact(user);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
    await act(() => pending.resolve(Response.json({ status: 'sent' })));
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Your enquiry has been sent to our sales team.');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    const options = fetcher.mock.calls.find(([path]) => path === '/api/enquiries')?.[1];
    expect(JSON.parse(String(options?.body))).toEqual({ productId: 3, name: 'Alex Example', email: 'alex@example.test', message: '' });
  });

  it.each([
    () => Response.json({ error: { code: 'MAIL_UNAVAILABLE', message: 'private SMTP credentials', details: null } }, { status: 503 }),
    () => Response.json({ status: 'queued' }),
    () => new Response('<html>proxy failure</html>', { headers: { 'Content-Type': 'text/html' } }),
  ])('retains entered values and never thanks on failed or invalid responses', async (failure) => {
    const send = vi.fn().mockImplementationOnce(async () => failure()).mockImplementation(async () => Response.json({ status: 'sent' }));
    const { user } = setup('/products/3', { '/api/enquiries': send });
    await openEnquiry(user);
    await fillContact(user);
    await user.type(screen.getByRole('textbox', { name: 'Message (optional)' }), 'Is this available?');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('private');
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('  Alex Example  ');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveValue('alex@example.test');
    expect(screen.getByRole('textbox', { name: 'Message (optional)' })).toHaveValue('Is this available?');
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeVisible();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('associates server field errors without echoing raw server text', async () => {
    const { user } = setup('/products/3', { '/api/enquiries': async () => Response.json({ error: {
      code: 'VALIDATION_ERROR', message: 'private', details: { email: ['private submitted value'] },
    } }, { status: 422 }) });
    await openEnquiry(user);
    await fillContact(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    await screen.findByText('Check the highlighted fields and try again.');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveFocus();
    expect(screen.queryByText(/private/)).not.toBeInTheDocument();
  });

  it.each([['61', /about 2 minutes/], ['', /Please wait/]])('renders safe Retry-After guidance for %s', async (header, expected) => {
    const { user } = setup('/products/3', { '/api/enquiries': async () => Response.json({ error: {
      code: 'RATE_LIMITED', message: 'ignored', details: null,
    } }, { status: 429, headers: { 'Retry-After': header } }) });
    await openEnquiry(user);
    await fillContact(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });

  it('resets contact state on product navigation without browser storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { user, router } = setup('/products/3');
    await openEnquiry(user);
    await fillContact(user);
    await act(() => router.navigate('/products/5'));
    await screen.findByRole('heading', { name: 'Silver bracelet' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    await openEnquiry(user);
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveValue('');
    expect(storage).not.toHaveBeenCalled();
  });

  it('aborts a pending client request on navigation and never shows stale confirmation', async () => {
    const pending = deferred<Response>();
    const { user, router, fetcher } = setup('/products/3', { '/api/enquiries': () => pending.promise });
    await openEnquiry(user);
    await fillContact(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));
    const signal = fetcher.mock.calls.find(([path]) => path === '/api/enquiries')?.[1]?.signal;
    await act(() => router.navigate('/products/5'));
    expect(signal?.aborted).toBe(true);
    await act(() => pending.resolve(Response.json({ status: 'sent' })));
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Silver bracelet' })).toBeVisible();
  });
});