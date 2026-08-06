import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { sendResetOtpEmail, generateOtp } from '@/lib/mailer';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, email, otp, newPassword } = body;

    if (action === 'request_otp') {
      if (!email) {
        return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
      }

      const lowerEmail = email.trim().toLowerCase();

      // Look up user plus name based on role
      const users = await dbQuery(`
        SELECT u.userID, u.roleID, r.role,
               g.firstName AS guestFirst, g.lastName AS guestLast,
               s.firstName AS staffFirst, s.lastName AS staffLast
        FROM user u
        JOIN role r ON r.roleID = u.roleID
        LEFT JOIN guest g ON g.userID = u.userID AND r.role = 'Guest'
        LEFT JOIN staff s ON s.userID = u.userID AND r.role != 'Guest'
        WHERE u.email = ?
      `, [lowerEmail]);

      if (users.length === 0) {
        // User-friendly feedback: account not found
        return NextResponse.json({ success: false, message: "Account with this email not found." }, { status: 400 });
      }

      const user = users[0];
      const fullName = user.role === 'Guest' 
        ? `${user.guestFirst || ''} ${user.guestLast || ''}`.trim() 
        : `${user.staffFirst || ''} ${user.staffLast || ''}`.trim();

      // Generate OTP and expiry (default 10 minutes)
      const otpCode = generateOtp();
      const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');
      const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

      // Save OTP to DB
      await dbQuery(
        "UPDATE user SET otp_code = ?, otp_expires = ? WHERE userID = ?",
        [otpCode, otpExpires, user.userID]
      );

      // Send email
      const emailSent = await sendResetOtpEmail(lowerEmail, fullName || 'User', otpCode);
      if (!emailSent) {
        console.log(`⚠️ Password reset requested for ${lowerEmail}, but SMTP delivery encountered a server issue. Reset Code: ${otpCode}`);
        
        // Save notification so user can reset password inside app
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Password Reset Code Generated', ?)",
          [user.userID, `Your password reset code is: ${otpCode}. Check your email or use this code to reset your password.`]
        );
      } else {
        // Add a system notification about requested password reset
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Password Reset Requested', ?)",
          [user.userID, `A password reset code (${otpCode}) has been sent to your email.`]
        );
      }

      return NextResponse.json({ success: true, message: "Password reset code has been sent to your email." });
    }

    if (action === 'verify_otp') {
      if (!email || !otp) {
        return NextResponse.json({ success: false, message: "Email and verification code are required." }, { status: 400 });
      }

      const lowerEmail = email.trim().toLowerCase();
      const otpEntered = otp.trim();

      const users = await dbQuery("SELECT userID, otp_code, otp_expires FROM user WHERE email = ?", [lowerEmail]);
      if (users.length === 0) {
        return NextResponse.json({ success: false, message: "Account not found." }, { status: 400 });
      }

      const user = users[0];

      if (!user.otp_expires || new Date(user.otp_expires) < new Date()) {
        return NextResponse.json({ success: false, message: "This code has expired. Please request a new one." }, { status: 400 });
      }

      if (otpEntered !== user.otp_code) {
        return NextResponse.json({ success: false, message: "Incorrect code. Please try again." }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Verification code confirmed." });
    }

    if (action === 'reset_password') {
      if (!email || !otp || !newPassword) {
        return NextResponse.json({ success: false, message: "Email, code, and new password are required." }, { status: 400 });
      }

      const lowerEmail = email.trim().toLowerCase();
      const otpEntered = otp.trim();

      // Fetch user
      const users = await dbQuery("SELECT userID, otp_code, otp_expires FROM user WHERE email = ?", [lowerEmail]);
      if (users.length === 0) {
        return NextResponse.json({ success: false, message: "Account not found." }, { status: 400 });
      }

      const user = users[0];

      // Check OTP expiry
      if (!user.otp_expires || new Date(user.otp_expires) < new Date()) {
        return NextResponse.json({ success: false, message: "This code has expired. Please request a new one." }, { status: 400 });
      }

      // Check OTP code
      if (otpEntered !== user.otp_code) {
        return NextResponse.json({ success: false, message: "Incorrect code. Please try again." }, { status: 400 });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await dbQuery(
        "UPDATE user SET password = ?, otp_code = NULL, otp_expires = NULL, status = 'Active' WHERE userID = ?",
        [hashedPassword, user.userID]
      );

      // Add success notification
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Password Reset Success', 'Your account password has been successfully reset. You can now log in with your new password.')",
        [user.userID]
      );

      return NextResponse.json({ success: true, message: "Password has been reset successfully." });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Forgot password API error:", error);
    return NextResponse.json({ success: false, message: "A server error occurred. Please try again." }, { status: 500 });
  }
}
