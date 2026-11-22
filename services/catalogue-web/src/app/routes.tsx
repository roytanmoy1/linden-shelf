import { catalogueQuerySchema } from '@linden-shelf/contracts';
import type { RouteObject } from 'react-router-dom';
import { api, ApiError, type ApiClient } from '../api/client.js';
import { CategoryPage, HomePage, SearchPage } from '../catalogue/pages.js';
import { InitialLoading, RouteError, Shell } from './shell.js';

export function createRoutes(client: ApiClient = api): RouteObject[] {
  return [{
    element: <Shell />, errorElement: <RouteError />, HydrateFallback: InitialLoading,
    loader: async ({ request }) => {
      try {
        return { ...await client.getCategories(request.signal), categoryError: null };
      } catch (error) {
        if (request.signal.aborted) throw error;
        return { categories: [], categoryError: new ApiError('UPSTREAM_ERROR').message };
      }
    },
    shouldRevalidate: ({ currentUrl, nextUrl, defaultShouldRevalidate }) => currentUrl.href === nextUrl.href && defaultShouldRevalidate,
    children: [{
      errorElement: <RouteError />,
      children: [
        { index: true, element: <HomePage />, loader: ({ request }) => client.getFeatured(request.signal) },
        { path: 'category/:category', element: <CategoryPage />, loader: ({ params, request }) => client.list({ category: params.category! }, request.signal) },
        {
          path: 'products/:id', loader: ({ params, request }) => client.getProduct(params.id!, request.signal),
          lazy: async () => {
            const { ProductPage } = await import('../product/product-page.js');
            return { element: <ProductPage client={client} /> };
          },
        },
        {
          path: 'search', element: <SearchPage />,
          loader: async ({ request }) => {
            const search = new URL(request.url).searchParams;
            if ([...search.keys()].some((key) => search.getAll(key).length > 1)) throw new ApiError('BAD_REQUEST');
            const query = catalogueQuerySchema.safeParse(Object.fromEntries(search));
            if (!query.success) throw new ApiError('BAD_REQUEST');
            return { ...await client.list(query.data, request.signal), query: query.data.q ?? '' };
          },
        },
        { path: '*', element: <RouteError />, loader: () => { throw new ApiError('NOT_FOUND'); } },
      ],
    }],
  }];
}