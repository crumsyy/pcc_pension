'use client';

import { toast } from 'sonner';

/**
 * Universal application toast utility.
 * Can be called anywhere on the client.
 */
export const showToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      duration: options.duration || 4000,
      description: options.description,
      ...options
    });
  },
  error: (message, options = {}) => {
    return toast.error(message, {
      duration: options.duration || 5000,
      description: options.description,
      ...options
    });
  },
  warning: (message, options = {}) => {
    return toast.warning(message, {
      duration: options.duration || 4500,
      description: options.description,
      ...options
    });
  },
  info: (message, options = {}) => {
    return toast.info(message, {
      duration: options.duration || 4000,
      description: options.description,
      ...options
    });
  },
  dismiss: (id) => toast.dismiss(id)
};

export default showToast;
