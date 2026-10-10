# PCC HOME SUITE HOME — FUNCTIONAL REQUIREMENTS SPECIFICATION

**Capstone Project Title:** Web-Based Pension House Management System for PCC Home Suite Home
**Project Group:** Group 1 / Group 4
**Date of Alignment:** September 2026
**Document Status:** Complied & Aligned with Live Production System

---

## 1. Document Overview & Compliance Standards

This specification details the comprehensive Functional Requirements for the **PCC Home Suite Home Pension House Management System**. Every requirement has been verified and mapped directly to the active system implementation (Next.js App Router, MySQL/TiDB Database, and CSS interfaces).

### Strict Phrasing Standard:
1. **Zero System-Centric Phrasing:** The phrase *"The system shall"* is strictly excluded from all functional requirement statements.
2. **Actor-Centric Phrasing:** Every functional requirement strictly begins with the authorized human actor:
   - **Administrator Module:** Starts with `"The administrator shall be able to..."`
   - **Receptionist Module:** Starts with `"The receptionist shall be able to..."`
   - **Guest Module:** Starts with `"The guest shall be able to..."`

---

## 2. Administrator Module

### A. Admin Authentication & Account Security

**REQ001** | The administrator shall be able to log in to the administrative portal using a valid email address and password.

**REQ002** | The administrator shall be able to initiate a password reset by receiving a secure OTP sent to their registered administrative email address.

---

### B. Admin Dashboard Module

**REQ003** | The administrator shall be able to view the administrative dashboard providing real-time operational metrics and summary cards.

**REQ004** | The administrator shall be able to view the total count of rooms configured in the pension house.

**REQ005** | The administrator shall be able to view the real-time count and operational status of available rooms ready for occupancy.

**REQ006** | The administrator shall be able to view the real-time count and operational status of currently occupied rooms.

**REQ007** | The administrator shall be able to view the count and schedule of reserved rooms awaiting guest arrival.

**REQ008** | The administrator shall be able to view the count and schedule of rooms currently flagged under maintenance.

**REQ009** | The administrator shall be able to view real-time booking and reservation status summaries.

**REQ010** | The administrator shall be able to monitor housekeeping and room cleanliness statuses across all floors.

**REQ011** | The administrator shall be able to view real-time system notifications and operational alerts from the dashboard notification feed.

---

### C. User Management Module

**REQ012** | The administrator shall be able to view the complete list of system user accounts across all roles (Administrator, Receptionist, Guest).

**REQ013** | The administrator shall be able to create new staff user accounts with mandatory validation across all required fields (full name, contact number, role, and valid email).

**REQ014** | The administrator shall be able to update existing user information including profile details, contact information, and assigned system roles.

**REQ015** | The administrator shall be able to deactivate user accounts with distinct notification feedback distinguishing account deactivation from suspension.

**REQ016** | The administrator shall be able to reactivate previously deactivated user accounts.

**REQ017** | The administrator shall be able to suspend user accounts due to policy violations or security reviews, specifying a suspension duration and remarks.

**REQ018** | The administrator shall be able to view detailed user account profiles including full name, role, contact number, email address, and account status.

**REQ019** | The administrator shall be able to search and filter user accounts by name, assigned role, or account status without case sensitivity.

---

### D. Room Management Module

**REQ020** | The administrator shall be able to view the comprehensive inventory of rooms across all accommodation tiers and floors.

**REQ021** | The administrator shall be able to create new room records by assigning a room number, room type, floor, and base pricing structures.

**REQ022** | The administrator shall be able to update room details including room number, room type classification, floor assignment, and rate structures, with validation preventing duplicate room numbers.

**REQ023** | The administrator shall be able to archive room records, with strict system validation preventing archiving of rooms that are currently occupied.

**REQ024** | The administrator shall be able to restore archived rooms back into active room inventory.

**REQ025** | The administrator shall be able to search rooms by room number or filter by room type and floor without case sensitivity.

---

### E. Amenities Management Module

**REQ026** | The administrator shall be able to view the catalog of hotel amenities available for room assignment and guest ordering.

**REQ027** | The administrator shall be able to create new amenity records specifying name, unit price, stock quantity, and amenity category.

**REQ028** | The administrator shall be able to update amenity details including name, unit price, and inventory stock quantity, with charges automatically applied to guest billing folios when ordered.

**REQ029** | The administrator shall be able to archive amenity records that are no longer actively offered.

**REQ030** | The administrator shall be able to restore archived amenities back to the active catalog.

