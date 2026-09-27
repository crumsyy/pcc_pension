import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | PCC Home Suite Home',
  description: 'Operational terms, reservation rules, pricing, and house policies for PCC Home Suite Home Pension House, Passi City, Iloilo.',
};

export default function TermsAndConditionsPage() {
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
            <Link href="/privacy" className="btn btn-outline-primary btn-sm rounded-pill px-3 shadow-sm">
              View Privacy Policy
            </Link>
            <Link href="/auth/register" className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm text-white">
              Create Account
            </Link>
          </div>
        </div>

        {/* Main Document Card */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-5">
          {/* Header Banner */}
          <div className="p-4 p-md-5 text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge bg-white text-primary rounded-pill px-3 py-1.5 fw-semibold shadow-xs">
                Official Hotel Policy
              </span>
              <span className="text-white-50 small">Effective as of {lastUpdated}</span>
            </div>
            <h1 className="fw-extrabold display-6 mb-2">Terms &amp; Conditions</h1>
            <p className="lead mb-0 text-white-50" style={{ fontSize: '1.05rem', maxWidth: '720px' }}>
              Welcome to <strong>PCC Home Suite Home</strong> (Passi City College Pension House &amp; Suites). By accessing our website, creating an account, or placing room reservations and bookings, you agree to comply with and be bound by the operational rules and accounting guidelines set forth below.
            </p>
          </div>

          <div className="card-body p-4 p-md-5">
            {/* Quick Table of Contents */}
            <div className="p-3 mb-4 rounded-3 border bg-light-subtle">
              <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-list-nested text-primary"></i>
                Table of Contents
              </h6>
              <div className="row g-2 small">
                <div className="col-12 col-md-6">
                  <ul className="list-unstyled mb-0 d-flex flex-column gap-1 text-muted">
                    <li><a href="#section-1" className="text-decoration-none text-primary">1. Hotel Identity &amp; System Scope</a></li>
                    <li><a href="#section-2" className="text-decoration-none text-primary">2. Courtesy Holds &amp; Online Reservation Policy</a></li>
                    <li><a href="#section-3" className="text-decoration-none text-primary">3. Room Pricing &amp; Night-by-Night Breakfast</a></li>
                    <li><a href="#section-4" className="text-decoration-none text-primary">4. Occupancy Limits &amp; Extra Guest Fees</a></li>
                    <li><a href="#section-5" className="text-decoration-none text-primary">5. Down Payments, Billing &amp; Payment Options</a></li>
                  </ul>
                </div>
                <div className="col-12 col-md-6">
                  <ul className="list-unstyled mb-0 d-flex flex-column gap-1 text-muted">
                    <li><a href="#section-6" className="text-decoration-none text-primary">6. Per-Capita Mixed Statutory Discounts</a></li>
                    <li><a href="#section-7" className="text-decoration-none text-primary">7. Check-In, Check-Out &amp; Adjustment Hours</a></li>
                    <li><a href="#section-8" className="text-decoration-none text-primary">8. Incidentals, House Rules &amp; Inspection</a></li>
                    <li><a href="#section-9" className="text-decoration-none text-primary">9. Cancellations, Rescheduling &amp; No-Shows</a></li>
                    <li><a href="#section-10" className="text-decoration-none text-primary">10. Account Security &amp; Contact Information</a></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <div id="section-1" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                Hotel Identity &amp; System Scope
              </h4>
              <p className="text-secondary leading-relaxed">
                <strong>PCC Home Suite Home</strong> is the official lodging and accommodation facility operated under Passi City College in Passi City, Iloilo, Philippines. This web-based management portal provides online room inquiry, courtesy holds, booking management, food service ordering, and guest billing services.
              </p>
              <p className="text-secondary leading-relaxed mb-0">
                By registering an account with our portal, you affirm that you are at least 18 years of age, legally capable of entering into contracts, and that all information provided during registration and booking is truthful, accurate, and up to date.
              </p>
            </div>

            {/* Section 2 */}
            <div id="section-2" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                Courtesy Holds &amp; Online Reservation Policy
              </h4>
              <p className="text-secondary leading-relaxed">
                To guarantee equal booking opportunity and prevent date hoarding, the system implements a strict automated courtesy hold system:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>48-Hour Courtesy Hold Window:</strong> Online room reservations placed by guests are temporarily held for exactly 48 hours without upfront payment. During this window, the room is set to <em>Reserved</em> status, preventing other guests from selecting those dates.</li>
                <li><strong>30-Minute Grace Period:</strong> Immediately following the 48-hour period, an automatic 30-minute system grace window is granted to accommodate ongoing payment transactions or front-desk confirmation.</li>
                <li><strong>Automated Release:</strong> If the required down payment is not confirmed or recorded by the conclusion of the hold and grace window, the reservation is automatically marked as <em>Expired</em> or <em>Cancelled</em>, and the room calendar is immediately restored to <em>Available</em> status for the public.</li>
                <li><strong>Advance Booking Notice:</strong> In accordance with front-desk management rules, all online room reservations must be booked at least <strong>two (2) days ahead</strong> of the requested check-in date. Same-day or next-day arrivals must be arranged directly via front-desk walk-in, subject to room availability.</li>
                <li><strong>Single Active Hold Limit:</strong> A registered guest may only hold one active courtesy hold for a specific room and stay duration at any given time.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div id="section-3" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                Room Pricing &amp; Night-by-Night Breakfast Policy
              </h4>
              <p className="text-secondary leading-relaxed">
                PCC Home Suite Home enforces transparent, itemized accommodation and food service pricing:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Pure Room Accommodation Rate:</strong> All room rates without breakfast represent the pure room stay cost. The base room charge is calculated as:
                  <div className="p-2 my-2 bg-light rounded font-monospace small text-dark border">
                    Base Room Accommodation = Rate (Without Breakfast) × Stay Nights
                  </div>
                </li>
                <li><strong>Custom Night-by-Night Breakfast Selection:</strong> For multi-night reservations, guests have the flexibility to customize which mornings they wish to receive cooked breakfast (standard ₱250 or ₱300 per guest per morning). Breakfast fees are itemized as an add-on fee:
                  <div className="p-2 my-2 bg-light rounded font-monospace small text-dark border">
                    Total Breakfast Fee = Breakfast Rate × Total Guest Count × Selected Mornings
                  </div>
                </li>
                <li><strong>Zero Surcharge on Unselected Mornings:</strong> Turning off or deselecting a morning for breakfast charges exactly ₱0.00 for that morning's breakfast, without altering or increasing the base room rate.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div id="section-4" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                Occupancy Limits &amp; Extra Guest Fees
              </h4>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Standard Capacity:</strong> Each suite and guestroom possesses a strict standard occupancy limit (typically 4 persons per room as governed by room inventory records).</li>
                <li><strong>Extra Guest Surcharge:</strong> Any registered occupant beyond the room's base capacity limit incurs an Extra Guest Fee of <strong>₱100.00 per night per excess occupant</strong>.</li>
                <li><strong>Safety &amp; Sanitation:</strong> Total occupants may not exceed the structural fire and hygiene limits of the room. Front-desk personnel reserve the right to require an additional room booking if guest count exceeds comfortable capacity.</li>
              </ul>
            </div>

            {/* Section 5 */}
            <div id="section-5" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
                Down Payments, Billing &amp; Payment Options
              </h4>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Required Down Payment:</strong> A minimum down payment of <strong>50%</strong> (or 100% full payment) of the Net Room Stay Charge (Room Accommodation + Breakfast Fee) is mandatory to convert a courtesy hold into a confirmed, guaranteed booking.</li>
                <li><strong>Payment Channels:</strong> PCC Home Suite Home accepts verified payments via:
                  <ul>
                    <li>Dynamic <strong>QR Ph</strong> instant digital bank transfers (InstaPay / PESONet compliant).</li>
                    <li>Secure online payment processing via <strong>PayMongo</strong> (e-wallets, credit/debit cards).</li>
                    <li>Official receipt over-the-counter cash payments at the Reception Desk.</li>
                  </ul>
                </li>
                <li><strong>Remaining Balance:</strong> Any remaining balance, plus incidental charges and restaurant orders incurred during the stay, is due and payable at check-in or prior to final checkout clearance.</li>
              </ul>
            </div>

            {/* Section 6 */}
            <div id="section-6" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>6</span>
                Per-Capita Mixed Statutory Discounts
              </h4>
              <p className="text-secondary leading-relaxed">
                In strict compliance with Philippine hospitality regulations, Republic Act No. 9994 (Expanded Senior Citizens Act), Republic Act No. 10754 (Persons with Disability Act), and official institutional promotional guidelines:
              </p>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Per-Capita Fair Share Calculation:</strong> The gross room subtotal is divided equally among all registered staying guests:
                  <div className="p-2 my-2 bg-light rounded font-monospace small text-dark border">
                    Per-Capita Share (P) = Gross Room Subtotal / Total Guest Count
                  </div>
                </li>
                <li><strong>Targeted Beneficiary Application:</strong> Approved statutory discount percentages (e.g., 20% for Senior Citizens and PWDs, 5% for Students) apply exclusively to the eligible guest's proportionate share ($P$). Non-beneficiary guests sharing the room pay their regular per-capita share.</li>
                <li><strong>Physical ID Verification:</strong> Valid, government-issued Senior Citizen OSCA ID, PWD ID, or current Student ID must be presented to the receptionist upon check-in. Failure to provide physical proof will result in the discount being voided on the final billing folio.</li>
              </ul>
            </div>

            {/* Section 7 */}
            <div id="section-7" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>7</span>
                Check-In, Check-Out &amp; Adjustment Hours
              </h4>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Standard Hours:</strong> Standard Check-In is at <strong>2:00 PM (14:00)</strong>. Standard Check-Out is at <strong>12:00 PM noon</strong>.</li>
                <li><strong>Early Check-In Fee:</strong> Guests arriving and occupying rooms prior to 2:00 PM on their arrival date are subject to room readiness and an automated Early Check-In Fee of <strong>₱50.00 per hour</strong> before 2:00 PM.</li>
                <li><strong>Late Check-Out Fee:</strong> Departures beyond 12:00 PM noon require receptionist approval and incur a Late Departure Fee of <strong>₱100.00 per hour</strong>. Check-outs extending past 4:00 PM will incur a charge equivalent to an additional full night's stay.</li>
              </ul>
            </div>

            {/* Section 8 */}
            <div id="section-8" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>8</span>
                Incidentals, House Rules &amp; Inspection
              </h4>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Checkout Room Inspection:</strong> Prior to releasing the final billing and security deposit, housekeeping conducts a rapid room inspection to verify the condition of towels, linens, furniture, remote controls, and keys.</li>
                <li><strong>Damage &amp; Loss Billing:</strong> Stained or damaged linens, broken glassware, unreturned room keys, or damaged hotel amenities will be added to the guest's folio as Incidental Charges and must be settled before departure.</li>
                <li><strong>Non-Smoking Ordinance:</strong> In accordance with local government health ordinances, smoking or vaping is strictly prohibited inside all guest rooms and enclosed corridors. A designated smoking area is available on premises. A sanitation penalty of ₱1,500.00 will be charged for in-room smoking violations.</li>
                <li><strong>Quiet Hours:</strong> Observance of quiet hours begins at 10:00 PM nightly for the comfort and rest of all staying guests.</li>
              </ul>
            </div>

            {/* Section 9 */}
            <div id="section-9" className="mb-4 pb-3 border-bottom">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>9</span>
                Cancellations, Rescheduling &amp; No-Shows
              </h4>
              <ul className="text-secondary leading-relaxed">
                <li><strong>Courtesy Hold Cancellation:</strong> Unconfirmed courtesy holds may be cancelled at any time by the guest via their portal dashboard without any fee or penalty.</li>
                <li><strong>Confirmed Booking Cancellation:</strong> Cancellations made at least 48 hours prior to check-in may be converted into hotel stay credits or rescheduled subject to room availability. Cancellations made within 24 hours of check-in may forfeit the 50% deposit.</li>
                <li><strong>No-Show Policy:</strong> Guests who fail to arrive by 11:59 PM on their scheduled check-in date without prior notification will be designated as a <em>No Show</em>, and their room may be released to accommodate waiting guests.</li>
              </ul>
            </div>

            {/* Section 10 */}
            <div id="section-10">
              <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                <span className="badge bg-primary rounded-circle" style={{ width: 28, height: 28, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>10</span>
                Account Security &amp; Contact Information
              </h4>
              <p className="text-secondary leading-relaxed">
                Guests are responsible for preserving the confidentiality of their portal passwords and OTP security verification codes. For any billing questions, stay rescheduling, or special requests, please contact our front-desk administration:
              </p>
              <div className="p-3 bg-light rounded-3 border">
                <div className="fw-bold text-dark mb-1">PCC Home Suite Home Front Desk &amp; Administration</div>
                <div className="small text-muted mb-1"><i className="bi bi-geo-alt-fill text-danger me-1"></i> Passi City College Campus, Passi City, Iloilo, 5037 Philippines</div>
                <div className="small text-muted mb-1"><i className="bi bi-envelope-fill text-primary me-1"></i> Email: <a href="mailto:receptionist@pccsuite.com" className="text-decoration-none">receptionist@pccsuite.com</a> / <a href="mailto:admin@pccsuite.com" className="text-decoration-none">admin@pccsuite.com</a></div>
                <div className="small text-muted"><i className="bi bi-telephone-fill text-success me-1"></i> Front Desk Contact: 0912-345-6789 / Local (033) 396-0000</div>
              </div>
            </div>
          </div>

          <div className="card-footer bg-light p-4 text-center border-0">
            <span className="text-muted small">
              By using our booking system and registering an account, you acknowledge that you have read, understood, and agreed to these Terms &amp; Conditions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
