import type { ErrorCode, ErrorResponse } from '@linden-shelf/contracts';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

const definitions: Record<ErrorCode, { status: number; message: string }> = {
  BAD_REQUEST: { status: 400, message: 'The request is malformed.' },
  VALIDATION_ERROR: { status: 422, message: 'Check the supplied fields.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  ORIGIN_NOT_ALLOWED: { status: 403, message: 'This origin is not allowed.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request body is too large.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'Use an uncompressed JSON request body.' },
  RATE_LIMITED: { status: 429, message: 'Too many enquiry attempts. Try again later.' },
  UPSTREAM_ERROR: { status: 502, message: 'The product source is unavailable.' },
  UPSTREAM_INVALID_DATA: { status: 502, message: 'The product source returned an invalid catalogue.' },
  UPSTREAM_TIMEOUT: { status: 504, message: 'The product source timed out.' },
  MAIL_UNAVAILABLE: { status: 503, message: 'Email could not be confirmed. Check the inbox before retrying.' },
  INTERNAL_ERROR: { status: 500, message: 'The request could not be completed.' },
};

export class ApiError extends Error {
  readonly status: number;

  constructor(readonly code: ErrorCode, readonly details: ErrorResponse['error']['details'] = null) {
    super(definitions[code].message);
    this.name = 'ApiError';
    this.status = definitions[code].status;
  }

  toResponse(): ErrorResponse {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

const safeFields = new Set(['productId', 'name', 'email', 'message', 'category', 'q', 'id']);
const bodyErrors = new Map<string, ErrorCode>([
  ['entity.too.large', 'PAYLOAD_TOO_LARGE'],
  ['entity.parse.failed', 'BAD_REQUEST'],
  ['request.aborted', 'BAD_REQUEST'],
  ['request.size.invalid', 'BAD_REQUEST'],
  ['encoding.unsupported', 'UNSUPPORTED_MEDIA_TYPE'],
  ['charset.unsupported', 'UNSUPPORTED_MEDIA_TYPE'],
]);

function safeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    const details: NonNullable<ErrorResponse['error']['details']> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      const key = typeof field === 'string' && safeFields.has(field) ? field : 'body';
      details[key] = ['Invalid value.'];
    }
    return new ApiError('VALIDATION_ERROR', details);
  }
  if (error instanceof URIError) return new ApiError('BAD_REQUEST');
  if (typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string') {
    const code = bodyErrors.get(error.type);
    if (code) return new ApiError(code);
  }
  return new ApiError('INTERNAL_ERROR');
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const failure = safeError(error);
  response.status(failure.status).json(failure.toResponse());
};