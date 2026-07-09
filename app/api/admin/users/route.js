import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const roleF = searchParams.get('role') || '';
  const statusF = searchParams.get('status') || '';

  const showArchived = searchParams.get('archived') === 'true';

  // UNION query: staff table for Admin/Receptionist, guest table for Guest role
  const sql = `
    SELECT u.userID, u.email, u.status, u.createdAt, u.roleID, r.role,
           s.staffID, s.firstName, s.lastName, s.middleName,
           s.gender, s.dateOfBirth, s.city, s.province, s.contact,
           NULL as guestID, u.suspendedUntil, u.suspensionRemarks, u.isDeleted
    FROM user u
    JOIN role r ON r.roleID = u.roleID
    LEFT JOIN staff s ON s.userID = u.userID
    WHERE r.role IN ('Administrator','Receptionist')

    UNION ALL

    SELECT u.userID, u.email, u.status, u.createdAt, u.roleID, r.role,
           NULL as staffID, g.firstName, g.lastName, g.middleName,
           g.gender, g.dateOfBirth, g.city, g.province, g.contact,
           g.guestID, u.suspendedUntil, u.suspensionRemarks, u.isDeleted
    FROM user u
    JOIN role r ON r.roleID = u.roleID
    JOIN guest g ON g.userID = u.userID
    WHERE r.role = 'Guest'
  `;

  let wrapped = `SELECT * FROM (${sql}) AS all_users`;
  const where = [];
  const params = [];

  where.push("isDeleted = ?");
  params.push(showArchived ? 1 : 0);

  if (search) {
    const like = `%${search}%`;
    where.push("(LOWER(firstName) LIKE LOWER(?) OR LOWER(lastName) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))");
    params.push(like, like, like);
  }
  if (roleF) {
    where.push("role = ?");
    params.push(roleF);
  }
  if (statusF) {
    where.push("status = ?");
    params.push(statusF);
  }

  if (where.length > 0) {
    wrapped += " WHERE " + where.join(" AND ");
  }
  wrapped += " ORDER BY createdAt DESC";

  try {
    const [users, roles] = await Promise.all([
      dbQuery(wrapped, params),
      dbQuery("SELECT * FROM role ORDER BY roleID")
    ]);
    return NextResponse.json({ users, roles, currentUser: { userID: session.userID } });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const pool = await getDbConnection();

    if (action === 'create') {
      const email = body.email.toLowerCase().trim();
      const roleID = parseInt(body.roleID);
      const fname = body.firstName.trim();
      const lname = body.lastName.trim();
      const mname = (body.middleName || '').trim();
      const gender = body.gender;
      const dob = body.dob;
      const city = body.city.trim();
      const province = body.province.trim();
      const contact = body.contact.trim();
      const passwordVal = body.password;
      const nameRegex = /^[A-Za-z\s.\-]+$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const contactRegex = /^\d{11}$/;

      if (!nameRegex.test(fname)) {
        return NextResponse.json({ error: 'First Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (!nameRegex.test(lname)) {
        return NextResponse.json({ error: 'Last Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (mname && !nameRegex.test(mname)) {
        return NextResponse.json({ error: 'Middle Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid, real email address.' }, { status: 400 });
      }
      if (!contactRegex.test(contact)) {
        return NextResponse.json({ error: 'Contact number must be exactly 11 digits.' }, { status: 400 });
      }

      // Check if email exists
      const existing = await dbQuery("SELECT userID FROM user WHERE email = ?", [email]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Email already exists.' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(passwordVal, 10);
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const [userResult] = await conn.execute(
          "INSERT INTO user(email,password,status,roleID) VALUES(?,?,'Active',?)",
          [email, hashedPassword, roleID]
        );
        const uid = userResult.insertId;

        await conn.execute(
          "INSERT INTO staff(firstName,middleName,lastName,gender,dateOfBirth,city,province,contact,email,userID) VALUES(?,?,?,?,?,?,?,?,?,?)",
          [fname, mname, lname, gender, dob, city, province, contact, email, uid]
        );

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Staff account created successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'edit') {
      const uid = parseInt(body.userID);
      const staffID = parseInt(body.staffID || 0);
      const guestID = parseInt(body.guestID || 0);
      const fname = body.firstName.trim();
      const lname = body.lastName.trim();
      const mname = (body.middleName || '').trim();
      const gender = body.gender;
      const dob = body.dob;
      const city = body.city.trim();
      const province = body.province.trim();
      const contact = body.contact.trim();
      const roleID = parseInt(body.roleID);
      const status = body.status;

      const nameRegex = /^[A-Za-z\s.\-]+$/;
      const contactRegex = /^\d{11}$/;

      if (!nameRegex.test(fname)) {
        return NextResponse.json({ error: 'First Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (!nameRegex.test(lname)) {
        return NextResponse.json({ error: 'Last Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (mname && !nameRegex.test(mname)) {
        return NextResponse.json({ error: 'Middle Name cannot contain numbers or special characters.' }, { status: 400 });
      }
      if (!contactRegex.test(contact)) {
        return NextResponse.json({ error: 'Contact number must be exactly 11 digits.' }, { status: 400 });
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        if (status === 'Active') {
          await conn.execute(
            "UPDATE user SET roleID=?, status=?, suspendedUntil=NULL, suspensionRemarks=NULL WHERE userID=?",
            [roleID, status, uid]
          );
        } else {
          await conn.execute(
            "UPDATE user SET roleID=?, status=? WHERE userID=?",
            [roleID, status, uid]
          );
        }

        if (staffID > 0) {
          await conn.execute(
            "UPDATE staff SET firstName=?,middleName=?,lastName=?,gender=?,dateOfBirth=?,city=?,province=?,contact=? WHERE staffID=?",
            [fname, mname, lname, gender, dob, city, province, contact, staffID]
          );
        } else if (guestID > 0) {
          await conn.execute(
            "UPDATE guest SET firstName=?,middleName=?,lastName=?,gender=?,dateOfBirth=?,city=?,province=?,contact=? WHERE guestID=?",
            [fname, mname, lname, gender, dob, city, province, contact, guestID]
          );
        }

        if (body.newPassword && body.newPassword.trim() !== '') {
          const hashedPassword = await bcrypt.hash(body.newPassword.trim(), 10);
          await conn.execute("UPDATE user SET password=? WHERE userID=?", [hashedPassword, uid]);
        }

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Account updated successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'toggle_status') {
      const uid = parseInt(body.userID);
      const newStatus = body.newStatus;

      if (uid === session.userID && newStatus === 'Inactive') {
        return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
      }

      if (newStatus === 'Active') {
        await dbQuery("UPDATE user SET status=?, suspendedUntil=NULL, suspensionRemarks=NULL WHERE userID=?", [newStatus, uid]);
      } else {
        await dbQuery("UPDATE user SET status=? WHERE userID=?", [newStatus, uid]);
      }
      return NextResponse.json({ success: true, message: `Account status updated to ${newStatus}.` });
    }

    if (action === 'reset_password') {
      const uid = parseInt(body.userID);
      const newPassword = body.newPassword;

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await dbQuery("UPDATE user SET password=? WHERE userID=?", [hashedPassword, uid]);
      return NextResponse.json({ success: true, message: 'Password reset successfully.' });
    }

    if (action === 'archive') {
      const uid = parseInt(body.userID);
      if (uid === session.userID) {
        return NextResponse.json({ error: 'You cannot delete/archive your own account.' }, { status: 400 });
      }

      await dbQuery("UPDATE user SET isDeleted = 1 WHERE userID = ?", [uid]);
      return NextResponse.json({ success: true, message: 'Account moved to archive successfully.' });
    }

    if (action === 'restore') {
      const uid = parseInt(body.userID);
      await dbQuery("UPDATE user SET isDeleted = 0 WHERE userID = ?", [uid]);
      return NextResponse.json({ success: true, message: 'Account restored successfully.' });
    }

    if (action === 'suspend') {
      const uid = parseInt(body.userID);
      const days = parseInt(body.days);
      const remarks = body.remarks || '';

      if (uid === session.userID) {
        return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
      }

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      await dbQuery(
        "UPDATE user SET status = 'Suspended', suspendedUntil = DATE_ADD(?, INTERVAL ? DAY), suspensionRemarks = ? WHERE userID = ?",
        [nowStr, days, remarks, uid]
      );
      return NextResponse.json({ success: true, message: `Account suspended successfully for ${days} days.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error("Failed to process user action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
