'use client';

import React, { useState, useEffect, useMemo } from 'react';

/**
 * ReservationCalendar Component
 * Read-only visual overview of room availability and schedules.
 * - Non-interactive day grid (pointer-events: none) to prevent accidental clicks
 * - Highlights room statuses:
 *   - Booked → Green highlight (#198754)
 *   - Courtesy Hold → Orange highlight (#fd7e14)
 *   - Reserved → Yellow highlight (#ffc107)
 *   - Occupied → Blue highlight (#0d6efd)
 *   - Under Maintenance → Red highlight (#dc3545)
 * - Dual Date Highlighting:
 *   - Check-In Date → Primary Blue highlight (#0d6efd)
 *   - Check-Out Date → Teal/Navy highlight (#055160)
 *   - Stay Range → Soft Blue dashed range (#e7f1ff)
 */
export default function ReservationCalendar({
  schedules = [],
  selectedRoomId = null,
  selectedRoom = null,
  checkInDate = "",
  checkOutDate = "",
  title = "Room Availability Calendar",
  className = ""
}) {
  const pad = (n) => String(n).padStart(2, '0');
  const formatYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  // Normalizes any date string (YYYY-MM-DD or MM/DD/YYYY or ISO) to standard 'YYYY-MM-DD'
  const toStandardYmd = (str) => {
    if (!str) return '';
    const clean = String(str).trim();
    if (clean.includes('T')) return clean.substring(0, 10);
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

  const stdCheckIn = useMemo(() => toStandardYmd(checkInDate), [checkInDate]);
  const stdCheckOut = useMemo(() => toStandardYmd(checkOutDate), [checkOutDate]);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Automatically switch calendar month to selected check-in date when set
  useEffect(() => {
    if (stdCheckIn) {
      const parts = stdCheckIn.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1;
        if (!isNaN(yr) && !isNaN(mo) && mo >= 0 && mo <= 11) {
          setCurrentYear(yr);
          setCurrentMonth(mo);
        }
      }
    }
  }, [stdCheckIn]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const todayStr = formatYmd(today.getFullYear(), today.getMonth(), today.getDate());
  const isPrevDisabled = currentYear === today.getFullYear() && currentMonth <= today.getMonth();

  const handlePrevMonth = () => {
    if (isPrevDisabled) return;
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

  const handleYearChange = (newYear) => {
    const yr = parseInt(newYear, 10);
    setCurrentYear(yr);
    if (yr === today.getFullYear() && currentMonth < today.getMonth()) {
      setCurrentMonth(today.getMonth());
    }
  };

  // Build a date-to-status map for the selected room
  const dateStatusMap = useMemo(() => {
    const map = {};
    const rId = selectedRoomId || selectedRoom?.roomID;

    // Check if the entire room is currently Under Maintenance
    const isMaintenance = selectedRoom?.status === 'Under Maintenance' || selectedRoom?.status === 'Maintenance';
    if (isMaintenance) {
      for (let d = 1; d <= 31; d++) {
        map[formatYmd(currentYear, currentMonth, d)] = {
          status: 'Under Maintenance',
          label: 'Maint.',
          className: 'calendar-status-maintenance'
        };
      }
      return map;
    }

    if (!rId || !schedules || schedules.length === 0) return map;

    schedules.forEach(sched => {
      if (String(sched.roomID) !== String(rId)) return;

      const rawIn = (sched.checkInDateTime || '').substring(0, 10);
      const rawOut = (sched.checkOutDateTime || '').substring(0, 10);
      if (!rawIn) return;

      const rawStatus = (sched.status || '').toLowerCase();
      const schedType = (sched.type || '').toLowerCase();

      const statusPriority = {
        'Occupied': 5,
        'Booked': 4,
        'Reserved': 3,
        'Courtesy Hold': 2,
        'Under Maintenance': 1
      };

      let mappedStatus = 'Booked';
      let label = 'Booked';
      let statusClass = 'calendar-status-booked';

      if (rawStatus.includes('maintenance') || rawStatus === 'under maintenance') {
        mappedStatus = 'Under Maintenance';
        label = 'Maint.';
        statusClass = 'calendar-status-maintenance';
      } else if (rawStatus.includes('checked in') || rawStatus.includes('occupied') || rawStatus === 'late checkout') {
        mappedStatus = 'Occupied';
        label = 'Occupied';
        statusClass = 'calendar-status-occupied';
      } else if (rawStatus.includes('courtesy') || rawStatus === 'courtesy hold' || (sched.isCourtesyHold && rawStatus !== 'cancelled' && rawStatus !== 'released')) {
        mappedStatus = 'Courtesy Hold';
        label = 'Hold';
        statusClass = 'calendar-status-courtesy-hold';
      } else if (schedType === 'reservation' || rawStatus.includes('reserv') || rawStatus.includes('pending') || rawStatus.includes('confirmed')) {
        mappedStatus = 'Reserved';
        label = 'Reserved';
        statusClass = 'calendar-status-reserved';
      } else {
        mappedStatus = 'Booked';
        label = 'Booked';
        statusClass = 'calendar-status-booked';
      }

      const priority = statusPriority[mappedStatus] || 1;

      let cur = new Date(rawIn + 'T00:00:00');
      const end = rawOut ? new Date(rawOut + 'T00:00:00') : new Date(rawIn + 'T00:00:00');

      if (cur.getTime() === end.getTime()) {
        const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        const existingPriority = map[dStr] ? (statusPriority[map[dStr].status] || 0) : 0;
        if (!map[dStr] || priority >= existingPriority) {
          map[dStr] = { status: mappedStatus, label, className: statusClass };
        }
      } else {
        while (cur < end) {
          const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
          const existingPriority = map[dStr] ? (statusPriority[map[dStr].status] || 0) : 0;
          if (!map[dStr] || priority >= existingPriority) {
            map[dStr] = { status: mappedStatus, label, className: statusClass };
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    return map;
  }, [schedules, selectedRoomId, selectedRoom, currentYear, currentMonth]);

  // Generate grid days
  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(formatYmd(currentYear, currentMonth, d));
  }

  return (
    <div className={`reservation-calendar-card card border rounded-3 p-3 bg-white shadow-xs ${className}`}>
      {/* Header with Title and Selected Stay Badges */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-1.5 mb-2 px-1">
        <h6 className="fw-bold mb-0 text-dark text-nowrap" style={{ fontSize: '0.88rem' }}>
          {title || 'Room Availability & Status Overview'}
        </h6>
        {(stdCheckIn || stdCheckOut) && (
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            {stdCheckIn && (
              <span className="badge text-white px-2 py-1 shadow-xs font-monospace" style={{ backgroundColor: '#0d6efd', fontSize: '0.72rem' }}>
                <i className="bi bi-box-arrow-in-right me-1"></i>In: {stdCheckIn}
              </span>
            )}
            {stdCheckOut && (
              <span className="badge text-white px-2 py-1 shadow-xs font-monospace" style={{ backgroundColor: '#055160', fontSize: '0.72rem' }}>
                <i className="bi bi-box-arrow-right me-1"></i>Out: {stdCheckOut}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Month & Year Selectors with Navigation */}
      <div className="d-flex justify-content-between align-items-center gap-1.5 mb-2 px-1">
        <button
          type="button"
          className={`btn btn-sm btn-outline-secondary py-1 px-2 border d-flex align-items-center justify-content-center ${isPrevDisabled ? 'opacity-50' : ''}`}
          onClick={handlePrevMonth}
          disabled={isPrevDisabled}
          title={isPrevDisabled ? "Past months unavailable" : "Previous Month"}
          style={{ fontSize: '0.88rem', minWidth: '30px', height: '31px', borderRadius: '6px', cursor: isPrevDisabled ? 'not-allowed' : 'pointer' }}
          aria-label="Previous Month"
        >
          ‹
        </button>

        <div className="d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center">
          {/* Month Selector */}
          <select
            className="form-select form-select-sm py-1 px-2 fw-semibold text-dark border-secondary-subtle"
            style={{ width: 'auto', fontSize: '0.82rem', cursor: 'pointer' }}
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
            aria-label="Select Month"
          >
            {monthNames.map((name, idx) => {
              const isPastMonth = currentYear === today.getFullYear() && idx < today.getMonth();
              return (
                <option key={idx} value={idx} disabled={isPastMonth}>
                  {name}
                </option>
              );
            })}
          </select>

          {/* Year Selector (Current and Future Only) */}
          <select
            className="form-select form-select-sm py-1 px-2 fw-semibold text-dark border-secondary-subtle"
            style={{ width: 'auto', fontSize: '0.82rem', cursor: 'pointer' }}
            value={currentYear}
            onChange={(e) => handleYearChange(e.target.value)}
            aria-label="Select Year"
          >
            {Array.from({ length: 5 }, (_, i) => today.getFullYear() + i).map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary py-1 px-2 border d-flex align-items-center justify-content-center"
          onClick={handleNextMonth}
          title="Next Month"
          style={{ fontSize: '0.88rem', minWidth: '30px', height: '31px', borderRadius: '6px' }}
          aria-label="Next Month"
        >
          ›
        </button>
      </div>

      {/* Calendar Dates Section with Side Gaps (Side DATES Side) */}
      <div className="calendar-dates-container px-2 px-sm-3">
        {/* Weekdays Header */}
        <div className="d-grid text-center mb-1 text-muted fw-semibold" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '0.72rem', gap: '3px' }}>
          {dayLabels.map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Days Grid: Non-interactive Visual Overview with Past Dates Disabled */}
        <div className="calendar-visual d-grid text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {days.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className="p-1" />;
            }

            const dayNumber = parseInt(dateStr.split('-')[2], 10);
            const isPastDate = dateStr < todayStr;
            const statusInfo = dateStatusMap[dateStr];
            const hasStatus = !isPastDate && !!statusInfo;

            const isCheckIn = !!stdCheckIn && dateStr === stdCheckIn;
            const isCheckOut = !!stdCheckOut && dateStr === stdCheckOut;
            const isStayRange = !!stdCheckIn && !!stdCheckOut && dateStr > stdCheckIn && dateStr < stdCheckOut;

            let cellClass = 'bg-light border text-dark';
            let cellTitle = `${dateStr}: Available`;
            let cellLabel = 'Open';
            let cellStyle = {
              height: '38px',
              fontSize: '0.75rem',
              userSelect: 'none',
              cursor: isPastDate ? 'not-allowed' : 'default',
              pointerEvents: 'none'
            };

            if (isCheckIn) {
              cellClass = 'text-white shadow-sm';
              cellStyle = {
                ...cellStyle,
                backgroundColor: '#0d6efd',
                color: '#ffffff',
                border: '2px solid #0a58ca',
                borderRadius: '6px',
                fontWeight: 'bold'
              };
              cellTitle = `${dateStr}: Selected Check-In Date${hasStatus ? ` (Room Status: ${statusInfo.status})` : ''}`;
              cellLabel = 'Check-In';
            } else if (isCheckOut) {
              cellClass = 'text-white shadow-sm';
              cellStyle = {
                ...cellStyle,
                backgroundColor: '#055160',
                color: '#ffffff',
                border: '2px solid #032830',
                borderRadius: '6px',
                fontWeight: 'bold'
              };
              cellTitle = `${dateStr}: Selected Check-Out Date${hasStatus ? ` (Room Status: ${statusInfo.status})` : ''}`;
              cellLabel = 'Check-Out';
            } else if (isStayRange) {
              if (hasStatus) {
                cellClass = statusInfo.className;
                cellStyle = {
                  ...cellStyle,
                  border: '2px dashed #dc3545',
                  fontWeight: 'bold'
                };
                cellTitle = `OVERLAP CONFLICT on ${dateStr}: Overlaps with ${statusInfo.status}`;
                cellLabel = 'Conflict!';
              } else {
                cellClass = 'border text-primary';
                cellStyle = {
                  ...cellStyle,
                  backgroundColor: '#e7f1ff',
                  border: '1px dashed #0d6efd',
                  color: '#084298',
                  fontWeight: '600'
                };
                cellTitle = `${dateStr}: Selected Stay Duration (Available)`;
                cellLabel = 'Stay';
              }
            } else if (isPastDate) {
              cellClass = 'bg-light-subtle border text-muted opacity-50 fst-italic';
              cellTitle = `${dateStr}: Past Date (Unavailable)`;
              cellLabel = '-';
            } else if (hasStatus) {
              cellClass = statusInfo.className;
              cellTitle = `${dateStr}: ${statusInfo.status}`;
              cellLabel = statusInfo.label;
            }

            return (
              <div
                key={dateStr}
                className={`calendar-cell p-1 d-flex flex-column align-items-center justify-content-center ${cellClass}`}
                style={cellStyle}
                title={cellTitle}
              >
                <span className="fw-semibold" style={{ lineHeight: 1 }}>{dayNumber}</span>
                <span
                  className={`mt-0.5 text-truncate ${isCheckIn || isCheckOut ? 'badge bg-white px-1 py-0' : hasStatus || isStayRange ? 'fw-bold' : 'text-muted'}`}
                  style={{
                    fontSize: isCheckIn || isCheckOut ? '0.48rem' : '0.50rem',
                    lineHeight: 1,
                    maxWidth: '100%',
                    color: isCheckIn ? '#0d6efd' : isCheckOut ? '#055160' : undefined
                  }}
                >
                  {cellLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Status Legend with Side Gaps */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-1 mt-2.5 pt-2 border-top mx-2 mx-sm-3" style={{ fontSize: '0.68rem' }}>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd', border: '1px solid #0a58ca' }}></span>
          <span className="text-dark fw-bold">Check-In</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#055160', border: '1px solid #032830' }}></span>
          <span className="text-dark fw-bold">Check-Out</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#e7f1ff', border: '1px dashed #0d6efd' }}></span>
          <span className="text-muted">Stay Range</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#198754', border: '1px solid #0f5132' }}></span>
          <span className="text-muted">Booked</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fd7e14', border: '1px solid #d9480f' }}></span>
          <span className="text-muted">Courtesy Hold</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffc107', border: '1px solid #d39e00' }}></span>
          <span className="text-muted">Reserved</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd', border: '1px solid #084298' }}></span>
          <span className="text-muted">Occupied</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc3545', border: '1px solid #842029' }}></span>
          <span className="text-muted">Under Maintenance</span>
        </div>
      </div>

      {/* Helper Text Below with Side Gaps */}
      <div className="px-3 px-sm-4 text-center mt-1.5">
        <small className="text-muted d-block fst-italic" style={{ fontSize: '0.68rem', lineHeight: '1.4' }}>
          Visual schedule reference (Read-only). Select dates below using the date pickers.
        </small>
      </div>
    </div>
  );
}
