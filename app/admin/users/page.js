'use client';

import { useState, useEffect } from 'react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view' | 'edit' | 'reset' | null
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: '',
    dob: '',
    city: '',
    province: '',
    contact: '',
    roleID: '',
    email: '',
    password: '',
  });

  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Fetch users on load & filter changes
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        search,
        role: roleFilter,
        status: statusFilter,
      }).toString();
      
      const res = await fetch(`/api/admin/users?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      
      setUsers(data.users || []);
      setRoles(data.roles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const showToast = (msg, isSuccess = true) => {
    if (isSuccess) {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!confirm('Create this staff account?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showToast(data.message || 'Staff created successfully');
      setActiveModal(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!confirm('Save changes to this user account?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          userID: selectedUser.userID,
          staffID: selectedUser.staffID,
          guestID: selectedUser.guestID,
          ...formData
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast(data.message || 'Account updated successfully');
      setActiveModal(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    if (!confirm(`Are you sure you want to set this user status to ${newStatus}?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_status',
          userID: user.userID,
          newStatus
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      showToast(data.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!confirm('Reset password for this user?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          userID: selectedUser.userID,
          newPassword: resetPasswordVal
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      showToast(data.message);
      setActiveModal(null);
      setResetPasswordVal('');
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      dob: '',
      city: '',
      province: '',
      contact: '',
      roleID: '',
      email: '',
      password: '',
    });
    setActiveModal('create');
  };

  const openViewModal = (user) => {
    setSelectedUser(user);
    setActiveModal('view');
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      gender: user.gender || 'Male',
      dob: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : '',
      city: user.city || '',
      province: user.province || '',
      contact: user.contact || '',
      roleID: user.roleID || '',
      status: user.status || 'Active',
    });
    setActiveModal('edit');
  };

  const openResetModal = (user) => {
    setSelectedUser(user);
    setResetPasswordVal('');
    setActiveModal('reset');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">User Management</h2>
        </div>
        <button className="btn btn-pcc-primary" onClick={openCreateModal}>
          + Create User
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.roleID} value={r.role}>
                  {r.role}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <tr key={u.userID}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>
                          {`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}
                        </strong>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.contact || '—'}</td>
                      <td>
                        <span className="badge text-bg-secondary">{u.role}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.status === 'Active' ? 'text-bg-success' : 'text-bg-warning'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {new Date(u.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openViewModal(u)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => openEditModal(u)}
                          >
                            Update
                          </button>
                          <button
                            className={`btn btn-sm ${
                              u.status === 'Active'
                                ? 'btn-outline-warning'
                                : 'btn-outline-success'
                            }`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => openResetModal(u)}
                          >
                            Reset PW
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==========================================
          MODALS
          ========================================== */}

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create User</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">First Name *</label>
                      <input type="text" name="firstName" className="form-control" required value={formData.firstName} onChange={handleInputChange} placeholder="Juan" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Middle Name</label>
                      <input type="text" name="middleName" className="form-control" value={formData.middleName} onChange={handleInputChange} placeholder="(Optional)" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Last Name *</label>
                      <input type="text" name="lastName" className="form-control" required value={formData.lastName} onChange={handleInputChange} placeholder="Dela Cruz" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Gender *</label>
                      <select name="gender" className="form-select" required value={formData.gender} onChange={handleInputChange}>
                        <option value="" disabled>Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date of Birth *</label>
                      <input type="date" name="dob" className="form-control" required value={formData.dob} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">City *</label>
                      <input type="text" name="city" className="form-control" required value={formData.city} onChange={handleInputChange} placeholder="Koronadal" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Province *</label>
                      <input type="text" name="province" className="form-control" required value={formData.province} onChange={handleInputChange} placeholder="South Cotabato" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Contact Number *</label>
                      <input type="text" name="contact" className="form-control" maxLength="11" required value={formData.contact} onChange={handleInputChange} placeholder="09XXXXXXXXX" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Role *</label>
                      <select name="roleID" className="form-select" required value={formData.roleID} onChange={handleInputChange}>
                        <option value="" disabled>Select role</option>
                        {roles.map(r => (
                          <option key={r.roleID} value={r.roleID}>{r.role}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email Address *</label>
                      <input type="email" name="email" className="form-control" required value={formData.email} onChange={handleInputChange} placeholder="staff@email.com" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Password *</label>
                      <input type="password" name="password" className="form-control" minLength="8" required value={formData.password} onChange={handleInputChange} placeholder="Min. 8 characters" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Create User</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {activeModal === 'view' && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">👤 User Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <div className="modal-body">
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted" style={{ width: '35%' }}>Full Name</td>
                      <td><strong>{`${selectedUser.firstName || ''} ${selectedUser.middleName || ''} ${selectedUser.lastName || ''}`.trim() || '—'}</strong></td>
                    </tr>
                    <tr><td className="text-muted">Email</td><td>{selectedUser.email}</td></tr>
                    <tr><td className="text-muted">Contact</td><td>{selectedUser.contact || '—'}</td></tr>
                    <tr><td className="text-muted">Gender</td><td>{selectedUser.gender || '—'}</td></tr>
                    <tr>
                      <td className="text-muted">Date of Birth</td>
                      <td>
                        {selectedUser.dateOfBirth
                          ? new Date(selectedUser.dateOfBirth).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                    <tr><td className="text-muted">City</td><td>{selectedUser.city || '—'}</td></tr>
                    <tr><td className="text-muted">Province</td><td>{selectedUser.province || '—'}</td></tr>
                    <tr><td className="text-muted">Role</td><td><span className="badge text-bg-secondary">{selectedUser.role}</span></td></tr>
                    <tr>
                      <td className="text-muted">Status</td>
                      <td>
                        <span className={`badge ${selectedUser.status === 'Active' ? 'text-bg-success' : 'text-bg-warning'}`}>
                          {selectedUser.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Joined</td>
                      <td>
                        {new Date(selectedUser.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update User</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">First Name *</label>
                      <input type="text" name="firstName" className="form-control" required value={formData.firstName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Middle Name</label>
                      <input type="text" name="middleName" className="form-control" value={formData.middleName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Last Name *</label>
                      <input type="text" name="lastName" className="form-control" required value={formData.lastName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Gender *</label>
                      <select name="gender" className="form-select" required value={formData.gender} onChange={handleInputChange}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date of Birth *</label>
                      <input type="date" name="dob" className="form-control" required value={formData.dob} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">City *</label>
                      <input type="text" name="city" className="form-control" required value={formData.city} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Province *</label>
                      <input type="text" name="province" className="form-control" required value={formData.province} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Contact Number *</label>
                      <input type="text" name="contact" className="form-control" maxLength="11" required value={formData.contact} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Role *</label>
                      {selectedUser.role === 'Guest' ? (
                        <input type="text" className="form-control" value="Guest" disabled />
                      ) : (
                        <select name="roleID" className="form-select" required value={formData.roleID} onChange={handleInputChange}>
                          {roles.filter(r => r.role !== 'Guest').map(r => (
                            <option key={r.roleID} value={r.roleID}>{r.role}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Status *</label>
                      <select name="status" className="form-select" required value={formData.status} onChange={handleInputChange}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Update User</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {activeModal === 'reset' && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">🔑 Reset Password</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleResetPasswordSubmit}>
                <div className="modal-body">
                  <p className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>
                    Reset password for <strong>{`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`}</strong> ({selectedUser.email})
                  </p>
                  <div className="mb-3">
                    <label className="form-label">New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      minLength="8"
                      required
                      placeholder="Min. 8 characters"
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Reset Password</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
