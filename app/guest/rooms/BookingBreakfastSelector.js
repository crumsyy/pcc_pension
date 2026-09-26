'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getStayNights } from '@/lib/dateUtils';

export default function BookingBreakfastSelector({
  checkIn,
  checkOut,
  guestCount = 1,
  breakfastRate = 250,
  onChange,
  initialSelectedDates
}) {
  const stayNights = useMemo(() => getStayNights(checkIn, checkOut), [checkIn, checkOut]);
  const [selectedDates, setSelectedDates] = useState([]);
  const hasInitializedRef = useRef(false);

  // Auto-select all by default on initial load (or use initialSelectedDates if provided)
  useEffect(() => {
    if (stayNights.length > 0) {
      const stayDateStrs = stayNights.map(n => n.dateStr);
      if (!hasInitializedRef.current) {
        if (Array.isArray(initialSelectedDates) && initialSelectedDates.length > 0) {
          const validInitial = initialSelectedDates.filter(d => stayDateStrs.includes(d));
          setSelectedDates(validInitial.length > 0 ? validInitial : stayDateStrs);
        } else {
          setSelectedDates(stayDateStrs);
        }
        hasInitializedRef.current = true;
      } else {
        // Retain only dates that belong to the new stay duration, or if none left, reset to all
        setSelectedDates(prev => {
          const valid = prev.filter(d => stayDateStrs.includes(d));
          return valid.length > 0 ? valid : stayDateStrs;
        });
      }
    } else {
      setSelectedDates([]);
      hasInitializedRef.current = false;
    }
  }, [stayNights, initialSelectedDates]);

  // Notify parent form of changes without forcing strict state mutations
  useEffect(() => {
    const totalBreakfastFee = selectedDates.length * breakfastRate * guestCount;
    onChange?.({
      selectedDates,
      breakfastCount: selectedDates.length,
      totalBreakfastFee
    });
  }, [selectedDates, breakfastRate, guestCount, onChange]);

  const toggleDate = (dateStr) => {
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSelectAll = () => setSelectedDates(stayNights.map(n => n.dateStr));
  const handleClearAll = () => setSelectedDates([]);
  const handleFirstAndLast = () => {
    if (stayNights.length === 0) return;
    if (stayNights.length === 1) {
      setSelectedDates([stayNights[0].dateStr]);
    } else {
      setSelectedDates([stayNights[0].dateStr, stayNights[stayNights.length - 1].dateStr]);
    }
  };

  if (stayNights.length === 0) {
    return null;
  }

  const perMorningTotal = breakfastRate * guestCount;

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ background: '#f8fafc' }}>
      <div className="card-header bg-white border-0 p-3 p-md-4 pb-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h6 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
            <span className="p-2 bg-warning-subtle text-warning rounded-3 fs-6 d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
              🍳
            </span>
            Customize Breakfast Mornings
          </h6>
          <p className="text-muted small mb-0">
            Choose which mornings to include breakfast (₱{breakfastRate.toLocaleString()} / guest / morning)
          </p>
        </div>

        {/* Quick Presets */}
        <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-3 border">
          <button type="button" className="btn btn-xs btn-light fw-medium text-dark shadow-2xs border-0" onClick={handleSelectAll}>
            All
          </button>
          <button type="button" className="btn btn-xs btn-light fw-medium text-muted shadow-2xs border-0" onClick={handleFirstAndLast}>
            First &amp; Last
          </button>
          <button type="button" className="btn btn-xs btn-light fw-medium text-danger shadow-2xs border-0" onClick={handleClearAll}>
            Clear
          </button>
        </div>
      </div>

      <div className="card-body p-3 p-md-4">
        {/* Night Cards Grid */}
        <div className="row g-2">
          {stayNights.map((night, idx) => {
            const isSelected = selectedDates.includes(night.dateStr);

            return (
              <div key={night.dateStr} className="col-12 col-md-6">
                <div
                  onClick={() => toggleDate(night.dateStr)}
                  className={`p-3 rounded-3 border transition-all cursor-pointer d-flex align-items-center justify-content-between ${
                    isSelected
                      ? 'bg-white border-primary shadow-xs'
                      : 'bg-white border-light text-muted opacity-75'
                  }`}
                  style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className={`p-2 rounded-3 text-center ${isSelected ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ minWidth: 46 }}>
                      <span className="d-block fw-bold small text-uppercase" style={{ fontSize: '0.65rem' }}>Night</span>
                      <span className="d-block fw-extrabold fs-6 leading-none">#{idx + 1}</span>
                    </div>

                    <div>
                      <div className="fw-semibold text-dark small">{night.morningTitle}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Stay: {night.formattedNight}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span className={`fw-bold small ${isSelected ? 'text-primary' : 'text-muted'}`}>
                      +₱{perMorningTotal.toLocaleString()}
                    </span>
                    <div className="form-check form-switch m-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="form-check-input cursor-pointer"
                        type="checkbox"
                        role="switch"
                        checked={isSelected}
                        onChange={() => toggleDate(night.dateStr)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Summary Bar */}
        <div className="mt-3 p-3 bg-white rounded-3 border d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2 small">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-1">
              {selectedDates.length} of {stayNights.length} mornings selected
            </span>
            {guestCount > 1 && (
              <span className="text-muted">({guestCount} guests)</span>
            )}
          </div>

          <div className="text-end">
            <span className="text-muted small d-block">Breakfast Subtotal</span>
            <span className="fw-bold fs-6 text-primary">
              ₱{(selectedDates.length * perMorningTotal).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
