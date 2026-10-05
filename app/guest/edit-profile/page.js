'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ModalDialog from '../../components/ModalDialog';
import LoadingButton from '../../components/LoadingButton';
import { GuestEditProfileSkeleton } from '@/app/components/skeletons/GuestSkeletons';

export default function EditProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    contact: '',
    gender: 'Other',
    city: '',
    province: ''
  });

  // Modal Dialog Configuration
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK'
  });

  const showAlert = (type, title, message) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // EMAIL CHANGE 2-STEP OTP WORKFLOW STATES
  // Step: 0 = closed, 1 = verify current email OTP, 2 = enter new email, 3 = verify new email OTP
  const [emailStep, setEmailStep] = useState(0);
  const [currentEmailOtp, setCurrentEmailOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmailOtp, setNewEmailOtp] = useState('');
  const [emailProcessing, setEmailProcessing] = useState(false);

  // PASSWORD CHANGE OTP WORKFLOW STATES
  // Step: 0 = closed, 1 = enter OTP + new password
  const [passwordStep, setPasswordStep] = useState(0);
  const [passwordOtp, setPasswordOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordProcessing, setPasswordProcessing] = useState(false);

  const [profilePicture, setProfilePicture] = useState('');
  const [uploadingPic, setUploadingPic] = useState(false);

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showAlert('error', 'File Size Exceeded', 'Please select an image file smaller than 2MB.');
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      showAlert('error', 'Unsupported Format', 'Please upload a valid JPG or PNG image.');
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload profile picture.');

      const uploadedUrl = data.url;
      setProfilePicture(uploadedUrl);

      // Persist directly to DB
      await fetch('/api/guest/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: uploadedUrl })
      });

      showAlert('success', 'Profile Picture Updated', 'Your profile picture has been uploaded and saved!');
    } catch (err) {
      showAlert('error', 'Upload Failed', err.message);
    } finally {
      setUploadingPic(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (!profilePicture) return;
    setUploadingPic(true);
    try {
      const res = await fetch('/api/guest/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove profile picture.');

      setProfilePicture('');
      showAlert('success', 'Profile Picture Removed', 'Your profile picture has been removed.');
    } catch (err) {
      showAlert('error', 'Remove Failed', err.message);
    } finally {
      setUploadingPic(false);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guest/profile');
      const data = await res.json();
      if (res.ok) {
        setProfileForm({
          firstName: data.guest.firstName || '',
          middleName: data.guest.middleName || '',
          lastName: data.guest.lastName || '',
          contact: data.guest.contact || '',
          gender: data.guest.gender || 'Other',
          city: data.guest.city || '',
          province: data.guest.province || ''
        });
        setProfilePicture(data.guest.profilePicture || '');
        setCurrentEmail(data.email || '');
      } else {
        showAlert('error', 'Error', data.error || 'Failed to load profile.');
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 1. SAVE BASIC PROFILE DETAILS (Direct to MySQL without OTP)
  const handleSaveBasicProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/guest/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      showAlert('success', 'Profile Updated', data.message || 'Your profile details have been saved.');
    } catch (err) {
      showAlert('error', 'Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  // 2. EMAIL CHANGE WORKFLOW HANDLERS
  const handleStartEmailChange = async () => {
    setEmailProcessing(true);
    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_email_otp_current' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP.');

      setEmailStep(1);
      showAlert('info', 'OTP Sent', data.message);
    } catch (err) {
      showAlert('error', 'OTP Error', err.message);
    } finally {
      setEmailProcessing(false);
    }
  };

  const handleVerifyCurrentEmailOtp = async (e) => {
    e.preventDefault();
    if (!currentEmailOtp.trim()) return;
    setEmailProcessing(true);

    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_email_otp_current',
          currentOtp: currentEmailOtp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');

      setEmailStep(2);
    } catch (err) {
      showAlert('error', 'Verification Failed', err.message);
    } finally {
      setEmailProcessing(false);
    }
  };

  const handleRequestNewEmailOtp = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailProcessing(true);

    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request_email_otp_new',
          newEmail: newEmail.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP to new email.');

      setEmailStep(3);
      showAlert('info', 'OTP Sent to New Email', data.message);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setEmailProcessing(false);
    }
  };

  const handleVerifyNewEmailOtp = async (e) => {
    e.preventDefault();
    if (!newEmailOtp.trim()) return;
    setEmailProcessing(true);

    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_email_otp_new',
          newEmail: newEmail.trim(),
          newEmailOtp: newEmailOtp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update email.');

      setCurrentEmail(newEmail.trim());
      setEmailStep(0);
      setCurrentEmailOtp('');
      setNewEmail('');
      setNewEmailOtp('');
      showAlert('success', 'Email Updated', data.message);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setEmailProcessing(false);
    }
  };

  // 3. PASSWORD CHANGE WORKFLOW HANDLERS
  const handleStartPasswordChange = async () => {
    setPasswordProcessing(true);
    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_password_otp' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send password reset OTP.');

      setPasswordStep(1);
      showAlert('info', 'OTP Sent', data.message);
    } catch (err) {
      showAlert('error', 'OTP Error', err.message);
    } finally {
      setPasswordProcessing(false);
    }
  };

  const handleVerifyPasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showAlert('warning', 'Password Mismatch', 'New password and confirm password do not match.');
      return;
    }
    setPasswordProcessing(true);

    try {
      const res = await fetch('/api/guest/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_password_otp',
          passwordOtp: passwordOtp.trim(),
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed.');

      setPasswordStep(0);
      setPasswordOtp('');
      setNewPassword('');
      setConfirmPassword('');
      showAlert('success', 'Password Changed', data.message);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setPasswordProcessing(false);
    }
  };

  return (
    <>
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />

      {/* NAVBAR HEADER */}
      <nav className="navbar navbar-dark text-white border-bottom shadow-sm sticky-top px-3" style={{ background: 'var(--pcc-blue)' }}>
        <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
          <Link href="/guest/dashboard" className="btn btn-sm btn-light text-dark fw-semibold d-flex align-items-center gap-1 shadow-xs">
            <i className="bi bi-arrow-left"></i> Back to Dashboard
          </Link>
          <span className="fw-bold text-white display-font" style={{ fontSize: '1.05rem', color: '#ffffff' }}>
            Edit Profile Settings
          </span>
        </div>
      </nav>

      <div className="container py-4" style={{ maxWidth: '800px' }}>
        {loading ? (
          <GuestEditProfileSkeleton />
        ) : (
          <div className="d-flex flex-column gap-4">
            {/* CARD 0: PROFILE PICTURE UPLOAD */}
            <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '16px' }}>
              <div className="d-flex flex-column flex-sm-row align-items-center gap-4">
                <div className="position-relative d-inline-block">
                  <img
                    src={profilePicture || "/assets/images/logo.jpg"}
                    alt="Guest Profile Picture"
                    className="rounded-circle border shadow-sm"
                    style={{
                      width: '120px',
                      height: '120px',
                      objectFit: 'cover',
                      border: '3px solid var(--pcc-blue, #2155B5)'
                    }}
                  />
                  <label
                    htmlFor="avatarInput"
                    className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm cursor-pointer"
                    style={{ width: '36px', height: '36px', border: '2px solid #ffffff' }}
                    title="Upload & Change Profile Picture"
                  >
                    <i className="bi bi-camera-fill"></i>
                  </label>
                  <input
                    type="file"
                    id="avatarInput"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    className="d-none"
                    onChange={handleProfilePictureUpload}
                    disabled={uploadingPic}
                  />
                </div>
                <div>
                  <h5 className="fw-bold text-dark mb-1">Profile Photo</h5>
                  <p className="text-muted small mb-2">
                    Square image (1:1 ratio) recommended — 400×400px. JPG or PNG under 2MB.
                  </p>
                  <div className="d-flex flex-wrap gap-2">
                    <label
                      htmlFor="avatarInput"
                      className="btn btn-sm btn-primary text-white fw-semibold"
                    >
                      {uploadingPic ? 'Uploading...' : 'Upload New Photo'}
                    </label>
                    {profilePicture && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger text-white fw-semibold"
                        onClick={handleRemoveProfilePicture}
                        disabled={uploadingPic}
                      >
                        <i className="bi bi-trash3 me-1"></i>Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 1: BASIC INFORMATION (Direct Save to MySQL) */}
            <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '16px' }}>
              <div className="border-bottom pb-3 mb-3">
                <h5 className="fw-bold text-dark mb-1">Personal Profile Information</h5>
                <p className="text-muted small mb-0">Update your basic details directly in the system.</p>
              </div>

              <form onSubmit={handleSaveBasicProfile}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">First Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Middle Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="(Optional)"
                      value={profileForm.middleName}
                      onChange={(e) => setProfileForm({ ...profileForm, middleName: e.target.value })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Last Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Phone / Contact Number *</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={profileForm.contact}
                      onChange={(e) => setProfileForm({ ...profileForm, contact: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Gender</label>
                    <select
                      className="form-select"
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">City</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">Province</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileForm.province}
                      onChange={(e) => setProfileForm({ ...profileForm, province: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                  <LoadingButton
                    type="submit"
                    className="btn btn-pcc-primary text-white fw-bold px-4 py-2"
                    isLoading={saving}
                    loadingText="Saving Changes..."
                  >
                    Save Profile Details
                  </LoadingButton>
                </div>
              </form>
            </div>

            {/* CARD 2: EMAIL SETTINGS (Locked - Requires 2-Step OTP Verification) */}
            <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '16px' }}>
              <div className="border-bottom pb-3 mb-3">
                <h5 className="fw-bold text-dark mb-1">Email Address Settings (OTP Required)</h5>
                <p className="text-muted small mb-0">Email modification requires 2-step OTP verification to confirm identity and ownership.</p>
              </div>

              <div className="p-3 bg-light rounded border d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="text-muted small">Registered Email Address:</div>
                  <strong className="text-dark fs-6">{currentEmail}</strong>
                </div>
                <span className="badge bg-secondary text-white px-2.5 py-1.5">Verified</span>
              </div>

              <LoadingButton
                type="button"
                className="btn btn-pcc-primary text-white fw-bold w-100 py-2.5"
                onClick={handleStartEmailChange}
                isLoading={emailProcessing}
                loadingText="Sending Verification OTP..."
              >
                Change Email Address (Requires 2-Step OTP)
              </LoadingButton>
            </div>

            {/* CARD 3: PASSWORD & SECURITY (Locked - Requires OTP) */}
            <div className="card shadow-sm border-0 p-4 bg-white mb-4" style={{ borderRadius: '16px' }}>
              <div className="border-bottom pb-3 mb-3">
                <h5 className="fw-bold text-dark mb-1">Password & Account Security</h5>
                <p className="text-muted small mb-0">Password updates require OTP verification sent to your current email.</p>
              </div>

              <LoadingButton
                type="button"
                className="btn btn-danger text-white fw-bold w-100 py-2.5 shadow-sm"
                onClick={handleStartPasswordChange}
                isLoading={passwordProcessing}
                loadingText="Sending Password OTP..."
              >
                Change Account Password (Required OTP)
              </LoadingButton>
            </div>
          </div>
        )}
      </div>

      {/* EMAIL CHANGE WORKFLOW MODAL */}
      {emailStep > 0 && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 p-3" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-pcc-blue">Email Change — Step {emailStep} of 3</h5>
                <button type="button" className="btn-close" onClick={() => setEmailStep(0)}></button>
              </div>
              <div className="modal-body py-3">
                {/* STEP 1: Verify Current Email OTP */}
                {emailStep === 1 && (
                  <form onSubmit={handleVerifyCurrentEmailOtp}>
                    <p className="text-muted small mb-3">
                      We sent a 6-digit OTP code to your current email: <strong>{currentEmail}</strong>. Please enter it below to confirm your identity.
                    </p>
                    <div className="mb-3">
                      <label className="form-label fw-bold small">Current Email OTP Code *</label>
                      <input
                        type="text"
                        className="form-control text-center fw-bold fs-5"
                        placeholder="123456"
                        maxLength={6}
                        value={currentEmailOtp}
                        onChange={(e) => setCurrentEmailOtp(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-danger text-white w-50 fw-bold" onClick={() => setEmailStep(0)}>Cancel</button>
                      <LoadingButton
                        type="submit"
                        className="btn btn-primary text-white fw-bold w-50"
                        isLoading={emailProcessing}
                        loadingText="Verifying..."
                      >
                        Next Step
                      </LoadingButton>
                    </div>
                  </form>
                )}

                {/* STEP 2: Enter Proposed New Email */}
                {emailStep === 2 && (
                  <form onSubmit={handleRequestNewEmailOtp}>
                    <p className="text-muted small mb-3">
                      Current identity verified! Enter your proposed <strong>new email address</strong>. We will send a second verification OTP to this new address.
                    </p>
                    <div className="mb-3">
                      <label className="form-label fw-bold small">New Email Address *</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="new.email@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-danger text-white w-50 fw-bold" onClick={() => setEmailStep(0)}>Cancel</button>
                      <LoadingButton
                        type="submit"
                        className="btn btn-primary text-white fw-bold w-50"
                        isLoading={emailProcessing}
                        loadingText="Sending..."
                      >
                        Send OTP to New Email
                      </LoadingButton>
                    </div>
                  </form>
                )}

                {/* STEP 3: Verify New Email OTP */}
                {emailStep === 3 && (
                  <form onSubmit={handleVerifyNewEmailOtp}>
                    <p className="text-muted small mb-3">
                      We sent a 6-digit verification code to your new email: <strong>{newEmail}</strong>. Enter it below to complete the update.
                    </p>
                    <div className="mb-3">
                      <label className="form-label fw-bold small">New Email OTP Code *</label>
                      <input
                        type="text"
                        className="form-control text-center fw-bold fs-5"
                        placeholder="123456"
                        maxLength={6}
                        value={newEmailOtp}
                        onChange={(e) => setNewEmailOtp(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-danger text-white w-50 fw-bold" onClick={() => setEmailStep(0)}>Cancel</button>
                      <LoadingButton
                        type="submit"
                        className="btn btn-success text-white fw-bold w-50"
                        isLoading={emailProcessing}
                        loadingText="Updating..."
                      >
                        Confirm & Update Email
                      </LoadingButton>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD CHANGE WORKFLOW MODAL */}
      {passwordStep === 1 && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 p-3" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger">Password Reset via Email OTP</h5>
                <button type="button" className="btn-close" onClick={() => setPasswordStep(0)}></button>
              </div>
              <div className="modal-body py-3">
                <form onSubmit={handleVerifyPasswordChange}>
                  <p className="text-muted small mb-3">
                    We sent a 6-digit security OTP to: <strong>{currentEmail}</strong>.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-bold small">Email OTP Code *</label>
                    <input
                      type="text"
                      className="form-control text-center fw-bold fs-5"
                      placeholder="123456"
                      maxLength={6}
                      value={passwordOtp}
                      onChange={(e) => setPasswordOtp(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small">New Password (Min 6 chars) *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small">Confirm New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-flex gap-2 pt-2">
                    <button type="button" className="btn btn-danger text-white w-50 fw-bold" onClick={() => setPasswordStep(0)}>Cancel</button>
                    <LoadingButton
                      type="submit"
                      className="btn btn-danger text-white fw-bold w-50"
                      isLoading={passwordProcessing}
                      loadingText="Resetting..."
                    >
                      Update Password
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
