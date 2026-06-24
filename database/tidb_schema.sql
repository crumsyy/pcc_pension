-- =====================================================================
-- PCC Home Suite Home - TiDB Serverless Compatible Schema & Seed Data
-- Aligned with Updated Capstone 1 Conceptual Data Model (CDM)
-- =====================================================================

-- Disable foreign key checks during import to allow tables to be created in any order
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Enforce using the default 'test' database
USE test;

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `payment`;
DROP TABLE IF EXISTS `payment_method`;
DROP TABLE IF EXISTS `promotions`;
DROP TABLE IF EXISTS `discounts`;
DROP TABLE IF EXISTS `eligibility_type`;
DROP TABLE IF EXISTS `discount_type`;
DROP TABLE IF EXISTS `inventory`;
DROP TABLE IF EXISTS `purchase_order_items`;
DROP TABLE IF EXISTS `purchase_order`;
DROP TABLE IF EXISTS `billing_room`;
DROP TABLE IF EXISTS `billing_product`;
DROP TABLE IF EXISTS `order_product`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `product_category`;
DROP TABLE IF EXISTS `billing_amenity`;
DROP TABLE IF EXISTS `order_amenities`;
DROP TABLE IF EXISTS `billing`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `booking`;
DROP TABLE IF EXISTS `reservation`;
DROP TABLE IF EXISTS `room_rate`;
DROP TABLE IF EXISTS `room`;
DROP TABLE IF EXISTS `room_type`;
DROP TABLE IF EXISTS `floor`;
DROP TABLE IF EXISTS `breakfast_option`;
DROP TABLE IF EXISTS `amenities`;
DROP TABLE IF EXISTS `amenities_category`;
DROP TABLE IF EXISTS `staff`;
DROP TABLE IF EXISTS `guest`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `role`;


-- --------------------------------------------------------
-- Table structure for table `role`
-- --------------------------------------------------------
CREATE TABLE `role` (
  `roleID` int(11) NOT NULL AUTO_INCREMENT,
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`roleID`)
);

-- Dumping data for table `role`
INSERT INTO `role` (`roleID`, `role`) VALUES
(1, 'Administrator'),
(2, 'Receptionist'),
(3, 'Guest');

-- --------------------------------------------------------
-- Table structure for table `user`
-- --------------------------------------------------------
CREATE TABLE `user` (
  `userID` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `otp_code` varchar(6) DEFAULT NULL,
  `otp_expires` datetime DEFAULT NULL,
  `roleID` int(11) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userID`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_user_role` (`roleID`),
  CONSTRAINT `fk_user_role` FOREIGN KEY (`roleID`) REFERENCES `role` (`roleID`)
);

-- Dumping data for table `user`
INSERT INTO `user` (`userID`, `email`, `password`, `status`, `otp_code`, `otp_expires`, `roleID`, `createdAt`) VALUES
(3, 'loydiecaspillo@gmail.com', '$2y$10$HBI95tVJFO/Ut63UUlHMS.6Bldi0dYxWCOfTxYRRO3E5EF9Z16LHC', 'Inactive', '847192', '2026-06-17 09:26:19', 3, '2026-06-17 07:16:19'),
(4, 'crumsygaming@gmail.com', '$2y$10$dwzujVeTWr/6YCLL1oUNKe0f5EQSOP6gJy6SbJmu.V4dWUXxFW0Ce', 'Active', NULL, NULL, 3, '2026-06-18 06:00:32'),
(5, 'johnlloydvcaspillo0801@gmail.com', '$2y$10$3uaulWj41t4LEsypHo7zVOBhzg5IQWqOlw9WrQGllHao4vS.jwXwK', 'Active', NULL, NULL, 3, '2026-06-21 09:18:17'),
(6, 'kaiarrine@gmail.com', '$2y$10$efmpCEOfLMyLnro/NanhX.k5j/rpweLipot2A/EBL5hBZQrIfGAxy', 'Inactive', NULL, NULL, 2, '2026-06-22 14:17:17'),
(7, 'macanasdivine44@gmail.com', '$2y$10$4vod1m2JPgBwGELM2mn8LeJ212REK4C1LTiYta0qEWKIKI9j1zy/2', 'Inactive', NULL, NULL, 1, '2026-06-24 04:07:23'),
(8, 'admin@pccsuite.com', '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6', 'Active', NULL, NULL, 1, '2026-06-24 09:17:19'),
(9, 'receptionist@pccsuite.com', '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6', 'Active', NULL, NULL, 2, '2026-06-24 09:17:19'),
(10, 'guest@pccsuite.com', '$2b$10$R/.svym2x1KcaQfoCxt4.eCzsEnM4WA.GQ9XdnZSwajYT90V.zpi6', 'Active', NULL, NULL, 3, '2026-06-24 09:17:19');

