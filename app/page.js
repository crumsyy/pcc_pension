"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GuestChatBubble from "./components/GuestChatBubble";
import { isValidDate, toDbDate } from "./components/DateInput";
import FlatDatePicker from "./components/FlatDatePicker";
import ThemeToggle from "./components/ThemeToggle";
import ModalPortal from "./components/ModalPortal";
import {
  Calendar,
  Users,
  Coffee,
  Bed,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Wifi,
  Building,
  Tag,
  Hotel,
  CheckCircle2
} from "lucide-react";

function parseRoomImages(imgVal) {
  if (!imgVal) return [];
  if (Array.isArray(imgVal)) return imgVal;
  if (typeof imgVal === "string") {
    const trimmed = imgVal.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function RoomImageCarousel({ images, fallbackImg, alt, height = "220px" }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [images]);

  const list = images && images.length > 0 ? images : fallbackImg ? [fallbackImg] : [];

  if (list.length === 0 || hasError) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center bg-light text-secondary w-100"
        style={{ height: height, borderBottom: "1px solid #e2e8f0" }}
      >
        <Hotel className="text-secondary mb-1" size={28} />
        <span className="small fw-semibold text-secondary">Image Unavailable</span>
      </div>
    );
  }

  if (list.length <= 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        onError={() => setHasError(true)}
        className="w-100 object-fit-cover"
        style={{ height: height, borderBottom: "1px solid #e2e8f0" }}
      />
    );
  }

  return (
    <div className="position-relative overflow-hidden w-100" style={{ height: height, borderBottom: "1px solid #e2e8f0" }}>
      {list.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={`${alt} slide ${idx + 1}`}
          onError={() => {
            if (idx === 0 && list.length === 1) setHasError(true);
          }}
          className={`position-absolute top-0 start-0 w-100 h-100 object-fit-cover ${
            idx === activeIdx ? "d-block" : "d-none"
          }`}
        />
      ))}

      {/* Flat Navigation Arrows */}
      <button
        type="button"
        aria-label="Previous image"
        className="position-absolute top-50 start-0 translate-middle-y ms-2 border border-secondary text-white d-flex align-items-center justify-content-center rounded"
        style={{
          width: "28px",
          height: "28px",
          zIndex: 5,
          backgroundColor: "#0f172a",
          opacity: 0.85,
          cursor: "pointer"
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx((prev) => (prev - 1 + list.length) % list.length);
        }}
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        aria-label="Next image"
        className="position-absolute top-50 end-0 translate-middle-y me-2 border border-secondary text-white d-flex align-items-center justify-content-center rounded"
        style={{
          width: "28px",
          height: "28px",
          zIndex: 5,
          backgroundColor: "#0f172a",
          opacity: 0.85,
          cursor: "pointer"
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx((prev) => (prev + 1) % list.length);
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Flat Indicator Pills */}
      <div
        className="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-1 px-2 py-1 rounded"
        style={{
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.8)"
        }}
      >
        {list.map((_, idx) => (
          <span
            key={idx}
            className="rounded"
            style={{
              width: idx === activeIdx ? "14px" : "6px",
              height: "4px",
              backgroundColor: idx === activeIdx ? "#ffffff" : "#64748b",
              cursor: "pointer"
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveIdx(idx);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  // Search state
  const [checkIn, setCheckIn] = useState("");
  const [minCheckIn, setMinCheckIn] = useState("");
  const [maxCheckIn, setMaxCheckIn] = useState("");
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
  const VISIBLE_COUNT = 6;
  const [showAllPromos, setShowAllPromos] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);

  useEffect(() => {
    setYear(new Date().getFullYear());

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session-check");
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
        const res = await fetch("/api/landing");
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

    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const todayStr = `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;

    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${pad(tomorrow.getMonth() + 1)}/${pad(tomorrow.getDate())}/${tomorrow.getFullYear()}`;

    const maxLead = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxLeadStr = `${pad(maxLead.getMonth() + 1)}/${pad(maxLead.getDate())}/${maxLead.getFullYear()}`;

    setMinCheckIn(todayStr);
    setMaxCheckIn(maxLeadStr);
    setCheckIn(todayStr);
    setCheckOut(tomorrowStr);
  }, []);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      alert("Please enter valid dates in MM/DD/YYYY format.");
      return;
    }

    if (toDbDate(checkIn) >= toDbDate(checkOut)) {
      alert("Check-in date and Check-out date cannot be the same. Check-out date must be strictly after Check-in date.");
      return;
    }

    // Reservation Rule: Today up to 2 days ahead max
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedCheckIn = new Date(toDbDate(checkIn) + "T00:00:00");
    selectedCheckIn.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selectedCheckIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 2) {
      alert("Reservations can only be made for today or up to 2 days ahead maximum.");
      return;
    }

    setSearching(true);
    setSearchTriggered(true);
    try {
      const res = await fetch(
        `/api/rooms/availability?checkIn=${toDbDate(checkIn)}&checkOut=${toDbDate(checkOut)}&roomType=${encodeURIComponent(
          roomType
        )}&breakfast=${encodeURIComponent(breakfast)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch room availability");
      setAvailableRooms(data.rooms || []);
      setShowResultsModal(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleBookNow = async (roomID) => {
    if (!currentUser || currentUser.role !== "Guest") {
      window.location.href = `/auth/register?check_in=${toDbDate(checkIn)}&check_out=${toDbDate(checkOut)}&room_id=${roomID}&breakfast=${breakfast}`;
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await fetch("/api/guest/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID, checkInDate: toDbDate(checkIn) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit reservation request");
      alert(data.message || "Reservation request submitted successfully!");
      setShowResultsModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBookingInProgress(false);
    }
  };

  const defaultRoomImages = {
    "Standard Matrimonial": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    "Twin Matrimonial": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
    "Deluxe Matrimonial": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
  };

  const allPromos = landingData.promotions || [];
  const visiblePromos = showAllPromos ? allPromos : allPromos.slice(0, VISIBLE_COUNT);
  const allRooms = landingData.rooms || [];
  const visibleRooms = showAllRooms ? allRooms : allRooms.slice(0, VISIBLE_COUNT);

  return (
    <div className="min-vh-100 d-flex flex-column bg-white text-dark">
      {/* 1. FLAT DESIGN NAVBAR (Sharp, solid, zero drop-shadow) */}
      <nav
        className="navbar navbar-expand-lg sticky-top py-2.5 bg-white border-bottom border-2 border-slate-200"
        style={{ zIndex: 1030 }}
      >
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2.5 text-decoration-none">
            <img
              src="/assets/images/logo.jpg"
              alt="PCC Home Suite Home logo"
              height="40"
              className="border border-slate-300 rounded"
              style={{ objectFit: "contain" }}
            />
            <div className="d-none d-sm-block">
              <span className="fw-bold fs-5 text-dark tracking-tight d-block lh-1">PCC Home Suite Home</span>
              <span className="text-secondary small font-monospace" style={{ fontSize: "0.75rem" }}>
                Zone 1, Koronadal City
              </span>
            </div>
          </Link>

          <button
            className="navbar-toggler border border-secondary px-2 py-1 rounded"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
            aria-controls="mainNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="mainNav">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-dark rounded hover:bg-slate-100" href="#home">
                  Home
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded hover:bg-slate-100" href="#about">
                  About
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded hover:bg-slate-100" href="#promotions">
                  Promotions
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded hover:bg-slate-100" href="#rooms">
                  Rooms &amp; Rates
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded hover:bg-slate-100" href="#amenities">
                  Amenities
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded hover:bg-slate-100" href="#contact">
                  Contact
                </a>
              </li>

              <li className="nav-item ms-lg-3 mt-2 mt-lg-0 d-flex align-items-center gap-2">
                <Link
                  href="/auth/login"
                  className="btn btn-sm px-3.5 py-1.5 fw-bold text-dark bg-light border border-secondary rounded"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="btn btn-sm px-4 py-1.5 fw-bold text-white rounded border-0"
                  style={{ backgroundColor: "#1d4ed8" }}
                >
                  Book Now
                </Link>
                <div className="ms-1">
                  <ThemeToggle />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* 2. FLAT HERO & FRAMED BOOKING CONSOLE */}
      <section className="py-5 py-lg-6 border-bottom border-slate-200" id="home" style={{ backgroundColor: "#f8fafc" }}>
        <div className="container">
          <div className="row align-items-center g-5">
            {/* Left Content */}
            <div className="col-lg-6">
              {/* Location Tag */}
              <div className="d-inline-flex align-items-center gap-2 px-2.5 py-1 rounded bg-blue-50 border border-primary text-primary mb-3">
                <MapPin size={14} />
                <span className="small fw-bold font-monospace" style={{ fontSize: "0.78rem" }}>
                  OSMEÑA STREET, ZONE 1 &bull; KORONADAL CITY
                </span>
              </div>

              <h1 className="display-4 fw-black text-dark tracking-tight mb-3 lh-sm">
                Clean, comfortable lodging in Koronadal.
              </h1>

              <p className="lead text-secondary mb-4 fs-6" style={{ lineHeight: "1.7", maxWidth: "520px" }}>
                PCC Home Suite Home provides straightforward, budget-friendly accommodations
                for travelers, families, and long-stay guests. Enjoy clean rooms, direct booking, and attentive 24/7 front desk service.
              </p>

              <div className="d-flex flex-wrap align-items-center gap-3">
                <a
                  href="#rooms"
                  className="btn px-4 py-2.5 fw-bold text-white rounded border-0 d-inline-flex align-items-center gap-2"
                  style={{ backgroundColor: "#1d4ed8" }}
                >
                  <Bed size={18} />
                  <span>View Rooms &amp; Rates</span>
                </a>
                <Link
                  href="/auth/register"
                  className="btn px-4 py-2.5 fw-bold text-dark bg-white border border-secondary rounded d-inline-flex align-items-center gap-2"
                >
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </Link>
              </div>

              {/* Trust Strip */}
              <div className="d-flex align-items-center gap-4 mt-4 pt-3 border-top border-slate-200">
                <div className="d-flex align-items-center gap-1.5 text-secondary small fw-medium">
                  <ShieldCheck size={18} className="text-success" />
                  <span>Direct Booking Guaranteed</span>
                </div>
                <div className="d-flex align-items-center gap-1.5 text-secondary small fw-medium">
                  <Clock size={18} className="text-primary" />
                  <span>24/7 Front Desk Reception</span>
                </div>
              </div>
            </div>

            {/* Right Booking Engine Console */}
            <div className="col-lg-6">
              <div
                className="bg-white border-2 border-primary rounded p-4 p-md-4.5"
                style={{ border: "2px solid #1d4ed8" }}
              >
                {/* Header Strip */}
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2.5 border-bottom border-slate-200">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white font-monospace text-uppercase px-2 py-1 rounded">
                      Fast Search
                    </span>
                    <h3 className="fw-bold text-dark mb-0 fs-5">Check Availability</h3>
                  </div>
                  <span className="badge bg-light text-secondary border border-secondary font-monospace">
                    Max 2-day lead
                  </span>
                </div>

                <form onSubmit={handleSearchSubmit} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1">
                      <Calendar size={14} className="text-primary" />
                      <span>Check-in Date *</span>
                    </label>
                    <FlatDatePicker
                      value={checkIn}
                      onChange={setCheckIn}
                      required
                      min={minCheckIn}
                      max={maxCheckIn}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1">
                      <Calendar size={14} className="text-primary" />
                      <span>Check-out Date *</span>
                    </label>
                    <FlatDatePicker
                      value={checkOut}
                      onChange={setCheckOut}
                      required
                      min={checkIn || minCheckIn}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1">
                      <Bed size={14} className="text-primary" />
                      <span>Room Type</span>
                    </label>
                    <select
                      className="form-select rounded text-dark bg-white border-secondary"
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
                    <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1">
                      <Coffee size={14} className="text-primary" />
                      <span>Breakfast Option</span>
                    </label>
                    <select
                      className="form-select rounded text-dark bg-white border-secondary"
                      value={breakfast}
                      onChange={(e) => setBreakfast(e.target.value)}
                    >
                      <option>With Breakfast</option>
                      <option>Without Breakfast</option>
                    </select>
                  </div>

                  <div className="col-12 mt-3.5">
                    <button
                      type="submit"
                      className="btn w-100 py-2.5 fw-bold text-white rounded border-0 d-flex align-items-center justify-content-center gap-2"
                      style={{ backgroundColor: "#1d4ed8" }}
                      disabled={searching}
                    >
                      {searching ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                          <span>Checking Room Records...</span>
                        </>
                      ) : (
                        <>
                          <span>Search Vacancies</span>
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FLAT ABOUT US & METRIC TILES */}
      <section className="py-5 py-lg-6 border-bottom border-slate-200" id="about" style={{ backgroundColor: "#ffffff" }}>
        <div className="container">
          <div className="row g-5 align-items-center">
            {/* Left Statement Block */}
            <div className="col-lg-5">
              <div
                className="p-4 p-md-4.5 rounded text-white"
                style={{
                  backgroundColor: "#0f172a",
                  borderLeft: "6px solid #059669"
                }}
              >
                <div className="font-monospace text-uppercase text-success small fw-bold mb-2">
                  THE PCC PROMISE
                </div>
                <blockquote className="fs-4 fw-bold mb-3 lh-sm">
                  &ldquo;Make yourself at home &mdash; clean, secure, and genuine Koronadal hospitality.&rdquo;
                </blockquote>
                <p className="text-secondary small mb-0 font-monospace">
                  PCC Home Suite Home &bull; Zone 1, Koronadal City
                </p>
              </div>
            </div>

            {/* Right Information & Flat Metric Tiles */}
            <div className="col-lg-7">
              <span className="badge bg-light text-primary border border-primary font-monospace text-uppercase px-2.5 py-1 mb-2">
                Property Overview
              </span>
              <h2 className="fw-black text-dark mb-3">
                Simple, reliable accommodations in the city center
              </h2>
              <p className="text-secondary mb-4" style={{ lineHeight: "1.7" }}>
                Situated along Osmeña Street, Zone 1, Koronadal City, PCC Home Suite Home
                provides clean, secure, and affordable lodging for business travelers, vacationers, and visiting families.
                Our two floors house Standard, Twin, and Deluxe Matrimonial rooms, each available with or without breakfast.
              </p>

              {/* 4 Flat Metric Blocks */}
              <div className="row g-3">
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light border border-slate-300 rounded text-center">
                    <div className="fw-black fs-2 text-primary">2</div>
                    <div className="small fw-bold text-secondary text-uppercase mt-1" style={{ fontSize: "0.75rem" }}>
                      Floors
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light border border-slate-300 rounded text-center">
                    <div className="fw-black fs-2 text-primary">3</div>
                    <div className="small fw-bold text-secondary text-uppercase mt-1" style={{ fontSize: "0.75rem" }}>
                      Room Types
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light border border-slate-300 rounded text-center">
                    <div className="fw-black fs-2 text-success">
                      {landingData.totalRooms > 0 ? landingData.totalRooms : 6}
                    </div>
                    <div className="small fw-bold text-secondary text-uppercase mt-1" style={{ fontSize: "0.75rem" }}>
                      Total Rooms
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-light border border-slate-300 rounded text-center">
                    <div className="fw-black fs-2 text-primary">24/7</div>
                    <div className="small fw-bold text-secondary text-uppercase mt-1" style={{ fontSize: "0.75rem" }}>
                      Front Desk
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FLAT PROMOTIONS (Ticket Style) */}
      {landingData.promotions && landingData.promotions.length > 0 && (
        <section className="py-5 py-lg-6 border-bottom border-slate-200" id="promotions" style={{ backgroundColor: "#f1f5f9" }}>
          <div className="container">
            <div className="text-center mb-4 pb-2">
              <span className="badge bg-danger text-white font-monospace text-uppercase px-2.5 py-1 mb-2">
                Special Offers
              </span>
              <h2 className="fw-black text-dark mb-2">Active Discounts &amp; Deals</h2>
              <p className="text-secondary small" style={{ maxWidth: "500px", margin: "0 auto" }}>
                Take advantage of verified lodging discounts when booking directly through our platform.
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {visiblePromos.map((promo) => (
                <div key={promo.promotionID} className="col-md-6 col-lg-4">
                  <div
                    className="bg-white border-2 border-slate-300 rounded overflow-hidden d-flex flex-column justify-content-between h-100"
                    style={{ borderTop: "5px solid #dc2626" }}
                  >
                    <div className="p-4">
                      <div className="d-flex justify-content-between align-items-start mb-2.5">
                        <h4 className="fw-bold text-dark mb-0 fs-5">{promo.name}</h4>
                        <span className="badge bg-danger text-white font-bold px-2 py-1 rounded">
                          {promo.percentage}% OFF
                        </span>
                      </div>
                      <p className="text-secondary small mb-3">
                        {promo.description || "Exclusive promotional discount for lodging stays."}
                      </p>

                      <div className="p-2.5 bg-light border border-slate-200 rounded small mb-2 text-secondary">
                        <div className="d-flex align-items-center gap-1.5 mb-1">
                          <Calendar size={13} className="text-primary" />
                          <span>
                            <strong>Valid:</strong> {new Date(promo.startDate).toLocaleDateString()} &ndash;{" "}
                            {new Date(promo.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        {promo.roomTypeName && (
                          <div className="d-flex align-items-center gap-1.5">
                            <Bed size={13} className="text-success" />
                            <span>
                              <strong>Applicable:</strong> {promo.roomTypeName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <Link
                        href="/auth/register"
                        className="btn w-100 py-2 fw-bold text-white rounded border-0 text-center d-flex align-items-center justify-content-center gap-1.5"
                        style={{ backgroundColor: "#0f172a" }}
                      >
                        <Tag size={14} />
                        <span>Claim Promo &amp; Book</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {allPromos.length > VISIBLE_COUNT && (
              <div className="text-center mt-4 pt-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4 py-2 rounded fw-bold"
                  onClick={() => setShowAllPromos((v) => !v)}
                >
                  {showAllPromos ? "Show Less" : `See More (${allPromos.length - VISIBLE_COUNT} more)`}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. FLAT ROOMS & RATES CATALOG */}
      <section className="py-5 py-lg-6 border-bottom border-slate-200" id="rooms" style={{ backgroundColor: "#ffffff" }}>
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-primary text-white font-monospace text-uppercase px-2.5 py-1 mb-2">
              Rooms &amp; Rates
            </span>
            <h2 className="fw-black text-dark mb-2">Lodging Choices</h2>
            <p className="text-secondary small" style={{ maxWidth: "520px", margin: "0 auto" }}>
              Standard, Twin, and Deluxe Matrimonial rooms. Listed per night with flexible breakfast options.
            </p>
          </div>

          {allRooms.length > 0 ? (
            <>
              {(() => {
                const roomsByFloor = visibleRooms.reduce((acc, rm) => {
                  const floorKey = rm.floorName || (rm.floorID === 2 ? "Second Floor" : "Ground Floor");
                  if (!acc[floorKey]) acc[floorKey] = [];
                  acc[floorKey].push(rm);
                  return acc;
                }, {});

                return Object.entries(roomsByFloor).map(([floorName, floorRooms], fIdx) => (
                  <div key={floorName} className={`mb-5 ${fIdx === Object.keys(roomsByFloor).length - 1 ? "mb-0" : ""}`}>
                    {/* Floor Header Bar */}
                    <div className="d-flex align-items-center justify-content-between mb-3.5 pb-2 border-bottom border-2 border-slate-200">
                      <div className="d-flex align-items-center gap-2.5">
                        <span
                          className="badge text-white font-monospace fw-bold px-2.5 py-1.5 rounded"
                          style={{ backgroundColor: "#1d4ed8" }}
                        >
                          FLOOR {String(fIdx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h4 className="fw-bold text-dark mb-0 fs-5">{floorName}</h4>
                          <span className="text-secondary small font-monospace">
                            {floorRooms.length} room{floorRooms.length > 1 ? "s" : ""} in inventory
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="row g-4">
                      {floorRooms.map((rm) => {
                        const parsedImages = parseRoomImages(rm.image);
                        const defaultImg = defaultRoomImages[rm.roomType] || null;
                        const hasCustomBreakfast = rm.breakfastRate !== null && rm.breakfastRate !== undefined;
                        const isBreakfastFree = hasCustomBreakfast && parseFloat(rm.breakfastRate) === 0;
                        const breakfastDiff = hasCustomBreakfast
                          ? parseFloat(rm.breakfastRate)
                          : parseFloat(rm.rateWithBreakfast || 0) - parseFloat(rm.rateWithoutBreakfast || 0);

                        return (
                          <div key={rm.roomID} className="col-md-6 col-lg-4">
                            <div className="bg-white border-2 border-slate-300 rounded overflow-hidden h-100 d-flex flex-column justify-content-between">
                              <div>
                                {/* Carousel Box with Flat Badges */}
                                <div className="position-relative overflow-hidden" style={{ height: "220px" }}>
                                  <RoomImageCarousel
                                    images={parsedImages}
                                    fallbackImg={defaultImg}
                                    alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                                    height="220px"
                                  />
                                  <span
                                    className="badge position-absolute top-0 start-0 m-2.5 px-2 py-1 rounded text-white font-monospace"
                                    style={{
                                      backgroundColor: "#0f172a",
                                      fontSize: "0.75rem",
                                      zIndex: 6
                                    }}
                                  >
                                    {rm.floorName || floorName}
                                  </span>
                                  <span
                                    className={`badge position-absolute top-0 end-0 m-2.5 px-2 py-1 rounded font-monospace ${
                                      rm.status === "Available"
                                        ? "bg-success text-white"
                                        : "bg-warning text-dark"
                                    }`}
                                    style={{ fontSize: "0.75rem", zIndex: 6 }}
                                  >
                                    Room {rm.roomNumber} &bull; {rm.status}
                                  </span>
                                </div>

                                {/* Body */}
                                <div className="p-3.5">
                                  <h4 className="fw-bold text-dark mb-1 fs-5">
                                    {rm.roomType}{" "}
                                    <span className="text-secondary fw-normal font-monospace" style={{ fontSize: "0.85rem" }}>
                                      (Room {rm.roomNumber})
                                    </span>
                                  </h4>

                                  <div className="d-flex align-items-center gap-1.5 text-secondary small mb-2">
                                    <Users size={14} />
                                    <span>Max Occupancy: {rm.occupancyLimit || 4} Guests</span>
                                  </div>

                                  <p className="text-secondary small mb-3" style={{ minHeight: "38px", lineHeight: "1.5" }}>
                                    {rm.description ||
                                      rm.typeDescription ||
                                      "Comfortable stay with essential amenities and daily housekeeping."}
                                  </p>

                                  {/* Flat Rate Comparison Box */}
                                  <div className="p-2.5 bg-light border border-slate-200 rounded mb-3 small">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <span className="text-secondary">Without Breakfast:</span>
                                      <span className="fw-bold text-dark font-monospace">
                                        ₱
                                        {parseFloat(rm.rateWithoutBreakfast || 0).toLocaleString(undefined, {
                                          minimumFractionDigits: 2
                                        })}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                                      <span className="text-secondary">With Breakfast:</span>
                                      <span className="fw-bold text-primary font-monospace">
                                        ₱
                                        {parseFloat(rm.rateWithBreakfast || 0).toLocaleString(undefined, {
                                          minimumFractionDigits: 2
                                        })}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center pt-1.5 border-top border-slate-300">
                                      <span className="text-secondary">Breakfast Status:</span>
                                      {isBreakfastFree ? (
                                        <span className="badge bg-success text-white px-2 py-0.5 rounded font-monospace">
                                          FREE / INCLUDED
                                        </span>
                                      ) : (
                                        <span className="text-success fw-bold font-monospace">
                                          +₱{breakfastDiff.toFixed(2)} meal
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card Action */}
                              <div className="p-3.5 pt-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRoomType(rm.roomType);
                                    setCheckIn(minCheckIn);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="btn w-100 py-2 fw-bold text-white rounded border-0 d-flex align-items-center justify-content-center gap-2"
                                  style={{ backgroundColor: "#1d4ed8" }}
                                >
                                  <span>Check &amp; Reserve</span>
                                  <ArrowRight size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {allRooms.length > VISIBLE_COUNT && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 py-2 rounded fw-bold"
                    onClick={() => setShowAllRooms((v) => !v)}
                  >
                    {showAllRooms ? "Show Less" : `See More (${allRooms.length - VISIBLE_COUNT} more rooms)`}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Fallback Flat Cards when database is initializing */
            <div className="row g-4 justify-content-center">
              <div className="col-md-4">
                <div className="bg-white border-2 border-slate-300 rounded p-4 text-center">
                  <img
                    src={defaultRoomImages["Standard Matrimonial"]}
                    alt="Standard Matrimonial"
                    className="rounded mb-3 w-100 object-fit-cover border border-slate-200"
                    style={{ height: "170px" }}
                  />
                  <h4 className="fw-bold text-dark fs-5">Standard Matrimonial</h4>
                  <p className="text-secondary small mb-2">Sleeps 2–4 · Daily housekeeping</p>
                  <div className="fw-bold fs-5 text-primary font-monospace">₱1,200 / night</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-white border-2 border-slate-300 rounded p-4 text-center">
                  <img
                    src={defaultRoomImages["Twin Matrimonial"]}
                    alt="Twin Matrimonial"
                    className="rounded mb-3 w-100 object-fit-cover border border-slate-200"
                    style={{ height: "170px" }}
                  />
                  <h4 className="fw-bold text-dark fs-5">Twin Matrimonial</h4>
                  <p className="text-secondary small mb-2">Sleeps 4–5 · Ideal for families</p>
                  <div className="fw-bold fs-5 text-primary font-monospace">₱1,300 / night</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="bg-white border-2 border-slate-300 rounded p-4 text-center">
                  <img
                    src={defaultRoomImages["Deluxe Matrimonial"]}
                    alt="Deluxe Matrimonial"
                    className="rounded mb-3 w-100 object-fit-cover border border-slate-200"
                    style={{ height: "170px" }}
                  />
                  <h4 className="fw-bold text-dark fs-5">Deluxe Matrimonial</h4>
                  <p className="text-secondary small mb-2">Sleeps 5–7 · Spacious &amp; premium</p>
                  <div className="fw-bold fs-5 text-primary font-monospace">₱2,100 / night</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. FLAT AMENITIES TILES */}
      <section className="py-5 py-lg-6 border-bottom border-slate-200" id="amenities" style={{ backgroundColor: "#f8fafc" }}>
        <div className="container">
          <div className="text-center mb-4 pb-2">
            <span className="badge bg-success text-white font-monospace text-uppercase px-2.5 py-1 mb-2">
              Guest Services
            </span>
            <h2 className="fw-black text-dark mb-2">Amenities &amp; Facilities</h2>
            <p className="text-secondary small" style={{ maxWidth: "460px", margin: "0 auto" }}>
              Essential conveniences included with every stay for a smooth, pleasant visit.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-3 col-6">
              <div className="p-3.5 bg-white border border-slate-300 rounded text-center h-100">
                <div
                  className="rounded d-inline-flex align-items-center justify-content-center p-2.5 mb-2.5 bg-blue-50 text-primary border border-primary"
                >
                  <Bed size={24} />
                </div>
                <h4 className="fw-bold text-dark fs-6 mb-1">Clean Linens</h4>
                <p className="text-secondary small mb-0">Fresh bedding and sanitized towels for every guest.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-3.5 bg-white border border-slate-300 rounded text-center h-100">
                <div
                  className="rounded d-inline-flex align-items-center justify-content-center p-2.5 mb-2.5 bg-green-50 text-success border border-success"
                >
                  <Wifi size={24} />
                </div>
                <h4 className="fw-bold text-dark fs-6 mb-1">Free Wi-Fi</h4>
                <p className="text-secondary small mb-0">High-speed wireless connectivity in all rooms.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-3.5 bg-white border border-slate-300 rounded text-center h-100">
                <div
                  className="rounded d-inline-flex align-items-center justify-content-center p-2.5 mb-2.5 bg-amber-50 text-warning border border-warning"
                >
                  <Coffee size={24} />
                </div>
                <h4 className="fw-bold text-dark fs-6 mb-1">Breakfast Option</h4>
                <p className="text-secondary small mb-0">Hearty morning meals prepared fresh daily.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-3.5 bg-white border border-slate-300 rounded text-center h-100">
                <div
                  className="rounded d-inline-flex align-items-center justify-content-center p-2.5 mb-2.5 bg-indigo-50 text-primary border border-primary"
                >
                  <Clock size={24} />
                </div>
                <h4 className="fw-bold text-dark fs-6 mb-1">24/7 Front Desk</h4>
                <p className="text-secondary small mb-0">Friendly reception staff on duty day and night.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FLAT FOOTER */}
      <footer className="py-5 mt-auto" id="contact" style={{ backgroundColor: "#0f172a", color: "#cbd5e1" }}>
        <div className="container">
          <div className="row g-4 pb-4">
            <div className="col-lg-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <img
                  src="/assets/images/logo.jpg"
                  alt="PCC Logo"
                  height="34"
                  className="border border-secondary rounded"
                />
                <span className="fw-bold text-white fs-5">PCC Home Suite Home</span>
              </div>
              <p className="text-secondary small mb-2" style={{ maxWidth: "340px", lineHeight: "1.6" }}>
                Comfortable, budget-friendly pension lodging along Osmeña Street, Zone 1,
                Koronadal City, South Cotabato.
              </p>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold font-monospace text-uppercase mb-3">Navigation</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 small text-secondary">
                <li><a href="#rooms" className="text-secondary text-decoration-none hover:text-white">Rooms &amp; Rates</a></li>
                <li><a href="#promotions" className="text-secondary text-decoration-none hover:text-white">Active Promotions</a></li>
                <li><a href="#amenities" className="text-secondary text-decoration-none hover:text-white">Guest Amenities</a></li>
                <li><Link href="/auth/register" className="text-secondary text-decoration-none hover:text-white">Create Guest Account</Link></li>
                <li><Link href="/auth/login" className="text-secondary text-decoration-none hover:text-white">Staff &amp; Guest Login</Link></li>
              </ul>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold font-monospace text-uppercase mb-3">Contact Details</h6>
              <div className="d-flex flex-column gap-2 small text-secondary">
                <div className="d-flex align-items-center gap-2">
                  <MapPin size={16} className="text-primary flex-shrink-0" />
                  <span>Osmeña Street, Zone 1, Koronadal City</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Mail size={16} className="text-primary flex-shrink-0" />
                  <span>info@pccsuite.com</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Phone size={16} className="text-primary flex-shrink-0" />
                  <span>09000000000</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pt-4 border-top d-flex flex-wrap justify-content-between align-items-center gap-2 small font-monospace"
            style={{ borderColor: "#1e293b", color: "#64748b" }}
          >
            <span>&copy; {year} PCC Home Suite Home. All rights reserved.</span>
            <div className="d-flex align-items-center gap-3">
              <Link href="/terms" className="text-secondary text-decoration-none">
                Terms &amp; Conditions
              </Link>
              <span>&bull;</span>
              <Link href="/privacy" className="text-secondary text-decoration-none">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* CHATBOT WIDGET */}
      <GuestChatBubble />

      {/* 8. FLAT AVAILABILITY RESULTS MODAL */}
      {showResultsModal && (
        <ModalPortal>
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.7)",
              zIndex: 99999
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-2 border-slate-300 rounded overflow-hidden">
                {/* Header */}
                <div
                  className="modal-header px-4 py-3 border-0 text-white rounded-0"
                  style={{ backgroundColor: "#1d4ed8" }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Hotel size={20} />
                    <h5 className="modal-title fw-bold mb-0 fs-5">Available Room Results</h5>
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowResultsModal(false)}
                    aria-label="Close"
                  />
                </div>

                {/* Body */}
                <div className="modal-body p-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                  <div
                    className="mb-3 p-3 bg-light border border-slate-300 rounded d-flex flex-wrap align-items-center justify-content-between gap-2"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Calendar size={15} className="text-primary" />
                      <span>
                        Stay: <strong>{new Date(checkIn).toLocaleDateString()}</strong> &mdash;{" "}
                        <strong>{new Date(checkOut).toLocaleDateString()}</strong>
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-1.5">
                      <Coffee size={15} className="text-success" />
                      <span>
                        Option: <strong>{breakfast}</strong>
                      </span>
                    </div>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="text-center py-5 text-secondary">
                      <Hotel size={40} className="text-secondary opacity-50 mb-2" />
                      <h4 className="fw-bold text-dark mt-2 fs-5">No Vacancies for Selected Dates</h4>
                      <p className="small text-secondary mb-0" style={{ maxWidth: "420px", margin: "0 auto" }}>
                        Sorry, there are no available rooms of this type for your chosen dates. Please try
                        adjusting your dates or room type selection.
                      </p>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {availableRooms.map((rm) => (
                        <div
                          key={rm.roomID}
                          className="p-3 border-2 border-slate-200 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center bg-white gap-3"
                        >
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-bold text-dark fs-5">Room {rm.roomNumber}</span>
                              <span className="badge bg-success text-white font-monospace small">
                                Available
                              </span>
                            </div>
                            <h6 className="fw-bold text-primary mb-1">
                              {rm.roomType} &bull; {rm.floor}
                            </h6>
                            <p className="text-secondary small mb-0" style={{ maxWidth: "480px" }}>
                              {rm.description}
                            </p>
                          </div>

                          <div className="text-md-end d-flex flex-row flex-md-column justify-content-between align-items-center align-items-md-end gap-2.5">
                            <div>
                              <div className="text-secondary small">Rate per night</div>
                              <span className="fw-bold fs-4 text-primary font-monospace">
                                ₱{parseFloat(rm.rate).toFixed(2)}
                              </span>
                            </div>

                            {currentUser && currentUser.role === "Guest" ? (
                              <button
                                onClick={() => handleBookNow(rm.roomID)}
                                className="btn btn-sm px-4 py-2 fw-bold text-white rounded border-0"
                                style={{ backgroundColor: "#1d4ed8" }}
                                disabled={bookingInProgress}
                              >
                                {bookingInProgress ? "Submitting..." : "Reserve Now"}
                              </button>
                            ) : (
                              <Link
                                href={`/auth/register?check_in=${checkIn}&check_out=${checkOut}&room_id=${rm.roomID}&breakfast=${breakfast}`}
                                className="btn btn-sm px-4 py-2 fw-bold text-white rounded border-0"
                                style={{ backgroundColor: "#1d4ed8" }}
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

                {/* Footer */}
                <div className="modal-footer border-top border-slate-200 px-4 py-2.5 bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-4 py-1.5 rounded fw-bold"
                    onClick={() => setShowResultsModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
