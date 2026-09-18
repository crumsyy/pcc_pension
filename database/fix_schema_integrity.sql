-- =====================================================================
-- PCC Home Suite Home: 3NF Relational Integrity & Index Migration Script
-- Database: TiDB Cloud MySQL ('test')
-- Aligned with Capstone 1 Conceptual Data Model (Tables 45-97 & 98-129)
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure Missing Columns on Relational Entities
ALTER TABLE `booking` 
  ADD COLUMN IF NOT EXISTS `breakfastID` INT(11) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `guestCount` INT(11) DEFAULT 1;

-- Backfill breakfastID on booking from breakfastOption
UPDATE `booking` 
SET `breakfastID` = CASE 
  WHEN `breakfastOption` LIKE '%with%' AND `breakfastOption` NOT LIKE '%without%' THEN 2 
  ELSE 1 
END
WHERE `breakfastID` IS NULL OR `breakfastID` = 1;

ALTER TABLE `orders` 
  ADD COLUMN IF NOT EXISTS `bookingID` INT(11) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `isBreakfast` TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `hasCookedMeal` TINYINT(1) DEFAULT 0;

ALTER TABLE `order_product`
  ADD COLUMN IF NOT EXISTS `unitPrice` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `isComplimentary` TINYINT(1) DEFAULT 0;

ALTER TABLE `order_amenities`
  ADD COLUMN IF NOT EXISTS `unitPrice` DECIMAL(10,2) DEFAULT NULL;

-- Backfill unitPrice on order_amenities from amenities table
UPDATE `order_amenities` oa
JOIN `amenities` a ON a.`amenityID` = oa.`amenityID`
SET oa.`unitPrice` = a.`price`
WHERE oa.`unitPrice` IS NULL;

ALTER TABLE `payment`
  ADD COLUMN IF NOT EXISTS `changeAmount` DECIMAL(10,2) DEFAULT 0.00;

-- Sync changeAmount with existing change column
UPDATE `payment` SET `changeAmount` = `change` WHERE `changeAmount` = 0.00 AND `change` > 0;

-- 2. Add High-Frequency Composite Indices for Relational Performance
-- idx_room_rate_lookup: High-speed exact rate tuple resolution (roomTypeID, floorID, breakfastID)
CREATE INDEX IF NOT EXISTS `idx_room_rate_lookup` 
  ON `room_rate` (`roomTypeID`, `floorID`, `breakfastID`);

-- idx_booking_dates_status: Room schedule conflict check and stay lookups
CREATE INDEX IF NOT EXISTS `idx_booking_dates_status` 
  ON `booking` (`roomID`, `status`, `checkInDateTime`, `checkOutDateTime`);

-- idx_orders_booking: Scope food/product/amenity orders strictly to booking
CREATE INDEX IF NOT EXISTS `idx_orders_booking` 
  ON `orders` (`bookingID`, `orderStatus`);

-- idx_billing_booking: Master billing record lookup per stay
CREATE INDEX IF NOT EXISTS `idx_billing_booking` 
  ON `billing` (`bookingID`);

-- idx_payment_billing: Payment history aggregation per bill
CREATE INDEX IF NOT EXISTS `idx_payment_billing` 
  ON `payment` (`billingID`);

-- 3. Add Missing Foreign Key Constraints (Enforcing Referential Integrity)
-- orders(bookingID) -> booking(bookingID)
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_booking` 
  FOREIGN KEY (`bookingID`) REFERENCES `booking` (`bookingID`) ON DELETE SET NULL;

-- booking(breakfastID) -> breakfast_option(breakfastID)
ALTER TABLE `booking`
  ADD CONSTRAINT `fk_booking_breakfast` 
  FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`);

SET FOREIGN_KEY_CHECKS = 1;