-- --------------------------------------------------------
-- Table structure for table `guest`
-- --------------------------------------------------------
CREATE TABLE `guest` (
  `guestID` int(11) NOT NULL AUTO_INCREMENT,
  `firstName` varchar(50) NOT NULL,
  `middleName` varchar(50) DEFAULT NULL,
  `lastName` varchar(50) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `dateOfBirth` date NOT NULL,
  `city` varchar(50) NOT NULL,
  `province` varchar(50) NOT NULL,
  `contact` varchar(15) NOT NULL,
  `email` varchar(100) NOT NULL,
  `userID` int(11) NOT NULL,
  PRIMARY KEY (`guestID`),
  KEY `fk_guest_user` (`userID`),
  CONSTRAINT `fk_guest_user` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`)
);

-- Dumping data for table `guest`
INSERT INTO `guest` (`guestID`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `city`, `province`, `contact`, `email`, `userID`) VALUES
(2, 'John', 'Lloyd V', 'Caspillo', 'Male', '2004-08-01', 'Koronadal', 'South Cotabato', '09488251444', 'loydiecaspillo@gmail.com', 3),
(3, 'John', 'Lloyd V', 'Caspillo', 'Male', '2004-08-01', 'Koronadal', 'South Cotabato', '09488251444', 'crumsygaming@gmail.com', 4),
(4, 'John', 'Lloyd V', 'Caspillo', 'Male', '2004-08-01', 'Koronadal', 'South Cotabato', '09123456987', 'johnlloydvcaspillo0801@gmail.com', 5),
(5, 'Test', '', 'Guest', 'Male', '1995-05-05', 'Koronadal City', 'South Cotabato', '09000000002', 'guest@pccsuite.com', 10);

-- --------------------------------------------------------
-- Table structure for table `staff`
-- --------------------------------------------------------
CREATE TABLE `staff` (
  `staffID` int(11) NOT NULL AUTO_INCREMENT,
  `firstName` varchar(50) NOT NULL,
  `middleName` varchar(50) DEFAULT NULL,
  `lastName` varchar(50) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `dateOfBirth` date NOT NULL,
  `city` varchar(50) NOT NULL,
  `province` varchar(50) NOT NULL,
  `contact` varchar(15) NOT NULL,
  `email` varchar(100) NOT NULL,
  `userID` int(11) NOT NULL,
  PRIMARY KEY (`staffID`),
  KEY `fk_staff_user` (`userID`),
  CONSTRAINT `fk_staff_user` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`)
);

