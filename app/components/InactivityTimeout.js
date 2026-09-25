'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function InactivityTimeout() {
  const pathname = usePathname();
  const timerRef = useRef(null);

  useEffect(() => {
    // Check if the current page is a logged-in dashboard area
    const isDashboard = 
      pathname.startsWith('/admin') || 
      pathname.startsWith('/receptionist') || 
      pathname.startsWith('/guest');

    if (!isDashboard) return;

    // 1. Concurrent Session Monitor (Applies to all roles: Guest, Receptionist, Administrator)
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session-check');
        const data = await res.json().catch(() => ({}));
        if (data && data.valid === false && data.reason === 'concurrent_login') {
          console.log("Session invalidated (concurrent login detected). Logging out...");
          window.location.href = '/auth/login?reason=concurrent';
        }
      } catch (err) {
        // Network hiccup, will re-check on next interval
      }
    };

    // Run session check every 4 seconds when tab is active
    const sessionCheckInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      checkSession();
    }, 4000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Inactivity Auto-Logout (15 mins idle; Receptionists exempt due to 24/7 front desk operations)
    let inactivityTimer = null;
    const isReceptionist = pathname.startsWith('/receptionist');

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    const performAutoLogout = async () => {
      try {
        console.log("Inactivity limit reached. Logging out...");
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/auth/login?reason=inactive';
      } catch (err) {
        console.error("Auto-logout request failed:", err);
      }
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (!isReceptionist) {
        inactivityTimer = setTimeout(performAutoLogout, 15 * 60 * 1000); // 15 minutes
      }
    };

    if (!isReceptionist) {
      activityEvents.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
      });
      resetInactivityTimer();
    }

    // Cleanup listeners and timers on unmount or route change
    return () => {
      clearInterval(sessionCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (!isReceptionist) {
        activityEvents.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer);
        });
      }
    };
  }, [pathname]);

  return null;
}
