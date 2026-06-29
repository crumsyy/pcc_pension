'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function UsersClient() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserID, setCurrentUserID] = useState(null);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view' | 'edit' | null
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
    newPassword: '', // For password reset inside Edit Modal
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

  // Fetch users on load & filter changes
  const fetchUsers = async () => {
    setLoading(true);
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
      if (data.currentUser) {
        setCurrentUserID(data.currentUser.userID);
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
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

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      showAlert('error', 'Validation Error', 'First Name and Last Name are required.');
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      showAlert('error', 'Validation Error', 'A valid Email Address is required.');
      return;
    }
    if (!/^\d{11}$/.test(formData.contact)) {
      showAlert('error', 'Validation Error', 'Contact Number must be exactly 11 digits.');
      return;
    }
    if (formData.password.length < 8) {
      showAlert('error', 'Validation Error', 'Password must be at least 8 characters long.');
      return;
    }

    showConfirm('Create Account', 'Create this new user/staff account?', async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData,
            firstName: formData.firstName.trim(),
            middleName: formData.middleName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');

        showAlert('success', 'Success', data.message || 'Staff created successfully');
        setActiveModal(null);
        fetchUsers();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      showAlert('error', 'Validation Error', 'First Name and Last Name are required.');
      return;
    }
    if (!/^\d{11}$/.test(formData.contact)) {
      showAlert('error', 'Validation Error', 'Contact Number must be exactly 11 digits.');
      return;
    }
    if (formData.newPassword && formData.newPassword.length < 8) {
      showAlert('error', 'Validation Error', 'New password must be at least 8 characters long.');
      return;
    }

    showConfirm('Update Account', 'Save changes to this user account?', async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit',
            userID: selectedUser.userID,
            staffID: selectedUser.staffID,
            guestID: selectedUser.guestID,
            ...formData,
            firstName: formData.firstName.trim(),
            middleName: formData.middleName.trim(),
            lastName: formData.lastName.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');

        showAlert('success', 'Success', data.message || 'Account updated successfully');
        setActiveModal(null);
        fetchUsers();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleToggleStatus = (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    showConfirm(
      'Toggle Status',
      `Are you sure you want to set this user status to ${newStatus}?`,
      async () => {
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

          showAlert('success', 'Success', data.message);
          fetchUsers();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
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
      newPassword: '',
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
      newPassword: '', // Clear newPassword field
    });
    setActiveModal('edit');
  };

  return (
    <div>
      {/* Custom Modal Dialog */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">User Management</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          + Create User
        </button>
      </div>

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
                  users.map((u, i) => {
                    const isSelf = u.userID === currentUserID;
                    return (
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
                              className="btn btn-sm btn-primary text-white"
                              onClick={() => openViewModal(u)}
                            >
                              View
                            </button>
                            <button
                              className="btn btn-sm btn-warning text-white"
                              onClick={() => openEditModal(u)}
                            >
                              Update
                            </button>
                            <button
                              className={`btn btn-sm text-white ${
                                u.status === 'Active'
                                  ? 'btn-danger'
                                  : 'btn-success'
                              }`}
                              onClick={() => handleToggleStatus(u)}
                              disabled={isSelf && u.status === 'Active'}
                              title={isSelf && u.status === 'Active' ? "You cannot deactivate your own account." : ""}
                              style={{ opacity: isSelf && u.status === 'Active' ? 0.6 : 1 }}
                            >
                              {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                  <button type="submit" className="btn btn-pcc-primary text-white">Create User</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
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
                <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Close</button>
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
                    {/* Integrated Reset Password directly in Update Modal */}
                    <div className="col-md-6">
                      <label className="form-label">Reset Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        name="newPassword"
                        className="form-control"
                        minLength="8"
                        placeholder="Enter new password to reset"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Update User</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
