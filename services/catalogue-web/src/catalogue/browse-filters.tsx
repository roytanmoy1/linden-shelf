import { catalogueQuerySchema, type CatalogueQuery } from '@linden-shelf/contracts';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

interface FilterProps {
  filters: CatalogueQuery;
  categories: string[];
  apply: (next: CatalogueQuery) => void;
  clear: () => void;
  activeCount: number;
}

function FilterForm({ filters, categories, apply, clear, activeCount }: FilterProps) {
  const [error, setError] = useState('');
  const errorId = useId();
  function readDraft(form: HTMLFormElement) {
    const values = Object.fromEntries([...new FormData(form)].filter(([, value]) => value !== ''));
    return catalogueQuerySchema.safeParse({ ...values, ...(filters.q ? { q: filters.q } : {}), ...(filters.sort ? { sort: filters.sort } : {}) });
  }
  return <form className="facet-form" aria-label="Filter products" onChange={(event) => {
    if (error && readDraft(event.currentTarget).success) setError('');
  }} onSubmit={(event) => {
    event.preventDefault();
    const parsed = readDraft(event.currentTarget);
    if (!parsed.success) {
      setError('Enter a valid price range. Maximum must be at least the minimum.');
      event.currentTarget.querySelector<HTMLInputElement>('[name="maxPrice"]')?.focus();
      return;
    }
    setError('');
    apply(parsed.data);
  }}>
    <label className="facet-group">Category<span className="select-picker"><select name="category" defaultValue={filters.category ?? ''}>
      <option value="">All categories</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}
    </select><ChevronDown size={16} aria-hidden="true" /></span></label>
    <fieldset className="facet-group"><legend>Price (USD)</legend><div className="price-fields">
      <label>Minimum price<input type="number" name="minPrice" min="0" max="999999999.99" step="0.01" placeholder="0" defaultValue={filters.minPrice ?? ''} /></label>
      <label>Maximum price<input type="number" name="maxPrice" min="0" max="999999999.99" step="0.01" placeholder="Any" defaultValue={filters.maxPrice ?? ''}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined} /></label>
    </div>{error && <span id={errorId} className="field-error" role="alert">{error}</span>}</fieldset>
    <label className="facet-group">Minimum rating<span className="select-picker"><select name="minRating" defaultValue={filters.minRating ?? ''}>
      <option value="">Any rating</option>{[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{stars} {stars === 1 ? 'star' : 'stars'} &amp; up</option>)}
    </select><ChevronDown size={16} aria-hidden="true" /></span></label>
    <label className="check-field"><input type="checkbox" name="featured" value="1" defaultChecked={filters.featured === '1'} />Editorial picks only</label>
    <button type="submit" className="primary-control">Apply filters</button>
    {activeCount > 0 && <button className="text-control" type="button" onClick={clear}>Clear filters</button>}
  </form>;
}

export function BrowseFilters(props: FilterProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  return <>
    <aside className="filter-rail" aria-label="Product filters"><div className="panel-title"><h2>Filters</h2><SlidersHorizontal size={17} aria-hidden="true" /></div>
      <FilterForm {...props} /></aside>
    <button type="button" ref={trigger} className="mobile-filter secondary-control" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setOpen(true); dialog.current?.showModal(); }}><SlidersHorizontal size={17} aria-hidden="true" /> Filters{props.activeCount > 0 ? ` (${props.activeCount})` : ''}</button>
    <dialog ref={dialog} className="filter-dialog" aria-label="Product filters" onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="panel-title"><h2>Filters</h2><button className="icon-control" type="button" aria-label="Close filters" title="Close filters" onClick={close}><X aria-hidden="true" /></button></div>
      {open && <FilterForm {...props} apply={(next) => { close(); props.apply(next); }} clear={() => { close(); props.clear(); }} />}
    </dialog>
  </>;
}