-- Dumping data for table `staff`
INSERT INTO `staff` (`staffID`, `firstName`, `middleName`, `lastName`, `gender`, `dateOfBirth`, `city`, `province`, `contact`, `email`, `userID`) VALUES
(2, 'John', 'Lloyd V.', 'Caspillo', 'Male', '2004-08-01', 'Koronadal', 'South Cotabato', '09423872732', 'kaiarrine@gmail.com', 6),
(3, 'Christian James', 'Lloyd V.', 'Paclarin', 'Male', '2020-12-06', 'Koronadal', 'South Cotabato', '09456789876', 'macanasdivine44@gmail.com', 7),
(4, 'Test', '', 'Admin', 'Male', '1990-10-10', 'Koronadal City', 'South Cotabato', '09000000003', 'admin@pccsuite.com', 8),
(5, 'Test', '', 'Receptionist', 'Female', '2000-01-01', 'Koronadal City', 'South Cotabato', '09000000001', 'receptionist@pccsuite.com', 9);

-- --------------------------------------------------------
-- Table structure for table `amenities_category`
-- --------------------------------------------------------
CREATE TABLE `amenities_category` (
  `amenityCategoryID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`amenityCategoryID`)
);

-- Dumping data for table `amenities_category`
INSERT INTO `amenities_category` (`amenityCategoryID`, `name`) VALUES
(1, 'Linen'),
(2, 'Toiletries'),
(3, 'Other');

-- --------------------------------------------------------
-- Table structure for table `amenities`
-- --------------------------------------------------------
CREATE TABLE `amenities` (
  `amenityID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `amenityCategoryID` int(11) NOT NULL,
  `lastMaintainedBy` int(11) DEFAULT NULL, -- CDM: Staff Maintains Amenities
  PRIMARY KEY (`amenityID`),
  KEY `fk_amenity_category` (`amenityCategoryID`),
  KEY `fk_amenity_staff` (`lastMaintainedBy`),
  CONSTRAINT `fk_amenity_category` FOREIGN KEY (`amenityCategoryID`) REFERENCES `amenities_category` (`amenityCategoryID`),
  CONSTRAINT `fk_amenity_staff` FOREIGN KEY (`lastMaintainedBy`) REFERENCES `staff` (`staffID`)
);

-- --------------------------------------------------------
-- Table structure for table `breakfast_option`
-- --------------------------------------------------------
CREATE TABLE `breakfast_option` (
  `breakfastID` int(11) NOT NULL AUTO_INCREMENT,
  `description` varchar(50) NOT NULL,
  PRIMARY KEY (`breakfastID`)
);

-- Dumping data for table `breakfast_option`
INSERT INTO `breakfast_option` (`breakfastID`, `description`) VALUES
(1, 'Without Breakfast'),
(2, 'With Breakfast');

