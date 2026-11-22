import type { CategoriesResponse } from '@linden-shelf/contracts';
import { ArrowLeft, LayoutGrid, RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLoaderData, useLocation, useNavigation, useRevalidator, useRouteError } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { PageHeading, SITE_NAME, type ProductReturnTarget } from './page-heading.js';
import { SearchBar } from './search-bar.js';

export interface ShellData extends CategoriesResponse { categoryError: string | null }

function BrandLink() {
  return <Link className="brand" to="/"><span className="brand-mark" aria-hidden="true">LS</span><span>{SITE_NAME}</span></Link>;
}

export function LoadingCatalogue() {
  const detail = useLocation().pathname.startsWith('/products/');
  return <div className="loading-catalogue" role="status" aria-label="Loading catalogue" aria-busy="true">
    <span className="visually-hidden">Loading catalogue...</span>
    <div className={detail ? 'detail-placeholder' : 'product-grid'} aria-hidden="true">
      {(detail ? [1] : [1, 2, 3, 4, 5]).map((index) => <div className="loading-tile" key={index}>
        <span className="loading-media" /><span className="loading-line" /><span className="loading-line short" />
      </div>)}
    </div>
  </div>;
}

export function InitialLoading() {
  return <div className="page-shell"><header className="site-header"><div className="header-inner"><BrandLink /></div></header>
    <main className="page-content"><LoadingCatalogue /></main></div>;
}

export function Shell() {
  const { categories, categoryError } = useLoaderData<ShellData>();
  const location = useLocation();
  const lastProduct = useRef<ProductReturnTarget | null>(null);
  useEffect(() => {
    if (location.pathname.startsWith('/products/')) {
      const entryKey: unknown = location.state?.browseKey;
      lastProduct.current = typeof entryKey === 'string' ? { entryKey, path: location.pathname } : null;
    }
  }, [location]);
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const loading = navigation.state === 'loading';

  return <div className="page-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="header-inner">
        <BrandLink />
        <SearchBar />
      </div>
    </header>
    <div className="navigation-band"><nav className="nav-inner" aria-label="Categories"><NavLink to="/search" className="browse-link"><LayoutGrid size={16} aria-hidden="true" />All products</NavLink>
      <div className="category-nav">
        <NavLink to="/" end>Top rated</NavLink>
        {categories.map((category) => <NavLink key={category} to={`/category/${encodeURIComponent(category)}`}>{category}</NavLink>)}
      </div></nav>
      {categoryError && <div className="navigation-error">
        <p role="alert">Categories are unavailable.</p>
        <button className="secondary-control" type="button" disabled={revalidator.state !== 'idle'} onClick={() => void revalidator.revalidate()}><RefreshCw size={16} aria-hidden="true" />Retry categories</button>
      </div>}
    </div>
    <span className="visually-hidden" aria-live="polite" aria-atomic="true">{loading ? 'Loading next page' : ''}</span>
    <main id="main" tabIndex={-1} className="page-content" aria-busy={loading}><Outlet context={lastProduct} /></main>
    <footer className="site-footer"><span>{SITE_NAME}</span><Link to="/search">All products</Link></footer>
    <ScrollRestoration storageKey="linden:scroll:v1" />
  </div>;
}

export function RouteError() {
  const error: unknown = useRouteError();
  const failure = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
  const revalidator = useRevalidator();
  const missing = failure.code === 'NOT_FOUND';
  const invalid = failure.code === 'BAD_REQUEST';
  return <section className="page-error">
    <PageHeading>{missing ? 'Not found' : invalid ? 'Invalid address' : 'Unable to load catalogue'}</PageHeading>
    <p className="public-alert" role="alert">{failure.message}</p>
    <div className="action-row">
      {!missing && !invalid && <button type="button" className="primary-control"
        disabled={revalidator.state !== 'idle'} onClick={() => void revalidator.revalidate()}><RefreshCw size={18} aria-hidden="true" />Retry</button>}
      <Link to="/" className="inline-link"><ArrowLeft size={16} aria-hidden="true" />Back to top rated</Link>
    </div>
  </section>;
}