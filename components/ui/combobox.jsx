'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * Direct Searchable Dropdown (Autocomplete) Component.
 * - The field itself is an interactive, directly typeable input.
 * - Suggestions appear dynamically below the input as the user types.
 * - No redundant inner search box inside the dropdown.
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Escape).
 */
export function Combobox({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  emptyText = 'No matches found.',
  disabled = false,
  id,
  name,
  required = false,
  className = '',
  autoComplete = 'off',
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label }
  const normalizedOptions = useMemo(() => {
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

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return normalizedOptions.find(
      (opt) => String(opt.value).toLowerCase() === String(value).toLowerCase()
    ) || null;
  }, [normalizedOptions, value]);

  // Sync display text with selected value when value changes externally
  useEffect(() => {
    if (selectedOption) {
      setInputValue(selectedOption.label);
    } else if (!value) {
      setInputValue('');
    }
  }, [selectedOption, value]);

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  // Scroll active item into view during keyboard navigation
  const scrollHighlightedIntoView = useCallback((index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.pcc-combobox-item');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }, []);

  // Handle option selection
  const handleSelect = useCallback((val) => {
    const match = normalizedOptions.find(
      (opt) => String(opt.value).toLowerCase() === String(val).toLowerCase()
    );
    if (match) {
      setInputValue(match.label);
    }
    setQuery('');
    setOpen(false);
    if (typeof onChange === 'function') {
      onChange(val);
    }
  }, [normalizedOptions, onChange]);

  // Handle clearing value
  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    setInputValue('');
    setQuery('');
    setOpen(false);
    if (typeof onChange === 'function') {
      onChange('');
    }
    inputRef.current?.focus();
  };

  // Toggle dropdown open/close
  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (open) {
      setOpen(false);
    } else {
      setQuery('');
      setOpen(true);
      setHighlightedIndex(0);
      inputRef.current?.focus();
    }
  };

  // Input change handler (typing directly in the field)
  const handleInputChange = (e) => {
    if (disabled) return;
    const text = e.target.value;
    setInputValue(text);
    setQuery(text);
    setHighlightedIndex(0);
    if (!open) {
      setOpen(true);
    }
  };

  // Input focus handler
  const handleInputFocus = () => {
    if (disabled) return;
    // Open dropdown to show matching suggestions or full list
    setOpen(true);
    setHighlightedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setQuery('');
        setOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      // Revert display to current selected value
      setInputValue(selectedOption ? selectedOption.label : '');
      setQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : prev;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : 0;
        scrollHighlightedIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Tab') {
      // Auto-select highlighted if query typed, or just close
      if (open && query && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else {
        setOpen(false);
        setInputValue(selectedOption ? selectedOption.label : '');
        setQuery('');
      }
    }
  };

  // Close when clicking outside and validate typed text
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        // Check if typed text matches an option exactly
        const trimmed = inputValue.trim();
        if (trimmed) {
          const exact = normalizedOptions.find(
            (opt) => opt.label.toLowerCase() === trimmed.toLowerCase()
          );
          if (exact) {
            handleSelect(exact.value);
            return;
          }
        }
        // If empty or non-matching, revert to last valid selected option
        if (!trimmed) {
          if (value) {
            if (typeof onChange === 'function') onChange('');
          }
          setInputValue('');
        } else {
          setInputValue(selectedOption ? selectedOption.label : '');
        }
        setQuery('');
      }
    }

    if (open) {
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [open, inputValue, normalizedOptions, handleSelect, value, onChange, selectedOption]);

  // Helper to highlight matching text in suggestions
  const renderHighlightedLabel = (label, searchStr) => {
    const q = searchStr.trim();
    if (!q) return label;
    const idx = label.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return label;
    const before = label.slice(0, idx);
    const match = label.slice(idx, idx + q.length);
    const after = label.slice(idx + q.length);
    return (
      <>
        {before}
        <strong className="text-primary fw-bold">{match}</strong>
        {after}
      </>
    );
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

      {/* Direct Interactive Input Trigger */}
      <div
        className={`pcc-combobox-input-wrapper ${open ? 'open' : ''} ${
          disabled ? 'disabled' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          id={id ? `${id}-input` : undefined}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pcc-combobox-input"
          autoComplete={autoComplete}
          spellCheck="false"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : undefined}
        />

        <div className="pcc-combobox-actions">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              className="pcc-combobox-action-btn pcc-combobox-clear-btn"
              onClick={handleClear}
              title="Clear selection"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="pcc-combobox-action-btn pcc-combobox-toggle-btn"
            onClick={handleToggle}
            title="Toggle options"
          >
            <i className={`bi bi-chevron-${open ? 'up' : 'down'}`}></i>
          </button>
        </div>
      </div>

      {/* Dynamic Suggestions Dropdown (NO nested search box!) */}
      {open && !disabled && (
        <div className="pcc-combobox-popover" role="dialog" aria-modal="false">
          <ul
            ref={listRef}
            id={id ? `${id}-listbox` : undefined}
            className="pcc-combobox-list"
            role="listbox"
          >
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
                      <span className="text-truncate">
                        {renderHighlightedLabel(opt.label, query)}
                      </span>
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
