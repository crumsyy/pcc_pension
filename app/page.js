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
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Wifi,
  Building,
  Check,
  Tag,
  Hotel
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

function RoomImageCarousel({ images, fallbackImg, alt, height = "230px" }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images]);

  const list = images && images.length > 0 ? images : fallbackImg ? [fallbackImg] : [];

  if (list.length === 0 || hasError) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center bg-light text-muted w-100"
        style={{ height: height, border: "1px dashed #cbd5e1" }}
      >
        <Hotel className="text-secondary mb-2" size={32} />
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
        style={{ height: height }}
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
          onError={() => {
            if (idx === 0 && list.length === 1) setHasError(true);
          }}
          className={`position-absolute top-0 start-0 w-100 h-100 object-fit-cover transition-opacity ${
            idx === activeIdx ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{ transitionDuration: "600ms" }}
        />
      ))}

      {/* Modern Frosted Navigation Buttons */}
      <button
        type="button"
        aria-label="Previous slide"
        className="position-absolute top-50 start-0 translate-middle-y ms-2 border-0 rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
        style={{
          width: "32px",
          height: "32px",
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(6px)",
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
        aria-label="Next slide"
        className="position-absolute top-50 end-0 translate-middle-y me-2 border-0 rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
        style={{
          width: "32px",
          height: "32px",
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(6px)",
          cursor: "pointer"
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx((prev) => (prev + 1) % list.length);
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Indicator Pills */}
      <div
        className="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-1.5 px-2 py-1 rounded-pill"
        style={{
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(4px)"
        }}
      >
        {list.map((_, idx) => (
          <span
            key={idx}
            className="rounded-pill transition-all"
            style={{
              width: idx === activeIdx ? "16px" : "6px",
              height: "6px",
              backgroundColor: idx === activeIdx ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              transition: "all 0.3s ease"
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
    <div className="min-vh-100 d-flex flex-column">
      {/* MODERN FROSTED NAVBAR */}
      <nav
        className="navbar navbar-expand-lg sticky-top py-3"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.85)",
          zIndex: 1030
        }}
      >
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2.5 text-decoration-none">
            <img
              src="/assets/images/logo.jpg"
              alt="PCC Home Suite Home logo"
              height="44"
              className="rounded-2 shadow-sm"
              style={{ objectFit: "contain" }}
            />
            <div className="d-none d-sm-block">
              <span className="fw-bold fs-5 text-dark tracking-tight d-block lh-1">PCC Home Suite Home</span>
              <span className="text-muted small" style={{ fontSize: "0.75rem" }}>Pension House · Koronadal City</span>
            </div>
          </Link>

          <button
            className="navbar-toggler border-0 shadow-none px-2"
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
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#home">
                  Home
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#about">
                  About Us
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#promotions">
                  Promotions
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#rooms">
                  Rooms &amp; Rates
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#amenities">
                  Amenities
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link px-3 py-2 fw-medium text-secondary hover:text-dark rounded-pill" href="#contact">
                  Contact
                </a>
              </li>

              <li className="nav-item ms-lg-2 mt-2 mt-lg-0 d-flex align-items-center gap-2">
                <Link
                  href="/auth/login"
                  className="btn btn-outline-secondary btn-sm px-3.5 py-1.5 fw-semibold rounded-pill"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="btn btn-primary btn-sm px-4 py-1.5 fw-semibold rounded-pill shadow-sm"
                  style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
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

      {/* HERO SECTION WITH DYNAMIC SEARCH CONSOLE */}
      <section
        className="hero position-relative py-5 py-lg-6"
        id="home"
        style={{
          background: "radial-gradient(circle at 85% 15%, rgba(63, 163, 77, 0.08) 0%, rgba(33, 85, 181, 0.05) 50%, #ffffff 100%)"
        }}
      >
        <div className="container py-lg-4">
          <div className="row align-items-center g-5">
            {/* Left Content */}
            <div className="col-lg-6">
              {/* Location pill */}
              <div
                className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3.5 shadow-xs"
                style={{
                  backgroundColor: "rgba(33, 85, 181, 0.08)",
                  border: "1px solid rgba(33, 85, 181, 0.15)",
                  color: "var(--pcc-blue)"
                }}
              >
                <MapPin size={14} className="text-primary" />
                <span className="small fw-semibold" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
                  Osmeña Street, Zone 1 · Koronadal City
                </span>
              </div>

              <h1 className="display-4 fw-bold text-dark tracking-tight mb-3.5 lh-sm">
                Your <span style={{ color: "var(--pcc-green)", fontStyle: "italic", fontFamily: "var(--font-display)" }}>home</span> away
                <br className="d-none d-sm-inline" /> from home.
              </h1>

              <p className="lead text-secondary mb-4 fs-6" style={{ maxWidth: "520px", lineHeight: "1.65" }}>
                PCC Home Suite Home provides comfortable, clean, and budget-friendly accommodations
                for travelers, families, and long-staying guests right in the vibrant heart of Koronadal City.
              </p>

              <div className="d-flex flex-wrap align-items-center gap-3">
                <a
                  href="#rooms"
                  className="btn btn-primary px-4 py-2.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-2 shadow-sm"
                  style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
                >
                  <Bed size={18} />
                  <span>View Rooms &amp; Rates</span>
                </a>
                <Link
                  href="/auth/register"
                  className="btn btn-outline-secondary px-4 py-2.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-2"
                >
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="d-flex align-items-center gap-4 mt-4 pt-3 border-top border-slate-200">
                <div className="d-flex align-items-center gap-2 text-muted small">
                  <ShieldCheck size={18} className="text-success" />
                  <span>Secure Direct Booking</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-muted small">
                  <Clock size={18} className="text-primary" />
                  <span>24/7 Front Desk</span>
                </div>
              </div>
            </div>

            {/* Right Booking Console */}
            <div className="col-lg-6">
              <div
                className="card border-0 shadow-lg p-4 p-md-4.5 rounded-4"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 20px 45px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.85)"
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-slate-100">
                  <div>
                    <span className="badge bg-primary-subtle text-primary fw-semibold px-2.5 py-1 rounded-pill small mb-1">
                      Real-time Search
                    </span>
                    <h4 className="fw-bold text-dark mb-0 fs-5">Check Availability</h4>
                  </div>
                  <div className="text-end">
                    <span className="text-muted small d-block">Max 2-day lead</span>
                  </div>
                </div>

                <form onSubmit={handleSearchSubmit} className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label d-flex align-items-center gap-1.5 fw-semibold text-secondary small mb-1.5">
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
                    <label className="form-label d-flex align-items-center gap-1.5 fw-semibold text-secondary small mb-1.5">
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
                    <label className="form-label d-flex align-items-center gap-1.5 fw-semibold text-secondary small mb-1.5">
                      <Bed size={14} className="text-primary" />
                      <span>Room Type</span>
                    </label>
                    <select
                      className="form-select rounded-3 py-2 text-dark bg-white border-slate-200"
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
                    <label className="form-label d-flex align-items-center gap-1.5 fw-semibold text-secondary small mb-1.5">
                      <Coffee size={14} className="text-primary" />
                      <span>Breakfast Option</span>
                    </label>
                    <select
                      className="form-select rounded-3 py-2 text-dark bg-white border-slate-200"
                      value={breakfast}
                      onChange={(e) => setBreakfast(e.target.value)}
                    >
                      <option>With Breakfast</option>
                      <option>Without Breakfast</option>
                    </select>
                  </div>

                  <div className="col-12 mt-4">
                    <button
                      type="submit"
                      className="btn btn-primary w-100 py-2.5 fw-bold rounded-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                      style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
                      disabled={searching}
                    >
                      {searching ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                          <span>Searching Vacancies...</span>
                        </>
                      ) : (
                        <>
                          <span>Check Room Availability</span>
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

      {/* ABOUT US & STATS SECTION */}
      <section className="section py-5 py-lg-6" id="about" style={{ backgroundColor: "#fafbfc" }}>
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-5">
              <div
                className="p-4 p-md-5 rounded-4 shadow-sm text-white position-relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, var(--pcc-blue) 0%, #173874 100%)"
                }}
              >
                <Sparkles size={36} className="text-warning opacity-75 mb-3" />
                <blockquote className="fs-4 fw-medium mb-4 lh-base" style={{ fontFamily: "var(--font-display)" }}>
                  &ldquo;Make yourself at home &mdash; that&rsquo;s the PCC promise.&rdquo;
                </blockquote>
                <div className="d-flex align-items-center gap-2 small opacity-75">
                  <div className="rounded-circle bg-white opacity-50" style={{ width: "8px", height: "8px" }} />
                  <span>PCC Home Suite Home Hospitality</span>
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="section-eyebrow text-uppercase fw-bold small text-success mb-2" style={{ letterSpacing: "0.15em" }}>
                About Our Pension House
              </div>
              <h2 className="section-title fw-bold text-dark mb-3.5 lh-sm">
                A warm, peaceful retreat in the heart of Koronadal
              </h2>
              <p className="text-secondary mb-4 leading-relaxed">
                Located conveniently along Osmeña Street, Zone 1, Koronadal City, PCC Home Suite Home
                provides clean, secure, and budget-friendly accommodations for guests
                visiting the city for work, leisure, or family gatherings. Our two-floor
                property offers Standard, Twin, and Deluxe Matrimonial rooms, each
                available with or without breakfast &mdash; designed to deliver comfort without compromise.
              </p>

              {/* Enhanced Stat Cards */}
              <div className="row g-3 mt-2">
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-white rounded-3 shadow-2xs border border-slate-100 text-center h-100">
                    <div className="fw-bold fs-3" style={{ color: "var(--pcc-blue)" }}>2</div>
                    <div className="small text-muted fw-medium mt-1">Floors</div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-white rounded-3 shadow-2xs border border-slate-100 text-center h-100">
                    <div className="fw-bold fs-3" style={{ color: "var(--pcc-blue)" }}>3</div>
                    <div className="small text-muted fw-medium mt-1">Room Types</div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-white rounded-3 shadow-2xs border border-slate-100 text-center h-100">
                    <div className="fw-bold fs-3" style={{ color: "var(--pcc-green)" }}>
                      {landingData.totalRooms > 0 ? landingData.totalRooms : 6}
                    </div>
                    <div className="small text-muted fw-medium mt-1">Total Rooms</div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-3 bg-white rounded-3 shadow-2xs border border-slate-100 text-center h-100">
                    <div className="fw-bold fs-3" style={{ color: "var(--pcc-blue)" }}>24/7</div>
                    <div className="small text-muted fw-medium mt-1">Front Desk</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROMOTIONS DISPLAY */}
      {landingData.promotions && landingData.promotions.length > 0 && (
        <section className="section py-5 py-lg-6" id="promotions" style={{ backgroundColor: "#ffffff" }}>
          <div className="container">
            <div className="text-center mb-5">
              <span className="badge bg-danger-subtle text-danger px-3 py-1.5 rounded-pill fw-semibold small mb-2">
                Special Offers
              </span>
              <h2 className="section-title fw-bold text-dark mb-2">Active Discounts &amp; Promotions</h2>
              <p className="text-secondary small" style={{ maxWidth: "540px", margin: "0 auto" }}>
                Enjoy exclusive seasonal savings when you book directly with PCC Home Suite Home.
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {visiblePromos.map((promo) => (
                <div key={promo.promotionID} className="col-md-6 col-lg-4">
                  <div
                    className="card h-100 border-0 rounded-4 shadow-sm p-4 bg-white d-flex flex-column justify-content-between transition-all"
                    style={{
                      borderTop: "4px solid var(--pcc-blue)",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)"
                    }}
                  >
                    <div>
                      <div className="d-flex justify-content-between align-items-start mb-2.5">
                        <h5 className="fw-bold text-dark mb-0 fs-5">{promo.name}</h5>
                        <span className="badge bg-danger text-white px-2.5 py-1 rounded-pill fw-bold">
                          {promo.percentage}% OFF
                        </span>
                      </div>
                      <p className="text-secondary small mb-3">
                        {promo.description || "Exclusive promotional discount for lodging stays."}
                      </p>
                    </div>

                    <div>
                      <div className="p-2.5 bg-light rounded-3 small mb-3.5 text-muted" style={{ fontSize: "0.8rem" }}>
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
                              <strong>Applies to:</strong> {promo.roomTypeName}
                            </span>
                          </div>
                        )}
                      </div>

                      <Link
                        href="/auth/register"
                        className="btn btn-primary btn-sm text-white w-100 py-2 fw-semibold rounded-pill text-center shadow-xs d-flex align-items-center justify-content-center gap-1.5"
                        style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
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
                  className="btn btn-outline-secondary px-4 py-2 rounded-pill fw-semibold"
                  onClick={() => setShowAllPromos((v) => !v)}
                >
                  {showAllPromos ? "Show Less" : `See More (${allPromos.length - VISIBLE_COUNT} more)`}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ROOMS & RATES WITH IMAGES */}
      <section className="section py-5 py-lg-6" id="rooms" style={{ backgroundColor: "#f8fafc" }}>
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-primary-subtle text-primary px-3 py-1.5 rounded-pill fw-semibold small mb-2">
              Accommodation Catalog
            </span>
            <h2 className="section-title fw-bold text-dark mb-2">Rooms &amp; Rates</h2>
            <p className="text-secondary small" style={{ maxWidth: "520px", margin: "0 auto" }}>
              Explore our comfortable lodging choices. All rates are listed per night with optional hearty breakfast.
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
                    <div className="d-flex align-items-center justify-content-between mb-3.5 pb-2 border-bottom border-slate-200">
                      <div className="d-flex align-items-center gap-2.5">
                        <span
                          className="badge rounded-circle p-2 d-flex align-items-center justify-content-center text-white fw-bold"
                          style={{
                            width: "36px",
                            height: "36px",
                            backgroundColor: "var(--pcc-blue)",
                            fontSize: "0.9rem"
                          }}
                        >
                          {String(fIdx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h4 className="fw-bold text-dark mb-0 fs-5">{floorName}</h4>
                          <span className="text-muted small">
                            {floorRooms.length} room{floorRooms.length > 1 ? "s" : ""} on this floor
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
                            <div
                              className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white d-flex flex-column justify-content-between transition-all"
                              style={{
                                boxShadow: "0 6px 24px rgba(15, 23, 42, 0.05)"
                              }}
                            >
                              <div>
                                {/* Carousel Container with Top Badges */}
                                <div className="position-relative overflow-hidden" style={{ height: "220px" }}>
                                  <RoomImageCarousel
                                    images={parsedImages}
                                    fallbackImg={defaultImg}
                                    alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                                    height="220px"
                                  />
                                  <span
                                    className="badge position-absolute top-0 start-0 m-3 px-2.5 py-1 rounded-pill text-white shadow-sm"
                                    style={{
                                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                                      backdropFilter: "blur(4px)",
                                      fontSize: "0.75rem",
                                      zIndex: 6
                                    }}
                                  >
                                    {rm.floorName || floorName}
                                  </span>
                                  <span
                                    className={`badge position-absolute top-0 end-0 m-3 px-2.5 py-1 rounded-pill shadow-sm d-flex align-items-center gap-1.5 ${
                                      rm.status === "Available"
                                        ? "bg-success text-white"
                                        : "bg-warning text-dark"
                                    }`}
                                    style={{ fontSize: "0.75rem", zIndex: 6 }}
                                  >
                                    <span
                                      className="rounded-circle bg-white"
                                      style={{ width: "6px", height: "6px" }}
                                    />
                                    <span>Room {rm.roomNumber} &bull; {rm.status}</span>
                                  </span>
                                </div>

                                {/* Card Body */}
                                <div className="p-4">
                                  <h5 className="fw-bold text-dark mb-1 fs-5">
                                    {rm.roomType}{" "}
                                    <span className="text-muted fw-normal" style={{ fontSize: "0.9rem" }}>
                                      (Room {rm.roomNumber})
                                    </span>
                                  </h5>

                                  <div className="d-flex align-items-center gap-1.5 text-muted small mb-2.5">
                                    <Users size={14} className="text-secondary" />
                                    <span>Max Occupancy: {rm.occupancyLimit || 4} Guests</span>
                                  </div>

                                  <p className="text-secondary small mb-3" style={{ minHeight: "38px" }}>
                                    {rm.description ||
                                      rm.typeDescription ||
                                      "Comfortable stay with essential amenities and daily housekeeping."}
                                  </p>

                                  {/* Pricing Breakdown Card */}
                                  <div className="p-3 bg-light rounded-3 mb-3" style={{ fontSize: "0.825rem" }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                                      <span className="text-muted">Without Breakfast:</span>
                                      <span className="fw-semibold text-dark">
                                        ₱
                                        {parseFloat(rm.rateWithoutBreakfast || 0).toLocaleString(undefined, {
                                          minimumFractionDigits: 2
                                        })}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <span className="text-muted">With Breakfast:</span>
                                      <span className="fw-bold" style={{ color: "var(--pcc-blue)" }}>
                                        ₱
                                        {parseFloat(rm.rateWithBreakfast || 0).toLocaleString(undefined, {
                                          minimumFractionDigits: 2
                                        })}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-slate-200">
                                      <span className="text-muted">Breakfast Inclusions:</span>
                                      {isBreakfastFree ? (
                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill d-flex align-items-center gap-1">
                                          <Coffee size={12} />
                                          <span>Included Free</span>
                                        </span>
                                      ) : (
                                        <span className="text-success fw-bold small">
                                          ₱{breakfastDiff.toFixed(2)} add-on
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card Action Footer */}
                              <div className="p-4 pt-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRoomType(rm.roomType);
                                    setCheckIn(minCheckIn);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="btn btn-primary w-100 py-2.5 fw-semibold rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-xs"
                                  style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
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
                    className="btn btn-outline-secondary px-4 py-2 rounded-pill fw-semibold"
                    onClick={() => setShowAllRooms((v) => !v)}
                  >
                    {showAllRooms ? "Show Less" : `See More (${allRooms.length - VISIBLE_COUNT} more rooms)`}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Fallback Static Cards when database is initializing */
            <div className="row g-4 justify-content-center">
              <div className="col-md-4">
                <div className="card h-100 border-0 rounded-4 shadow-sm p-4 bg-white text-center">
                  <img
                    src={defaultRoomImages["Standard Matrimonial"]}
                    alt="Standard Matrimonial"
                    className="rounded-3 mb-3 w-100 object-fit-cover"
                    style={{ height: "180px" }}
                  />
                  <h5 className="fw-bold text-dark">Standard Matrimonial</h5>
                  <p className="text-muted small">Sleeps 2–4 · Daily housekeeping</p>
                  <div className="fw-bold fs-5 text-primary">₱1,200 / night</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card h-100 border-0 rounded-4 shadow-sm p-4 bg-white text-center">
                  <img
                    src={defaultRoomImages["Twin Matrimonial"]}
                    alt="Twin Matrimonial"
                    className="rounded-3 mb-3 w-100 object-fit-cover"
                    style={{ height: "180px" }}
                  />
                  <h5 className="fw-bold text-dark">Twin Matrimonial</h5>
                  <p className="text-muted small">Sleeps 4–5 · Ideal for families</p>
                  <div className="fw-bold fs-5 text-primary">₱1,300 / night</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card h-100 border-0 rounded-4 shadow-sm p-4 bg-white text-center">
                  <img
                    src={defaultRoomImages["Deluxe Matrimonial"]}
                    alt="Deluxe Matrimonial"
                    className="rounded-3 mb-3 w-100 object-fit-cover"
                    style={{ height: "180px" }}
                  />
                  <h5 className="fw-bold text-dark">Deluxe Matrimonial</h5>
                  <p className="text-muted small">Sleeps 5–7 · Spacious &amp; premium</p>
                  <div className="fw-bold fs-5 text-primary">₱2,100 / night</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* AMENITIES SECTION */}
      <section className="section py-5 py-lg-6" id="amenities" style={{ backgroundColor: "#ffffff" }}>
        <div className="container">
          <div className="text-center mb-5">
            <span className="badge bg-success-subtle text-success px-3 py-1.5 rounded-pill fw-semibold small mb-2">
              Guest Comforts
            </span>
            <h2 className="section-title fw-bold text-dark mb-2">Amenities &amp; Services</h2>
            <p className="text-secondary small" style={{ maxWidth: "480px", margin: "0 auto" }}>
              Thoughtful services and daily conveniences to ensure your stay in Koronadal is smooth and relaxing.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-3 col-6">
              <div className="p-4 rounded-4 bg-light text-center h-100 border border-slate-100 transition-all hover:shadow-sm">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: "54px", height: "54px", backgroundColor: "rgba(33, 85, 181, 0.1)", color: "var(--pcc-blue)" }}
                >
                  <Bed size={24} />
                </div>
                <h5 className="fw-bold text-dark fs-6 mb-1.5">Clean Linens</h5>
                <p className="text-secondary small mb-0">Fresh bedding and sanitized towels provided for every guest.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-4 rounded-4 bg-light text-center h-100 border border-slate-100 transition-all hover:shadow-sm">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: "54px", height: "54px", backgroundColor: "rgba(63, 163, 77, 0.1)", color: "var(--pcc-green)" }}
                >
                  <Wifi size={24} />
                </div>
                <h5 className="fw-bold text-dark fs-6 mb-1.5">Free Wi-Fi</h5>
                <p className="text-secondary small mb-0">Stay connected throughout the property at no extra cost.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-4 rounded-4 bg-light text-center h-100 border border-slate-100 transition-all hover:shadow-sm">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: "54px", height: "54px", backgroundColor: "rgba(234, 88, 12, 0.1)", color: "#ea580c" }}
                >
                  <Coffee size={24} />
                </div>
                <h5 className="fw-bold text-dark fs-6 mb-1.5">Breakfast Option</h5>
                <p className="text-secondary small mb-0">Hearty morning meals cooked fresh and ready when you wake up.</p>
              </div>
            </div>

            <div className="col-md-3 col-6">
              <div className="p-4 rounded-4 bg-light text-center h-100 border border-slate-100 transition-all hover:shadow-sm">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: "54px", height: "54px", backgroundColor: "rgba(99, 102, 241, 0.1)", color: "#6366f1" }}
                >
                  <Clock size={24} />
                </div>
                <h5 className="fw-bold text-dark fs-6 mb-1.5">24/7 Front Desk</h5>
                <p className="text-secondary small mb-0">Friendly reception staff available around the clock to assist you.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-5 mt-auto" id="contact" style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}>
        <div className="container">
          <div className="row g-4 pb-4">
            <div className="col-lg-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <img
                  src="/assets/images/logo.jpg"
                  alt="PCC Logo"
                  height="36"
                  className="rounded-2"
                />
                <span className="fw-bold text-white fs-5">PCC Home Suite Home</span>
              </div>
              <p className="text-slate-400 small mb-2 lh-base" style={{ maxWidth: "340px", color: "#94a3b8" }}>
                Comfortable, budget-friendly pension lodging located along Osmeña Street, Zone 1,
                Koronadal City, South Cotabato.
              </p>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold mb-3">Quick Navigation</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 small" style={{ color: "#94a3b8" }}>
                <li><a href="#rooms" className="text-decoration-none" style={{ color: "#94a3b8" }}>Rooms &amp; Rates</a></li>
                <li><a href="#promotions" className="text-decoration-none" style={{ color: "#94a3b8" }}>Active Promotions</a></li>
                <li><a href="#amenities" className="text-decoration-none" style={{ color: "#94a3b8" }}>Guest Amenities</a></li>
                <li><Link href="/auth/register" className="text-decoration-none" style={{ color: "#94a3b8" }}>Create Guest Account</Link></li>
                <li><Link href="/auth/login" className="text-decoration-none" style={{ color: "#94a3b8" }}>Staff &amp; Guest Login</Link></li>
              </ul>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold mb-3">Contact &amp; Assistance</h6>
              <div className="d-flex flex-column gap-2 small" style={{ color: "#94a3b8" }}>
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
            className="pt-4 border-top d-flex flex-wrap justify-content-between align-items-center gap-2 small"
            style={{ borderColor: "#1e293b", color: "#64748b" }}
          >
            <span>&copy; {year} PCC Home Suite Home. All rights reserved.</span>
            <div className="d-flex align-items-center gap-3">
              <Link href="/terms" className="text-decoration-none" style={{ color: "#64748b" }}>
                Terms &amp; Conditions
              </Link>
              <span>&bull;</span>
              <Link href="/privacy" className="text-decoration-none" style={{ color: "#64748b" }}>
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* CHATBOT WIDGET */}
      <GuestChatBubble />

      {/* AVAILABILITY RESULTS MODAL */}
      {showResultsModal && (
        <ModalPortal>
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              zIndex: 99999
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 rounded-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div
                  className="modal-header px-4 py-3.5 border-0 text-white"
                  style={{
                    backgroundColor: "var(--pcc-blue)"
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Hotel size={20} />
                    <h5 className="modal-title fw-bold mb-0 fs-5">Available Rooms Found</h5>
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
                    className="mb-3.5 p-3 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
                    style={{ backgroundColor: "#f1f5f9", fontSize: "0.85rem" }}
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
                        Meal: <strong>{breakfast}</strong>
                      </span>
                    </div>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <Hotel size={42} className="text-secondary opacity-50 mb-2" />
                      <h5 className="fw-bold text-dark mt-2">No Vacancies for Selected Dates</h5>
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
                          className="p-3.5 border border-slate-200 rounded-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center bg-white shadow-2xs gap-3"
                        >
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-bold text-dark fs-5">Room {rm.roomNumber}</span>
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill small">
                                Available
                              </span>
                            </div>
                            <h6 className="fw-semibold text-primary mb-1">
                              {rm.roomType} &bull; {rm.floor}
                            </h6>
                            <p className="text-muted small mb-0" style={{ maxWidth: "480px" }}>
                              {rm.description}
                            </p>
                          </div>

                          <div className="text-md-end d-flex flex-row flex-md-column justify-content-between align-items-center align-items-md-end gap-2.5">
                            <div>
                              <div className="text-muted small">Rate per night</div>
                              <span className="fw-bold fs-4" style={{ color: "var(--pcc-blue)" }}>
                                ₱{parseFloat(rm.rate).toFixed(2)}
                              </span>
                            </div>

                            {currentUser && currentUser.role === "Guest" ? (
                              <button
                                onClick={() => handleBookNow(rm.roomID)}
                                className="btn btn-primary btn-sm px-4 py-2 fw-semibold rounded-pill shadow-xs"
                                style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
                                disabled={bookingInProgress}
                              >
                                {bookingInProgress ? "Submitting..." : "Reserve Now"}
                              </button>
                            ) : (
                              <Link
                                href={`/auth/register?check_in=${checkIn}&check_out=${checkOut}&room_id=${rm.roomID}&breakfast=${breakfast}`}
                                className="btn btn-primary btn-sm px-4 py-2 fw-semibold rounded-pill shadow-xs"
                                style={{ backgroundColor: "var(--pcc-blue)", borderColor: "var(--pcc-blue)" }}
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
                <div className="modal-footer border-0 px-4 py-3 bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-4 py-1.5 rounded-pill"
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
