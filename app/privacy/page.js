import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | PCC Home Suite Home',
  description: 'Data privacy principles and policies compliant with RA 10173 (Philippine Data Privacy Act of 2012) for PCC Home Suite Home Pension House.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 28, 2026";

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <Link href="/" className="btn btn-outline-secondary btn-sm rounded-pill px-3 shadow-sm d-inline-flex align-items-center gap-1.5">
            <i className="bi bi-arrow-left"></i>
            <span>Back to Home</span>
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Link href="/terms" className="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm">
              View Terms &amp; Conditions
            </Link>
            <Link href="/auth/register" className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm text-white">
              Create Account
            </Link>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-5">
          {/* Header Banner */}
          <div className="p-4 p-md-5 text-white" style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge bg-white text-success rounded-pill px-3 py-1.5 fw-semibold shadow-xs">
                RA 10173 Compliant
              </span>
              <span className="text-white-50 small">Effective as of {lastUpdated}</span>
            </div>
            <h1 className="fw-extrabold display-6 mb-2">Privacy Policy</h1>
            <p className="lead mb-0 text-white-50" style={{ fontSize: '1.05rem', maxWidth: '720px' }}>
              At <strong>PCC Home Suite Home</strong>, we hold your trust and personal privacy in the highest regard. This Privacy Policy details our protocols for collecting, processing, securing, and safeguarding your personal data in strict compliance with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.
            </p>
          </div>

          <div className="card-body p-4 p-md-5">
            {/* Quick Summary Notice */}
            <div className="alert alert-success d-flex align-items-start gap-3 p-3 rounded-3 mb-4">
              <i className="bi bi-shield-check fs-3 text-success flex-shrink-0 mt-1"></i>
              <div className="small">
                <strong>Data Privacy Commitment:</strong> We never sell, lease, or monetize your personal information to third-party advertisers. All collected information is used solely for guest profile management, room reservation processing, stay verification, security authentication, and government-mandated hospitality reporting.
              </div>
            </div>

            {/* Section 1 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                Information We Collect
              </h4>
              <p className="text-secondary leading-relaxed">
                When you create an account or interact with our pension house management system, we collect specific categories of personal data:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Guest Identity Data:</strong> First name, middle name (optional), last name, gender, date of birth, city/municipality, and province of residence.</li>
                <li><strong>Contact Details:</strong> Verified email address and Philippine mobile contact number (format: 09XXXXXXXXX).</li>
                <li><strong>Authentication &amp; Security Data:</strong> Encrypted password hashes (bcrypt), One-Time Password (OTP) verification records, login timestamps, and session tokens used to prevent unauthorized concurrent logins.</li>
                <li><strong>Reservation &amp; Stay History:</strong> Check-in and check-out dates, room selections, guest counts, special requests, custom night-by-night breakfast selections, and courtesy hold history.</li>
                <li><strong>Billing &amp; Transaction Records:</strong> Down payment amounts, remaining balances, payment methods (QR Ph, PayMongo reference IDs, official receipt numbers), and room service / cooked meal orders. <em>(Note: Sensitive banking card numbers are processed directly by PCI-DSS compliant payment gateways and are never stored on our servers.)</em></li>
                <li><strong>Government Discount Verification Data:</strong> Senior Citizen ID numbers (OSCA), PWD identification numbers, or student matriculation details when claiming statutory discount benefits.</li>
              </ul>
            </div>

            {/* Section 2 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                Purpose of Data Processing
              </h4>
              <p className="text-secondary leading-relaxed">
                Your personal data is collected and processed strictly for legitimate operational purposes:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Service Fulfillment:</strong> Facilitating room reservations, scheduling courtesy holds, preparing guest accommodations, and delivering requested breakfast or room service orders.</li>
                <li><strong>Security &amp; Account Protection:</strong> Verifying identity via email OTP codes, ensuring single-session access to protect against unauthorized account takeovers, and monitoring suspicious activity.</li>
                <li><strong>Billing &amp; Financial Invoicing:</strong> Generating itemized folios, calculating required down payments, recording transaction proofs, and issuing official accommodation receipts.</li>
                <li><strong>Legal &amp; Regulatory Compliance:</strong> Fulfilling local government reporting standards, fire safety registry requirements, and statutory discount auditing mandated by Republic Act No. 9994 and Republic Act No. 10754.</li>
                <li><strong>Guest Communication:</strong> Sending automated email notices regarding courtesy hold confirmations, 48-hour expiration warnings, password resets, and room status updates.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                Data Storage &amp; Information Security
              </h4>
              <p className="text-secondary leading-relaxed">
                We implement robust organizational, physical, and technological security measures to protect your personal data from loss, unauthorized access, or unlawful alteration:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>End-to-End Encryption:</strong> All data transmitted between your browser and our servers is secured using modern Transport Layer Security (TLS/HTTPS).</li>
                <li><strong>Cryptographic Password Hashing:</strong> Guest and staff passwords are cryptographically salted and hashed using industry-standard bcrypt algorithms. No plaintext passwords exist in our databases.</li>
                <li><strong>Role-Based Access Control (RBAC):</strong> Access to guest profiles and financial ledgers is strictly segregated by authenticated roles (Administrator, Receptionist, and Guest). Staff can only view information essential for performing their duties.</li>
                <li><strong>Secure Session Management:</strong> We utilize encrypted HTTP-only, secure cookies with JWT tokens and database-backed session token synchronization to immediately detect concurrent logins.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                Data Sharing &amp; Third-Party Processors
              </h4>
              <p className="text-secondary leading-relaxed">
                We do not disclose your personal information to third parties except under the following bounded conditions:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Verified Payment Partners:</strong> Authorized payment processors (such as PayMongo and QR Ph / InstaPay partner banks) to safely execute online payments.</li>
                <li><strong>Email Delivery Services:</strong> Secure transactional email dispatchers used solely to send your OTP verification codes and reservation updates.</li>
                <li><strong>Legal Obligations:</strong> When strictly required by lawful subpoena, court order, or authorized government agencies pursuant to Philippine law and public health/safety directives.</li>
              </ul>
            </div>

            {/* Section 5 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
                Your Rights as a Data Subject
              </h4>
              <p className="text-secondary leading-relaxed">
                Under Chapter IV of the Philippine Data Privacy Act of 2012, you are entitled to the following statutory rights:
              </p>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <div className="fw-bold text-dark mb-1"><i className="bi bi-eye-fill text-primary me-1.5"></i> Right to be Informed &amp; Access</div>
                    <div className="small text-muted">You have the right to know how your personal data is collected and request a copy of the records we maintain about you.</div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <div className="fw-bold text-dark mb-1"><i className="bi bi-pencil-square text-success me-1.5"></i> Right to Rectification</div>
                    <div className="small text-muted">You may update or correct inaccurate or incomplete profile details at any time through your guest dashboard or front-desk assistance.</div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <div className="fw-bold text-dark mb-1"><i className="bi bi-trash3-fill text-danger me-1.5"></i> Right to Erasure / Blocking</div>
                    <div className="small text-muted">You have the right to request the suspension, withdrawal, or deletion of your personal account, subject to mandatory accounting retention laws.</div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <div className="fw-bold text-dark mb-1"><i className="bi bi-shield-lock-fill text-warning me-1.5"></i> Right to Data Portability</div>
                    <div className="small text-muted">You have the right to obtain your electronic stay history and receipt records in an open, structured digital format.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>6</span>
                Data Retention Period
              </h4>
              <p className="text-secondary leading-relaxed mb-0">
                Active guest accounts and reservation histories are preserved as long as your account remains active. Accounting transaction logs, official receipts, and discount verification records are retained for a minimum of <strong>five (5) years</strong> in compliance with the Bureau of Internal Revenue (BIR) and Commission on Audit (COA) institutional mandates, after which they are securely scrubbed or permanently anonymized.
              </p>
            </div>

            {/* Section 7 */}
            <div>
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-success rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>7</span>
                Data Protection Officer &amp; Inquiries
              </h4>
              <p className="text-secondary leading-relaxed">
                If you have questions, feedback, or concerns regarding your privacy rights, or wish to exercise any of your data subject rights, please contact our designated Data Protection Officer:
              </p>
              <div className="p-3 bg-light rounded-3 border">
                <div className="fw-bold text-dark mb-1">Data Protection Officer (DPO) / Hotel Administration</div>
                <div className="small text-muted mb-1"><i className="bi bi-building text-success me-1"></i> PCC Home Suite Home – Passi City College</div>
                <div className="small text-muted mb-1"><i className="bi bi-geo-alt-fill text-danger me-1"></i> Passi City College Campus, Passi City, Iloilo, 5037 Philippines</div>
                <div className="small text-muted mb-1"><i className="bi bi-envelope-fill text-primary me-1"></i> Email: <a href="mailto:privacy@pccsuite.com" className="text-decoration-none">privacy@pccsuite.com</a> / <a href="mailto:admin@pccsuite.com" className="text-decoration-none">admin@pccsuite.com</a></div>
                <div className="small text-muted"><i className="bi bi-telephone-fill text-success me-1"></i> Phone: (033) 396-0000 / 0912-345-6789</div>
              </div>
            </div>
          </div>

          <div className="card-footer bg-light p-4 text-center border-0">
            <span className="text-muted small">
              By using our website, services, and registering an account, you consent to the processing of your personal data as outlined in this Privacy Policy.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
