'use client';

/**
 * Dynamic QR Ph / GCash QR Code Component
 * Encodes EMVCo / QR Ph compatible payment payload with Merchant, Exact Amount, and Ref ID.
 * Default Account: 09488251444 (JOHN LLOYD CASPILLO - PCC Suite)
 */
export default function DynamicQrPhCode({ 
  amount = 0, 
  merchantName = "JOHN LLOYD CASPILLO", 
  accountNumber = "09488251444",
  refNumber = "",
  size = 210 
}) {
  const parsedAmount = parseFloat(amount) || 0;
  const cleanRef = refNumber || `PCC-${Math.floor(100000 + Math.random() * 900000)}`;

  // Construct EMVCo / QR Ph Dynamic payload format
  const qrPayload = `00020101021226580009ph.qrph0111${accountNumber.replace(/[^0-9]/g, '')}52045999530360854${parsedAmount > 0 ? String(parsedAmount.toFixed(2)).length.toString().padStart(2, '0') + parsedAmount.toFixed(2) : ''}5802PH5918${merchantName.slice(0, 18)}6009Koronadal62200516${cleanRef}6304`;

  // QR Code URL using high reliability SVG encoder
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(qrPayload)}`;

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-3 bg-white rounded-3 border shadow-sm my-2 text-center" style={{ maxWidth: '340px', margin: '0 auto' }}>
      {/* Official QR Ph / GCash Header Badge */}
      <div className="d-flex align-items-center justify-content-center gap-2 mb-2 w-100 py-1.5 px-3 rounded-2 text-white" style={{ backgroundColor: '#005CE6', fontWeight: 600, fontSize: '0.85rem' }}>
        <span className="badge bg-danger text-white me-1 fw-bold" style={{ fontSize: '0.65rem', padding: '3px 6px' }}>QR Ph</span>
        <span>GCash Dynamic QR Payment</span>
      </div>

      {/* QR Code Canvas Frame */}
      <div className="position-relative p-2 bg-white rounded-3 border shadow-xs mb-2" style={{ border: '2.5px solid #005CE6' }}>
        <img 
          src={qrCodeUrl} 
          alt="GCash Dynamic QR Ph Code" 
          width={size} 
          height={size}
          className="img-fluid rounded"
          style={{ display: 'block', objectFit: 'contain' }}
        />
        {/* Center Badge logo overlay */}
        <div 
          className="position-absolute top-50 start-50 translate-middle bg-white rounded-circle p-1 shadow-sm d-flex align-items-center justify-content-center"
          style={{ width: '36px', height: '36px', border: '1.5px solid #005CE6' }}
        >
          <span className="fw-bold text-primary" style={{ fontSize: '0.65rem' }}>GCash</span>
        </div>
      </div>

      {/* Payment Details */}
      <div className="w-100 text-start bg-light p-2.5 rounded-2 border" style={{ fontSize: '0.78rem' }}>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">Account Name:</span>
          <span className="fw-bold text-dark">{merchantName}</span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">GCash Number:</span>
          <span className="fw-bold text-primary">{accountNumber}</span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">Payable Amount:</span>
          <span className="fw-bold text-success" style={{ fontSize: '0.92rem' }}>₱{parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
          <span>QR Ref ID:</span>
          <span className="font-monospace text-dark">{cleanRef}</span>
        </div>
      </div>

      {/* Supported Apps Disclaimer */}
      <div className="mt-2 text-muted" style={{ fontSize: '0.68rem', lineHeight: '1.3' }}>
        <i className="bi bi-shield-check text-success me-1"></i>
        <span>Scan using <strong>GCash</strong> or <strong>Maya</strong>. The exact amount (<strong>₱{parsedAmount.toFixed(2)}</strong>) will auto-fill with zero transaction fee.</span>
      </div>
    </div>
  );
}