**REQ031** | The administrator shall be able to search amenities by name and category without case sensitivity.

---

### F. Products Management Module

**REQ032** | The administrator shall be able to view the complete catalog of sellable products, including snacks, beverages, and cooked meals.

**REQ033** | The administrator shall be able to create new product items across categories (Snacks, Beverages, Cooked Meals) with pricing that automatically charges to guest billing folios when ordered.

**REQ034** | The administrator shall be able to update product details including item name, unit price, product category, and available inventory stock.

**REQ035** | The administrator shall be able to archive product records from active sales.

**REQ036** | The administrator shall be able to restore archived product items back into the active catalog.

**REQ037** | The administrator shall be able to toggle daily availability for cooked meals, dynamically updating ordering menus visible to receptionists and guests.

**REQ038** | The administrator shall be able to search products by name and category without case sensitivity.

---

### G. Inventory Management Module

**REQ039** | The administrator shall be able to view real-time inventory records across all product items and room amenities.

**REQ040** | The administrator shall be able to monitor current stock levels, quantities received, and stock-in history per item.

**REQ041** | The administrator shall be able to record and view complete inventory movement history including stock-in deliveries, unit costs, and linked purchase order references.

**REQ042** | The administrator shall be able to search inventory items by name or item classification without case sensitivity.

**REQ043** | The administrator shall be able to view automated low-stock warnings when inventory items fall below their minimum safe quantity threshold.

---

### H. Purchase Order Management Module

**REQ044** | The administrator shall be able to view the comprehensive list of purchase orders along with their current fulfillment status.

**REQ045** | The administrator shall be able to create a new purchase order by specifying supplier information, line items, ordered quantities, unit costs, and expected delivery details.

**REQ046** | The administrator shall be able to cancel pending purchase orders when no longer required.

**REQ047** | The administrator shall be able to approve purchase orders, transitioning them to approved status for supplier fulfillment.

**REQ048** | The administrator shall be able to view detailed purchase order records including requested items, quantities, unit prices, total cost, order date, and status.

**REQ049** | The administrator shall be able to search purchase orders by status, item type, or creation date without case sensitivity.

**REQ050** | The administrator shall be able to enforce purchase order validation to prevent duplicate line items within the same order.

**REQ051** | The administrator shall be able to validate that all mandatory purchase order fields are completed before submission.

---

### I. Stock-In Module

**REQ052** | The administrator shall be able to receive and record stock-in transactions linked directly to approved purchase orders.

**REQ053** | The administrator shall be able to input actual delivered quantities for each line item during stock delivery reception.

**REQ054** | The administrator shall be able to verify delivered item quantities against the corresponding approved purchase order line items.

**REQ055** | The administrator shall be able to record partial deliveries and track remaining balance quantities for incomplete purchase order shipments.

**REQ056** | The administrator shall be able to enter delivery remarks and stock-in batch notes when processing received deliveries.

**REQ057** | The administrator shall be able to enforce validation ensuring received quantities do not exceed the approved purchase order quantities.

**REQ058** | The administrator shall be able to automatically update on-hand inventory balances for products and amenities upon confirming a stock-in delivery.

---

### J. Discount and Promotions Management Module

**REQ059** | The administrator shall be able to view the complete list of configured discount types and promotional offers.

**REQ060** | The administrator shall be able to create new statutory and discretionary discount types (Senior Citizen, PWD, Regular Guest, Custom).

**REQ061** | The administrator shall be able to update discount details such as discount name, description, and percentage deduction rate.

**REQ062** | The administrator shall be able to archive discount types that are no longer applicable.

**REQ063** | The administrator shall be able to restore archived discount types back to active status.

**REQ064** | The administrator shall be able to create promotional offers with designated percentage discounts, valid date ranges, and applicable room assignments.

**REQ065** | The administrator shall be able to update promotional offer details including promo name, description, discount rate, valid date ranges, and the assigned room.

**REQ066** | The administrator shall be able to archive promotional offers upon expiration or campaign conclusion.

**REQ067** | The administrator shall be able to restore archived promotional offers when campaigns are renewed.

**REQ068** | The administrator shall be able to search discounts and promotional offers by name or discount type without case sensitivity.

---

### K. Notifications and Alerts Module

**REQ069** | The administrator shall be able to view the centralized notification feed for all system-generated operational alerts.

**REQ070** | The administrator shall be able to receive instant alerts when inventory stock drops below the minimum safety threshold of any item.

