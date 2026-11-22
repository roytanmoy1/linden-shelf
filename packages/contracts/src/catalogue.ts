import { z } from 'zod';

if ('document' in globalThis) z.config({ jitless: true });

export const CATALOGUE_BOUNDS = { title: 300, description: 10000, category: 100, query: 200 } as const;
export const FEATURED_COUNT = 5;
export const PAGE_SIZE = 8;
const MAX_PRODUCTS = 1000;
export const pageCountFor = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
export const sortLabels = { 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', 'rating-desc': 'Highest rated', 'title-asc': 'Name: A to Z' } as const;
export const productIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const productIdParamSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(productIdSchema);

const categorySchema = z.string().trim().min(1).max(CATALOGUE_BOUNDS.category);
const imageSchema = z.url().max(2048).pipe(z.string().refine((value) => {
  const image = new URL(value);
  return image.origin === 'https://fakestoreapi.com' && image.pathname.startsWith('/img/')
    && !image.username && !image.password;
}));

export const productSchema = z.object({
  id: productIdSchema,
  title: z.string().trim().min(1).max(CATALOGUE_BOUNDS.title),
  description: z.string().trim().min(1).max(CATALOGUE_BOUNDS.description),
  category: categorySchema,
  price: z.number().finite().nonnegative(),
  image: imageSchema,
  rating: z.object({
    rate: z.number().finite().min(0).max(5),
    count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});

export const catalogueSchema = z.array(productSchema).min(1).max(MAX_PRODUCTS).refine(
  (products) => new Set(products.map((product) => product.id)).size === products.length,
  { message: 'Product IDs must be unique.' },
);

const priceParam = z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/);
export const catalogueQuerySchema = z.strictObject({
  category: z.string().trim().max(CATALOGUE_BOUNDS.category).optional(),
  q: z.string().trim().max(CATALOGUE_BOUNDS.query).optional(),
  minPrice: priceParam.optional(), maxPrice: priceParam.optional(),
  minRating: z.enum(['1', '2', '3', '4', '5']).optional(), featured: z.literal('1').optional(),
  sort: z.enum(Object.keys(sortLabels) as [keyof typeof sortLabels, ...(keyof typeof sortLabels)[]]).optional(),
  page: z.string().regex(/^[1-9]\d{0,2}$/).optional(),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || Number(query.minPrice) <= Number(query.maxPrice),
  { path: ['maxPrice'], message: 'Maximum price must not be lower than minimum price.' }).transform(({ category, q: queryText, ...filters }) => ({
  ...(category ? { category } : {}),
  ...(queryText === undefined ? {} : { q: queryText }),
  ...filters,
}));

export function catalogueParams(query: CatalogueQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, value);
  return params;
}

export const productResponseSchema = z.object({ product: productSchema });
export const featuredProductsResponseSchema = z.object({ products: z.array(productSchema).length(FEATURED_COUNT) });
export const catalogueResponseSchema = z.object({ products: z.array(productSchema).max(MAX_PRODUCTS), featuredIds: z.array(productIdSchema).max(FEATURED_COUNT),
  pagination: z.object({ page: z.number().int().positive(), pageCount: z.number().int().positive(),
    total: z.number().int().min(0).max(MAX_PRODUCTS), pageSize: z.literal(PAGE_SIZE) }).optional(),
}).refine(({ pagination, products }) => !pagination || (
  pagination.page <= pagination.pageCount && pagination.pageCount === pageCountFor(pagination.total)
  && products.length === Math.min(PAGE_SIZE, pagination.total - (pagination.page - 1) * PAGE_SIZE)
));
export const categoriesResponseSchema = z.object({ categories: z.array(categorySchema) });

export type Product = z.infer<typeof productSchema>;
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type FeaturedProductsResponse = z.infer<typeof featuredProductsResponseSchema>;
export type CatalogueResponse = z.infer<typeof catalogueResponseSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
