'use client';

import React, { useState, useEffect } from 'react';

/**
 * Interactive DatePicker Component
 * Renders an accessible calendar month view that:
 * - Greys out unavailable/booked/reserved dates
 * - Prevents selecting/clicking disabled slots (pointer-events: none)
 * - Highlights selectable range based on minDate and maxDate
 */
export default function DatePicker({
  label = "Select Date",
  value = "",
  onChange,
  minDate = "",
  maxDate = "",
  disabledDates = [], // Array of 'YYYY-MM-DD' strings
  disabledTimeSlots = [], // Optional time slots
  helperText = "",
  className = ""
}) {
  const parseDateParts = (str) => {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10) - 1, // 0-indexed
        day: parseInt(parts[2], 10)
      };
    }
    return null;
  };

  const initialDate = parseDateParts(value) || parseDateParts(minDate) || {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    day: new Date().getDate()
  };

  const [currentYear, setCurrentYear] = useState(initialDate.year);
  const [currentMonth, setCurrentMonth] = useState(initialDate.month);

  useEffect(() => {
    const parsed = parseDateParts(value);
    if (parsed) {
      setCurrentYear(parsed.year);
      setCurrentMonth(parsed.month);
    }
  }, [value]);

  const pad = (n) => String(n).padStart(2, '0');
  const formatYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const isDateDisabled = (dateStr) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    if (disabledDates && disabledDates.includes(dateStr)) return true;
    return false;
  };

  const handleDayClick = (dateStr) => {
    if (isDateDisabled(dateStr)) return;
    if (typeof onChange === 'function') {
      onChange(dateStr);
    }
  };

  // Generate calendar grid
  const days = [];
  // Empty slots before month starts
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(formatYmd(currentYear, currentMonth, d));
  }

  return (
    <div className={`date-picker-card border rounded p-2.5 bg-white shadow-sm ${className}`} style={{ maxWidth: '100%' }}>
      {label && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label fw-semibold small mb-0 text-dark">{label}</label>
          {value && (
            <span className="badge bg-primary text-white font-monospace" style={{ fontSize: '0.72rem' }}>
              Selected: {value}
            </span>
          )}
        </div>
      )}

      {/* Calendar Header with Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary py-0 px-2"
          onClick={handlePrevMonth}
          title="Previous Month"
          style={{ fontSize: '0.8rem' }}
        >
          ‹
        </button>
        <span className="fw-bold text-dark small">
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary py-0 px-2"
          onClick={handleNextMonth}
          title="Next Month"
          style={{ fontSize: '0.8rem' }}
        >
          ›
        </button>
      </div>

      {/* Days of Week Header */}
      <div className="d-grid text-center mb-1 text-muted fw-semibold" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '0.72rem' }}>
        {dayLabels.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="d-grid gap-1 text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="p-1" />;
          }

          const dayNumber = parseInt(dateStr.split('-')[2], 10);
          const disabled = isDateDisabled(dateStr);
          const selected = value === dateStr;
          const isReserved = disabledDates && disabledDates.includes(dateStr);

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
                height: '38px',
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
                <span style={{ fontSize: '0.55rem', lineHeight: 1, color: '#dc3545', fontWeight: 'bold' }}>
                  Busy
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend / Helper Info */}
      <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top" style={{ fontSize: '0.7rem' }}>
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd' }}></span>
            <span className="text-muted">Selected</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#adb5bd' }}></span>
            <span className="text-muted">Greyed out: Busy/Unavailable</span>
          </div>
        </div>
      </div>

      {helperText && (
        <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
          {helperText}
        </small>
      )}
    </div>
  );
}
