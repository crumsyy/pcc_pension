'use client';

import React from 'react';

export default function DateInput({
  value,
  onChange,
  className = "form-control form-control-sm",
  required = false,
  id,
  name,
  disabled = false,
  min,
  max,
  disabledDates = []
}) {
  // Convert incoming value ("MM/DD/YYYY" or "YYYY-MM-DD") to HTML5 date format ("YYYY-MM-DD")
  const uiToInputValue = (val) => {
    if (!val) return '';
    if (val.includes('-')) return val.substring(0, 10);
    const parts = val.split('/');
    if (parts.length === 3) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4 && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return `${y}-${m}-${d}`;
      }
    }
    return '';
  };

  // Convert HTML5 date format ("YYYY-MM-DD") back to internal state format ("MM/DD/YYYY")
  const handleChange = (e) => {
    const inputVal = e.target.value; // "YYYY-MM-DD"
    if (!inputVal) {
      onChange({
        target: {
          name,
          value: ''
        }
      });
      return;
    }
    const parts = inputVal.split('-');
    if (parts.length === 3) {
      const formatted = `${parts[1]}/${parts[2]}/${parts[0]}`;
      onChange({
        target: {
          name,
          value: formatted
        }
      });
    }
  };

  const inputValue = uiToInputValue(value);
  const minInputValue = uiToInputValue(min);
  const maxInputValue = uiToInputValue(max);
  const isConflict = Boolean(inputValue && disabledDates && disabledDates.includes(inputValue));

  return (
    <div>
      <input
        type="date"
        id={id}
        name={name}
        className={`${className} ${isConflict ? 'is-invalid border-danger' : ''}`}
        required={required}
        value={inputValue}
        onChange={handleChange}
        disabled={disabled}
        min={minInputValue || undefined}
        max={maxInputValue || undefined}
      />
      {isConflict && (
        <small className="text-danger fw-semibold d-block mt-0.5" style={{ fontSize: '0.72rem' }}>
          ⚠️ Unavailable: date is reserved or booked
        </small>
      )}
    </div>
  );
}

export function isValidDate(str) {
  if (!str) return false;
  const clean = String(str).trim();
  if (clean.includes('-')) {
    const parts = clean.substring(0, 10).split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    if (m < 1 || m > 12) return false;
    if (y < 1000 || y > 9999) return false;
    const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d >= 1 && d <= daysInMonth[m - 1];
  }
  const parts = clean.split('/');
  if (parts.length !== 3) return false;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  if (y < 1000 || y > 9999) return false;
  const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d >= 1 && d <= daysInMonth[m - 1];
}

export function toDbDate(str) {
  if (!str) return '';
  const clean = String(str).trim();
  if (clean.includes('-')) return clean.substring(0, 10);
  const parts = clean.split('/');
  if (parts.length !== 3) return clean;
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

export function toUiDate(str) {
  if (!str) return '';
  const clean = String(str).trim();
  if (clean.includes('/')) return clean;
  const dateOnly = clean.substring(0, 10);
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}/${parts[0]}`;
}

