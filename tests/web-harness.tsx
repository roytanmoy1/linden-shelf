import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { createApiClient } from '../services/catalogue-web/src/api/client.js';
import { createRoutes } from '../services/catalogue-web/src/app/routes.js';
import { catalogueResponses } from './fixtures.js';

const routers: ReturnType<typeof createMemoryRouter>[] = [];
afterEach(() => routers.splice(0).forEach((router) => router.dispose()));

export function renderCatalogue(path = '/', overrides: Record<string, (options?: RequestInit) => Promise<Response>> = {}) {
  const responses = catalogueResponses();
  const fetcher = vi.fn<typeof fetch>(async (input, options) => {
    const url = String(input);
    const override = overrides[url];
    if (override) return (await override(options)).clone();
    if (!responses.has(url)) return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found', details: null } }, { status: 404 });
    return Response.json(responses.get(url));
  });
  const router = createMemoryRouter(createRoutes(createApiClient(fetcher)), { initialEntries: [path] });
  routers.push(router);
  render(<div className="catalogue-app"><RouterProvider router={router} /></div>);
  return { router, fetcher, responses, user: userEvent.setup() };
}

export function productLinks() {
  return within(screen.getByRole('main')).getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products/'));
}
