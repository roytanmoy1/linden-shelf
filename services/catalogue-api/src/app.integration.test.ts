import { gzipSync } from 'node:zlib';
import { errorResponseSchema, type ErrorCode, type Product } from '@linden-shelf/contracts';
import { MemoryStore } from 'express-rate-limit';
import request, { type Response as TestResponse } from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueFixture, deferred, enquiry } from '../../../tests/fixtures.js';
import { createApp } from './app.js';
import { CatalogueService } from './catalogue/catalogue-service.js';
import { readConfig } from './config.js';
import type { EnquiryMailer } from './enquiries/enquiry-mailer.js';
import { SmtpEnquiryMailer, type SmtpDelivery, type SmtpTransport } from './enquiries/smtp-mailer.js';
import { ApiError } from './http/errors.js';

const stores: MemoryStore[] = [];

function setup(mailer?: EnquiryMailer, trustIngressProxy = false) {
  const source = { getProducts: vi.fn<() => Promise<Product[]>>().mockResolvedValue(catalogueFixture()) };
  const send = vi.fn<EnquiryMailer['send']>().mockResolvedValue(undefined);
  const rateLimitStore = new MemoryStore();
  stores.push(rateLimitStore);
  const config = readConfig({});
  const app = createApp({
    catalogue: new CatalogueService(source, config.featuredProductIds), mailer: mailer ?? { send },
    allowedOrigins: config.allowedOrigins, rateLimitStore, trustIngressProxy,
  });
  return { app, source, send };
}

function expectError(response: TestResponse, status: number, code: ErrorCode) {
  expect(response.status).toBe(status);
  expect(errorResponseSchema.parse(response.body).error.code).toBe(code);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body.error).not.toHaveProperty('stack');
}

afterEach(() => {
  for (const store of stores) store.shutdown();
  stores.length = 0;
  vi.useRealTimers();
});

