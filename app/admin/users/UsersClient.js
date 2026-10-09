'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import AdminPagination from '../../components/AdminPagination';
import FlatDatePicker from '../../components/FlatDatePicker';
import ProvinceCityInputs from '../../components/ProvinceCityInputs';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import { isKnownProvince, isCityInProvince } from '@/lib/phLocations';
import { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';

function toPublicUserCode(userID, role) {
  const id = parseInt(userID, 10);
  const prefix = role === 'Guest' ? 'GST' : 'STF';
  if (isNaN(id)) return `${prefix}-XXXXXX`;
  const hashed = ((id * 2654435761) >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `${prefix}-${hashed}`;
}

function roleBadgeClass(role) {
  if (role === 'Administrator') return 'text-bg-primary';
  if (role === 'Receptionist') return 'text-bg-success';
  return 'text-bg-secondary';
}

const USERS_PAGE_SIZE = 10;

// Users must be 18+ : latest allowed birthdate is today minus 18 years.
const adultCutoff = (() => {
  const t = new Date();
  return new Date(t.getFullYear() - 18, t.getMonth(), t.getDate());
})();
const pad2 = (n) => String(n).padStart(2, '0');
const maxDobSlash = `${pad2(adultCutoff.getMonth() + 1)}/${pad2(adultCutoff.getDate())}/${adultCutoff.getFullYear()}`;
const maxDobDb = `${adultCutoff.getFullYear()}-${pad2(adultCutoff.getMonth() + 1)}-${pad2(adultCutoff.getDate())}`;
function isAtLeast18(dobUi) {
  if (!dobUi) return false;
  const db = toDbDate(dobUi);
  return Boolean(db) && db <= maxDobDb;
}

export default function UsersClient() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'guests'

  const baseCacheKey = `admin-users:${roleFilter}_${statusFilter}`;
  const cached = clientCache.get(baseCacheKey);
  const [users, setUsers] = useState(cached?.data?.users || []);
  const [roles, setRoles] = useState(cached?.data?.roles || []);
  const [currentUserID, setCurrentUserID] = useState(cached?.data?.currentUserID || null);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view' | 'edit' | 'suspend' | null
  const [createKind, setCreateKind] = useState('staff'); // 'staff' | 'guest', captured when the create modal opens
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Suspension Modal states
  const [suspendDays, setSuspendDays] = useState('3');
  const [suspendRemarks, setSuspendRemarks] = useState('');
  const [suspendUser, setSuspendUser] = useState(null);
  const [suspendReason, setSuspendReason] = useState('Violated guest terms of service / misconduct');

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
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
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
      onConfirm: async () => {
        try {
          await onConfirmCallback();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Fetch users on load & filter changes
  const fetchUsers = async (isBackground = false) => {
    try {
      const query = new URLSearchParams({
        role: roleFilter,
        status: statusFilter,
      }).toString();
      
      const res = await fetch(`/api/admin/users?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      
      const usersData = data.users || [];
      const rolesData = data.roles || [];
      const currentUid = data.currentUser ? data.currentUser.userID : null;

      setUsers(usersData);
      setRoles(rolesData);
      if (currentUid) setCurrentUserID(currentUid);

      clientCache.set(baseCacheKey, {
        users: usersData,
        roles: rolesData,
        currentUserID: currentUid
      }, CACHE_TTL.USERS);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
      else console.warn('Background users refresh error:', err.message);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchUsers(false);
    } else {
      setUsers(entry.data.users || []);
      setRoles(entry.data.roles || []);
      if (entry.data.currentUserID) setCurrentUserID(entry.data.currentUserID);
      if (entry.isStale) {
        fetchUsers(true);
      }
    }
  }, [roleFilter, statusFilter]);

  const handleSearchChange = (v) => { setSearch(v); setPage(1); };
  const handleRoleFilterChange = (v) => { setRoleFilter(v); setPage(1); };
  const handleStatusFilterChange = (v) => { setStatusFilter(v); setPage(1); };
  const handleTabChange = (key) => { setActiveTab(key === 'guests' ? 'guests' : 'staff'); setSearch(''); setRoleFilter(''); setPage(1); };
  const handleClearFilters = () => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); };

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
    const nameRegex = /^[A-Za-z\s.\-]+$/;
    if (!nameRegex.test(formData.firstName.trim())) {
      showAlert('error', 'Validation Error', 'First Name cannot contain numbers or special characters.');
      return;
    }
    if (!nameRegex.test(formData.lastName.trim())) {
      showAlert('error', 'Validation Error', 'Last Name cannot contain numbers or special characters.');
      return;
    }
    if (formData.middleName.trim() && !nameRegex.test(formData.middleName.trim())) {
      showAlert('error', 'Validation Error', 'Middle Name cannot contain numbers or special characters.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      showAlert('error', 'Validation Error', 'A valid, real Email Address is required.');
      return;
    }
    if (!/^\d{11}$/.test(formData.contact)) {
      showAlert('error', 'Validation Error', 'Contact Number must be exactly 11 digits.');
      return;
    }
    if (!formData.dob || !isValidDate(formData.dob)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Date of Birth (MM/DD/YYYY).');
      return;
    }
    if (!isAtLeast18(formData.dob)) {
      showAlert('error', 'Validation Error', 'User must be at least 18 years old.');
      return;
    }
    if (!isKnownProvince(formData.province)) {
      showAlert('error', 'Validation Error', 'Please select a valid Province from the suggestions.');
      return;
    }
    if (!isCityInProvince(formData.city, formData.province)) {
      showAlert('error', 'Validation Error', 'Please select a valid City / Municipality for the chosen province.');
      return;
    }
    if (formData.password.length < 8) {
      showAlert('error', 'Validation Error', 'Password must be at least 8 characters long.');
      return;
    }
    const createRole = roles.find((r) => String(r.roleID) === String(formData.roleID));
    if (createKind === 'guest') {
      if (!createRole || createRole.role !== 'Guest') {
        showAlert('error', 'Validation Error', 'Guest accounts must use the Guest role.');
        return;
      }
    } else if (!createRole || createRole.role === 'Guest') {
      showAlert('error', 'Validation Error', 'Only Administrator or Receptionist accounts can be created here.');
      return;
    }

    showConfirm(createKind === 'guest' ? 'Create Guest' : 'Create Staff', createKind === 'guest' ? 'Create this new guest account?' : 'Create this new staff account?', async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData,
            dob: toDbDate(formData.dob),
            firstName: formData.firstName.trim(),
            middleName: formData.middleName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');

        showAlert('success', 'Success', data.message || (createKind === 'guest' ? 'Guest created successfully' : 'Staff created successfully'));
        setActiveModal(null);
        clientCache.invalidate('admin-users');
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
    const nameRegex = /^[A-Za-z\s.\-]+$/;
    if (!nameRegex.test(formData.firstName.trim())) {
      showAlert('error', 'Validation Error', 'First Name cannot contain numbers or special characters.');
      return;
    }
    if (!nameRegex.test(formData.lastName.trim())) {
      showAlert('error', 'Validation Error', 'Last Name cannot contain numbers or special characters.');
      return;
    }
    if (formData.middleName.trim() && !nameRegex.test(formData.middleName.trim())) {
      showAlert('error', 'Validation Error', 'Middle Name cannot contain numbers or special characters.');
      return;
    }
    if (!/^\d{11}$/.test(formData.contact)) {
      showAlert('error', 'Validation Error', 'Contact Number must be exactly 11 digits.');
      return;
    }
    if (!formData.dob || !isValidDate(formData.dob)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Date of Birth (MM/DD/YYYY).');
      return;
    }
    if (!isAtLeast18(formData.dob)) {
      showAlert('error', 'Validation Error', 'User must be at least 18 years old.');
      return;
    }
    if (!isKnownProvince(formData.province)) {
      showAlert('error', 'Validation Error', 'Please select a valid Province from the suggestions.');
      return;
    }
    if (!isCityInProvince(formData.city, formData.province)) {
      showAlert('error', 'Validation Error', 'Please select a valid City / Municipality for the chosen province.');
      return;
    }
    if (formData.newPassword && formData.newPassword.length < 8) {
      showAlert('error', 'Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    const editRole = roles.find((r) => String(r.roleID) === String(formData.roleID));
    if (!editRole || editRole.role === 'Guest') {
      showAlert('error', 'Validation Error', 'Only Administrator or Receptionist roles are allowed here.');
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
            dob: toDbDate(formData.dob),
            firstName: formData.firstName.trim(),
            middleName: formData.middleName.trim(),
            lastName: formData.lastName.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update user');

        showAlert('success', 'Success', data.message || 'Account updated successfully');
        setActiveModal(null);
        clientCache.invalidate('admin-users');
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
          clientCache.invalidate('admin-users');
          fetchUsers();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };



  const openSuspendModal = (user) => {
    setSuspendUser(user);
    setSuspendDays('3');
    setSuspendRemarks('');
    setSuspendReason('Violated guest terms of service / misconduct');
    setActiveModal('suspend');
  };

  const handleSuspendSubmit = async (e) => {
    e.preventDefault();
    if (!suspendDays || parseInt(suspendDays) <= 0) {
      showAlert('error', 'Validation Error', 'Please enter a valid number of days.');
      return;
    }
    showConfirm('Suspend Account', `Are you sure you want to suspend this user for ${suspendDays} days?`, async () => {
      try {
        const finalRemarks = suspendReason === 'Other'
          ? suspendRemarks.trim()
          : `${suspendReason}${suspendRemarks.trim() ? ': ' + suspendRemarks.trim() : ''}`;

        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'suspend',
            userID: suspendUser.userID,
            days: suspendDays,
            remarks: finalRemarks
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to suspend user');
        showAlert('success', 'Success', data.message);
        setActiveModal(null);
        clientCache.invalidate('admin-users');
        fetchUsers();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openCreateModal = () => {
    const kind = activeTab === 'guests' ? 'guest' : 'staff';
    setCreateKind(kind);
    const guestRole = roles.find((r) => r.role === 'Guest');
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      dob: '',
      city: '',
      province: '',
      contact: '',
      roleID: kind === 'guest' && guestRole ? String(guestRole.roleID) : '',
      email: '',
      password: '',
      newPassword: '',
    });
    setShowCreatePassword(false);
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
      dob: user.dateOfBirth ? toUiDate(user.dateOfBirth) : '',
      city: user.city || '',
      province: user.province || '',
      contact: user.contact || '',
      roleID: user.roleID || '',
      status: user.status || 'Active',
      newPassword: '', // Clear newPassword field
    });
    setShowEditPassword(false);
    setActiveModal('edit');
  };

  const staffRoles = roles.filter((r) => r.role !== 'Guest');
  const staffUsers = users.filter((u) => u.role !== 'Guest');
  const guestUsers = users.filter((u) => u.role === 'Guest');
  const tabUsers = activeTab === 'guests' ? guestUsers : staffUsers;
  const tabRoleOptions = activeTab === 'guests' ? roles.filter((r) => r.role === 'Guest') : staffRoles;
  const searchedUsers = tabUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const code = toPublicUserCode(u.userID, u.role).toLowerCase();
    const fullName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''}`.toLowerCase();
    return (
      fullName.includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      code.includes(q) ||
      code.replace('-', '').includes(q.replace(/-/g, ''))
    );
  });
  const totalPages = Math.max(1, Math.ceil(searchedUsers.length / USERS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = searchedUsers.slice((safePage - 1) * USERS_PAGE_SIZE, safePage * USERS_PAGE_SIZE);
  const pageStart = searchedUsers.length === 0 ? 0 : (safePage - 1) * USERS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * USERS_PAGE_SIZE, searchedUsers.length);

  return (
    <div className="pcc-page-container users-compact pcc-content-reveal">
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

      <div className="d-flex justify-content-between align-items-center mb-2">
        {/* Staffs / Guests tabs */}
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <TabList aria-label="User types">
            <Tab id="staff">Staffs</Tab>
            <Tab id="guests">Guests</Tab>
          </TabList>
        </Tabs>
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          {activeTab === 'guests' ? '+ Create Guest' : '+ Create Staff'}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className={activeTab === 'guests' ? 'col-md-7' : 'col-md-4'}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, email, or User ID..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          {activeTab !== 'guests' && (
          <div className="col-md-3">
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
            >
              <option value="">All Roles</option>
              {tabRoleOptions.map((r) => (
                <option key={r.roleID} value={r.role}>
                  {r.role}
                </option>
              ))}
            </select>
          </div>
          )}
          <div className="col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'max(200px, calc(100vh - 300px))', overflowY: 'auto' }}>
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>User ID</th>
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
                {searchedUsers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map((u, i) => {
                    const isSelf = u.userID === currentUserID;
                    return (
                      <tr key={u.userID}>
                        <td><strong className="text-pcc-blue">{toPublicUserCode(u.userID, u.role)}</strong></td>
                        <td>
                          <strong>
                            {u.middleName ? `${u.firstName} ${u.middleName.charAt(0).toUpperCase()}. ${u.lastName}` : `${u.firstName} ${u.lastName}`}
                          </strong>
                        </td>
                        <td>{u.email}</td>
                        <td>{u.contact || '—'}</td>
                        <td>
                          <span className={`badge ${roleBadgeClass(u.role)}`}>{u.role}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              u.status === 'Active' ? 'text-bg-success' :
                              u.status === 'Suspended' ? 'text-bg-danger' : 'text-bg-secondary'
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
                          <ActionButtons
                            onView={() => openViewModal(u)}
                            onEdit={() => openEditModal(u)}
                            onSuspend={() => openSuspendModal(u)}
                            onDeactivate={u.status === 'Active' ? () => handleToggleStatus(u) : null}
                            onActivate={u.status !== 'Active' ? () => handleToggleStatus(u) : null}
                            status={u.status}
                            isSelf={isSelf}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={safePage}
            totalPages={totalPages}
            onPage={setPage}
            start={pageStart}
            end={pageEnd}
            total={searchedUsers.length}
            label="users"
            ariaLabel="Users pagination"
          />
      </div>

      {/* ==========================================
          MODALS
          ========================================== */}
      {activeModal && (
        <ModalPortal>
          {/* CREATE MODAL */}
          {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">{createKind === 'guest' ? 'Create Guest' : 'Create Staff'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">First Name <span className="required-asterisk">*</span></label>
                      <input type="text" name="firstName" className="form-control" required value={formData.firstName} onChange={handleInputChange} placeholder="Juan" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Middle Name</label>
                      <input type="text" name="middleName" className="form-control" value={formData.middleName} onChange={handleInputChange} placeholder="(Optional)" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Last Name <span className="required-asterisk">*</span></label>
                      <input type="text" name="lastName" className="form-control" required value={formData.lastName} onChange={handleInputChange} placeholder="Dela Cruz" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Gender <span className="required-asterisk">*</span></label>
                      <select name="gender" className="form-select" required value={formData.gender} onChange={handleInputChange}>
                        <option value="" disabled>Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date of Birth <span className="required-asterisk">*</span></label>
                      <FlatDatePicker name="dob" className="form-control" required value={formData.dob} onChange={handleInputChange} dateFormat="m/d/Y" max={maxDobSlash} />
                    </div>
                    <ProvinceCityInputs
                      idPrefix="create-loc"
                      province={formData.province}
                      city={formData.city}
                      onChange={handleInputChange}
                      required
                    />
                    <div className="col-md-6">
                      <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
                      <input type="text" name="contact" className="form-control" maxLength="11" required value={formData.contact} onChange={handleInputChange} placeholder="09XXXXXXXXX" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Role <span className="required-asterisk">*</span></label>
                      {createKind === 'guest' ? (
                        <input type="text" className="form-control" value="Guest" disabled />
                      ) : (
                      <select name="roleID" className="form-select" required value={formData.roleID} onChange={handleInputChange}>
                        <option value="" disabled>Select role</option>
                        {staffRoles.map(r => (
                          <option key={r.roleID} value={r.roleID}>{r.role}</option>
                        ))}
                      </select>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email Address <span className="required-asterisk">*</span></label>
                      <input type="email" name="email" className="form-control" required value={formData.email} onChange={handleInputChange} placeholder="staff@email.com" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Password <span className="required-asterisk">*</span></label>
                      <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showCreatePassword ? "text" : "password"}
                          name="password"
                          className="form-control"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleInputChange}
                          style={{ paddingRight: '2.8rem', flex: '1' }}
                          required
                          minLength="8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatePassword(!showCreatePassword)}
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
                          {showCreatePassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">{createKind === 'guest' ? 'Create Guest' : 'Create Staff'}</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {activeModal === 'view' && selectedUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
                      <td className="text-muted" style={{ width: '35%' }}>User ID</td>
                      <td><strong className="text-pcc-blue">{toPublicUserCode(selectedUser.userID, selectedUser.role)}</strong></td>
                    </tr>
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
                    <tr><td className="text-muted">Role</td><td><span className={`badge ${roleBadgeClass(selectedUser.role)}`}>{selectedUser.role}</span></td></tr>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
                      <label className="form-label">First Name <span className="required-asterisk">*</span></label>
                      <input type="text" name="firstName" className="form-control" required value={formData.firstName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Middle Name</label>
                      <input type="text" name="middleName" className="form-control" value={formData.middleName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Last Name <span className="required-asterisk">*</span></label>
                      <input type="text" name="lastName" className="form-control" required value={formData.lastName} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Gender <span className="required-asterisk">*</span></label>
                      <select name="gender" className="form-select" required value={formData.gender} onChange={handleInputChange}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Date of Birth <span className="required-asterisk">*</span></label>
                      <FlatDatePicker name="dob" className="form-control" required value={formData.dob} onChange={handleInputChange} dateFormat="m/d/Y" max={maxDobSlash} />
                    </div>
                    <ProvinceCityInputs
                      idPrefix="edit-loc"
                      province={formData.province}
                      city={formData.city}
                      onChange={handleInputChange}
                      required
                    />
                    <div className="col-md-6">
                      <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
                      <input type="text" name="contact" className="form-control" maxLength="11" required value={formData.contact} onChange={handleInputChange} />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Role <span className="required-asterisk">*</span></label>
                      {selectedUser.role === 'Guest' ? (
                        <input type="text" className="form-control" value="Guest" disabled />
                      ) : (
                        <select name="roleID" className="form-select" required value={formData.roleID} onChange={handleInputChange}>
                          {staffRoles.map(r => (
                            <option key={r.roleID} value={r.roleID}>{r.role}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Status <span className="required-asterisk">*</span></label>
                      <select name="status" className="form-select" required value={formData.status} onChange={handleInputChange}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    {/* Integrated Reset Password directly in Update Modal */}
                    <div className="col-md-6">
                      <label className="form-label">Reset Password (leave blank to keep current)</label>
                      <div className="password-field-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showEditPassword ? "text" : "password"}
                          name="newPassword"
                          className="form-control"
                          placeholder="Enter new password to reset"
                          value={formData.newPassword}
                          onChange={handleInputChange}
                          style={{ paddingRight: '2.8rem', flex: '1' }}
                          minLength="8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
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
                          {showEditPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
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

      {/* SUSPEND MODAL */}
      {activeModal === 'suspend' && suspendUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header text-white" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                <h5 className="modal-title fw-bold">⚠️ Suspend User Account</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleSuspendSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3 text-center bg-light p-3 rounded">
                    <span style={{ fontSize: '1.25rem' }} className="fw-semibold text-dark">
                      {suspendUser.firstName} {suspendUser.lastName}
                    </span>
                    <div className="text-muted small mt-1">{suspendUser.email}</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Suspension Duration (Days) <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      required
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(e.target.value)}
                      placeholder="e.g. 3"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Reason for Suspension <span className="required-asterisk">*</span></label>
                    <select
                      className="form-select"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                    >
                      <option value="Violated guest terms of service / misconduct">Violated guest terms of service / misconduct</option>
                      <option value="Suspicious login activity detected">Suspicious login activity detected</option>
                      <option value="Spamming reservations / no-show history">Spamming reservations / no-show history</option>
                      <option value="Unpaid bills / payment dispute">Unpaid bills / payment dispute</option>
                      <option value="Staff policy violation / inappropriate behavior">Staff policy violation / inappropriate behavior</option>
                      <option value="Other">Other (Specify in remarks below)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      {suspendReason === 'Other' ? 'Mandatory Remarks *' : 'Optional Remarks'}
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required={suspendReason === 'Other'}
                      value={suspendRemarks}
                      onChange={(e) => setSuspendRemarks(e.target.value)}
                      placeholder={suspendReason === 'Other' ? "Provide custom suspension remarks..." : "Add optional extra notes..."}
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="submit" className="btn btn-pcc-primary text-white w-100 fw-semibold">Suspend Account</button>
                  <button type="button" className="btn btn-secondary text-white w-100 fw-semibold" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </ModalPortal>
      )}
    </div>
  );
}
