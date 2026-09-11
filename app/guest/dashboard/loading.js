export default function GuestDashboardLoading() {
  return (
    <div className="d-flex flex-column flex-lg-row" style={{ minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc' }}>
      {/* Desktop Sidebar Skeleton Placeholder */}
      <div
        className="d-none d-lg-block p-3 text-white flex-shrink-0"
        style={{
          width: '240px',
          backgroundColor: '#0a3663',
          minHeight: '100vh'
        }}
      >
        <div className="placeholder-glow">
          <div className="placeholder col-8 rounded mb-4" style={{ height: '32px' }}></div>
          <div className="d-flex flex-column gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="placeholder col-10 rounded py-3" style={{ height: '36px', opacity: 0.25 }}></div>
            ))}
          </div>
          <div className="pt-4 mt-auto border-top border-white-50">
            <div className="d-flex align-items-center gap-2">
              <div className="placeholder rounded-circle" style={{ width: '36px', height: '36px' }}></div>
              <div className="flex-grow-1">
                <div className="placeholder col-8 rounded mb-1" style={{ height: '14px' }}></div>
                <div className="placeholder col-5 rounded" style={{ height: '10px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow-1 d-flex flex-column min-vh-100">
        {/* Mobile Top Navbar Skeleton */}
        <header className="d-lg-none bg-white border-bottom px-3 py-2.5 d-flex align-items-center justify-content-between">
          <div className="placeholder-glow d-flex align-items-center gap-2">
            <div className="placeholder rounded" style={{ width: '32px', height: '32px' }}></div>
            <div className="placeholder rounded" style={{ width: '120px', height: '20px' }}></div>
          </div>
          <div className="placeholder-glow d-flex align-items-center gap-2">
            <div className="placeholder rounded-circle" style={{ width: '32px', height: '32px' }}></div>
          </div>
        </header>

        {/* Dashboard Body Skeleton */}
        <main className="flex-grow-1 p-3 p-lg-4">
          <div className="placeholder-glow">
            {/* Hero Welcome Card Skeleton */}
            <div
              className="card border-0 shadow-sm p-4 mb-4 text-white"
              style={{
                borderRadius: '16px',
                backgroundColor: '#0a3663',
                minHeight: '130px'
              }}
            >
              <div className="placeholder col-3 rounded mb-2" style={{ height: '20px', opacity: 0.4 }}></div>
              <div className="placeholder col-7 col-md-5 rounded mb-2" style={{ height: '30px', opacity: 0.6 }}></div>
              <div className="placeholder col-5 col-md-4 rounded" style={{ height: '16px', opacity: 0.35 }}></div>
            </div>

            {/* Metrics Widgets Skeleton */}
            <div className="row g-2 g-md-3 mb-4">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="col-4">
                  <div className="card shadow-sm border-0 p-3 text-center bg-white" style={{ borderRadius: '12px' }}>
                    <div className="placeholder col-6 rounded mx-auto mb-2" style={{ height: '28px' }}></div>
                    <div className="placeholder col-8 rounded mx-auto" style={{ height: '14px' }}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions Skeleton */}
            <div className="placeholder col-3 rounded mb-2" style={{ height: '18px' }}></div>
            <div className="row g-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="col-6 col-md-3">
                  <div className="placeholder col-12 rounded" style={{ height: '44px' }}></div>
                </div>
              ))}
            </div>

            {/* Room Cards Skeleton Section */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="placeholder col-4 col-md-2 rounded" style={{ height: '22px' }}></div>
              <div className="placeholder col-2 col-md-1 rounded" style={{ height: '18px' }}></div>
            </div>
            <div className="row g-3 mb-4">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="col-12 col-sm-6 col-lg-3">
                  <div className="card border-0 shadow-sm h-100 bg-white" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <div className="placeholder col-12" style={{ height: '160px' }}></div>
                    <div className="p-3">
                      <div className="d-flex justify-content-between mb-2">
                        <div className="placeholder col-6 rounded" style={{ height: '20px' }}></div>
                        <div className="placeholder col-3 rounded" style={{ height: '18px' }}></div>
                      </div>
                      <div className="placeholder col-9 rounded mb-3" style={{ height: '14px' }}></div>
                      <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <div className="placeholder col-4 rounded" style={{ height: '22px' }}></div>
                        <div className="placeholder col-4 rounded" style={{ height: '32px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Booking History Section Skeleton */}
            <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
              <div className="placeholder col-4 col-md-3 rounded mb-3" style={{ height: '22px' }}></div>
              <div className="placeholder col-12 rounded mb-2" style={{ height: '56px' }}></div>
              <div className="placeholder col-12 rounded" style={{ height: '56px' }}></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
