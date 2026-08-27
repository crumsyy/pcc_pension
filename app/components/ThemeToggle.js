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
      className="theme-toggle-switch d-inline-flex align-items-center justify-content-between position-relative px-1 py-1 rounded-pill cursor-pointer border-0 shadow-sm"
      style={{
        width: '62px',
        height: '32px',
        backgroundColor: isLight ? '#cbd5e1' : '#1e293b',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
        flexShrink: 0,
        outline: 'none'
      }}
      title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
      aria-label="Toggle Night/Light Mode"
      type="button"
    >
      <span className="d-flex align-items-center justify-content-center text-warning opacity-75" style={{ width: '24px', height: '24px', fontSize: '0.85rem' }}>
        <i className="bi bi-sun-fill"></i>
      </span>
      <span className="d-flex align-items-center justify-content-center text-info opacity-75" style={{ width: '24px', height: '24px', fontSize: '0.85rem' }}>
        <i className="bi bi-moon-stars-fill"></i>
      </span>

      <span
        className="toggle-circle position-absolute d-flex align-items-center justify-content-center rounded-circle shadow-sm"
        style={{
          width: '26px',
          height: '26px',
          top: '3px',
          left: isLight ? '3px' : '33px',
          backgroundColor: isLight ? '#ffffff' : '#38bdf8',
          color: isLight ? '#f59e0b' : '#0f172a',
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease',
          fontSize: '0.85rem'
        }}
      >
        <i className={`bi ${isLight ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
      </span>
    </button>
  );
}