**REQ071** | The administrator shall be able to view real-time notifications for verified payments and transactions processed by the receptionist.

---

### L. Reports Generation Module

**REQ072** | The administrator shall be able to access the reporting and analytics dashboard.

**REQ073** | The administrator shall be able to generate Sales and Revenue Reports analyzing gross revenue, net revenue, discount deductions, and payment methods (Cash vs. GCash).

**REQ074** | The administrator shall be able to view sales aggregations broken down by daily, monthly, and annual financial periods.

**REQ075** | The administrator shall be able to generate Room Occupancy Reports tracking room utilization rates and occupied room-nights per selected period.

**REQ076** | The administrator shall be able to filter occupancy reports by a specific room to calculate single-room occupancy rate based on occupied days versus total days in the selected period.

**REQ077** | The administrator shall be able to generate Inventory Movement Reports tracking item name, category, transaction type, quantity received, unit cost, total value, stock-in date, and the staff who recorded the transaction.

**REQ078** | The administrator shall be able to filter inventory reports by item type (Amenity vs. Product) and purchase order status.

**REQ079** | The administrator shall be able to generate Guest History Reports analyzing guest stay frequency, room preferences, and expenditure totals.

**REQ080** | The administrator shall be able to filter all operational reports by custom date ranges.

**REQ081** | The administrator shall be able to export generated reports into CSV spreadsheets and formatted PDF documents for operational auditing.

---

## 3. Receptionist Module

### A. Receptionist Login & Account Recovery

**REQ082** | The receptionist shall be able to log in to the staff portal using authorized credentials provided by the administrator.

**REQ083** | The receptionist shall be able to initiate a password reset by receiving a secure OTP verification link sent to their registered email address.

---

### B. Receptionist Dashboard Module

**REQ084** | The receptionist shall be able to view the receptionist operational dashboard with a complete front-desk summary.

**REQ085** | The receptionist shall be able to view the real-time count and visual indicators of available rooms ready for occupancy.

**REQ086** | The receptionist shall be able to view the count and details of currently occupied rooms.

**REQ087** | The receptionist shall be able to view the count and schedule of reserved rooms.

**REQ088** | The receptionist shall be able to view rooms currently flagged for maintenance or cleaning.

**REQ089** | The receptionist shall be able to view pending and confirmed room reservations awaiting check-in processing.

**REQ090** | The receptionist shall be able to view confirmed bookings scheduled for upcoming guest stays.

**REQ091** | The receptionist shall be able to monitor scheduled check-ins and check-outs for the current day.

**REQ092** | The receptionist shall be able to view incoming guest inquiries requiring staff response.

**REQ093** | The receptionist shall be able to monitor pending room service and amenity orders submitted by in-house guests.

**REQ094** | The receptionist shall be able to view transaction payment statuses and pending billing balances for active bookings.

**REQ095** | The receptionist shall be able to receive real-time operational notifications and booking alerts from the dashboard notification feed.

---

### C. Inquiry Management Module

**REQ096** | The receptionist shall be able to view the centralized list of all guest inquiries including their current status.

**REQ097** | The receptionist shall be able to respond directly to guest inquiries through a live messaging interface.

**REQ098** | The receptionist shall be able to review chatbot-forwarded inquiries together with the preceding AI conversation history.

**REQ099** | The receptionist shall be able to update inquiry status (Pending, Responded).

**REQ100** | The receptionist shall be able to review historical inquiry logs and past staff resolutions.

---

### D. Reservation Management Module

**REQ101** | The receptionist shall be able to view the list of all room reservations categorized by status.

**REQ102** | The receptionist shall be able to create new reservation records for walk-in or telephone guests with guest profile validation.

**REQ103** | The receptionist shall be able to select room types and assign specific available rooms based on guest preferences.

**REQ104** | The receptionist shall be able to verify real-time room availability for selected check-in and check-out dates.

**REQ105** | The receptionist shall be able to record reservation dates, expected arrival time, guest counts, and special requests.

**REQ106** | The receptionist shall be able to update reservation status and convert confirmed reservations directly into active bookings.

---

### E. Booking Management Module

**REQ107** | The receptionist shall be able to view confirmed reservations that are ready to be converted into active bookings.

**REQ108** | The receptionist shall be able to create walk-in bookings directly from the front desk interface without a prior reservation.

**REQ109** | The receptionist shall be able to confirm bookings by recording downpayment or partial payment verification.

