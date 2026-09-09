import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.replace(/\s+/g, '') : '',
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

export async function sendOtpEmail(toEmail, toName, otpCode) {
  console.log(`🔑 [OTP CODE] Verification code for ${toEmail}: ${otpCode}`);
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: 'Your PCC Home Suite Home Verification Code',
      html: `
        <div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;'>
            <div style='background:#2155B5;padding:20px 24px;border-radius:8px 8px 0 0;'>
                <h2 style='color:#fff;margin:0;font-size:20px;'>PCC Home Suite Home</h2>
                <p style='color:#cce0ff;margin:4px 0 0;font-size:13px;'>Osmeña Street, Zone 1, Koronadal City</p>
            </div>
            <div style='background:#fff;padding:24px;border:1px solid #e5efe6;border-top:none;border-radius:0 0 8px 8px;'>
                <p style='color:#1f2a24;'>Hi <strong>${toName}</strong>,</p>
                <p style='color:#1f2a24;'>Thanks for signing up! Use the verification code below to activate your account:</p>
                <div style='font-size:32px;font-weight:bold;letter-spacing:8px;background:#e5efe6;color:#2155B5;padding:16px;text-align:center;border-radius:8px;margin:20px 0;'>
                    ${otpCode}
                </div>
                <p style='color:#66756b;font-size:13px;'>This code expires in <strong>${process.env.OTP_VALIDITY_MINUTES || '10'} minutes</strong>. If you didn't sign up for PCC Home Suite Home, you can safely ignore this email.</p>
            </div>
        </div>
      `,
      text: `Your PCC Home Suite Home verification code is: ${otpCode}. It expires in ${process.env.OTP_VALIDITY_MINUTES || '10'} minutes.`,
    });
    console.log(`✅ [SMTP SUCCESS] Verification email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [SMTP ERROR] Failed to send OTP email to ${toEmail}:`, error.message || error);
    return false;
  }
}

