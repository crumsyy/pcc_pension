'use client';

import React from 'react';

/**
 * Global LoadingButton Component
 * Renders a primary/custom button with a circular spinner and 'Processing...' state.
 * Prevents double-submissions by disabling automatically during async operations.
 */
export default function LoadingButton({
  children,
  isLoading = false,
  loadingText = "Processing...",
  className = "btn btn-pcc-primary text-white fw-bold",
  disabled = false,
  type = "button",
  onClick,
  style = {},
  ...props
}) {
  return (
    <button
      type={type}
      className={`position-relative d-inline-flex align-items-center justify-content-center gap-2 ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      style={{
        transition: 'all 0.2s ease-in-out',
        minHeight: '38px',
        ...style
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
            style={{
              width: '1.05rem',
              height: '1.05rem',
              borderWidth: '2px',
              borderColor: 'currentColor transparent currentColor transparent'
            }}
          />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