**REQ110** | The receptionist shall be able to assign check-in and check-out schedules and designate assigned room numbers for confirmed bookings.

**REQ111** | The receptionist shall be able to customize breakfast options during booking creation, selecting between With Breakfast or Without Breakfast with automatic fee computation based on the selected room rate.

**REQ112** | The receptionist shall be able to cancel bookings in accordance with cancellation policies, releasing room allocations and updating billing records accordingly.

**REQ113** | The receptionist shall be able to apply eligible statutory discounts (Senior Citizen, PWD) during booking creation.

---

### F. Check-In / Check-Out Management Module

**REQ114** | The receptionist shall be able to view the real-time list of arriving guests scheduled for check-in and currently in-house guests.

**REQ115** | The receptionist shall be able to process guest check-in by verifying guest identity and transitioning the room status to Occupied.

**REQ116** | The receptionist shall be able to process guest check-out by enforcing zero-balance folio settlement before completing departure and transitioning room status to Available.

**REQ117** | The receptionist shall be able to update check-out dates and times to accommodate stay extensions or early departures with automatic folio recalculation.

**REQ118** | The receptionist shall be able to view unique guest identifiers to accurately distinguish guests who have identical names.

**REQ119** | The receptionist shall be able to search check-in and check-out records by guest name, room number, or booking reference.

---

### G. Ordering Management Module

**REQ120** | The receptionist shall be able to view all active guest room service orders for snacks, beverages, cooked meals, and extra amenities.

**REQ121** | The receptionist shall be able to create room service orders on behalf of in-house guests from the front desk.

**REQ122** | The receptionist shall be able to update active room service orders including item quantities and special instructions.

**REQ123** | The receptionist shall be able to cancel room service orders prior to fulfillment, with restrictions preventing cancellation of cooked meals already in preparation.

**REQ124** | The receptionist shall be able to update order progress status (Pending, Preparing, Served, Completed, Canceled) and revert status when adjustments are required.

**REQ125** | The receptionist shall be able to filter orders by delivery schedule or order status.

**REQ126** | The receptionist shall be able to search orders by room number, guest name, or order status.

---

### H. Billing Management Module

**REQ127** | The receptionist shall be able to access the Billing Management Module to view comprehensive guest folios per active booking.

**REQ128** | The receptionist shall be able to record amenity charges and additional service fees in the guest billing folio.

**REQ129** | The receptionist shall be able to record product charges and lost or damaged amenity fees in guest billing folios.

**REQ130** | The receptionist shall be able to view itemized total charges including room accommodation, breakfast fees, room service orders, incidentals, and applied discounts.

**REQ131** | The receptionist shall be able to manage guest billing balances by applying additional charges such as extra guests, room extensions, or damages and recording payment credits.

---

### I. Payment Management Module

**REQ132** | The receptionist shall be able to access the front desk payment terminal interface to process guest transactions.

**REQ133** | The receptionist shall be able to select an active guest booking account to process payment transactions against their folio.

**REQ134** | The receptionist shall be able to input payment amounts, supporting partial downpayments, advance deposits, and full balance settlements.

**REQ135** | The receptionist shall be able to view and apply available discount types with automatic deduction recalculation on the folio total.

**REQ136** | The receptionist shall be able to display dynamic QRPh / GCash payment codes on a secondary guest-facing monitor for contactless guest payment.

**REQ137** | The receptionist shall be able to select the payment method (Cash, GCash) and calculate cash change when applicable.

**REQ138** | The receptionist shall be able to issue payment confirmations and record transaction details linking the billing folio and guest account.

**REQ139** | The receptionist shall be able to generate and print official billing statements, payment receipts, and guest folios.

---

### J. Notifications Module

**REQ140** | The receptionist shall be able to view the centralized notification feed for front desk operations from the dashboard.

**REQ141** | The receptionist shall be able to receive real-time notifications for incoming guest inquiries requiring response.

**REQ142** | The receptionist shall be able to receive instant alerts when in-house guests submit new food, beverage, or amenity orders.

**REQ143** | The receptionist shall be able to view notifications when guest payments or downpayments are received and verified.

**REQ144** | The receptionist shall be able to receive alerts for new online reservation requests submitted by guests requiring review and room confirmation.

**REQ145** | The receptionist shall be able to receive reminders for scheduled guest check-ins, upcoming check-outs, and stay extensions.

---

## 4. Guest Module

### A. Landing Page Module

