import { catalogueQuerySchema } from '@linden-shelf/contracts';
import { replace, type LoaderFunctionArgs, type RouteObject } from 'react-router-dom';
import { api, ApiError, type ApiClient } from '../api/client.js';
import { HomePage } from '../catalogue/pages.js';
import { InitialLoading, RouteError, Shell } from './shell.js';

export function createRoutes(client: ApiClient = api): RouteObject[] {
  const browse = async ({ request, params }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const search = url.searchParams;
    if (new Set(search.keys()).size !== search.size || (params.category && search.has('category'))) throw new ApiError('BAD_REQUEST');
    const parsed = catalogueQuerySchema.safeParse({ ...Object.fromEntries(search), ...(params.category ? { category: params.category } : {}) });
    if (!parsed.success) throw new ApiError('BAD_REQUEST');
    const result = await client.list({ ...parsed.data, page: parsed.data.page ?? '1' }, request.signal);
    if (!result.pagination) throw new ApiError('INVALID_RESPONSE');
    if (parsed.data.page && Number(parsed.data.page) !== result.pagination.page) {
      if (result.pagination.page === 1) search.delete('page');
      else search.set('page', String(result.pagination.page));
      throw replace(url.pathname + url.search);
    }
    return { ...result, pagination: result.pagination, filters: parsed.data };
  };
  const browseRoute = { loader: browse, lazy: async () => ({ Component: (await import('../catalogue/browse-page.js')).BrowsePage }) };
  return [{
    id: 'catalogue', element: <Shell />, errorElement: <RouteError />, HydrateFallback: InitialLoading,
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
        { path: 'category/:category', ...browseRoute },
        {
          path: 'products/:id', loader: ({ params, request }) => client.getProduct(params.id!, request.signal),
          lazy: async () => {
            const { ProductPage } = await import('../product/product-page.js');
            return { element: <ProductPage client={client} /> };
          },
        },
        { path: 'search', ...browseRoute },
        { path: '*', element: <RouteError />, loader: () => { throw new ApiError('NOT_FOUND'); } },
      ],
    }],
  }];
}