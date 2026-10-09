'use client';

import { Switch as AriaSwitch } from 'react-aria-components';

/**
 * Switch (shadcn-style API over React Aria).
 * Controlled: <Switch isSelected={v} onChange={setV}>Label</Switch>
 * Uncontrolled: <Switch defaultSelected onChange={...}>Label</Switch>
 * Supports isDisabled and render-prop children.
 */
export function Switch({ children, className = '', ...props }) {
  return (
    <AriaSwitch
      {...props}
      className={['pcc-switch', className].filter(Boolean).join(' ')}
    >
      {(states) => (
        <>
          <span className="pcc-switch-track" aria-hidden="true">
            <span className="pcc-switch-thumb" />
          </span>
          {children != null && (
            <span className="pcc-switch-label">
              {typeof children === 'function' ? children(states) : children}
            </span>
          )}
        </>
      )}
    </AriaSwitch>
  );
}

export default Switch;
