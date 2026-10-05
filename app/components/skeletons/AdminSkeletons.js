'use client';

import React from 'react';
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonInput,
  SkeletonCard,
  SkeletonTable,
  SkeletonChart
} from './Skeleton';

/**
 * 1. Admin Dashboard Skeleton
 */
export function AdminDashboardSkeleton({ userName = 'Admin' }) {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Dashboard">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="90px" height="12px" className="mb-1" />
          <h2 className="section-title mb-0">Welcome, {userName}!</h2>
          <div className="d-flex align-items-center gap-2 mt-1">
            <Skeleton width="180px" height="14px" />
            <Skeleton width="75px" height="18px" borderRadius="12px" />
          </div>
        </div>
        <div>
          <Skeleton width="230px" height="34px" borderRadius="6px" />
        </div>
      </div>

      {/* 6 Room Status Stat Cards */}
      <div className="row g-3 mb-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div className="col-6 col-md-4 col-xl-2" key={idx}>
            <div
              className="stat-card text-center p-3 rounded"
              style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)', minHeight: '90px' }}
            >
              <div className="d-flex justify-content-center mb-1">
                <Skeleton width="48px" height="2rem" borderRadius="6px" />
              </div>
              <div className="d-flex justify-content-center">
                <Skeleton width="70px" height="12px" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4 Revenue & Activity Cards */}
      <div className="row g-3 mb-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div className="col-md-3" key={idx}>
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
              <Skeleton width="100px" height="11px" className="mb-2" />
              <Skeleton width="130px" height="2rem" className="mb-2" />
              {idx === 1 && <Skeleton width="100%" height="26px" borderRadius="4px" />}
            </div>
          </div>
        ))}
      </div>

      {/* Main Splits: Left Bookings Table, Right Housekeeping & Room Board */}
      <div className="row g-4 mb-4">
        {/* Left Column */}
        <div className="col-lg-6">
          <div
            className="card-module p-3 rounded h-100"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Skeleton width="220px" height="1.2rem" />
              <div className="d-flex gap-2">
                <Skeleton width="95px" height="28px" borderRadius="6px" />
                <Skeleton width="80px" height="28px" borderRadius="6px" />
              </div>
            </div>
            <SkeletonTable columns={5} rows={5} colWidths={['25%', '25%', '18%', '18%', '14%']} />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-lg-6">
          <div
            className="card-module p-3 rounded h-100"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Skeleton width="240px" height="1.2rem" />
              <Skeleton width="100px" height="28px" borderRadius="4px" />
            </div>

            <div className="row align-items-center g-3">
              {/* Room Grid */}
              <div className="col-md-7">
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {Array.from({ length: 12 }).map((_, rIdx) => (
                    <Skeleton key={rIdx} width="54px" height="54px" borderRadius="8px" />
                  ))}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, lIdx) => (
                    <Skeleton key={lIdx} width="60px" height="12px" />
                  ))}
                </div>
              </div>

              {/* Donut Chart */}
              <div className="col-md-5 text-center border-start ps-md-3">
                <Skeleton width="130px" height="14px" className="mx-auto mb-3" />
                <div className="d-flex justify-content-center mb-3">
                  <Skeleton width="110px" height="110px" borderRadius="50%" />
                </div>
                <Skeleton width="90px" height="12px" className="mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Admin Users Skeleton
 */
export function AdminUsersSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Users">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="180px" height="2rem" />
        </div>
        <SkeletonButton width="140px" height="38px" />
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={8} rows={7} colWidths={['10%', '18%', '20%', '14%', '12%', '10%', '10%', '6%']} />
      </div>
    </div>
  );
}

/**
 * 3. Admin Rooms Skeleton
 */
export function AdminRoomsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Rooms">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="190px" height="2rem" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="115px" height="38px" />
          <SkeletonButton width="115px" height="38px" />
        </div>
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={9} rows={7} colWidths={['9%', '11%', '13%', '10%', '13%', '13%', '11%', '10%', '10%']} />
      </div>
    </div>
  );
}

/**
 * 4. Admin Amenities Skeleton
 */
