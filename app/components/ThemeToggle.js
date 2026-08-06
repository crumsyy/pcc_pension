'use client';

import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('pcc_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('pcc_theme', nextTheme);
    document.documentElement.setAttribute('data-bs-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      className={`btn btn-sm d-inline-flex align-items-center gap-1.5 fw-bold rounded-pill px-3 py-1.5 shadow-sm transition-all ${
        isLight ? 'btn-outline-dark bg-light text-dark border-secondary-subtle' : 'btn-warning text-dark border-warning'
      }`}
      style={{
        fontSize: '0.8rem',
        cursor: 'pointer',
        letterSpacing: '0.01em',
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
      }}
      title={`Switch to ${isLight ? 'Night' : 'Light'} Mode`}
      aria-label="Toggle Night/Light Mode"
      type="button"
    >
      {isLight ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span>Night</span>
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <span>Light</span>
        </>
      )}
    </button>
  );
}
