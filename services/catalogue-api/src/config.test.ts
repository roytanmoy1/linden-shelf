import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('startup configuration', () => {
  it.each(['1,2,3,4', '1,2,3,4,5,6', '1,2,3,4,4', '1,2,3,4,0', '1,2,3,4,1.5', '1,2,3,4,9007199254740992', ''])(
    'rejects an invalid editorial selection before serving requests: %j', (selection) => {
      expect(() => readConfig({ FEATURED_PRODUCT_IDS: selection })).toThrow('Invalid configuration: FEATURED_PRODUCT_IDS');
    },
  );

  it('validates explicit safe native defaults', () => {
    expect(readConfig({})).toEqual({
      host: '127.0.0.1', port: 3001, trustIngressProxy: false,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
      productApiBaseUrl: 'https://fakestoreapi.com', productTimeoutMs: 5000,
      featuredProductIds: [3, 5, 11, 18, 20],
      smtpHost: '127.0.0.1', smtpPort: 1025, smtpSecure: false,
      smtpUser: '', smtpPassword: '', smtpConnectionTimeoutMs: 5000,
      smtpGreetingTimeoutMs: 5000, smtpSocketTimeoutMs: 10000,
      mailFrom: 'catalogue@lindenshelf.test', salesEmail: 'sales@lindenshelf.test',
    });
  });

  it('normalizes configured origins and supports paired SMTP credentials', () => {
    const config = readConfig({
      HOST: '0.0.0.0', PORT: '4001', ALLOWED_ORIGINS: ' https://catalogue.example.test/,http://localhost:4000 ',
      PRODUCT_API_BASE_URL: 'https://fakestoreapi.com/', PRODUCT_TIMEOUT_MS: '3000',
      SMTP_HOST: 'mailpit', SMTP_PORT: '465', SMTP_SECURE: 'true',
      SMTP_USER: 'configured-user', SMTP_PASSWORD: 'synthetic-password',
      MAIL_FROM: 'catalogue@example.test', SALES_EMAIL: 'sales@example.test',
    });
    expect(config.allowedOrigins).toEqual(['https://catalogue.example.test', 'http://localhost:4000']);
    expect(config.productApiBaseUrl).toBe('https://fakestoreapi.com');
    expect(config.productTimeoutMs).toBe(3000);
    expect(config.smtpSecure).toBe(true);
    expect(config.smtpHost).toBe('mailpit');
    expect(config.port).toBe(4001);
    expect(config.smtpPassword).toBe('synthetic-password');
  });

  it('requires an explicit opt-in for the protected single-hop container ingress', () => {
    expect(readConfig({ TRUST_INGRESS_PROXY: 'true' }).trustIngressProxy).toBe(true);
    expect(readConfig({ TRUST_INGRESS_PROXY: 'false' }).trustIngressProxy).toBe(false);
  });

  it('accepts a configured IPv6 loopback SMTP host', () => {
    expect(readConfig({ SMTP_HOST: '::1' }).smtpHost).toBe('::1');
  });

  it.each([
    ['PORT', '0'], ['PORT', '65536'], ['PORT', '1e3'], ['PORT', ''],
    ['TRUST_INGRESS_PROXY', 'yes'], ['TRUST_INGRESS_PROXY', '2'],
    ['HOST', 'example.test'], ['ALLOWED_ORIGINS', '*'], ['ALLOWED_ORIGINS', 'null'],
    ['ALLOWED_ORIGINS', 'https://site.test/path'], ['ALLOWED_ORIGINS', 'https://user:pass@site.test'],
    ['ALLOWED_ORIGINS', 'https://site.test?secret=value'], ['ALLOWED_ORIGINS', ''],
    ['PRODUCT_API_BASE_URL', 'http://fakestoreapi.com'],
    ['PRODUCT_API_BASE_URL', 'https://other.example.test'],
    ['PRODUCT_API_BASE_URL', 'https://fakestoreapi.com:444'],
    ['PRODUCT_API_BASE_URL', 'https://fakestoreapi.com/other'],
    ['PRODUCT_API_BASE_URL', 'https://user:pass@fakestoreapi.com'],
    ['PRODUCT_TIMEOUT_MS', '5001'], ['PRODUCT_TIMEOUT_MS', '0'],
    ['SMTP_SECURE', 'yes'], ['SMTP_HOST', 'smtp://example.test'],
    ['SMTP_HOST', 'mailpit\r\nInjected'], ['SMTP_HOST', ''],
    ['SMTP_PORT', '70000'], ['SMTP_CONNECTION_TIMEOUT_MS', '5001'],
    ['SMTP_GREETING_TIMEOUT_MS', '5001'], ['SMTP_SOCKET_TIMEOUT_MS', '10001'],
    ['MAIL_FROM', 'invalid'], ['SALES_EMAIL', 'sales@example.test\nBcc: other@example.test'],
    ['SMTP_USER', 'only-user'], ['SMTP_PASSWORD', 'only-password'],
  ])('rejects invalid %s without echoing its value', (name, value) => {
    expect(() => readConfig({ [name]: value })).toThrow(/Invalid configuration/);
    try {
      readConfig({ [name]: value });
    } catch (error) {
      expect((error as Error).message).toContain(name);
      if (value.length > 3) expect((error as Error).message).not.toContain(value);
    }
  });

  it('does not expose invalid credentials or accept non-SMTP server settings from unknown variables', () => {
    expect(readConfig({ UNRELATED_SETTING: 'ignored' }).smtpHost).toBe('127.0.0.1');
    expect(() => readConfig({ SMTP_USER: 'private-value' })).not.toThrow(/private-value/);
  });
});