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
 * 1. Guest Dashboard Skeleton
 */
export function GuestDashboardSkeleton({ guestName = 'Guest' }) {
  return (
    <div className="guest-skeleton-page p-3 p-md-4" aria-busy="true" aria-label="Loading Guest Portal">
      {/* Top Banner / Welcome */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Skeleton width="110px" height="12px" className="mb-1" />
          <h2 className="display-font fw-bold mb-0" style={{ color: 'var(--pcc-blue)' }}>
            Welcome, {guestName}!
          </h2>
          <Skeleton width="220px" height="14px" className="mt-1" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="120px" height="38px" borderRadius="8px" />
        </div>
      </div>

      {/* Active Stay / Primary Status Card */}
      <div className="card shadow-sm border-0 bg-white p-4 mb-4 rounded-4" style={{ borderLeft: '6px solid var(--pcc-blue)' }}>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <Skeleton width="150px" height="1.4rem" className="mb-2" />
            <Skeleton width="220px" height="14px" />
          </div>
          <Skeleton width="90px" height="26px" borderRadius="13px" />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-6 col-md-3">
            <Skeleton width="70px" height="11px" className="mb-1" />
            <Skeleton width="110px" height="1.1rem" />
          </div>
          <div className="col-6 col-md-3">
            <Skeleton width="70px" height="11px" className="mb-1" />
            <Skeleton width="110px" height="1.1rem" />
          </div>
          <div className="col-6 col-md-3">
            <Skeleton width="80px" height="11px" className="mb-1" />
            <Skeleton width="120px" height="1.1rem" />
          </div>
          <div className="col-6 col-md-3">
            <Skeleton width="80px" height="11px" className="mb-1" />
            <Skeleton width="100px" height="1.1rem" />
          </div>
        </div>
        <div className="d-flex gap-2 pt-2 border-top">
          <SkeletonButton width="110px" height="34px" borderRadius="6px" />
          <SkeletonButton width="120px" height="34px" borderRadius="6px" />
        </div>
      </div>

      {/* Recommended Rooms / Quick Catalog Section */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Skeleton width="180px" height="1.3rem" />
          <Skeleton width="80px" height="14px" />
        </div>
        <div className="row g-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div className="col-12 col-md-4" key={idx}>
              <div className="card shadow-sm border-0 bg-white rounded-4 overflow-hidden h-100">
                <Skeleton width="100%" height="160px" borderRadius="0" />
                <div className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Skeleton width="130px" height="1.2rem" />
                    <Skeleton width="60px" height="22px" borderRadius="11px" />
                  </div>
                  <Skeleton width="80%" height="13px" className="mb-3" />
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <Skeleton width="90px" height="1.3rem" />
                    <SkeletonButton width="90px" height="32px" borderRadius="6px" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Guest Edit Profile Skeleton
 */
export function GuestEditProfileSkeleton() {
  return (
    <div className="d-flex flex-column gap-4" aria-busy="true">
      {/* Avatar Card */}
      <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '16px' }}>
        <div className="d-flex flex-column flex-sm-row align-items-center gap-4">
          <SkeletonAvatar size="120px" />
          <div className="text-center text-sm-start">
            <Skeleton width="160px" height="1.3rem" className="mb-2" />
            <Skeleton width="220px" height="13px" className="mb-3" />
            <SkeletonButton width="140px" height="38px" borderRadius="8px" />
          </div>
        </div>
      </div>

      {/* Personal Info Card */}
      <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '16px' }}>
        <Skeleton width="180px" height="1.3rem" className="mb-3" />
        <div className="row g-3">
          <div className="col-md-6">
            <Skeleton width="80px" height="12px" className="mb-2" />
            <SkeletonInput height="42px" />
          </div>
          <div className="col-md-6">
            <Skeleton width="80px" height="12px" className="mb-2" />
            <SkeletonInput height="42px" />
          </div>
          <div className="col-md-6">
            <Skeleton width="90px" height="12px" className="mb-2" />
            <SkeletonInput height="42px" />
          </div>
          <div className="col-md-6">
            <Skeleton width="60px" height="12px" className="mb-2" />
            <SkeletonInput height="42px" />
          </div>
        </div>
        <div className="mt-4 d-flex justify-content-end">
          <SkeletonButton width="140px" height="40px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Guest Bookings History Skeleton
 */
export function GuestBookingsHistorySkeleton() {
  return (
    <div className="card shadow-xs border-0 p-3 bg-white" style={{ borderRadius: '10px' }} aria-busy="true">
      <SkeletonTable columns={8} rows={6} colWidths={['10%', '18%', '16%', '13%', '13%', '11%', '11%', '8%']} />
    </div>
  );
}
