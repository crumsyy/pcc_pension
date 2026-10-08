'use client';

import { Checkbox as AriaCheckbox } from 'react-aria-components';

/**
 * Checkbox (shadcn-style API over React Aria).
 * Controlled: <Checkbox isSelected={v} onChange={setV} />
 * Uncontrolled: <Checkbox defaultSelected onChange={...} />
 * Supports isDisabled, isInvalid, and render-prop children.
 */
export function Checkbox({ className = '', children, ...props }) {
  return (
    <AriaCheckbox
      {...props}
      className={['pcc-checkbox', className].filter(Boolean).join(' ')}
    >
      {(states) => (
        <>
          <span className="pcc-checkbox-box" aria-hidden="true">
            {states.isIndeterminate ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ) : states.isSelected ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
          </span>
          <span className="pcc-checkbox-label">
            {typeof children === 'function' ? children(states) : children}
          </span>
        </>
      )}
    </AriaCheckbox>
  );
}

export default Checkbox;
