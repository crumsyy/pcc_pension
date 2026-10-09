'use client';

import { useState, useEffect, useRef, Children, cloneElement, isValidElement } from 'react';

/**
 * DropdownMenu (shadcn-style API, uncontrolled).
 *
 * <DropdownMenu>
 *   <DropdownMenuTrigger>...trigger element...</DropdownMenuTrigger>
 *   <DropdownMenuContent align="end">
 *     <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
 *     <DropdownMenuItem onSelect={() => ...}>Profile</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem onSelect={() => ...}>Log out</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 */
export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  let trigger = null;
  let content = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === DropdownMenuTrigger) trigger = child;
    else if (child.type === DropdownMenuContent) content = child;
  });

  return (
    <div ref={rootRef} className="pcc-dropdown-root">
      {trigger && cloneElement(trigger, { menuOpen: open, setMenuOpen: setOpen })}
      {open && content && cloneElement(content, { setMenuOpen: setOpen })}
    </div>
  );
}

export function DropdownMenuTrigger({ children, menuOpen, setMenuOpen, className = '', ...props }) {
  const child = Children.only(children);
  const handleClick = (e) => {
    if (child.props && typeof child.props.onClick === 'function') child.props.onClick(e);
    if (!e.defaultPrevented) setMenuOpen(!menuOpen);
  };
  return cloneElement(child, {
    ...props,
    className: [child.props?.className, className].filter(Boolean).join(' '),
    onClick: handleClick,
    'aria-expanded': menuOpen,
    'aria-haspopup': 'menu',
  });
}

export function DropdownMenuContent({ children, className = '', align = 'end', setMenuOpen, ...props }) {
  return (
    <div
      role="menu"
      className={['pcc-dropdown-content', `pcc-dropdown-align-${align}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {Children.map(children, (child) => {
        if (isValidElement(child) && child.type === DropdownMenuItem) {
          return cloneElement(child, { setMenuOpen });
        }
        return child;
      })}
    </div>
  );
}

export function DropdownMenuItem({ children, onSelect, disabled = false, className = '', setMenuOpen, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={['pcc-dropdown-item', className].filter(Boolean).join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        if (typeof onSelect === 'function') onSelect(e);
        if (setMenuOpen) setMenuOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ children, className = '', ...props }) {
  return (
    <div className={['pcc-dropdown-label', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = '', ...props }) {
  return (
    <div role="separator" className={['pcc-dropdown-separator', className].filter(Boolean).join(' ')} {...props} />
  );
}
