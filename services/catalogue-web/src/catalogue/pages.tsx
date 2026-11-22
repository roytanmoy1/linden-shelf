import type { CatalogueResponse, FeaturedProductsResponse } from '@linden-shelf/contracts';
import { SearchX } from 'lucide-react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import { PageHeading } from '../app/page-heading.js';
import { ProductGrid } from './products.js';

export function HomePage() {
  const { products } = useLoaderData<FeaturedProductsResponse>();
  return <><div className="page-heading"><div><p className="eyebrow">Editorial selection</p>
    <PageHeading>Top rated</PageHeading></div><span className="muted">{products.length} products</span></div>
    <ProductGrid products={products} label="Selected top-rated products" featured /></>;
}

export function CategoryPage() {
  const { products, featuredIds } = useLoaderData<CatalogueResponse>();
  const { category } = useParams();
  const selected = new Set(featuredIds);
  const featured = products.filter((product) => selected.has(product.id));
  const remaining = products.filter((product) => !selected.has(product.id));
  return <><div className="page-heading"><div><p className="eyebrow">Category</p>
    <PageHeading className="category-title">{category ?? 'Category'}</PageHeading></div><span className="muted">{products.length} products</span></div>
    <section className="catalogue-section" aria-labelledby="featured-heading">
      <h2 id="featured-heading">Featured</h2>
      {featured.length ? <ProductGrid products={featured} label="Featured products" headingLevel={3} featured />
        : <p className="muted">No featured products in this category.</p>}
    </section>
    <section className="catalogue-section" aria-labelledby="remaining-heading">
      <h2 id="remaining-heading">More in this category</h2>
      {remaining.length ? <ProductGrid products={remaining} label="More products" headingLevel={3} />
        : <p className="muted">No more products in this category.</p>}
    </section></>;
}

export interface SearchData extends CatalogueResponse { query: string }

export function SearchPage() {
  const { products, query } = useLoaderData<SearchData>();
  return <><div className="page-heading"><div><PageHeading>{query ? 'Search results' : 'All products'}</PageHeading>
    {query && <p className="search-term">Results for &quot;{query}&quot;</p>}</div><span className="muted">{products.length} products</span></div>
    {products.length ? <ProductGrid products={products} label="Search results" />
      : <section className="empty-state" role="status"><SearchX size={32} aria-hidden="true" />
        <h2>No matching products</h2><p>No products match &quot;{query}&quot;.</p><Link to="/search">Browse all products</Link>
      </section>}</>;
}