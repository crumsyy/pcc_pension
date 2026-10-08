'use client';

import {
  DialogTrigger as AriaDialogTrigger,
  Modal as AriaModal,
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Text as AriaText,
  Button as AriaButton,
} from 'react-aria-components';

/**
 * Dialog set (shadcn-style API over React Aria).
 *
 * <DialogTrigger isOpen={open} onOpenChange={setOpen}>
 *   <button type="button">Open</button>
 *   <Dialog>
 *     <DialogHeader>
 *       <DialogTitle>Title</DialogTitle>
 *       <DialogDescription>Subtitle</DialogDescription>
 *     </DialogHeader>
 *     <DialogBody onScroll={...}>...scrollable content...</DialogBody>
 *     <DialogFooter>...actions...</DialogFooter>
 *   </Dialog>
 * </DialogTrigger>
 *
 * Dialog children may also be a render function receiving { close }.
 */
export function DialogTrigger(props) {
  return <AriaDialogTrigger {...props} />;
}

export function Dialog({ children, showCloseButton = true, closeLabel = 'Close dialog', className = '', ...props }) {
  const { isDismissable = true, ...dialogProps } = props;
  return (
    <AriaModal className="pcc-dialog-overlay" isDismissable={isDismissable}>
      <AriaDialog
        className={['pcc-dialog', className].filter(Boolean).join(' ')}
        {...dialogProps}
      >
        {({ close }) => (
          <>
            {showCloseButton && (
              <button type="button" className="pcc-dialog-close" aria-label={closeLabel} onClick={close}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {typeof children === 'function' ? children({ close }) : children}
          </>
        )}
      </AriaDialog>
    </AriaModal>
  );
}

export function DialogHeader({ children, className = '' }) {
  return (
    <div className={['pcc-dialog-header', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = '' }) {
  return (
    <AriaHeading slot="title" className={['pcc-dialog-title', className].filter(Boolean).join(' ')}>
      {children}
    </AriaHeading>
  );
}

export function DialogDescription({ children, className = '' }) {
  return (
    <AriaText slot="description" className={['pcc-dialog-description', className].filter(Boolean).join(' ')}>
      {children}
    </AriaText>
  );
}

export function DialogBody({ children, className = '', ...props }) {
  return (
    <div className={['pcc-dialog-body', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className = '' }) {
  return (
    <div className={['pcc-dialog-footer', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function DialogClose({ children = 'Close', className = '', ...props }) {
  return (
    <AriaButton
      slot="close"
      className={['pcc-dialog-close-btn', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </AriaButton>
  );
}
