'use client';

import React from 'react';

export default function DateInput({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  className = "form-control",
  required = false,
  id,
  name,
  disabled = false
}) {
  const handleChange = (e) => {
    let input = e.target.value;
    
    // Remove all non-digits
    let clean = input.replace(/\D/g, '');
    
    // Format as MM/DD/YYYY
    if (clean.length > 8) {
      clean = clean.substring(0, 8);
    }
    
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.substring(4, 8);
    }
    
    onChange({
      target: {
        name,
        value: formatted
      }
    });
  };

  const handleKeyDown = (e) => {
    // If typing digits in year field, check if we already have 4 digits for year
    if (e.key >= '0' && e.key <= '9') {
      const parts = value.split('/');
      if (parts.length === 3 && parts[2].length >= 4) {
        // Prevent typing more than 4 digits in year
        const selectionStart = e.target.selectionStart;
        // If selection is in the year part, prevent default
        if (selectionStart > 5) {
          e.preventDefault();
        }
      }
    }
  };

  return (
    <input
      type="text"
      id={id}
      name={name}
      placeholder={placeholder}
      className={className}
      required={required}
      value={value || ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      maxLength={10}
    />
  );
}

export function isValidDate(str) {
  if (!str) return false;
  const parts = str.split('/');
  if (parts.length !== 3) return false;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  
  if (isNaN(m) || isNaN(d) || isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  if (y < 1000 || y > 9999) return false; // exactly 4-digit year limit
  
  const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d < 1 || d > daysInMonth[m - 1]) return false;
  
  return true;
}

export function toDbDate(str) {
  if (!str) return '';
  const parts = str.split('/');
  if (parts.length !== 3) return str;
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

export function toUiDate(str) {
  if (!str) return '';
  const dateOnly = str.substring(0, 10);
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return str;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}
