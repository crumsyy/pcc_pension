/**
 * Single source for portal navigation (palette) and header page titles.
 * Sidebar labels must match these 1:1.
 */

export const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard', keywords: 'dashboard home overview welcome' },
  { path: '/admin/users', label: 'User Management', keywords: 'users staff guests accounts user management' },
  { path: '/admin/rooms', label: 'Room Management', keywords: 'rooms room management rates' },
  { path: '/admin/amenities', label: 'Amenities', keywords: 'amenities inventory items' },
  { path: '/admin/products', label: 'Products', keywords: 'products meals cooked food menu' },
  { path: '/admin/inventory', label: 'Inventory Management', keywords: 'inventory stocks batches borrow movements' },
  { path: '/admin/purchase-orders', label: 'Purchase Orders', keywords: 'purchase orders procurement suppliers' },
  { path: '/admin/discounts', label: 'Discounts & Promos', keywords: 'discounts promos offers deals' },
  { path: '/admin/reports', label: 'Reports', keywords: 'reports sales analytics occupancy' },
];

export const RECEPTIONIST_NAV = [
  { path: '/receptionist/dashboard', label: 'Dashboard', keywords: 'dashboard home overview welcome' },
  { path: '/receptionist/reservations', label: 'Reservations', keywords: 'reservations holds bookings requests' },
  { path: '/receptionist/bookings', label: 'Bookings', keywords: 'bookings stays guests rooms checkin' },
  { path: '/receptionist/checkin', label: 'Check-In / Out', keywords: 'checkin checkout arrivals departures front desk' },
  { path: '/receptionist/orders', label: 'Orders', keywords: 'orders food meals room service' },
  { path: '/receptionist/billing-checkout', label: 'Billing & Checkout', keywords: 'billing checkout payments folio settle invoice' },
  { path: '/receptionist/inquiries', label: 'Inquiries', keywords: 'inquiries messages chat guest questions' },
];

const ROUTE_TITLES = {
  '/admin/dashboard': { eyebrow: 'Administrator', title: 'Dashboard' },
  '/admin/users': { eyebrow: 'Admin', title: 'User Management' },
  '/admin/rooms': { eyebrow: 'Admin', title: 'Room Management' },
  '/admin/amenities': { eyebrow: 'Admin', title: 'Amenities Management' },
  '/admin/products': { eyebrow: 'Admin', title: 'Products Management' },
  '/admin/inventory': { eyebrow: 'Admin', title: 'Inventory Management' },
  '/admin/purchase-orders': { eyebrow: 'Admin', title: 'Purchase Orders' },
  '/admin/discounts': { eyebrow: 'Admin', title: 'Discounts & Promos Management' },
  '/admin/bookings': { eyebrow: 'Admin', title: 'Booking Status Overview' },
  '/admin/reservations': { eyebrow: 'Admin', title: 'Reservation Status Overview' },
  '/admin/reports': { eyebrow: 'Admin', title: 'Reports' },
  '/receptionist/dashboard': { eyebrow: 'Receptionist', title: 'Dashboard' },
  '/receptionist/reservations': { eyebrow: 'Receptionist', title: 'Reservation Management' },
  '/receptionist/bookings': { eyebrow: 'Receptionist', title: 'Booking Management' },
  '/receptionist/bookings/checkout': { eyebrow: 'Receptionist', title: 'Checkout' },
  '/receptionist/checkin': { eyebrow: 'Receptionist', title: 'Front Desk (Check-In & Check-Out)' },
  '/receptionist/orders': { eyebrow: 'Receptionist', title: 'Room Orders Workspace' },
  '/receptionist/billing-checkout': { eyebrow: 'Receptionist', title: 'Billing & Checkout' },
  '/receptionist/inquiries': { eyebrow: 'Receptionist', title: 'Guest Live Chat & Inquiry Management Desk' },
};

export function pageTitleFor(pathname) {
  if (!pathname) return null;
  let best = null;
  for (const path of Object.keys(ROUTE_TITLES)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      if (!best || path.length > best.length) best = path;
    }
  }
  return best ? ROUTE_TITLES[best] : null;
}
