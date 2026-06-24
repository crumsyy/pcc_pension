"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Check URL parameters for notices
  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      setSuccessMsg("Your account has been verified! You can now log in.");
    }
    if (searchParams.get("reset") === "1") {
      setSuccessMsg("Password reset successfully. Please log in with your new password.");
    }
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "1") {
        setErrorMsg("Invalid email or password. Please try again.");
      } else {
        setErrorMsg(decodeURIComponent(errorParam));
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If guest is registered but inactive (not verified via OTP)
        if (res.status === 403 && data.verified === false) {
          router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}&notice=${encodeURIComponent(data.message)}`);
          return;
        }
        setErrorMsg(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Successful login, redirect based on role
      if (data.role === "Administrator") {
        router.push("/admin/dashboard");
      } else if (data.role === "Receptionist") {
        router.push("/receptionist/dashboard");
      } else {
        router.push("/guest/dashboard");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred during log in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-pcc">
        <div className="container">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
            <img src="/assets/images/logo.jpg" alt="PCC Home Suite Home logo" height="42" style={{ borderRadius: "4px" }} />
          </Link>
          <Link href="/" className="btn btn-pcc-outline btn-sm">Back to Home</Link>
        </div>
      </nav>

      <section className="section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5">
              <div className="text-center mb-4">
                <div className="section-eyebrow">Welcome Back</div>
                <h2 className="section-title">Log In</h2>
                <p className="text-muted">Access your guest account or staff dashboard.</p>
              </div>

              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
              {successMsg && <div className="alert alert-success">{successMsg}</div>}

              <form onSubmit={handleSubmit} className="availability-bar">
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
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="remember" style={{ fontSize: "0.85rem" }}>
                      Remember me
                    </label>
                  </div>
                  <Link href="/auth/forgot-password" style={{ fontSize: "0.85rem" }} className="text-blue">
                    Forgot password?
                  </Link>
                </div>
                <button type="submit" className="btn btn-pcc-primary w-100" disabled={loading}>
                  {loading ? "Logging In..." : "Log In"}
                </button>
                <p className="text-center mt-3 mb-0" style={{ fontSize: "0.9rem" }}>
                  Don&apos;t have an account? <Link href="/auth/register" className="text-blue fw-semibold">Create one</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container py-5 text-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
