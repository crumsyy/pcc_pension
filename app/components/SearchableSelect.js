'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder, disabled, emptyLabel = "No matches found" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const selected = options.find(o => String(o.value) === String(value));
    setInputValue(selected ? selected.label : '');
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset input value to match the selected option
        const selected = options.find(o => String(o.value) === String(value));
        setInputValue(selected ? selected.label : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value, options]);

  const filtered = options.filter(opt =>
    opt.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className="position-relative w-100">
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
          const match = options.find(o => o.label.toLowerCase() === e.target.value.toLowerCase());
          if (match) {
            onChange(match.value);
          } else {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
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
                  setInputValue(opt.label);
                  setIsOpen(false);
                  onChange(opt.value);
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
