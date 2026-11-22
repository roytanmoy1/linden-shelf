import type { ProductResponse } from '@linden-shelf/contracts';
import { ArrowLeft } from 'lucide-react';
import { Link, useLoaderData } from 'react-router-dom';
import type { ApiClient } from '../api/client.js';
import { PageHeading } from '../app/page-heading.js';
import { priceLabel, ProductImage, ProductRating } from '../catalogue/products.js';
import { Enquiry } from './enquiry.js';

export function ProductPage({ client }: { client: ApiClient }) {
  const { product } = useLoaderData<ProductResponse>();
  return <>
    <Link className="inline-link category-title" to={`/category/${encodeURIComponent(product.category)}`}>
      <ArrowLeft size={16} aria-hidden="true" />{product.category}</Link>
    <div className="product-detail" key={product.id}>
      <ProductImage product={product} priority />
      <section className="product-meta" aria-labelledby="product-title">
        <p className="product-category">{product.category}</p>
        <PageHeading id="product-title">{product.title}</PageHeading>
        <p className="detail-price">{priceLabel(product.price)}</p>
        <ProductRating product={product} />
        <p className="product-description">{product.description}</p>
        <Enquiry product={product} client={client} />
      </section>
    </div>
  </>;
}