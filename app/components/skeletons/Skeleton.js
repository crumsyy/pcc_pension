'use client';

import React from 'react';

/**
 * Base Skeleton block
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className={`pcc-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonText for paragraph or line placeholders
 */
export function SkeletonText({
  lines = 1,
  width = '100%',
  height = '0.9rem',
  gap = '0.5rem',
  lastLineWidth = '70%',
  className = '',
  style = {},
}) {
  return (
    <div
      className={`d-flex flex-column ${className}`}
      style={{ gap, ...style }}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1 && lines > 1;
        return (
          <Skeleton
            key={index}
            width={isLast ? lastLineWidth : width}
            height={height}
          />
        );
      })}
    </div>
  );
}

/**
 * SkeletonAvatar / circular or rounded media placeholder
 */
export function SkeletonAvatar({
  size = '36px',
  borderRadius = '50%',
  className = '',
  style = {},
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={borderRadius}
      className={className}
      style={{ flexShrink: 0, ...style }}
    />
  );
}

/**
 * SkeletonButton matching button dimensions
 */
export function SkeletonButton({
  width = '110px',
  height = '36px',
  borderRadius = '6px',
  className = '',
  style = {},
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      className={className}
      style={style}
    />
  );
}

/**
 * SkeletonInput matching form input fields
 */
export function SkeletonInput({
  width = '100%',
  height = '38px',
  borderRadius = '6px',
  className = '',
  style = {},
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      className={className}
      style={style}
    />
  );
}

/**
 * SkeletonCard container matching card-module
 */
export function SkeletonCard({
  children,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`card-module rounded ${className}`}
      style={{
        backgroundColor: '#fff',
        border: '1px solid var(--pcc-mist)',
        padding: '1.25rem',
        ...style,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * SkeletonTable rendering realistic table rows and columns
 */
export function SkeletonTable({
  columns = 6,
  rows = 5,
  colWidths = [],
  showHeader = true,
  className = '',
  style = {},
}) {
  return (
    <div className={`table-responsive ${className}`} style={style} aria-hidden="true">
      <table className="table align-middle mb-0">
        {showHeader && (
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, cIdx) => (
                <th key={cIdx} style={{ width: colWidths[cIdx] || 'auto' }}>
                  <Skeleton width={colWidths[cIdx] ? '80%' : '75px'} height="0.85rem" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx}>
              {Array.from({ length: columns }).map((_, cIdx) => (
                <td key={cIdx}>
                  <Skeleton
                    width={
                      colWidths[cIdx]
                        ? '90%'
                        : cIdx === 0
                        ? '30px'
                        : cIdx === columns - 1
                        ? '65px'
                        : `${55 + ((rIdx * 17 + cIdx * 29) % 35)}%`
                    }
                    height="0.9rem"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SkeletonChart placeholder
 */
export function SkeletonChart({
  height = '240px',
  className = '',
  style = {},
}) {
  return (
    <div
      className={`d-flex align-items-end justify-content-between p-3 rounded ${className}`}
      style={{
        height,
        backgroundColor: 'rgba(0,0,0,0.02)',
        border: '1px dashed var(--pcc-mist)',
        gap: '12px',
        ...style,
      }}
      aria-hidden="true"
    >
      {[40, 65, 30, 85, 55, 95, 70, 45, 80, 60, 90, 75].map((h, idx) => (
        <div
          key={idx}
          className="flex-grow-1 d-flex flex-column align-items-center"
          style={{ height: '100%', justifyContent: 'flex-end', gap: '6px' }}
        >
          <Skeleton width="100%" height={`${h}%`} borderRadius="4px 4px 0 0" />
          <Skeleton width="60%" height="8px" borderRadius="3px" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