-- --------------------------------------------------------
-- Table structure for table `floor`
-- --------------------------------------------------------
CREATE TABLE `floor` (
  `floorID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`floorID`)
);

-- Dumping data for table `floor`
INSERT INTO `floor` (`floorID`, `name`) VALUES
(1, 'Ground Floor'),
(2, 'Second Floor');

-- --------------------------------------------------------
-- Table structure for table `room_type`
-- --------------------------------------------------------
CREATE TABLE `room_type` (
  `roomTypeID` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `minOccupancy` int(11) NOT NULL,
  `maxOccupancy` int(11) NOT NULL,
  `extraFoam` int(11) DEFAULT 0,
  PRIMARY KEY (`roomTypeID`)
);

-- Dumping data for table `room_type`
INSERT INTO `room_type` (`roomTypeID`, `type`, `description`, `minOccupancy`, `maxOccupancy`, `extraFoam`) VALUES
(1, 'Standard Matrimonial', 'Standard room with 2 extra foam', 2, 4, 2),
(2, 'Twin Matrimonial', 'Twin bed room with 1 extra foam', 4, 5, 1),
(3, 'Deluxe Matrimonial', 'Deluxe room with 2 extra foam', 5, 7, 2);

-- --------------------------------------------------------
-- Table structure for table `room`
-- --------------------------------------------------------
CREATE TABLE `room` (
  `roomID` int(11) NOT NULL AUTO_INCREMENT,
  `roomNumber` varchar(10) NOT NULL,
  `status` enum('Available','Occupied','Reserved','Under Maintenance','Cleaning') NOT NULL DEFAULT 'Available',
  `floorID` int(11) NOT NULL,
  `roomTypeID` int(11) NOT NULL,
  `lastMaintainedBy` int(11) DEFAULT NULL, -- CDM: Staff Maintains Rooms
  PRIMARY KEY (`roomID`),
  KEY `fk_room_floor` (`floorID`),
  KEY `fk_room_type` (`roomTypeID`),
  KEY `fk_room_staff` (`lastMaintainedBy`),
  CONSTRAINT `fk_room_floor` FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`),
  CONSTRAINT `fk_room_type` FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`),
  CONSTRAINT `fk_room_staff` FOREIGN KEY (`lastMaintainedBy`) REFERENCES `staff` (`staffID`)
);

-- Dumping data for table `room`
INSERT INTO `room` (`roomID`, `roomNumber`, `status`, `floorID`, `roomTypeID`) VALUES
(1, '101', 'Occupied', 1, 3),
(2, '201', 'Available', 2, 2);

-- --------------------------------------------------------
-- Table structure for table `room_rate`
-- --------------------------------------------------------
CREATE TABLE `room_rate` (
  `roomRateID` int(11) NOT NULL AUTO_INCREMENT,
  `rate` decimal(10,2) NOT NULL,
  `roomTypeID` int(11) NOT NULL,
  `floorID` int(11) NOT NULL,
  `breakfastID` int(11) NOT NULL,
  PRIMARY KEY (`roomRateID`),
  KEY `fk_rate_roomtype` (`roomTypeID`),
  KEY `fk_rate_floor` (`floorID`),
  KEY `fk_rate_breakfast` (`breakfastID`),
  CONSTRAINT `fk_rate_breakfast` FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`),
  CONSTRAINT `fk_rate_floor` FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`),
  CONSTRAINT `fk_rate_roomtype` FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`)
);

-- Dumping data for table `room_rate`
INSERT INTO `room_rate` (`roomRateID`, `rate`, `roomTypeID`, `floorID`, `breakfastID`) VALUES
(1, 1200.00, 1, 1, 1),
(2, 1300.00, 2, 1, 1),
(3, 2100.00, 3, 1, 1),
(4, 1500.00, 1, 2, 1),
(5, 1800.00, 2, 2, 1),
(6, 2200.00, 3, 2, 1),
(7, 1500.00, 1, 1, 2),
(8, 1800.00, 2, 1, 2),
(9, 2500.00, 3, 1, 2),
(10, 1800.00, 1, 2, 2),
(11, 2200.00, 2, 2, 2),
(12, 2500.00, 3, 2, 2);

-- --------------------------------------------------------
-- Table structure for table `reservation`
-- --------------------------------------------------------
CREATE TABLE `reservation` (
  `reservationID` int(11) NOT NULL AUTO_INCREMENT,
  `reservationDateTime` datetime NOT NULL,
  `status` enum('Confirmed','Pending','Canceled') NOT NULL DEFAULT 'Pending',
  `guestID` int(11) NOT NULL,
  `roomID` int(11) NOT NULL,
  PRIMARY KEY (`reservationID`),
  KEY `fk_reservation_guest` (`guestID`),
  KEY `fk_reservation_room` (`roomID`),
  CONSTRAINT `fk_reservation_guest` FOREIGN KEY (`guestID`) REFERENCES `guest` (`guestID`),
  CONSTRAINT `fk_reservation_room` FOREIGN KEY (`roomID`) REFERENCES `room` (`roomID`)
);

