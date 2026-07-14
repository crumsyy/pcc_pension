'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder, disabled, emptyLabel = "No matches found" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Find currently selected option
  const selectedOption = options.find(o => String(o.value) === String(value));

  // Determine display value
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : '');

  // Keep search term synced with value updates
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.label);
    } else {
      setSearchTerm('');
    }
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
  const filtered = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          setIsOpen(true);
          const match = options.find(o => o.label.toLowerCase() === e.target.value.toLowerCase());
          if (match) {
            onChange(match.value);
          }
        }}
        onFocus={() => {
          setSearchTerm(selectedOption ? selectedOption.label : '');
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
