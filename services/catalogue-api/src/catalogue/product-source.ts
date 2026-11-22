import type { Product } from '@linden-shelf/contracts';

export interface ProductSource {
  getProducts(mode?: 'fresh'): Promise<Product[]>;
  getPhoto(url: string): Promise<{ bytes: Buffer; contentType: string }>;
}