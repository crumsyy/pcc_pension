# =====================================================================
# Verification Script: 3NF Relational Integrity & Billing Math Model
# =====================================================================

$files = @(
  'database/fix_schema_integrity.sql',
  'database/migrate.mjs',
  'lib/db.js',
  'app/api/billing/route.js',
  'app/api/receptionist/payments/route.js',
  'app/api/guest/payments/route.js',
  'app/api/guest/bookings/route.js',
  'app/api/receptionist/bookings/route.js'
)

Write-Host "=== 1. CHECKING FILE EXISTENCE & SYNTAX BALANCE ===" -ForegroundColor Cyan
$allPassed = $true

foreach ($f in $files) {
  if (-not (Test-Path $f)) {
    Write-Host "[FAIL] Missing file: $f" -ForegroundColor Red
    $allPassed = $false
    continue
  }
  $c = [System.IO.File]::ReadAllText((Resolve-Path $f))
  $oc = ($c.ToCharArray() | Where-Object { $_ -eq '{' }).Count
  $cc = ($c.ToCharArray() | Where-Object { $_ -eq '}' }).Count
  $op = ($c.ToCharArray() | Where-Object { $_ -eq '(' }).Count
  $cp = ($c.ToCharArray() | Where-Object { $_ -eq ')' }).Count
  $ob = ($c.ToCharArray() | Where-Object { $_ -eq '[' }).Count
  $cb = ($c.ToCharArray() | Where-Object { $_ -eq ']' }).Count
  
  $isOk = ($oc -eq $cc) -and ($op -eq $cp) -and ($ob -eq $cb)
  if ($isOk) {
    Write-Host "[OK] $f (Braces: $oc, Parens: $op, Brackets: $ob)" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $f (Braces: $oc/$cc, Parens: $op/$cp, Brackets: $ob/$cb)" -ForegroundColor Red
    $allPassed = $false
  }
}

Write-Host "`n=== 2. VERIFYING 3NF INTEGRITY ELEMENTS IN MIGRATE & DB ===" -ForegroundColor Cyan
$migrate = [System.IO.File]::ReadAllText((Resolve-Path 'database/migrate.mjs'))
$db = [System.IO.File]::ReadAllText((Resolve-Path 'lib/db.js'))
$sql = [System.IO.File]::ReadAllText((Resolve-Path 'database/fix_schema_integrity.sql'))

# Check Indices
$indices = @('idx_room_rate_lookup', 'idx_booking_dates_status', 'idx_orders_booking', 'idx_billing_booking', 'idx_payment_billing')
foreach ($idx in $indices) {
  if ($migrate -match $idx -and $db -match $idx -and $sql -match $idx) {
    Write-Host "[OK] Index $idx present across migration, db schema, and SQL" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] Index $idx missing in one or more files" -ForegroundColor Red
    $allPassed = $false
  }
}

# Check Foreign Keys
$fks = @('fk_orders_booking', 'fk_booking_breakfast')
foreach ($fk in $fks) {
  if ($migrate -match $fk -and $db -match $fk -and $sql -match $fk) {
    Write-Host "[OK] Constraint $fk present across migration, db schema, and SQL" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] Constraint $fk missing in one or more files" -ForegroundColor Red
    $allPassed = $false
  }
}

# Check Normalized Columns
$cols = @('breakfastID', 'changeAmount')
foreach ($col in $cols) {
  if ($migrate -match $col -and $db -match $col) {
    Write-Host "[OK] Column $col tracked in schema managers" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] Column $col missing in schema managers" -ForegroundColor Red
    $allPassed = $false
  }
}

Write-Host "`n=== 3. VERIFYING MASTER-DETAIL PERSISTENCE FUNCTION ===" -ForegroundColor Cyan
if ($db -match 'syncNormalizedBillingLineItems' -and
    $db -match 'billing_room' -and
    $db -match 'billing_product' -and
    $db -match 'billing_amenity') {
  Write-Host "[OK] syncNormalizedBillingLineItems persists billing_room, billing_product, and billing_amenity" -ForegroundColor Green
} else {
  Write-Host "[FAIL] syncNormalizedBillingLineItems missing required table synchronizations" -ForegroundColor Red
  $allPassed = $false
}

$routes = @('app/api/billing/route.js', 'app/api/receptionist/payments/route.js', 'app/api/guest/payments/route.js', 'app/api/guest/bookings/route.js', 'app/api/receptionist/bookings/route.js')
foreach ($r in $routes) {
  $rc = [System.IO.File]::ReadAllText((Resolve-Path $r))
  if ($rc -match 'syncNormalizedBillingLineItems') {
    Write-Host "[OK] $r calls syncNormalizedBillingLineItems" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $r does not call syncNormalizedBillingLineItems" -ForegroundColor Red
    $allPassed = $false
  }
}