-- --------------------------------------------------------
-- Table structure for table `booking`
-- --------------------------------------------------------
CREATE TABLE `booking` (
  `bookingID` int(11) NOT NULL AUTO_INCREMENT,
  `checkInDateTime` datetime NOT NULL,
  `checkOutDateTime` datetime NOT NULL,
  `status` enum('Confirmed','Checked In','Checked Out','Canceled','Pending') NOT NULL DEFAULT 'Pending',
  `reservationID` int(11) NOT NULL,
  `guestID` int(11) NOT NULL,
  `roomID` int(11) NOT NULL,
  PRIMARY KEY (`bookingID`),
  KEY `fk_booking_reservation` (`reservationID`),
  KEY `fk_booking_guest` (`guestID`),
  KEY `fk_booking_room` (`roomID`),
  CONSTRAINT `fk_booking_guest` FOREIGN KEY (`guestID`) REFERENCES `guest` (`guestID`),
  CONSTRAINT `fk_booking_reservation` FOREIGN KEY (`reservationID`) REFERENCES `reservation` (`reservationID`),
  CONSTRAINT `fk_booking_room` FOREIGN KEY (`roomID`) REFERENCES `room` (`roomID`)
);

-- --------------------------------------------------------
-- Table structure for table `orders`
-- --------------------------------------------------------
CREATE TABLE `orders` (
  `orderID` int(11) NOT NULL AUTO_INCREMENT,
  `orderStatus` enum('Pending','Preparing','Served','Completed','Canceled') NOT NULL DEFAULT 'Pending',
  `orderDateTime` datetime NOT NULL,
  `guestID` int(11) NOT NULL,
  PRIMARY KEY (`orderID`),
  KEY `fk_order_guest` (`guestID`),
  CONSTRAINT `fk_order_guest` FOREIGN KEY (`guestID`) REFERENCES `guest` (`guestID`)
);

-- --------------------------------------------------------
-- Table structure for table `billing`
-- --------------------------------------------------------
CREATE TABLE `billing` (
  `billingID` int(11) NOT NULL AUTO_INCREMENT,
  `billingDateTime` datetime NOT NULL,
  `guestID` int(11) NOT NULL,
  `bookingID` int(11) DEFAULT NULL,
  `orderID` int(11) DEFAULT NULL,
  PRIMARY KEY (`billingID`),
  KEY `fk_billing_guest` (`guestID`),
  KEY `fk_billing_booking` (`bookingID`),
  KEY `fk_billing_order` (`orderID`),
  CONSTRAINT `fk_billing_booking` FOREIGN KEY (`bookingID`) REFERENCES `booking` (`bookingID`),
  CONSTRAINT `fk_billing_guest` FOREIGN KEY (`guestID`) REFERENCES `guest` (`guestID`),
  CONSTRAINT `fk_billing_order` FOREIGN KEY (`orderID`) REFERENCES `orders` (`orderID`)
);

-- --------------------------------------------------------
-- Table structure for table `order_amenities`
-- --------------------------------------------------------
CREATE TABLE `order_amenities` (
  `orderAmenityID` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` int(11) NOT NULL,
  `orderID` int(11) NOT NULL,
  `amenityID` int(11) NOT NULL,
  PRIMARY KEY (`orderAmenityID`),
  KEY `fk_oa_order` (`orderID`),
  KEY `fk_oa_amenity` (`amenityID`),
  CONSTRAINT `fk_oa_amenity` FOREIGN KEY (`amenityID`) REFERENCES `amenities` (`amenityID`),
  CONSTRAINT `fk_oa_order` FOREIGN KEY (`orderID`) REFERENCES `orders` (`orderID`)
);

-- --------------------------------------------------------
-- Table structure for table `billing_amenity`
-- --------------------------------------------------------
CREATE TABLE `billing_amenity` (
  `billingAmenityID` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `billingID` int(11) NOT NULL,
  `orderAmenityID` int(11) NOT NULL,
  PRIMARY KEY (`billingAmenityID`),
  KEY `fk_ba_billing` (`billingID`),
  KEY `fk_ba_orderamenity` (`orderAmenityID`),
  CONSTRAINT `fk_ba_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`),
  CONSTRAINT `fk_ba_orderamenity` FOREIGN KEY (`orderAmenityID`) REFERENCES `order_amenities` (`orderAmenityID`)
);

-- --------------------------------------------------------
-- Table structure for table `product_category`
-- --------------------------------------------------------
CREATE TABLE `product_category` (
  `productCategoryID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`productCategoryID`)
);

