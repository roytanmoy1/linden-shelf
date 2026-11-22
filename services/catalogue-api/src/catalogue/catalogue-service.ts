import { catalogueQuerySchema, type CatalogueResponse, type Product } from '@linden-shelf/contracts';
import { ApiError } from '../http/errors.js';
import type { ProductSource } from './product-source.js';

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
    const { category, q: queryText } = parsed.data;
    const allProducts = await this.source.getProducts();
    if (category && !allProducts.some((product) => product.category === category)) {
      throw new ApiError('NOT_FOUND');
    }
    const query = queryText?.toLowerCase() ?? '';
    const matches = (product: Product) => (!category || product.category === category)
      && (!query || [product.title, product.description, product.category].some((field) => field.toLowerCase().includes(query)));
    const featured = this.selectFeatured(allProducts).filter(matches);
    const featuredIds = featured.map((product) => product.id);
    const sorted = allProducts.filter(matches).sort((first, second) => first.id - second.id);
    const products = category
      ? [...featured, ...sorted.filter((product) => !featuredIds.includes(product.id))]
      : sorted;
    return { products, featuredIds };
  }

  async getProduct(id: number): Promise<Product> {
    const products = await this.source.getProducts();
    const product = products.find((candidate) => candidate.id === id);
    if (!product) throw new ApiError('NOT_FOUND');
    return product;
  }
}