import type { Product } from '@linden-shelf/contracts';
import { describe, expect, it, vi } from 'vitest';
import { catalogueFixture, product } from '../../../../tests/fixtures.js';
import { readConfig } from '../config.js';
import { CatalogueService } from './catalogue-service.js';

function setup(products: Product[] = catalogueFixture(), environment: NodeJS.ProcessEnv = {}) {
  const source = { getProducts: vi.fn<() => Promise<Product[]>>().mockResolvedValue(products) };
  return { source, catalogue: new CatalogueService(source, readConfig(environment).featuredProductIds) };
}

describe('editorial catalogue', () => {
  it('uses the owner-selected membership and order for both the home and category pages', async () => {
    const { catalogue } = setup(catalogueFixture(), { FEATURED_PRODUCT_IDS: '2, 11, 1, 5, 18' });
    expect((await catalogue.getFeatured()).map((item) => item.id)).toEqual([2, 11, 1, 5, 18]);
    const category = await catalogue.list({ category: "men's clothing" });
    expect(category.featuredIds).toEqual([2, 1]);
    expect(category.products.map((item) => item.id)).toEqual([2, 1, 3]);
  });

  it('returns exactly the five configured IDs, not the highest ratings', async () => {
    const { catalogue, source } = setup();
    const featured = await catalogue.getFeatured();
    expect(featured.map((product) => product.id)).toEqual([3, 5, 11, 18, 20]);
    expect(featured).toHaveLength(5);
    expect(featured.every((product) => product.rating.rate < 5)).toBe(true);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it.each([3, 5, 11, 18, 20])('fails explicitly when configured product %i is absent', async (missingId) => {
    const { catalogue } = setup(catalogueFixture().filter((product) => product.id !== missingId));
    await expect(catalogue.getFeatured()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA', status: 502 });
    await expect(catalogue.list()).rejects.toMatchObject({ code: 'UPSTREAM_INVALID_DATA' });
  });

  it('derives unique sorted categories in one source call', async () => {
    const { catalogue, source } = setup();
    expect(await catalogue.getCategories()).toEqual(['electronics', 'jewelery', "men's clothing", "women's clothing"]);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it('browses all products in ascending ID order without mutating source data', async () => {
    const products = catalogueFixture();
    const originalIds = products.map((product) => product.id);
    const { catalogue, source } = setup(products);
    const result = await catalogue.list();
    expect(result.products.map((product) => product.id)).toEqual([1, 2, 3, 5, 11, 18, 20]);
    expect(result.featuredIds).toEqual([3, 5, 11, 18, 20]);
    expect(products.map((product) => product.id)).toEqual(originalIds);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it('places the curated category subset first, then remaining products once each', async () => {
    const { catalogue, source } = setup();
    const result = await catalogue.list({ category: "men's clothing" });
    expect(result.products.map((product) => product.id)).toEqual([3, 1, 2]);
    expect(result.featuredIds).toEqual([3]);
    expect(new Set(result.products.map((product) => product.id)).size).toBe(result.products.length);
    expect(source.getProducts).toHaveBeenCalledTimes(1);
  });

  it('supports categories with an empty featured subset or an empty remainder', async () => {
    const { catalogue } = setup([...catalogueFixture(), product({ id: 99, category: 'accessories' })]);
    const plain = await catalogue.list({ category: 'accessories' });
    expect(plain.products.map((product) => product.id)).toEqual([99]);
    expect(plain.featuredIds).toEqual([]);
    const featuredOnly = await catalogue.list({ category: "women's clothing" });
    expect(featuredOnly.products.map((product) => product.id)).toEqual([18, 20]);
    expect(featuredOnly.featuredIds).toEqual([18, 20]);
  });

  it('distinguishes an unknown category from an empty search', async () => {
    const { catalogue } = setup();
    await expect(catalogue.list({ category: 'unknown', q: 'absent' })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it.each([
    ['  cOtToN  ', [1, 3, 20]],
    ['soft cotton weave', [1]],
    ['ELECTRONICS', [11]],
    ['telescope', []],
    ['', [1, 2, 3, 5, 11, 18, 20]],
    ['   ', [1, 2, 3, 5, 11, 18, 20]],
  ])('matches only title/description/category for %j', async (queryText, expectedIds) => {
    const { catalogue } = setup();
    const result = await catalogue.list({ q: queryText });
    expect(result.products.map((product) => product.id)).toEqual(expectedIds);
  });

  it('does not match IDs, numeric prices, ratings or image URLs', async () => {
    const { catalogue } = setup();
    for (const queryText of ['49.5', 'https://fakestoreapi.com', '90']) {
      expect((await catalogue.list({ q: queryText })).products).toEqual([]);
    }
  });

  it('intersects category and search while preserving category order', async () => {
    const { catalogue } = setup();
    const result = await catalogue.list({ category: "  men's clothing  ", q: '  COTTON ' });
    expect(result.products.map((product) => product.id)).toEqual([3, 1]);
    expect(result.featuredIds).toEqual([3]);
    expect(await catalogue.list({ category: 'electronics', q: 'cotton' })).toEqual({ products: [], featuredIds: [] });
  });

  it('rejects oversized search before fetching', async () => {
    const { catalogue, source } = setup();
    await expect(catalogue.list({ q: 'x'.repeat(201) })).rejects.toMatchObject({ name: 'ZodError' });
    expect(source.getProducts).not.toHaveBeenCalled();
  });

  it('returns a detail or an explicit not-found result', async () => {
    const { catalogue, source } = setup();
    expect((await catalogue.getProduct(3)).title).toBe('Cotton jacket');
    expect(source.getProducts).toHaveBeenCalledTimes(1);
    await expect(catalogue.getProduct(999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not cache catalogue data between requests', async () => {
    const { catalogue, source } = setup();
    await catalogue.getProduct(3);
    source.getProducts.mockResolvedValue(catalogueFixture().map((product) => ({ ...product, price: 99 })));
    expect((await catalogue.getProduct(3)).price).toBe(99);
    expect(source.getProducts).toHaveBeenCalledTimes(2);
  });

  it('propagates source failure without fixture fallback', async () => {
    const { catalogue, source } = setup();
    const failure = new Error('test source failure');
    source.getProducts.mockRejectedValue(failure);
    await expect(catalogue.getFeatured()).rejects.toBe(failure);
    await expect(catalogue.getCategories()).rejects.toBe(failure);
    await expect(catalogue.list()).rejects.toBe(failure);
    await expect(catalogue.getProduct(3)).rejects.toBe(failure);
  });
});