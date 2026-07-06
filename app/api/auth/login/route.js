import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { dbQuery } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // Look up user along with their role name and profile details in a single query
    const users = await dbQuery(`
      SELECT u.userID, u.email, u.password, u.status, u.roleID, r.role,
             u.suspendedUntil, u.suspensionRemarks,
             g.guestID, g.firstName AS guestFirst, g.lastName AS guestLast,
             s.staffID, s.firstName AS staffFirst, s.lastName AS staffLast
      FROM user u
      JOIN role r ON r.roleID = u.roleID
      LEFT JOIN guest g ON g.userID = u.userID AND r.role = 'Guest'
      LEFT JOIN staff s ON s.userID = u.userID AND r.role != 'Guest'
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

    // Check suspension
    if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
      const formattedDate = new Date(user.suspendedUntil).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return NextResponse.json({
        success: false,
        message: `Your account has been suspended until ${formattedDate}. Reason: ${user.suspensionRemarks || 'No reason provided.'}`
      }, { status: 403 });
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
      profileID = user.guestID;
      fullName = `${user.guestFirst || ''} ${user.guestLast || ''}`.trim();
    } else {
      profileID = user.staffID;
      fullName = `${user.staffFirst || ''} ${user.staffLast || ''}`.trim();
    }

    // Generate unique session token for concurrent login check
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await dbQuery("UPDATE user SET sessionToken = ? WHERE userID = ?", [sessionToken, user.userID]);

    // Define session JWT payload
    const tokenData = {
      userID: user.userID,
      email: user.email,
      role: user.role,
      roleID: user.roleID,
      fullName,
      guestID: user.role === 'Guest' ? profileID : null,
      staffID: user.role !== 'Guest' ? profileID : null,
      sessionToken
    };

    // Sign the JWT token (valid for 24 hours, client-side inactivity handles auto-logout)
    const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
    const token = jwt.sign(tokenData, secret, { expiresIn: '24h' });

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
