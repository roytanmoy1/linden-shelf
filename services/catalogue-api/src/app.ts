import { ENQUIRY_BOUNDS, enquirySchema, isJsonContentType, productIdParamSchema } from '@linden-shelf/contracts';
import express, { type Response } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import type { CatalogueService } from './catalogue/catalogue-service.js';
import type { EnquiryMailer } from './enquiries/enquiry-mailer.js';
import { ApiError, errorHandler } from './http/errors.js';

interface AppDependencies {
  catalogue: CatalogueService;
  mailer: EnquiryMailer;
  allowedOrigins: readonly string[];
  rateLimitStore?: Store;
  trustIngressProxy?: boolean;
}

function sendCatalogueRead(response: Response, body: unknown) {
  if (!response.req.originalUrl.includes('?')) response.set('Cache-Control', 'private, max-age=15, must-revalidate');
  response.json(body);
}

function productId(value: string) {
  const id = productIdParamSchema.safeParse(value);
  if (!id.success) throw new ApiError('BAD_REQUEST');
  return id.data;
}

export function createApp({ catalogue, mailer, allowedOrigins, rateLimitStore, trustIngressProxy = false }: AppDependencies) {
  const app = express();
  const enquiriesPath = '/api/enquiries';
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', trustIngressProxy ? 1 : false);
  app.set('query parser', 'simple');
  app.set('json escape', true);

  app.use((_request, response, next) => {
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Cache-Control', 'no-store');
    next();
  });

  app.post(enquiriesPath, rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_request, _response, next) => next(new ApiError('RATE_LIMITED')),
  }));

  app.use('/api', (request, response, next) => {
    response.vary('Origin');
    const origin = request.get('Origin');
    if (origin !== undefined) {
      if (!allowedOrigins.includes(origin)) return next(new ApiError('ORIGIN_NOT_ALLOWED'));
      response.set('Access-Control-Allow-Origin', origin);
    }
    next();
  });

  app.options(enquiriesPath, (_request, response) => {
    response.set('Access-Control-Allow-Methods', 'POST');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    response.status(204).end();
  });

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', services: { api: 'ready' } });
  });

  app.get('/api/products/featured', async (_request, response) => {
    sendCatalogueRead(response, { products: await catalogue.getFeatured() });
  });

  app.get('/api/categories', async (_request, response) => {
    sendCatalogueRead(response, { categories: await catalogue.getCategories() });
  });

  app.get('/api/products', async (request, response) => {
    response.json(await catalogue.list(request.query));
  });

  app.get('/api/products/:id', async (request, response) => {
    sendCatalogueRead(response, { product: await catalogue.getProduct(productId(request.params.id)) });
  });

  app.get('/api/products/:id/photo', async (request, response) => {
    const photo = await catalogue.getPhoto(productId(request.params.id));
    response.set('Content-Security-Policy', "default-src 'none'; sandbox");
    response.set('Cache-Control', 'private, max-age=15, must-revalidate');
    response.type(photo.contentType).send(photo.bytes);
  });

  app.post(enquiriesPath, (request, _response, next) => {
    if (!isJsonContentType(request.get('Content-Type'))) return next(new ApiError('UNSUPPORTED_MEDIA_TYPE'));
    next();
  }, express.json({ limit: ENQUIRY_BOUNDS.bodyBytes, strict: true, inflate: false }), async (request, response) => {
    const enquiry = enquirySchema.parse(request.body);
    const product = await catalogue.getProduct(enquiry.productId, 'fresh');
    await mailer.send(enquiry, product);
    response.json({ status: 'sent' });
  });

  app.use((_request, _response, next) => next(new ApiError('NOT_FOUND')));
  app.use(errorHandler);
  return app;
}