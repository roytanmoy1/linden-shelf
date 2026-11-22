import type { Product } from '@linden-shelf/contracts';
import { ImageOff, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
export const priceLabel = (price: number) => dollars.format(price);

export function ProductImage({ product, priority = false }: { product: Product; priority?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <div className="product-media">
    {failedUrl === product.image ? <span className="image-unavailable"><ImageOff size={28} aria-hidden="true" />Image unavailable</span>
      : <img key={product.image} src={product.image} alt={product.title} width={480} height={360} decoding="async"
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} onError={() => setFailedUrl(product.image)} />}
  </div>;
}

export function ProductRating({ product }: { product: Product }) {
  return <span className="product-rating"><Star size={15} aria-hidden="true" />
    {product.rating.rate.toFixed(1)} / 5 ({product.rating.count} reviews)</span>;
}

export function ProductGrid({ products, label, featured = false, headingLevel = 2 }: {
  products: Product[]; label: string; featured?: boolean; headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <ul className="product-grid" aria-label={label}>
    {products.map((product, index) => <li key={product.id}>
      <Link className="product-card" to={`/products/${product.id}`}>
        <ProductImage product={product} priority={index === 0} />
        <div className="product-summary">
          <span className="product-category">{product.category}</span>
          <Heading id={`product-${product.id}-title`}>{product.title}</Heading>
          {featured && <span className="editorial-label">Selected</span>}
          <ProductRating product={product} />
          <span className="product-price">{priceLabel(product.price)}</span>
        </div>
      </Link>
    </li>)}
  </ul>;
}