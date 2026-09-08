"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingButton from "@/app/components/LoadingButton";

function ForgotPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Enter new password
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to send reset code. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessMsg("Password reset code has been sent to your email.");
      setStep(2);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otp || otp.length < 6) {
      setErrorMsg("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Incorrect verification code. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessMsg("Code verified! Please enter your new password below.");
      setStep(3);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred verifying code. Please try again.");
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setErrorMsg("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", email, otp, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to reset password. Please try again.");
        setLoading(false);
        return;
      }

      // Successfully reset, redirect to login page
      router.push("/auth/login?reset=1");
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred during password reset. Please try again.");
      setLoading(false);
    }
  };

  const handleOtpChange = (val) => {
    const sanitized = val.replace(/[^0-9]/g, "").slice(0, 6);
    setOtp(sanitized);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-pcc">
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
            <img src="/assets/images/logo.jpg" alt="PCC Home Suite Home logo" height="42" style={{ borderRadius: "4px" }} />
          </Link>
          <Link href="/auth/login" className="btn btn-pcc-outline btn-sm">Back to Login</Link>
        </div>
      </nav>

      <section className="section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5">
              <div className="text-center mb-4">
                <div className="section-eyebrow">Account Recovery</div>
                <h2 className="section-title">Forgot Password</h2>
                <p className="text-muted">
                  {step === 1 && "Enter your registered email address to receive a password reset verification code."}
                  {step === 2 && "Enter the 6-digit verification code sent to your email."}
                  {step === 3 && "Create a new password for your account."}
                </p>
              </div>

              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
              {successMsg && <div className="alert alert-success">{successMsg}</div>}

              {step === 1 && (
                <form onSubmit={handleRequestOtp} className="availability-bar">
                  <div className="mb-3">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <LoadingButton
                    type="submit"
                    className="btn btn-pcc-primary w-100 fw-bold"
                    isLoading={loading}
                    loadingText="Sending Code..."
                  >
                    Send Reset Code
                  </LoadingButton>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleVerifyOtp} className="availability-bar">
                  <div className="mb-3">
                    <label className="form-label">Verification Code (OTP)</label>
                    <input
                      type="text"
                      maxLength="6"
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      className="form-control text-center fw-bold"
                      style={{ fontSize: "1.3rem", letterSpacing: "0.25em" }}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <LoadingButton
                    type="submit"
                    className="btn btn-pcc-primary w-100 fw-bold"
                    isLoading={loading}
                    loadingText="Verifying..."
                  >
                    Verify Code
                  </LoadingButton>
                  <button 
                    type="button" 
                    className="btn btn-link w-100 text-blue mt-2" 
                    onClick={() => { setStep(1); setErrorMsg(""); setSuccessMsg(""); setOtp(""); }}
                    style={{ fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    Resend Code / Change Email
                  </button>
                </form>
              )}

              {step === 3 && (
                <form onSubmit={handleResetPassword} className="availability-bar">
                  <div className="mb-3">
                    <label className="form-label">New Password</label>
                    <div className="password-field-wrap" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-control"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ paddingRight: "2.8rem", flex: "1" }}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#66756b",
                          zIndex: 5
                        }}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <LoadingButton
                    type="submit"
                    className="btn btn-pcc-primary w-100 fw-bold"
                    isLoading={loading}
                    loadingText="Resetting Password..."
                  >
                    Set New Password
                  </LoadingButton>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="container py-5 text-center">Loading...</div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
