'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import HeaderProfile from '../../components/HeaderProfile';
import { NAV_ITEMS } from './navConfig';

const TAB_TITLES = {
  home: 'Guest Home',
  rooms: 'Rooms & Booking',
  bookings: 'My Bookings',
  orders: 'Orders',
  chat: 'Live Chat',
  notifications: 'Notifications',
  account: 'My Account'
};

export default function GuestHeader({ activeTab, onNavigate, unreadCount = 0, guest }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) =>
      q.split(/\s+/).every((part) => item.label.toLowerCase().includes(part))
    );
  }, [query]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        if (inputRef.current) inputRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (id) => {
    setQuery('');
    setOpen(false);
    setHighlight(0);
    if (inputRef.current) inputRef.current.blur();
    onNavigate(id);
  };

  return (
    <header
      className="d-none d-lg-flex justify-content-between align-items-center px-4 py-3 text-white border-bottom shadow-sm"
      style={{ position: 'sticky', top: 0, zIndex: 1050, backgroundColor: 'var(--pcc-blue)' }}
    >
      <div>
        <div className="text-white-50 fw-semibold" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Hotel Guest Portal</div>
        <h4 className="m-0 text-white fw-bold" style={{ fontSize: '1.1rem' }}>{TAB_TITLES[activeTab] || 'Guest Home'}</h4>
      </div>
      <div className="d-none d-md-flex flex-grow-1 justify-content-center px-4">
        <div
          className="header-search w-100"
          style={{ maxWidth: '420px' }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
          }}
        >
          <div className="d-flex align-items-center gap-2 w-100 header-search-input">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (results[highlight]) go(results[highlight].id);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                  if (inputRef.current) inputRef.current.blur();
                }
              }}
              className="header-search-field"
              placeholder="Search pages…"
              aria-label="Search guest pages"
            />
            <kbd style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '4px', padding: '1px 6px' }}>Ctrl K</kbd>
          </div>
          {open && (
            <div className="header-search-drop">
              {results.length > 0 ? (
                results.map((item, pos) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dropdown-item d-flex align-items-center gap-2 rounded ${pos === highlight ? 'active' : ''}`}
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.6rem' }}
                    onMouseMove={() => setHighlight(pos)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(item.id);
                    }}
                  >
                    <i className={`bi ${item.icon} text-primary`}></i>
                    <span>{item.label}</span>
                  </button>
                ))
              ) : (
                <div className="pcc-command-empty">No results found.</div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="d-flex align-items-center gap-3">
        <button
          type="button"
          className="btn btn-sm text-white border-0 position-relative p-2"
          title="Notifications"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          onClick={() => onNavigate('notifications')}
        >
          <i className="bi bi-bell-fill fs-5"></i>
          {unreadCount > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.62rem' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <ThemeToggle />
        <span style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '15px' }}>
          <HeaderProfile user={guest} />
        </span>
      </div>
    </header>
  );
}
