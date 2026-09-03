-- =====================================================================
-- PCC Home Suite - Clean Reset of Transaction Records Only
-- Preserves: Users, Roles, Guests, Staff, Rooms, Products, Amenities,
--            Discounts, Promotions, Purchase Orders, Inventory Batches.
-- Clears: Reservations, Bookings, Orders, Billing, Payments,
--         Transactions, Borrowing, Inquiries, Notifications.
-- Resets: All Transactional Primary Keys to 1 (RV00001, BK00001, TRA00001, ORD00001)
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;

-- 1. Financial Transactions & Payments
DELETE FROM `transactions`;
ALTER TABLE `transactions` AUTO_INCREMENT = 1;

DELETE FROM `payment`;
ALTER TABLE `payment` AUTO_INCREMENT = 1;

-- 2. Billing Invoices and Charges
DELETE FROM `billing_room`;
ALTER TABLE `billing_room` AUTO_INCREMENT = 1;

DELETE FROM `billing_product`;
ALTER TABLE `billing_product` AUTO_INCREMENT = 1;

DELETE FROM `billing_amenity`;
ALTER TABLE `billing_amenity` AUTO_INCREMENT = 1;

DELETE FROM `billing`;
ALTER TABLE `billing` AUTO_INCREMENT = 1;

-- 3. Room & Cooked Meal Orders
DELETE FROM `order_product`;
ALTER TABLE `order_product` AUTO_INCREMENT = 1;

DELETE FROM `order_amenities`;
ALTER TABLE `order_amenities` AUTO_INCREMENT = 1;

DELETE FROM `orders`;
ALTER TABLE `orders` AUTO_INCREMENT = 1;

-- 4. Borrowed Items
DELETE FROM `borrow_transaction`;
ALTER TABLE `borrow_transaction` AUTO_INCREMENT = 1;

-- 5. Bookings and Guest Companions
DELETE FROM `booking_guest_details`;
ALTER TABLE `booking_guest_details` AUTO_INCREMENT = 1;

DELETE FROM `booking`;
ALTER TABLE `booking` AUTO_INCREMENT = 1;

-- 6. Reservations
DELETE FROM `reservation`;
ALTER TABLE `reservation` AUTO_INCREMENT = 1;

-- 7. Inquiries and Chatbot Messages
DELETE FROM `inquiry_message`;
ALTER TABLE `inquiry_message` AUTO_INCREMENT = 1;

DELETE FROM `inquiry`;
ALTER TABLE `inquiry` AUTO_INCREMENT = 1;

-- 8. Notifications
DELETE FROM `notification`;
ALTER TABLE `notification` AUTO_INCREMENT = 1;

-- 9. Clean transaction-related inventory movements (keeping initial stock-in audit)
DELETE FROM `inventory_movement` 
WHERE `movementType` IN ('Borrow', 'Return') 
   OR `referenceNumber` LIKE 'BK%' 
   OR `referenceNumber` LIKE 'RES%' 
   OR `referenceNumber` LIKE 'ORD%' 
   OR `referenceNumber` LIKE 'BOR%';

-- 10. Reset Room Statuses (vacate occupied and reserved rooms, preserve maintenance)
UPDATE `room` 
SET `status` = 'Available' 
WHERE `status` != 'Under Maintenance';

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- Verification Queries
SELECT 'Transactions' AS `Table`, COUNT(*) AS `RowCount` FROM `transactions`
UNION ALL
SELECT 'Payments', COUNT(*) FROM `payment`
UNION ALL
SELECT 'Billing', COUNT(*) FROM `billing`
UNION ALL
SELECT 'Orders', COUNT(*) FROM `orders`
UNION ALL
SELECT 'Bookings', COUNT(*) FROM `booking`
UNION ALL
SELECT 'Reservations', COUNT(*) FROM `reservation`
UNION ALL
SELECT 'Inquiries', COUNT(*) FROM `inquiry`
UNION ALL
SELECT 'Notifications', COUNT(*) FROM `notification`
UNION ALL
SELECT 'Active Stays / Occupied Rooms', COUNT(*) FROM `room` WHERE `status` = 'Occupied';