-- Dumping data for table `product_category`
INSERT INTO `product_category` (`productCategoryID`, `name`) VALUES
(1, 'Snacks'),
(2, 'Beverages'),
(3, 'Breakfast/Silog Meals');

-- --------------------------------------------------------
-- Table structure for table `products`
-- --------------------------------------------------------
CREATE TABLE `products` (
  `productID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `productCategoryID` int(11) NOT NULL,
  `lastMaintainedBy` int(11) DEFAULT NULL, -- CDM: Staff Maintains Products
  PRIMARY KEY (`productID`),
  KEY `fk_product_category` (`productCategoryID`),
  KEY `fk_product_staff` (`lastMaintainedBy`),
  CONSTRAINT `fk_product_category` FOREIGN KEY (`productCategoryID`) REFERENCES `product_category` (`productCategoryID`),
  CONSTRAINT `fk_product_staff` FOREIGN KEY (`lastMaintainedBy`) REFERENCES `staff` (`staffID`)
);

-- --------------------------------------------------------
-- Table structure for table `order_product`
-- --------------------------------------------------------
CREATE TABLE `order_product` (
  `orderProductID` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` int(11) NOT NULL,
  `orderID` int(11) NOT NULL,
  `productID` int(11) NOT NULL,
  PRIMARY KEY (`orderProductID`),
  KEY `fk_op_order` (`orderID`),
  KEY `fk_op_product` (`productID`),
  CONSTRAINT `fk_op_order` FOREIGN KEY (`orderID`) REFERENCES `orders` (`orderID`),
  CONSTRAINT `fk_op_product` FOREIGN KEY (`productID`) REFERENCES `products` (`productID`)
);

-- --------------------------------------------------------
-- Table structure for table `billing_product`
-- --------------------------------------------------------
CREATE TABLE `billing_product` (
  `billingProductID` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `billingID` int(11) NOT NULL,
  `orderProductID` int(11) NOT NULL,
  PRIMARY KEY (`billingProductID`),
  KEY `fk_bp_billing` (`billingID`),
  KEY `fk_bp_orderproduct` (`orderProductID`),
  CONSTRAINT `fk_bp_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`),
  CONSTRAINT `fk_bp_orderproduct` FOREIGN KEY (`orderProductID`) REFERENCES `order_product` (`orderProductID`)
);

-- --------------------------------------------------------
-- Table structure for table `billing_room`
-- --------------------------------------------------------
CREATE TABLE `billing_room` (
  `billingRoomID` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `billingID` int(11) NOT NULL,
  `roomRateID` int(11) NOT NULL,
  PRIMARY KEY (`billingRoomID`),
  KEY `fk_br_billing` (`billingID`),
  KEY `fk_br_rate` (`roomRateID`),
  CONSTRAINT `fk_br_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`),
  CONSTRAINT `fk_br_rate` FOREIGN KEY (`roomRateID`) REFERENCES `room_rate` (`roomRateID`)
);

-- --------------------------------------------------------
-- Table structure for table `purchase_order`
-- --------------------------------------------------------
CREATE TABLE `purchase_order` (
  `purchaseOrderID` int(11) NOT NULL AUTO_INCREMENT,
  `orderDate` date NOT NULL,
  `status` enum('Pending','Approved','Completed') NOT NULL DEFAULT 'Pending',
  `staffID` int(11) DEFAULT NULL, -- CDM: Staff Creates Purchase Order
  PRIMARY KEY (`purchaseOrderID`),
  KEY `fk_po_staff` (`staffID`),
  CONSTRAINT `fk_po_staff` FOREIGN KEY (`staffID`) REFERENCES `staff` (`staffID`)
);

