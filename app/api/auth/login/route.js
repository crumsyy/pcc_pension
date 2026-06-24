import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbQuery } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // Look up user along with their role name
    const users = await dbQuery(`
      SELECT u.userID, u.email, u.password, u.status, u.roleID, r.role
      FROM user u
      JOIN role r ON r.roleID = u.roleID
      WHERE u.email = ?
    `, [lowerEmail]);

    if (users.length === 0) {
      return NextResponse.json({ success: false, message: "Incorrect email or password." }, { status: 400 });
    }

    const user = users[0];

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, message: "Incorrect email or password." }, { status: 400 });
    }

    // Check account status
    if (user.status !== 'Active') {
      // If Guest never verified OTP, redirect them to verify
      if (user.role === 'Guest') {
        return NextResponse.json({
          success: false,
          verified: false,
          email: user.email,
          message: "Please verify your account first. We have sent a code to your email."
        }, { status: 403 });
      }
      return NextResponse.json({
        success: false,
        message: "Your account is inactive. Please contact the administrator."
      }, { status: 403 });
    }

    // Fetch the person's name based on role
    let profileID = null;
    let fullName = "";

    if (user.role === 'Guest') {
      const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [user.userID]);
      if (guests.length > 0) {
        profileID = guests[0].guestID;
        fullName = `${guests[0].firstName} ${guests[0].lastName}`.trim();
      }
    } else {
      const staff = await dbQuery("SELECT staffID, firstName, lastName FROM staff WHERE userID = ?", [user.userID]);
      if (staff.length > 0) {
        profileID = staff[0].staffID;
        fullName = `${staff[0].firstName} ${staff[0].lastName}`.trim();
      }
    }

    // Define session JWT payload
    const tokenData = {
      userID: user.userID,
      email: user.email,
      role: user.role,
      roleID: user.roleID,
      fullName,
      guestID: user.role === 'Guest' ? profileID : null,
      staffID: user.role !== 'Guest' ? profileID : null
    };

    // Sign the JWT token (valid for 1 day)
    const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
    const token = jwt.sign(tokenData, secret, { expiresIn: '1d' });

    // Set Response Cookie
    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      role: user.role
    });

    response.cookies.set('pcc_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/'
    });

    return response;

  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json({ success: false, message: "A database error occurred. Please try again." }, { status: 500 });
  }
}
