import { describe, expect, it } from 'vitest';
import { enquiry, product } from '../../../tests/fixtures.js';
import {
  catalogueQuerySchema,
  catalogueSchema,
  enquirySchema,
  isJsonContentType,
  productIdParamSchema,
  productSchema,
} from './index.js';

it('recognizes only the JSON media type, independent of case or parameters', () => {
  expect(isJsonContentType(' Application/JSON ; charset=utf-8')).toBe(true);
  for (const value of [undefined, null, '', 'text/html', 'application/jsonp', 'application/problem+json']) {
    expect(isJsonContentType(value)).toBe(false);
  }
});

describe('product boundary', () => {
  it('accepts a product, including zero price and rating endpoints', () => {
    expect(productSchema.parse(product({ price: 0, rating: { rate: 0, count: 0 } })).price).toBe(0);
    expect(productSchema.parse(product({ rating: { rate: 5, count: 1 } })).rating.rate).toBe(5);
  });

  it.each([
    { id: 0 }, { id: -1 }, { id: 1.5 }, { id: Number.MAX_SAFE_INTEGER + 1 }, { id: '1' },
    { title: '' }, { title: ' '.repeat(5) }, { title: 'x'.repeat(301) },
    { description: '' }, { description: 'x'.repeat(10001) },
    { category: '' }, { category: 'x'.repeat(101) },
    { price: -1 }, { price: Infinity }, { price: NaN },
    { image: 'http://fakestoreapi.com/img/test.jpg' },
    { image: 'https://fakestoreapi.com/products/3' },
    { image: 'https://fakestoreapi.com.attacker.test/image.jpg' },
    { image: 'https://user:pass@fakestoreapi.com/image.jpg' },
    { image: 'https://fakestoreapi.com:444/image.jpg' },
    { image: 'not a URL' },
    { rating: { rate: -0.1, count: 1 } }, { rating: { rate: 5.1, count: 1 } },
    { rating: { rate: 1, count: -1 } }, { rating: { rate: 1, count: 0.5 } },
    { rating: { rate: 1, count: Number.MAX_SAFE_INTEGER + 1 } },
  ])('rejects invalid source fields: %j', (overrides) => {
    expect(productSchema.safeParse({ ...product(), ...overrides }).success).toBe(false);
  });

  it('rejects duplicates, nonarrays and empty or partly malformed datasets', () => {
    for (const input of [[product(), product()], {}, [], [product(), { id: 2 }]]) {
      expect(catalogueSchema.safeParse(input).success).toBe(false);
    }
    expect(catalogueSchema.parse([product(), product({ id: 2 })])).toHaveLength(2);
  });

  it('strips uncontracted provider fields', () => {
    expect(productSchema.parse({ ...product(), internal: 'not public' })).not.toHaveProperty('internal');
  });
});

describe('browse and ID input', () => {
  it('trims submitted queries and treats an empty category as no filter', () => {
    expect(catalogueQuerySchema.parse({ q: '  COTTON  ', category: '  ' })).toEqual({ q: 'COTTON' });
    expect(catalogueQuerySchema.parse({ q: '   ' }).q).toBe('');
    expect(catalogueQuerySchema.safeParse({ q: 'x'.repeat(200) }).success).toBe(true);
  });

  it.each([{ q: 'x'.repeat(201) }, { q: ['one', 'two'] }, { q: { nested: 'one' } }, { unexpected: 'value' }])(
    'rejects malformed or oversized query input: %j',
    (input) => expect(catalogueQuerySchema.safeParse(input).success).toBe(false),
  );

  it.each(['0', '-1', '1.2', '1e2', '01', ' 3 ', '9007199254740992', 'abc'])('rejects invalid ID %s', (value) => {
    expect(productIdParamSchema.safeParse(value).success).toBe(false);
  });

  it('parses positive safe integer IDs', () => {
    expect(productIdParamSchema.parse('3')).toBe(3);
    expect(productIdParamSchema.parse(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('enquiry boundary', () => {
  it('trims fields and permits an omitted or empty message', () => {
    expect(enquirySchema.parse(enquiry({ name: '  Alex Example  ', message: '  Hello  ' }))).toEqual(
      enquiry({ message: 'Hello' }),
    );
    expect(enquirySchema.parse(enquiry())).not.toHaveProperty('message');
    expect(enquirySchema.parse(enquiry({ message: '   ' })).message).toBe('');
  });

  it('accepts the documented exact bounds', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
    expect(email).toHaveLength(254);
    expect(enquirySchema.safeParse(enquiry({ name: 'a'.repeat(100), email, message: 'm'.repeat(2000) })).success).toBe(true);
  });

  it.each([
    { productId: 0 }, { productId: '3' }, { productId: Number.MAX_SAFE_INTEGER + 1 },
    { name: '' }, { name: '   ' }, { name: 'x'.repeat(101) }, { name: '\rAlex' },
    { name: 'Alex\n' }, { name: 'Alex\tExample' }, { name: 'Alex\u0000' },
    { email: 'invalid' }, { email: 'alex@example.test\r\nBcc: other@example.test' },
    { email: '\nalex@example.test' }, { email: `${'a'.repeat(250)}@example.test` },
    { message: 'x'.repeat(2001) }, { message: null },
    { recipient: 'other@example.test' }, { title: 'Client selected product' },
  ])('rejects invalid enquiry input: %j', (overrides) => {
    expect(enquirySchema.safeParse({ ...enquiry(), ...overrides }).success).toBe(false);
  });
});