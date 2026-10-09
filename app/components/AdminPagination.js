'use client';

import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';

export const ADMIN_PAGE_SIZE = 10;

export function getPageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const nums = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) nums.push('…');
  for (let n = start; n <= end; n++) nums.push(n);
  if (end < totalPages - 1) nums.push('…');
  nums.push(totalPages);
  return nums;
}

export function paginate(list, page, pageSize = ADMIN_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    totalPages,
    safePage,
    rows: list.slice((safePage - 1) * pageSize, safePage * pageSize),
    start: list.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, list.length),
    total: list.length,
  };
}

/**
 * AdminPagination Component
 * Shared footer: "Showing X–Y of Z <label>" + shadcn-style pager.
 */
export default function AdminPagination({
  page,
  totalPages,
  onPage,
  start,
  end,
  total,
  label = 'records',
  ariaLabel = 'Pagination',
}) {
  if (total === 0) return null;
  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mt-3">
      <small className="text-muted">
        Showing {start}–{end} of {total} {label}
      </small>
      <Pagination aria-label={ariaLabel}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page <= 1} onClick={() => onPage(page - 1)} />
          </PaginationItem>
          {getPageNumbers(page, totalPages).map((n, idx) => (
            n === '…' ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={n}>
                <PaginationLink isActive={n === page} onClick={() => onPage(n)}>
                  {n}
                </PaginationLink>
              </PaginationItem>
            )
          ))}
          <PaginationItem>
            <PaginationNext disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
