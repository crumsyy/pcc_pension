import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { sendOtpEmail, generateOtp } from '@/lib/mailer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // Look up user + name from guest table
    const users = await dbQuery(`
      SELECT u.userID, g.firstName, g.lastName
      FROM user u
      JOIN guest g ON g.userID = u.userID
      WHERE u.email = ?
    `, [lowerEmail]);

    if (users.length === 0) {
      return NextResponse.json({ success: false, message: "Account not found. Please register again." }, { status: 400 });
    }

    const user = users[0];

    // Generate a new OTP code & expiry
    const otpCode = generateOtp();
    const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');
    const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

    // Save new OTP code to DB
    await dbQuery(
      "UPDATE user SET otp_code = ?, otp_expires = ? WHERE userID = ?",
      [otpCode, otpExpires, user.userID]
    );

    // Send email
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const emailSent = await sendOtpEmail(lowerEmail, fullName, otpCode);

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        message: "Could not send the email. Please check your mail settings."
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "A new verification code has been sent to your email."
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json({ success: false, message: "A server error occurred. Please try again." }, { status: 500 });
  }
}
