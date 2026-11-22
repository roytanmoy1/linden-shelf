import { CATALOGUE_BOUNDS } from '@linden-shelf/contracts';
import { ArrowUpLeft, Clock3, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const HISTORY_KEY = 'linden:recent-searches:v1';
const LIMIT = 5;
const searchUrl = (term: string) => term ? `/search?${new URLSearchParams({ q: term })}` : '/search';

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw || raw.length > 7000) return [];
    const terms: unknown = JSON.parse(raw);
    if (!Array.isArray(terms)) return [];
    return terms.filter((term): term is string => typeof term === 'string' && !!term.trim() && term.length <= CATALOGUE_BOUNDS.query)
      .slice(0, LIMIT).map((term) => term.trim());
  } catch { return []; }
}

export function SearchBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [terms, setTerms] = useState(loadHistory);
  const [open, setOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const history = useRef<HTMLElement>(null);
  const focusFirstResult = useRef(false);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (!event.key || event.key === HISTORY_KEY) setTerms(loadHistory()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    if (focusFirstResult.current) {
      focusFirstResult.current = false;
      history.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    }
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function save(next: string[]) {
    setTerms(next);
    try {
      if (next.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      else localStorage.removeItem(HISTORY_KEY);
    } catch { return; }
  }

  function remember(term: string) {
    if (term) save([term, ...terms.filter((old) => old.toLowerCase() !== term.toLowerCase())].slice(0, LIMIT));
    setOpen(false);
  }

  function closeHistory() {
    focusFirstResult.current = false;
    search.current?.focus();
    setOpen(false);
  }

  return <div className="search-tools" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); closeHistory(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = Array.from(history.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const position = links.indexOf(event.target as HTMLAnchorElement);
    if (event.target !== search.current && position < 0) return;
    event.preventDefault();
    focusFirstResult.current = !open && event.key === 'ArrowDown';
    setOpen(true);
    if (event.key === 'ArrowDown') links[Math.min(position + 1, links.length - 1)]?.focus();
    else if (position <= 0) search.current?.focus();
    else links[position - 1]?.focus();
  }}>
    <form className="search-form" role="search" aria-label="Catalogue search" action="/search" method="get" onSubmit={(event) => {
      event.preventDefault();
      const term = String(new FormData(event.currentTarget).get('q') ?? '').trim().slice(0, CATALOGUE_BOUNDS.query);
      if (!term) { search.current?.focus(); setOpen(true); return; }
      remember(term);
      void navigate(searchUrl(term));
    }}>
      <label className="visually-hidden" htmlFor="catalogue-search">Search products</label>
      <input id="catalogue-search" ref={search} className="search-input" type="search" name="q" autoComplete="off"
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} aria-controls={open ? 'search-history' : undefined}
        key={location.pathname + location.search} defaultValue={new URLSearchParams(location.search).get('q') ?? ''}
        placeholder="Search products" maxLength={CATALOGUE_BOUNDS.query} />
      <button className="search-submit" type="submit" aria-label="Search" title="Search" aria-expanded={open}
        aria-controls={open ? 'search-history' : undefined}><Search size={20} aria-hidden="true" /></button>
    </form>
    {open && <section id="search-history" ref={history} aria-label="Recent searches" className="history-panel">
      <div className="panel-title"><strong>Recent searches</strong><button className="icon-control" type="button" title="Close recent searches"
        aria-label="Close recent searches" onClick={closeHistory}><X size={17} aria-hidden="true" /></button></div>
      {terms.length ? <><ul>{terms.map((term) => <li key={term}><Link to={searchUrl(term)} onClick={() => remember(term)}>
        <Clock3 size={16} aria-hidden="true" /><span>{term}</span><ArrowUpLeft size={16} aria-hidden="true" /></Link></li>)}</ul>
        <button type="button" className="history-clear text-control" onClick={() => { save([]); search.current?.focus(); }}><Trash2 size={15} aria-hidden="true" />Clear history</button></>
        : <p className="muted">No recent searches.</p>}
    </section>}
  </div>;
}