export function AdminAmenitiesSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Amenities">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="230px" height="2rem" />
        </div>
        <SkeletonButton width="145px" height="38px" />
      </div>

      {/* Tabs */}
      <div className="d-flex gap-3 mb-3 border-bottom pb-2">
        <Skeleton width="130px" height="28px" borderRadius="4px" />
        <Skeleton width="130px" height="28px" borderRadius="4px" />
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={8} rows={7} colWidths={['5%', '22%', '13%', '12%', '12%', '8%', '18%', '10%']} />
      </div>
    </div>
  );
}

/**
 * 5. Admin Products & Cooked Meals Skeleton
 */
export function AdminProductsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Products">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="220px" height="2rem" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="135px" height="38px" />
          <SkeletonButton width="155px" height="38px" />
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex gap-3 mb-3 border-bottom pb-2">
        <Skeleton width="100px" height="28px" borderRadius="4px" />
        <Skeleton width="115px" height="28px" borderRadius="4px" />
        <Skeleton width="100px" height="28px" borderRadius="4px" />
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={9} rows={7} colWidths={['4%', '20%', '12%', '11%', '10%', '7%', '14%', '12%', '10%']} />
      </div>
    </div>
  );
}

/**
 * 6. Admin Inventory Skeleton
 */
export function AdminInventorySkeleton({ activeTab = 'dashboard' }) {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Inventory">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="230px" height="2rem" />
        </div>
        <SkeletonButton width="190px" height="38px" />
      </div>

      {/* Tabs */}
      <div className="d-flex gap-3 mb-4 border-bottom pb-2">
        {['Dashboard', 'Current Stocks', 'Batch Tracker', 'Borrowing System', 'Movement Logs'].map((tab, idx) => (
          <Skeleton key={idx} width="110px" height="28px" borderRadius="4px" />
        ))}
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* 6 Top Stat Cards */}
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
                  <Skeleton width="80px" height="11px" className="mb-2" />
                  <Skeleton width="50px" height="1.8rem" />
                </div>
              </div>
            ))}
          </div>

          {/* 4 Bottom KPI Cards */}
          <div className="row g-3 mb-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div className="col-6 col-md-3" key={idx}>
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
                  <Skeleton width="90px" height="11px" className="mb-2" />
                  <Skeleton width="50px" height="1.8rem" />
                </div>
              </div>
            ))}
          </div>

          {/* Low Stock Overview Table Card */}
          <div className="card-module" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Skeleton width="180px" height="1.3rem" />
              <Skeleton width="120px" height="28px" />
            </div>
            <SkeletonTable columns={6} rows={4} colWidths={['30%', '15%', '15%', '15%', '15%', '10%']} />
          </div>
        </>
      ) : (
        <>
          {/* Filter Bar for Stocks/Batches/Borrow/Logs */}
          <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
            <div className="row g-2 align-items-center">
              <div className="col-md-4">
                <SkeletonInput height="38px" />
              </div>
              <div className="col-md-3">
                <SkeletonInput height="38px" />
              </div>
              <div className="col-md-3">
                <SkeletonInput height="38px" />
              </div>
              <div className="col-md-2">
                <SkeletonButton width="100%" height="38px" />
              </div>
            </div>
          </div>
          <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
            <SkeletonTable columns={7} rows={7} colWidths={['22%', '14%', '14%', '12%', '14%', '12%', '12%']} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 7. Admin Purchase Orders Skeleton
 */
export function AdminPurchaseOrdersSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Purchase Orders">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="260px" height="2rem" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="185px" height="38px" />
          <SkeletonButton width="100px" height="38px" />
        </div>
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={6} rows={6} colWidths={['15%', '18%', '15%', '18%', '16%', '18%']} />
      </div>
    </div>
  );
}

/**
 * 8. Admin Discounts & Promotions Skeleton
 */