**REQ146** | The guest shall be able to access the public landing page showcasing PCC Home Suite Home's facilities, services, and room offerings.

**REQ147** | The guest shall be able to view room types, visual photo galleries, nightly rates (room only vs. with breakfast), room amenities, and hotel services.

**REQ148** | The guest shall be able to view detailed room specifications including standard capacity, maximum occupancy, bed configurations, and inclusions.

**REQ149** | The guest shall be able to view active promotional discounts, seasonal promo details, and special room package rates.

**REQ150** | The guest shall be able to navigate to guest account registration, login, or reservation booking flows from the landing page.

**REQ151** | The guest shall be able to submit general inquiries directly from the public landing page without requiring a registered account.

**REQ152** | The guest shall be able to review the dedicated Terms and Conditions and Privacy Policy documentation with mandatory scroll-to-bottom reading before acceptance.

---

### B. Account Registration Module

**REQ153** | The guest shall be able to register a personal guest account by providing full name, contact number, email address, and a secure password.

**REQ154** | The guest shall be required to scroll to the bottom and accept both the Terms and Conditions and Privacy Policy prior to completing account registration.

---

### C. Login & Password Recovery Module

**REQ155** | The guest shall be able to log in to the guest portal using their registered email address and password.

**REQ156** | The guest shall be able to initiate a self-service password reset by receiving a secure OTP via email to restore account access.

---

### D. Inquiry & AI Chatbot Module

**REQ157** | The guest shall be able to access the inquiry module featuring an interactive AI chatbot assistant for real-time automated responses.

**REQ158** | The guest shall be able to choose inquiry topics or ask free-form questions via the interactive AI chatbot.

**REQ159** | The guest shall be able to receive instantaneous automated answers from the chatbot regarding room rates, amenities, hotel policies, and check-in procedures.

**REQ160** | The guest shall be able to escalate inquiries from the AI chatbot to live receptionist assistance when complex or unresolved requests arise.

**REQ161** | The guest shall be able to view and receive real-time responses from the receptionist regarding their submitted inquiries.

**REQ162** | The guest shall be able to view their complete inquiry conversation history and current status updates.

---

### E. Reservation Module

**REQ163** | The guest shall be able to search and view real-time room availability filtered by check-in and check-out dates, guest count, and room categories.

**REQ164** | The guest shall be able to view comprehensive room details including inclusions, photo carousels, nightly rates, and cancellation terms.

**REQ165** | The guest shall be able to select a room and view transparent rate breakdowns for breakfast fees versus accommodation charges on a per-night basis.

**REQ166** | The guest shall be able to declare eligibility for statutory discounts (Senior Citizen, PWD) by providing identification details during the reservation process.

---

### F. Booking Module

**REQ167** | The guest shall be able to submit formal reservation and booking requests by entering primary guest details, occupant counts, selected room, breakfast preference, and special stay requests.

**REQ168** | The guest shall be able to view active and past booking details, stay timelines, room allocations, and payment statuses within the guest dashboard.

**REQ169** | The guest shall be able to cancel bookings through the guest portal in accordance with the pension house cancellation policy.

---

### G. Payment Module

**REQ170** | The guest shall be able to select their preferred payment method (GCash / QRPh dynamic QR code or on-site front desk payment) when settling their reservation.

**REQ171** | The guest shall be able to make online payments for required reservation downpayments or remaining stay balances by scanning the generated QRPh code.

**REQ172** | The guest shall be able to view real-time payment confirmation and updated folio balance upon successful payment verification.

**REQ173** | The guest shall be able to view and download official digital payment receipts and confirmed booking vouchers.

---

### H. Orders Module

**REQ174** | The guest shall be able to view the menu of available products (snacks, beverages, cooked meals) and amenities for ordering during their active stay.

**REQ175** | The guest shall be able to submit room service orders for food, beverages, and additional amenities directly from the guest dashboard during an active booking.

**REQ176** | The guest shall be able to view the real-time status of their submitted room service orders (Pending, Preparing, Served, Completed).

---

### I. Notifications Module

**REQ177** | The guest shall be able to view their personal notification inbox within the guest dashboard.

**REQ178** | The guest shall be able to receive instant booking confirmation notifications upon downpayment verification.

**REQ179** | The guest shall be able to receive real-time notifications regarding the status of their room service and amenity orders (Preparing, Served).

**REQ180** | The guest shall be able to receive automated check-in reminders and check-out schedule notices.

**REQ181** | The guest shall be able to receive instant alerts when reservation statuses change or when front desk staff responds to their inquiries.

