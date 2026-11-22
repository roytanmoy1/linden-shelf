import {
  catalogueQuerySchema, catalogueResponseSchema, categoriesResponseSchema,
  enquiryResponseSchema, enquirySchema, errorResponseSchema, featuredProductsResponseSchema,
  isJsonContentType, productIdParamSchema, productResponseSchema,
  type CatalogueQuery, type CatalogueResponse, type CategoriesResponse, type Enquiry,
  type EnquiryResponse, type ErrorCode, type FeaturedProductsResponse, type ProductResponse,
} from '@linden-shelf/contracts';
import type { z } from 'zod';

const messages = {
  BAD_REQUEST: 'This address or search is not valid.',
  VALIDATION_ERROR: 'Check the highlighted fields and try again.',
  NOT_FOUND: 'This page or product could not be found.',
  ORIGIN_NOT_ALLOWED: 'This request could not be accepted. Reopen the catalogue and try again.',
  PAYLOAD_TOO_LARGE: 'Your enquiry is too long. Shorten it and try again.',
  UNSUPPORTED_MEDIA_TYPE: 'This request could not be accepted. Reload the page and try again.',
  RATE_LIMITED: 'Too many enquiry attempts. Please wait before trying again.',
  UPSTREAM_ERROR: 'The catalogue is temporarily unavailable. Please try again.',
  UPSTREAM_INVALID_DATA: 'The catalogue could not be loaded. Please try again.',
  UPSTREAM_TIMEOUT: 'The catalogue took too long to respond. Please try again.',
  MAIL_UNAVAILABLE: 'We could not confirm your enquiry was sent. Your details are still here.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  INVALID_RESPONSE: 'We could not confirm the response. Please try again.',
  NETWORK_ERROR: 'The connection was interrupted. Please check your connection and try again.',
} satisfies Record<ErrorCode | 'INVALID_RESPONSE' | 'NETWORK_ERROR', string>;

export class ApiError extends Error {
  readonly code: keyof typeof messages;
  readonly status: number;
  readonly fields: string[];
  readonly retryAfterSeconds: number | null;

  constructor(code: keyof typeof messages, status = 0, fields: string[] = [], retryAfterSeconds: number | null = null) {
    super(messages[code]);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiClient {
  getFeatured(signal?: AbortSignal): Promise<FeaturedProductsResponse>;
  getCategories(signal?: AbortSignal): Promise<CategoriesResponse>;
  list(query: CatalogueQuery, signal?: AbortSignal): Promise<CatalogueResponse>;
  getProduct(id: string, signal?: AbortSignal): Promise<ProductResponse>;
  sendEnquiry(enquiry: Enquiry, signal?: AbortSignal): Promise<EnquiryResponse>;
}

export function createApiClient(fetcher: typeof fetch = fetch): ApiClient {
  async function request<Value>(path: string, schema: z.ZodType<Value>, options: RequestInit): Promise<Value> {
    let response: Response;
    try {
      response = await fetcher(path, {
        credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json' }, ...options,
      });
    } catch {
      if (options.signal?.aborted) throw options.signal.reason;
      throw new ApiError('NETWORK_ERROR');
    }
    let body: unknown;
    try {
      if (!isJsonContentType(response.headers.get('Content-Type'))) {
        throw new Error('Invalid content type');
      }
      body = await response.json();
    } catch {
      if (options.signal?.aborted) throw options.signal.reason;
      throw new ApiError('INVALID_RESPONSE', response.status);
    }
    if (!response.ok) {
      const failure = errorResponseSchema.safeParse(body);
      if (!failure.success) throw new ApiError('INVALID_RESPONSE', response.status);
      const retryHeader = response.headers.get('Retry-After') ?? '';
      const retrySeconds = /^\d+$/.test(retryHeader) ? Number(retryHeader) : NaN;
      throw new ApiError(
        failure.data.error.code, response.status,
        Object.keys(failure.data.error.details ?? {}).filter((field) => ['name', 'email', 'message'].includes(field)),
        Number.isSafeInteger(retrySeconds) && retrySeconds > 0 && retrySeconds <= 86400 ? retrySeconds : null,
      );
    }
    const result = schema.safeParse(body);
    if (response.status !== 200 || !result.success) throw new ApiError('INVALID_RESPONSE', response.status);
    return result.data;
  }

  return {
    getFeatured: (signal) => request('/api/products/featured', featuredProductsResponseSchema, { signal: signal ?? null }),
    getCategories: (signal) => request('/api/categories', categoriesResponseSchema, { signal: signal ?? null }),
    list: async (query, signal) => {
      const result = catalogueQuerySchema.safeParse(query);
      if (!result.success) throw new ApiError('BAD_REQUEST');
      const search = new URLSearchParams(result.data).toString();
      return request(`/api/products${search ? `?${search}` : ''}`, catalogueResponseSchema, { signal: signal ?? null });
    },
    getProduct: async (id, signal) => {
      const result = productIdParamSchema.safeParse(id);
      if (!result.success) throw new ApiError('BAD_REQUEST');
      return request(`/api/products/${result.data}`, productResponseSchema, { signal: signal ?? null });
    },
    sendEnquiry: async (enquiry, signal) => {
      const result = enquirySchema.safeParse(enquiry);
      if (!result.success) throw new ApiError('VALIDATION_ERROR');
      return request('/api/enquiries', enquiryResponseSchema, {
        method: 'POST', signal: signal ?? null,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
    },
  };
}

export const api = createApiClient();