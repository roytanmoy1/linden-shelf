import type { Product } from '@linden-shelf/contracts';
import { Bookmark, ImageOff, RotateCcw, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
export const priceLabel = (price: number) => dollars.format(price);

export function ProductImage({ product, priority = false, onRetry }: { product: Product; priority?: boolean; onRetry?: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const [loadedUrl, setLoadedUrl] = useState<string>();
  return <div className={`product-media${loadedUrl !== product.image && failedUrl !== product.image ? ' image-pending' : ''}`}>
    {failedUrl === product.image ? <span className="image-unavailable"><ImageOff size={28} aria-hidden="true" />Image unavailable
      {onRetry && <button type="button" className="secondary-control" onClick={() => { setLoadedUrl(undefined); setFailedUrl(undefined); onRetry(); }}>
        <RotateCcw size={16} aria-hidden="true" />Retry photo</button>}</span>
      : <img key={product.image} src={`/api/products/${product.id}/photo`} alt={product.title} width={480} height={360} decoding="async"
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoadedUrl(product.image)} onError={() => setFailedUrl(product.image)} />}
  </div>;
}

export function ProductRating({ product, detailed = false }: { product: Product; detailed?: boolean }) {
  const score = product.rating.rate.toFixed(1);
  const reviews = `${product.rating.count} ${product.rating.count === 1 ? 'review' : 'reviews'}`;
  return <span className="product-rating" id={`product-${product.id}-rating`}><span className="rating-stars" aria-hidden="true">{(detailed ? [1, 2, 3, 4, 5] : [1]).map((star) =>
    <Star key={star} size={15} fill={!detailed || star <= Math.round(product.rating.rate) ? 'currentColor' : 'none'} />)}</span>
    {detailed ? `${score} / 5 (${reviews})` : <><span aria-hidden="true">{score} <span className="review-count">({product.rating.count})</span></span>
      <span className="visually-hidden">{score} out of 5 from {reviews}</span></>}</span>;
}

export function ProductGrid({ products, label, selectedIds, headingLevel = 2 }: {
  products: Product[]; label: string; selectedIds: readonly number[]; headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const location = useLocation();
  return <ul className="product-grid" role="list" aria-label={label}>
    {products.map((product, index) => <li key={product.id} className="product-card">
        <ProductImage product={product} priority={index === 0} />
        {selectedIds.includes(product.id) && <span className="editorial-label"><Bookmark size={13} aria-hidden="true" />Selected</span>}
        <div className="product-summary">
          <span className="product-category">{product.category}</span>
          <Heading><Link className="card-link" to={`/products/${product.id}`} state={{ browseFrom: location.pathname + location.search, browseKey: location.key }}
            aria-describedby={`product-${product.id}-price product-${product.id}-rating`}>{product.title}</Link></Heading>
          <div className="card-values"><span className="product-price" id={`product-${product.id}-price`}>{priceLabel(product.price)}</span>
            <ProductRating product={product} /></div>
        </div>
    </li>)}
  </ul>;
}