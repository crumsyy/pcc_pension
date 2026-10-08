'use client';

import React from 'react';

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
 * Shared footer: "Showing X–Y of Z <label>" + Prev/windowed-numbers/Next.
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
      <nav aria-label={ariaLabel}>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button type="button" className="page-link" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Prev
            </button>
          </li>
          {getPageNumbers(page, totalPages).map((n, idx) => (
            n === '…' ? (
              <li key={`ellipsis-${idx}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
                <button type="button" className="page-link" onClick={() => onPage(n)}>
                  {n}
                </button>
              </li>
            )
          ))}
          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
            <button type="button" className="page-link" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
