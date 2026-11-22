import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import { createRoutes } from './app/routes.js';
import { CatalogueTheme } from './app/theme.js';
import './app/catalogue.css';

const router = createBrowserRouter(createRoutes());
createRoot(document.getElementById('root')!).render(
  <StrictMode><CatalogueTheme><RouterProvider router={router} /></CatalogueTheme></StrictMode>,
);
