'use client';

import { toast } from '@/components/ui/toast';

/**
 * Universal application toast utility.
 * Can be called anywhere on the client.
 */
export const showToast = {
  success: (message, options = {}) => {
    return toast.add({
      type: 'success',
      title: options.title || 'Success',
      description: typeof message === 'string' ? message : (options.description || ''),
      ...options
    });
  },
  error: (message, options = {}) => {
    return toast.add({
      type: 'error',
      title: options.title || 'Error',
      description: typeof message === 'string' ? message : (options.description || 'An error occurred'),
      ...options
    });
  },
  warning: (message, options = {}) => {
    return toast.add({
      type: 'warning',
      title: options.title || 'Warning',
      description: typeof message === 'string' ? message : (options.description || ''),
      ...options
    });
  },
  info: (message, options = {}) => {
    return toast.add({
      type: 'info',
      title: options.title || 'Notice',
      description: typeof message === 'string' ? message : (options.description || ''),
      ...options
    });
  },
  dismiss: (id) => toast.close(id)
};

export { toast };
export default showToast;