export async function sendResetOtpEmail(toEmail, toName, otpCode) {
  console.log(`🔑 [RESET CODE] Password reset code for ${toEmail}: ${otpCode}`);
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: 'Your PCC Home Suite Home Password Reset Code',
      html: `
        <div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;'>
            <div style='background:#2155B5;padding:20px 24px;border-radius:8px 8px 0 0;'>
                <h2 style='color:#fff;margin:0;font-size:20px;'>PCC Home Suite Home</h2>
                <p style='color:#cce0ff;margin:4px 0 0;font-size:13px;'>Osmeña Street, Zone 1, Koronadal City</p>
            </div>
            <div style='background:#fff;padding:24px;border:1px solid #e5efe6;border-top:none;border-radius:0 0 8px 8px;'>
                <p style='color:#1f2a24;'>Hi <strong>${toName}</strong>,</p>
                <p style='color:#1f2a24;'>We received a request to reset your password. Use the code below:</p>
                <div style='font-size:32px;font-weight:bold;letter-spacing:8px;background:#e5efe6;color:#2155B5;padding:16px;text-align:center;border-radius:8px;margin:20px 0;'>
                    ${otpCode}
                </div>
                <p style='color:#66756b;font-size:13px;'>This code expires in <strong>${process.env.OTP_VALIDITY_MINUTES || '10'} minutes</strong>. If you didn't request a password reset, please ignore this email — your password will remain unchanged.</p>
            </div>
        </div>
      `,
      text: `Your PCC Home Suite Home password reset code is: ${otpCode}. It expires in ${process.env.OTP_VALIDITY_MINUTES || '10'} minutes.`,
    });
    console.log(`✅ [SMTP SUCCESS] Password reset email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [SMTP ERROR] Failed to send password reset email to ${toEmail}:`, error.message || error);
    return false;
  }
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendCourtesyHoldWarningEmail(target, toName, details, hoursLeft = 6) {
  let toEmail = target;
  let name = toName;
  let info = details;
  let hrs = hoursLeft;

  if (target && typeof target === 'object') {
    toEmail = target.guestEmail || target.email;
    name = target.guestName || (target.firstName && target.lastName ? `${target.firstName} ${target.lastName}`.trim() : target.name) || toName;
    info = target.details || target;
    hrs = target.hoursLeft || hoursLeft;
  }

  if (!toEmail) return false;
  console.log(`⏰ [HOLD REMINDER] Sending ${hrs}h reminder to ${toEmail} for Room ${info?.roomNumber}`);
  try {
    const transporter = getTransporter();
    const isUrgent = hrs <= 6;
    const subject = isUrgent
      ? `Urgent: Your Courtesy Hold on Room ${info?.roomNumber || ''} Expires in ${hrs} Hours!`
      : `Reminder: Your Courtesy Hold on Room ${info?.roomNumber || ''} Expires in ${hrs} Hours`;

    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: `"${name || 'Valued Guest'}" <${toEmail}>`,
      subject,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;'>
            <div style='background:${isUrgent ? '#d9480f' : '#2155B5'};padding:20px 24px;border-radius:8px 8px 0 0;'>
                <h2 style='color:#fff;margin:0;font-size:20px;'>PCC Home Suite Home</h2>
                <p style='color:#ffe8cc;margin:4px 0 0;font-size:13px;'>Courtesy Hold Reminder</p>
            </div>
            <div style='background:#fff;padding:24px;border:1px solid #e5efe6;border-top:none;border-radius:0 0 8px 8px;'>
                <p style='color:#1f2a24;'>Hi <strong>${name || 'Valued Guest'}</strong>,</p>
                <p style='color:#1f2a24;'>This is a friendly reminder that your courtesy hold for <strong>Room ${info?.roomNumber || ''} (${info?.roomType || 'Standard'})</strong> expires in approximately <strong>${hrs} hours</strong>.</p>
                <div style='background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin:16px 0;border-radius:4px;'>
                    <p style='margin:0;color:#856404;font-size:13px;'><strong>Hold ID:</strong> #${info?.reservationID || ''}</p>
                    <p style='margin:4px 0 0;color:#856404;font-size:13px;'><strong>Check-in Date:</strong> ${info?.checkInDate || ''}</p>
                    <p style='margin:4px 0 0;color:#856404;font-size:13px;'><strong>Expiration Time:</strong> ${info?.holdExpiryStr || ''}</p>
                </div>
                <p style='color:#1f2a24;font-size:13px;'>To guarantee your room, please log in to your guest dashboard and confirm your reservation with a down payment before the hold expires.</p>
                <p style='color:#66756b;font-size:12px;margin-top:20px;'>If you no longer need this reservation, no action is needed — the room will be automatically released back to availability upon expiration.</p>
            </div>
        </div>
      `,
      text: `Your courtesy hold for Room ${info?.roomNumber} expires in ${hrs} hours. Please log in to your dashboard to confirm your booking before ${info?.holdExpiryStr}.`
    });
    console.log(`✅ [SMTP SUCCESS] Courtesy hold ${hrs}h reminder email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [SMTP ERROR] Failed to send courtesy hold reminder to ${toEmail}:`, error.message || error);
    return false;
  }
}

export const sendCourtesyHoldReminderEmail = sendCourtesyHoldWarningEmail;

export async function sendCourtesyHoldReleasedEmail(target, toName, details) {
  let toEmail = target;
  let name = toName;
  let info = details;

  if (target && typeof target === 'object') {
    toEmail = target.guestEmail || target.email;
    name = target.guestName || (target.firstName && target.lastName ? `${target.firstName} ${target.lastName}`.trim() : target.name) || toName;
    info = target.details || target;
  }

  if (!toEmail) return false;
  console.log(`🚪 [HOLD RELEASED] Sending release email to ${toEmail} for Room ${info?.roomNumber}`);
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: `"${name || 'Valued Guest'}" <${toEmail}>`,
      subject: `Courtesy Hold Released: Room ${info?.roomNumber || ''}`,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;'>
            <div style='background:#6c757d;padding:20px 24px;border-radius:8px 8px 0 0;'>
                <h2 style='color:#fff;margin:0;font-size:20px;'>PCC Home Suite Home</h2>
                <p style='color:#e2e3e5;margin:4px 0 0;font-size:13px;'>Courtesy Hold Released</p>
            </div>
            <div style='background:#fff;padding:24px;border:1px solid #e5efe6;border-top:none;border-radius:0 0 8px 8px;'>
                <p style='color:#1f2a24;'>Hi <strong>${name || 'Valued Guest'}</strong>,</p>
                <p style='color:#1f2a24;'>Your courtesy hold for <strong>Room ${info?.roomNumber || ''}</strong> has expired and exceeded the 30-minute grace period without payment confirmation.</p>
                <p style='color:#1f2a24;'>The room has now been released back to general availability. If you still wish to stay with us, you are welcome to make a new booking anytime through our website or by contacting front desk.</p>
                <p style='color:#66756b;font-size:12px;margin-top:20px;'>Thank you for choosing PCC Home Suite Home!</p>
            </div>
        </div>
      `,
      text: `Your courtesy hold for Room ${info?.roomNumber} has expired and has been released. You may create a new booking anytime.`
    });
    console.log(`✅ [SMTP SUCCESS] Courtesy hold release email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [SMTP ERROR] Failed to send courtesy hold release email to ${toEmail}:`, error.message || error);
    return false;
  }
}

