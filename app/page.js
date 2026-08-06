"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GuestChatBubble from "./components/GuestChatBubble";
import DateInput, { isValidDate, toDbDate } from "./components/DateInput";

function parseRoomImages(imgVal) {
  if (!imgVal) return [];
  if (Array.isArray(imgVal)) return imgVal;
  if (typeof imgVal === 'string') {
    const trimmed = imgVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function RoomImageCarousel({ images, fallbackImg, alt, height = '210px' }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [images]);

  const list = images && images.length > 0 ? images : [fallbackImg];

  if (list.length <= 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        style={{ width: '100%', height: height, objectFit: 'cover' }}
      />
    );
  }

  return (
    <div className="position-relative overflow-hidden w-100" style={{ height: height }}>
      {list.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={`${alt} slide ${idx + 1}`}
          className={`position-absolute top-0 start-0 w-100 h-100 ${idx === activeIdx ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit: 'cover', transition: 'opacity 0.6s ease-in-out' }}
        />
      ))}
      <button
        type="button"
        className="btn btn-dark btn-xs position-absolute top-50 start-0 translate-middle-y ms-2 bg-dark bg-opacity-50 border-0 rounded-circle text-white p-1"
        style={{ width: '28px', height: '28px', zIndex: 5, fontSize: '0.85rem' }}
        onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev - 1 + list.length) % list.length); }}
      >
        ‹
      </button>
      <button
        type="button"
        className="btn btn-dark btn-xs position-absolute top-50 end-0 translate-middle-y me-2 bg-dark bg-opacity-50 border-0 rounded-circle text-white p-1"
        style={{ width: '28px', height: '28px', zIndex: 5, fontSize: '0.85rem' }}
        onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev + 1) % list.length); }}
      >
        ›
      </button>
      <div className="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-1" style={{ zIndex: 5 }}>
        {list.map((_, idx) => (
          <span
            key={idx}
            className={`rounded-circle ${idx === activeIdx ? 'bg-white' : 'bg-white bg-opacity-50'}`}
            style={{ width: '6px', height: '6px', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
          ></span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  // Search state
  const [checkIn, setCheckIn] = useState("");
  const [minCheckIn, setMinCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomType, setRoomType] = useState("Any room type");
  const [breakfast, setBreakfast] = useState("With Breakfast");

  const [year, setYear] = useState(2026);
  const [landingData, setLandingData] = useState({
    totalRooms: 0,
    rooms: [],
    promotions: []
  });

  const [availableRooms, setAvailableRooms] = useState([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    setYear(new Date().getFullYear());

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

    async function fetchLandingData() {
      try {
        const res = await fetch('/api/landing');
        const data = await res.json();
        if (res.ok) {
          setLandingData({
            totalRooms: data.totalRooms || 0,
            rooms: data.rooms || [],
            promotions: data.promotions || []
          });
        }
      } catch (err) {
        console.error("Failed to load landing data", err);
      }
    }

    checkSession();
    fetchLandingData();

    // 2-Day Minimum Lead Time Rule
    const today = new Date();
    const twoDaysAhead = new Date(today.getTime() + (2 * 24 * 60 * 60 * 1000));
    const threeDaysAhead = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
    const pad = (num) => String(num).padStart(2, '0');
    const minCheckInStr = `${pad(twoDaysAhead.getMonth() + 1)}/${pad(twoDaysAhead.getDate())}/${twoDaysAhead.getFullYear()}`;
    setMinCheckIn(minCheckInStr);
    setCheckIn(minCheckInStr);
    setCheckOut(`${pad(threeDaysAhead.getMonth() + 1)}/${pad(threeDaysAhead.getDate())}/${threeDaysAhead.getFullYear()}`);
  }, []);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      alert("Please enter valid dates in MM/DD/YYYY format.");
      return;
    }

    // Lead time validation check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedCheckIn = new Date(toDbDate(checkIn) + 'T00:00:00');
    selectedCheckIn.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selectedCheckIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 2) {
      alert("Guests can only reserve rooms starting at least 2 days ahead of today.");
      return;
    }

    setSearching(true);
    setSearchTriggered(true);
    try {
      const res = await fetch(`/api/rooms/availability?checkIn=${toDbDate(checkIn)}&checkOut=${toDbDate(checkOut)}&roomType=${encodeURIComponent(roomType)}&breakfast=${encodeURIComponent(breakfast)}`);
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
      window.location.href = `/auth/register?check_in=${toDbDate(checkIn)}&check_out=${toDbDate(checkOut)}&room_id=${roomID}&breakfast=${breakfast}`;
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomID, checkInDate: toDbDate(checkIn) })
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

  const defaultRoomImages = {
    'Standard Matrimonial': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'Twin Matrimonial': 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
    'Deluxe Matrimonial': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
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
              <li className="nav-item"><a className="nav-link" href="#about">About Us</a></li>
              <li className="nav-item"><a className="nav-link" href="#promotions">Promotions</a></li>
              <li className="nav-item"><a className="nav-link" href="#rooms">Rooms &amp; Rates</a></li>
              <li className="nav-item"><a className="nav-link" href="#amenities">Amenities</a></li>
              <li className="nav-item"><a className="nav-link" href="#contact">Contact</a></li>
              <li className="nav-item mt-2 mt-lg-0">
                <Link href="/auth/login" className="btn btn-pcc-primary btn-sm me-2">Log In</Link>
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
                <form onSubmit={handleSearchSubmit} className="row g-3">
                  <div className="col-12 mb-1">
                    <span className="section-eyebrow d-block">Check Availability</span>
                    <h4 className="text-blue mb-0">Plan your stay</h4>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1.5 fw-semibold small">Check-in *</label>
                    <DateInput
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                      min={minCheckIn}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1.5 fw-semibold small">Check-out *</label>
                    <DateInput
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      min={checkIn || minCheckIn}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1.5 fw-semibold small">Room Type</label>
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
                  <div className="col-md-6">
                    <label className="form-label d-block mb-1.5 fw-semibold small">Breakfast</label>
                    <select
                      className="form-select"
                      value={breakfast}
                      onChange={(e) => setBreakfast(e.target.value)}
                    >
                      <option>With Breakfast</option>
                      <option>Without Breakfast</option>
                    </select>
                  </div>
                  <div className="col-12 mt-3">
                    <button type="submit" className="btn btn-pcc-primary w-100 py-2.5 fw-bold" disabled={searching}>
                      {searching ? "Checking..." : "Check Availability"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT US */}
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
              <div className="stat-row d-flex flex-wrap gap-4 mt-4">
                <div>
                  <div className="stat-number">2</div>
                  <div className="stat-label">Floors</div>
                </div>
                <div>
                  <div className="stat-number">3</div>
                  <div className="stat-label">Room Types</div>
                </div>
                <div>
                  <div className="stat-number text-pcc-blue fw-bold">{landingData.totalRooms > 0 ? landingData.totalRooms : 6}</div>
                  <div className="stat-label">Total Rooms</div>
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

      {/* PROMOTIONS DISPLAY */}
      {landingData.promotions && landingData.promotions.length > 0 && (
        <section className="section bg-light py-5" id="promotions">
          <div className="container">
            <div className="text-center mb-4">
              <div className="section-eyebrow">Special Offers</div>
              <h2 className="section-title">Active Discounts &amp; Promotions</h2>
              <p className="text-muted">Enjoy exclusive savings when you book during our active promotion periods.</p>
            </div>
            <div className="row g-4 justify-content-center">
              {landingData.promotions.map((promo) => (
                <div key={promo.promotionID} className="col-md-6 col-lg-4">
                  <div className="card h-100 border-0 shadow-sm p-4 bg-white" style={{ borderRadius: '12px', borderLeft: '5px solid var(--pcc-blue)' }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="fw-bold text-dark mb-0">{promo.name}</h5>
                      <span className="badge bg-danger text-white px-3 py-1 fs-6">{promo.percentage}% OFF</span>
                    </div>
                    <p className="text-muted small mb-3 flex-grow-1">{promo.description || 'Exclusive promotional discount for lodging stays.'}</p>
                    <div className="p-2 bg-light rounded small mb-3" style={{ fontSize: '0.78rem' }}>
                      <div>📅 <strong>Valid:</strong> {new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}</div>
                      {promo.roomTypeName && <div>🛏️ <strong>Applicable Room:</strong> {promo.roomTypeName}</div>}
                    </div>
                    <Link href="/auth/register" className="btn btn-pcc-primary btn-sm text-white w-100 text-center fw-bold">
                      Claim Promo &amp; Book Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ROOMS & RATES WITH IMAGES */}
      <section className="section bg-mist" id="rooms">
        <div className="container">
          <div className="text-center mb-5">
            <div className="section-eyebrow">Rooms &amp; Rates</div>
            <h2 className="section-title">Find your room</h2>
            <p className="text-muted">All rates are per night and listed without &amp; with breakfast.</p>
          </div>

          {landingData.rooms && landingData.rooms.length > 0 ? (
            <div className="row g-4">
              {landingData.rooms.map((rm) => {
                const parsedImages = parseRoomImages(rm.image);
                const defaultImg = defaultRoomImages[rm.roomType] || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                return (
                  <div key={rm.roomID} className="col-md-6 col-lg-4">
                    <div className="card h-100 border-0 shadow-sm overflow-hidden room-card-hover" style={{ borderRadius: '12px', backgroundColor: '#fff' }}>
                      <div style={{ height: '210px', overflow: 'hidden', position: 'relative' }}>
                        <RoomImageCarousel
                          images={parsedImages}
                          fallbackImg={defaultImg}
                          alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                        />
                        <span className="badge bg-dark text-white position-absolute top-0 start-0 m-3 px-3 py-1 shadow-sm" style={{ fontSize: '0.82rem', zIndex: 6 }}>
                          {rm.floorName}
                        </span>
                        <span className={`badge ${rm.status === 'Available' ? 'bg-success' : 'bg-warning text-dark'} position-absolute top-0 end-0 m-3 px-3 py-1 shadow-sm`} style={{ fontSize: '0.82rem', zIndex: 6 }}>
                          Room {rm.roomNumber} • {rm.status}
                        </span>
                      </div>
                      <div className="card-body p-4 d-flex flex-column justify-content-between">
                        <div>
                          <h5 className="fw-bold text-pcc-blue mb-1">{rm.roomType} (Room {rm.roomNumber})</h5>
                          <small className="text-muted d-block mb-2">Max Occupancy: {rm.occupancyLimit || 4} Guests</small>
                          <p className="text-muted small mb-3">{rm.description || rm.typeDescription || 'Comfortable stay with essential amenities and daily housekeeping.'}</p>
                        </div>
                        <div>
                          <div className="p-2.5 bg-light rounded mb-3" style={{ fontSize: '0.82rem' }}>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Without Breakfast:</span>
                              <span className="fw-bold text-dark">₱{parseFloat(rm.rateWithoutBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="d-flex justify-content-between">
                              <span className="text-muted">With Breakfast:</span>
                              <span className="fw-bold text-pcc-blue">₱{parseFloat(rm.rateWithBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedRoomType(rm.roomType);
                              setCheckIn(minCheckIn);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="btn btn-pcc-outline btn-sm w-100 fw-bold"
                          >
                            Check Availability 📅
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Ground Floor Fallback */}
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
                      <img src={defaultRoomImages['Standard Matrimonial']} alt="Standard Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Standard Matrimonial</div>
                      <div className="room-meta">Sleeps 2&ndash;4 · 2 extra foam</div>
                      <p className="room-desc">A cozy room with the essentials for a comfortable short or long stay.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱1,200</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱1,500</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="key-tag d-flex flex-column">
                      <img src={defaultRoomImages['Twin Matrimonial']} alt="Twin Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Twin Matrimonial</div>
                      <div className="room-meta">Sleeps 4&ndash;5 · 1 extra foam</div>
                      <p className="room-desc">Twin bed setup, perfect for families or groups traveling together.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱1,300</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱1,800</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="key-tag d-flex flex-column">
                      <img src={defaultRoomImages['Deluxe Matrimonial']} alt="Deluxe Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Deluxe Matrimonial</div>
                      <div className="room-meta">Sleeps 5&ndash;7 · 2 extra foam</div>
                      <p className="room-desc">Our most spacious option, ideal for bigger groups and extended stays.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱2,100</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱2,500</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Floor Fallback */}
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
                      <img src={defaultRoomImages['Standard Matrimonial']} alt="Standard Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Standard Matrimonial</div>
                      <div className="room-meta">Sleeps 2&ndash;4 · 2 extra foam</div>
                      <p className="room-desc">A quiet upper-floor room with the same comfort as our ground floor standard.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱1,500</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱1,800</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="key-tag d-flex flex-column">
                      <img src={defaultRoomImages['Twin Matrimonial']} alt="Twin Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Twin Matrimonial</div>
                      <div className="room-meta">Sleeps 4&ndash;5 · 1 extra foam</div>
                      <p className="room-desc">Second floor twin room, great for groups who prefer a higher vantage.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱1,800</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱2,200</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="key-tag d-flex flex-column">
                      <img src={defaultRoomImages['Deluxe Matrimonial']} alt="Deluxe Matrimonial" className="rounded mb-3" style={{ height: '160px', objectFit: 'cover' }} />
                      <div className="room-type">Deluxe Matrimonial</div>
                      <div className="room-meta">Sleeps 5&ndash;7 · 2 extra foam</div>
                      <p className="room-desc">Top-floor deluxe room — our largest and most premium accommodation.</p>
                      <div className="rate-row"><span className="rate-label">Without breakfast</span><span className="rate-value">₱2,200</span></div>
                      <div className="rate-row"><span className="rate-label">With breakfast</span><span className="rate-value">₱2,500</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
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
                <li className="mb-2"><a href="#promotions">Promotions</a></li>
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
