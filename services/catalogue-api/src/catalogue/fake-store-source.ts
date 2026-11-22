import { catalogueSchema, isJsonContentType, type Product } from '@linden-shelf/contracts';
import type { Config } from '../config.js';
import { ApiError } from '../http/errors.js';
import type { ProductSource } from './product-source.js';

const MAX_CATALOGUE_BYTES = 1024 * 1024;

function readCatalogueJson(response: Response): Promise<unknown> {
  const available = response.ok && !response.redirected;
  if (!available || !isJsonContentType(response.headers.get('content-type'))) {
    void response.body?.cancel().catch(() => undefined);
    throw new ApiError(available ? 'UPSTREAM_INVALID_DATA' : 'UPSTREAM_ERROR');
  }
  if (!response.body) throw new ApiError('UPSTREAM_INVALID_DATA');
  let bytes = 0;
  const bounded = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_CATALOGUE_BYTES) throw new ApiError('UPSTREAM_INVALID_DATA');
      controller.enqueue(chunk);
    },
  }));
  return new Response(bounded).json();
}

interface SourceDependencies {
  fetch?: typeof globalThis.fetch;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
}

export class FakeStoreProductSource implements ProductSource {
  private readonly productsUrl: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutSignal: (milliseconds: number) => AbortSignal;
  private inFlight: Promise<Product[]> | undefined;

  constructor(
    private readonly config: Pick<Config, 'productApiBaseUrl' | 'productTimeoutMs'>,
    dependencies: SourceDependencies = {},
  ) {
    this.productsUrl = new URL('/products', config.productApiBaseUrl).href;
    this.fetch = dependencies.fetch ?? globalThis.fetch;
    this.timeoutSignal = dependencies.timeoutSignal ?? ((milliseconds) => AbortSignal.timeout(milliseconds));
  }

  getProducts(): Promise<Product[]> {
    this.inFlight ??= this.fetchProducts().finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  private async fetchProducts(): Promise<Product[]> {
    const signal = this.timeoutSignal(this.config.productTimeoutMs);
    try {
      const response = await this.fetch(this.productsUrl, {
        method: 'GET', headers: { Accept: 'application/json' }, redirect: 'error', signal,
      });
      const body = await readCatalogueJson(response);
      const parsed = catalogueSchema.safeParse(body);
      if (!parsed.success) throw new ApiError('UPSTREAM_INVALID_DATA');
      return parsed.data;
    } catch (error) {
      if (signal.aborted) throw new ApiError('UPSTREAM_TIMEOUT');
      if (error instanceof ApiError) throw error;
      if (error instanceof SyntaxError) throw new ApiError('UPSTREAM_INVALID_DATA');
      throw new ApiError('UPSTREAM_ERROR');
    }
  }
}