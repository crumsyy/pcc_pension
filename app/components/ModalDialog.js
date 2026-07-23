import React from 'react';

export default function ModalDialog({
  isOpen,
  type, // 'success' | 'warning' | 'error' | 'confirm'
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel'
}) {
  if (!isOpen) return null;

  const getHeaderStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: 'var(--pcc-green)', color: '#fff' };
      case 'warning':
        return { backgroundColor: '#f0a500', color: '#fff' };
      case 'error':
        return { backgroundColor: '#dc3545', color: '#fff' };
      case 'confirm':
      default:
        return { backgroundColor: 'var(--pcc-blue)', color: '#fff' };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success rounded-circle" style={{ width: '64px', height: '64px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        );
      case 'warning':
        return (
          <div className="d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 text-warning rounded-circle" style={{ width: '64px', height: '64px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        );
      case 'error':
        return (
          <div className="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle" style={{ width: '64px', height: '64px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        );
      case 'confirm':
      default:
        return (
          <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle" style={{ width: '64px', height: '64px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
        );
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2100 }}>
      <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: '420px' }}>
        <div className="modal-content shadow border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <div className="modal-header border-0 py-3" style={getHeaderStyle()}>
            <h5 className="modal-title fw-bold">{title || 'System Notification'}</h5>
            {onCancel && (
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onCancel}></button>
            )}
          </div>
          <div className="modal-body text-center p-4">
            <div className="mb-3">{getIcon()}</div>
            <p className="mb-0 text-muted" style={{ fontSize: '0.95rem', whiteSpace: 'pre-line', fontWeight: '500' }}>
              {message}
            </p>
          </div>
          <div className="modal-footer border-0 justify-content-center pb-4 pt-0">
            {onConfirm && (
              <button type="button" className="btn btn-pcc-primary px-4 py-2 text-white" onClick={onConfirm} style={{ borderRadius: '6px' }}>
                {confirmText}
              </button>
            )}
            {onCancel && (
              <button type="button" className="btn btn-danger px-4 py-2 ms-2 text-white" onClick={onCancel} style={{ borderRadius: '6px' }}>
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
