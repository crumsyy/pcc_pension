'use client';

import React, { useState, useEffect } from 'react';
import ModalPortal from './ModalPortal';

export default function DiscountModal({
  isOpen,
  onClose,
  onApply,
  availableDiscounts = [],
  initialBeneficiaries = [],
  maxBeneficiaries = 1
}) {
  const [beneficiaries, setBeneficiaries] = useState([]);

  useEffect(() => {
    if (initialBeneficiaries && initialBeneficiaries.length > 0) {
      setBeneficiaries(initialBeneficiaries.map(b => ({
        ...b,
        discountIdNumber: (b.discountIdNumber || '').replace(/\D/g, '')
      })));
    } else {
      setBeneficiaries([{
        discountID: availableDiscounts[0]?.discountID || '',
        beneficiaryName: '',
        discountIdNumber: ''
      }]);
    }
  }, [isOpen, initialBeneficiaries, availableDiscounts]);

  if (!isOpen) return null;

  const handleUpdateField = (idx, field, value) => {
    setBeneficiaries(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'discountIdNumber') {
        return { ...item, [field]: value.replace(/\D/g, '') };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleKeyDownNumericOnly = (e) => {
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleAddRow = () => {
    if (beneficiaries.length >= maxBeneficiaries) return;
    setBeneficiaries(prev => [
      ...prev,
      {
        discountID: availableDiscounts[0]?.discountID || '',
        beneficiaryName: '',
        discountIdNumber: ''
      }
    ]);
  };

  const handleRemoveRow = (idx) => {
    setBeneficiaries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const sanitized = beneficiaries.map(b => ({
      ...b,
      discountIdNumber: (b.discountIdNumber || '').replace(/\D/g, '')
    }));
    if (onApply) onApply(sanitized);
    if (onClose) onClose();
  };

  return (
    <ModalPortal>
      <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
            <form onSubmit={handleSubmit}>
              <div className="modal-header border-bottom px-4 py-3 bg-light">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-tag-fill text-primary"></i> Apply Special Discounts
                </h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-muted small mb-3">
                  Enter beneficiary details for Senior Citizen or PWD discounts. Government ID numbers must contain numeric digits only.
                </p>

                {beneficiaries.map((b, idx) => (
                  <div key={idx} className="p-3 border rounded mb-3 bg-light position-relative">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold small text-primary">Beneficiary #{idx + 1}</span>
                      {beneficiaries.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-0 px-2"
                          onClick={() => handleRemoveRow(idx)}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold small mb-1">Discount Type *</label>
                        <select
                          className="form-select form-select-sm"
                          value={b.discountID}
                          onChange={(e) => handleUpdateField(idx, 'discountID', e.target.value)}
                          required
                        >
                          <option value="">Select Discount</option>
                          {availableDiscounts.map(d => (
                            <option key={d.discountID} value={d.discountID}>
                              {d.name} ({d.percentage}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold small mb-1">Beneficiary Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Full Name"
                          value={b.beneficiaryName}
                          onChange={(e) => handleUpdateField(idx, 'beneficiaryName', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold small mb-1">Government ID No. *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="form-control form-control-sm"
                          placeholder="e.g. 12345678 (Numeric Only)"
                          value={b.discountIdNumber}
                          onChange={(e) => handleUpdateField(idx, 'discountIdNumber', e.target.value.replace(/\D/g, ''))}
                          onKeyDown={handleKeyDownNumericOnly}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {beneficiaries.length < maxBeneficiaries && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 mb-2"
                    style={{ borderStyle: 'dashed' }}
                    onClick={handleAddRow}
                  >
                    <i className="bi bi-plus-circle me-1"></i> Add Another Beneficiary (Up to {maxBeneficiaries} Pax)
                  </button>
                )}
              </div>
              <div className="modal-footer border-top px-4 py-3 bg-light">
                <button type="button" className="btn btn-secondary text-white" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fw-bold text-white shadow-sm">
                  Apply Discounts
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
