/**
 * In-memory client-side cache for instant page navigation & smart loading.
 * Provides Stale-While-Revalidate (SWR) semantics with module-level TTLs.
 */

const memoryCache = new Map();
const listeners = new Map();

export const CACHE_TTL = {
  // Admin Module TTLs
  DASHBOARD: 30 * 1000,       // 30 seconds
  INVENTORY: 15 * 1000,       // 15 seconds
  PURCHASE_ORDERS: 30 * 1000, // 30 seconds
  RESERVATIONS: 30 * 1000,    // 30 seconds
  BOOKINGS: 30 * 1000,        // 30 seconds
  USERS: 60 * 1000,           // 1 minute
  ROOMS: 60 * 1000,           // 1 minute
  AMENITIES: 60 * 1000,       // 1 minute
  PRODUCTS: 60 * 1000,        // 1 minute
  DISCOUNTS: 60 * 1000,       // 1 minute
  REPORTS: 60 * 1000,         // 1 minute

  // Receptionist Module TTLs
  RECEPTIONIST_DASHBOARD: 15 * 1000,    // 15 seconds
  RECEPTIONIST_BOOKINGS: 30 * 1000,     // 30 seconds
  RECEPTIONIST_RESERVATIONS: 30 * 1000, // 30 seconds
  RECEPTIONIST_CHECKIN: 20 * 1000,      // 20 seconds
  RECEPTIONIST_ORDERS: 20 * 1000,       // 20 seconds
  RECEPTIONIST_BILLING: 20 * 1000,      // 20 seconds
  RECEPTIONIST_PAYMENTS: 30 * 1000,     // 30 seconds
  RECEPTIONIST_INQUIRIES: 20 * 1000,    // 20 seconds

  // Guest Module TTLs
  GUEST_DASHBOARD: 30 * 1000,   // 30 seconds
  GUEST_ROOMS: 60 * 1000,       // 1 minute
  GUEST_ORDERS: 20 * 1000,      // 20 seconds
  GUEST_PROFILE: 60 * 1000,     // 1 minute
};

export const clientCache = {
  /**
   * Retrieve cached data by key.
   * @param {string} key
   * @returns {{ data: any, timestamp: number, isStale: boolean } | null}
   */
  get(key) {
    if (typeof window === 'undefined') return null;
    const entry = memoryCache.get(key);
    if (!entry) return null;
    const now = Date.now();
    const isStale = (now - entry.timestamp) > entry.staleTime;
    return {
      data: entry.data,
      timestamp: entry.timestamp,
      isStale,
    };
  },

  /**
   * Set cached data for key with specific staleTime (TTL).
   * @param {string} key
   * @param {any} data
   * @param {number} [staleTime=60000]
   */
  set(key, data, staleTime = 60 * 1000) {
    if (typeof window === 'undefined') return;
    const entry = {
      data,
      timestamp: Date.now(),
      staleTime,
    };
    memoryCache.set(key, entry);

    const keyListeners = listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(fn => {
        try { fn(entry); } catch (e) { console.error('Cache listener error:', e); }
      });
    }
  },

  /**
   * Invalidate one or more cache entries.
   * If keyPattern is omitted, clears all cache entries.
   * @param {string|RegExp} [keyPattern]
   */
  invalidate(keyPattern) {
    if (typeof window === 'undefined') return;
    if (!keyPattern) {
      memoryCache.clear();
      return;
    }
    if (typeof keyPattern === 'string') {
      for (const key of memoryCache.keys()) {
        if (key === keyPattern || key.startsWith(keyPattern)) {
          memoryCache.delete(key);
        }
      }
    } else if (keyPattern instanceof RegExp) {
      for (const key of memoryCache.keys()) {
        if (keyPattern.test(key)) {
          memoryCache.delete(key);
        }
      }
    }
  },

  /**
   * Delete a specific cache key (alias for invalidate).
   * @param {string} key
   */
  delete(key) {
    this.invalidate(key);
  },

  /**
   * Remove a specific cache key (alias for invalidate).
   * @param {string} key
   */
  remove(key) {
    this.invalidate(key);
  },

  /**
   * Check if a valid entry exists in cache.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (typeof window === 'undefined') return false;
    return memoryCache.has(key);
  },

  /**
   * Subscribe to cache updates for a key.
   * @param {string} key
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(key, callback) {
    if (typeof window === 'undefined') return () => {};
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);
    return () => {
      const set = listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) listeners.delete(key);
      }
    };
  }
};

export default clientCache;
