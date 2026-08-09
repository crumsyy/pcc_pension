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

    // Receptionists operate 24/7 for processing bookings & room service orders; exempt /receptionist from inactivity auto-logout
    if (!isDashboard || pathname.startsWith('/receptionist')) return;

    // Timeout duration: 15 minutes (900,000 milliseconds)
    const timeoutDuration = 15 * 60 * 1000;

    const performAutoLogout = async () => {
      try {
        console.log("Inactivity limit reached. Logging out...");
        // Call explicit logout route to clear DB sessionToken and cookies
        await fetch('/api/auth/logout', { method: 'POST' });
        // Redirect to login page
        window.location.href = '/auth/login?reason=inactive';
      } catch (err) {
        console.error("Auto-logout request failed:", err);
      }
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(performAutoLogout, timeoutDuration);
    };

    // Poll session-check endpoint every 10 seconds to detect concurrent logins in real-time
    const sessionCheckInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session-check');
        if (res.ok) {
          const data = await res.json();
          if (data && data.valid === false) {
            console.log("Session invalidated (concurrent login detected). Logging out...");
            window.location.href = '/auth/login?reason=concurrent';
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    }, 10000); // 10 seconds

    // User interaction events to monitor activity
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

    // Bind event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Start timer on component mount/route change
    resetTimer();

    // Cleanup listeners and timers on unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(sessionCheckInterval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname]);

  return null;
}
