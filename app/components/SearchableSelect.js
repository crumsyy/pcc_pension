'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ options = [], value, onChange, placeholder, disabled, emptyLabel = "No matches found" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef(null);

  const safeOptions = Array.isArray(options) ? options : [];

  // Find currently selected option
  const selectedOption = safeOptions.find(opt => String(opt?.value) === String(value));

  // Determine display value
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : '');

  // Keep search term synced with value updates
  useEffect(() => {
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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter based on typed searchTerm
  const filtered = safeOptions.filter(opt => {
    if (!isTyping) return true;
    return opt?.label?.toLowerCase().includes((searchTerm || '').toLowerCase());
  });

  return (
    <div ref={containerRef} className="position-relative w-100">
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={displayValue}
        disabled={disabled}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsTyping(true);
          setIsOpen(true);
          const match = safeOptions.find(opt => opt?.label?.toLowerCase() === e.target.value.toLowerCase());
          if (match) {
            onChange(match.value);
          }
        }}
        onFocus={() => {
          setSearchTerm(selectedOption ? selectedOption.label : '');
          setIsTyping(false);
          setIsOpen(true);
        }}
        style={{ borderRadius: '6px' }}
      />
      {isOpen && (
        <ul className="dropdown-menu show w-100 position-absolute shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1080 }}>
          {filtered.map(opt => (
            <li key={opt.value}>
              <button
                type="button"
                className={`dropdown-item btn-sm text-start py-2 ${String(opt.value) === String(value) ? 'active bg-primary text-white' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setSearchTerm(opt.label);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-2 text-center text-muted small">
              {emptyLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
