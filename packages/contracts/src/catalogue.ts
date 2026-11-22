import { z } from 'zod';

export const CATALOGUE_BOUNDS = { title: 300, description: 10000, category: 100, query: 200 } as const;
export const FEATURED_COUNT = 5;
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

export const catalogueSchema = z.array(productSchema).min(1).max(1000).refine(
  (products) => new Set(products.map((product) => product.id)).size === products.length,
  { message: 'Product IDs must be unique.' },
);

export const catalogueQuerySchema = z.strictObject({
  category: z.string().trim().max(CATALOGUE_BOUNDS.category).optional(),
  q: z.string().trim().max(CATALOGUE_BOUNDS.query).optional(),
}).transform(({ category, q: queryText }) => ({
  ...(category ? { category } : {}),
  ...(queryText === undefined ? {} : { q: queryText }),
}));

export const productResponseSchema = z.object({ product: productSchema });
export const featuredProductsResponseSchema = z.object({ products: z.array(productSchema).length(FEATURED_COUNT) });
export const catalogueResponseSchema = z.object({ products: z.array(productSchema), featuredIds: z.array(productIdSchema) });
export const categoriesResponseSchema = z.object({ categories: z.array(categorySchema) });

export type Product = z.infer<typeof productSchema>;
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type FeaturedProductsResponse = z.infer<typeof featuredProductsResponseSchema>;
export type CatalogueResponse = z.infer<typeof catalogueResponseSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
