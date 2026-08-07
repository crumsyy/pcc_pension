/**
 * Dynamic QR Ph (EMVCo Compliant) Generator for Philippine E-Wallets (GCash, Maya, QR Ph, ShopeePay, Bank Apps)
 * Generates dynamic payload encoding exact transaction amount and reference number for 100% FREE without PayMongo fees.
 */

// Helper to format EMVCo Tag (ID + 2-digit Length + Value)
function emvTag(id, value) {
  if (value === undefined || value === null) return '';
  const strVal = String(value);
  const len = String(strVal.length).padStart(2, '0');
  return `${id}${len}${strVal}`;
}

// CRC16 CCITT Checksum calculation required by EMVCo / QR Ph standard
function computeCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate Dynamic QR Ph Payload
 * @param {Object} params
 * @param {number|string} params.amount - Transaction amount (e.g., 1500.00)
 * @param {string} params.reference - Invoice or Transaction ID (e.g., "TRX-00001")
 * @param {string} [params.merchantName="PCC HOME SUITE HOME"] - Merchant business name
 * @param {string} [params.merchantCity="KORONADAL"] - City
 * @param {string} [params.accountNo="09000000000"] - GCash / QR Ph account number
 */
export function generateDynamicQRPh({
  amount,
  reference = 'PAY-00001',
  merchantName = 'PCC HOME SUITE HOME',
  merchantCity = 'KORONADAL',
  accountNo = '09000000000'
}) {
  const formattedAmount = parseFloat(amount || 0).toFixed(2);
  const cleanMerchant = merchantName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').slice(0, 25);
  const cleanCity = merchantCity.toUpperCase().replace(/[^A-Z0-9\s]/g, '').slice(0, 15);
  const cleanRef = String(reference).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

  // 1. Payload Format Indicator
  let payload = emvTag('00', '01');
  
  // 2. Point of Initiation Method: '12' = Dynamic QR Code (Amount pre-filled, non-editable)
  payload += emvTag('01', '12');

  // 3. Merchant Account Information (QR Ph / GCash standard tag 28)
  const globId = emvTag('00', 'ph.ppmi.qrph');
  const merchantAcc = emvTag('01', accountNo);
  const subMerchant = globId + merchantAcc;
  payload += emvTag('28', subMerchant);

  // 4. Merchant Category Code (5999 - Lodging & Accommodation)
  payload += emvTag('52', '5999');

  // 5. Transaction Currency (608 = PHP Philippine Peso)
  payload += emvTag('53', '608');

  // 6. Dynamic Transaction Amount (Tag 54) - Forces app to auto-fill exact amount
  payload += emvTag('54', formattedAmount);

  // 7. Country Code (PH)
  payload += emvTag('58', 'PH');

  // 8. Merchant Name & City
  payload += emvTag('59', cleanMerchant || 'PCC HOME SUITE HOME');
  payload += emvTag('60', cleanCity || 'KORONADAL');

  // 9. Additional Data Field (Reference / Invoice Number)
  const refTag = emvTag('05', cleanRef);
  payload += emvTag('62', refTag);

  // 10. Checksum Tag Header ('6304') + Calculated CRC16
  payload += '6304';
  const checksum = computeCRC16(payload);
  payload += checksum;

  return payload;
}

/**
 * Generate Google Chart QR Code URL for the Dynamic QR Ph payload
 */
export function getQRPhImageURL(params) {
  const payload = generateDynamicQRPh(params);
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`;
}
