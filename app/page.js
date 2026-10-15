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
  ArrowUpRight,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Wifi,
  Hotel,
  Star,
  Quote,
  CheckCircle2,
  Compass,
  Award,
  Layers,
  AirVent,
  Car,
  Tv,
  X,
  Menu
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

function RoomImageCarousel({ images, fallbackImg, alt, height = "240px" }) {
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
        style={{ height: height, borderBottom: "1px solid rgba(226, 232, 240, 0.8)" }}
      >
        <Hotel className="text-secondary opacity-50 mb-1" size={32} />
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
          style={{ transitionDuration: "700ms" }}
        />
      ))}

      {/* Frosted Prev/Next Controls */}
      <button
        type="button"
        aria-label="Previous slide"
        className="position-absolute top-50 start-0 translate-middle-y ms-2.5 border-0 rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
        style={{
          width: "32px",
          height: "32px",
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          cursor: "pointer",
          transition: "all 0.2s ease"
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
        className="position-absolute top-50 end-0 translate-middle-y me-2.5 border-0 rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
        style={{
          width: "32px",
          height: "32px",
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveIdx((prev) => (prev + 1) % list.length);
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Indicator Pill Bar */}
      <div
        className="position-absolute bottom-0 start-50 translate-middle-x mb-2.5 d-flex gap-1.5 px-2 py-1 rounded-pill"
        style={{
          zIndex: 5,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(8px)"
        }}
      >
        {list.map((_, idx) => (
          <span
            key={idx}
            className="rounded-pill"
            style={{
              width: idx === activeIdx ? "16px" : "6px",
              height: "5px",
              backgroundColor: idx === activeIdx ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
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
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Filter rooms by floor if selected
  const filteredRooms = allRooms.filter((rm) => {
    if (selectedFloor === "ground") return rm.floorID === 1 || (rm.floorName && rm.floorName.toLowerCase().includes("ground"));
    if (selectedFloor === "second") return rm.floorID === 2 || (rm.floorName && rm.floorName.toLowerCase().includes("second"));
    return true;
  });

  const visibleRooms = showAllRooms ? filteredRooms : filteredRooms.slice(0, VISIBLE_COUNT);

  return (
    <div className="min-vh-100 d-flex flex-column text-dark position-relative" style={{ backgroundColor: "#F6FAF7" }}>
      {/* BACKGROUND MESH ACCENTS */}
      <div
        className="position-fixed top-0 start-0 w-100 pointer-events-none"
        style={{
          height: "100vh",
          zIndex: 0,
          background: `
            radial-gradient(circle at 10% 15%, rgba(33, 85, 181, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 90% 10%, rgba(63, 163, 77, 0.09) 0%, transparent 40%),
            radial-gradient(circle at 50% 85%, rgba(205, 235, 207, 0.3) 0%, transparent 50%)
          `
        }}
      />

      {/* 1. FLOATING GLASS ISLAND NAVBAR */}
      <header className="sticky-top pt-3 pb-2 px-3 px-sm-4" style={{ zIndex: 1030 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <nav
            className="navbar p-2 px-sm-3.5 rounded-pill shadow-sm d-flex align-items-center justify-content-between position-relative"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(226, 232, 240, 0.85)",
              boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.08)"
            }}
          >
            {/* Brand Logo & Title */}
            <Link href="/" className="navbar-brand d-flex align-items-center gap-2.5 text-decoration-none m-0 ps-1">
              <div
                className="p-1 rounded-circle d-flex align-items-center justify-content-center shadow-xs"
                style={{
                  background: "linear-gradient(135deg, rgba(33, 85, 181, 0.12) 0%, rgba(63, 163, 77, 0.2) 100%)",
                  border: "1px solid rgba(63, 163, 77, 0.3)",
                  width: "42px",
                  height: "42px"
                }}
              >
                <img
                  src="/assets/images/logo.jpg"
                  alt="PCC Home Suite Home"
                  width="32"
                  height="32"
                  className="rounded-circle object-fit-cover"
                />
              </div>
              <div className="d-none d-sm-block">
                <span className="fw-bold fs-6 tracking-tight d-block lh-1 text-dark">PCC Home Suite Home</span>
                <span className="text-secondary small font-monospace" style={{ fontSize: "0.72rem" }}>
                  Koronadal City &bull; Pension House
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="d-none d-lg-flex align-items-center gap-1">
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#home">
                Home
              </a>
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#about">
                About
              </a>
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#promotions">
                Promotions
              </a>
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#rooms">
                Rooms &amp; Rates
              </a>
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#amenities">
                Amenities
              </a>
              <a className="nav-link px-3 py-1.5 fw-semibold text-secondary hover:text-dark rounded-pill transition" href="#testimonials">
                Reviews
              </a>
            </div>

            {/* Actions & Theme Toggle */}
            <div className="d-flex align-items-center gap-2">
              <Link
                href="/auth/login"
                className="btn btn-sm px-3.5 py-1.5 fw-bold rounded-pill text-dark d-none d-sm-inline-flex align-items-center"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  border: "1px solid rgba(226, 232, 240, 0.9)"
                }}
              >
                Log In
              </Link>
              <Link
                href="/auth/register"
                className="pcc-btn-pill px-4 py-1.5 text-white fs-6 shadow-sm"
                style={{
                  background: "linear-gradient(135deg, #2155B5 0%, #163E82 100%)",
                  fontSize: "0.88rem"
                }}
              >
                <span>Book Now</span>
                <span className="pcc-btn-icon-circle" style={{ width: "1.4rem", height: "1.4rem" }}>
                  <ArrowUpRight size={13} />
                </span>
              </Link>
              <div className="ms-1">
                <ThemeToggle />
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                className="btn btn-sm d-lg-none p-1.5 rounded-circle border-0 text-dark ms-1"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </nav>

          {/* Mobile Collapsible Drawer */}
          {mobileMenuOpen && (
            <div
              className="mt-2 p-3.5 rounded-4 shadow-lg d-lg-none animate__animated animate__fadeInDown position-relative"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(226, 232, 240, 0.9)"
              }}
            >
              <div className="d-flex flex-column gap-2 mb-3">
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3 bg-light"
                  href="#home"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </a>
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3"
                  href="#about"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About Us
                </a>
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3"
                  href="#promotions"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Promotions
                </a>
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3"
                  href="#rooms"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Rooms &amp; Rates
                </a>
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3"
                  href="#amenities"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Amenities
                </a>
                <a
                  className="px-3 py-2 fw-semibold text-dark text-decoration-none rounded-3"
                  href="#testimonials"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Guest Reviews
                </a>
              </div>
              <div className="pt-2 border-top d-flex gap-2">
                <Link
                  href="/auth/login"
                  className="btn btn-outline-secondary w-50 py-2 rounded-pill fw-bold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="btn btn-primary w-50 py-2 rounded-pill fw-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2155B5 0%, #163E82 100%)", border: "none" }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Register
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 2. EDITORIAL HERO SECTION & DOUBLE-BEZEL CONSOLE */}
      <section className="position-relative py-5 py-lg-6" id="home" style={{ zIndex: 1 }}>
        <div className="container position-relative" style={{ maxWidth: "1140px" }}>
          <div className="row align-items-center g-5">
            {/* Left Narrative */}
            <div className="col-lg-6">
              {/* Location Beacon Pill */}
              <div
                className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3.5 shadow-xs"
                style={{
                  background: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(63, 163, 77, 0.3)",
                  color: "#163E82"
                }}
              >
                <span className="position-relative d-inline-flex align-items-center justify-content-center" style={{ width: "8px", height: "8px" }}>
                  <span className="position-absolute w-100 h-100 rounded-circle bg-success opacity-75 animate-ping" />
                  <span className="position-relative rounded-circle bg-success" style={{ width: "6px", height: "6px" }} />
                </span>
                <span className="small fw-bold font-monospace tracking-wide" style={{ fontSize: "0.78rem" }}>
                  ZONE 1, OSMEÑA STREET &bull; KORONADAL CITY
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="display-4 fw-bold tracking-tight mb-3.5 lh-sm text-dark">
                Your{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontStyle: "italic",
                    fontFamily: "var(--font-display, 'Fraunces', serif)"
                  }}
                >
                  sanctuary
                </span>{" "}
                away from home.
              </h1>

              <p className="lead text-secondary mb-4 fs-6" style={{ lineHeight: "1.75", maxWidth: "520px" }}>
                PCC Home Suite Home harmonizes the warmth of home with restful, impeccably maintained rooms
                in the heart of Koronadal City. Experience peaceful sleep, attentive service, and instant direct reservation.
              </p>

              {/* Action Buttons */}
              <div className="d-flex flex-wrap align-items-center gap-3">
                <a
                  href="#rooms"
                  className="pcc-btn-pill px-4 py-2.5 text-white"
                  style={{
                    background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                    boxShadow: "0 10px 25px -6px rgba(33, 85, 181, 0.4)",
                    border: "none"
                  }}
                >
                  <Bed size={18} />
                  <span>Explore Rooms &amp; Rates</span>
                  <span className="pcc-btn-icon-circle">
                    <ArrowDownRightIcon size={14} />
                  </span>
                </a>
                <Link
                  href="/auth/register"
                  className="pcc-btn-pill px-4 py-2.5 text-dark"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <span>Create Account</span>
                  <ArrowRight size={15} />
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="d-flex flex-wrap align-items-center gap-4 mt-4 pt-3 border-top border-slate-200">
                <div className="d-flex align-items-center gap-1.5 text-secondary small fw-medium">
                  <ShieldCheck size={18} style={{ color: "#3FA34D" }} />
                  <span>Instant Confirmation</span>
                </div>
                <div className="d-flex align-items-center gap-1.5 text-secondary small fw-medium">
                  <Clock size={18} style={{ color: "#2155B5" }} />
                  <span>24/7 Front Desk</span>
                </div>
                <div className="d-flex align-items-center gap-1.5 text-secondary small fw-medium">
                  <Wifi size={18} style={{ color: "#3FA34D" }} />
                  <span>Free High-Speed Wi-Fi</span>
                </div>
              </div>
            </div>

            {/* Right: Double-Bezel Real-Time Search Console */}
            <div className="col-lg-6">
              <div className="pcc-double-bezel">
                <div className="pcc-double-bezel-inner p-4 p-md-4.5">
                  {/* Console Header */}
                  <div className="d-flex align-items-center justify-content-between mb-3.5 pb-2 border-bottom border-slate-100">
                    <div>
                      <span
                        className="badge px-2.5 py-1 rounded-pill small fw-bold font-monospace"
                        style={{
                          backgroundColor: "rgba(33, 85, 181, 0.1)",
                          color: "#2155B5"
                        }}
                      >
                        DIRECT BOOKING ENGINE
                      </span>
                      <h3 className="fw-bold text-dark mb-0 fs-5 mt-1.5">Check Room Vacancies</h3>
                    </div>
                    <span
                      className="badge rounded-pill small font-monospace px-2.5 py-1"
                      style={{
                        backgroundColor: "rgba(63, 163, 77, 0.12)",
                        color: "#3FA34D"
                      }}
                    >
                      Max 2-day lead
                    </span>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSearchSubmit} className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1.5">
                        <Calendar size={14} style={{ color: "#2155B5" }} />
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
                      <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1.5">
                        <Calendar size={14} style={{ color: "#2155B5" }} />
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
                      <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1.5">
                        <Bed size={14} style={{ color: "#3FA34D" }} />
                        <span>Room Type</span>
                      </label>
                      <select
                        className="form-select rounded-3 text-dark bg-white shadow-xs"
                        style={{ border: "1px solid rgba(205, 235, 207, 0.9)", fontSize: "0.9rem", padding: "0.6rem 0.85rem" }}
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
                      <label className="form-label d-flex align-items-center gap-1.5 fw-bold text-dark small mb-1.5">
                        <Coffee size={14} style={{ color: "#3FA34D" }} />
                        <span>Breakfast Option</span>
                      </label>
                      <select
                        className="form-select rounded-3 text-dark bg-white shadow-xs"
                        style={{ border: "1px solid rgba(205, 235, 207, 0.9)", fontSize: "0.9rem", padding: "0.6rem 0.85rem" }}
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
                        className="pcc-btn-pill w-100 py-3 text-white border-0"
                        style={{
                          background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                          boxShadow: "0 8px 24px -4px rgba(33, 85, 181, 0.35)"
                        }}
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
                            <span className="pcc-btn-icon-circle">
                              <ArrowRight size={15} />
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ABOUT US & METRIC BENTO TILES */}
      <section className="py-5 py-lg-6" id="about" style={{ zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <div className="row g-5 align-items-center">
            {/* Left Quote Card */}
            <div className="col-lg-5">
              <div
                className="p-4 p-md-5 rounded-4 text-white position-relative overflow-hidden shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #163E82 0%, #2155B5 60%, #3FA34D 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.2)"
                }}
              >
                <Quote size={40} className="opacity-40 mb-3" />
                <blockquote
                  className="fs-4 fw-medium mb-3 lh-base"
                  style={{ fontFamily: "var(--font-display, 'Fraunces', serif)" }}
                >
                  &ldquo;Make yourself at home &mdash; that&rsquo;s the PCC promise.&rdquo;
                </blockquote>
                <div className="d-flex align-items-center gap-2 small opacity-90 font-monospace pt-2 border-top border-white-20">
                  <div className="rounded-circle bg-white" style={{ width: "8px", height: "8px" }} />
                  <span>Zone 1, Koronadal City &bull; Authentic Hospitality</span>
                </div>
              </div>
            </div>

            {/* Right Narrative & 4 Bento Metric Cards */}
            <div className="col-lg-7">
              <div
                className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill small fw-bold font-monospace mb-2.5"
                style={{
                  backgroundColor: "rgba(63, 163, 77, 0.12)",
                  color: "#3FA34D"
                }}
              >
                <Compass size={14} />
                <span>ABOUT OUR PENSION HOUSE</span>
              </div>
              <h2 className="display-6 fw-bold text-dark mb-3">
                A warm, peaceful retreat in Koronadal City
              </h2>
              <p className="text-secondary mb-4" style={{ lineHeight: "1.75" }}>
                Located along Osmeña Street, Zone 1, Koronadal City, PCC Home Suite Home
                provides clean, secure, and budget-friendly accommodations for guests
                visiting South Cotabato for business, family occasions, or relaxing holidays.
                Our two-floor residence offers Standard, Twin, and Deluxe Matrimonial rooms,
                available with or without freshly cooked breakfast.
              </p>

              {/* 4 Bento Metric Cards */}
              <div className="row g-3">
                <div className="col-6 col-sm-3">
                  <div className="pcc-double-bezel">
                    <div className="pcc-double-bezel-inner p-3.5 text-center">
                      <div className="fw-bold fs-2" style={{ color: "#2155B5" }}>2</div>
                      <div className="small fw-semibold text-secondary mt-1">Floors</div>
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="pcc-double-bezel">
                    <div className="pcc-double-bezel-inner p-3.5 text-center">
                      <div className="fw-bold fs-2" style={{ color: "#2155B5" }}>3</div>
                      <div className="small fw-semibold text-secondary mt-1">Room Types</div>
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="pcc-double-bezel">
                    <div className="pcc-double-bezel-inner p-3.5 text-center">
                      <div className="fw-bold fs-2" style={{ color: "#3FA34D" }}>
                        {landingData.totalRooms > 0 ? landingData.totalRooms : 6}
                      </div>
                      <div className="small fw-semibold text-secondary mt-1">Total Rooms</div>
                    </div>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="pcc-double-bezel">
                    <div className="pcc-double-bezel-inner p-3.5 text-center">
                      <div className="fw-bold fs-2" style={{ color: "#2155B5" }}>24/7</div>
                      <div className="small fw-semibold text-secondary mt-1">Front Desk</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ACTIVE PROMOTIONS (Luxury Voucher / Boarding-Pass Cards) */}
      {landingData.promotions && landingData.promotions.length > 0 && (
        <section className="py-5 py-lg-6" id="promotions" style={{ zIndex: 1 }}>
          <div className="container" style={{ maxWidth: "1140px" }}>
            <div className="text-center mb-5">
              <span
                className="badge px-3 py-1.5 rounded-pill small fw-bold font-monospace mb-2"
                style={{
                  backgroundColor: "rgba(225, 29, 72, 0.12)",
                  color: "#e11d48"
                }}
              >
                EXCLUSIVE SPECIALS
              </span>
              <h2 className="display-6 fw-bold text-dark mb-2">Active Discounts &amp; Deals</h2>
              <p className="text-secondary small" style={{ maxWidth: "520px", margin: "0 auto" }}>
                Book directly on our system to unlock verified seasonal offers and room discounts.
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {visiblePromos.map((promo) => (
                <div key={promo.promotionID} className="col-md-6 col-lg-4">
                  <div className="pcc-double-bezel h-100">
                    <div className="pcc-double-bezel-inner p-4 d-flex flex-column justify-content-between h-100 position-relative overflow-hidden">
                      {/* Top Accent Gradient Bar */}
                      <div
                        className="position-absolute top-0 start-0 w-100"
                        style={{
                          height: "4px",
                          background: "linear-gradient(90deg, #2155B5 0%, #3FA34D 100%)"
                        }}
                      />

                      <div>
                        <div className="d-flex justify-content-between align-items-start mb-2.5">
                          <h4 className="fw-bold text-dark mb-0 fs-5">{promo.name}</h4>
                          <span
                            className="badge text-white px-2.5 py-1 rounded-pill fw-bold"
                            style={{
                              background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
                              boxShadow: "0 2px 8px rgba(225, 29, 72, 0.3)"
                            }}
                          >
                            {promo.percentage}% OFF
                          </span>
                        </div>
                        <p className="text-secondary small mb-3">
                          {promo.description || "Special promotional rate for lodging bookings."}
                        </p>

                        <div
                          className="p-2.5 rounded-3 small mb-3.5"
                          style={{
                            backgroundColor: "rgba(246, 250, 247, 0.8)",
                            border: "1px solid rgba(205, 235, 207, 0.6)"
                          }}
                        >
                          <div className="d-flex align-items-center gap-1.5 mb-1 text-secondary">
                            <Calendar size={13} style={{ color: "#2155B5" }} />
                            <span>
                              <strong>Valid:</strong> {new Date(promo.startDate).toLocaleDateString()} &ndash;{" "}
                              {new Date(promo.endDate).toLocaleDateString()}
                            </span>
                          </div>
                          {promo.roomTypeName && (
                            <div className="d-flex align-items-center gap-1.5 text-secondary">
                              <Bed size={13} style={{ color: "#3FA34D" }} />
                              <span>
                                <strong>Applicable:</strong> {promo.roomTypeName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Link
                          href="/auth/register"
                          className="pcc-btn-pill w-100 py-2.5 text-white"
                          style={{
                            background: "linear-gradient(135deg, #2155B5 0%, #163E82 100%)",
                            boxShadow: "0 4px 15px rgba(33, 85, 181, 0.25)"
                          }}
                        >
                          <span>Claim Promo &amp; Book</span>
                          <span className="pcc-btn-icon-circle" style={{ width: "1.5rem", height: "1.5rem" }}>
                            <ArrowRight size={13} />
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {allPromos.length > VISIBLE_COUNT && (
              <div className="text-center mt-4 pt-2">
                <button
                  type="button"
                  className="btn px-4 py-2 rounded-pill fw-bold"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid rgba(33, 85, 181, 0.3)",
                    color: "#2155B5"
                  }}
                  onClick={() => setShowAllPromos((v) => !v)}
                >
                  {showAllPromos ? "Show Less" : `See More (${allPromos.length - VISIBLE_COUNT} more)`}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. ARCHITECTURAL ROOMS & RATES SHOWCASE */}
      <section className="py-5 py-lg-6 position-relative" id="rooms" style={{ zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          {/* Header */}
          <div className="text-center mb-4">
            <span
              className="badge px-3 py-1.5 rounded-pill small fw-bold font-monospace mb-2"
              style={{
                backgroundColor: "rgba(33, 85, 181, 0.12)",
                color: "#2155B5"
              }}
            >
              ACCOMMODATION SHOWCASE
            </span>
            <h2 className="display-6 fw-bold text-dark mb-2">Rooms &amp; Rates</h2>
            <p className="text-secondary small" style={{ maxWidth: "520px", margin: "0 auto" }}>
              Choose your ideal space. All rooms include clean sanitized linens, toiletries, and optional fresh breakfast.
            </p>
          </div>

          {/* Floor Navigation Filter Tabs */}
          <div className="d-flex justify-content-center gap-2 mb-5">
            <button
              type="button"
              className={`btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold transition ${
                selectedFloor === "all" ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border"
              }`}
              style={selectedFloor === "all" ? { background: "#2155B5", borderColor: "#2155B5" } : {}}
              onClick={() => setSelectedFloor("all")}
            >
              All Rooms
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold transition ${
                selectedFloor === "ground" ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border"
              }`}
              style={selectedFloor === "ground" ? { background: "#2155B5", borderColor: "#2155B5" } : {}}
              onClick={() => setSelectedFloor("ground")}
            >
              Ground Floor
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3.5 py-1.5 rounded-pill fw-bold transition ${
                selectedFloor === "second" ? "btn-primary text-white shadow-xs" : "btn-light text-secondary border"
              }`}
              style={selectedFloor === "second" ? { background: "#2155B5", borderColor: "#2155B5" } : {}}
              onClick={() => setSelectedFloor("second")}
            >
              Second Floor
            </button>
          </div>

          {/* Room Cards Grid */}
          {filteredRooms.length > 0 ? (
            <>
              <div className="row g-4">
                {visibleRooms.map((rm) => {
                  const parsedImages = parseRoomImages(rm.image);
                  const defaultImg = defaultRoomImages[rm.roomType] || null;
                  const hasCustomBreakfast = rm.breakfastRate !== null && rm.breakfastRate !== undefined;
                  const isBreakfastFree = hasCustomBreakfast && parseFloat(rm.breakfastRate) === 0;
                  const breakfastDiff = hasCustomBreakfast
                    ? parseFloat(rm.breakfastRate)
                    : parseFloat(rm.rateWithBreakfast || 0) - parseFloat(rm.rateWithoutBreakfast || 0);

                  return (
                    <div key={rm.roomID} className="col-md-6 col-lg-4">
                      <div className="pcc-double-bezel h-100 pcc-card-interactive">
                        <div className="pcc-double-bezel-inner overflow-hidden h-100 d-flex flex-column justify-content-between position-relative">
                          <div>
                            {/* Carousel Container with Frosted Status Chips */}
                            <div className="position-relative overflow-hidden" style={{ height: "240px" }}>
                              <RoomImageCarousel
                                images={parsedImages}
                                fallbackImg={defaultImg}
                                alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                                height="240px"
                              />
                              <span
                                className="badge position-absolute top-0 start-0 m-2.5 px-2.5 py-1 rounded-pill text-white font-monospace small shadow-xs"
                                style={{
                                  backgroundColor: "rgba(15, 23, 42, 0.7)",
                                  backdropFilter: "blur(8px)",
                                  zIndex: 6
                                }}
                              >
                                {rm.floorName || (rm.floorID === 2 ? "Second Floor" : "Ground Floor")}
                              </span>
                              <span
                                className={`badge position-absolute top-0 end-0 m-2.5 px-2.5 py-1 rounded-pill font-monospace small d-flex align-items-center gap-1.5 shadow-xs ${
                                  rm.status === "Available" ? "bg-success text-white" : "bg-warning text-dark"
                                }`}
                                style={{ zIndex: 6 }}
                              >
                                {rm.status === "Available" && (
                                  <span className="rounded-circle bg-white" style={{ width: "6px", height: "6px" }} />
                                )}
                                <span>Room {rm.roomNumber} &bull; {rm.status}</span>
                              </span>
                            </div>

                            {/* Card Content */}
                            <div className="p-4">
                              <h4 className="fw-bold text-dark mb-1 fs-5">
                                {rm.roomType}{" "}
                                <span className="text-secondary fw-normal font-monospace" style={{ fontSize: "0.85rem" }}>
                                  (Room {rm.roomNumber})
                                </span>
                              </h4>

                              <div className="d-flex align-items-center gap-1.5 text-secondary small mb-2.5">
                                <Users size={14} style={{ color: "#3FA34D" }} />
                                <span>Max Occupancy: {rm.occupancyLimit || 4} Guests</span>
                              </div>

                              <p className="text-secondary small mb-3" style={{ minHeight: "38px", lineHeight: "1.5" }}>
                                {rm.description ||
                                  rm.typeDescription ||
                                  "Comfortable stay with essential amenities, fresh linens, and daily housekeeping."}
                              </p>

                              {/* Structured Pricing Breakdown */}
                              <div
                                className="p-3 rounded-3 mb-3 small"
                                style={{
                                  backgroundColor: "rgba(246, 250, 247, 0.8)",
                                  border: "1px solid rgba(205, 235, 207, 0.8)"
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center mb-1.5">
                                  <span className="text-secondary">Without Breakfast:</span>
                                  <span className="fw-bold text-dark font-monospace">
                                    ₱
                                    {parseFloat(rm.rateWithoutBreakfast || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2
                                    })}
                                  </span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className="text-secondary">With Breakfast:</span>
                                  <span className="fw-bold font-monospace" style={{ color: "#2155B5" }}>
                                    ₱
                                    {parseFloat(rm.rateWithBreakfast || 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2
                                    })}
                                  </span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-slate-200">
                                  <span className="text-secondary">Breakfast Option:</span>
                                  {isBreakfastFree ? (
                                    <span
                                      className="badge px-2 py-0.5 rounded-pill font-monospace"
                                      style={{
                                        backgroundColor: "rgba(63, 163, 77, 0.15)",
                                        color: "#3FA34D"
                                      }}
                                    >
                                      FREE / INCLUDED
                                    </span>
                                  ) : (
                                    <span className="fw-bold font-monospace" style={{ color: "#3FA34D" }}>
                                      +₱{breakfastDiff.toFixed(2)} meal add-on
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Action */}
                          <div className="p-4 pt-0">
                            <button
                              type="button"
                              onClick={() => {
                                setRoomType(rm.roomType);
                                setCheckIn(minCheckIn);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="pcc-btn-pill w-100 py-2.5 text-white"
                              style={{
                                background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                                boxShadow: "0 4px 15px rgba(33, 85, 181, 0.25)"
                              }}
                            >
                              <span>Check &amp; Reserve</span>
                              <span className="pcc-btn-icon-circle" style={{ width: "1.5rem", height: "1.5rem" }}>
                                <ArrowRight size={13} />
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredRooms.length > VISIBLE_COUNT && (
                <div className="text-center mt-5 pt-2">
                  <button
                    type="button"
                    className="btn px-4 py-2.5 rounded-pill fw-bold shadow-xs"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "1px solid rgba(33, 85, 181, 0.3)",
                      color: "#2155B5"
                    }}
                    onClick={() => setShowAllRooms((v) => !v)}
                  >
                    {showAllRooms ? "Show Less" : `See More (${filteredRooms.length - VISIBLE_COUNT} more rooms)`}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Fallback Cards */
            <div className="row g-4 justify-content-center">
              <div className="col-md-4">
                <div className="pcc-double-bezel">
                  <div className="pcc-double-bezel-inner p-4 text-center">
                    <img
                      src={defaultRoomImages["Standard Matrimonial"]}
                      alt="Standard Matrimonial"
                      className="rounded-3 mb-3 w-100 object-fit-cover"
                      style={{ height: "180px" }}
                    />
                    <h4 className="fw-bold text-dark fs-5">Standard Matrimonial</h4>
                    <p className="text-secondary small mb-2">Sleeps 2–4 · Daily housekeeping</p>
                    <div className="fw-bold fs-5 font-monospace" style={{ color: "#2155B5" }}>₱1,200 / night</div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="pcc-double-bezel">
                  <div className="pcc-double-bezel-inner p-4 text-center">
                    <img
                      src={defaultRoomImages["Twin Matrimonial"]}
                      alt="Twin Matrimonial"
                      className="rounded-3 mb-3 w-100 object-fit-cover"
                      style={{ height: "180px" }}
                    />
                    <h4 className="fw-bold text-dark fs-5">Twin Matrimonial</h4>
                    <p className="text-secondary small mb-2">Sleeps 4–5 · Ideal for families</p>
                    <div className="fw-bold fs-5 font-monospace" style={{ color: "#2155B5" }}>₱1,300 / night</div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="pcc-double-bezel">
                  <div className="pcc-double-bezel-inner p-4 text-center">
                    <img
                      src={defaultRoomImages["Deluxe Matrimonial"]}
                      alt="Deluxe Matrimonial"
                      className="rounded-3 mb-3 w-100 object-fit-cover"
                      style={{ height: "180px" }}
                    />
                    <h4 className="fw-bold text-dark fs-5">Deluxe Matrimonial</h4>
                    <p className="text-secondary small mb-2">Sleeps 5–7 · Spacious &amp; premium</p>
                    <div className="fw-bold fs-5 font-monospace" style={{ color: "#2155B5" }}>₱2,100 / night</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. CURATED AMENITIES & FACILITIES BENTO */}
      <section className="py-5 py-lg-6" id="amenities" style={{ zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <div className="text-center mb-5">
            <span
              className="badge px-3 py-1.5 rounded-pill small fw-bold font-monospace mb-2"
              style={{
                backgroundColor: "rgba(63, 163, 77, 0.12)",
                color: "#3FA34D"
              }}
            >
              GUEST COMFORTS
            </span>
            <h2 className="display-6 fw-bold text-dark mb-2">Amenities &amp; Facilities</h2>
            <p className="text-secondary small" style={{ maxWidth: "480px", margin: "0 auto" }}>
              Everything curated to ensure a peaceful, seamless, and restful stay in Koronadal.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(33, 85, 181, 0.12) 0%, rgba(63, 163, 77, 0.12) 100%)",
                      color: "#2155B5"
                    }}
                  >
                    <Bed size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">Sanitized Linens &amp; Beds</h4>
                  <p className="text-secondary small mb-0">High-thread-count clean bedding, fresh towels, and daily housekeeping.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(63, 163, 77, 0.12) 0%, rgba(205, 235, 207, 0.4) 100%)",
                      color: "#3FA34D"
                    }}
                  >
                    <Wifi size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">High-Speed Fiber Wi-Fi</h4>
                  <p className="text-secondary small mb-0">Reliable, high-speed wireless connectivity accessible across all rooms and floors.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(245, 158, 11, 0.15) 100%)",
                      color: "#ea580c"
                    }}
                  >
                    <Coffee size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">Cooked Breakfast Option</h4>
                  <p className="text-secondary small mb-0">Freshly prepared, home-style morning meals served right when you wake up.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(33, 85, 181, 0.12) 0%, rgba(22, 62, 130, 0.15) 100%)",
                      color: "#163E82"
                    }}
                  >
                    <Clock size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">24/7 Front Desk Concierge</h4>
                  <p className="text-secondary small mb-0">Courteous, round-the-clock staff ready to accommodate check-ins at any hour.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.2) 100%)",
                      color: "#0284c7"
                    }}
                  >
                    <AirVent size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">Air-Conditioned Sanctuaries</h4>
                  <p className="text-secondary small mb-0">Quiet, efficient climate control keeping your private room cool and tranquil.</p>
                </div>
              </div>
            </div>

            <div className="col-md-4 col-sm-6">
              <div className="pcc-double-bezel h-100 pcc-card-interactive">
                <div className="pcc-double-bezel-inner p-4 text-center h-100 d-flex flex-column align-items-center">
                  <div
                    className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3"
                    style={{
                      background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(74, 222, 128, 0.2) 100%)",
                      color: "#16a34a"
                    }}
                  >
                    <Car size={26} />
                  </div>
                  <h4 className="fw-bold text-dark fs-6 mb-1.5">Secure On-Site Parking</h4>
                  <p className="text-secondary small mb-0">Peace of mind with gated, monitored vehicle parking for registered guests.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. GUEST REVIEWS & TRAVELER TESTIMONIALS */}
      <section className="py-5 py-lg-6" id="testimonials" style={{ zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <div className="text-center mb-5">
            <span
              className="badge px-3 py-1.5 rounded-pill small fw-bold font-monospace mb-2"
              style={{
                backgroundColor: "rgba(33, 85, 181, 0.12)",
                color: "#2155B5"
              }}
            >
              TRAVELER STORIES
            </span>
            <h2 className="display-6 fw-bold text-dark mb-2">Guest Experiences</h2>
            <p className="text-secondary small" style={{ maxWidth: "480px", margin: "0 auto" }}>
              See what travelers, professionals, and families say about their stay at PCC Home Suite Home.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="pcc-double-bezel h-100">
                <div className="pcc-double-bezel-inner p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-1 mb-3 text-warning">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-secondary small mb-4" style={{ lineHeight: "1.7" }}>
                      &ldquo;Super clean rooms and very convenient location along Osmeña Street.
                      The front desk staff were accommodating even with our late 10 PM check-in.&rdquo;
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-3 pt-3 border-top border-slate-100">
                    <div
                      className="rounded-circle fw-bold text-white d-flex align-items-center justify-content-center shadow-xs"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                        fontSize: "0.85rem"
                      }}
                    >
                      MR
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0 fs-6">Maria R.</h6>
                      <small className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                        Family Trip &bull; Deluxe Matrimonial
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="pcc-double-bezel h-100">
                <div className="pcc-double-bezel-inner p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-1 mb-3 text-warning">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-secondary small mb-4" style={{ lineHeight: "1.7" }}>
                      &ldquo;Budget-friendly rates without sacrificing bed comfort. Having the breakfast
                      option made our early morning meetings in Koronadal so much easier.&rdquo;
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-3 pt-3 border-top border-slate-100">
                    <div
                      className="rounded-circle fw-bold text-white d-flex align-items-center justify-content-center shadow-xs"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "linear-gradient(135deg, #3FA34D 0%, #163E82 100%)",
                        fontSize: "0.85rem"
                      }}
                    >
                      JD
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0 fs-6">Jonathan D.</h6>
                      <small className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                        Business Stay &bull; Standard Matrimonial
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="pcc-double-bezel h-100">
                <div className="pcc-double-bezel-inner p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-1 mb-3 text-warning">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-secondary small mb-4" style={{ lineHeight: "1.7" }}>
                      &ldquo;Quiet and safe atmosphere. We stayed on the second floor twin room and had
                      a wonderful restful weekend. Highly recommended for families visiting Koronadal!&rdquo;
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-3 pt-3 border-top border-slate-100">
                    <div
                      className="rounded-circle fw-bold text-white d-flex align-items-center justify-content-center shadow-xs"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "linear-gradient(135deg, #163E82 0%, #2155B5 100%)",
                        fontSize: "0.85rem"
                      }}
                    >
                      ES
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0 fs-6">Elena S.</h6>
                      <small className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                        Weekend Vacation &bull; Twin Matrimonial
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. STAY PLANNER & CONCIERGE CTA BANNER */}
      <section className="py-5" style={{ zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <div
            className="p-4 p-md-5 rounded-4 text-white position-relative overflow-hidden shadow-lg"
            style={{
              background: "linear-gradient(135deg, #163E82 0%, #2155B5 50%, #3FA34D 100%)",
              border: "1px solid rgba(255, 255, 255, 0.25)"
            }}
          >
            <div className="row align-items-center g-4 position-relative" style={{ zIndex: 2 }}>
              <div className="col-lg-8">
                <div className="d-flex align-items-center gap-2 mb-2 font-monospace small">
                  <Award size={18} className="text-warning" />
                  <span>PLANNING A GROUP STAY OR EXTENDED VISIT?</span>
                </div>
                <h3 className="display-6 fw-bold mb-2">We tailor reservations to your schedule.</h3>
                <p className="opacity-90 mb-0" style={{ maxWidth: "580px", lineHeight: "1.6" }}>
                  Whether organizing family reunions, corporate stays, or prolonged visits to South Cotabato,
                  our front desk team ensures smooth accommodations.
                </p>
              </div>
              <div className="col-lg-4 text-lg-end">
                <Link
                  href="/auth/register"
                  className="pcc-btn-pill px-4 py-3 fw-bold text-dark"
                  style={{
                    backgroundColor: "#ffffff",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)"
                  }}
                >
                  <span>Book Your Stay Today</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. OBSIDIAN LUXURY FOOTER */}
      <footer className="py-5 mt-auto text-slate-300" id="contact" style={{ backgroundColor: "#0b132b", zIndex: 1 }}>
        <div className="container" style={{ maxWidth: "1140px" }}>
          <div className="row g-4 pb-4">
            <div className="col-lg-4">
              <div className="d-flex align-items-center gap-2.5 mb-3">
                <img
                  src="/assets/images/logo.jpg"
                  alt="PCC Logo"
                  width="36"
                  height="36"
                  className="rounded-circle object-fit-cover shadow-xs"
                />
                <span className="fw-bold text-white fs-5">PCC Home Suite Home</span>
              </div>
              <p className="text-secondary small mb-2" style={{ maxWidth: "340px", lineHeight: "1.65" }}>
                Comfortable, budget-friendly pension lodging along Osmeña Street, Zone 1,
                Koronadal City, South Cotabato.
              </p>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold font-monospace text-uppercase mb-3 small tracking-wider">Quick Navigation</h6>
              <ul className="list-unstyled d-flex flex-column gap-2 small text-secondary">
                <li><a href="#home" className="text-secondary text-decoration-none hover:text-white transition">Home</a></li>
                <li><a href="#about" className="text-secondary text-decoration-none hover:text-white transition">About Us</a></li>
                <li><a href="#promotions" className="text-secondary text-decoration-none hover:text-white transition">Active Promotions</a></li>
                <li><a href="#rooms" className="text-secondary text-decoration-none hover:text-white transition">Rooms &amp; Rates</a></li>
                <li><a href="#amenities" className="text-secondary text-decoration-none hover:text-white transition">Amenities</a></li>
                <li><a href="#testimonials" className="text-secondary text-decoration-none hover:text-white transition">Guest Reviews</a></li>
              </ul>
            </div>

            <div className="col-lg-4">
              <h6 className="text-white fw-bold font-monospace text-uppercase mb-3 small tracking-wider">Location &amp; Inquiries</h6>
              <div className="d-flex flex-column gap-2.5 small text-secondary">
                <a
                  href="https://maps.google.com/?q=Osmena+Street+Zone+1+Koronadal+City"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="d-flex align-items-center gap-2 text-secondary text-decoration-none hover:text-white transition"
                >
                  <MapPin size={16} style={{ color: "#3FA34D" }} className="flex-shrink-0" />
                  <span>Osmeña Street, Zone 1, Koronadal City</span>
                  <ArrowUpRight size={13} className="opacity-75" />
                </a>
                <div className="d-flex align-items-center gap-2">
                  <Mail size={16} style={{ color: "#2155B5" }} className="flex-shrink-0" />
                  <span>info@pccsuite.com</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Phone size={16} style={{ color: "#3FA34D" }} className="flex-shrink-0" />
                  <span>09000000000</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pt-4 border-top d-flex flex-wrap justify-content-between align-items-center gap-2 small font-monospace"
            style={{ borderColor: "rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}
          >
            <span>&copy; {year} PCC Home Suite Home. All rights reserved.</span>
            <div className="d-flex align-items-center gap-3">
              <Link href="/terms" className="text-secondary text-decoration-none hover:text-white transition">
                Terms &amp; Conditions
              </Link>
              <span>&bull;</span>
              <Link href="/privacy" className="text-secondary text-decoration-none hover:text-white transition">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* CHATBOT WIDGET */}
      <GuestChatBubble />

      {/* 10. REAL-TIME VACANCY RESULTS MODAL */}
      {showResultsModal && (
        <ModalPortal>
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              zIndex: 99999
            }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div
                className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                  boxShadow: "0 25px 60px -15px rgba(33, 85, 181, 0.35)",
                  border: "1px solid rgba(255, 255, 255, 0.8)"
                }}
              >
                {/* Header */}
                <div
                  className="modal-header px-4 py-3.5 border-0 text-white"
                  style={{
                    background: "linear-gradient(135deg, #2155B5 0%, #163E82 60%, #3FA34D 100%)"
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
                    style={{
                      backgroundColor: "rgba(230, 239, 230, 0.6)",
                      border: "1px solid rgba(205, 235, 207, 0.9)",
                      fontSize: "0.85rem"
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Calendar size={15} style={{ color: "#2155B5" }} />
                      <span>
                        Stay: <strong>{new Date(checkIn).toLocaleDateString()}</strong> &mdash;{" "}
                        <strong>{new Date(checkOut).toLocaleDateString()}</strong>
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-1.5">
                      <Coffee size={15} style={{ color: "#3FA34D" }} />
                      <span>
                        Option: <strong>{breakfast}</strong>
                      </span>
                    </div>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="text-center py-5 text-secondary">
                      <Hotel size={42} className="opacity-40 mb-2" style={{ color: "#163E82" }} />
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
                          className="p-3.5 rounded-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center bg-white gap-3 shadow-xs"
                          style={{
                            border: "1px solid rgba(205, 235, 207, 0.9)"
                          }}
                        >
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-bold text-dark fs-5">Room {rm.roomNumber}</span>
                              <span
                                className="badge px-2 py-0.5 rounded-pill font-monospace small"
                                style={{
                                  backgroundColor: "rgba(63, 163, 77, 0.15)",
                                  color: "#3FA34D"
                                }}
                              >
                                Available
                              </span>
                            </div>
                            <h6 className="fw-bold mb-1" style={{ color: "#2155B5" }}>
                              {rm.roomType} &bull; {rm.floor}
                            </h6>
                            <p className="text-secondary small mb-0" style={{ maxWidth: "480px" }}>
                              {rm.description}
                            </p>
                          </div>

                          <div className="text-md-end d-flex flex-row flex-md-column justify-content-between align-items-center align-items-md-end gap-2.5">
                            <div>
                              <div className="text-secondary small">Rate per night</div>
                              <span
                                className="fw-bold fs-4 font-monospace"
                                style={{ color: "#2155B5" }}
                              >
                                ₱{parseFloat(rm.rate).toFixed(2)}
                              </span>
                            </div>

                            {currentUser && currentUser.role === "Guest" ? (
                              <button
                                onClick={() => handleBookNow(rm.roomID)}
                                className="btn btn-sm px-4 py-2 fw-bold text-white rounded-pill"
                                style={{
                                  background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                                  border: "none",
                                  boxShadow: "0 4px 12px rgba(33, 85, 181, 0.25)"
                                }}
                                disabled={bookingInProgress}
                              >
                                {bookingInProgress ? "Submitting..." : "Reserve Now"}
                              </button>
                            ) : (
                              <Link
                                href={`/auth/register?check_in=${checkIn}&check_out=${checkOut}&room_id=${rm.roomID}&breakfast=${breakfast}`}
                                className="btn btn-sm px-4 py-2 fw-bold text-white rounded-pill"
                                style={{
                                  background: "linear-gradient(135deg, #2155B5 0%, #3FA34D 100%)",
                                  border: "none",
                                  boxShadow: "0 4px 12px rgba(33, 85, 181, 0.25)"
                                }}
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
                    className="btn btn-secondary btn-sm px-4 py-1.5 rounded-pill fw-bold"
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

function ArrowDownRightIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </svg>
  );
}
