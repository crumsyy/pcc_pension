'use client';

import React, { useState, useMemo } from 'react';

/**
 * ReservationCalendar Component
 * Read-only visual overview of room availability and schedules.
 * - Non-interactive day grid (pointer-events: none) to prevent accidental clicks
 * - Highlights room statuses:
 *   - Reserved → Orange highlight (#fd7e14)
 *   - Booked → Green highlight (#198754)
 *   - Occupied → Blue highlight (#0d6efd)
 *   - Under Maintenance → Red highlight (#dc3545)
 */
export default function ReservationCalendar({
  schedules = [],
  selectedRoomId = null,
  selectedRoom = null,
  title = "Room Availability Calendar",
  className = ""
}) {
  const pad = (n) => String(n).padStart(2, '0');
  const formatYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

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
      } else if (schedType === 'reservation' || rawStatus.includes('reserv') || rawStatus.includes('pending') || rawStatus.includes('confirmed')) {
        mappedStatus = 'Reserved';
        label = 'Reserved';
        statusClass = 'calendar-status-reserved';
      } else {
        mappedStatus = 'Booked';
        label = 'Booked';
        statusClass = 'calendar-status-booked';
      }

      let cur = new Date(rawIn + 'T00:00:00');
      const end = rawOut ? new Date(rawOut + 'T00:00:00') : new Date(rawIn + 'T00:00:00');

      if (cur.getTime() === end.getTime()) {
        const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        map[dStr] = { status: mappedStatus, label, className: statusClass };
      } else {
        while (cur < end) {
          const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
          // Priority: Occupied > Booked > Reserved > Maintenance
          if (!map[dStr] || mappedStatus === 'Occupied') {
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
    <div className={`reservation-calendar-card card border rounded-3 p-2.5 bg-white shadow-xs ${className}`}>
      {/* Header with Title and Room Info */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '0.86rem' }}>
          <i className="bi bi-calendar-week text-primary"></i>
          <span>{title}</span>
        </h6>
        {selectedRoom && (
          <span className="badge bg-secondary-subtle text-secondary border px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
            Room {selectedRoom.roomNumber} ({selectedRoom.roomType || 'Standard'})
          </span>
        )}
      </div>

      {/* Month Navigation (Interactive) */}
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
      <div className="d-grid text-center mb-1 text-muted fw-semibold" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '0.72rem', padding: '0 1rem', gap: '0.5rem' }}>
        {dayLabels.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Days Grid: Non-interactive Visual Overview */}
      <div className="calendar-visual calendar-grid d-grid text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="calendar-cell p-1" />;
          }

          const dayNumber = parseInt(dateStr.split('-')[2], 10);
          const statusInfo = dateStatusMap[dateStr];
          const hasStatus = !!statusInfo;

          return (
            <div
              key={dateStr}
              className={`calendar-cell p-1 d-flex flex-column align-items-center justify-content-center ${
                hasStatus ? statusInfo.className : 'bg-light border text-dark'
              }`}
              style={{
                height: '38px',
                fontSize: '0.75rem',
                userSelect: 'none'
              }}
              title={hasStatus ? `${dateStr}: ${statusInfo.status}` : `${dateStr}: Available`}
            >
              <span className="fw-semibold" style={{ lineHeight: 1 }}>{dayNumber}</span>
              {hasStatus ? (
                <span
                  className="fw-bold mt-0.5 text-truncate"
                  style={{ fontSize: '0.52rem', lineHeight: 1, maxWidth: '100%' }}
                >
                  {statusInfo.label}
                </span>
              ) : (
                <span className="text-muted mt-0.5" style={{ fontSize: '0.50rem', lineHeight: 1 }}>
                  Open
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Visual Status Legend */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-1 mt-2 pt-2 border-top" style={{ fontSize: '0.68rem', padding: '0 0.5rem' }}>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fd7e14', border: '1px solid #d9480f' }}></span>
          <span className="text-muted">Reserved</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#198754', border: '1px solid #0f5132' }}></span>
          <span className="text-muted">Booked</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd', border: '1px solid #084298' }}></span>
          <span className="text-muted">Occupied</span>
        </div>
        <div className="d-flex align-items-center gap-1">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc3545', border: '1px solid #842029' }}></span>
          <span className="text-muted">Under Maint.</span>
        </div>
      </div>
      <small className="text-muted text-center d-block mt-1 fst-italic" style={{ fontSize: '0.66rem' }}>
        Visual schedule reference (Read-only). Select dates below using the date pickers.
      </small>
    </div>
  );
}
