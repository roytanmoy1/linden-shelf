import type { FeaturedProductsResponse } from '@linden-shelf/contracts';
import { ArrowRight } from 'lucide-react';
import { Link, useLoaderData } from 'react-router-dom';
import { PageHeading } from '../app/page-heading.js';
import { ProductGrid } from './products.js';

export function HomePage() {
  const { products } = useLoaderData<FeaturedProductsResponse>();
  return <><div className="page-heading"><div><p className="eyebrow">Editorial selection</p>
    <PageHeading>Top rated</PageHeading></div><Link className="inline-link" to="/search">Browse catalogue <ArrowRight size={17} aria-hidden="true" /></Link></div>
    <ProductGrid products={products} label="Selected top-rated products" selectedIds={products.map((product) => product.id)} /></>;
}