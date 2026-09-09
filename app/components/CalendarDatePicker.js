'use client';

import React, { useState, useEffect, useMemo } from 'react';

/**
 * CalendarDatePicker Component
 * Interactive calendar month view for selecting Check-In and Check-Out dates:
 * - Highlights selected date (blue badge and active cell)
 * - Greys out unavailable/booked/reserved dates
 * - Prevents selecting dates before minDate or after maxDate
 * - Supports both 'YYYY-MM-DD' and 'MM/DD/YYYY' formats seamlessly
 */
export default function CalendarDatePicker({
  label = "Select Date",
  value = "",
  onChange,
  minDate = "",
  maxDate = "",
  disabledDates = [], // Array of 'YYYY-MM-DD' or 'MM/DD/YYYY' strings
  helperText = "",
  className = "",
  returnFormat = "auto", // 'auto' (matches input format), 'YYYY-MM-DD', or 'MM/DD/YYYY'
  readOnlyVisual = false
}) {
  const pad = (n) => String(n).padStart(2, '0');

  // Normalizes any date string (YYYY-MM-DD or MM/DD/YYYY) to standard 'YYYY-MM-DD'
  const toStandardYmd = (str) => {
    if (!str) return '';
    const clean = String(str).trim();
    if (clean.includes('-')) {
      const parts = clean.substring(0, 10).split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
      }
    }
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const y = parts[2].length === 4 ? parts[2] : (parseInt(parts[2], 10) > 50 ? `19${parts[2]}` : `20${parts[2]}`);
        return `${y}-${pad(parts[0])}-${pad(parts[1])}`;
      }
    }
    return '';
  };

  // Normalizes standard 'YYYY-MM-DD' to 'MM/DD/YYYY'
  const toUiSlash = (ymd) => {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length === 3) {
      return `${pad(parts[1])}/${pad(parts[2])}/${parts[0]}`;
    }
    return ymd;
  };

  const isSlashInput = typeof value === 'string' && value.includes('/');
  const standardValue = toStandardYmd(value);
  const standardMin = toStandardYmd(minDate);
  const standardMax = toStandardYmd(maxDate);

  const normalizedDisabledDates = useMemo(() => {
    return (disabledDates || []).map(d => toStandardYmd(d)).filter(Boolean);
  }, [disabledDates]);

  const parseDateParts = (ymdStr) => {
    if (!ymdStr) return null;
    const parts = ymdStr.split('-');
    if (parts.length === 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10) - 1, // 0-indexed
        day: parseInt(parts[2], 10)
      };
    }
    return null;
  };

  const initialDate = parseDateParts(standardValue) || parseDateParts(standardMin) || {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    day: new Date().getDate()
  };

  const [currentYear, setCurrentYear] = useState(initialDate.year);
  const [currentMonth, setCurrentMonth] = useState(initialDate.month);

  useEffect(() => {
    const parsed = parseDateParts(standardValue);
    if (parsed) {
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month);
    }
  }, [standardValue]);

  const formatYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const isDateDisabled = (dateStr) => {
    if (standardMin && dateStr < standardMin) return true;
    if (standardMax && dateStr > standardMax) return true;
    if (normalizedDisabledDates && normalizedDisabledDates.includes(dateStr)) return true;
    return false;
  };

  const handleDayClick = (dateStr) => {
    if (isDateDisabled(dateStr)) return;
    if (typeof onChange === 'function') {
      let finalVal = dateStr;
      if (returnFormat === 'MM/DD/YYYY' || (returnFormat === 'auto' && isSlashInput)) {
        finalVal = toUiSlash(dateStr);
      }
      onChange(finalVal);
    }
  };

  // Generate calendar grid days
  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(formatYmd(currentYear, currentMonth, d));
  }

  return (
    <div className={`calendar-date-picker card border rounded-3 p-2.5 bg-white shadow-xs ${className}`} style={{ maxWidth: '100%' }}>
      {label && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label fw-bold small mb-0 text-dark">{label}</label>
          {standardValue && (
            <span className="badge bg-primary text-white font-monospace px-2 py-1" style={{ fontSize: '0.74rem' }}>
              Selected: {standardValue}
            </span>
          )}
        </div>
      )}

      {/* Month Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary py-0.5 px-2 border"
          onClick={handlePrevMonth}
          title="Previous Month"
          style={{ fontSize: '0.82rem', borderRadius: '5px' }}
        >
          ‹
        </button>
        <span className="fw-bold text-dark small">
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary py-0.5 px-2 border"
          onClick={handleNextMonth}
          title="Next Month"
          style={{ fontSize: '0.82rem', borderRadius: '5px' }}
        >
          ›
        </button>
      </div>

      {/* Weekdays Header */}
      <div className="d-grid text-center mb-1 text-muted fw-semibold" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '0.72rem' }}>
        {dayLabels.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className={`d-grid gap-1 text-center ${readOnlyVisual ? 'calendar-visual' : ''}`} style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="p-1" />;
          }

          const dayNumber = parseInt(dateStr.split('-')[2], 10);
          const disabled = isDateDisabled(dateStr);
          const selected = standardValue === dateStr;
          const isReserved = normalizedDisabledDates && normalizedDisabledDates.includes(dateStr);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => handleDayClick(dateStr)}
              className={`btn btn-sm p-1 d-flex flex-column align-items-center justify-content-center border-0 ${
                selected
                  ? 'btn-primary text-white fw-bold shadow-sm'
                  : disabled
                  ? 'btn-light text-muted'
                  : 'btn-outline-light text-dark hover-shadow'
              }`}
              style={{
                height: '36px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                pointerEvents: disabled ? 'none' : 'auto',
                backgroundColor: selected
                  ? '#0d6efd'
                  : disabled
                  ? '#f1f3f5'
                  : '#ffffff',
                color: selected
                  ? '#ffffff'
                  : disabled
                  ? '#adb5bd'
                  : '#212529',
                opacity: disabled ? 0.55 : 1,
                textDecoration: isReserved ? 'line-through' : 'none'
              }}
              title={
                isReserved
                  ? `${dateStr}: Already Reserved or Booked (Unavailable)`
                  : disabled
                  ? `${dateStr}: Not selectable`
                  : `Select ${dateStr}`
              }
            >
              <span>{dayNumber}</span>
              {isReserved && (
                <span style={{ fontSize: '0.52rem', lineHeight: 1, color: '#dc3545', fontWeight: 'bold' }}>
                  Busy
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top" style={{ fontSize: '0.7rem' }}>
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#0d6efd' }}></span>
            <span className="text-muted">Selected</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#adb5bd' }}></span>
            <span className="text-muted">Grey: Unavailable</span>
          </div>
        </div>
      </div>

      {helperText && (
        <small className="text-muted d-block mt-1" style={{ fontSize: '0.70rem' }}>
          {helperText}
        </small>
      )}
    </div>
  );
}
