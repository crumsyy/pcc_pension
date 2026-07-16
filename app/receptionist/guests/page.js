'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistGuests() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editGuest, setEditGuest] = useState(null); // guest object being edited
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male',
    city: '',
    province: ''
  });

  // Custom Modal dialog state
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'OK',
    cancelText: 'Cancel'
  });

  const showAlert = (type, title, message) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
      onCancel: null
    });
  };

  const showConfirm = (title, message, onConfirmCallback) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirmCallback();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/receptionist/guests?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch guests');
      setGuests(data.guests || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [search]);

  const handleEditClick = (g) => {
    setEditGuest(g);
    setEditForm({
      firstName: g.firstName || '',
      lastName: g.lastName || '',
      contact: g.contact || '',
      email: g.email || '',
      gender: g.gender || 'Male',
      city: g.city || '',
      province: g.province || ''
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    showConfirm('Update Guest Profile', 'Are you sure you want to update this guest profile?', async () => {
      try {
        const res = await fetch('/api/receptionist/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            guestID: editGuest.guestID,
            ...editForm
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update guest details');

        showAlert('success', 'Success', 'Guest profile updated successfully.');
        setEditGuest(null);
        fetchGuests();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Management</h2>
            <p className="text-muted mb-0">View registered guest accounts and manage walk-in records.</p>
          </div>
        </div>

        <div className="card shadow-sm border-0" style={{ borderRadius: '8px' }}>
          <div className="card-header bg-white py-3 border-0">
            <div className="row g-2 align-items-center">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name, contact or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ borderRadius: '20px', paddingLeft: '15px' }}
                />
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="px-4">Name</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Gender</th>
                    <th>Location</th>
                    <th>Account Type</th>
                    <th className="text-end px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">
                        <div className="spinner-border text-pcc-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : guests.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        No guest records found.
                      </td>
                    </tr>
                  ) : (
                    guests.map(g => (
                      <tr key={g.guestID}>
                        <td className="px-4 fw-bold text-dark">
                          {g.lastName}, {g.firstName} {g.middleName ? `${g.middleName.charAt(0)}.` : ''}
                        </td>
                        <td>{g.contact || '—'}</td>
                        <td>{g.email || '—'}</td>
                        <td>
                          <span className={`badge rounded-pill ${g.gender === 'Male' ? 'bg-primary-subtle text-primary' : g.gender === 'Female' ? 'bg-danger-subtle text-danger' : 'bg-secondary-subtle text-secondary'}`} style={{ padding: '0.45em 0.8em' }}>
                            {g.gender || 'Not Specified'}
                          </span>
                        </td>
                        <td>
                          {g.city || g.province ? `${g.city || ''}, ${g.province || ''}`.replace(/^, |, $/, '') : '—'}
                        </td>
                        <td>
                          {g.userID ? (
                            <span className="badge bg-success text-white">Registered Account</span>
                          ) : (
                            <span className="badge bg-info text-white">Walk-In (No Account)</span>
                          )}
                        </td>
                        <td className="text-end px-4">
                          <button
                            className="btn btn-sm btn-pcc-primary text-white d-inline-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px' }}
                            title="Edit Guest Details"
                            onClick={() => handleEditClick(g)}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editGuest && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Edit Guest Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditGuest(null)}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">First Name *</label>
                      <input
                        type="text"
                        name="firstName"
                        className="form-control"
                        required
                        value={editForm.firstName}
                        onChange={handleEditInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Last Name *</label>
                      <input
                        type="text"
                        name="lastName"
                        className="form-control"
                        required
                        value={editForm.lastName}
                        onChange={handleEditInputChange}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contact Number</label>
                    <input
                      type="text"
                      name="contact"
                      className="form-control"
                      value={editForm.contact}
                      onChange={handleEditInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={editForm.email}
                      onChange={handleEditInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Gender</label>
                    <select
                      name="gender"
                      className="form-select"
                      value={editForm.gender}
                      onChange={handleEditInputChange}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">City</label>
                      <input
                        type="text"
                        name="city"
                        className="form-control"
                        value={editForm.city}
                        onChange={handleEditInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Province</label>
                      <input
                        type="text"
                        name="province"
                        className="form-control"
                        value={editForm.province}
                        onChange={handleEditInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-pcc-primary text-white">Save Changes</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setEditGuest(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Alert dialog */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </>
  );
}
