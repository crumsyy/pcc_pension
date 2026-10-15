'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * Shadcn-style Combobox / Searchable Select component.
 */
export function Combobox({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  disabled = false,
  id,
  name,
  required = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label }
  const normalizedOptions = React.useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return {
        value: opt.value ?? opt.label,
        label: opt.label ?? opt.value,
      };
    });
  }, [options]);

  // Selected option label
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value).toLowerCase() === String(value).toLowerCase()
  );

  // Filtered options based on search query
  const filteredOptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q)
    );
  }, [normalizedOptions, search]);

  // Reset search and highlight when opening/closing
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 30);
    }
  }, [open]);

  // Reset highlight index if filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [open]);

  // Handle selection
  const handleSelect = (val) => {
    if (typeof onChange === 'function') {
      onChange(val);
    }
    setOpen(false);
  };

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (typeof onChange === 'function') {
      onChange('');
    }
  };

  // Keyboard navigation inside popover search input
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  const scrollHighlightedIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.pcc-combobox-item');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div ref={containerRef} className={`pcc-combobox-root ${className}`}>
      {/* Hidden input for HTML form validation & submission */}
      {name && (
        <input
          type="text"
          id={id}
          name={name}
          value={value || ''}
          required={required}
          readOnly
          tabIndex={-1}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
            bottom: 0,
            left: '50%',
          }}
        />
      )}

      {/* Combobox Trigger */}
      <button
        type="button"
        id={id ? `${id}-trigger` : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={handleKeyDown}
        className={`pcc-combobox-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? 'text-truncate' : 'placeholder text-truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="d-flex align-items-center gap-1 ms-2 flex-shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="text-muted p-1 d-flex align-items-center hover-opacity"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e);
              }}
              title="Clear selection"
              style={{ fontSize: '0.75rem', cursor: 'pointer' }}
            >
              <i className="bi bi-x-lg"></i>
            </span>
          )}
          <span className="text-muted d-flex align-items-center" style={{ fontSize: '0.8rem' }}>
            <i className={`bi bi-chevron-${open ? 'up' : 'down'}`}></i>
          </span>
        </div>
      </button>

      {/* Floating Popover Content */}
      {open && (
        <div className="pcc-combobox-popover" role="dialog" aria-modal="false">
          {/* Real-time search box */}
          <div className="pcc-combobox-search-wrapper">
            <span className="pcc-combobox-search-icon">
              <i className="bi bi-search" style={{ fontSize: '0.8rem' }}></i>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="pcc-combobox-search-input"
              autoComplete="off"
            />
          </div>

          {/* Options list */}
          <ul ref={listRef} className="pcc-combobox-list" role="listbox">
            {filteredOptions.length === 0 ? (
              <li className="pcc-combobox-empty">{emptyText}</li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected =
                  String(opt.value).toLowerCase() === String(value).toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      className={`pcc-combobox-item ${isSelected ? 'selected' : ''} ${
                        isHighlighted ? 'active' : ''
                      }`}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="text-truncate">{opt.label}</span>
                      {isSelected && (
                        <i className="bi bi-check2 text-primary fw-bold ms-2 flex-shrink-0"></i>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Combobox;
