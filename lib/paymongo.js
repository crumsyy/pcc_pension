import crypto from 'crypto';

/**
 * Get dynamic application base URL with fallbacks
 * @param {Request|null} req - Next.js Request object or null
 * @returns {string} Fully qualified base URL without trailing slash
 */
export function getBaseUrl(req = null) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  if (req) {
    const headerHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const headerProto = req.headers.get('x-forwarded-proto') || (headerHost?.includes('localhost') ? 'http' : 'https');
    if (headerHost) {
      return `${headerProto}://${headerHost}`.replace(/\/$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'https://pcc-pension.vercel.app';
}

/**
 * Get PayMongo Basic Authorization header
 * @returns {string} "Basic <base64>"
 */
export function getPayMongoAuthHeader() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_live_ZUjmqjtPg3cvSaZarhyWibzJ';
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

/**
 * Verify PayMongo webhook signature
 * Header format: "t=<timestamp>,te=<test_signature>,li=<live_signature>"
 * @param {string} rawBody - Raw request body text
 * @param {string} signatureHeader - paymongo-signature header value
 * @returns {boolean} True if signature matches
 */
export function verifyPayMongoSignature(rawBody, signatureHeader) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET_KEY || process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader || !rawBody) {
    return false;
  }

  try {
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let testSignature = '';
    let liveSignature = '';

    for (const part of parts) {
      const [k, ...v] = part.split('=');
      const key = k ? k.trim() : '';
      const val = v.join('=').trim();
      if (key === 't') timestamp = val;
      if (key === 'te') testSignature = val;
      if (key === 'li') liveSignature = val;
    }

    const expectedSignature = liveSignature || testSignature;
    if (!timestamp || !expectedSignature) {
      return false;
    }

    const payloadToSign = `${timestamp}.${rawBody}`;
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadToSign)
      .digest('hex');

    const computedBuffer = Buffer.from(computedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  } catch (err) {
    console.error("Error verifying PayMongo signature:", err);
    return false;
  }
}