---

### J. Profile Management Module

**REQ182** | The guest shall be able to view their registered personal profile information including full name, email address, contact number, gender, date of birth, and address details.

**REQ183** | The guest shall be able to update their personal profile information including contact number, city, province, gender, and date of birth.

**REQ184** | The guest shall be able to change their account password from the profile settings page by providing their current password and a new confirmed password.

---

## 5. Non-Functional Requirements

### A. Operational Requirements

**REQ185** | The system shall be accessible via modern web browsers (Google Chrome, Microsoft Edge, Mozilla Firefox) on both desktop and mobile devices without requiring a native application installation.

**REQ186** | The system shall deliver a fully responsive interface across all screen sizes — desktop, tablet, and mobile — using the Next.js CSS layout system, eliminating the need for a separate mobile application.

**REQ187** | The system shall support image uploads in JPG, PNG, and JPEG formats for room photos and guest profiles, processed through the `/api/upload` route and stored via the configured file storage provider.

**REQ188** | The system shall enforce a maximum limit of one active reservation per guest account at a time to maintain room allocation integrity and prevent booking conflicts.

**REQ189** | The system shall limit guest inquiry and chatbot message submissions to a maximum of 500 characters per input to ensure manageable response handling by receptionist staff.

**REQ190** | The system shall rely on TiDB Serverless as the cloud-hosted relational database, which provides built-in automated backups, point-in-time recovery, and data persistence without requiring manual administrator intervention.

**REQ191** | The system shall be deployed on Vercel with automatic CI/CD pipeline integration, enabling zero-downtime deployments and instant rollback capability for production releases.

---

### B. Performance Requirements

**REQ192** | The system shall load any page within 3 seconds under normal network conditions, leveraging Next.js App Router server-side rendering and static optimization to minimize client-side load times.

**REQ193** | The system shall reflect real-time updates to room availability, reservation status, and payment status immediately upon transaction completion, without requiring a manual page refresh.

**REQ194** | The system shall sustain concurrent multi-user access from administrators, receptionists, and guests simultaneously, utilizing Vercel's serverless function scaling infrastructure to handle peak traffic without degradation.

**REQ195** | The system shall generate Sales, Room Occupancy, Inventory Movement, and Guest History reports within 5 seconds for date ranges spanning up to one full year, using optimized SQL queries against the TiDB Serverless database.

**REQ196** | The system shall deliver in-app notifications and operational alerts to the intended user within 10 seconds of the triggering system event (e.g., new reservation, payment received, low stock).

---

### C. Security Requirements

**REQ197** | The system shall enforce HTTPS for all client-server data transmissions, with SSL/TLS certificates automatically provisioned and renewed by Vercel's deployment infrastructure.

**REQ198** | The system shall authenticate all user sessions using bcrypt-hashed passwords and a One-Time Password (OTP) mechanism delivered via Nodemailer to the user's registered email address for password recovery.

**REQ199** | The system shall enforce role-based access control at the Next.js API route level, ensuring that administrator, receptionist, and guest endpoints are accessible only to their respective authorized roles via session token validation.

**REQ200** | The system shall require user passwords to meet a minimum length of 8 characters, including at least one uppercase letter, one lowercase letter, one numeric digit, and one special character, enforced at the registration and password-change API level.

**REQ201** | The system shall transmit all sensitive data — including guest personally identifiable information (PII) and GCash/QRPh payment references — exclusively over encrypted TiDB Serverless database connections using TLS.

---

### D. Cultural, Regulatory, and Usability Requirements

**REQ202** | The system shall use English as the sole primary language across all user interface screens, forms, notifications, error messages, and printed documents.

**REQ203** | The system shall display all monetary values in Philippine Peso (₱) across all billing folios, payment receipts, financial reports, room rate displays, and product pricing screens.

**REQ204** | The system's online payment feature shall comply with Bangko Sentral ng Pilipinas (BSP) QRPh standards, implemented through GCash dynamic QR code generation for guest reservation downpayment and balance settlement transactions.

**REQ205** | The system shall provide a role-specific responsive layout that adapts to varying screen sizes and device types using CSS media queries, ensuring full usability for administrators on desktop, receptionists at the front desk terminal, and guests on mobile devices.

**REQ206** | The system shall present role-specific navigation menus with clearly labeled modules, quick-access dashboard summary cards, and logical information hierarchy to minimize the number of steps required for staff and guests to complete their primary tasks.
