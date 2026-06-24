-- =====================================================================
-- PCC Home Suite Home - Test Account Seeds
-- Password for all accounts: Password123!
-- Run this in phpMyAdmin > pcc_pension_db > SQL tab
-- =====================================================================

USE pcc_pension_db;

-- Clear any existing test accounts with these emails to avoid duplicate errors
DELETE FROM guest WHERE email IN ('guest@pccsuite.com');
DELETE FROM staff WHERE email IN ('admin@pccsuite.com', 'receptionist@pccsuite.com');
DELETE FROM user WHERE email IN ('admin@pccsuite.com', 'receptionist@pccsuite.com', 'guest@pccsuite.com');

-- 1. Create Administrator (roleID 1, status Active)
INSERT INTO user (email, password, status, roleID)
VALUES (
    'admin@pccsuite.com',
    '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6',
    'Active',
    1
);
INSERT INTO staff (firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID)
VALUES (
    'Test',
    '',
    'Admin',
    'Male',
    '1990-10-10',
    'Koronadal City',
    'South Cotabato',
    '09000000003',
    'admin@pccsuite.com',
    LAST_INSERT_ID()
);

-- 2. Create Receptionist (roleID 2, status Active)
INSERT INTO user (email, password, status, roleID)
VALUES (
    'receptionist@pccsuite.com',
    '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6',
    'Active',
    2
);
INSERT INTO staff (firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID)
VALUES (
    'Test',
    '',
    'Receptionist',
    'Female',
    '2000-01-01',
    'Koronadal City',
    'South Cotabato',
    '09000000001',
    'receptionist@pccsuite.com',
    LAST_INSERT_ID()
);

-- 3. Create Guest (roleID 3, status Active)
INSERT INTO user (email, password, status, roleID)
VALUES (
    'guest@pccsuite.com',
    '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6',
    'Active',
    3
);
INSERT INTO guest (firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID)
VALUES (
    'Test',
    '',
    'Guest',
    'Male',
    '1995-05-05',
    'Koronadal City',
    'South Cotabato',
    '09000000002',
    'guest@pccsuite.com',
    LAST_INSERT_ID()
);
