'use client';

import { useEffect, useRef } from 'react';

export default function ActionButtons({
  onView,
  onEdit,
  onDelete,
  onArchive,
  onActivate,
  onDeactivate,
  onRestore,
  onApprove,
  onCancel,
  onStockIn,
  onSuspend,
  onCreatePO,
  onPrint,
  status,
  isSelf,
  disabledEdit,
  editTooltip,
  archiveTooltip,
  deleteTooltip,
  deleteIcon,
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
    onArchive,
    onActivate,
    onDeactivate,
    onRestore,
    onApprove,
    onCancel,
    onStockIn,
    onSuspend,
    onCreatePO,
    onPrint,
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
          <i className="fa-solid fa-eye"></i>
        </button>
      )}

      {onPrint && (
        <button
          type="button"
          className="action-btn action-btn-view"
          onClick={onPrint}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Print"
          aria-label="Print"
        >
          <i className="fa-solid fa-print"></i>
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
          <i className="fa-solid fa-pen"></i>
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
          <i className="fa-solid fa-user-slash"></i>
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
          <i className="fa-solid fa-circle-check"></i>
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
          <i className="fa-solid fa-circle-xmark"></i>
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
          <i className="fa-solid fa-circle-check"></i>
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
          <i className="fa-solid fa-ban"></i>
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
          <i className="fa-solid fa-box-archive"></i>
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
          <i className="fa-solid fa-file-circle-plus"></i>
        </button>
      )}

      {onArchive && (
        <button
          type="button"
          className="action-btn action-btn-archive"
          onClick={onArchive}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={archiveTooltip || "Archive"}
          aria-label={archiveTooltip || "Archive"}
        >
          <i className="fa-solid fa-box-archive"></i>
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className={`action-btn ${deleteIcon === 'archive' ? 'action-btn-archive' : 'action-btn-delete'}`}
          onClick={onDelete}
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title={deleteTooltip || (deleteIcon === 'archive' ? 'Archive' : 'Delete')}
          aria-label={deleteTooltip || (deleteIcon === 'archive' ? 'Archive' : 'Delete')}
        >
          <i className={`fa-solid ${deleteIcon === 'archive' ? 'fa-box-archive' : 'fa-trash'}`}></i>
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
          <i className="fa-solid fa-rotate-left"></i>
        </button>
      )}
    </div>
  );
}
