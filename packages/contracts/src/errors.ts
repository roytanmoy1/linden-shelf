import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'BAD_REQUEST', 'VALIDATION_ERROR', 'NOT_FOUND', 'ORIGIN_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED',
  'UPSTREAM_ERROR', 'UPSTREAM_INVALID_DATA', 'UPSTREAM_TIMEOUT',
  'MAIL_UNAVAILABLE', 'INTERNAL_ERROR',
]);

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.array(z.string())).nullable(),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;