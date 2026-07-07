'use client';

import { useState } from 'react';

// Reusable SVG Line Chart for trends (e.g. Sales, Occupancy daily trends)
export function LineChart({ data = [], title = '', height = 240 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center bg-light border rounded text-muted" style={{ height }}>
        No trend data available
      </div>
    );
  }

  const padding = 40;
  const chartWidth = 500;
  const chartHeight = height;

  const xMax = chartWidth - padding * 2;
  const yMax = chartHeight - padding * 2;

  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 100); // default minimum ceiling
  const minVal = 0;
  const valRange = maxVal - minVal;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * xMax;
    const y = chartHeight - padding - ((d.value - minVal) / valRange) * yMax;
    return { x, y, label: d.label, value: d.value };
  });

  // Generate SVG polyline path
  const polylinePath = points.map(p => `${p.x},${p.y}`).join(' ');

  // Area path (closed at the bottom for gradient fill)
  const areaPath = points.length > 0 
    ? `${points[0].x},${chartHeight - padding} ` + polylinePath + ` ${points[points.length - 1].x},${chartHeight - padding}`
    : '';

  return (
    <div className="position-relative bg-white p-2 rounded">
      {title && <h6 className="text-muted fw-bold mb-2" style={{ fontSize: '0.8rem' }}>{title}</h6>}
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-100 h-auto">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pcc-blue, #2155B5)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pcc-blue, #2155B5)" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + ratio * yMax;
          const labelVal = maxVal - ratio * valRange;
          return (
            <g key={idx}>
              <line 
                x1={padding} 
                y1={y} 
                x2={chartWidth - padding} 
                y2={y} 
                stroke="#e9ecef" 
                strokeWidth="1" 
                strokeDasharray="4,4" 
              />
              <text 
                x={padding - 8} 
                y={y + 4} 
                fill="#6c757d" 
                fontSize="9" 
                textAnchor="end"
              >
                {Math.round(labelVal)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#area-grad)" />}

        {/* Trend line */}
        <polyline 
          fill="none" 
          stroke="var(--pcc-blue, #2155B5)" 
          strokeWidth="3" 
          points={polylinePath} 
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points & Interactive Hover Area */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle 
              cx={p.x} 
              cy={p.y} 
              r={hoveredPoint === idx ? 6 : 4} 
              fill={hoveredPoint === idx ? 'var(--pcc-blue, #2155B5)' : '#fff'} 
              stroke="var(--pcc-blue, #2155B5)" 
              strokeWidth="2" 
            />
            {/* Invisible large hover targets */}
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="15" 
              fill="transparent" 
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(idx)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          </g>
        ))}

        {/* X Axis Labels */}
        {points.filter((_, i) => points.length < 10 || i % Math.ceil(points.length / 5) === 0).map((p, idx) => (
          <text 
            key={idx} 
            x={p.x} 
            y={chartHeight - padding + 16} 
            fill="#6c757d" 
            fontSize="9" 
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint !== null && points[hoveredPoint] && (
        <div 
          className="position-absolute bg-dark text-white p-2 rounded shadow-sm"
          style={{
            left: `${(points[hoveredPoint].x / chartWidth) * 100}%`,
            top: `${(points[hoveredPoint].y / chartHeight) * 100 - 25}%`,
            transform: 'translate(-50%, -100%)',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.95
          }}
        >
          <div className="fw-bold">{points[hoveredPoint].label}</div>
          <div>Value: {points[hoveredPoint].value}</div>
        </div>
      )}
    </div>
  );
}

