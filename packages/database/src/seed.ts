import { queryClient } from "./client";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function seed() {
  console.log("Starting local database seeding via raw SQL client...");

  console.log("1. Seeding facilities...");
  // Fictional catalog fixtures for local testing, not real storeX locations.
  const facilitiesData = [
    { code: "HCM-01", name: "storeX Sài Gòn Central", address: "118 Nguyễn Văn Linh" },
    { code: "HCM-02", name: "storeX Bến Thành", address: "42 Lê Lai" },
    { code: "HCM-03", name: "storeX Bình Thạnh", address: "85 Điện Biên Phủ" },
    { code: "HCM-04", name: "storeX Thảo Điền", address: "28 Nguyễn Văn Hưởng" },
    { code: "HCM-05", name: "storeX Phú Nhuận", address: "156 Phan Xích Long" },
    { code: "HCM-06", name: "storeX Tân Bình", address: "67 Cộng Hòa" },
    { code: "HCM-07", name: "storeX Tân Phú", address: "93 Lũy Bán Bích" },
    { code: "HCM-08", name: "storeX Gò Vấp", address: "210 Nguyễn Oanh" },
    { code: "HCM-09", name: "storeX Bình Tân", address: "134 Tên Lửa" },
    { code: "HCM-10", name: "storeX Thủ Đức", address: "55 Võ Văn Ngân" },
  ];
  const facilities = [];
  for (const facility of facilitiesData) {
    const [row] = await queryClient`
      INSERT INTO facilities (code, name, address, description, is_active)
      VALUES (
        ${facility.code}, ${facility.name}, ${`${facility.address}, TP. Hồ Chí Minh`},
        'Dữ liệu mẫu: kho lưu trữ cho gia đình và doanh nghiệp nhỏ, kiểm soát 24/7.', true
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active
      RETURNING id, code, name
    `;
    if (!row) throw new Error(`Facility ${facility.code} was not created`);
    facilities.push(row);
  }
  const facHcm = facilities.find((facility) => facility.code === "HCM-01");

  if (!facHcm) throw new Error("HCM facility was not created");

  console.log("2. Seeding users and customer profile...");
  const [manager] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('manager@storex.vn', '0900000003', 'Lê Thu Hà (Facility Manager)', 'FACILITY_MANAGER', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET
      phone = EXCLUDED.phone,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      email_verified = EXCLUDED.email_verified
    RETURNING id, email, name
  `;

  const [customer] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('customer@storex.vn', '0900000001', 'Lê Thị Mai Linh', 'CUSTOMER', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET
      phone = EXCLUDED.phone,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      email_verified = EXCLUDED.email_verified
    RETURNING id, email, name
  `;

  const [staff] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('staff@storex.vn', '0900000002', 'Trần Quốc Huy (Facility Staff)', 'FACILITY_STAFF', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET
      phone = EXCLUDED.phone,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      email_verified = EXCLUDED.email_verified
    RETURNING id, email, name
  `;

  if (!manager || !customer || !staff) throw new Error("Seed users were not created");

  const [customerProfile] = await queryClient`
    INSERT INTO customers (user_id, full_name, email, phone)
    VALUES (${customer.id}, 'Lê Thị Mai Linh', 'customer@storex.vn', '0900000001')
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone
    RETURNING id
  `;

  if (!customerProfile) throw new Error("Customer profile was not created");

  console.log("3. Seeding facility assignments...");
  for (const assignment of [
    { userId: manager.id, role: "FACILITY_MANAGER" },
    { userId: staff.id, role: "FACILITY_STAFF" },
  ]) {
    await queryClient`
      INSERT INTO facility_assignments (user_id, facility_id, role, is_active)
      VALUES (${assignment.userId}, ${facHcm.id}, ${assignment.role}, true)
      ON CONFLICT (user_id, facility_id) DO UPDATE SET
        is_active = true,
        role = EXCLUDED.role,
        ended_at = null
    `;
  }

  console.log("4. Seeding unit types...");
  // Dimensions below are fictional seed fixtures, not measured facility inventory.
  const unitTypesData = [
    {
      code: "UT-2M",
      name: "Kho tiêu chuẩn (2 m²)",
      sizeLabel: "2 m²",
      lengthM: 2,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 900000,
    },
    {
      code: "UT-4M",
      name: "Kho tiêu chuẩn (4 m²)",
      sizeLabel: "4 m²",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1500000,
    },
    {
      code: "UT-6M",
      name: "Kho tiêu chuẩn (6 m²)",
      sizeLabel: "6 m²",
      lengthM: 3,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2100000,
    },
    {
      code: "UT-AC-4M",
      name: "Kho kiểm soát ẩm (4 m²)",
      sizeLabel: "4 m² - kiểm soát ẩm",
      lengthM: 2,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 1900000,
    },
    {
      code: "UT-1M",
      name: "Kho tiêu chuẩn (1 m²)",
      sizeLabel: "1 m²",
      lengthM: 1,
      widthM: 1,
      heightM: 2.5,
      monthlyPrice: 500000,
    },
    {
      code: "UT-8M",
      name: "Kho tiêu chuẩn (8 m²)",
      sizeLabel: "8 m²",
      lengthM: 4,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 2700000,
    },
    {
      code: "UT-10M",
      name: "Kho tiêu chuẩn (10 m²)",
      sizeLabel: "10 m²",
      lengthM: 5,
      widthM: 2,
      heightM: 2.5,
      monthlyPrice: 3300000,
    },
    {
      code: "UT-15M",
      name: "Kho tiêu chuẩn (15 m²)",
      sizeLabel: "15 m²",
      lengthM: 5,
      widthM: 3,
      heightM: 2.5,
      monthlyPrice: 4800000,
    },
  ];

  const typeMap = new Map<string, string>();
  for (const unitType of unitTypesData) {
    const [row] = await queryClient`
      INSERT INTO unit_types (code, name, size_label, length_m, width_m, height_m, monthly_price, is_active)
      VALUES (
        ${unitType.code}, ${unitType.name}, ${unitType.sizeLabel},
        ${unitType.lengthM}, ${unitType.widthM}, ${unitType.heightM}, ${unitType.monthlyPrice}, true
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        size_label = EXCLUDED.size_label,
        length_m = EXCLUDED.length_m,
        width_m = EXCLUDED.width_m,
        height_m = EXCLUDED.height_m,
        monthly_price = EXCLUDED.monthly_price,
        is_active = EXCLUDED.is_active
      RETURNING id, code
    `;
    if (!row) throw new Error(`Unit type ${unitType.code} was not created`);
    typeMap.set(row.code, row.id);
  }

  for (const facility of facilities) {
    for (const unitType of unitTypesData) {
      const unitTypeId = typeMap.get(unitType.code);
      if (!unitTypeId) throw new Error(`Unit type ${unitType.code} was not created`);
      await queryClient`
        INSERT INTO facility_unit_types (facility_id, unit_type_id, is_active)
        VALUES (${facility.id}, ${unitTypeId}, true)
        ON CONFLICT (facility_id, unit_type_id) DO UPDATE SET
          is_active = true,
          updated_at = NOW()
      `;

      // Every type is visible and bookable in the public catalog.
      await queryClient`
        INSERT INTO storage_units (facility_id, unit_type_id, code, status)
        VALUES (${facility.id}, ${unitTypeId}, ${`${facility.code}-${unitType.code}-001`}, 'AVAILABLE')
        ON CONFLICT (code) DO UPDATE SET
          facility_id = EXCLUDED.facility_id,
          unit_type_id = EXCLUDED.unit_type_id,
          status = EXCLUDED.status
      `;
    }
  }

  console.log("5. Seeding storage units...");
  const storageUnitsData = [
    { code: "HCM-01-001", typeCode: "UT-2M", status: "AVAILABLE" },
    { code: "HCM-01-002", typeCode: "UT-2M", status: "AVAILABLE" },
    { code: "HCM-01-003", typeCode: "UT-4M", status: "AVAILABLE" },
    { code: "HCM-01-004", typeCode: "UT-4M", status: "AVAILABLE" },
    { code: "HCM-01-005", typeCode: "UT-6M", status: "AVAILABLE" },
    { code: "HCM-01-006", typeCode: "UT-6M", status: "OCCUPIED" },
    { code: "HCM-01-007", typeCode: "UT-AC-4M", status: "MAINTENANCE" },
    { code: "HCM-01-008", typeCode: "UT-AC-4M", status: "INSPECTION" },
  ];

  const unitMap = new Map<string, string>();
  for (const storageUnit of storageUnitsData) {
    const typeId = typeMap.get(storageUnit.typeCode);
    if (!typeId) continue;

    const [row] = await queryClient`
      INSERT INTO storage_units (facility_id, unit_type_id, code, status)
      VALUES (${facHcm.id}, ${typeId}, ${storageUnit.code}, ${storageUnit.status})
      ON CONFLICT (code) DO UPDATE SET
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        status = EXCLUDED.status
      RETURNING id, code
    `;
    if (row) unitMap.set(row.code, row.id);
  }

  console.log("6. Seeding bookings, payments and assignments...");
  const now = Date.now();
  const bookingData = [
    {
      code: "BK-2026-0001",
      scenario: "READY_FOR_CHECK_IN",
      typeCode: "UT-2M",
      assignCode: "HCM-01-001",
      contactName: "Lê Thị Mai Linh",
      contactEmail: "customer@storex.vn",
      contactPhone: "0900000001",
      months: 1,
      monthlyRate: 900000,
      status: "CONFIRMED",
      // The customer can check in immediately after seeding.
      startOffset: -30 * 60 * 1000,
      endOffset: 90 * 60 * 1000,
      paidOffset: -2 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      code: "BK-2026-0002",
      scenario: "TOO_EARLY",
      typeCode: "UT-4M",
      assignCode: "HCM-01-004",
      contactName: "Trần Minh Đức",
      contactEmail: "duc.tran@example.com",
      contactPhone: "0988776655",
      months: 3,
      monthlyRate: 1500000,
      status: "CONFIRMED",
      // The booking is prepared, but the customer must wait until tomorrow.
      startOffset: DAY_MS,
      endOffset: DAY_MS + 2 * HOUR_MS,
      paidOffset: -6 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
    {
      code: "BK-2026-0003",
      scenario: "NO_SHOW",
      typeCode: "UT-6M",
      assignCode: null,
      contactName: "Công ty SmartLog (Anh Tuấn)",
      contactEmail: "contact@smartlog.vn",
      contactPhone: "0903112233",
      months: 6,
      monthlyRate: 2100000,
      // This fixture represents the terminal state after the grace period.
      status: "NO_SHOW",
      startOffset: -6 * HOUR_MS,
      endOffset: -4 * HOUR_MS,
      paidOffset: -24 * HOUR_MS,
      paymentStatus: "SUCCEEDED",
    },
  ];

  for (const bookingSeed of bookingData) {
    const typeId = typeMap.get(bookingSeed.typeCode);
    if (!typeId) continue;

    const checkInSlotStart = new Date(now + bookingSeed.startOffset);
    const checkInSlotEnd = new Date(now + bookingSeed.endOffset);
    const rentalEndAt = new Date(checkInSlotStart.getTime() + bookingSeed.months * 30 * DAY_MS);
    const rentalFeeAmount = bookingSeed.monthlyRate * bookingSeed.months;
    const depositAmount = bookingSeed.monthlyRate;
    const totalAmount = rentalFeeAmount + depositAmount;
    const suffix = bookingSeed.code.slice(-4).padStart(12, "0");
    const draftId = `00000000-0000-4000-8000-${suffix}`;
    const paymentId = `10000000-0000-4000-8000-${suffix}`;

    await queryClient`
      INSERT INTO reservation_drafts (
        id, facility_id, unit_type_id, check_in_at, rental_end_at, duration_months,
        contact_name, contact_email, contact_phone, status, pricing_status
      )
      VALUES (
        ${draftId}, ${facHcm.id}, ${typeId}, ${checkInSlotStart.toISOString()}, ${rentalEndAt.toISOString()}, ${bookingSeed.months},
        ${bookingSeed.contactName}, ${bookingSeed.contactEmail}, ${bookingSeed.contactPhone}, 'DRAFT', 'PRICING_NOT_CONFIGURED'
      )
      ON CONFLICT (id) DO UPDATE SET
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        check_in_at = EXCLUDED.check_in_at,
        rental_end_at = EXCLUDED.rental_end_at,
        duration_months = EXCLUDED.duration_months,
        contact_name = EXCLUDED.contact_name,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone
    `;

    const [booking] = await queryClient`
      INSERT INTO bookings (
        booking_code, customer_id, facility_id, unit_type_id, requested_months,
        contact_name, contact_email, contact_phone, check_in_slot_start, check_in_slot_end,
        rental_end_at, monthly_rate_snapshot, rental_fee_amount, deposit_amount, total_amount,
        currency, status, paid_at
      )
      VALUES (
        ${bookingSeed.code}, ${customerProfile.id}, ${facHcm.id}, ${typeId}, ${bookingSeed.months},
        ${bookingSeed.contactName}, ${bookingSeed.contactEmail}, ${bookingSeed.contactPhone},
        ${checkInSlotStart.toISOString()}, ${checkInSlotEnd.toISOString()}, ${rentalEndAt.toISOString()},
        ${bookingSeed.monthlyRate}, ${rentalFeeAmount}, ${depositAmount}, ${totalAmount},
        'VND', ${bookingSeed.status}, ${new Date(now + bookingSeed.paidOffset).toISOString()}
      )
      ON CONFLICT (booking_code) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        facility_id = EXCLUDED.facility_id,
        unit_type_id = EXCLUDED.unit_type_id,
        requested_months = EXCLUDED.requested_months,
        contact_name = EXCLUDED.contact_name,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        check_in_slot_start = EXCLUDED.check_in_slot_start,
        check_in_slot_end = EXCLUDED.check_in_slot_end,
        rental_end_at = EXCLUDED.rental_end_at,
        monthly_rate_snapshot = EXCLUDED.monthly_rate_snapshot,
        rental_fee_amount = EXCLUDED.rental_fee_amount,
        deposit_amount = EXCLUDED.deposit_amount,
        total_amount = EXCLUDED.total_amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        updated_at = NOW()
      RETURNING id
    `;

    if (!booking) continue;

    await queryClient`
      INSERT INTO payments (
        id, booking_id, draft_id, hold_token_hash, customer_id, provider, provider_payment_id,
        idempotency_key, payment_code, monthly_rate_snapshot, rental_fee_amount, deposit_amount, total_amount,
        currency, status, paid_at
      )
      VALUES (
        ${paymentId}, ${booking.id}, ${draftId}, ${`seed-hold-${bookingSeed.code}`}, ${customerProfile.id},
        'MOCK', ${`seed-payment-${bookingSeed.code}`}, ${`seed-idempotency-${bookingSeed.code}`}, ${`SEED${bookingSeed.code}`},
        ${bookingSeed.monthlyRate}, ${rentalFeeAmount}, ${depositAmount}, ${totalAmount}, 'VND',
        ${bookingSeed.paymentStatus}, ${new Date(now + bookingSeed.paidOffset).toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        booking_id = EXCLUDED.booking_id,
        draft_id = EXCLUDED.draft_id,
        payment_code = EXCLUDED.payment_code,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        updated_at = NOW()
    `;

    // A rerun restores a clean scenario after manual check-in experiments.
    await queryClient`DELETE FROM checkin_verifications WHERE booking_id = ${booking.id}`;
    await queryClient`DELETE FROM unit_assignments WHERE booking_id = ${booking.id}`;

    if (bookingSeed.assignCode) {
      const physicalUnitId = unitMap.get(bookingSeed.assignCode);
      if (physicalUnitId) {
        await queryClient`
          INSERT INTO unit_assignments (booking_id, physical_unit_id, assigned_by, status, reason)
          VALUES (
            ${booking.id}, ${physicalUnitId}, ${manager.id}, 'ACTIVE',
            ${`Seed scenario: ${bookingSeed.scenario}`}
          )
        `;
      }
    }

    console.log(`   - ${bookingSeed.code}: ${bookingSeed.scenario}`);
  }

  console.log("✅ Seeding completed successfully!");
  await queryClient.end();
}

seed().catch(async (err) => {
  console.error("❌ Seeding failed:", err);
  await queryClient.end();
  process.exit(1);
});