-- --------------------------------------------------------
-- Table structure for table `purchase_order_items`
-- --------------------------------------------------------
CREATE TABLE `purchase_order_items` (
  `orderItemID` int(11) NOT NULL AUTO_INCREMENT,
  `itemName` varchar(100) NOT NULL,
  `itemType` enum('Amenity','Product') NOT NULL,
  `quantity` int(11) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `purchaseOrderID` int(11) NOT NULL,
  PRIMARY KEY (`orderItemID`),
  KEY `fk_poi_po` (`purchaseOrderID`),
  CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchaseOrderID`) REFERENCES `purchase_order` (`purchaseOrderID`)
);

-- --------------------------------------------------------
-- Table structure for table `inventory`
-- --------------------------------------------------------
CREATE TABLE `inventory` (
  `inventoryID` int(11) NOT NULL AUTO_INCREMENT,
  `stockInDate` date NOT NULL,
  `quantityReceived` int(11) NOT NULL,
  `purchaseOrderID` int(11) NOT NULL,
  `amenityID` int(11) DEFAULT NULL,
  `productID` int(11) DEFAULT NULL,
  PRIMARY KEY (`inventoryID`),
  KEY `fk_inventory_po` (`purchaseOrderID`),
  KEY `fk_inventory_amenity` (`amenityID`),
  KEY `fk_inventory_product` (`productID`),
  CONSTRAINT `fk_inventory_amenity` FOREIGN KEY (`amenityID`) REFERENCES `amenities` (`amenityID`),
  CONSTRAINT `fk_inventory_po` FOREIGN KEY (`purchaseOrderID`) REFERENCES `purchase_order` (`purchaseOrderID`),
  CONSTRAINT `fk_inventory_product` FOREIGN KEY (`productID`) REFERENCES `products` (`productID`)
);

-- --------------------------------------------------------
-- Table structure for table `discount_type`
-- --------------------------------------------------------
CREATE TABLE `discount_type` (
  `discountTypeID` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(50) NOT NULL,
  PRIMARY KEY (`discountTypeID`)
);

-- Dumping data for table `discount_type`
INSERT INTO `discount_type` (`discountTypeID`, `type`) VALUES
(1, 'Standard'),
(2, 'Conditional');

-- --------------------------------------------------------
-- Table structure for table `eligibility_type`
-- --------------------------------------------------------
CREATE TABLE `eligibility_type` (
  `eligibilityTypeID` int(11) NOT NULL AUTO_INCREMENT,
  `eligibility` varchar(50) NOT NULL,
  PRIMARY KEY (`eligibilityTypeID`)
);

-- Dumping data for table `eligibility_type`
INSERT INTO `eligibility_type` (`eligibilityTypeID`, `eligibility`) VALUES
(1, 'ID-Based'),
(2, 'Booking Count');

-- --------------------------------------------------------
-- Table structure for table `discounts`
-- --------------------------------------------------------
CREATE TABLE `discounts` (
  `discountID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `percentage` int(11) NOT NULL,
  `requiredBookings` int(11) DEFAULT 0,
  `discountTypeID` int(11) NOT NULL,
  `eligibilityTypeID` int(11) NOT NULL,
  PRIMARY KEY (`discountID`),
  KEY `fk_discount_type` (`discountTypeID`),
  KEY `fk_discount_eligibility` (`eligibilityTypeID`),
  CONSTRAINT `fk_discount_eligibility` FOREIGN KEY (`eligibilityTypeID`) REFERENCES `eligibility_type` (`eligibilityTypeID`),
  CONSTRAINT `fk_discount_type` FOREIGN KEY (`discountTypeID`) REFERENCES `discount_type` (`discountTypeID`)
);

