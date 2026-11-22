import type { Enquiry, Product } from '@linden-shelf/contracts';

export const fixturePhotoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYZkAAAAASUVORK5CYII=';

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Field jacket',
    description: 'A woven outdoor layer',
    category: "men's clothing",
    price: 49.5,
    image: 'https://fakestoreapi.com/img/test-jacket.jpg',
    rating: { rate: 2, count: 10 },
    ...overrides,
  };
}

export function catalogueFixture(): Product[] {
  return [
    product({ id: 20, title: 'Cotton t-shirt', category: "women's clothing" }),
    product({ id: 2, title: 'Trail trousers', rating: { rate: 5, count: 90 } }),
    product({ id: 11, title: 'Portable drive', category: 'electronics' }),
    product({ id: 3, title: 'Cotton jacket' }),
    product({ id: 5, title: 'Silver bracelet', category: 'jewelery' }),
    product({ id: 18, title: 'Woven blouse', category: "women's clothing" }),
    product({ id: 1, title: 'Everyday shirt', description: 'Soft cotton weave', rating: { rate: 5, count: 100 } }),
  ];
}

export function enquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return { productId: 3, name: 'Alex Example', email: 'alex@example.test', ...overrides };
}

export function productsById(ids: readonly number[]) {
  const products = catalogueFixture();
  return ids.map((id) => {
    const found = products.find((product) => product.id === id);
    if (!found) throw new Error('Missing test product');
    return found;
  });
}

export function pageFixture(all: Product[], selected: number[], page = 1) {
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const products = all.slice((page - 1) * pageSize, page * pageSize);
  return { products, featuredIds: selected.filter((id) => products.some((item) => item.id === id)),
    pagination: { page, pageSize, pageCount, total: all.length } };
}

export function catalogueResponses(): Map<string, unknown> {
  const allProducts = { products: productsById([1, 2, 3, 5, 11, 18, 20]), featuredIds: [3, 5, 11, 18, 20] };
  const responses = new Map<string, unknown>([
    ['/api/categories', { categories: ['electronics', 'jewelery', "men's clothing", "women's clothing"] }],
    ['/api/products/featured', { products: productsById([3, 5, 11, 18, 20]) }],
    ['/api/products?category=men%27s+clothing', { products: productsById([3, 1, 2]), featuredIds: [3] }],
    ['/api/products?category=electronics', { products: productsById([11]), featuredIds: [11] }],
    ['/api/products?q=cotton', { products: productsById([1, 3, 20]), featuredIds: [3, 20] }],
    ['/api/products?q=telescope', { products: [], featuredIds: [] }],
    ['/api/products?q=', allProducts],
    ['/api/products', allProducts],
    ...catalogueFixture().map((product): [string, unknown] => [`/api/products/${product.id}`, { product }]),
  ]);
  for (const [path, body] of [...responses]) {
    const url = new URL(path, 'http://localhost');
    if (url.pathname !== '/api/products') continue;
    const listing = body as { products: Product[]; featuredIds: number[] };
    url.searchParams.set('page', '1');
    responses.set(url.pathname + url.search, pageFixture(listing.products, listing.featuredIds));
  }
  return responses;
}

export function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}