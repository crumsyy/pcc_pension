'use client';

import React from 'react';

/**
 * Pagination (shadcn-style API, button-based).
 *
 * <Pagination>
 *   <PaginationContent>
 *     <PaginationItem><PaginationPrevious onClick={...} disabled={...} /></PaginationItem>
 *     <PaginationItem><PaginationLink isActive onClick={...}>1</PaginationLink></PaginationItem>
 *     <PaginationItem><PaginationEllipsis /></PaginationItem>
 *     <PaginationItem><PaginationNext onClick={...} /></PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 */
export function Pagination({ children, className = '', ...props }) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={['pcc-pagination', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </nav>
  );
}

export function PaginationContent({ children, className = '', ...props }) {
  return (
    <ul className={['pcc-pagination-content', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </ul>
  );
}

export function PaginationItem({ children, className = '', ...props }) {
  return (
    <li className={['pcc-pagination-item', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </li>
  );
}

function PaginationButton({ className = '', isActive = false, disabled = false, children, ...props }) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      disabled={disabled}
      className={['pcc-pagination-link', isActive ? 'pcc-pagination-link-active' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}

export function PaginationLink({ ...props }) {
  return <PaginationButton {...props} />;
}

export function PaginationPrevious({ children = 'Prev', ...props }) {
  return <PaginationButton {...props}>{children}</PaginationButton>;
}

export function PaginationNext({ children = 'Next', ...props }) {
  return <PaginationButton {...props}>{children}</PaginationButton>;
}

export function PaginationEllipsis({ className = '', ...props }) {
  return (
    <span aria-hidden="true" className={['pcc-pagination-ellipsis', className].filter(Boolean).join(' ')} {...props}>
      …
    </span>
  );
}
