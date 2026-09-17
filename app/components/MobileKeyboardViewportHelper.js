'use client';

import { useEffect } from 'react';

/**
 * MobileKeyboardViewportHelper
 * Ensures that when mobile virtual keyboards pop up,
 * the active input field smoothly scrolls into the center of the visible area
 * and is never obscured by the keyboard.
 */
export default function MobileKeyboardViewportHelper() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId = null;

    const handleFocusIn = (e) => {
      const target = e.target;
      if (!target) return;

      const tagName = target.tagName ? target.tagName.toUpperCase() : '';
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
      if (!isInput) return;

      // Only trigger on mobile / touch screen widths (< 992px)
      if (window.innerWidth > 992) return;

      if (timeoutId) clearTimeout(timeoutId);

      // Wait 280ms for mobile keyboard animation to finish expanding
      timeoutId = setTimeout(() => {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (err) {
          // Fallback if options not supported
          target.scrollIntoView(false);
        }
      }, 280);
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return null;
}
