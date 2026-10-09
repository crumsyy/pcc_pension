'use client';

import { useState } from 'react';

/**
 * Avatar (shadcn-style API).
 * <Avatar><AvatarImage src={...} alt="..." /><AvatarFallback>TA</AvatarFallback></Avatar>
 */
export function Avatar({ children, className = '', ...props }) {
  return (
    <span className={['pcc-avatar', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}

export function AvatarImage({ src, alt = '', className = '', ...props }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={['pcc-avatar-image', className].filter(Boolean).join(' ')}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}

export function AvatarFallback({ children, className = '', ...props }) {
  return (
    <span className={['pcc-avatar-fallback', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}

export default Avatar;
