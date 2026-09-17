import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbQuery, getDbConnection } from '@/lib/db';
import { sendOtpEmail, generateOtp } from '@/lib/mailer';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      gender,
      dob,
      city,
      province,
      contact,
      email,
      password,
      confirmPassword,
      terms
    } = body;

    const errors = [];
    const nameRegex = /^[A-Za-zÑñ\s'\-]+$/;
    const addressRegex = /^[A-Za-z0-9Ññ\s.,'#\-]+$/;

    // Input Validation
    if (!firstName || !nameRegex.test(firstName.trim())) {
      errors.push("First name must contain letters only.");
    }
    if (middleName && middleName.trim() !== '' && !nameRegex.test(middleName.trim())) {
      errors.push("Middle name must contain letters only.");
    }
    if (!lastName || !nameRegex.test(lastName.trim())) {
      errors.push("Last name must contain letters only.");
    }
    if (!['Male', 'Female'].includes(gender)) {
      errors.push("Please select a valid gender.");
    }
    if (!dob || isNaN(Date.parse(dob))) {
      errors.push("Please provide a valid date of birth.");
    } else {
      const birthDate = new Date(dob + 'T00:00:00');
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const mDiff = today.getMonth() - birthDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        errors.push("You must be at least 18 years old to proceed.");
      }
    }
    if (!city || !addressRegex.test(city.trim())) {
      errors.push("City contains invalid characters.");
    }
    if (!province || !addressRegex.test(province.trim())) {
      errors.push("Province contains invalid characters.");
    }

    // Normalize contact number (+63 or 639XX -> 09XX)
    let cleanContact = contact ? String(contact).replace(/[^0-9]/g, '') : '';
    if (cleanContact.startsWith('639') && cleanContact.length === 12) {
      cleanContact = '0' + cleanContact.substring(2);
    }
    if (!cleanContact || !/^09[0-9]{9}$/.test(cleanContact)) {
      errors.push("Contact number must be an 11-digit mobile number starting with 09 (e.g. 09XXXXXXXXX).");
    }

    if (!email || !/\S+@\S+\.\S+/.test(email.trim())) {
      errors.push("Please provide a valid email address.");
    }

    const hasUpper = /[A-Z]/.test(password || '');
    const hasLower = /[a-z]/.test(password || '');
    const hasNumber = /[0-9]/.test(password || '');
    const hasSpecial = /[^A-Za-z0-9]/.test(password || '');
    if (!password || password.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      errors.push("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
    }
    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
    if (!terms) {
      errors.push("You must agree to the terms & conditions.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, message: errors.join(' | ') }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // Check existing email
    const existingUsers = await dbQuery("SELECT userID, status FROM user WHERE email = ?", [lowerEmail]);
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.status === 'Active') {
        return NextResponse.json({
          success: false,
          message: "This email is already registered and active. Please log in instead."
        }, { status: 400 });
      }

      // If user exists but is Inactive (never verified OTP), update credentials and refresh OTP code
      const hashedPassword = await bcrypt.hash(password, 10);
      const otpCode = generateOtp();
      const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');
      const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

      const db = await getDbConnection();
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        await connection.execute(
          "UPDATE user SET password = ?, otp_code = ?, otp_expires = ? WHERE userID = ?",
          [hashedPassword, otpCode, otpExpires, existingUser.userID]
        );

        const [existingGuests] = await connection.execute(
          "SELECT guestID FROM guest WHERE userID = ? OR LOWER(email) = ? ORDER BY guestID DESC LIMIT 1",
          [existingUser.userID, lowerEmail]
        );

        if (existingGuests && existingGuests.length > 0) {
          await connection.execute(
            "UPDATE guest SET firstName = ?, middleName = ?, lastName = ?, gender = ?, dateOfBirth = ?, city = ?, province = ?, contact = ?, email = ?, userID = ? WHERE guestID = ?",
            [
              firstName.trim(),
              middleName ? middleName.trim() : '',
              lastName.trim(),
              gender,
              dob,
              city.trim(),
              province.trim(),
              cleanContact,
              lowerEmail,
              existingUser.userID,
              existingGuests[0].guestID
            ]
          );
        } else {
          await connection.execute(
            "INSERT INTO guest (firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              firstName.trim(),
              middleName ? middleName.trim() : '',
              lastName.trim(),
              gender,
              dob,
              city.trim(),
              province.trim(),
              cleanContact,
              lowerEmail,
              existingUser.userID
            ]
          );
        }

        await connection.commit();
      } catch (dbError) {
        await connection.rollback();
        throw dbError;
      } finally {
        connection.release();
      }

      // Send Verification Email
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const emailSent = await sendOtpEmail(lowerEmail, fullName, otpCode);

      return NextResponse.json({
        success: true,
        message: "Registration details updated. Please verify your email with the verification code.",
        email: lowerEmail,
        emailSent
      });
    }

    // New Registration
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = generateOtp();
    const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');
    const otpExpires = new Date(Date.now() + validityMinutes * 60 * 1000);

    const db = await getDbConnection();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Insert into User table (Role 3 = Guest)
      const [userResult] = await connection.execute(
        "INSERT INTO user (email, password, status, otp_code, otp_expires, roleID) VALUES (?, ?, 'Inactive', ?, ?, 3)",
        [lowerEmail, hashedPassword, otpCode, otpExpires]
      );
      const userID = userResult.insertId;

      // 2. Insert or Merge into Guest table
      const [existingWalkIns] = await connection.execute(
        "SELECT guestID FROM guest WHERE LOWER(email) = ? AND userID IS NULL ORDER BY guestID DESC LIMIT 1",
        [lowerEmail]
      );
      if (existingWalkIns && existingWalkIns.length > 0) {
        const matchedGuestID = existingWalkIns[0].guestID;
        await connection.execute(
          "UPDATE guest SET firstName = ?, middleName = ?, lastName = ?, gender = ?, dateOfBirth = ?, city = ?, province = ?, contact = ?, email = ?, userID = ? WHERE guestID = ?",
          [
            firstName.trim(),
            middleName ? middleName.trim() : '',
            lastName.trim(),
            gender,
            dob,
            city.trim(),
            province.trim(),
            cleanContact,
            lowerEmail,
            userID,
            matchedGuestID
          ]
        );
      } else {
        await connection.execute(
          "INSERT INTO guest (firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            firstName.trim(),
            middleName ? middleName.trim() : '',
            lastName.trim(),
            gender,
            dob,
            city.trim(),
            province.trim(),
            cleanContact,
            lowerEmail,
            userID
          ]
        );
      }

      await connection.commit();
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }

    // Send Verification Email
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const emailSent = await sendOtpEmail(lowerEmail, fullName, otpCode);

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please verify your email.",
      email: lowerEmail,
      emailSent
    });

  } catch (error) {
    console.error("Registration DB error:", error);
    return NextResponse.json({ success: false, message: "A database error occurred. Please try again." }, { status: 500 });
  }
}
