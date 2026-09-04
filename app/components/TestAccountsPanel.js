'use client';

/**
 * Temporary QA Testing Accounts Panel
 * Displays hardcoded test credentials for Receptionist, Admin, and Guest.
 * Can be easily removed when testing is complete.
 */
export default function TestAccountsPanel({ onSelectAccount }) {
  const accounts = [
    {
      role: 'Receptionist',
      email: 'receptionist@test.com',
      password: 'password123',
      badgeClass: 'bg-primary text-white',
      desc: 'Front Desk: reservations, lodging, check-in/out'
    },
    {
      role: 'Admin',
      email: 'admin@test.com',
      password: 'password123',
      badgeClass: 'bg-danger text-white',
      desc: 'Full System: user & room management, audit logs'
    },
    {
      role: 'Guest',
      email: 'loydiecaspillo@gmail.com',
      password: 'Password123!',
      badgeClass: 'bg-success text-white',
      desc: 'Customer: book stays, reserve rooms, profile'
    }
  ];

  const handleFill = (acc) => {
    if (typeof onSelectAccount === 'function') {
      try {
        onSelectAccount(acc.email, acc.password);
      } catch (err) {
        console.error('Error autofilling test account:', err);
      }
    }
  };

  return (
    <div 
      className="card mt-4 border-warning shadow-sm"
      style={{
        borderRadius: '10px',
        backgroundColor: '#fffdf5',
        border: '1.5px dashed #ffc107'
      }}
    >
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-1.5">
            <span className="badge bg-warning text-dark fw-bold px-2 py-1" style={{ fontSize: '0.72rem' }}>
              QA TEST ACCOUNTS
            </span>
            <small className="text-muted" style={{ fontSize: '0.76rem' }}>
              Click Quick-Fill to auto-populate credentials
            </small>
          </div>
          <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
            Testing Only
          </span>
        </div>

        <div className="d-flex flex-column gap-2">
          {accounts.map((acc) => (
            <div 
              key={acc.role}
              className="d-flex align-items-center justify-content-between p-2 rounded bg-white border"
              style={{ fontSize: '0.82rem' }}
            >
              <div className="d-flex align-items-center gap-2">
                <span className={`badge ${acc.badgeClass} fw-semibold`} style={{ minWidth: '85px', textAlign: 'center' }}>
                  {acc.role}
                </span>
                <div>
                  <div className="fw-bold text-dark font-monospace" style={{ fontSize: '0.8rem' }}>
                    {acc.email}
                  </div>
                  <small className="text-muted d-none d-sm-block" style={{ fontSize: '0.7rem' }}>
                    {acc.desc}
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-warning text-dark fw-bold px-2.5 py-1"
                style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                onClick={() => handleFill(acc)}
                title={`Autofill ${acc.role} credentials`}
              >
                ⚡ Quick-Fill
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
