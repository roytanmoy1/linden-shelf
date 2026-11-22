import { z } from 'zod';
import { productIdSchema } from './catalogue.js';

export const ENQUIRY_BOUNDS = { name: 100, email: 254, message: 2000, bodyBytes: 16 * 1024 } as const;
const headerSafeText = z.string().refine((value) => !/\p{Cc}/u.test(value));
export const emailSchema = headerSafeText.pipe(z.string().trim().max(ENQUIRY_BOUNDS.email).pipe(z.email()));

export const enquirySchema = z.strictObject({
  productId: productIdSchema,
  name: headerSafeText.pipe(z.string().trim().min(1).max(ENQUIRY_BOUNDS.name)),
  email: emailSchema,
  message: z.string().trim().max(ENQUIRY_BOUNDS.message).optional(),
});

export const enquiryResponseSchema = z.object({ status: z.literal('sent') });
export type Enquiry = z.infer<typeof enquirySchema>;
export type EnquiryResponse = z.infer<typeof enquiryResponseSchema>;