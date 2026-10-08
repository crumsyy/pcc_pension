'use client';

import React, { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';

function normalizeToSlash(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('/')) return s;
  if (s.includes('-')) {
    const dateOnly = s.substring(0, 10);
    const parts = dateOnly.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return s;
}

export default function FlatDatePicker({
  value = '',
  onChange,
  min,
  max,
  placeholder = 'MM/DD/YYYY',
  disabled = false,
  required = false,
  id,
  name,
  className = 'form-control',
  style,
}) {
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      dateFormat: 'm/d/Y',
      defaultDate: normalizeToSlash(value) || undefined,
      minDate: normalizeToSlash(min) || undefined,
      maxDate: normalizeToSlash(max) || undefined,
      disableMobile: true,
      allowInput: true,
      clickOpens: !disabled,
      onChange: (selectedDates, dateStr) => {
        lastEmittedRef.current = dateStr;
        if (typeof onChangeRef.current === 'function') {
          onChangeRef.current(dateStr);
        }
      },
    });
    fpRef.current = fp;
    return () => {
      try { fp.destroy(); } catch (e) {}
      fpRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    fp.set('minDate', normalizeToSlash(min) || undefined);
    fp.set('maxDate', normalizeToSlash(max) || undefined);
    fp.set('clickOpens', !disabled);
  }, [min, max, disabled]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp || !inputRef.current) return;
    const normalized = normalizeToSlash(value);
    if (normalized !== lastEmittedRef.current && inputRef.current.value !== normalized) {
      fp.setDate(normalized || undefined, false);
    }
  }, [value]);

  const handleInputChange = (e) => {
    const raw = e.target.value;
    lastEmittedRef.current = raw;
    if (typeof onChangeRef.current === 'function') {
      onChangeRef.current(raw);
    }
  };

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      className={className}
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      defaultValue={normalizeToSlash(value)}
      onChange={handleInputChange}
    />
  );
}
