"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

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
  const [loading, setLoading] = useState(false);
  
  // Field specific invalid states
  const [fieldErrors, setFieldErrors] = useState({});

  // Input sanitization helpers
  const handleNameChange = (val, setter, fieldName) => {
    // Letters, spaces, hyphens, and apostrophes only
    const sanitized = val.replace(/[^A-Za-zÑñ\s'\-]/g, "");
    setter(sanitized);
    // Clear field error once changed
    setFieldErrors((prev) => ({ ...prev, [fieldName]: false }));
  };

  const handleContactChange = (val) => {
    // Digits only, max 11 digits
    const sanitized = val.replace(/[^0-9]/g, "").slice(0, 11);
    setContact(sanitized);
    setFieldErrors((prev) => ({ ...prev, contact: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const errors = {};
    const namePattern = /^[A-Za-zÑñ\s'\-]+$/;

    // Frontend validations (matching register.php validation script)
    if (!firstName.trim() || !namePattern.test(firstName)) errors.firstName = true;
    if (middleName.trim() !== "" && !namePattern.test(middleName)) errors.middleName = true;
    if (!lastName.trim() || !namePattern.test(lastName)) errors.lastName = true;
    if (!gender) errors.gender = true;
    if (!dob) errors.dob = true;
    if (!city.trim() || !namePattern.test(city)) errors.city = true;
    if (!province.trim() || !namePattern.test(province)) errors.province = true;
    if (!/^[0-9]{11}$/.test(contact)) errors.contact = true;
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errors.email = true;

    // REQ190: Password strength check
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!strongPw.test(password)) {
      errors.password = true;
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = true;
    }
    if (!terms) {
      errors.terms = true;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg("Please correct the errors in the form before submitting.");
      setLoading(false);
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
          dob,
          city,
          province,
          contact,
          email,
          password,
          confirmPassword,
          terms,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Successful registration, redirect to verify-otp page
      router.push(`/auth/verify-otp?email=${encodeURIComponent(email.toLowerCase())}`);
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred during registration. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-pcc">
        <div className="container">
          <Link href="/" className="navbar-brand">
            <img src="/assets/images/logo.jpg" height="42" alt="PCC Logo" style={{ borderRadius: "4px" }} />
          </Link>
          <Link href="/" className="btn btn-pcc-outline btn-sm">Back to Home</Link>
        </div>
      </nav>

      <section className="section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="text-center mb-4">
                <div className="section-eyebrow">Join Us</div>
                <h2 className="section-title">Create Your Account</h2>
                <p className="text-muted">Register to book rooms, track reservations, and get support from our front desk.</p>
              </div>

              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}

              <form onSubmit={handleSubmit} className="availability-bar" noValidate>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">First Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.firstName ? "is-invalid" : ""}`}
                      placeholder="Juan"
                      value={firstName}
                      onChange={(e) => handleNameChange(e.target.value, setFirstName, "firstName")}
                      required
                    />
                    <div className="invalid-feedback">First name must contain letters only.</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Middle Name</label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.middleName ? "is-invalid" : ""}`}
                      placeholder="(Optional)"
                      value={middleName}
                      onChange={(e) => handleNameChange(e.target.value, setMiddleName, "middleName")}
                    />
                    <div className="invalid-feedback">Middle name must contain letters only.</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Last Name <span class="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.lastName ? "is-invalid" : ""}`}
                      placeholder="Dela Cruz"
                      value={lastName}
                      onChange={(e) => handleNameChange(e.target.value, setLastName, "lastName")}
                      required
                    />
                    <div className="invalid-feedback">Last name must contain letters only.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Gender <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${fieldErrors.gender ? "is-invalid" : ""}`}
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, gender: false }));
                      }}
                      required
                    >
                      <option value="" disabled>Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <div className="invalid-feedback">Please select a gender.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className={`form-control ${fieldErrors.dob ? "is-invalid" : ""}`}
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, dob: false }));
                      }}
                      required
                    />
                    <div className="invalid-feedback">Please enter your date of birth.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">City <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.city ? "is-invalid" : ""}`}
                      placeholder="e.g. Koronadal"
                      value={city}
                      onChange={(e) => handleNameChange(e.target.value, setCity, "city")}
                      required
                    />
                    <div className="invalid-feedback">Letters only.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Province <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.province ? "is-invalid" : ""}`}
                      placeholder="e.g. South Cotabato"
                      value={province}
                      onChange={(e) => handleNameChange(e.target.value, setProvince, "province")}
                      required
                    />
                    <div className="invalid-feedback">Letters only.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Contact Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${fieldErrors.contact ? "is-invalid" : ""}`}
                      placeholder="09XXXXXXXXX"
                      value={contact}
                      onChange={(e) => handleContactChange(e.target.value)}
                      maxLength={11}
                      required
                    />
                    <div className="invalid-feedback">Must be exactly 11 digits (e.g. 09XXXXXXXXX).</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Email Address <span className="text-danger">*</span></label>
                    <input
                      type="email"
                      className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: false }));
                      }}
                      required
                    />
                    <div className="invalid-feedback">Please enter a valid email address.</div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Password <span className="text-danger">*</span></label>
                    <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className={`form-control ${fieldErrors.password ? "is-invalid" : ""}`}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, password: false }));
                        }}
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
                          padding: '2px',
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
                    <div className="form-text">Min. 8 chars with uppercase, lowercase, number &amp; special character.</div>
                    <div className="invalid-feedback" style={{ display: fieldErrors.password ? 'block' : 'none' }}>Password must contain uppercase, lowercase, number, and special character.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Confirm Password <span className="text-danger">*</span></label>
                    <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className={`form-control ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: false }));
                        }}
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
                          padding: '2px',
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
                    <div className="invalid-feedback" style={{ display: fieldErrors.confirmPassword ? 'block' : 'none' }}>Passwords do not match. Please re-enter.</div>
                  </div>

                  <div className="col-12 form-check mt-1">
                    <input
                      className={`form-check-input ${fieldErrors.terms ? "is-invalid" : ""}`}
                      type="checkbox"
                      id="terms"
                      checked={terms}
                      onChange={(e) => {
                        setTerms(e.target.checked);
                        setFieldErrors((prev) => ({ ...prev, terms: false }));
                      }}
                      required
                    />
                    <label className="form-check-label" htmlFor="terms" style={{ fontSize: "0.85rem" }}>
                      I agree to the terms &amp; conditions and privacy policy of PCC Home Suite Home.
                    </label>
                    <div className="invalid-feedback">You must agree to the terms &amp; conditions.</div>
                  </div>

                  <div className="col-12">
                    <button type="submit" className="btn btn-pcc-primary w-100 py-2" disabled={loading}>
                      {loading ? "Registering..." : "Create Account"}
                    </button>
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
