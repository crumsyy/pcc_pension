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

function normalizeToIso(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('-')) return s.substring(0, 10);
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4 && !isNaN(Number(y)) && !isNaN(Number(m)) && !isNaN(Number(d))) {
        return `${y}-${m}-${d}`;
      }
    }
  }
  return s;
}

function normalizeForFormat(val, dateFormat) {
  if (dateFormat === 'Y-m-d') return normalizeToIso(val);
  return normalizeToSlash(val);
}

export default function FlatDatePicker({
  value = '',
  onChange,
  min,
  max,
  dateFormat = 'm/d/Y',
  placeholder,
  disabled = false,
  required = false,
  id,
  name,
  className = 'form-control',
  style,
}) {
  const resolvedPlaceholder = placeholder || (dateFormat === 'Y-m-d' ? 'YYYY-MM-DD' : 'MM/DD/YYYY');
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const formatRef = useRef(dateFormat);
  const nameRef = useRef(name);
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const emit = (str) => {
    lastEmittedRef.current = str;
    const fn = onChangeRef.current;
    if (typeof fn !== 'function') return;
    if (nameRef.current) {
      fn({ target: { name: nameRef.current, value: str } });
    } else {
      fn(str);
    }
  };

  useEffect(() => {
    if (!inputRef.current) return;
    formatRef.current = dateFormat;
    const fp = flatpickr(inputRef.current, {
      dateFormat,
      defaultDate: normalizeForFormat(value, dateFormat) || undefined,
      minDate: normalizeForFormat(min, dateFormat) || undefined,
      maxDate: normalizeForFormat(max, dateFormat) || undefined,
      disableMobile: true,
      allowInput: true,
      clickOpens: !disabled,
      onChange: (selectedDates, dateStr) => {
        emit(dateStr);
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
    if (formatRef.current !== dateFormat) {
      formatRef.current = dateFormat;
      fp.set('dateFormat', dateFormat);
    }
    fp.set('minDate', normalizeForFormat(min, dateFormat) || undefined);
    fp.set('maxDate', normalizeForFormat(max, dateFormat) || undefined);
    fp.set('clickOpens', !disabled);
  }, [min, max, disabled, dateFormat]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp || !inputRef.current) return;
    const normalized = normalizeForFormat(value, formatRef.current);
    if (normalized !== lastEmittedRef.current && inputRef.current.value !== normalized) {
      fp.setDate(normalized || undefined, false);
    }
  }, [value]);

  const handleInputChange = (e) => {
    emit(e.target.value);
  };

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      className={className}
      style={style}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      required={required}
      defaultValue={normalizeForFormat(value, dateFormat)}
      onChange={handleInputChange}
    />
  );
}
