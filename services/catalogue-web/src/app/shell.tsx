import { Button, Input, MessageBar, MessageBarBody, Skeleton, SkeletonItem } from '@fluentui/react-components';
import { CATALOGUE_BOUNDS, type CategoriesResponse } from '@linden-shelf/contracts';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { Form, Link, NavLink, Outlet, useLoaderData, useLocation, useNavigation, useRevalidator, useRouteError } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { PageHeading, SITE_NAME } from './page-heading.js';

export interface ShellData extends CategoriesResponse { categoryError: string | null }

function BrandLink() {
  return <Link className="brand" to="/"><span className="brand-mark" aria-hidden="true">LS</span><span>{SITE_NAME}</span></Link>;
}

export function LoadingCatalogue() {
  return <div className="loading-catalogue" role="status" aria-label="Loading catalogue" aria-busy="true">
    <span className="muted">Loading catalogue...</span>
    <Skeleton className="product-grid" aria-hidden="true" animation="pulse">
      {[1, 2, 3, 4, 5].map((index) => <div className="loading-tile" key={index}>
        <SkeletonItem className="loading-media" shape="rectangle" />
        <SkeletonItem size={16} /><SkeletonItem size={12} />
      </div>)}
    </Skeleton>
  </div>;
}

export function InitialLoading() {
  return <div className="page-shell"><header className="site-header"><div className="header-inner"><BrandLink /></div></header>
    <main className="page-content"><LoadingCatalogue /></main></div>;
}

export function Shell() {
  const { categories, categoryError } = useLoaderData<ShellData>();
  const location = useLocation();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const loading = navigation.state === 'loading';

  return <div className="page-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="header-inner">
        <BrandLink />
        <Form className="search-form" role="search" aria-label="Catalogue search" method="get" action="/search">
          <label className="visually-hidden" htmlFor="catalogue-search">Search products</label>
          <Input id="catalogue-search" name="q" type="search" className="search-input" size="large"
            key={`${location.pathname}${location.search}`} defaultValue={new URLSearchParams(location.search).get('q') ?? ''}
            maxLength={CATALOGUE_BOUNDS.query} placeholder="Search products" />
          <Button type="submit" appearance="primary" size="large" icon={<Search aria-hidden="true" size={18} />}>Search</Button>
        </Form>
      </div>
    </header>
    <div className="navigation-band">
      <nav className="category-nav" aria-label="Categories">
        <NavLink to="/" end>Top rated</NavLink>
        {categories.map((category) => <NavLink key={category} to={`/category/${encodeURIComponent(category)}`}>{category}</NavLink>)}
      </nav>
      {categoryError && <div className="navigation-error">
        <MessageBar intent="error" role="alert"><MessageBarBody>Categories are unavailable.</MessageBarBody></MessageBar>
        <Button icon={<RefreshCw size={16} aria-hidden="true" />} disabled={revalidator.state !== 'idle'}
          onClick={() => void revalidator.revalidate()}>Retry categories</Button>
      </div>}
    </div>
    <main id="main" className="page-content" aria-busy={loading}>{loading ? <LoadingCatalogue /> : <Outlet />}</main>
    <footer className="site-footer"><span>{SITE_NAME}</span><Link to="/search">All products</Link></footer>
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
    <MessageBar intent="error" role="alert"><MessageBarBody>{failure.message}</MessageBarBody></MessageBar>
    <div className="action-row">
      {!missing && !invalid && <Button appearance="primary" icon={<RefreshCw size={18} aria-hidden="true" />}
        disabled={revalidator.state !== 'idle'} onClick={() => void revalidator.revalidate()}>Retry</Button>}
      <Link to="/" className="inline-link"><ArrowLeft size={16} aria-hidden="true" />Back to top rated</Link>
    </div>
  </section>;
}