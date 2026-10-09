'use client';

import { useState, useEffect, useRef, cloneElement, toArray } from 'react';

/**
 * Command palette (shadcn-style API).
 *
 * <CommandDialog open={open} onOpenChange={setOpen} placeholder="...">
 *   <CommandInput ... /> (built in — value/onValueChange controlled internally unless provided)
 *   <CommandList>
 *     <CommandEmpty>No results.</CommandEmpty>
 *     <CommandGroup heading="Pages">...</CommandGroup>
 *   </CommandList>
 * </CommandDialog>
 *
 * <CommandItem keywords="..." onSelect={() => ...}>Label</CommandItem>
 * Filtering is client-side over `keywords` (+ children text); async sections
 * are passed in as already-filtered items by the parent.
 */
export function CommandDialog({ open, onOpenChange, onQueryChange, children, placeholder = 'Type to search…' }) {
  const [query, setQuery] = useState('');
  const lastSentQuery = useRef(null);

  useEffect(() => {
    if (open && typeof onQueryChange === 'function' && lastSentQuery.current !== query) {
      lastSentQuery.current = query;
      onQueryChange(query);
    }
  }, [query, open, onQueryChange]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="pcc-command-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="pcc-command" role="dialog" aria-modal="true" aria-label="Search">
        <div className="pcc-command-input-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            autoFocus
            className="pcc-command-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <CommandList query={query} onOpenChange={onOpenChange}>
          {children}
        </CommandList>
      </div>
    </div>
  );
}

export function CommandList({ children, query, onOpenChange }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [watchedQuery, setWatchedQuery] = useState(query);
  if (watchedQuery !== query) {
    setWatchedQuery(query);
    setActiveIndex(0);
  }

  const matchesQuery = (node) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = `${node.props.keywords || ''} ${typeof node.props.children === 'string' ? node.props.children : ''}`.toLowerCase();
    return q.split(/\s+/).every((part) => hay.includes(part));
  };

  // One traversal per render: collect visible items AND render them.
  // Positions are plain indexes into the visible array built below —
  // no element-identity tracking anywhere (React may clone elements).
  const each = (kids, fn) => (Array.isArray(kids) ? kids : [kids]).forEach(fn);
  const isElem = (node) => node && typeof node === 'object' && 'props' in node;

  // Count visible items first so the highlight index is valid before
  // rendering starts. Positions are plain indexes — no element-identity
  // tracking anywhere (React may clone elements).
  let visibleCount = 0;
  const countKids = (kids) => each(kids, (node) => {
    if (!isElem(node)) return;
    if (node.type === CommandItem) {
      if (matchesQuery(node)) visibleCount += 1;
    } else if (node.type === CommandGroup) {
      countKids(node.props.children);
    }
  });
  countKids(children);
  const safeActive = visibleCount === 0 ? -1 : Math.min(activeIndex, visibleCount - 1);

  const pickable = [];
  let renderPos = -1;
  const renderKids = (kids) => {
    const out = [];
    each(kids, (node) => {
      if (!isElem(node)) return;
      if (node.type === CommandItem) {
        if (!matchesQuery(node)) return;
        renderPos += 1;
        const pos = renderPos;
        pickable.push(node);
        out.push(cloneElement(node, {
          key: `cmd-item-${pos}`,
          'data-active': pos === safeActive || undefined,
          onMouseMove: () => setActiveIndex(pos),
        }));
      } else if (node.type === CommandGroup) {
        const rendered = renderKids(node.props.children);
        if (rendered.length === 0) return;
        out.push(cloneElement(node, { key: `cmd-group-${rendered.length}-${out.length}` }, rendered));
      } else {
        out.push(node);
      }
    });
    return out;
  };
  const rendered = renderKids(children);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(pickable.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const node = pickable[safeActive];
        if (node && typeof node.props.onSelect === 'function') {
          node.props.onSelect();
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pickable, safeActive, onOpenChange]);

  return (
    <div className="pcc-command-list" role="listbox">
      {pickable.length === 0 ? (
        <div className="pcc-command-empty">No results found.</div>
      ) : (
        rendered
      )}
    </div>
  );
}

export function CommandGroup({ children, heading, className = '', ...props }) {
  return (
    <div className={['pcc-command-group', className].filter(Boolean).join(' ')} {...props}>
      {heading && <div className="pcc-command-group-heading">{heading}</div>}
      {children}
    </div>
  );
}

export function CommandItem({ children, onSelect, keywords = '', className = '', ...props }) {
  // Strip internal props before spreading onto the DOM node.
  const { onMouseMove, ...rest } = props;
  return (
    <div
      role="option"
      aria-selected={rest['data-active'] ? 'true' : 'false'}
      className={['pcc-command-item', className].filter(Boolean).join(' ')}
      onMouseMove={onMouseMove}
      onClick={() => {
        if (typeof onSelect === 'function') onSelect();
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CommandEmpty({ children = 'No results found.', className = '', ...props }) {
  return (
    <div className={['pcc-command-empty', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}
