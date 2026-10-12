'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Type guest ID, name or contact to search...",
  disabled, 
  emptyLabel = "No registered guest account found" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef(null);
  // Parent re-renders rebuild `options` arrays inline; only resync when the
  // selected VALUE actually changes, or in-progress typing gets clobbered.
  const prevValueRef = useRef(value);

  const safeOptions = Array.isArray(options) ? options : [];

  // Find currently selected option
  const selectedOption = safeOptions.find(opt => String(opt?.value) === String(value));

  // Determine display value
  const displayValue = isTyping ? searchTerm : (selectedOption ? selectedOption.label : '');

  // Keep search term synced with value updates (value changes only)
  useEffect(() => {
    if (String(prevValueRef.current) === String(value)) return;
    prevValueRef.current = value;
    const opts = Array.isArray(options) ? options : [];
    const currentOpt = opts.find(opt => String(opt?.value) === String(value));
    if (currentOpt) {
      setSearchTerm(currentOpt.label);
    } else {
      setSearchTerm('');
    }
    setIsTyping(false);
  }, [value, options]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter based on typed searchTerm or keywords
  const currentQuery = (isTyping ? searchTerm : '').trim().toLowerCase();
  const filtered = safeOptions.filter(opt => {
    if (!currentQuery) return true;
    const label = (opt?.label || '').toLowerCase();
    const val = String(opt?.value || '').toLowerCase();
    const keywords = (opt?.searchKeywords || '').toLowerCase();
    const cleanNum = currentQuery.replace(/^uid[-:\s]*/i, '');

    return (
      label.includes(currentQuery) ||
      val === currentQuery ||
      keywords.includes(currentQuery) ||
      (cleanNum && (keywords.includes(cleanNum) || label.includes(cleanNum) || val === cleanNum))
    );
  });

  const handleClear = () => {
    setSearchTerm('');
    setIsTyping(false);
    setIsOpen(false);
    if (onChange) onChange('');
  };

  return (
    <div ref={containerRef} className="position-relative w-100">
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={displayValue}
          disabled={disabled}
          onChange={(e) => {
            const rawVal = e.target.value;
            setSearchTerm(rawVal);
            setIsTyping(true);
            const trimmed = rawVal.trim().toLowerCase();
            if (trimmed.length > 0) {
              setIsOpen(true);
              // Check for exact public-code (GST-/STF-/BKG-/RSV-/TXN-/ORD-) or legacy UID match
              const cleanQuery = trimmed.replace(/^uid[-:\s]*/i, '');
              const codePattern = /^(gst|stf|bkg|rsv|txn|ord)-[a-z0-9]{1,6}$/i;
              const exactMatch = safeOptions.find(opt => {
                const optVal = String(opt?.value || '').toLowerCase();
                const optLabel = (opt?.label || '').toLowerCase();
                const optKeywords = (opt?.searchKeywords || '').toLowerCase();
                if (codePattern.test(trimmed) && (optLabel.includes(trimmed) || optKeywords.includes(trimmed))) {
                  return true;
                }
                return optVal === trimmed || 
                       optLabel.startsWith(`uid${trimmed} `) || 
                       optLabel.startsWith(`uid${trimmed}–`) ||
                       optLabel.startsWith(`uid${trimmed} -`) ||
                       (cleanQuery && (optKeywords.includes(`uid-${cleanQuery}`) || optKeywords.includes(`uid${cleanQuery}`))) ||
                       optLabel === trimmed;
              });
              if (exactMatch) {
                onChange(exactMatch.value);
              }
            } else {
              setIsOpen(true);
              onChange('');
            }
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          style={{ borderRadius: (displayValue && !disabled) ? '6px 0 0 6px' : '6px' }}
        />
        {displayValue && !disabled && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm px-2.5"
            onClick={handleClear}
            title="Clear and enter walk-in guest manually"
            style={{ borderRadius: '0 6px 6px 0' }}
          >
            <i className="bi bi-x-lg text-muted"></i>
          </button>
        )}
      </div>

      {isOpen && (
        <ul 
          className="dropdown-menu show w-100 position-absolute shadow-sm mt-1" 
          style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden', zIndex: 1080 }}
        >
          {filtered.map(opt => (
            <li key={opt.value}>
              <button
                type="button"
                className={`dropdown-item btn-sm text-start py-2 ${String(opt.value) === String(value) ? 'active bg-primary text-white' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setSearchTerm(opt.label);
                  setIsTyping(false);
                  setIsOpen(false);
                }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-truncate" style={{ minWidth: 0 }}>{opt.label}</span>
                  {String(opt.value) === String(value) && (
                    <i className="bi bi-check2 ms-2"></i>
                  )}
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-2.5 text-center text-muted small">
              <i className="bi bi-person-x me-1"></i>
              {emptyLabel} {searchTerm ? `for "${searchTerm}"` : ''}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
