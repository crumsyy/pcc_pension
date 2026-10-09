'use client';

import { useState, useEffect, useMemo, Children, cloneElement, toArray } from 'react';

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

  useEffect(() => {
    if (open && typeof onQueryChange === 'function') onQueryChange(query);
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

  const items = useMemo(() => {
    const found = [];
    const walk = (nodes) => {
      const arr = Array.isArray(nodes) ? nodes : [nodes];
      arr.forEach((node) => {
        if (!node || typeof node !== 'object' || !('props' in node)) return;
        if (node.type === CommandItem) found.push(node);
        else if (node.props && node.props.children) walk(node.props.children);
      });
    };
    walk(children);
    const q = query.trim().toLowerCase();
    if (!q) return found;
    return found.filter((node) => {
      const hay = `${node.props.keywords || ''} ${typeof node.props.children === 'string' ? node.props.children : ''}`.toLowerCase();
      return q.split(/\s+/).every((part) => hay.includes(part));
    });
  }, [children, query]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const node = items[activeIndex];
        if (node && typeof node.props.onSelect === 'function') {
          node.props.onSelect();
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items, activeIndex, onOpenChange]);

  const visible = new Set(items);

  return (
    <div className="pcc-command-list" role="listbox">
      {items.length === 0 ? (
        <div className="pcc-command-empty">No results found.</div>
      ) : (
        Children.map(children, (child) => {
          if (!child || typeof child !== 'object' || !('props' in child)) return child;
          if (child.type === CommandGroup) {
            const kept = toArray(child.props.children).filter((c) => visible.has(c));
            if (kept.length === 0) return null;
            return cloneElement(child, {}, kept.map((c) => {
              const idx = items.indexOf(c);
              return cloneElement(c, { 'data-active': idx === activeIndex || undefined, onMouseMove: () => setActiveIndex(idx) });
            }));
          }
          if (child.type === CommandItem) {
            if (!visible.has(child)) return null;
            const idx = items.indexOf(child);
            return cloneElement(child, { 'data-active': idx === activeIndex || undefined, onMouseMove: () => setActiveIndex(idx) });
          }
          return child;
        })
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
