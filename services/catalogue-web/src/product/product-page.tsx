import type { Product, ProductResponse } from '@linden-shelf/contracts';
import { ArrowLeft, ChevronRight, Expand, Mail, X } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import type { ApiClient } from '../api/client.js';
import { PageHeading } from '../app/page-heading.js';
import { priceLabel, ProductImage, ProductRating } from '../catalogue/products.js';
import './product.css';

const ContactForm = lazy(() => import('./enquiry.js').then(({ Enquiry }) => ({ default: Enquiry })));

function SalesAction({ product, client }: { product: Product; client: ApiClient }) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef(false);
  return open ? <Suspense fallback={<p role="status">Loading contact form...</p>}>
    <ContactForm product={product} client={client} onCancel={() => { returnFocus.current = true; setOpen(false); }} />
  </Suspense> : <button type="button" className="primary-control enquire-control" ref={(button) => {
    if (button && returnFocus.current) { button.focus(); returnFocus.current = false; }
  }} onClick={() => setOpen(true)}><Mail size={18} aria-hidden="true" />Enquire</button>;
}

function ProductGallery({ product }: { product: Product }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <div className="detail-gallery"><ProductImage product={product} priority onRetry={() => trigger.current?.focus()} />
    <button type="button" className="zoom-control icon-control" ref={trigger} title="Enlarge product photo" aria-label="Enlarge product photo" aria-haspopup="dialog"
      onClick={() => { setOpen(true); dialog.current?.showModal(); }}><Expand size={19} aria-hidden="true" /></button>
    <dialog ref={dialog} aria-label={product.title} className="photo-dialog" onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <button type="button" ref={close} className="zoom-control icon-control" aria-label="Close photo" title="Close photo" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      {open && <ProductImage product={product} priority onRetry={() => close.current?.focus()} />}
    </dialog></div>;
}

export function ProductPage({ client }: { client: ApiClient }) {
  const { product } = useLoaderData<ProductResponse>();
  const navigate = useNavigate();
  const source: unknown = useLocation().state?.browseFrom;
  const back = typeof source === 'string' && source.length <= 2048 && !source.includes('\\')
    && /^(?:\/|\/search(?:\?[^#]*)?|\/category\/[^/?#]+(?:\?[^#]*)?)$/.test(source) ? source : '/search';
  return <><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={back} onClick={(event) => {
    if (source === back && window.history.state?.idx > 0 && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); void navigate(-1);
    }
  }}><ArrowLeft size={16} aria-hidden="true" />Back to results</Link>
    <ChevronRight size={14} aria-hidden="true" /><Link className="category-title" to={`/category/${encodeURIComponent(product.category)}`}>{product.category}</Link></nav>
    <article className="product-detail" key={product.id} aria-labelledby="product-title">
      <div className="detail-identity"><p className="eyebrow">{product.category}</p><PageHeading id="product-title">{product.title}</PageHeading><ProductRating product={product} detailed /></div>
      <ProductGallery product={product} />
      <section className="detail-offer" aria-label="Price and sales enquiry"><div className="detail-pricing"><p className="muted">Catalogue price</p><p className="detail-price">{priceLabel(product.price)}</p></div>
        <SalesAction product={product} client={client} /></section>
      <section className="detail-about" aria-labelledby="about-heading"><h2 id="about-heading">About this item</h2><p className="product-description">{product.description}</p></section>
      <section className="detail-specs" aria-labelledby="spec-heading"><h2 id="spec-heading">Product details</h2><dl>
        <div><dt>Catalogue ID</dt><dd>#{product.id}</dd></div><div><dt>Department</dt><dd className="category-title">{product.category}</dd></div>
      </dl></section>
    </article></>;
}