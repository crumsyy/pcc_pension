import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for port 465, false for other ports (like 587)
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendOtpEmail(toEmail, toName, otpCode) {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL}>`,
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
    return true;
  } catch (error) {
    console.error('OTP email error:', error);
    return false;
  }
}

export async function sendResetOtpEmail(toEmail, toName, otpCode) {
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'PCC Home Suite Home'}" <${process.env.SMTP_FROM_EMAIL}>`,
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
    return true;
  } catch (error) {
    console.error('Reset OTP email error:', error);
    return false;
  }
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
