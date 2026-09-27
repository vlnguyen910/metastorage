import { queryClient } from "./client";

async function seed() {
  console.log("🌱 Starting local database seeding via raw SQL client...");

  // 1. Facilities
  console.log("1. Seeding facilities...");
  const [facHcm] = await queryClient`
    INSERT INTO facilities (code, name, address, description, is_active)
    VALUES ('HCM-01', 'storeX Sài Gòn Central', '118 Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh', 'Kho trung tâm thuận tiện cho gia đình và doanh nghiệp nhỏ, kiểm soát 24/7.', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
    RETURNING id, code, name
  `;

  const [_facHn] = await queryClient`
    INSERT INTO facilities (code, name, address, description, is_active)
    VALUES ('HN-01', 'storeX Hà Nội West', '42 Lê Quang Đạo, Phường Phú Đô, Quận Nam Từ Liêm, Hà Nội', 'Không gian lưu trữ sạch, thoáng ở phía Tây Hà Nội.', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
    RETURNING id, code, name
  `;

  // 2. Users
  console.log("2. Seeding users...");
  const [manager] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('manager@storex.vn', '0900000003', 'Lê Thu Hà (Facility Manager)', 'FACILITY_MANAGER', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    RETURNING id, email, name
  `;

  const [customer] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('customer@storex.vn', '0900000001', 'Lê Thị Mai Linh', 'CUSTOMER', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    RETURNING id, email, name
  `;

  const [staff] = await queryClient`
    INSERT INTO users (email, phone, name, role, status, email_verified)
    VALUES ('staff@storex.vn', '0900000002', 'Trần Quốc Huy (Facility Staff)', 'FACILITY_STAFF', 'ACTIVE', true)
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
    RETURNING id, email, name
  `;

  // 3. Facility Assignments
  console.log("3. Seeding facility assignments...");
  if (facHcm && manager) {
    await queryClient`
      INSERT INTO facility_assignments (user_id, facility_id, role, is_active)
      VALUES (${manager.id}, ${facHcm.id}, 'FACILITY_MANAGER', true)
      ON CONFLICT (user_id, facility_id) DO UPDATE SET is_active = true, role = EXCLUDED.role
    `;
  }
  if (facHcm && staff) {
    await queryClient`
      INSERT INTO facility_assignments (user_id, facility_id, role, is_active)
      VALUES (${staff.id}, ${facHcm.id}, 'FACILITY_STAFF', true)
      ON CONFLICT (user_id, facility_id) DO UPDATE SET is_active = true, role = EXCLUDED.role
    `;
  }

  // 4. Unit Types
  console.log("4. Seeding unit types...");
  const unitTypesData = [
    {
      code: "UT-2M",
      name: "Kho tiêu chuẩn (2 m²)",
      desc: "Diện tích 2 m², phù hợp 10-15 thùng carton",
      w: 1,
      l: 2,
      h: 2.5,
      a: 5,
    },
    {
      code: "UT-4M",
      name: "Kho tiêu chuẩn (4 m²)",
      desc: "Diện tích 4 m², phù hợp đồ đạc phòng trọ / văn phòng nhỏ",
      w: 2,
      l: 2,
      h: 2.5,
      a: 10,
    },
    {
      code: "UT-6M",
      name: "Kho tiêu chuẩn (6 m²)",
      desc: "Diện tích 6 m², phù hợp chuyển nhà 1-2 phòng ngủ",
      w: 2,
      l: 3,
      h: 2.5,
      a: 15,
    },
    {
      code: "UT-AC-4M",
      name: "Kho kiểm soát ẩm (4 m²)",
      desc: "Kho có kiểm soát nhiệt độ & độ ẩm 24/7",
      w: 2,
      l: 2,
      h: 2.5,
      a: 10,
    },
  ];

  const typeMap = new Map<string, string>();
  for (const ut of unitTypesData) {
    const [row] = await queryClient`
      INSERT INTO unit_types (code, name, description, width_m, length_m, height_m, area_m3, is_active)
      VALUES (${ut.code}, ${ut.name}, ${ut.desc}, ${ut.w}, ${ut.l}, ${ut.h}, ${ut.a}, true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
      RETURNING id, code
    `;
    if (row) typeMap.set(row.code, row.id);
  }

  // 5. Physical Units
  console.log("5. Seeding physical units...");
  const physicalUnitsData = [
    {
      code: "HCM-01-001",
      typeCode: "UT-2M",
      floor: "Tầng 1",
      desc: "Dãy A gần cửa ra vào",
      status: "AVAILABLE",
    },
    {
      code: "HCM-01-002",
      typeCode: "UT-2M",
      floor: "Tầng 1",
      desc: "Dãy A gần thang máy chở hàng",
      status: "AVAILABLE",
    },
    {
      code: "HCM-01-003",
      typeCode: "UT-4M",
      floor: "Tầng 2",
      desc: "Dãy B trung tâm hành lang",
      status: "AVAILABLE",
    },
    {
      code: "HCM-01-004",
      typeCode: "UT-4M",
      floor: "Tầng 2",
      desc: "Dãy B góc hành lang thoáng mát",
      status: "AVAILABLE",
    },
    {
      code: "HCM-01-005",
      typeCode: "UT-6M",
      floor: "Tầng 1",
      desc: "Dãy C kho rộng gần bãi đỗ xe",
      status: "AVAILABLE",
    },
    {
      code: "HCM-01-006",
      typeCode: "UT-6M",
      floor: "Tầng 1",
      desc: "Dãy C kho rộng",
      status: "OCCUPIED",
    },
    {
      code: "HCM-01-007",
      typeCode: "UT-AC-4M",
      floor: "Tầng 3",
      desc: "Khu vực kiểm soát ẩm phòng 301",
      status: "MAINTENANCE",
    },
    {
      code: "HCM-01-008",
      typeCode: "UT-AC-4M",
      floor: "Tầng 3",
      desc: "Khu vực kiểm soát ẩm phòng 302",
      status: "INSPECTION",
    },
  ];

  const unitMap = new Map<string, string>();
  for (const pu of physicalUnitsData) {
    const typeId = typeMap.get(pu.typeCode);
    if (!typeId || !facHcm) continue;

    const [row] = await queryClient`
      INSERT INTO physical_units (facility_id, unit_type_id, code, floor, location_description, status)
      VALUES (${facHcm.id}, ${typeId}, ${pu.code}, ${pu.floor}, ${pu.desc}, ${pu.status})
      ON CONFLICT (facility_id, code) DO UPDATE SET floor = EXCLUDED.floor, location_description = EXCLUDED.location_description, status = EXCLUDED.status
      RETURNING id, code
    `;
    if (row) unitMap.set(row.code, row.id);
  }

  // 6. Bookings & Assignments
  console.log("6. Seeding bookings and unit assignments...");
  const bookingData = [
    {
      code: "BK-2026-0001",
      typeCode: "UT-2M",
      contactName: "Lê Thị Mai Linh",
      contactEmail: "linh.le@example.com",
      contactPhone: "0912345678",
      months: 1,
      rate: 900000,
      fee: 900000,
      deposit: 900000,
      total: 1800000,
      status: "CONFIRMED",
      daysAhead: 2,
      durationDays: 30,
      assignCode: null,
      assignReason: null,
    },
    {
      code: "BK-2026-0002",
      typeCode: "UT-4M",
      contactName: "Trần Minh Đức",
      contactEmail: "duc.tran@example.com",
      contactPhone: "0988776655",
      months: 3,
      rate: 1500000,
      fee: 4500000,
      deposit: 1500000,
      total: 6000000,
      status: "CONFIRMED",
      daysAhead: 3,
      durationDays: 90,
      assignCode: null,
      assignReason: null,
    },
    {
      code: "BK-2026-0003",
      typeCode: "UT-6M",
      contactName: "Công ty SmartLog (Anh Tuấn)",
      contactEmail: "contact@smartlog.vn",
      contactPhone: "0903112233",
      months: 6,
      rate: 2100000,
      fee: 12600000,
      deposit: 2100000,
      total: 14700000,
      status: "CONFIRMED",
      daysAhead: 1,
      durationDays: 180,
      assignCode: "HCM-01-005",
      assignReason: "Đã gán ô kho tầng 1 gần thang máy theo yêu cầu",
    },
    {
      code: "BK-2026-0004",
      typeCode: "UT-2M",
      contactName: "Hoàng Văn Thái",
      contactEmail: "thai.hoang@example.com",
      contactPhone: "0977554433",
      months: 2,
      rate: 900000,
      fee: 1800000,
      deposit: 900000,
      total: 2700000,
      status: "CHECKED_IN",
      daysAhead: -1,
      durationDays: 60,
      assignCode: "HCM-01-002",
      assignReason: null,
    },
    {
      code: "BK-2026-0005",
      typeCode: "UT-AC-4M",
      contactName: "Nguyễn Bích Ngọc",
      contactEmail: "ngoc.nguyen@example.com",
      contactPhone: "0933221100",
      months: 1,
      rate: 1900000,
      fee: 1900000,
      deposit: 1900000,
      total: 3800000,
      status: "CONFIRMED",
      daysAhead: 5,
      durationDays: 30,
      assignCode: null,
      assignReason: null,
    },
  ];

  for (const b of bookingData) {
    const typeId = typeMap.get(b.typeCode);
    if (!typeId || !facHcm || !customer || !manager) continue;

    const now = Date.now();
    const checkInStart = new Date(now + b.daysAhead * 86400000);
    const checkInEnd = new Date(checkInStart.getTime() + 7200000);
    const rentalEnd = new Date(checkInStart.getTime() + b.durationDays * 86400000);

    const [booking] = await queryClient`
      INSERT INTO bookings (
        booking_code, customer_id, facility_id, unit_type_id, requested_months,
        contact_name, contact_email, contact_phone, check_in_slot_start, check_in_slot_end,
        rental_end_at, monthly_rate_snapshot, rental_fee_amount, deposit_amount, total_amount,
        status, paid_at
      )
      VALUES (
        ${b.code}, ${customer.id}, ${facHcm.id}, ${typeId}, ${b.months},
        ${b.contactName}, ${b.contactEmail}, ${b.contactPhone}, ${checkInStart.toISOString()}, ${checkInEnd.toISOString()},
        ${rentalEnd.toISOString()}, ${b.rate}, ${b.fee}, ${b.deposit}, ${b.total},
        ${b.status}, ${new Date(now - 3600000).toISOString()}
      )
      ON CONFLICT (booking_code) DO UPDATE SET
        contact_name = EXCLUDED.contact_name,
        status = EXCLUDED.status
      RETURNING id, booking_code
    `;

    if (booking && b.assignCode) {
      const physicalUnitId = unitMap.get(b.assignCode);
      if (physicalUnitId) {
        await queryClient`
          DELETE FROM unit_assignments WHERE booking_id = ${booking.id}
        `;
        await queryClient`
          INSERT INTO unit_assignments (booking_id, physical_unit_id, assigned_by, status, reason)
          VALUES (${booking.id}, ${physicalUnitId}, ${manager.id}, 'ACTIVE', ${b.assignReason})
        `;
      }
    }
  }

  console.log("✅ Seeding completed successfully!");
  await queryClient.end();
}

seed().catch(async (err) => {
  console.error("❌ Seeding failed:", err);
  await queryClient.end();
  process.exit(1);
});
