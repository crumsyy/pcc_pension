"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) {
      router.push("/auth/register");
      return;
    }
    setEmail(emailParam);

    const noticeParam = searchParams.get("notice");
    if (noticeParam) {
      setNoticeMsg(decodeURIComponent(noticeParam));
    }
  }, [searchParams, router]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setNoticeMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Verification failed. Please try again.");
        setLoading(false);
        return;
      }

      // Success, redirect to login page with verified notice
      router.push("/auth/login?verified=1");
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred during verification. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setNoticeMsg("");
    setResending(true);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to resend code. Please try again.");
        setResending(false);
        return;
      }

      setSuccessMsg(data.message || "A new verification code has been sent to your email.");
      setResending(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred. Please try again.");
      setResending(false);
    }
  };

  // Restrict OTP input to numbers only and max 6 digits
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
          <Link href="/" className="btn btn-pcc-primary btn-sm">Back to Home</Link>
        </div>
      </nav>

      <section className="section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5">
              <div className="text-center mb-4">
                <div className="section-eyebrow">One Last Step</div>
                <h2 className="section-title">Verify Your Email</h2>
                <p className="text-muted">
                  We sent a 6-digit verification code to<br />
                  <strong>{email}</strong>
                </p>
              </div>

              {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
              {noticeMsg && <div className="alert alert-warning" role="alert">{noticeMsg}</div>}
              {successMsg && <div className="alert alert-success" role="alert">{successMsg}</div>}

              <form onSubmit={handleVerify} className="availability-bar">
                <div className="mb-3 text-center">
                  <label className="form-label">Enter Verification Code</label>
                  <input
                    type="text"
                    maxLength="6"
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    className="form-control text-center"
                    style={{ fontSize: "1.5rem", letterSpacing: "0.5em", fontFamily: "var(--font-tag)" }}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-pcc-primary w-100" disabled={loading}>
                  {loading ? "Verifying..." : "Verify Account"}
                </button>
              </form>

              <form onSubmit={handleResend} className="text-center mt-3">
                <p className="mb-1 style-font" style={{ fontSize: "0.9rem", color: "var(--pcc-muted)" }}>
                  Didn&apos;t receive the code?
                </p>
                <button type="submit" className="btn btn-pcc-outline btn-sm" disabled={resending}>
                  {resending ? "Resending..." : "Resend Code"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="container py-5 text-center">Loading...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
