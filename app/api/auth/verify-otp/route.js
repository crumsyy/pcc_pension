import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    const otpEntered = (otp || '').trim();
    if (!/^[0-9]{6}$/.test(otpEntered)) {
      return NextResponse.json({ success: false, message: "Please enter a valid 6-digit code." }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // Look up the user
    const users = await dbQuery("SELECT userID, otp_code, otp_expires FROM user WHERE email = ?", [lowerEmail]);
    if (users.length === 0) {
      return NextResponse.json({ success: false, message: "Account not found. Please register again." }, { status: 400 });
    }

    const user = users[0];

    // Check expiration
    if (!user.otp_expires || new Date(user.otp_expires) < new Date()) {
      return NextResponse.json({ success: false, message: "This code has expired. Please request a new one." }, { status: 400 });
    }

    // Check code match
    if (otpEntered !== user.otp_code) {
      return NextResponse.json({ success: false, message: "Incorrect verification code. Please try again." }, { status: 400 });
    }

    // Activate the user account
    await dbQuery(
      "UPDATE user SET status = 'Active', otp_code = NULL, otp_expires = NULL WHERE userID = ?",
      [user.userID]
    );

    // Generate notifications
    try {
      const guests = await dbQuery("SELECT firstName, lastName FROM guest WHERE userID = ?", [user.userID]);
      const fullName = guests.length > 0 ? `${guests[0].firstName} ${guests[0].lastName}`.trim() : 'Guest';

      // 1. Guest welcome notification
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Welcome to PCC Home Suite Home!', 'Thank you for choosing PCC! Complete your profile to get the best experience.')",
        [user.userID]
      );

      // 2. Alert notifications for all Admin and Receptionist staff
      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2)");
      for (const staff of staffUsers) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'New Guest Registered', ?)",
          [staff.userID, `Guest ${fullName} (${lowerEmail}) has verified their account.`]
        );
      }
    } catch (notifErr) {
      console.error("Failed to generate verification notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Account verified successfully. You can now log in."
    });

  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json({ success: false, message: "A database error occurred. Please try again." }, { status: 500 });
  }
}
