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

    // Input Validation (matches PHP register_process.php exactly)
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
    if (!city || !nameRegex.test(city.trim())) {
      errors.push("City must contain letters only.");
    }
    if (!province || !nameRegex.test(province.trim())) {
      errors.push("Province must contain letters only.");
    }
    if (!contact || !/^[0-9]{11}$/.test(contact.trim())) {
      errors.push("Contact number must be exactly 11 digits.");
    }
    if (!email || !/\S+@\S+\.\S+/.test(email.trim())) {
      errors.push("Please provide a valid email address.");
    }
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
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

    // Check duplicate email
    const existingUsers = await dbQuery("SELECT userID FROM user WHERE email = ?", [lowerEmail]);
    if (existingUsers.length > 0) {
      return NextResponse.json({ success: false, message: "This email is already registered. Please log in instead." }, { status: 400 });
    }

    // Hash Password & Generate OTP
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = generateOtp();
    const validityMinutes = parseInt(process.env.OTP_VALIDITY_MINUTES || '10');
    
    // Calculate expiration date matching MySQL's date structure
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
            contact.trim(),
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
            contact.trim(),
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