export function AdminDiscountsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Discounts and Promos">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="290px" height="2rem" />
          <Skeleton width="240px" height="13px" className="mt-1" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="145px" height="38px" />
          <SkeletonButton width="155px" height="38px" />
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex gap-3 mb-3 border-bottom pb-2">
        <Skeleton width="140px" height="28px" borderRadius="4px" />
        <Skeleton width="140px" height="28px" borderRadius="4px" />
      </div>

      {/* Search Bar */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-10">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Discounts Table Card */}
      <div className="card-module pcc-table-card mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <Skeleton width="160px" height="1.3rem" className="mb-3" />
        <SkeletonTable columns={6} rows={4} colWidths={['30%', '16%', '16%', '12%', '14%', '12%']} />
      </div>

      {/* Promotions Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <Skeleton width="180px" height="1.3rem" className="mb-3" />
        <SkeletonTable columns={7} rows={4} colWidths={['26%', '10%', '14%', '14%', '16%', '10%', '10%']} />
      </div>
    </div>
  );
}

/**
 * 9. Admin Reports Skeleton
 */
export function AdminReportsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Reports">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="280px" height="2rem" />
          <Skeleton width="260px" height="13px" className="mt-1" />
        </div>
        <div className="d-flex gap-2">
          <SkeletonButton width="110px" height="38px" />
          <SkeletonButton width="110px" height="38px" />
        </div>
      </div>

      {/* Filter Card */}
      <div className="card shadow-sm border-0 mb-4 p-3 bg-white">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <Skeleton width="90px" height="12px" className="mb-2" />
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <Skeleton width="80px" height="12px" className="mb-2" />
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <Skeleton width="70px" height="12px" className="mb-2" />
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="row g-3 mb-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div className="col-md-3" key={idx}>
            <div className="card shadow-sm border-0 p-3 bg-white h-100">
              <Skeleton width="110px" height="12px" className="mb-2" />
              <Skeleton width="130px" height="1.8rem" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart Skeleton Card */}
      <div className="card shadow-sm border-0 p-3 bg-white mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Skeleton width="200px" height="1.2rem" />
          <Skeleton width="90px" height="24px" borderRadius="12px" />
        </div>
        <SkeletonChart height="240px" />
      </div>

      {/* Table Skeleton Card */}
      <div className="card shadow-sm border-0 p-3 bg-white">
        <Skeleton width="220px" height="1.2rem" className="mb-3" />
        <SkeletonTable columns={6} rows={6} colWidths={['20%', '20%', '15%', '15%', '15%', '15%']} />
      </div>
    </div>
  );
}

/**
 * 10. Admin Bookings Overview Skeleton
 */
export function AdminBookingsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Bookings">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="250px" height="2rem" />
          <Skeleton width="280px" height="13px" className="mt-1" />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <SkeletonButton width="150px" height="38px" />
          <SkeletonButton width="100px" height="38px" />
        </div>
      </div>

      {/* Status Counters Row */}
      <div className="row g-2 mb-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div className="col-4 col-md-2" key={idx}>
            <div className="p-2.5 rounded border text-center bg-white">
              <Skeleton width="40px" height="1.4rem" className="mx-auto mb-1" />
              <Skeleton width="65px" height="11px" className="mx-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={8} rows={7} colWidths={['5%', '18%', '13%', '15%', '10%', '14%', '14%', '11%']} />
      </div>
    </div>
  );
}

/**
 * 11. Admin Reservations Overview Skeleton
 */
export function AdminReservationsSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-label="Loading Reservations">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <Skeleton width="70px" height="12px" className="mb-1" />
          <Skeleton width="260px" height="2rem" />
          <Skeleton width="280px" height="13px" className="mt-1" />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <SkeletonButton width="160px" height="38px" />
          <SkeletonButton width="100px" height="38px" />
        </div>
      </div>

      {/* Status Badges Row */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} width="85px" height="26px" borderRadius="14px" />
        ))}
      </div>

      {/* Filter Card */}
      <div className="card-module mb-4" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--pcc-mist)' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-3">
            <SkeletonInput height="38px" />
          </div>
          <div className="col-md-2">
            <SkeletonButton width="100%" height="38px" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--pcc-mist)' }}>
        <SkeletonTable columns={7} rows={7} colWidths={['6%', '22%', '14%', '20%', '16%', '12%', '10%']} />
      </div>
    </div>
  );
}
