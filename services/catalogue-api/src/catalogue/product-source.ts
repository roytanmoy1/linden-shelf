import type { Product } from '@linden-shelf/contracts';

export interface ProductSource {
  getProducts(): Promise<Product[]>;
}