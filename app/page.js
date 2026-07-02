"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import GuestChatBubble from "./components/GuestChatBubble";

export default function Home() {
  // Search state
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomType, setRoomType] = useState("Any room type");
  const [breakfast, setBreakfast] = useState("With Breakfast");



  const [year, setYear] = useState(2026);
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);



  const [availableRooms, setAvailableRooms] = useState([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session-check');
        const data = await res.json();
        if (res.ok && data.valid) {
          setCurrentUser(data.session);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    }
    checkSession();
  }, []);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setSearching(true);
    setSearchTriggered(true);
    try {
      const res = await fetch(`/api/rooms/availability?checkIn=${checkIn}&checkOut=${checkOut}&roomType=${encodeURIComponent(roomType)}&breakfast=${encodeURIComponent(breakfast)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch room availability');
      setAvailableRooms(data.rooms || []);
      setShowResultsModal(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleBookNow = async (roomID) => {
    if (!currentUser || currentUser.role !== 'Guest') {
      window.location.href = `/auth/register?check_in=${checkIn}&check_out=${checkOut}&room_id=${roomID}&breakfast=${breakfast}`;
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomID, checkInDate: checkIn })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit reservation request');
      alert(data.message || 'Reservation request submitted successfully!');
      setShowResultsModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBookingInProgress(false);
    }
  };

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-pcc sticky-top">
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
            <img src="/assets/images/logo.jpg" alt="PCC Home Suite Home logo" height="42" style={{ borderRadius: "4px" }} />
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="mainNav">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
              <li className="nav-item"><a className="nav-link" href="#home">Home</a></li>
              <li className="nav-item"><a className="nav-link" href="#about">About</a></li>
              <li className="nav-item"><a className="nav-link" href="#rooms">Rooms &amp; Rates</a></li>
              <li className="nav-item"><a className="nav-link" href="#amenities">Amenities</a></li>
              <li className="nav-item"><a className="nav-link" href="#contact">Contact</a></li>
              <li className="nav-item mt-2 mt-lg-0">
                <Link href="/auth/login" className="btn btn-pcc-outline btn-sm me-2">Log In</Link>
              </li>
              <li className="nav-item mt-2 mt-lg-0">
                <Link href="/auth/register" className="btn btn-pcc-primary btn-sm">Book Now</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* HERO + AVAILABILITY SEARCH */}
      <section className="hero" id="home">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <div className="eyebrow mb-3">Osmeña Street, Zone 1 · Koronadal City</div>
              <h1 className="mb-3">Your <em>home</em> away<br />from home.</h1>
              <p className="lead mb-4">
                PCC Home Suite Home offers comfortable, affordable, and well-kept rooms
                for travelers, families, and long-staying guests in the heart of Koronadal City —
                with friendly service and everything you need to feel at home.
              </p>
              <div className="d-flex gap-3">
                <a href="#rooms" className="btn btn-pcc-primary">View Rooms &amp; Rates</a>
                <Link href="/auth/register" className="btn btn-pcc-outline">Create an Account</Link>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="availability-bar">
                <form onSubmit={handleSearchSubmit} className="row g-3 align-items-end">
                  <div className="col-12">
                    <span className="section-eyebrow d-block">Check Availability</span>
                    <h4 className="text-blue mb-0">Plan your stay</h4>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1">Check-in</label>
                    <input
                      type="date"
                      className="form-control"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1">Check-out</label>
                    <input
                      type="date"
                      className="form-control"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label d-block mb-1">Room Type</label>
                    <select
                      className="form-select"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                    >
                      <option>Any room type</option>
                      <option>Standard Matrimonial</option>
                      <option>Twin Matrimonial</option>
                      <option>Deluxe Matrimonial</option>
                    </select>
                  </div>
                  <div className="col-md-5">
                    <label className="form-label d-block mb-1">Breakfast</label>
                    <select
                      className="form-select"
                      value={breakfast}
                      onChange={(e) => setBreakfast(e.target.value)}
                    >
                      <option>With Breakfast</option>
                      <option>Without Breakfast</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <button type="submit" className="btn btn-pcc-primary w-100" disabled={searching}>
                      {searching ? "Checking..." : "Check Availability"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section" id="about">
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6">
              <div className="about-figure">
                <div className="tag-line">
                  &quot;Make yourself<br />at home —<br />that&apos;s the<br />PCC promise.&quot;
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="section-eyebrow">About Us</div>
              <h2 className="section-title mb-3">A pension house that feels like home</h2>
              <p className="text-muted">
                Located along Osmeña Street, Zone 1, Koronadal City, PCC Home Suite Home
                provides clean, secure, and budget-friendly accommodations for guests
                visiting the city for work, leisure, or family matters. Our two-floor
                property offers Standard, Twin, and Deluxe Matrimonial rooms, each
                available with or without breakfast — so you can choose what fits
                your stay best.
              </p>
              <div className="stat-row">
                <div>
                  <div className="stat-number">2</div>
                  <div className="stat-label">Floors</div>
                </div>
                <div>
                  <div className="stat-number">3</div>
                  <div className="stat-label">Room Types</div>
                </div>
                <div>
                  <div className="stat-number">24/7</div>
                  <div className="stat-label">Front Desk</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROOMS & RATES */}
      <section className="section bg-mist" id="rooms">
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-eyebrow">Rooms &amp; Rates</div>
            <h2 className="section-title">Find your room</h2>
            <p className="text-muted">All rates are per night and listed without &amp; with breakfast.</p>
          </div>

          {/* Ground Floor */}
          <div className="floor-block">
            <div className="floor-label">
              <div className="floor-number">01</div>
              <div>
                <div className="display-font text-blue" style={{ fontSize: "1.15rem" }}>Ground Floor</div>
                <div className="floor-name">Standard · Twin · Deluxe Matrimonial</div>
              </div>
              <hr />
            </div>
            <div className="row g-4">
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Standard Matrimonial</div>
                  <div className="room-meta">Sleeps 2&ndash;4 · 2 extra foam</div>
                  <p className="room-desc">A cozy room with the essentials for a comfortable short or long stay.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱1,200</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱1,500</span>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Twin Matrimonial</div>
                  <div className="room-meta">Sleeps 4&ndash;5 · 1 extra foam</div>
                  <p className="room-desc">Twin bed setup, perfect for families or groups traveling together.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱1,300</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱1,800</span>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Deluxe Matrimonial</div>
                  <div className="room-meta">Sleeps 5&ndash;7 · 2 extra foam</div>
                  <p className="room-desc">Our most spacious option, ideal for bigger groups and extended stays.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱2,100</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱2,500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Second Floor */}
          <div className="floor-block mb-0">
            <div className="floor-label">
              <div className="floor-number">02</div>
              <div>
                <div className="display-font text-blue" style={{ fontSize: "1.15rem" }}>Second Floor</div>
                <div className="floor-name">Standard · Twin · Deluxe Matrimonial</div>
              </div>
              <hr />
            </div>
            <div className="row g-4">
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Standard Matrimonial</div>
                  <div className="room-meta">Sleeps 2&ndash;4 · 2 extra foam</div>
                  <p className="room-desc">A quiet upper-floor room with the same comfort as our ground floor standard.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱1,500</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱1,800</span>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Twin Matrimonial</div>
                  <div className="room-meta">Sleeps 4&ndash;5 · 1 extra foam</div>
                  <p className="room-desc">Second floor twin room, great for groups who prefer a higher vantage.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱1,800</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱2,200</span>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag d-flex flex-column">
                  <div className="room-type">Deluxe Matrimonial</div>
                  <div className="room-meta">Sleeps 5&ndash;7 · 2 extra foam</div>
                  <p className="room-desc">Top-floor deluxe room — our largest and most premium accommodation.</p>
                  <div className="rate-row">
                    <span className="rate-label">Without breakfast</span>
                    <span className="rate-value">₱2,200</span>
                  </div>
                  <div className="rate-row">
                    <span className="rate-label">With breakfast</span>
                    <span className="rate-value">₱2,500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AMENITIES */}
      <section className="section" id="amenities">
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-eyebrow">What We Offer</div>
            <h2 className="section-title">Amenities &amp; Services</h2>
          </div>
          <div className="row g-4">
            <div className="col-md-3 col-6">
              <div className="amenity-card">
                <div className="amenity-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></svg>
                </div>
                <h3>Clean Linens</h3>
                <p>Fresh bedding and towels provided for every stay.</p>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="amenity-card">
                <div className="amenity-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12" y2="20" /></svg>
                </div>
                <h3>Free Wi-Fi</h3>
                <p>Stay connected throughout your stay at no extra cost.</p>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="amenity-card">
                <div className="amenity-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" /></svg>
                </div>
                <h3>Breakfast Option</h3>
                <p>Add a hearty breakfast to any room booking.</p>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="amenity-card">
                <div className="amenity-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <h3>24/7 Front Desk</h3>
                <p>Our staff is on hand any time you need assistance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-pcc" id="contact">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-4">
              <h5>PCC Home Suite Home</h5>
              <p className="mb-1">Osmeña Street, Zone 1</p>
              <p>Koronadal City, South Cotabato</p>
            </div>
            <div className="col-lg-4">
              <h5>Quick Links</h5>
              <ul className="list-unstyled" style={{ paddingLeft: "0", listStyle: "none" }}>
                <li className="mb-2"><a href="#rooms">Rooms &amp; Rates</a></li>
                <li className="mb-2"><a href="#amenities">Amenities</a></li>
                <li className="mb-2"><Link href="/auth/register">Create an Account</Link></li>
                <li className="mb-2"><Link href="/auth/login">Staff / Guest Login</Link></li>
              </ul>
            </div>
            <div className="col-lg-4">
              <h5>Get in Touch</h5>
              <p className="mb-1">Email: info@pccsuite.com</p>
              <p>Phone: 09000000000</p>
            </div>
          </div>
          <hr />
          <div className="footer-bottom text-center">
            &copy; {year} PCC Home Suite Home. All rights reserved.
          </div>
        </div>
      </footer>

      {/* CHATBOT WIDGET */}
      <GuestChatBubble />

      {/* AVAILABILITY RESULTS MODAL */}
      {showResultsModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0" style={{ borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
              <div className="modal-header px-4 py-3" style={{ background: 'var(--pcc-blue)', color: '#fff', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                <h5 className="modal-title fw-bold">Available Rooms</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResultsModal(false)}></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="mb-3 p-3 bg-light rounded" style={{ fontSize: '0.9rem' }}>
                  Dates: <strong>{new Date(checkIn).toLocaleDateString()}</strong> to <strong>{new Date(checkOut).toLocaleDateString()}</strong>
                  <span className="mx-2">|</span> Option: <strong>{breakfast}</strong>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <span style={{ fontSize: '2.5rem' }}>🛏️</span>
                    <h5 className="mt-3 fw-bold">No Rooms Available</h5>
                    <p className="small mb-0">Sorry, there are no rooms of this type vacant for the selected stay dates. Please try other dates.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {availableRooms.map((rm) => (
                      <div key={rm.roomID} className="p-3 border rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center bg-white shadow-sm" style={{ transition: 'all 0.2s' }}>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>Room {rm.roomNumber}</span>
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill" style={{ fontSize: '0.75rem' }}>Available</span>
                          </div>
                          <h6 className="text-pcc-primary fw-semibold mb-1">{rm.roomType} · {rm.floor}</h6>
                          <p className="text-muted small mb-0" style={{ maxWidth: '480px' }}>{rm.description}</p>
                        </div>
                        <div className="text-md-end mt-3 mt-md-0 d-flex flex-row flex-md-column justify-content-between align-items-center align-items-md-end gap-2">
                          <div>
                            <div className="text-muted small">Price per night</div>
                            <span className="fw-bold text-pcc-primary" style={{ fontSize: '1.35rem' }}>₱{parseFloat(rm.rate).toFixed(2)}</span>
                          </div>
                          {currentUser && currentUser.role === 'Guest' ? (
                            <button 
                              onClick={() => handleBookNow(rm.roomID)}
                              className="btn btn-pcc-primary text-white btn-sm px-4 py-2"
                              style={{ borderRadius: '6px' }}
                              disabled={bookingInProgress}
                            >
                              {bookingInProgress ? "Booking..." : "Book Now"}
                            </button>
                          ) : (
                            <Link 
                              href={`/auth/register?check_in=${checkIn}&check_out=${checkOut}&room_id=${rm.roomID}&breakfast=${breakfast}`}
                              className="btn btn-pcc-primary text-white btn-sm px-4 py-2"
                              style={{ borderRadius: '6px' }}
                            >
                              Book Now
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 px-4 py-3">
                <button type="button" className="btn btn-secondary text-white px-4" onClick={() => setShowResultsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
