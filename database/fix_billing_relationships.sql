-- =====================================================================
-- PCC Home Suite Home: Relational Billing Integrity Migration
-- Database: TiDB Cloud MySQL ('test')
-- Aligned with Capstone 1 3NF Specification (Tables 45-97 & 98-129)
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. ROOM & ROOM_RATE RELATIONAL LINKAGE & INDICES
-- Ensure room foreign keys
ALTER TABLE `room`
  ADD CONSTRAINT `fk_room_floor` FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`),
  ADD CONSTRAINT `fk_room_type` FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`);

-- Ensure room_rate foreign keys
ALTER TABLE `room_rate`
  ADD CONSTRAINT `fk_rate_roomtype` FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`),
  ADD CONSTRAINT `fk_rate_floor` FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`),
  ADD CONSTRAINT `fk_rate_breakfast` FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`);

-- Composite Index for instantaneous tuple lookup (roomTypeID, floorID, breakfastID)
CREATE INDEX IF NOT EXISTS `idx_room_rate_lookup` 
  ON `room_rate` (`roomTypeID`, `floorID`, `breakfastID`);

-- Ensure booking has breakfastID (INT, default 1), foreign key fk_booking_breakfast, and guestCount (INT, default 1)
ALTER TABLE `booking`
  ADD COLUMN IF NOT EXISTS `breakfastID` INT(11) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `guestCount` INT(11) DEFAULT 1;

-- Backfill any booking.breakfastID where NULL or inconsistent with breakfastOption
UPDATE `booking`
SET `breakfastID` = CASE 
  WHEN `breakfastOption` LIKE '%with%' AND `breakfastOption` NOT LIKE '%without%' THEN 2 
  ELSE 1 
END
WHERE `breakfastID` IS NULL OR (`breakfastOption` = 'with' AND `breakfastID` = 1);

-- Ensure foreign key from booking to breakfast_option
ALTER TABLE `booking`
  ADD CONSTRAINT `fk_booking_breakfast` FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`);

-- 2. PRODUCT & AMENITY ORDER RELATIONS & UNIT PRICE BACKFILL
ALTER TABLE `order_product`
  ADD COLUMN IF NOT EXISTS `unitPrice` DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `isComplimentary` TINYINT(1) DEFAULT 0;

ALTER TABLE `order_amenities`
  ADD COLUMN IF NOT EXISTS `unitPrice` DECIMAL(10,2) DEFAULT NULL;

-- Backfill NULL unitPrice from live catalog prices
UPDATE `order_product` op
JOIN `products` p ON p.`productID` = op.`productID`
SET op.`unitPrice` = p.`price`
WHERE op.`unitPrice` IS NULL OR op.`unitPrice` = 0;

UPDATE `order_amenities` oa
JOIN `amenities` a ON a.`amenityID` = oa.`amenityID`
SET oa.`unitPrice` = a.`price`
WHERE oa.`unitPrice` IS NULL OR oa.`unitPrice` = 0;

-- Ensure orders has bookingID, foreign key fk_orders_booking, and composite index
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `bookingID` INT(11) DEFAULT NULL;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_booking` FOREIGN KEY (`bookingID`) REFERENCES `booking` (`bookingID`);

CREATE INDEX IF NOT EXISTS `idx_orders_booking_status`
  ON `orders` (`bookingID`, `orderStatus`);

-- Enforce foreign keys for orders child tables
ALTER TABLE `order_product`
  ADD CONSTRAINT `fk_op_product` FOREIGN KEY (`productID`) REFERENCES `products` (`productID`);

ALTER TABLE `order_amenities`
  ADD CONSTRAINT `fk_oa_amenity` FOREIGN KEY (`amenityID`) REFERENCES `amenities` (`amenityID`);

-- 3. MASTER-DETAIL BILLING TABLES VALIDATION
CREATE TABLE IF NOT EXISTS `billing_room` (
  `billingRoomID` INT(11) NOT NULL AUTO_INCREMENT,
  `billingID` INT(11) NOT NULL,
  `roomRateID` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`billingRoomID`),
  KEY `fk_br_billing` (`billingID`),
  KEY `fk_br_rate` (`roomRateID`),
  CONSTRAINT `fk_br_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`) ON DELETE CASCADE,
  CONSTRAINT `fk_br_rate` FOREIGN KEY (`roomRateID`) REFERENCES `room_rate` (`roomRateID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `billing_product` (
  `billingProductID` INT(11) NOT NULL AUTO_INCREMENT,
  `billingID` INT(11) NOT NULL,
  `orderProductID` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`billingProductID`),
  KEY `fk_bp_billing` (`billingID`),
  KEY `fk_bp_orderproduct` (`orderProductID`),
  CONSTRAINT `fk_bp_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`) ON DELETE CASCADE,
  CONSTRAINT `fk_bp_orderproduct` FOREIGN KEY (`orderProductID`) REFERENCES `order_product` (`orderProductID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `billing_amenity` (
  `billingAmenityID` INT(11) NOT NULL AUTO_INCREMENT,
  `billingID` INT(11) NOT NULL,
  `orderAmenityID` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`billingAmenityID`),
  KEY `fk_ba_billing` (`billingID`),
  KEY `fk_ba_orderamenity` (`orderAmenityID`),
  CONSTRAINT `fk_ba_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`) ON DELETE CASCADE,
  CONSTRAINT `fk_ba_orderamenity` FOREIGN KEY (`orderAmenityID`) REFERENCES `order_amenities` (`orderAmenityID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Composite indices for master-detail joins
CREATE INDEX IF NOT EXISTS `idx_br_billing_rate` ON `billing_room` (`billingID`, `roomRateID`);
CREATE INDEX IF NOT EXISTS `idx_bp_billing_op` ON `billing_product` (`billingID`, `orderProductID`);
CREATE INDEX IF NOT EXISTS `idx_ba_billing_oa` ON `billing_amenity` (`billingID`, `orderAmenityID`);
CREATE INDEX IF NOT EXISTS `idx_billing_booking` ON `billing` (`bookingID`);

-- Incidental charges table validation
CREATE TABLE IF NOT EXISTS `incidental_charge` (
  `chargeID` INT(11) NOT NULL AUTO_INCREMENT,
  `bookingID` INT(11) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chargeID`),
  KEY `idx_incidental_booking` (`bookingID`),
  CONSTRAINT `fk_incidental_booking` FOREIGN KEY (`bookingID`) REFERENCES `booking` (`bookingID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. NORMALIZE ROOM OCCUPANCY LIMITS TO MATCH ROOM_TYPE 3NF DATA
UPDATE `room` r
JOIN `room_type` rt ON rt.`roomTypeID` = r.`roomTypeID`
SET r.`occupancyLimit` = rt.`maxOccupancy`;

-- 5. SYNCHRONIZE BOOKING #1 CHARGES AND AMOUNTS
UPDATE `booking`
SET `roomRate` = 1500.00,
    `roomCharge` = 4500.00,
    `remainingBalance` = 4685.00,
    `finalBalance` = 4685.00
WHERE `bookingID` = 1;

UPDATE `billing`
SET `totalAmount` = 5485.00,
    `remainingBalance` = 4685.00,
    `balance` = 4685.00
WHERE `bookingID` = 1;

SET FOREIGN_KEY_CHECKS = 1;
