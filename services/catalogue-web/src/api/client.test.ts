import { describe, expect, it, vi } from 'vitest';
import { catalogueFixture, enquiry, product } from '../../../../tests/fixtures.js';
import { ApiError, createApiClient } from './client.js';

function setup(body: unknown = { products: [] }, status = 200, headers: HeadersInit = {}) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status, headers }));
  return { fetcher, client: createApiClient(fetcher) };
}

describe('same-origin API boundary', () => {
  it('validates featured products without sorting the server response', async () => {
    const products = catalogueFixture().slice(0, 5);
    const { client, fetcher } = setup({ products });
    const signal = new AbortController().signal;
    expect(await client.getFeatured(signal)).toEqual({ products });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/products/featured', expect.objectContaining({
      signal, credentials: 'same-origin', redirect: 'error', cache: 'default',
    }));
  });

  it('uses the categories endpoint, encodes query values, and validates product IDs', async () => {
    const { client, fetcher } = setup({ categories: ["men's clothing"] });
    expect(await client.getCategories()).toEqual({ categories: ["men's clothing"] });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/categories');
    fetcher.mockResolvedValueOnce(Response.json({ products: [], featuredIds: [] }));
    await client.list({ category: "men's clothing", q: '  cotton & wool  ' });
    const path = String(fetcher.mock.calls[1]?.[0]);
    expect(path.startsWith('/api/products?')).toBe(true);
    const query = new URL(path, 'http://localhost').searchParams;
    expect(query.get('category')).toBe("men's clothing");
    expect(query.get('q')).toBe('cotton & wool');
    fetcher.mockResolvedValueOnce(Response.json({ product: product({ id: 3 }) }));
    expect((await client.getProduct('3')).product.id).toBe(3);
    expect(fetcher.mock.calls[2]?.[0]).toBe('/api/products/3');
  });

  it('supports empty browse without a query string', async () => {
    const { client, fetcher } = setup({ products: [], featuredIds: [] });
    await client.list({});
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/products');
  });

  it.each([
    { page: 2, pageSize: 8, pageCount: 1, total: 1 },
    { page: 1, pageSize: 8, pageCount: 2, total: 1 },
    { page: 1, pageSize: 8, pageCount: 1, total: 0 },
  ])('rejects contradictory pagination metadata: %j', async (pagination) => {
    const { client } = setup({ products: [product()], featuredIds: [], pagination });
    await expect(client.list({ page: '1' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each(['0', '-1', '01', '1e2', '9007199254740992', 'unknown'])('rejects invalid ID %s before IO', async (id) => {
    const { client, fetcher } = setup();
    await expect(client.getProduct(id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates outgoing queries and enquiries with the shared schemas', async () => {
    const { client, fetcher } = setup();
    await expect(client.list({ q: 'x'.repeat(201) })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(client.sendEnquiry(enquiry({ email: 'invalid' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('posts trimmed JSON and requires a validated sent response', async () => {
    const { client, fetcher } = setup({ status: 'sent' });
    const signal = new AbortController().signal;
    expect(await client.sendEnquiry(enquiry({ name: '  Alex Example  ' }), signal)).toEqual({ status: 'sent' });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/enquiries', expect.objectContaining({
      method: 'POST', signal, body: JSON.stringify(enquiry()),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }));
  });

  it.each([202, 503])('does not thank the user for sent-looking JSON with HTTP %s', async (status) => {
    const { client } = setup({ status: 'sent' }, status);
    await expect(client.sendEnquiry(enquiry())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    { status: 'queued' }, { status: true }, {}, null,
  ])('rejects an invalid success body %j', async (body) => {
    await expect(setup(body).client.sendEnquiry(enquiry())).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects HTML, malformed JSON, unvalidated images and the wrong featured count', async () => {
    const { client, fetcher } = setup();
    fetcher.mockResolvedValueOnce(new Response('<html>proxy failure</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(client.getCategories()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetcher.mockResolvedValueOnce(new Response('{bad', { headers: { 'Content-Type': 'application/json' } }));
    await expect(client.getCategories()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetcher.mockResolvedValueOnce(Response.json({ product: product({ image: 'https://other.example.test/image.jpg' }) }));
    await expect(client.getProduct('1')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetcher.mockResolvedValueOnce(Response.json({ products: [product()] }));
    await expect(client.getFeatured()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('preserves safe error codes and field names, never server text or submitted values', async () => {
    const { client } = setup({ error: {
      code: 'VALIDATION_ERROR', message: 'private server detail', details: { email: ['private submitted value'] },
    } }, 422);
    await expect(client.sendEnquiry(enquiry())).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', status: 422, fields: ['email'],
    });
    await expect(client.sendEnquiry(enquiry())).rejects.not.toThrow(/private/);
  });

  it.each([
    ['61', 61], ['-1', null], ['Infinity', null], ['999999999', null], ['not seconds', null], ['', null],
  ])('bounds the Retry-After header %s', async (header, expected) => {
    const { client } = setup({ error: { code: 'RATE_LIMITED', message: 'ignored', details: null } }, 429, { 'Retry-After': header });
    await expect(client.sendEnquiry(enquiry())).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: expected });
  });

  it('normalizes network errors but preserves cancelled requests', async () => {
    const { client, fetcher } = setup();
    fetcher.mockRejectedValueOnce(new TypeError('private network detail'));
    await expect(client.getCategories()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const controller = new AbortController();
    controller.abort();
    fetcher.mockRejectedValueOnce(controller.signal.reason);
    await expect(client.getCategories(controller.signal)).rejects.toBe(controller.signal.reason);
    expect(new ApiError('NOT_FOUND').message).toBe('This page or product could not be found.');
  });
});