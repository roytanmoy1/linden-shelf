import { isIP } from 'node:net';
import { emailSchema, FEATURED_COUNT, productIdParamSchema } from '@linden-shelf/contracts';
import { z } from 'zod';

const originSchema = z.url().pipe(z.string().refine((value) => {
  const origin = new URL(value);
  return ['http:', 'https:'].includes(origin.protocol) && origin.pathname === '/'
    && !origin.username && !origin.password && !origin.search && !origin.hash;
})).transform((value) => new URL(value).origin);

const integerSetting = (maximum: number, defaultValue: number) => z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().min(1).max(maximum)).default(defaultValue);

const configSchema = z.object({
  HOST: z.enum(['127.0.0.1', '0.0.0.0', '::1']).default('127.0.0.1'),
  PORT: integerSetting(65535, 3001),
  TRUST_INGRESS_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(originSchema).min(1).max(20)).transform((origins) => [...new Set(origins)]),
  PRODUCT_API_BASE_URL: originSchema.refine((value) => value === 'https://fakestoreapi.com')
    .default('https://fakestoreapi.com'),
  PRODUCT_TIMEOUT_MS: integerSetting(5000, 5000),
  FEATURED_PRODUCT_IDS: z.string().max(160).default('3,5,11,18,20')
    .transform((value) => value.split(',').map((id) => id.trim()))
    .pipe(z.array(productIdParamSchema).length(FEATURED_COUNT))
    .refine((ids) => new Set(ids).size === ids.length),
  SMTP_HOST: z.string().min(1).max(253).refine((value) => isIP(value) > 0
    || /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(value))
    .default('127.0.0.1'),
  SMTP_PORT: integerSetting(65535, 1025),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().max(254).default(''),
  SMTP_PASSWORD: z.string().max(1024).default(''),
  SMTP_CONNECTION_TIMEOUT_MS: integerSetting(5000, 5000),
  SMTP_GREETING_TIMEOUT_MS: integerSetting(5000, 5000),
  SMTP_SOCKET_TIMEOUT_MS: integerSetting(10000, 10000),
  MAIL_FROM: emailSchema.default('catalogue@lindenshelf.test'),
  SALES_EMAIL: emailSchema.default('sales@lindenshelf.test'),
}).superRefine((config, context) => {
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    for (const field of ['SMTP_USER', 'SMTP_PASSWORD']) {
      context.addIssue({ code: 'custom', path: [field], message: 'SMTP credentials must be paired.' });
    }
  }
});

export function readConfig(environment: NodeJS.ProcessEnv) {
  const result = configSchema.safeParse(environment);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))].sort();
    throw new Error(`Invalid configuration: ${fields.join(', ')}`);
  }
  const config = result.data;
  return {
    host: config.HOST, port: config.PORT, allowedOrigins: config.ALLOWED_ORIGINS,
    trustIngressProxy: config.TRUST_INGRESS_PROXY,
    productApiBaseUrl: config.PRODUCT_API_BASE_URL, productTimeoutMs: config.PRODUCT_TIMEOUT_MS,
    featuredProductIds: config.FEATURED_PRODUCT_IDS,
    smtpHost: config.SMTP_HOST, smtpPort: config.SMTP_PORT, smtpSecure: config.SMTP_SECURE,
    smtpUser: config.SMTP_USER, smtpPassword: config.SMTP_PASSWORD,
    smtpConnectionTimeoutMs: config.SMTP_CONNECTION_TIMEOUT_MS,
    smtpGreetingTimeoutMs: config.SMTP_GREETING_TIMEOUT_MS, smtpSocketTimeoutMs: config.SMTP_SOCKET_TIMEOUT_MS,
    mailFrom: config.MAIL_FROM, salesEmail: config.SALES_EMAIL,
  };
}

export type Config = ReturnType<typeof readConfig>;