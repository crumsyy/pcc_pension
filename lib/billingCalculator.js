/**
 * Core Accounting Helper for Per-Capita Mixed Individual Discounts & Net Billing
 * PCC Pension House Booking & Settlement System
 */

export function calculateBillingTotals({
  roomRate = 0,
  nights = 1,
  guestCount = 1,
  guestDiscounts = [],
  fixedDiscount = 0,
  extraGuestFee = 0,
  breakfastFee = 0,
  ordersTotal = 0,
  incidentalsTotal = 0,
  downPaymentPercentage = 50,
  settledPayments = 0
}) {
  const safeNights = Math.max(1, Number(nights) || 1);
  // Base room charge: if caller passed total room charge, nights can be 1
  const grossRoomCharge = Math.round((Number(roomRate) || 0) * safeNights * 100) / 100;
  const safeGuestCount = Math.max(1, Number(guestCount) || 1);
  const perCapitaShare = Math.round((grossRoomCharge / safeGuestCount) * 100) / 100;

  let totalPerCapitaDiscount = 0;
  const itemizedDiscounts = (guestDiscounts || []).map((gd, idx) => {
    // support rate as fraction (e.g. 0.20) or whole percentage (e.g. 20)
    let rate = Number(gd.rate ?? gd.percentage) || 0;
    if (rate > 1) {
      rate = rate / 100;
    }
    const discountAmount = Math.round(perCapitaShare * rate * 100) / 100;
    totalPerCapitaDiscount += discountAmount;
    return {
      guestName: gd.guestName || gd.name || gd.fullName || `Guest #${idx + 1}`,
      discountType: gd.discountType || gd.type || gd.name || 'Special Discount',
      discountID: gd.discountID ? (String(gd.discountID).startsWith('disc-') ? parseInt(String(gd.discountID).replace('disc-', ''), 10) : parseInt(gd.discountID, 10)) : null,
      promotionID: gd.promotionID ? (String(gd.promotionID).startsWith('promo-') ? parseInt(String(gd.promotionID).replace('promo-', ''), 10) : parseInt(gd.promotionID, 10)) : null,
      discountIdNumber: gd.discountIdNumber ? String(gd.discountIdNumber).trim() : null,
      rate: rate,
      percentage: Math.round(rate * 100 * 100) / 100,
      shareAmount: perCapitaShare,
      discountAmount: discountAmount
    };
  });

  totalPerCapitaDiscount = Math.round(totalPerCapitaDiscount * 100) / 100;
  const numFixedDiscount = Math.round((Number(fixedDiscount) || 0) * 100) / 100;
  const grossSubtotal = Math.round((grossRoomCharge + Number(extraGuestFee || 0) + Number(breakfastFee || 0) + Number(ordersTotal || 0) + Number(incidentalsTotal || 0)) * 100) / 100;

  // Invariant: Total discount cannot exceed grossSubtotal and per-capita cannot exceed grossRoomCharge
  const cappedPerCapitaDiscount = Math.min(grossRoomCharge, totalPerCapitaDiscount);
  const totalDiscount = Math.min(grossSubtotal, Math.round((cappedPerCapitaDiscount + numFixedDiscount) * 100) / 100);
  const netRoomStayCharge = Math.max(0, Math.round((grossRoomCharge - cappedPerCapitaDiscount) * 100) / 100);
  const netTotal = Math.max(0, Math.round((grossSubtotal - totalDiscount) * 100) / 100);

  const dpPct = (Number(downPaymentPercentage) || 50) / 100;
  const requiredDownpayment = Math.round(netTotal * dpPct * 100) / 100;
  const remainingBalance = Math.max(0, Math.round((netTotal - Number(settledPayments || 0)) * 100) / 100);

  return {
    grossSubtotal,
    grossRoomCharge,
    perCapitaShare,
    safeGuestCount,
    itemizedDiscounts,
    totalPerCapitaDiscount: cappedPerCapitaDiscount,
    totalDiscount,
    netRoomStayCharge,
    netTotal,
    requiredDownpayment,
    remainingBalance
  };
}

export const calculatePerCapitaDiscount = calculateBillingTotals;
