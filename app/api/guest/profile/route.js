import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureProfilePictureSchema } from '@/lib/db';
import { sendOtpEmail, sendResetOtpEmail, generateOtp } from '@/lib/mailer';
import bcrypt from 'bcryptjs';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureProfilePictureSchema();

    const users = await dbQuery("SELECT userID, email FROM user WHERE userID = ?", [session.userID]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const guests = await dbQuery("SELECT *, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') as dateOfBirth FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      guest: guests[0],
      email: users[0].email
    });
  } catch (error) {
    console.error("GET /api/guest/profile error:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureProfilePictureSchema();
    const body = await request.json();
    const { firstName, middleName, lastName, contact, gender, dateOfBirth, city, province, profilePicture } = body;

    // Direct profile picture update or removal
    if (profilePicture !== undefined && (!firstName || !lastName)) {
      const picVal = (profilePicture || '').trim() || null;
      await dbQuery("UPDATE guest SET profilePicture = ? WHERE userID = ?", [picVal, session.userID]);
      await dbQuery("UPDATE user SET profilePicture = ? WHERE userID = ?", [picVal, session.userID]);
      return NextResponse.json({ success: true, profilePicture: picVal, message: picVal ? 'Profile picture updated!' : 'Profile picture removed.' });
    }

    if (!firstName || !lastName || !contact) {
      return NextResponse.json({ error: 'First Name, Last Name, and Contact Number are required.' }, { status: 400 });
    }

    const picVal = profilePicture !== undefined ? ((profilePicture || '').trim() || null) : undefined;
    const dobVal = dateOfBirth && String(dateOfBirth).trim() ? String(dateOfBirth).trim().substring(0, 10) : null;

    if (picVal !== undefined) {
      await dbQuery(
        `UPDATE guest 
         SET firstName = ?, middleName = ?, lastName = ?, contact = ?, gender = ?, dateOfBirth = ?, city = ?, province = ?, profilePicture = ?
         WHERE userID = ?`,
        [firstName.trim(), middleName ? middleName.trim() : '', lastName.trim(), contact.trim(), gender || 'Other', dobVal, city ? city.trim() : '', province ? province.trim() : '', picVal, session.userID]
      );
      await dbQuery("UPDATE user SET profilePicture = ? WHERE userID = ?", [picVal, session.userID]);
    } else {
      await dbQuery(
        `UPDATE guest 
         SET firstName = ?, middleName = ?, lastName = ?, contact = ?, gender = ?, dateOfBirth = ?, city = ?, province = ?
         WHERE userID = ?`,
        [firstName.trim(), middleName ? middleName.trim() : '', lastName.trim(), contact.trim(), gender || 'Other', dobVal, city ? city.trim() : '', province ? province.trim() : '', session.userID]
      );
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error("PUT /api/guest/profile error:", error);
    return NextResponse.json({ error: 'Failed to update profile: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, currentOtp, newEmail, newEmailOtp, newPassword, passwordOtp } = body;

    const users = await dbQuery("SELECT userID, email, otp_code, otp_expires FROM user WHERE userID = ?", [session.userID]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    const currentUser = users[0];
    const guests = await dbQuery("SELECT firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    const fullName = guests.length > 0 ? `${guests[0].firstName} ${guests[0].lastName}` : 'Guest';

    const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');

    // ACTION 1: Request OTP for Current Email (Step 1 of Email Change)
    if (action === 'request_email_otp_current') {
      const otpCode = generateOtp();
      const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

      await dbQuery(
        "UPDATE user SET otp_code = ?, otp_expires = ? WHERE userID = ?",
        [otpCode, otpExpires, currentUser.userID]
      );

      const sent = await sendOtpEmail(currentUser.email, fullName, otpCode);
      if (!sent) throw new Error("Failed to send OTP email.");

      return NextResponse.json({
        success: true,
        message: `OTP sent to your current email (${currentUser.email}).`
      });
    }

    // ACTION 2: Verify Current Email OTP (Step 2 of Email Change)
    if (action === 'verify_email_otp_current') {
      if (!currentOtp || currentOtp.trim() !== currentUser.otp_code) {
        return NextResponse.json({ error: 'Invalid or incorrect OTP code.' }, { status: 400 });
      }
      if (!currentUser.otp_expires || new Date(currentUser.otp_expires) < new Date()) {
        return NextResponse.json({ error: 'OTP code has expired. Please request a new code.' }, { status: 400 });
      }

      // Clear current OTP after successful verification
      await dbQuery("UPDATE user SET otp_code = NULL, otp_expires = NULL WHERE userID = ?", [currentUser.userID]);

      return NextResponse.json({
        success: true,
        message: 'Current email identity verified! Please enter your new email address.'
      });
    }

    // ACTION 3: Request OTP for New Email (Step 3 of Email Change)
    if (action === 'request_email_otp_new') {
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json({ error: 'Please enter a valid new email address.' }, { status: 400 });
      }
      const lowerNewEmail = newEmail.toLowerCase().trim();

      // Check if new email is already in use
      const existing = await dbQuery("SELECT userID FROM user WHERE email = ? AND userID != ?", [lowerNewEmail, currentUser.userID]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'This email address is already registered to another account.' }, { status: 400 });
      }

      const otpCode = generateOtp();
      const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

      await dbQuery(
        "UPDATE user SET otp_code = ?, otp_expires = ? WHERE userID = ?",
        [otpCode, otpExpires, currentUser.userID]
      );

      const sent = await sendOtpEmail(lowerNewEmail, fullName, otpCode);
      if (!sent) throw new Error("Failed to send OTP email to new address.");

      return NextResponse.json({
        success: true,
        message: `OTP sent to your proposed new email (${lowerNewEmail}).`
      });
    }

    // ACTION 4: Verify New Email OTP (Step 4 of Email Change)
    if (action === 'verify_email_otp_new') {
      if (!newEmailOtp || newEmailOtp.trim() !== currentUser.otp_code) {
        return NextResponse.json({ error: 'Invalid or incorrect OTP code for new email.' }, { status: 400 });
      }
      if (!currentUser.otp_expires || new Date(currentUser.otp_expires) < new Date()) {
        return NextResponse.json({ error: 'OTP code has expired. Please request a new code.' }, { status: 400 });
      }
      if (!newEmail) {
        return NextResponse.json({ error: 'New email address missing.' }, { status: 400 });
      }

      const lowerNewEmail = newEmail.toLowerCase().trim();

      // Update email in user table
      await dbQuery(
        "UPDATE user SET email = ?, otp_code = NULL, otp_expires = NULL WHERE userID = ?",
        [lowerNewEmail, currentUser.userID]
      );

      return NextResponse.json({
        success: true,
        message: 'Email address updated successfully! Please use your new email for future logins.'
      });
    }

    // ACTION 5: Request Password Reset OTP
    if (action === 'request_password_otp') {
      const otpCode = generateOtp();
      const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

      await dbQuery(
        "UPDATE user SET otp_code = ?, otp_expires = ? WHERE userID = ?",
        [otpCode, otpExpires, currentUser.userID]
      );

      const sent = await sendResetOtpEmail(currentUser.email, fullName, otpCode);
      if (!sent) throw new Error("Failed to send password reset OTP.");

      return NextResponse.json({
        success: true,
        message: `Password reset OTP sent to your email (${currentUser.email}).`
      });
    }

    // ACTION 6: Verify Password OTP & Update Password
    if (action === 'verify_password_otp') {
      if (!passwordOtp || passwordOtp.trim() !== currentUser.otp_code) {
        return NextResponse.json({ error: 'Invalid or incorrect OTP code.' }, { status: 400 });
      }
      if (!currentUser.otp_expires || new Date(currentUser.otp_expires) < new Date()) {
        return NextResponse.json({ error: 'OTP code has expired. Please request a new code.' }, { status: 400 });
      }
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long.' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await dbQuery(
        "UPDATE user SET password = ?, otp_code = NULL, otp_expires = NULL WHERE userID = ?",
        [hashedPassword, currentUser.userID]
      );

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully!'
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error("POST /api/guest/profile error:", error);
    return NextResponse.json({ error: 'Failed to process request: ' + error.message }, { status: 500 });
  }
}
