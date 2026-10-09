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

  // Assign every CommandItem a stable ordinal in traversal order, then keep
  // the ordinals matching the query. Ordinals (not object identity) survive
  // React's Children cloning.
  const { visible } = useMemo(() => {
    const all = [];
    const walk = (nodes) => {
      const arr = Array.isArray(nodes) ? nodes : [nodes];
      arr.forEach((node) => {
        if (!node || typeof node !== 'object' || !('props' in node)) return;
        if (node.type === CommandItem) all.push(node);
        else if (node.props && node.props.children) walk(node.props.children);
      });
    };
    walk(children);
    const q = query.trim().toLowerCase();
    const keep = new Set();
    all.forEach((node, idx) => {
      if (!q) {
        keep.add(idx);
        return;
      }
      const hay = `${node.props.keywords || ''} ${typeof node.props.children === 'string' ? node.props.children : ''}`.toLowerCase();
      if (q.split(/\s+/).every((part) => hay.includes(part))) keep.add(idx);
    });
    return { visible: keep, total: all.length };
  }, [children, query]);

  // Visible ordinals in traversal order; keyboard position maps onto these.
  const order = useMemo(() => [...visible].sort((a, b) => a - b), [visible]);
  const activeOrdinal = order.length === 0 ? -1 : order[Math.min(activeIndex, order.length - 1)];

  const ordinal = { current: 0 };
  const renderNode = (node) => {
    if (!node || typeof node !== 'object' || !('props' in node)) return node;
    if (node.type === CommandItem) {
      const idx = ordinal.current;
      ordinal.current += 1;
      if (!visible.has(idx)) return null;
      return cloneElement(node, {
        key: `cmd-item-${idx}`,
        'data-active': idx === activeOrdinal || undefined,
        onMouseMove: () => setActiveIndex(order.indexOf(idx)),
      });
    }
    if (node.type === CommandGroup) {
      const before = ordinal.current;
      const rendered = toArray(node.props.children).map(renderNode).filter((n) => n !== null && n !== false);
      if (rendered.length === 0) return null;
      return cloneElement(node, { key: `cmd-group-${before}` }, rendered);
    }
    return node;
  };

  const pick = (idx) => {
    let found = null;
    let cursor = 0;
    const walk = (nodes) => {
      const arr = Array.isArray(nodes) ? nodes : [nodes];
      for (const node of arr) {
        if (!node || typeof node !== 'object' || !('props' in node)) continue;
        if (node.type === CommandItem) {
          if (visible.has(cursor) && cursor === idx) {
            found = node;
            return true;
          }
          cursor += 1;
        } else if (node.props && node.props.children) {
          if (walk(node.props.children)) return true;
        }
      }
      return false;
    };
    walk(children);
    return found;
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(order.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const node = pick(activeOrdinal);
        if (node && typeof node.props.onSelect === 'function') {
          node.props.onSelect();
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [order, activeOrdinal, onOpenChange, pick]);

  return (
    <div className="pcc-command-list" role="listbox">
      {visible.size === 0 ? (
        <div className="pcc-command-empty">No results found.</div>
      ) : (
        Children.map(children, (child) => renderNode(child))
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
