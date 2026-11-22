import { catalogueParams, sortLabels, type CatalogueQuery, type CatalogueResponse } from '@linden-shelf/contracts';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, SearchX, X } from 'lucide-react';
import { Link, useLoaderData, useLocation, useNavigate, useNavigation, useParams, useRouteLoaderData } from 'react-router-dom';
import { PageHeading } from '../app/page-heading.js';
import type { ShellData } from '../app/shell.js';
import { BrowseFilters } from './browse-filters.js';
import { priceLabel, ProductGrid } from './products.js';
import './browse.css';

type BrowseData = CatalogueResponse & { pagination: NonNullable<CatalogueResponse['pagination']>; filters: CatalogueQuery };

function browseUrl(filters: CatalogueQuery, categoryRoute: boolean) {
  const params = catalogueParams(filters);
  const route = categoryRoute && filters.category ? `/category/${encodeURIComponent(filters.category)}` : '/search';
  if (categoryRoute) params.delete('category');
  if (params.get('page') === '1') params.delete('page');
  return params.size ? `${route}?${params}` : route;
}

function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (number: number) => string }) {
  if (pageCount < 2) return null;
  const numbers = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((value) => value > 0 && value <= pageCount).sort((first, second) => first - second);
  return <nav className="pagination" aria-label="Result pages">
    {page > 1 && <Link to={href(page - 1)} rel="prev" aria-label="Previous page" title="Previous page"><ChevronLeft aria-hidden="true" /></Link>}
    {numbers.map((value, index) => <span className="page-number" key={value}>
      {index > 0 && value - numbers[index - 1]! > 1 && <span aria-hidden="true">...</span>}
      <Link to={href(value)} aria-label={`Page ${value}`} aria-current={value === page ? 'page' : undefined}>{value}</Link></span>)}
    {page < pageCount && <Link to={href(page + 1)} rel="next" aria-label="Next page" title="Next page"><ChevronRight aria-hidden="true" /></Link>}
  </nav>;
}

export function BrowsePage() {
  const { products, featuredIds, pagination, filters } = useLoaderData<BrowseData>();
  const { categories } = useRouteLoaderData('catalogue') as ShellData;
  const category = useParams().category;
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const href = (next: CatalogueQuery) => browseUrl(next, !!category);
  const apply = (next: CatalogueQuery) => { void navigate(href(next)); };
  const clearHref = href({ ...(filters.q ? { q: filters.q } : {}), sort: filters.sort });
  const appliedFilters = ([
    ['category', filters.category],
    ['minPrice', filters.minPrice && `Minimum price: ${priceLabel(Number(filters.minPrice))}`],
    ['maxPrice', filters.maxPrice && `Maximum price: ${priceLabel(Number(filters.maxPrice))}`],
    ['minRating', filters.minRating && `Minimum rating: ${filters.minRating}/5`],
    ['featured', filters.featured && 'Editorial picks only'],
  ] as const).filter(([, label]) => label);
  const grouped = !!category && !filters.sort;
  const selected = new Set(featuredIds);
  const heading = category ?? (filters.q ? 'Search results' : 'All products');
  const first = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const last = Math.min(pagination.total, pagination.page * pagination.pageSize);
  return <div className="browse-layout">
      <header className="browse-heading">
        <div className="browse-title"><PageHeading className={category ? 'category-title' : ''}>{heading}</PageHeading>
          <span className="result-count" role="status" aria-live="polite" aria-atomic="true">{pagination.pageCount > 1 ? `${first}–${last} of ` : ''}{pagination.total} {pagination.total === 1 ? 'product' : 'products'}</span></div>
        {filters.q && <p className="search-term">Results for &quot;{filters.q}&quot;</p>}
      </header>
      <BrowseFilters key={location.pathname + location.search} filters={filters} categories={categories} apply={apply} activeCount={appliedFilters.length}
        clear={() => { void navigate(clearHref); }} />
      <div className="result-tools"><label><span className="sort-caption">Sort by</span> <span className="select-picker sort-picker"><select disabled={navigation.state !== 'idle'} value={filters.sort ?? ''} onChange={(event) => {
        const sort = event.currentTarget.value as CatalogueQuery['sort'];
        apply({ ...filters, page: undefined, sort: sort || undefined });
      }}><option value="">Recommended</option>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></span></label></div>
      <div className="browse-results">
      {appliedFilters.length > 0 && <ul className="applied-filters" role="list" aria-label="Applied filters">{appliedFilters.map(([key, label]) =>
        <li key={key}><Link to={href({ ...filters, [key]: undefined, page: undefined })} aria-label={`Remove filter: ${label}`}>
          <span>{label}</span><X size={15} aria-hidden="true" /></Link></li>)}</ul>}
      {!products.length ? <section className="empty-state"><SearchX size={32} aria-hidden="true" /><h2>No matching products</h2>
        <p>{filters.q ? `No products match “${filters.q}”${appliedFilters.length ? ' with these filters' : ''}.` : 'No products match these filters.'}</p>
        {appliedFilters.length ? <Link to={clearHref}><RotateCcw size={16} aria-hidden="true" />Clear filters</Link> : <Link to="/search">Browse all products<ChevronRight size={16} aria-hidden="true" /></Link>}</section>
        : grouped ? [true, false].map((isFeatured) => {
          const items = products.filter((item) => selected.has(item.id) === isFeatured);
          if (!items.length && pagination.pageCount > 1) return null;
          const title = isFeatured ? 'Featured' : 'More in this category';
          return <section key={title} className="catalogue-section" aria-label={title}><h2>{title}</h2>
            {items.length ? <ProductGrid products={items} label={isFeatured ? 'Featured products' : 'More products'} headingLevel={3} selectedIds={featuredIds} />
              : <p className="muted">{isFeatured ? 'No featured products in this category.' : 'No more products in this category.'}</p>}</section>;
        }) : <ProductGrid products={products} label="Search results" selectedIds={featuredIds} />}
      <Pagination {...pagination} href={(page) => href({ ...filters, page: String(page) })} />
      </div>
    </div>;
}
