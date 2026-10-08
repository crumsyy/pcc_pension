'use client';

import * as React from 'react';
import { Toast } from '@base-ui/react/toast';

// Create a singleton manager instance outside React tree for global imperative access
const manager = Toast.createToastManager();

const activeToastIds = new Set();

/**
 * Universal imperative toast API
 */
export const toast = {
  add: (options = {}) => {
    const id = manager.add(options);
    if (id) activeToastIds.add(id);
    return id;
  },
  success: (titleOrDesc, descriptionOrOptions) => {
    if (typeof titleOrDesc === 'object' && titleOrDesc !== null) {
      const id = manager.add({ type: 'success', ...titleOrDesc });
      if (id) activeToastIds.add(id);
      return id;
    }
    const hasDesc = typeof descriptionOrOptions === 'string';
    const id = manager.add({
      type: 'success',
      title: hasDesc ? titleOrDesc : (titleOrDesc || 'Success'),
      description: hasDesc ? descriptionOrOptions : undefined,
      ...(typeof descriptionOrOptions === 'object' ? descriptionOrOptions : {})
    });
    if (id) activeToastIds.add(id);
    return id;
  },
  error: (titleOrDesc, descriptionOrOptions) => {
    if (typeof titleOrDesc === 'object' && titleOrDesc !== null) {
      const id = manager.add({ type: 'error', ...titleOrDesc });
      if (id) activeToastIds.add(id);
      return id;
    }
    const hasDesc = typeof descriptionOrOptions === 'string';
    const id = manager.add({
      type: 'error',
      title: hasDesc ? titleOrDesc : 'Error',
      description: hasDesc ? descriptionOrOptions : (titleOrDesc || 'An error occurred'),
      ...(typeof descriptionOrOptions === 'object' ? descriptionOrOptions : {})
    });
    if (id) activeToastIds.add(id);
    return id;
  },
  warning: (titleOrDesc, descriptionOrOptions) => {
    if (typeof titleOrDesc === 'object' && titleOrDesc !== null) {
      const id = manager.add({ type: 'warning', ...titleOrDesc });
      if (id) activeToastIds.add(id);
      return id;
    }
    const hasDesc = typeof descriptionOrOptions === 'string';
    const id = manager.add({
      type: 'warning',
      title: hasDesc ? titleOrDesc : 'Warning',
      description: hasDesc ? descriptionOrOptions : (titleOrDesc || 'Please review this notice'),
      ...(typeof descriptionOrOptions === 'object' ? descriptionOrOptions : {})
    });
    if (id) activeToastIds.add(id);
    return id;
  },
  info: (titleOrDesc, descriptionOrOptions) => {
    if (typeof titleOrDesc === 'object' && titleOrDesc !== null) {
      const id = manager.add({ type: 'info', ...titleOrDesc });
      if (id) activeToastIds.add(id);
      return id;
    }
    const hasDesc = typeof descriptionOrOptions === 'string';
    const id = manager.add({
      type: 'info',
      title: hasDesc ? titleOrDesc : 'Notice',
      description: hasDesc ? descriptionOrOptions : titleOrDesc,
      ...(typeof descriptionOrOptions === 'object' ? descriptionOrOptions : {})
    });
    if (id) activeToastIds.add(id);
    return id;
  },
  promise: (promise, options = {}) => {
    return manager.promise(promise, options);
  },
  message: (titleOrDesc, descriptionOrOptions) => {
    if (typeof titleOrDesc === 'object' && titleOrDesc !== null) {
      const id = manager.add({ type: 'message', ...titleOrDesc });
      if (id) activeToastIds.add(id);
      return id;
    }
    const hasDesc = typeof descriptionOrOptions === 'string';
    const id = manager.add({
      type: 'message',
      title: hasDesc ? titleOrDesc : (titleOrDesc || 'Message'),
      description: hasDesc ? descriptionOrOptions : undefined,
      ...(typeof descriptionOrOptions === 'object' ? descriptionOrOptions : {})
    });
    if (id) activeToastIds.add(id);
    return id;
  },
  close: (id) => {
    if (id) {
      try { manager.close(id); } catch (e) {}
      activeToastIds.delete(id);
    }
  },
  dismiss: (id) => {
    if (id) {
      try { manager.close(id); } catch (e) {}
      activeToastIds.delete(id);
    }
  },
  dismissAll: () => {
    activeToastIds.forEach((id) => {
      try { manager.close(id); } catch (e) {}
    });
    activeToastIds.clear();
  }
};

