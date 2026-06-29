'use client';

import { useState, useEffect } from 'react';

export default function AdminReports() {
  const [report, setReport] = useState('sales');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().substring(0, 10));

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    setReportData(null); // Clear old report data to prevent rendering crashes!
    try {
      const query = new URLSearchParams({
        report,
        from: dateFrom,
        to: dateTo,
      }).toString();

      const res = await fetch(`/api/admin/reports?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');

      setReportData(data.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [report, dateFrom, dateTo]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="mb-3 d-print-none">
        <div className="section-eyebrow">Admin</div>
        <h2 className="section-title mb-0">Reports &amp; Analytics</h2>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3 d-print-none" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filter and Control Form */}
      <div className="card-module mb-4 d-print-none" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Report Type</label>
            <select
              className="form-select"
              value={report}
              onChange={(e) => setReport(e.target.value)}
            >
              <option value="sales">Sales &amp; Revenue</option>
              <option value="occupancy">Occupancy</option>
              <option value="inventory">Inventory Movement</option>
              <option value="guests">Guest History</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>From</label>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>To</label>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="col-md-3 d-flex gap-2">
            <button className="btn btn-pcc-primary w-100" onClick={fetchReport}>
              Generate
            </button>
            <button className="btn btn-pcc-outline w-100" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* PRINT HEADER (Only visible when printing) */}
      <div className="d-none d-print-block mb-4 text-center">
        <h2 className="mb-1">PCC Home Suite Home</h2>
        <h5 className="text-muted">
          {report === 'sales' && 'Sales & Revenue Report'}
          {report === 'occupancy' && 'Occupancy & Utilization Report'}
          {report === 'inventory' && 'Inventory Movement Report'}
          {report === 'guests' && 'Guest Stay History Report'}
        </h5>
        <p style={{ fontSize: '0.9rem' }}>
          Date Range: {new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to{' '}
          {new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <hr />
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : reportData ? (
        <>
          {/* SALES & REVENUE REPORT */}
          {report === 'sales' && (
            <div>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#2155B5' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>
                      ₱{parseFloat(reportData.totalRevenue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#3FA34D' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Total Transactions</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{reportData.totalTx}</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#f0a500' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Avg. per Transaction</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>
                      ₱
                      {reportData.totalTx > 0
                        ? parseFloat(reportData.totalRevenue / reportData.totalTx).toFixed(2)
                        : '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
                <h5 className="mb-3 text-blue">Daily Revenue breakdown</h5>
                {reportData.salesRows && reportData.salesRows.length === 0 ? (
                  <p className="text-muted">No transactions in this date range.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Transactions</th>
                          <th>Revenue (₱)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.salesRows.map((row) => (
                          <tr key={row.txDate}>
                            <td>
                              {new Date(row.txDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td>{row.txCount}</td>
                            <td>
                              <strong>₱{parseFloat(row.revenue).toFixed(2)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="2" className="text-end fw-bold">Total Revenue:</td>
                          <td className="fw-bold text-success">
                            ₱{parseFloat(reportData.totalRevenue || 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OCCUPANCY REPORT */}
          {report === 'occupancy' && (
            <div>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#2155B5' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Total Rooms</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{reportData.totalRooms}</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#3FA34D' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Currently Occupied</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{reportData.occupiedNow}</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="stat-card p-3 rounded text-white text-center" style={{ backgroundColor: '#f0a500' }}>
                    <div style={{ fontSize: '0.75rem', opacity: '0.8' }}>Occupancy Rate</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>
                      {reportData.totalRooms > 0
                        ? ((reportData.occupiedNow / reportData.totalRooms) * 100).toFixed(1)
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
                <h5 className="mb-3 text-blue">Room Utilization by Type</h5>
                {reportData.roomUtilRows && reportData.roomUtilRows.length === 0 ? (
                  <p className="text-muted">No booking data in this date range.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Room Type</th>
                          <th>Total Bookings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData?.roomUtilRows?.map((row) => (
                          <tr key={row.type}>
                            <td>{row.type}</td>
                            <td>{row.bookings} bookings</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INVENTORY MOVEMENT REPORT */}
          {report === 'inventory' && (
            <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
              <h5 className="mb-3 text-blue">Stock Receipt logs</h5>
              {reportData.invRows && reportData.invRows.length === 0 ? (
                <p className="text-muted">No stock-in records in this date range.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Item Name</th>
                        <th>Type</th>
                        <th>Qty Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.invRows?.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            {new Date(row.stockInDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            <strong>{row.itemName}</strong>
                          </td>
                          <td>
                            <span className="badge text-bg-secondary">{row.itemType}</span>
                          </td>
                          <td>{row.quantityReceived} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* GUEST HISTORY REPORT */}
          {report === 'guests' && (
            <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
              <h5 className="mb-3 text-blue">Frequent Guests History</h5>
              {reportData.guestRows && reportData.guestRows.length === 0 ? (
                <p className="text-muted">No guests stays recorded yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Guest Name</th>
                        <th>Email</th>
                        <th>Contact</th>
                        <th>Total Bookings</th>
                        <th>Last Stay Check-Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.guestRows?.map((g, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{`${g.firstName || ''} ${g.lastName || ''}`}</strong>
                          </td>
                          <td>{g.email}</td>
                          <td>{g.contact || '—'}</td>
                          <td>{g.totalBookings} stay(s)</td>
                          <td>
                            {g.lastStay
                              ? new Date(g.lastStay).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-muted text-center py-4">No report data generated.</p>
      )}
    </div>
  );
}
