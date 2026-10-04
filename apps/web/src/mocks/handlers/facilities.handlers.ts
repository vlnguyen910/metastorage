import {
  ALLOWED_STORAGE_UNIT_TRANSITIONS,
  ApiErrorCode,
  type ApiStorageUnit,
  type CatalogFacility,
  type Facility,
  type PaginatedResult,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { currentUser, envelope, errorBody, optionsForUnits } from "../core/http";
import { getMockDatabase, hydrateFacility, saveMockDatabase } from "../database";

export function registerFacilityHandlers(mock: MockAdapter): void {
  mock.onGet("/catalog/facilities").reply((config) => {
    const database = getMockDatabase();
    const search = String(config.params?.search ?? "")
      .trim()
      .toLowerCase();
    const city = String(config.params?.city ?? "")
      .trim()
      .toLowerCase();
    const page = Math.max(1, Number(config.params?.page ?? 1));
    const pageSize = Math.max(1, Number(config.params?.pageSize ?? 6));
    const sort = String(config.params?.sort ?? "name");
    const facilities = database.facilities
      .map((facility) => hydrateFacility(database, facility))
      .filter(
        (facility) =>
          facility.availableUnits > 0 &&
          (!search ||
            `${facility.name} ${facility.address.line1} ${facility.address.city}`
              .toLowerCase()
              .includes(search)) &&
          (!city || facility.address.city.toLowerCase().includes(city)),
      )
      .map(toCatalogFacility);
    facilities.sort((a, b) =>
      sort === "price"
        ? a.startingMonthlyPrice - b.startingMonthlyPrice
        : sort === "availability"
          ? b.availableUnits - a.availableUnits
          : a.name.localeCompare(b.name, "vi"),
    );
    const total = facilities.length;
    return [
      200,
      envelope({
        items: facilities.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      } satisfies PaginatedResult<CatalogFacility>),
    ];
  });

  mock.onGet(/\/catalog\/facilities\/[^/]+\/unit-types$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[3] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility && hydrateFacility(database, facility).availableUnits > 0
      ? [
          200,
          envelope(
            optionsForUnits(database.units.filter((unit) => unit.facilityId === facilityId)),
          ),
        ]
      : [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy facility")];
  });

  mock.onGet(/\/catalog\/facilities\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[3] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility && hydrateFacility(database, facility).availableUnits > 0
      ? [200, envelope(toCatalogFacility(hydrateFacility(database, facility)))]
      : [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy facility khả dụng")];
  });

  mock.onGet("/facilities").reply((config) => {
    const database = getMockDatabase();
    const search = String(config.params?.search ?? "")
      .trim()
      .toLowerCase();
    const city = String(config.params?.city ?? "");
    const page = Math.max(1, Number(config.params?.page ?? 1));
    const pageSize = Math.max(1, Number(config.params?.pageSize ?? 6));
    const sort = String(config.params?.sort ?? "name");
    let facilities = database.facilities.map((facility) => hydrateFacility(database, facility));
    facilities = facilities.filter(
      (facility) =>
        (!search || `${facility.name} ${facility.address.city}`.toLowerCase().includes(search)) &&
        (!city || facility.address.city === city),
    );
    facilities.sort((a, b) =>
      sort === "price"
        ? a.startingMonthlyPrice - b.startingMonthlyPrice
        : sort === "availability"
          ? b.availableUnits - a.availableUnits
          : a.name.localeCompare(b.name, "vi"),
    );
    const total = facilities.length;
    const result: PaginatedResult<Facility> = {
      items: facilities.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
    return [200, envelope(result)];
  });

  mock.onGet("/facilities/my-assignments").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];

    const assignments = user.assignedFacilityIds.map((facilityId) => {
      const facility = database.facilities.find((f) => f.id === facilityId);
      return {
        id: `assign-${user.id}-${facilityId}`,
        facilityId,
        userId: user.id,
        role: user.role,
        isActive: true,
        assignedAt: new Date(0).toISOString(),
        facilityName: facility?.name ?? facilityId,
        facilityCode: facility?.code ?? facilityId,
        userName: user.name,
        userEmail: user.email,
      };
    });
    return [200, envelope(assignments)];
  });

  mock.onGet(/\/facilities\/[^/]+\/assignments$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    const facilityId = config.url?.split("/")[2] ?? "";
    if (user.role === UserRole.FACILITY_MANAGER && !user.assignedFacilityIds.includes(facilityId)) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Không có quyền truy cập cơ sở này")];
    }
    const matchingUsers = database.users.filter((u) => u.assignedFacilityIds.includes(facilityId));
    const assignments = matchingUsers.map((u) => ({
      id: `assign-${u.id}-${facilityId}`,
      facilityId,
      userId: u.id,
      role: u.role,
      isActive: true,
      assignedAt: new Date(0).toISOString(),
      userName: u.name,
      userEmail: u.email,
    }));
    return [200, envelope(assignments)];
  });

  mock.onGet(/\/facilities\/[^/]+\/availability$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[2] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility
      ? [
          200,
          envelope(
            optionsForUnits(database.units.filter((unit) => unit.facilityId === facilityId)),
          ),
        ]
      : [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy cơ sở")];
  });

  mock.onGet(/\/facilities\/[^/]+\/units$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[2] ?? "";
    const status = config.params?.status;
    const unitTypeId = config.params?.unitTypeId;
    const search = String(config.params?.search ?? "")
      .trim()
      .toLowerCase();

    const units = database.units.filter((u) => {
      if (u.facilityId !== facilityId) return false;
      if (status && u.status !== status) return false;
      if (unitTypeId && u.unitTypeId !== unitTypeId) return false;
      if (search && !u.code.toLowerCase().includes(search)) return false;
      return true;
    });

    const apiUnits: ApiStorageUnit[] = units.map((u) => {
      const activeBooking = database.bookings.find(
        (b) =>
          b.assignedUnit?.physicalUnitId === u.id &&
          (b.status === "CONFIRMED" || b.status === "CHECKED_IN"),
      );
      return {
        id: u.id,
        facilityId: u.facilityId,
        unitTypeId: u.unitTypeId,
        code: u.code,
        floor: null,
        locationDescription: null,
        status: u.status,
        unitTypeName: u.unitType,
        unitTypeSize: u.sizeSqm,
        monthlyPrice: u.monthlyPrice,
        currentBookingId: activeBooking?.id ?? null,
        currentBookingCode: activeBooking?.bookingCode ?? null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
    });

    return [200, envelope(apiUnits)];
  });

  mock.onPatch(/\/facilities\/[^/]+\/units\/[^/]+\/status$/).reply((config) => {
    const database = getMockDatabase();
    const parts = config.url?.split("/") ?? [];
    const facilityId = parts[2];
    const unitId = parts[4];
    const body = JSON.parse(config.data || "{}");
    const targetStatus = body.status;

    const unit = database.units.find((u) => u.id === unitId);
    if (!unit) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy ô kho")];
    }
    if (unit.facilityId !== facilityId) {
      return [400, errorBody(ApiErrorCode.VALIDATION_ERROR, "Ô kho không thuộc cơ sở này")];
    }

    const activeBooking = database.bookings.find(
      (b) =>
        b.assignedUnit?.physicalUnitId === unit.id &&
        (b.status === "CONFIRMED" || b.status === "CHECKED_IN"),
    );
    if (unit.status === "RESERVED" || unit.status === "OCCUPIED" || activeBooking) {
      return [
        409,
        errorBody(
          ApiErrorCode.UNIT_ASSIGNMENT_CONFLICT,
          "Không thể thay đổi trạng thái của ô kho đang có khách thuê hoặc đang gán cho đơn đặt chỗ",
        ),
      ];
    }

    const allowed = ALLOWED_STORAGE_UNIT_TRANSITIONS[unit.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      return [
        400,
        errorBody(
          ApiErrorCode.VALIDATION_ERROR,
          `Không thể chuyển trạng thái ô kho từ "${unit.status}" sang "${targetStatus}"`,
        ),
      ];
    }

    unit.status = targetStatus;
    saveMockDatabase(database);

    const apiUnit: ApiStorageUnit = {
      id: unit.id,
      facilityId: unit.facilityId,
      unitTypeId: unit.unitTypeId,
      code: unit.code,
      floor: null,
      locationDescription: null,
      status: unit.status,
      unitTypeName: unit.unitType,
      unitTypeSize: unit.sizeSqm,
      monthlyPrice: unit.monthlyPrice,
      currentBookingId: null,
      currentBookingCode: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return [200, envelope(apiUnit)];
  });

  mock.onGet(/\/facilities\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const facilityId = config.url?.split("/")[2] ?? "";
    const facility = database.facilities.find((candidate) => candidate.id === facilityId);
    return facility
      ? [200, envelope(hydrateFacility(database, facility))]
      : [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy cơ sở")];
  });
}

function toCatalogFacility(facility: Facility): CatalogFacility {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    address: `${facility.address.line1}, ${facility.address.district}, ${facility.address.city}`,
    description: facility.description,
    availableUnits: facility.availableUnits,
    totalUnits: facility.totalUnits,
    startingMonthlyPrice: facility.startingMonthlyPrice,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}