function getToastIcon(type) {
  switch (type) {
    case 'success':
      return (
        <span className="pcc-toast-icon pcc-toast-icon-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span className="pcc-toast-icon pcc-toast-icon-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
      );
    case 'warning':
      return (
        <span className="pcc-toast-icon pcc-toast-icon-warning">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
      );
    case 'loading':
      return (
        <span className="pcc-toast-icon pcc-toast-icon-loading">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pcc-toast-spin">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </span>
      );
    case 'message':
      return (
        <span className="pcc-toast-icon pcc-toast-icon-message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      );
    case 'info':
    default:
      return (
        <span className="pcc-toast-icon pcc-toast-icon-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
      );
  }
}

function ToastItem({ toast: t }) {
  const type = t.type || 'info';

  return (
    <Toast.Root
      toast={t}
      className={`pcc-toast-root pcc-toast-${type}`}
      data-type={type}
    >
      <Toast.Content className="pcc-toast-content">
        <div className="pcc-toast-body">
          {getToastIcon(type)}
          <div className="pcc-toast-text">
            {t.title && <Toast.Title className="pcc-toast-title">{t.title}</Toast.Title>}
            {t.description && <Toast.Description className="pcc-toast-description">{t.description}</Toast.Description>}
          </div>
        </div>

        {t.actionProps && (
          <Toast.Action
            className="pcc-toast-action-btn"
            {...t.actionProps}
          >
            {t.actionProps.children || 'Action'}
          </Toast.Action>
        )}

        <Toast.Close className="pcc-toast-close-btn" aria-label="Close notification">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="pcc-toast-list">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

export function Toaster() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Toast.Provider toastManager={manager} timeout={3800} limit={3}>
        <Toast.Portal>
          <Toast.Viewport className="pcc-toast-viewport">
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>

      {/* Embedded High-Fidelity Styles guaranteeing zero CSS collision */}
      <style jsx global>{`
        .pcc-toast-viewport {
          position: fixed !important;
          top: 1.25rem !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          right: auto !important;
          z-index: 10000000 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 0.65rem !important;
          width: 100% !important;
          max-width: 440px !important;
          pointer-events: none !important;
          box-sizing: border-box !important;
        }

        @media (max-width: 576px) {
          .pcc-toast-viewport {
            top: 0.75rem !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: calc(100vw - 1.5rem) !important;
            max-width: calc(100vw - 1.5rem) !important;
          }
        }

        .pcc-toast-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.65rem;
          width: 100%;
          pointer-events: none;
        }

        .pcc-toast-root {
          pointer-events: auto !important;
          width: 100%;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border-radius: 12px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
          overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, box-shadow 0.2s ease;
          animation: pccToastPopIn 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        [data-bs-theme="dark"] .pcc-toast-root,
        body.dark-theme .pcc-toast-root {
          background: rgba(30, 41, 59, 0.96);
          border-color: rgba(51, 65, 85, 0.9);
          box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        }

        .pcc-toast-root[data-transition-status="exiting"] {
          animation: pccToastPopOut 0.22s cubic-bezier(0.4, 0, 1, 1) forwards !important;
        }

        @keyframes pccToastPopIn {
          0% {
            opacity: 0;
            transform: translateY(-24px) scale(0.88);
          }
          65% {
            opacity: 1;
            transform: translateY(2px) scale(1.025);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pccToastPopOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px) scale(0.92);
          }
        }

        .pcc-toast-content {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 0.9rem 1rem;
          gap: 0.75rem;
          position: relative;
        }

        /* Accent strip by type */
        .pcc-toast-root::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
        }

        .pcc-toast-success::before {
          background: #16a34a;
        }

        .pcc-toast-error::before {
          background: #dc2626;
        }

        .pcc-toast-warning::before {
          background: #d97706;
        }

        .pcc-toast-info::before {
          background: #2563eb;
        }

        .pcc-toast-message::before {
          background: #64748b;
        }

        .pcc-toast-body {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
          min-width: 0;
        }

        .pcc-toast-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: -2px;
        }

        .pcc-toast-icon-success {
          background: #dcfce7;
          color: #16a34a;
        }

        .pcc-toast-icon-error {
          background: #fee2e2;
          color: #dc2626;
        }

        .pcc-toast-icon-warning {
          background: #fef3c7;
          color: #d97706;
        }

        .pcc-toast-icon-info {
          background: #dbeafe;
          color: #2563eb;
        }

        .pcc-toast-icon-message {
          background: #f1f5f9;
          color: #475569;
        }

        .pcc-toast-icon-loading {
          background: #eff6ff;
          color: #2563eb;
        }

        [data-bs-theme="dark"] .pcc-toast-icon-success,
        body.dark-theme .pcc-toast-icon-success {
          background: rgba(22, 163, 74, 0.2);
          color: #4ade80;
        }

        [data-bs-theme="dark"] .pcc-toast-icon-error,
        body.dark-theme .pcc-toast-icon-error {
          background: rgba(220, 38, 38, 0.2);
          color: #f87171;
        }

        [data-bs-theme="dark"] .pcc-toast-icon-warning,
        body.dark-theme .pcc-toast-icon-warning {
          background: rgba(217, 119, 6, 0.2);
          color: #fbbf24;
        }

        [data-bs-theme="dark"] .pcc-toast-icon-info,
        body.dark-theme .pcc-toast-icon-info {
          background: rgba(37, 99, 235, 0.2);
          color: #60a5fa;
        }

        [data-bs-theme="dark"] .pcc-toast-icon-message,
        body.dark-theme .pcc-toast-icon-message {
          background: rgba(100, 116, 139, 0.2);
          color: #94a3b8;
        }

        .pcc-toast-spin {
          animation: pccToastSpin 1.2s linear infinite;
        }

        @keyframes pccToastSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pcc-toast-text {
          flex: 1;
          min-width: 0;
        }

        .pcc-toast-title {
          font-family: var(--font-body, system-ui, sans-serif) !important;
          font-size: 0.925rem !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          margin: 0 !important;
          line-height: 1.35 !important;
          word-break: break-word;
        }

        [data-bs-theme="dark"] .pcc-toast-title,
        body.dark-theme .pcc-toast-title {
          color: #f1f5f9 !important;
        }

        .pcc-toast-description {
          font-family: var(--font-body, system-ui, sans-serif) !important;
          font-size: 0.835rem !important;
          color: #475569 !important;
          margin-top: 0.25rem !important;
          margin-bottom: 0 !important;
          line-height: 1.4 !important;
          word-break: break-word;
        }

        [data-bs-theme="dark"] .pcc-toast-description,
        body.dark-theme .pcc-toast-description {
          color: #94a3b8 !important;
        }

        .pcc-toast-close-btn {
          background: transparent !important;
          border: none !important;
          color: #94a3b8 !important;
          padding: 4px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: background-color 0.15s ease, color 0.15s ease !important;
          margin-left: 0.25rem !important;
          flex-shrink: 0 !important;
        }

        .pcc-toast-close-btn:hover {
          background: #f1f5f9 !important;
          color: #334155 !important;
        }

        [data-bs-theme="dark"] .pcc-toast-close-btn:hover,
        body.dark-theme .pcc-toast-close-btn:hover {
          background: #334155 !important;
          color: #f8fafc !important;
        }

        .pcc-toast-action-btn {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          padding: 0.35rem 0.65rem !important;
          border-radius: 6px !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          flex-shrink: 0 !important;
          align-self: center !important;
          transition: all 0.15s ease !important;
        }

        .pcc-toast-action-btn:hover {
          background: #e2e8f0 !important;
        }

        [data-bs-theme="dark"] .pcc-toast-action-btn,
        body.dark-theme .pcc-toast-action-btn {
          background: #334155 !important;
          border-color: #475569 !important;
          color: #f8fafc !important;
        }
      `}</style>
    </>
  );
}

export default toast;