describe('HTTP catalogue boundary (local ephemeral HTTP, fake external dependencies)', () => {
  it('serves process health without source or mail IO', async () => {
    const { app, source, send } = setup();
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', services: { api: 'ready' } });
    expect(source.getProducts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(app.get('trust proxy')).toBe(false);
  });

  it('registers featured before the parameterized detail route', async () => {
    const { app, source } = setup();
    const response = await request(app).get('/api/products/featured');
    expect(response.status).toBe(200);
    expect(response.body.products.map((product: Product) => product.id)).toEqual([3, 5, 11, 18, 20]);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it('derives categories from the same catalogue source', async () => {
    const { app, source } = setup();
    const response = await request(app).get('/api/categories');
    expect(response.body).toEqual({ categories: ['electronics', 'jewelery', "men's clothing", "women's clothing"] });
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['', [1, 2, 3, 5, 11, 18, 20], [3, 5, 11, 18, 20]],
    ['?q=%20CoTToN%20', [1, 3, 20], [3, 20]],
    ['?q=cotton&category=men%27s%20clothing', [3, 1], [3]],
    ['?category=electronics&q=cotton', [], []],
    ['?q=%20%20&category=', [1, 2, 3, 5, 11, 18, 20], [3, 5, 11, 18, 20]],
  ])('returns the query contract for %s', async (query, expectedIds, featuredIds) => {
    const { app, source } = setup();
    const response = await request(app).get(`/api/products${query}`);
    expect(response.status).toBe(200);
    expect(response.body.products.map((product: Product) => product.id)).toEqual(expectedIds);
    expect(response.body.featuredIds).toEqual(featuredIds);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it.each(['q=one&q=two', 'category=electronics&category=jewelery', 'q[term]=cotton', 'q[]=cotton', 'unknown=value'])(
    'rejects duplicate, nonscalar or unknown queries: %s',
    async (query) => {
      const { app, source } = setup();
      expectError(await request(app).get(`/api/products?${query}`), 400, 'BAD_REQUEST');
      expect(source.getProducts).not.toHaveBeenCalled();
    },
  );

  it('enforces query bounds and distinguishes unknown categories', async () => {
    const { app } = setup();
    const oversized = await request(app).get('/api/products').query({ q: 'x'.repeat(201) });
    expectError(oversized, 422, 'VALIDATION_ERROR');
    expect(oversized.body.error.details).toEqual({ q: ['Invalid value.'] });
    expectError(await request(app).get('/api/products?category=unknown'), 404, 'NOT_FOUND');
  });

  it.each(['0', '-1', '1.5', '01', '1e2', '9007199254740992', 'invalid', '%E0%A4%A'])('rejects invalid detail ID %s', async (id) => {
    const { app, source } = setup();
    expectError(await request(app).get(`/api/products/${id}`), 400, 'BAD_REQUEST');
    expect(source.getProducts).not.toHaveBeenCalled();
  });

  it('returns a single product or a genuine not-found response', async () => {
    const { app } = setup();
    const found = await request(app).get('/api/products/3');
    expect(found.status).toBe(200);
    expect(found.body.product.id).toBe(3);
    expectError(await request(app).get('/api/products/999'), 404, 'NOT_FOUND');
  });

  it.each<ErrorCode>(['UPSTREAM_ERROR', 'UPSTREAM_INVALID_DATA', 'UPSTREAM_TIMEOUT'])('preserves source failure %s', async (code) => {
    const { app, source } = setup();
    const failure = new ApiError(code);
    source.getProducts.mockRejectedValue(failure);
    for (const path of ['/api/products/featured', '/api/categories', '/api/products', '/api/products/3']) {
      expectError(await request(app).get(path), failure.status, code);
    }
  });

  it('sanitizes unexpected failures and unknown routes', async () => {
    const { app, source } = setup();
    source.getProducts.mockRejectedValue(new Error('private upstream token and stack'));
    const response = await request(app).get('/api/products');
    expectError(response, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private');
    expectError(await request(app).get('/api/unknown'), 404, 'NOT_FOUND');
    expectError(await request(app).post('/api/products'), 404, 'NOT_FOUND');
  });
});

describe('HTTP enquiry boundary', () => {
  it('validates, resolves server product details, awaits mail and returns only sent status', async () => {
    const { app, source, send } = setup();
    const response = await request(app).post('/api/enquiries').send(enquiry({ name: '  Alex Example  ', message: '  Hello  ' }));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'sent' });
    expect(send).toHaveBeenCalledExactlyOnceWith(enquiry({ message: 'Hello' }), expect.objectContaining({ id: 3, title: 'Cotton jacket' }));
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it.each([
    {}, { name: '' }, { name: '\nAlex' }, { name: 'x'.repeat(101) },
    { email: 'invalid' }, { email: 'alex@example.test\r\nBcc: other@example.test' },
    { message: 'x'.repeat(2001) }, { productId: '3' }, { productId: 0 },
    { to: 'other@example.test' }, { title: 'Client selected title' },
  ])('rejects invalid or client-controlled fields without source/mail IO: %j', async (overrides) => {
    const { app, source, send } = setup();
    const body = Object.keys(overrides).length ? { ...enquiry(), ...overrides } : {};
    const response = await request(app).post('/api/enquiries').send(body);
    expectError(response, 422, 'VALIDATION_ERROR');
    expect(source.getProducts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain('other@example.test');
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'application/xml'])('rejects content type %s', async (contentType) => {
    const { app, send } = setup();
    const response = await request(app).post('/api/enquiries').set('Content-Type', contentType).send(JSON.stringify(enquiry()));
    expectError(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects missing content type, compressed input and unsupported character sets', async () => {
    const { app, send } = setup();
    expectError(await request(app).post('/api/enquiries'), 415, 'UNSUPPORTED_MEDIA_TYPE');
    expectError(await request(app).post('/api/enquiries').set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip').send(gzipSync(JSON.stringify(enquiry()))), 415, 'UNSUPPORTED_MEDIA_TYPE');
    expectError(await request(app).post('/api/enquiries').set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(JSON.stringify(enquiry())), 415, 'UNSUPPORTED_MEDIA_TYPE');
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['{ invalid private input', 'null', 'true', '123', '"text"'])('rejects malformed or primitive JSON: %s', async (body) => {
    const { app, send } = setup();
    const response = await request(app).post('/api/enquiries').set('Content-Type', 'application/json').send(body);
    expectError(response, 400, 'BAD_REQUEST');
    expect(JSON.stringify(response.body)).not.toContain('private input');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects oversized JSON before validation and sending', async () => {
    const { app, source, send } = setup();
    expectError(await request(app).post('/api/enquiries').send(enquiry({ message: 'x'.repeat(17000) })), 413, 'PAYLOAD_TOO_LARGE');
    expect(source.getProducts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send for absent products or source outages', async () => {
    const { app, source, send } = setup();
    expectError(await request(app).post('/api/enquiries').send(enquiry({ productId: 999 })), 404, 'NOT_FOUND');
    for (const code of ['UPSTREAM_ERROR', 'UPSTREAM_TIMEOUT'] as const) {
      const failure = new ApiError(code);
      source.getProducts.mockRejectedValue(failure);
      expectError(await request(app).post('/api/enquiries').send(enquiry()), failure.status, code);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it.each<SmtpDelivery>([
    { accepted: [], rejected: ['sales@lindenshelf.test'] },
    { accepted: ['other@example.test'], rejected: [] },
  ])('does not return sent when SMTP resolves without recipient acceptance', async (delivery) => {
    const sendMail = vi.fn<SmtpTransport['sendMail']>().mockResolvedValue(delivery);
    const { app } = setup(new SmtpEnquiryMailer({ sendMail }, readConfig({})));
    const response = await request(app).post('/api/enquiries').send(enquiry());
    expectError(response, 503, 'MAIL_UNAVAILABLE');
    expect(response.body).not.toHaveProperty('status');
  });

  it('waits for pending SMTP acceptance before resolving the HTTP request', async () => {
    const delivery = deferred<SmtpDelivery>();
    const entered = deferred<void>();
    const sendMail = vi.fn<SmtpTransport['sendMail']>().mockImplementation(() => {
      entered.resolve(undefined);
      return delivery.promise;
    });
    const { app } = setup(new SmtpEnquiryMailer({ sendMail }, readConfig({})));
    let completed = false;
    const responsePromise = request(app).post('/api/enquiries').send(enquiry()).then((response) => {
      completed = true;
      return response;
    });
    await entered.promise;
    expect(completed).toBe(false);
    delivery.resolve({ accepted: ['sales@lindenshelf.test'], rejected: [] });
    expect((await responsePromise).body).toEqual({ status: 'sent' });
  });

  it('returns safe failure when SMTP later rejects, not a premature success', async () => {
    const delivery = deferred<SmtpDelivery>();
    const entered = deferred<void>();
    const sendMail = vi.fn<SmtpTransport['sendMail']>().mockImplementation(() => {
      entered.resolve(undefined);
      return delivery.promise;
    });
    const { app } = setup(new SmtpEnquiryMailer({ sendMail }, readConfig({})));
    const responsePromise = request(app).post('/api/enquiries').send(enquiry()).then((response) => response);
    await entered.promise;
    delivery.reject(new Error('private SMTP failure'));
    const response = await responsePromise;
    expectError(response, 503, 'MAIL_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('private SMTP');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe('HTTP origin and attempt limits', () => {
  it.each(['http://localhost:3000', 'http://localhost:5173'])('allows only the explicitly configured origin %s', async (origin) => {
    const { app } = setup();
    const response = await request(app).get('/api/products/featured').set('Origin', origin);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  it.each(['https://evil.example.test', 'null', 'http://localhost:3000.attacker.test'])('blocks origin %s without IO', async (origin) => {
    const { app, source, send } = setup();
    const response = await request(app).post('/api/enquiries').set('Origin', origin).send(enquiry());
    expectError(response, 403, 'ORIGIN_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(source.getProducts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('supports an allowed JSON preflight without sending or consuming an attempt', async () => {
    const { app, source, send } = setup();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app).options('/api/enquiries').set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Content-Type');
      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBe('POST');
      expect(response.headers['access-control-allow-headers']).toBe('Content-Type');
    }
    expect((await request(app).post('/api/enquiries').send(enquiry())).status).toBe(200);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('counts invalid attempts, ignores spoofed forwarding, and resets after ten minutes with an isolated clock/store', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.UTC(2026, 0, 1);
    vi.setSystemTime(start);
    const { app, source, send } = setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expectError(await request(app).post('/api/enquiries').set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
        .set('Forwarded', `for=192.0.2.${attempt + 1}`).send({}), 422, 'VALIDATION_ERROR');
    }
    const blocked = await request(app).post('/api/enquiries').set('X-Forwarded-For', '198.51.100.1').send(enquiry());
    expectError(blocked, 429, 'RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBe('600');
    expect(blocked.headers.ratelimit).toBeDefined();
    expect(source.getProducts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    vi.setSystemTime(start + 600001);
    expect((await request(app).post('/api/enquiries').send(enquiry())).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('isolates clients behind the opted-in single ingress and ignores additional forwarded hops', async () => {
    const { app, send } = setup(undefined, true);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expectError(await request(app).post('/api/enquiries')
        .set('X-Forwarded-For', `198.51.100.${attempt + 1}, 192.0.2.1`)
        .set('Forwarded', `for=198.51.100.${attempt + 1}`).send({}), 422, 'VALIDATION_ERROR');
    }
    const blocked = await request(app).post('/api/enquiries')
      .set('X-Forwarded-For', '203.0.113.1, 192.0.2.1').send(enquiry());
    expectError(blocked, 429, 'RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
    const otherClient = await request(app).post('/api/enquiries')
      .set('X-Forwarded-For', '192.0.2.2').send(enquiry());
    expect(otherClient.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(app.get('trust proxy')).toBe(1);
  });

  it('counts forbidden-origin POST attempts and keeps limits isolated between apps', async () => {
    const { app } = setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expectError(await request(app).post('/api/enquiries').set('Origin', 'https://evil.example.test').send(enquiry()), 403, 'ORIGIN_NOT_ALLOWED');
    }
    expectError(await request(app).post('/api/enquiries').send(enquiry()), 429, 'RATE_LIMITED');
    expect((await request(setup().app).post('/api/enquiries').send(enquiry())).status).toBe(200);
  });
});