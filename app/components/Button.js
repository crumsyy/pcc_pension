'use client';

import React from 'react';

/**
 * Standardized PCC Button Component
 * Enforces filled style by default (avoiding outline styles unless specified)
 * and guarantees proper padding and spacing so text is not flush with edges.
 */
export default function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'secondary' | 'dark'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  // Map variant to filled Bootstrap class by default
  const variantClassMap = {
    primary: 'btn-primary text-white',
    success: 'btn-success text-white',
    danger: 'btn-danger text-white',
    warning: 'btn-warning text-dark',
    info: 'btn-info text-white',
    secondary: 'btn-secondary text-white',
    dark: 'btn-dark text-white',
  };

  const filledClass = variantClassMap[variant] || 'btn-primary text-white';

  // Enforce consistent padding: px-4 py-2 by default (ensures text is not flush against edges)
  const sizeClass = size === 'sm' 
    ? 'px-3.5 py-1.5 fs-7' 
    : size === 'lg' 
    ? 'px-5 py-2.5 fs-5' 
    : 'px-4 py-2';

  return (
    <button
      type={type}
      className={`btn ${filledClass} ${sizeClass} fw-semibold shadow-xs d-inline-flex align-items-center justify-content-center ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: '8px',
        letterSpacing: '0.01em',
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
