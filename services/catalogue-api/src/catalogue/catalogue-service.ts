import { catalogueQuerySchema, pageCountFor, PAGE_SIZE, type CatalogueQuery, type CatalogueResponse, type Product } from '@linden-shelf/contracts';
import { ApiError } from '../http/errors.js';
import type { ProductSource } from './product-source.js';

const comparisons: Record<NonNullable<CatalogueQuery['sort']>, (first: Product, second: Product) => number> = {
  'price-asc': (first, second) => first.price - second.price,
  'price-desc': (first, second) => second.price - first.price,
  'rating-desc': (first, second) => second.rating.rate - first.rating.rate,
  'title-asc': (first, second) => first.title.localeCompare(second.title, 'en'),
};

export class CatalogueService {
  constructor(private readonly source: ProductSource, private readonly featuredProductIds: readonly number[]) {}

  private selectFeatured(products: Product[]): Product[] {
    return this.featuredProductIds.map((id) => {
      const selected = products.find((product) => product.id === id);
      if (!selected) throw new ApiError('UPSTREAM_INVALID_DATA');
      return selected;
    });
  }

  async getFeatured(): Promise<Product[]> {
    return this.selectFeatured(await this.source.getProducts());
  }

  async getCategories(): Promise<string[]> {
    const products = await this.source.getProducts();
    return [...new Set(products.map((product) => product.category))].sort();
  }

  async list(input: unknown = {}): Promise<CatalogueResponse> {
    const parsed = catalogueQuerySchema.safeParse(input);
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.code === 'invalid_type' || issue.code === 'unrecognized_keys')) {
        throw new ApiError('BAD_REQUEST');
      }
      throw parsed.error;
    }
    const { category, q: queryText, minPrice, maxPrice, minRating, featured, sort, page } = parsed.data;
    const allProducts = await this.source.getProducts();
    if (category && !allProducts.some((product) => product.category === category)) {
      throw new ApiError('NOT_FOUND');
    }
    const query = queryText?.toLowerCase() ?? '';
    const picks = this.selectFeatured(allProducts);
    const picked = new Set(picks.map((item) => item.id));
    const floor = Number(minPrice ?? 0), ceiling = Number(maxPrice ?? Infinity), stars = Number(minRating ?? 0);
    const matched = allProducts.filter((product) => (!category || product.category === category)
      && product.price >= floor && product.price <= ceiling && product.rating.rate >= stars
      && (!featured || picked.has(product.id))
      && (!query || [product.title, product.description, product.category].some((field) => field.toLowerCase().includes(query))));
    const compare = sort && comparisons[sort];
    matched.sort((first, second) => compare?.(first, second) || first.id - second.id);
    const matchingIds = new Set(matched.map((item) => item.id));
    const selected = picks.filter((item) => matchingIds.has(item.id));
    const ordered = category && !sort ? [...selected, ...matched.filter((item) => !picked.has(item.id))] : matched;
    const featuredIds = selected.map((item) => item.id);
    if (!page) return { products: ordered, featuredIds };
    const pageCount = pageCountFor(ordered.length);
    const current = Math.min(Number(page), pageCount);
    const products = ordered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    return { products, featuredIds: products.filter((item) => picked.has(item.id)).map((item) => item.id),
      pagination: { page: current, pageCount, pageSize: PAGE_SIZE, total: ordered.length } };
  }

  async getProduct(id: number, mode?: 'fresh'): Promise<Product> {
    const products = await this.source.getProducts(mode);
    const product = products.find((candidate) => candidate.id === id);
    if (!product) throw new ApiError('NOT_FOUND');
    return product;
  }

  async getPhoto(id: number) {
    const product = await this.getProduct(id);
    return this.source.getPhoto(product.image);
  }
}