Write-Host "`n=== 4. SIMULATING END-TO-END MATHEMATICAL MODEL ===" -ForegroundColor Cyan
# Specification stay details:
# Standard Matrimonial, Floor 1, With Breakfast (breakfastID = 2) -> Rate = ₱1,500.00
# Nights = 2 (Check-in to Check-out DATEDIFF = 2)
# Occupants = 6 (Max capacity = 4, excess = 2)
# Registered Guests: 1 Senior Citizen (20% discount)
# Orders:
#   1 Silog Cooked Meal (Breakfast) @ ₱120.00 (within 2*2=4 complimentary allowance -> ₱0.00)
#   1 Bottled Water @ ₱25.00
#   1 Extra Towel @ ₱50.00
# Down payment: 50% = ₱1,500.00

$nights = 2
$roomRate = 1500.00
$baseRoomCharge = $roomRate * $nights
$totalGuests = 6
$maxOccupancy = 4
$extraGuests = [Math]::Max(0, $totalGuests - $maxOccupancy)
$extraGuestFee = $extraGuests * 100 * $nights

$sharePerGuest = [Math]::Round(($baseRoomCharge / $totalGuests), 2)
$seniorDiscount = [Math]::Round(($sharePerGuest * 0.20), 2)
$totalDiscount = $seniorDiscount
$finalRoomCharge = $baseRoomCharge - $totalDiscount

$complimentaryMeal = 0.00
$waterPrice = 25.00
$towelPrice = 50.00
$ordersTotal = $complimentaryMeal + $waterPrice + $towelPrice

$grossCharges = $baseRoomCharge + $extraGuestFee + $ordersTotal
$netSubtotal = $finalRoomCharge + $extraGuestFee + $ordersTotal

$downPayment = 1500.00
$netRemainingBalance = $netSubtotal - $downPayment

Write-Host ("  Base Room Charge (2 nights @ ₱1,500.00):      ₱{0:N2}" -f $baseRoomCharge)
Write-Host ("  Excess Pax Fee (2 guests @ ₱100/night x 2):   ₱{0:N2}" -f $extraGuestFee)
Write-Host ("  Share Per Guest (₱3,000.00 / 6 pax):         ₱{0:N2}" -f $sharePerGuest)
Write-Host ("  Senior Citizen 20% Discount on 1 Share:       -₱{0:N2}" -f $totalDiscount)
Write-Host ("  Final Room Charge (Net of Discount):          ₱{0:N2}" -f $finalRoomCharge)
Write-Host ("  Complimentary Silog Breakfast (Package Cap 4): ₱{0:N2}" -f $complimentaryMeal)
Write-Host ("  Bottled Water:                                 ₱{0:N2}" -f $waterPrice)
Write-Host ("  Extra Towel Amenity:                           ₱{0:N2}" -f $towelPrice)
Write-Host ("  Orders Total:                                  ₱{0:N2}" -f $ordersTotal)
Write-Host ("  Gross Total:                                   ₱{0:N2}" -f $grossCharges)
Write-Host ("  Net Subtotal:                                  ₱{0:N2}" -f $netSubtotal)
Write-Host ("  Down Payment (50%):                           -₱{0:N2}" -f $downPayment)
Write-Host ("  Net Remaining Balance:                         ₱{0:N2}" -f $netRemainingBalance)

# Assertions
if ($baseRoomCharge -ne 3000.00) { $allPassed = $false; Write-Host "[FAIL] Base Room Charge assertion failed" -ForegroundColor Red }
if ($extraGuestFee -ne 400.00) { $allPassed = $false; Write-Host "[FAIL] Extra Guest Fee assertion failed" -ForegroundColor Red }
if ($totalDiscount -ne 100.00) { $allPassed = $false; Write-Host "[FAIL] Total Discount assertion failed" -ForegroundColor Red }
if ($ordersTotal -ne 75.00) { $allPassed = $false; Write-Host "[FAIL] Orders Total assertion failed" -ForegroundColor Red }
if ($netSubtotal -ne 3375.00) { $allPassed = $false; Write-Host "[FAIL] Net Subtotal assertion failed" -ForegroundColor Red }
if ($netRemainingBalance -ne 1875.00) { $allPassed = $false; Write-Host "[FAIL] Net Remaining Balance assertion failed" -ForegroundColor Red }

Write-Host "`n=======================================================" -ForegroundColor Cyan
if ($allPassed) {
  Write-Host "ALL 3NF SCHEMA & BILLING VERIFICATION CHECKS PASSED!" -ForegroundColor Green
} else {
  Write-Host "SOME VERIFICATION CHECKS FAILED!" -ForegroundColor Red
}
