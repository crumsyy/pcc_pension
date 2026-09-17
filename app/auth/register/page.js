"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DateInput, { isValidDate, toDbDate } from "@/app/components/DateInput";
import ThemeToggle from "@/app/components/ThemeToggle";
import LoadingButton from "@/app/components/LoadingButton";

export default function RegisterPage() {
  const router = useRouter();
  const bottomErrorRef = useRef(null);

  // Form Fields State
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation & Error states
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Field specific invalid states
  const [fieldErrors, setFieldErrors] = useState({});
  const [maxDobStr, setMaxDobStr] = useState('');

  useEffect(() => {
    const today = new Date();
    const year18Ago = today.getFullYear() - 18;
    const pad = (n) => String(n).padStart(2, '0');
    setMaxDobStr(`${year18Ago}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  }, []);

  // Mobile focus centering
  const handleInputFocus = (e) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setTimeout(() => {
        try {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {}
      }, 300);
    }
  };

  // Input sanitization helpers
  const handleNameChange = (val, setter, fieldName) => {
    const sanitized = val.replace(/[^A-Za-zÑñ\s'\-]/g, "");
    setter(sanitized);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: false }));
  };

  const handleAddressChange = (val, setter, fieldName) => {
    // Allow letters, numbers, spaces, periods, commas, and hyphens for addresses
    const sanitized = val.replace(/[^A-Za-z0-9Ññ\s.,'#\-]/g, "");
    setter(sanitized);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: false }));
  };

  const handleContactChange = (val) => {
    let raw = val.replace(/[^0-9]/g, "");
    // Auto-convert +639 or 639 into 09
    if (raw.startsWith('639') && raw.length >= 12) {
      raw = '0' + raw.substring(2);
    }
    const sanitized = raw.slice(0, 11);
    setContact(sanitized);
    setFieldErrors((prev) => ({ ...prev, contact: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const errors = {};
    const namePattern = /^[A-Za-zÑñ\s'\-]+$/;
    const addressPattern = /^[A-Za-z0-9Ññ\s.,'#\-]+$/;

    // Frontend validations
    if (!firstName.trim() || !namePattern.test(firstName)) errors.firstName = true;
    if (middleName.trim() !== "" && !namePattern.test(middleName)) errors.middleName = true;
    if (!lastName.trim() || !namePattern.test(lastName)) errors.lastName = true;
    if (!gender) errors.gender = true;
    if (!city.trim() || !addressPattern.test(city)) errors.city = true;
    if (!province.trim() || !addressPattern.test(province)) errors.province = true;
    
    // Normalize and validate Philippine contact number
    let cleanContact = contact.replace(/[^0-9]/g, "");
    if (cleanContact.startsWith('639') && cleanContact.length === 12) {
      cleanContact = '0' + cleanContact.substring(2);
    }
    if (!/^09[0-9]{9}$/.test(cleanContact)) {
      errors.contact = true;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errors.email = true;

    // Date of Birth validation
    if (!dob || !isValidDate(dob)) {
      errors.dob = true;
    } else {
      const selectedDob = new Date(toDbDate(dob) + 'T00:00:00');
      const todayFloor = new Date();
      todayFloor.setHours(0, 0, 0, 0);
      
      let age = todayFloor.getFullYear() - selectedDob.getFullYear();
      const mDiff = todayFloor.getMonth() - selectedDob.getMonth();
      if (mDiff < 0 || (mDiff === 0 && todayFloor.getDate() < selectedDob.getDate())) {
        age--;
      }

      if (age < 18) {
        errors.dob = true;
      }
    }

    // Password strength check (min 8 chars, uppercase, lowercase, number, special char)
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!strongPw.test(password)) {
      errors.password = true;
    }
    if (!confirmPassword || password !== confirmPassword) {
      errors.confirmPassword = true;
    }
    if (!terms) {
      errors.terms = true;
    }

    // If any validation errors exist, highlight and smoothly scroll to the first one
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg("Please complete and correct the highlighted fields before submitting.");
      setLoading(false);

      // Auto-scroll to the first invalid field
      const fieldOrder = ['firstName', 'middleName', 'lastName', 'gender', 'dob', 'city', 'province', 'contact', 'email', 'password', 'confirmPassword', 'terms'];
      const firstKey = fieldOrder.find(k => errors[k]);
      if (firstKey) {
        setTimeout(() => {
          const el = document.getElementById(firstKey) || document.querySelector(`[name="${firstKey}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (el.focus) el.focus({ preventScroll: true });
          }
        }, 50);
      }
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          gender,
          dob: toDbDate(dob),
          city,
          province,
          contact: cleanContact,
          email,
          password,
          confirmPassword,
          terms,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.message || "Registration failed. Please review your details and try again.";
        setErrorMsg(errorText);
        setLoading(false);
        // Scroll error into view on mobile
        if (bottomErrorRef.current) {
          bottomErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Successful registration
      setSuccessMsg("Account registered! Sending your verification code...");
      
      setTimeout(() => {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(email.toLowerCase())}`);
      }, 500);

      // Safety fallback redirect if router takes long
      setTimeout(() => {
        if (window.location.pathname.includes('/auth/register')) {
          window.location.href = `/auth/verify-otp?email=${encodeURIComponent(email.toLowerCase())}`;
        }
      }, 2500);

    } catch (err) {
      console.error("Registration error:", err);
      setErrorMsg("An unexpected network error occurred. Please check your connection and try again.");
      setLoading(false);
      if (bottomErrorRef.current) {
        bottomErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-pcc">
        <div className="container">
          <Link href="/" className="navbar-brand">
            <img src="/assets/images/logo.jpg" height="42" alt="PCC Logo" style={{ borderRadius: "4px" }} />
          </Link>
          <div className="d-flex align-items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="btn btn-pcc-primary btn-sm">Back to Home</Link>
          </div>
        </div>
      </nav>

      <section className="section py-4 py-md-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-md-10 col-lg-7">
              <div className="text-center mb-4">
                <div className="section-eyebrow">Join Us</div>
                <h2 className="section-title mb-1">Create Your Account</h2>
                <p className="text-muted small">Register to book rooms, track reservations, and order meals.</p>
              </div>

              {/* Top alert (for desktop or when scrolled to top) */}
              {errorMsg && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2.5 px-3 mb-4 shadow-sm" role="alert">
                  <i className="bi bi-exclamation-circle-fill fs-5 text-danger flex-shrink-0"></i>
                  <span style={{ fontSize: '0.9rem' }}>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="alert alert-success d-flex align-items-center gap-2 py-2.5 px-3 mb-4 shadow-sm" role="alert">
                  <i className="bi bi-check-circle-fill fs-5 text-success flex-shrink-0"></i>
                  <span style={{ fontSize: '0.9rem' }}>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="availability-bar p-3 p-md-4 shadow-sm rounded bg-white" noValidate>
                <div className="row g-3">
                  {/* First Name */}
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold" htmlFor="firstName">
                      First Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      className={`form-control ${fieldErrors.firstName ? "is-invalid border-danger" : ""}`}
                      placeholder="Juan"
                      value={firstName}
                      onChange={(e) => handleNameChange(e.target.value, setFirstName, "firstName")}
                      onFocus={handleInputFocus}
                      required
                    />
                    {fieldErrors.firstName && (
                      <div className="text-danger small mt-1 fw-semibold d-block">First name must contain letters only.</div>
                    )}
                  </div>

                  {/* Middle Name */}
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold" htmlFor="middleName">
                      Middle Name <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <input
                      id="middleName"
                      name="middleName"
                      type="text"
                      className={`form-control ${fieldErrors.middleName ? "is-invalid border-danger" : ""}`}
                      placeholder="Optional"
                      value={middleName}
                      onChange={(e) => handleNameChange(e.target.value, setMiddleName, "middleName")}
                      onFocus={handleInputFocus}
                    />
                    {fieldErrors.middleName && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Middle name must contain letters only.</div>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold" htmlFor="lastName">
                      Last Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      className={`form-control ${fieldErrors.lastName ? "is-invalid border-danger" : ""}`}
                      placeholder="Dela Cruz"
                      value={lastName}
                      onChange={(e) => handleNameChange(e.target.value, setLastName, "lastName")}
                      onFocus={handleInputFocus}
                      required
                    />
                    {fieldErrors.lastName && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Last name must contain letters only.</div>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="gender">
                      Gender <span className="text-danger">*</span>
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      className={`form-select ${fieldErrors.gender ? "is-invalid border-danger" : ""}`}
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, gender: false }));
                      }}
                      onFocus={handleInputFocus}
                      required
                    >
                      <option value="" disabled>Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    {fieldErrors.gender && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Please select a gender.</div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="dob">
                      Date of Birth <span className="text-danger">*</span>
                    </label>
                    <DateInput
                      id="dob"
                      name="dob"
                      className={`form-control ${fieldErrors.dob ? "is-invalid border-danger" : ""}`}
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, dob: false }));
                      }}
                      max={maxDobStr}
                      required
                    />
                    {fieldErrors.dob && (
                      <div className="text-danger small mt-1 fw-semibold d-block">
                        Please provide a valid date of birth (must be at least 18 years old).
                      </div>
                    )}
                  </div>

                  {/* City */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="city">
                      City / Municipality <span className="text-danger">*</span>
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className={`form-control ${fieldErrors.city ? "is-invalid border-danger" : ""}`}
                      placeholder="e.g. Koronadal City"
                      value={city}
                      onChange={(e) => handleAddressChange(e.target.value, setCity, "city")}
                      onFocus={handleInputFocus}
                      required
                    />
                    {fieldErrors.city && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Please enter a valid city or municipality name.</div>
                    )}
                  </div>

                  {/* Province */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="province">
                      Province <span className="text-danger">*</span>
                    </label>
                    <input
                      id="province"
                      name="province"
                      type="text"
                      className={`form-control ${fieldErrors.province ? "is-invalid border-danger" : ""}`}
                      placeholder="e.g. South Cotabato"
                      value={province}
                      onChange={(e) => handleAddressChange(e.target.value, setProvince, "province")}
                      onFocus={handleInputFocus}
                      required
                    />
                    {fieldErrors.province && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Please enter a valid province name.</div>
                    )}
                  </div>

                  {/* Contact Number */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="contact">
                      Contact Number <span className="text-danger">*</span>
                    </label>
                    <input
                      id="contact"
                      name="contact"
                      type="tel"
                      className={`form-control ${fieldErrors.contact ? "is-invalid border-danger" : ""}`}
                      placeholder="09XXXXXXXXX"
                      value={contact}
                      onChange={(e) => handleContactChange(e.target.value)}
                      onFocus={handleInputFocus}
                      maxLength={11}
                      required
                    />
                    {fieldErrors.contact ? (
                      <div className="text-danger small mt-1 fw-semibold d-block">Must be an 11-digit mobile number starting with 09 (e.g. 09123456789).</div>
                    ) : (
                      <div className="form-text small text-muted">Format: 09XXXXXXXXX (11 digits)</div>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="email">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: false }));
                      }}
                      onFocus={handleInputFocus}
                      required
                    />
                    {fieldErrors.email && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Please enter a valid email address.</div>
                    )}
                  </div>

                  {/* Password */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="password">
                      Password <span className="text-danger">*</span>
                    </label>
                    <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className={`form-control ${fieldErrors.password ? "is-invalid border-danger" : ""}`}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, password: false }));
                        }}
                        onFocus={handleInputFocus}
                        style={{ paddingRight: '2.8rem', flex: '1' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle password visibility"
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#66756b',
                          padding: '4px',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          zIndex: 5
                        }}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <div className="text-danger small mt-1 fw-semibold d-block">
                        Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
                      </div>
                    ) : (
                      <div className="form-text small text-muted">Min. 8 chars with uppercase, lowercase, number &amp; symbol.</div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-bold" htmlFor="confirmPassword">
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        className={`form-control ${fieldErrors.confirmPassword ? "is-invalid border-danger" : ""}`}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: false }));
                        }}
                        onFocus={handleInputFocus}
                        style={{ paddingRight: '2.8rem', flex: '1' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label="Toggle password visibility"
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#66756b',
                          padding: '4px',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          zIndex: 5
                        }}
                      >
                        {showConfirmPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <div className="text-danger small mt-1 fw-semibold d-block">Passwords do not match. Please re-enter.</div>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="col-12 form-check mt-3 mb-2 ps-4">
                    <input
                      className={`form-check-input ${fieldErrors.terms ? "is-invalid border-danger" : ""}`}
                      type="checkbox"
                      id="terms"
                      checked={terms}
                      onChange={(e) => {
                        setTerms(e.target.checked);
                        setFieldErrors((prev) => ({ ...prev, terms: false }));
                      }}
                      required
                    />
                    <label className="form-check-label small" htmlFor="terms" style={{ fontSize: "0.86rem" }}>
                      I agree to the terms &amp; conditions and privacy policy of PCC Home Suite Home.
                    </label>
                    {fieldErrors.terms && (
                      <div className="text-danger small mt-1 fw-semibold d-block">You must agree to the terms &amp; conditions to continue.</div>
                    )}
                  </div>

                  {/* Bottom Error & Notice Alert: positioned right above the submit button so mobile users immediately see it */}
                  <div ref={bottomErrorRef} className="col-12">
                    {errorMsg && (
                      <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-2 shadow-sm" role="alert">
                        <i className="bi bi-exclamation-triangle-fill text-danger flex-shrink-0"></i>
                        <span style={{ fontSize: '0.88rem' }}>{errorMsg}</span>
                      </div>
                    )}
                    {successMsg && (
                      <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 mb-2 shadow-sm" role="alert">
                        <i className="bi bi-check-circle-fill text-success flex-shrink-0"></i>
                        <span style={{ fontSize: '0.88rem' }}>{successMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="col-12">
                    <LoadingButton
                      type="submit"
                      className="btn btn-pcc-primary w-100 py-2.5 fw-bold shadow-sm"
                      isLoading={loading}
                      loadingText="Registering account..."
                    >
                      Create Account
                    </LoadingButton>
                    <p className="text-center mt-3 mb-0" style={{ fontSize: "0.9rem" }}>
                      Already have an account? <Link href="/auth/login" className="text-blue fw-semibold">Log in</Link>
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
