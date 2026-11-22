import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueFixture, fixturePhotoBase64, product } from '../../../../tests/fixtures.js';
import { readConfig } from '../config.js';
import { FakeStoreProductSource } from './fake-store-source.js';

function setup(response = Response.json(catalogueFixture())) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  const controller = new AbortController();
  const timeoutSignal = vi.fn<(milliseconds: number) => AbortSignal>().mockReturnValue(controller.signal);
  const now = vi.fn(() => 0);
  const source = new FakeStoreProductSource(readConfig({}), { fetch, timeoutSignal, now });
  return { source, fetch, timeoutSignal, controller, now };
}

afterEach(() => vi.unstubAllGlobals());

describe('FakeStore product source', () => {
  it.each([
    ['image/png', Buffer.from(fixturePhotoBase64, 'base64')],
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ] as const)('reads a bounded %s photo with the same deadline and redirect policy', async (contentType, bytes) => {
    const { source, fetch, controller } = setup(new Response(Uint8Array.from(bytes), { headers: { 'Content-Type': contentType } }));
    await expect(source.getPhoto(product().image)).resolves.toEqual({ contentType, bytes });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(product().image, expect.objectContaining({ redirect: 'error', signal: controller.signal }));
  });

  it('rejects an unapproved photo URL before making a request', async () => {
    const { source, fetch } = setup();
    await expect(source.getPhoto('https://example.test/img/jacket.png')).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['image/svg+xml', 'not a supported photo'], ['text/html', 'supplier message'],
    ['image/png', 'wrong signature'], ['image/jpeg', new Uint8Array(4 * 1024 * 1024 + 1)],
  ] as const)('rejects invalid or oversized photo bodies for %s', async (contentType, body) => {
    const { source } = setup(new Response(body, { headers: { 'Content-Type': contentType } }));
    await expect(source.getPhoto(product().image)).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
  });

  it('fetches only the fixed products URL with a 5-second signal and forbidden redirects', async () => {
    const { source, fetch, timeoutSignal, controller } = setup();
    expect(await source.getProducts()).toEqual(catalogueFixture());
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://fakestoreapi.com/products', {
      method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal,
    });
    expect(timeoutSignal).toHaveBeenCalledExactlyOnceWith(5000);
  });

  it('uses native fetch and native timeout by default without performing IO in this test', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json(catalogueFixture()));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    await new FakeStoreProductSource(readConfig({})).getProducts();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  it('shares reads, caches only for thirty seconds and bypasses the snapshot for an enquiry', async () => {
    const { source, fetch, now } = setup();
    fetch.mockImplementation(async () => Response.json(catalogueFixture()));
    const [categoriesRead, featuredRead] = await Promise.all([source.getProducts(), source.getProducts()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(categoriesRead).toEqual(featuredRead);
    now.mockReturnValue(29999);
    await source.getProducts();
    expect(fetch).toHaveBeenCalledTimes(1);
    now.mockReturnValue(30000);
    await source.getProducts();
    expect(fetch).toHaveBeenCalledTimes(2);
    await source.getProducts('fresh');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('releases a failed shared read so a later request can recover', async () => {
    const { source, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error('offline'));
    const reads = await Promise.allSettled([source.getProducts(), source.getProducts()]);
    expect(reads).toMatchObject(Array.from({ length: 2 }, () => ({ status: 'rejected', reason: { code: 'UPSTREAM_ERROR' } })));
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(source.getProducts()).resolves.toEqual(catalogueFixture());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([301, 302, 401, 403, 429, 500, 503])('treats status %i as a source error', async (status) => {
    const { source } = setup(new Response('private provider body', { status }));
    await expect(source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', status: 502 });
    await expect(source.getProducts()).rejects.not.toThrow('private provider body');
  });

  it('rejects a response reported as already redirected', async () => {
    const response = Response.json(catalogueFixture());
    Object.defineProperty(response, 'redirected', { value: true });
    await expect(setup(response).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it.each([
    { status: 503, type: 'application/json', code: 'UPSTREAM_ERROR' },
    { status: 200, type: 'text/html', code: 'UPSTREAM_INVALID_DATA' },
  ])('releases the unread body for $status $type without masking $code', async ({ status, type, code }) => {
    const cancel = vi.fn().mockRejectedValue(new Error('synthetic transport cleanup failure'));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const { source } = setup(new Response(body, { status, headers: { 'Content-Type': type } }));
    await expect(source.getProducts()).rejects.toMatchObject({ code });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([null, {}, [], [{ id: 1 }], [product(), product()], [product({ price: -1 })]])(
    'rejects malformed or duplicate catalogue records: %j',
    async (body) => {
      await expect(setup(Response.json(body)).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
    },
  );

  it('rejects malformed JSON and non-JSON content types', async () => {
    const invalidJson = new Response('{ invalid', { headers: { 'Content-Type': 'application/json' } });
    await expect(setup(invalidJson).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
    const wrongType = new Response(JSON.stringify(catalogueFixture()), { headers: { 'Content-Type': 'text/html' } });
    await expect(setup(wrongType).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
    const noType = new Response(null);
    await expect(setup(noType).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
  });

  it('accepts a JSON content type with a charset', async () => {
    const response = new Response(JSON.stringify(catalogueFixture()), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    expect(await setup(response).source.getProducts()).toHaveLength(7);
  });

  it('enforces a 1 MiB decoded-body budget, even without a length header', async () => {
    const limit = 1024 * 1024;
    const body = JSON.stringify(catalogueFixture()).padEnd(limit);
    const response = (text: string) => new Response(text, { headers: { 'Content-Type': 'application/json' } });
    await expect(setup(response(body)).source.getProducts()).resolves.toEqual(catalogueFixture());
    await expect(setup(response(`${body} `)).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
  });

  it('rejects an absent JSON response body', async () => {
    const response = new Response(null, { headers: { 'Content-Type': 'application/json' } });
    await expect(setup(response).source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
  });

  it('maps connection and redirect failures to a safe source error', async () => {
    const { source, fetch } = setup();
    fetch.mockRejectedValue(new TypeError('private provider/network details'));
    await expect(source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    await expect(source.getProducts()).rejects.not.toThrow('private provider');
  });

  it('maps a deadline while fetching to a distinct timeout without a real clock or network', async () => {
    const { source, fetch, controller } = setup();
    fetch.mockImplementation(() => new Promise((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    }));
    const pending = source.getProducts();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', status: 504 });
    controller.abort(new DOMException('synthetic deadline', 'TimeoutError'));
    await assertion;
  });

  it('keeps the timeout active while consuming the response body', async () => {
    const { source, fetch, controller } = setup();
    const body = new ReadableStream<Uint8Array>({ pull(stream) {
      controller.abort(new DOMException('synthetic body deadline', 'TimeoutError'));
      stream.error(controller.signal.reason);
    } });
    fetch.mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    await expect(source.getProducts()).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
  });
});