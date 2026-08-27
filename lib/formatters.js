/**
 * Primary Key Formatting Utilities for PCC Home Suite System
 */

export function formatReservationID(id) {
  if (id === null || id === undefined || id === '') return 'RV00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('RV')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `RV${String(num).padStart(5, '0')}`;
}

export function formatBookingID(id) {
  if (id === null || id === undefined || id === '') return 'BK00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('BK')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `BK${String(num).padStart(5, '0')}`;
}

export function formatTransactionID(id) {
  if (id === null || id === undefined || id === '') return 'TRA00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('TRA')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `TRA${String(num).padStart(5, '0')}`;
}

export function formatOrderID(id) {
  if (id === null || id === undefined || id === '') return 'ORD00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('ORD')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `ORD${String(num).padStart(5, '0')}`;
}

export function formatRoomNumber(roomNumber) {
  if (roomNumber === null || roomNumber === undefined || roomNumber === '') return 'RN000';
  const rawStr = String(roomNumber).trim();
  if (rawStr.startsWith('RN')) return rawStr;
  const digits = rawStr.replace(/\D/g, '');
  return `RN${digits ? digits.padStart(3, '0') : rawStr}`;
}
