export default function Loading() {
  return (
    <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
      <div className="placeholder-glow">
        {/* Header Skeleton */}
        <div className="mb-4">
          <div className="placeholder col-3 rounded mb-2" style={{ height: '32px' }}></div>
          <div className="placeholder col-6 rounded" style={{ height: '18px' }}></div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="row g-3 mb-4">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="col-md-3">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '8px', minHeight: '100px' }}>
                <div className="placeholder col-8 rounded mb-2" style={{ height: '14px' }}></div>
                <div className="placeholder col-4 rounded" style={{ height: '28px' }}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Layout Skeleton */}
        <div className="row g-4">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '8px', minHeight: '300px' }}>
              <div className="placeholder col-3 rounded mb-3" style={{ height: '20px' }}></div>
              {[1, 2, 3].map(row => (
                <div key={row} className="d-flex justify-content-between py-2 border-bottom">
                  <div className="placeholder col-6 rounded" style={{ height: '16px' }}></div>
                  <div className="placeholder col-2 rounded" style={{ height: '16px' }}></div>
                </div>
              ))}
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm p-4" style={{ borderRadius: '8px', minHeight: '300px' }}>
              <div className="placeholder col-6 rounded mb-3" style={{ height: '20px' }}></div>
              <div className="d-flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(room => (
                  <div key={room} className="placeholder rounded" style={{ width: '60px', height: '60px' }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
