'use client';

import React from 'react';
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonInput,
  SkeletonCard,
  SkeletonTable
} from './Skeleton';

/**
 * 1. Receptionist Dashboard Skeleton
 */
export function ReceptionistDashboardSkeleton({ userName = 'Receptionist' }) {
  return (
    <div className="receptionist-skeleton-page" aria-busy="true" aria-label="Loading Receptionist Dashboard">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="100px" height="12px" className="mb-1" />
          <h2 className="section-title mb-0">Welcome, {userName}!</h2>
          <div className="d-flex align-items-center gap-2 mt-1">
            <Skeleton width="180px" height="14px" />
            <Skeleton width="75px" height="18px" borderRadius="12px" />
          </div>
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="140px" height="38px" />
          <SkeletonButton width="130px" height="38px" />
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="row g-3 mb-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div className="col-6 col-md-4 col-xl-2" key={idx}>
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <Skeleton width="85px" height="11px" className="mb-2" />
              <Skeleton width="45px" height="1.8rem" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Split: In-House Guests (Left) & Pending Reservations (Right) */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card-module p-3 rounded h-100" style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Skeleton width="190px" height="1.2rem" />
              <Skeleton width="90px" height="28px" borderRadius="6px" />
            </div>
            <SkeletonTable columns={5} rows={5} colWidths={['26%', '22%', '20%', '18%', '14%']} />
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card-module p-3 rounded h-100" style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Skeleton width="200px" height="1.2rem" />
              <Skeleton width="90px" height="28px" borderRadius="6px" />
            </div>
            <SkeletonTable columns={5} rows={5} colWidths={['26%', '22%', '20%', '18%', '14%']} />
          </div>
        </div>
      </div>

      {/* Room Status Board Grid Placeholder */}
      <div className="card-module p-3 rounded" style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Skeleton width="220px" height="1.2rem" />
          <Skeleton width="110px" height="28px" borderRadius="4px" />
        </div>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {Array.from({ length: 16 }).map((_, idx) => (
            <Skeleton key={idx} width="54px" height="54px" borderRadius="8px" />
          ))}
        </div>
        <div className="d-flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} width="80px" height="14px" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Receptionist Check-In Skeleton (Arrivals & Departures Cards)
 */
export function ReceptionistCheckInSkeleton() {
  return (
    <div className="row g-4" aria-busy="true">
      {/* Arrivals Column */}
      <div className="col-lg-6">
        <div className="p-3 rounded mb-3" style={{ backgroundColor: '#2155B5', minHeight: '62px' }}>
          <Skeleton width="220px" height="1.2rem" className="mb-1" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <Skeleton width="150px" height="12px" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div className="d-flex flex-column gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="p-3 border rounded bg-white shadow-xs">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <Skeleton width="140px" height="1.1rem" className="mb-1" />
                  <Skeleton width="180px" height="12px" className="mb-1" />
                  <Skeleton width="130px" height="12px" />
                </div>
                <Skeleton width="85px" height="24px" borderRadius="12px" />
              </div>
              <div className="mt-2 pt-2 border-top d-flex justify-content-end">
                <Skeleton width="110px" height="30px" borderRadius="6px" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Departures Column */}
      <div className="col-lg-6">
        <div className="p-3 rounded mb-3" style={{ backgroundColor: '#2b5e52', minHeight: '62px' }}>
          <Skeleton width="230px" height="1.2rem" className="mb-1" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <Skeleton width="160px" height="12px" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div className="d-flex flex-column gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="p-3 border rounded bg-white shadow-xs">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <Skeleton width="150px" height="1.1rem" className="mb-1" />
                  <Skeleton width="190px" height="12px" className="mb-1" />
                  <Skeleton width="140px" height="12px" />
                </div>
                <Skeleton width="85px" height="24px" borderRadius="12px" />
              </div>
              <div className="mt-2 pt-2 border-top d-flex justify-content-end gap-2">
                <Skeleton width="100px" height="30px" borderRadius="6px" />
                <Skeleton width="110px" height="30px" borderRadius="6px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Receptionist Orders Skeleton
 */
export function ReceptionistOrdersSkeleton() {
  return (
    <div className="d-flex flex-column gap-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="p-3 border rounded bg-white shadow-xs">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="d-flex align-items-center gap-2">
              <Skeleton width="90px" height="1.2rem" />
              <Skeleton width="100px" height="22px" borderRadius="11px" />
              <Skeleton width="80px" height="22px" borderRadius="11px" />
            </div>
            <Skeleton width="70px" height="1.1rem" />
          </div>
          <div className="mb-2">
            <Skeleton width="160px" height="13px" className="mb-1" />
            <Skeleton width="220px" height="12px" />
          </div>
          <div className="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
            <Skeleton width="120px" height="12px" />
            <div className="d-flex gap-2">
              <Skeleton width="85px" height="30px" borderRadius="6px" />
              <Skeleton width="95px" height="30px" borderRadius="6px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 4. Receptionist Billing Skeleton (Stays List + Folio Statement)
 */
export function ReceptionistBillingSkeleton() {
  return (
    <div className="row g-3" aria-busy="true">
      {/* Left Column: Stays List */}
      <div className="col-lg-4">
        <div className="card shadow-sm border-0 bg-white p-3 rounded" style={{ height: 'calc(100vh - 200px)' }}>
          <Skeleton width="120px" height="1.1rem" className="mb-3" />
          <SkeletonInput height="36px" className="mb-3" />
          <div className="d-flex flex-column gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="p-2.5 border rounded">
                <div className="d-flex justify-content-between mb-1">
                  <Skeleton width="110px" height="14px" />
                  <Skeleton width="60px" height="14px" />
                </div>
                <Skeleton width="130px" height="11px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Statement Breakdown */}
      <div className="col-lg-8">
        <div className="card shadow-sm border-0 bg-white p-4 rounded" style={{ height: 'calc(100vh - 200px)' }}>
          <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
            <div>
              <Skeleton width="160px" height="1.3rem" className="mb-1" />
              <Skeleton width="220px" height="13px" />
            </div>
            <div className="d-flex gap-2">
              <SkeletonButton width="110px" height="36px" />
              <SkeletonButton width="110px" height="36px" />
            </div>
          </div>

          <SkeletonTable columns={4} rows={5} colWidths={['40%', '20%', '20%', '20%']} className="mb-4" />

          <div className="d-flex justify-content-end mt-auto pt-3 border-top">
            <div style={{ width: '240px' }}>
              <div className="d-flex justify-content-between mb-2">
                <Skeleton width="80px" height="14px" />
                <Skeleton width="60px" height="14px" />
              </div>
              <div className="d-flex justify-content-between mb-2">
                <Skeleton width="70px" height="14px" />
                <Skeleton width="50px" height="14px" />
              </div>
              <div className="d-flex justify-content-between pt-2 border-top">
                <Skeleton width="90px" height="1.2rem" />
                <Skeleton width="80px" height="1.2rem" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 5. Receptionist Inquiries Skeleton (Conversations List)
 */
export function ReceptionistInquiriesListSkeleton() {
  return (
    <div className="d-flex flex-column" aria-busy="true">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="p-3 border-bottom d-flex align-items-center gap-2">
          <SkeletonAvatar size="36px" />
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between mb-1">
              <Skeleton width="110px" height="14px" />
              <Skeleton width="45px" height="11px" />
            </div>
            <Skeleton width="75%" height="12px" className="mb-1.5" />
            <Skeleton width="60px" height="18px" borderRadius="9px" />
          </div>
        </div>
      ))}
    </div>
  );
}
