'use client';

import { useEffect, useRef } from 'react';

export default function ActionButtons({
  onView,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onRestore,
  onApprove,
  onCancel,
  onStockIn,
  onSuspend,
  onCreatePO,
  status,
  isSelf,
  disabledEdit,
  editTooltip,
  className = ''
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bootstrap = window.bootstrap;
    if (!bootstrap) return;

    // Find all tooltip elements inside this component
    const tooltipElements = containerRef.current?.querySelectorAll('[data-bs-toggle="tooltip"]') || [];
    const tooltipInstances = Array.from(tooltipElements).map(el => {
      return new bootstrap.Tooltip(el, {
        trigger: 'hover',
        boundary: 'viewport'
      });
    });

    // Cleanup tooltips on unmount
    return () => {
      tooltipInstances.forEach(instance => instance.dispose());
    };
  }, [
    onView,
    onEdit,
    onDelete,
    onActivate,
    onDeactivate,
    onRestore,
    onApprove,
    onCancel,
    onStockIn,
    onSuspend,
    onCreatePO,
    status,
    isSelf,
    disabledEdit
  ]);

  return (
    <div ref={containerRef} className={`actions-wrapper ${className}`} style={{ minWidth: 'fit-content' }}>
      {onView && (
        <button
          type="button"
          className="action-btn action-btn-view"
          onClick={onView}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="View Details"
          aria-label="View Details"
        >
          <i className="bi bi-eye"></i>
        </button>
      )}

      {onEdit && (
        <button
          type="button"
          className="action-btn action-btn-edit"
          onClick={onEdit}
          disabled={disabledEdit}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={disabledEdit ? (editTooltip || "Cannot be edited") : "Update"}
          aria-label="Update"
          style={{ opacity: disabledEdit ? 0.5 : 1 }}
        >
          <i className="bi bi-pencil-square"></i>
        </button>
      )}

      {onSuspend && (
        <button
          type="button"
          className="action-btn action-btn-suspend"
          onClick={onSuspend}
          disabled={isSelf || status === 'Suspended'}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={isSelf ? "You cannot suspend your own account" : status === 'Suspended' ? "Already Suspended" : "Suspend Account"}
          aria-label="Suspend Account"
          style={{ opacity: isSelf || status === 'Suspended' ? 0.5 : 1 }}
        >
          <i className="bi bi-ban"></i>
        </button>
      )}

      {onActivate && (
        <button
          type="button"
          className="action-btn action-btn-activate"
          onClick={onActivate}
          disabled={isSelf}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={isSelf ? "You cannot activate/deactivate your own account" : "Activate"}
          aria-label="Activate"
          style={{ opacity: isSelf ? 0.5 : 1 }}
        >
          <i className="bi bi-check-circle"></i>
        </button>
      )}

      {onDeactivate && (
        <button
          type="button"
          className="action-btn action-btn-suspend"
          onClick={onDeactivate}
          disabled={isSelf}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={isSelf ? "You cannot activate/deactivate your own account" : "Deactivate"}
          aria-label="Deactivate"
          style={{ opacity: isSelf ? 0.5 : 1 }}
        >
          <i className="bi bi-x-circle"></i>
        </button>
      )}

      {onApprove && (
        <button
          type="button"
          className="action-btn action-btn-activate"
          onClick={onApprove}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Approve Purchase Order"
          aria-label="Approve Purchase Order"
        >
          <i className="bi bi-check-circle"></i>
        </button>
      )}

      {onCancel && (
        <button
          type="button"
          className="action-btn action-btn-suspend"
          onClick={onCancel}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Cancel Purchase Order"
          aria-label="Cancel Purchase Order"
        >
          <i className="bi bi-ban"></i>
        </button>
      )}

      {onStockIn && (
        <button
          type="button"
          className="action-btn action-btn-view"
          onClick={onStockIn}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Receive Stock In"
          aria-label="Receive Stock In"
        >
          <i className="bi bi-box-seam"></i>
        </button>
      )}

      {onCreatePO && (
        <button
          type="button"
          className="action-btn action-btn-view"
          onClick={onCreatePO}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Create Purchase Order"
          aria-label="Create Purchase Order"
        >
          <i className="bi bi-file-earmark-plus"></i>
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className="action-btn action-btn-delete"
          onClick={onDelete}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Delete"
          aria-label="Delete"
        >
          <i className="bi bi-trash"></i>
        </button>
      )}

      {onRestore && (
        <button
          type="button"
          className="action-btn action-btn-restore"
          onClick={onRestore}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Restore from Archive"
          aria-label="Restore from Archive"
        >
          <i className="bi bi-arrow-counterclockwise"></i>
        </button>
      )}
    </div>
  );
}
