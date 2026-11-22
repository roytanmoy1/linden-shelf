import { catalogueSchema, isJsonContentType, productSchema, type Product } from '@linden-shelf/contracts';
import type { Config } from '../config.js';
import { ApiError } from '../http/errors.js';
import type { ProductSource } from './product-source.js';

const MAX_CATALOGUE_BYTES = 1024 * 1024;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const SNAPSHOT_MS = 30000;
const photoSignatures = new Map<string, (bytes: Buffer) => boolean>([
  ['image/jpeg', (bytes) => bytes.subarray(0, 3).toString('hex') === 'ffd8ff'],
  ['image/png', (bytes) => bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'],
  ['image/webp', (bytes) => bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP'],
]);
const photoAccept = [...photoSignatures.keys()].join(', ');

function boundedBody(response: Response, validType: boolean, limit: number): Response {
  const available = response.ok && !response.redirected;
  if (!available || !validType) {
    void response.body?.cancel().catch(() => undefined);
    throw new ApiError(available ? 'UPSTREAM_INVALID_DATA' : 'UPSTREAM_ERROR');
  }
  if (!response.body) throw new ApiError('UPSTREAM_INVALID_DATA');
  let bytes = 0;
  const bounded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) throw new ApiError('UPSTREAM_INVALID_DATA');
      controller.enqueue(chunk);
    },
  }));
  return new Response(bounded);
}

interface SourceDependencies {
  fetch?: typeof globalThis.fetch;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
  now?: () => number;
}

export class FakeStoreProductSource implements ProductSource {
  private readonly productsUrl: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutSignal: (milliseconds: number) => AbortSignal;
  private inFlight: Promise<Product[]> | undefined;
  private snapshot: { products: Product[]; until: number } | undefined;
  private readonly now: () => number;

  constructor(
    private readonly config: Pick<Config, 'productApiBaseUrl' | 'productTimeoutMs'>,
    dependencies: SourceDependencies = {},
  ) {
    this.productsUrl = new URL('/products', config.productApiBaseUrl).href;
    this.fetch = dependencies.fetch ?? globalThis.fetch;
    this.now = dependencies.now ?? (() => performance.now());
    this.timeoutSignal = dependencies.timeoutSignal ?? ((milliseconds) => AbortSignal.timeout(milliseconds));
  }

  getProducts(mode?: 'fresh'): Promise<Product[]> {
    if (mode !== 'fresh' && this.snapshot && this.now() < this.snapshot.until) return Promise.resolve(this.snapshot.products);
    this.snapshot = undefined;
    this.inFlight ??= this.fetchProducts().then((products) => {
      this.snapshot = { products, until: this.now() + SNAPSHOT_MS };
      return products;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  private fetchProducts(): Promise<Product[]> {
    return this.read(this.productsUrl, 'application/json', async (response) => {
      const body = await boundedBody(response, isJsonContentType(response.headers.get('content-type')), MAX_CATALOGUE_BYTES).json();
      const parsed = catalogueSchema.safeParse(body);
      if (!parsed.success) throw new ApiError('UPSTREAM_INVALID_DATA');
      return parsed.data;
    });
  }

  async getPhoto(url: string) {
    if (!productSchema.shape.image.safeParse(url).success) throw new ApiError('UPSTREAM_INVALID_DATA');
    return this.read(url, photoAccept, async (response) => {
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
      const matches = photoSignatures.get(contentType);
      const body = boundedBody(response, !!matches, MAX_PHOTO_BYTES);
      const bytes = Buffer.from(await body.arrayBuffer());
      if (!matches?.(bytes)) throw new ApiError('UPSTREAM_INVALID_DATA');
      return { bytes, contentType };
    });
  }

  private async read<Value>(url: string, accept: string, decode: (response: Response) => Promise<Value>): Promise<Value> {
    const signal = this.timeoutSignal(this.config.productTimeoutMs);
    try {
      const response = await this.fetch(url, {
        method: 'GET', headers: { Accept: accept }, redirect: 'error', signal,
      });
      return await decode(response);
    } catch (error) {
      if (signal.aborted) throw new ApiError('UPSTREAM_TIMEOUT');
      if (error instanceof ApiError) throw error;
      if (error instanceof SyntaxError) throw new ApiError('UPSTREAM_INVALID_DATA');
      throw new ApiError('UPSTREAM_ERROR');
    }
  }
}