// Reusable SVG Bar Chart for distributions (e.g. Room utilization, item summary)
export function BarChart({ data = [], title = '', color = '#3FA34D', height = 240 }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center bg-light border rounded text-muted" style={{ height }}>
        No chart data available
      </div>
    );
  }

  const padding = 40;
  const chartWidth = 500;
  const chartHeight = height;

  const xMax = chartWidth - padding * 2;
  const yMax = chartHeight - padding * 2;

  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 10);
  const valRange = maxVal;

  const barWidth = Math.max(12, (xMax / data.length) * 0.6);
  const gap = (xMax - barWidth * data.length) / (data.length - 1 || 1);

  const bars = data.map((d, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = (d.value / valRange) * yMax;
    const y = chartHeight - padding - barHeight;
    return { x, y, width: barWidth, height: barHeight, label: d.label, value: d.value };
  });

  return (
    <div className="position-relative bg-white p-2 rounded">
      {title && <h6 className="text-muted fw-bold mb-2" style={{ fontSize: '0.8rem' }}>{title}</h6>}
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-100 h-auto">
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + ratio * yMax;
          const labelVal = maxVal - ratio * valRange;
          return (
            <g key={idx}>
              <line 
                x1={padding} 
                y1={y} 
                x2={chartWidth - padding} 
                y2={y} 
                stroke="#e9ecef" 
                strokeWidth="1" 
                strokeDasharray="4,4" 
              />
              <text 
                x={padding - 8} 
                y={y + 4} 
                fill="#6c757d" 
                fontSize="9" 
                textAnchor="end"
              >
                {Math.round(labelVal)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bars.map((b, idx) => (
          <g key={idx}>
            <rect
              x={b.x}
              y={b.y}
              width={b.width}
              height={Math.max(b.height, 2)}
              fill={hoveredBar === idx ? 'var(--pcc-blue, #2155B5)' : color}
              rx="3"
              ry="3"
              style={{ transition: 'fill 0.2s', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredBar(idx)}
              onMouseLeave={() => setHoveredBar(null)}
            />
            {/* Value text on top of bar */}
            {b.height > 15 && (
              <text
                x={b.x + b.width / 2}
                y={b.y - 6}
                fill="#495057"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
              >
                {b.value}
              </text>
            )}
          </g>
        ))}

        {/* X Axis labels */}
        {bars.filter((_, i) => bars.length < 12 || i % Math.ceil(bars.length / 6) === 0).map((b, idx) => (
          <text
            key={idx}
            x={b.x + b.width / 2}
            y={chartHeight - padding + 16}
            fill="#6c757d"
            fontSize="9"
            textAnchor="middle"
          >
            {b.label}
          </text>
        ))}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredBar !== null && bars[hoveredBar] && (
        <div 
          className="position-absolute bg-dark text-white p-2 rounded shadow-sm"
          style={{
            left: `${((bars[hoveredBar].x + bars[hoveredBar].width / 2) / chartWidth) * 100}%`,
            top: `${(bars[hoveredBar].y / chartHeight) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.95
          }}
        >
          <div className="fw-bold">{bars[hoveredBar].label}</div>
          <div>Total: {bars[hoveredBar].value}</div>
        </div>
      )}
    </div>
  );
}

// Reusable SVG Doughnut/Pie Chart for distributions (e.g. Payment methods, Room types)
export function DoughnutChart({ data = [], title = '', height = 220 }) {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center bg-light border rounded text-muted" style={{ height }}>
        No distribution data available
      </div>
    );
  }

  const totalSum = data.reduce((sum, d) => sum + d.value, 0);
  if (totalSum === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center bg-light border rounded text-muted" style={{ height }}>
        Values are zero
      </div>
    );
  }

  const colors = [
    '#2155B5', // PCC Blue
    '#3FA34D', // PCC Green
    '#f0a500', // Warning Yellow
    '#dc3545', // Danger Red
    '#17a2b8', // Info Cyan
    '#6f42c1', // Purple
    '#fd7e14'  // Orange
  ];

  let accumulatedAngle = -90; // Start at top center (12 o'clock)

  const slices = data.map((d, index) => {
    const percentage = d.value / totalSum;
    const angle = percentage * 360;
    
    // Calculate polar coordinates for SVGs path
    const radStart = (accumulatedAngle * Math.PI) / 180;
    const radEnd = ((accumulatedAngle + angle) * Math.PI) / 180;
    
    accumulatedAngle += angle;

    const r = 80; // Outer radius
    const ir = 48; // Inner radius (for doughnut center hole)
    const cx = 100;
    const cy = 100;

    const x1 = cx + r * Math.cos(radStart);
    const y1 = cy + r * Math.sin(radStart);
    const x2 = cx + r * Math.cos(radEnd);
    const y2 = cy + r * Math.sin(radEnd);

    const ix1 = cx + ir * Math.cos(radEnd);
    const iy1 = cy + ir * Math.sin(radEnd);
    const ix2 = cx + ir * Math.cos(radStart);
    const iy2 = cy + ir * Math.sin(radStart);

    const largeArc = angle > 180 ? 1 : 0;

    // Draw doughnut slice path
    const pathData = [
      `M ${x1} ${y1}`, // Move to outer edge start
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, // Arc to outer edge end
      `L ${ix1} ${iy1}`, // Line to inner edge end
      `A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2}`, // Arc back to inner edge start
      'Z' // Close path
    ].join(' ');

    return {
      pathData,
      color: colors[index % colors.length],
      label: d.label,
      value: d.value,
      pct: (percentage * 100).toFixed(1)
    };
  });

  return (
    <div className="bg-white p-2 rounded">
      {title && <h6 className="text-muted fw-bold mb-3" style={{ fontSize: '0.8rem' }}>{title}</h6>}
      <div className="row align-items-center">
        <div className="col-5">
          <svg viewBox="0 0 200 200" className="w-100 h-auto">
            {slices.map((slice, idx) => (
              <path
                key={idx}
                d={slice.pathData}
                fill={slice.color}
                opacity={hoveredSlice === null || hoveredSlice === idx ? 1 : 0.7}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={() => setHoveredSlice(idx)}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            ))}
            {/* Inner text inside center hole */}
            <circle cx="100" cy="100" r="45" fill="#fff" />
            <text
              x="100"
              y="96"
              textAnchor="middle"
              fontSize="10"
              fill="#6c757d"
              fontWeight="semibold"
            >
              TOTAL
            </text>
            <text
              x="100"
              y="114"
              textAnchor="middle"
              fontSize="14"
              fill="var(--pcc-blue, #2155B5)"
              fontWeight="bold"
            >
              {totalSum.toLocaleString()}
            </text>
          </svg>
        </div>
        <div className="col-7">
          <div className="d-flex flex-column gap-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {slices.map((slice, idx) => (
              <div 
                key={idx} 
                className="d-flex align-items-center justify-content-between p-1 rounded"
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: hoveredSlice === idx ? '#f8f9fa' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={() => setHoveredSlice(idx)}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                <div className="d-flex align-items-center gap-2">
                  <span className="d-inline-block rounded-circle" style={{ width: '10px', height: '10px', backgroundColor: slice.color }}></span>
                  <span className="text-truncate fw-semibold" style={{ maxWidth: '90px' }}>{slice.label}</span>
                </div>
                <div className="text-muted text-end">
                  <strong>{slice.value}</strong> <span className="small">({slice.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