-- Dumping data for table `discounts`
INSERT INTO `discounts` (`discountID`, `name`, `description`, `percentage`, `requiredBookings`, `discountTypeID`, `eligibilityTypeID`) VALUES
(1, 'Senior Citizen Discount', '20% off for senior citizens', 20, 0, 1, 1),
(2, 'PWD Discount', '20% off for persons with disability', 20, 0, 1, 1),
(3, 'Regular Guest Discount', '5% off for repeat guests', 5, 1, 2, 2);

-- --------------------------------------------------------
-- Table structure for table `promotions`
-- --------------------------------------------------------
CREATE TABLE `promotions` (
  `promotionID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `percentage` int(11) NOT NULL,
  `roomID` int(11) DEFAULT NULL,
  PRIMARY KEY (`promotionID`),
  KEY `fk_promotion_room` (`roomID`),
  CONSTRAINT `fk_promotion_room` FOREIGN KEY (`roomID`) REFERENCES `room` (`roomID`)
);

-- --------------------------------------------------------
-- Table structure for table `payment_method`
-- --------------------------------------------------------
CREATE TABLE `payment_method` (
  `paymentMethodID` int(11) NOT NULL AUTO_INCREMENT,
  `paymentMethod` varchar(50) NOT NULL,
  PRIMARY KEY (`paymentMethodID`)
);

-- Dumping data for table `payment_method`
INSERT INTO `payment_method` (`paymentMethodID`, `paymentMethod`) VALUES
(1, 'Cash'),
(2, 'GCash');

-- --------------------------------------------------------
-- Table structure for table `payment`
-- --------------------------------------------------------
CREATE TABLE `payment` (
  `paymentID` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `cashReceived` decimal(10,2) DEFAULT 0.00,
  `change` decimal(10,2) DEFAULT 0.00,
  `billingID` int(11) NOT NULL,
  `guestID` int(11) NOT NULL,
  `staffID` int(11) DEFAULT NULL,
  `paymentMethodID` int(11) NOT NULL,
  `discountID` int(11) DEFAULT NULL,
  `promotionID` int(11) DEFAULT NULL,
  PRIMARY KEY (`paymentID`),
  KEY `fk_payment_billing` (`billingID`),
  KEY `fk_payment_guest` (`guestID`),
  KEY `fk_payment_staff` (`staffID`),
  KEY `fk_payment_method` (`paymentMethodID`),
  KEY `fk_payment_discount` (`discountID`),
  KEY `fk_payment_promotion` (`promotionID`),
  CONSTRAINT `fk_payment_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`),
  CONSTRAINT `fk_payment_discount` FOREIGN KEY (`discountID`) REFERENCES `discounts` (`discountID`),
  CONSTRAINT `fk_payment_guest` FOREIGN KEY (`guestID`) REFERENCES `guest` (`guestID`),
  CONSTRAINT `fk_payment_method` FOREIGN KEY (`paymentMethodID`) REFERENCES `payment_method` (`paymentMethodID`),
  CONSTRAINT `fk_payment_promotion` FOREIGN KEY (`promotionID`) REFERENCES `promotions` (`promotionID`),
  CONSTRAINT `fk_payment_staff` FOREIGN KEY (`staffID`) REFERENCES `staff` (`staffID`)
);

-- --------------------------------------------------------
-- Table structure for table `transactions`
-- --------------------------------------------------------
CREATE TABLE `transactions` (
  `transactionID` int(11) NOT NULL AUTO_INCREMENT,
  `transactionDateTime` datetime NOT NULL,
  `billingID` int(11) NOT NULL,
  `paymentID` int(11) NOT NULL,
  PRIMARY KEY (`transactionID`),
  KEY `fk_transaction_billing` (`billingID`),
  KEY `fk_transaction_payment` (`paymentID`),
  CONSTRAINT `fk_transaction_billing` FOREIGN KEY (`billingID`) REFERENCES `billing` (`billingID`),
  CONSTRAINT `fk_transaction_payment` FOREIGN KEY (`paymentID`) REFERENCES `payment` (`paymentID`)
);

COMMIT;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
