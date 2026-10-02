import {
  ApiErrorCode,
  type ConfirmReservationInput,
  PaymentStatus,
  type Reservation,
  type ReservationDraft,
  type ReservationDraftInput,
  type ReservationQuote,
  type ReservationQuoteInput,
  ReservationStatus,
  StorageUnitStatus,
  UserRole,
} from "@metastorage/contracts";
import type MockAdapter from "axios-mock-adapter";
import { addMonths, currentUser, envelope, errorBody, parseBody } from "../core/http";
import { getMockDatabase, hydrateFacility, saveMockDatabase } from "../database";

export function registerReservationHandlers(mock: MockAdapter): void {
  mock.onPost("/reservations/drafts").reply((config) => {
    const database = getMockDatabase();
    const input = parseBody<ReservationDraftInput>(config.data);
    const unit = database.units.find(
      (candidate) =>
        candidate.facilityId === input.facilityId &&
        candidate.unitTypeId === input.unitTypeId &&
        candidate.status === StorageUnitStatus.AVAILABLE,
    );
    const facility = database.facilities.find((candidate) => candidate.id === input.facilityId);
    if (!unit || !facility) {
      return [409, errorBody(ApiErrorCode.CAPACITY_UNAVAILABLE, "Unit Type không còn capacity")];
    }
    const draft: ReservationDraft = {
      id: crypto.randomUUID(),
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      checkInAt: input.checkInAt,
      rentalEndAt: addMonths(input.checkInAt, input.durationMonths),
      durationMonths: input.durationMonths,
      contact: input.contact,
      draftAccessToken: `mock-draft-token-${crypto.randomUUID()}`,
      status: "DRAFT",
      pricingStatus: "PRICING_NOT_CONFIGURED",
      pricing: null,
    };
    return [201, envelope(draft)];
  });

  mock.onPost(/\/reservations\/drafts\/[^/]+\/hold$/).reply((config) => {
    const body = parseBody<{ draftAccessToken: string }>(config.data);
    if (!body.draftAccessToken) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy reservation draft")];
    }
    const now = new Date();
    return [
      201,
      envelope({
        holdId: crypto.randomUUID(),
        holdToken: body.draftAccessToken,
        unitTypeId: crypto.randomUUID(),
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        status: "ACTIVE",
      }),
    ];
  });

  mock.onPost(/\/reservations\/drafts\/[^/]+\/pay$/).reply((config) => {
    const input = parseBody<{ paymentMethodToken?: string }>(config.data);
    if (input.paymentMethodToken === "fail") {
      return [402, errorBody(ApiErrorCode.PAYMENT_FAILED, "Giao dịch thử nghiệm bị từ chối")];
    }

    const paymentId = crypto.randomUUID();
    const bookingId = crypto.randomUUID();
    const now = new Date();
    const confirmation = {
      bookingId,
      bookingCode: `BK-MOCK-${paymentId.slice(0, 8).toUpperCase()}`,
      qrToken: `${paymentId.replaceAll("-", "")}${bookingId.replaceAll("-", "")}`,
      qrUrl: `https://example.test/check-in/${paymentId}`,
      facility: { name: "storeX Demo Facility", address: "Địa chỉ demo" },
      checkInSlotStart: now.toISOString(),
      checkInSlotEnd: null,
      rentalEndAt: addMonths(now.toISOString(), 1),
      unitTypeName: "Kho tiêu chuẩn",
      sizeLabel: "2 m²",
      durationMonths: 1,
      emailStatus: "QUEUED" as const,
    };
    return [
      201,
      envelope({
        id: paymentId,
        status: PaymentStatus.SUCCEEDED,
        provider: "mock",
        providerPaymentId: `mock-provider-${paymentId}`,
        paidAt: now.toISOString(),
        pricing: {
          rentalFeeAmount: "900000",
          depositAmount: "900000",
          totalAmount: "1800000",
          currency: "VND",
        },
        booking: {
          id: bookingId,
          bookingCode: confirmation.bookingCode,
          customerId: crypto.randomUUID(),
          facilityId: crypto.randomUUID(),
          unitTypeId: crypto.randomUUID(),
          checkInAt: confirmation.checkInSlotStart,
          rentalEndAt: confirmation.rentalEndAt,
          durationMonths: 1,
          status: "CONFIRMED",
          paidAt: now.toISOString(),
          contact: {
            fullName: "Demo Customer",
            email: "customer@example.test",
            phone: "+84900000000",
          },
          pricing: {
            rentalFeeAmount: "900000",
            depositAmount: "900000",
            totalAmount: "1800000",
            currency: "VND",
          },
        },
        confirmation,
      }),
    ];
  });

  mock.onPost("/reservations/quote").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Chỉ khách thuê kho có thể đặt chỗ")];
    }
    const input = parseBody<ReservationQuoteInput>(config.data);
    const unit = database.units.find(
      (candidate) =>
        candidate.facilityId === input.facilityId &&
        candidate.unitTypeId === input.unitTypeId &&
        candidate.status === StorageUnitStatus.AVAILABLE,
    );
    if (!unit) {
      return [409, errorBody(ApiErrorCode.UNIT_UNAVAILABLE, "Loại kho này vừa hết chỗ")];
    }
    const quote: ReservationQuote = {
      id: `quote-${crypto.randomUUID()}`,
      ...input,
      unitType: unit.unitType,
      sizeLabel: unit.sizeLabel,
      monthlyPrice: unit.monthlyPrice,
      rentalTotal: unit.monthlyPrice * input.durationMonths,
      depositAmount: unit.monthlyPrice,
      totalEstimated: unit.monthlyPrice * (input.durationMonths + 1),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    database.quotes.push(quote);
    saveMockDatabase(database);
    return [200, envelope(quote, "Báo giá có hiệu lực trong 15 phút")];
  });

  mock.onPost("/reservations/confirm").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền tạo reservation")];
    }
    const input = parseBody<ConfirmReservationInput>(config.data);
    const quote = database.quotes.find((candidate) => candidate.id === input.quoteId);
    if (!quote || new Date(quote.expiresAt).getTime() < Date.now()) {
      return [
        409,
        errorBody(ApiErrorCode.RESERVATION_CONFLICT, "Báo giá đã hết hạn, vui lòng tạo lại"),
      ];
    }
    if (input.paymentToken === "tok_fail") {
      return [
        402,
        errorBody(ApiErrorCode.PAYMENT_FAILED, "Ngân hàng từ chối giao dịch thử nghiệm"),
      ];
    }
    const unit = database.units.find(
      (candidate) =>
        candidate.facilityId === quote.facilityId &&
        candidate.unitTypeId === quote.unitTypeId &&
        candidate.status === StorageUnitStatus.AVAILABLE,
    );
    const facility = database.facilities.find((candidate) => candidate.id === quote.facilityId);
    if (!unit || !facility) {
      return [409, errorBody(ApiErrorCode.UNIT_UNAVAILABLE, "Kho vừa được khách khác giữ chỗ")];
    }

    const reservationId = `res-${crypto.randomUUID()}`;
    const payment = {
      id: `pay-${crypto.randomUUID()}`,
      reservationId,
      amount: quote.depositAmount,
      status: PaymentStatus.SUCCEEDED,
      brand: input.cardBrand,
      last4: input.cardLast4,
      paidAt: new Date().toISOString(),
    };
    const reservation: Reservation = {
      id: reservationId,
      code: `RS-${String(database.reservations.length + 1).padStart(5, "0")}`,
      customerId: user.id,
      facility: hydrateFacility(database, facility),
      unitTypeId: quote.unitTypeId,
      unitType: quote.unitType,
      sizeLabel: quote.sizeLabel,
      startDate: quote.startDate,
      endDate: addMonths(quote.startDate, quote.durationMonths),
      durationMonths: quote.durationMonths,
      status: ReservationStatus.CONFIRMED,
      monthlyPrice: quote.monthlyPrice,
      depositAmount: quote.depositAmount,
      totalEstimated: quote.totalEstimated,
      payment,
      createdAt: new Date().toISOString(),
    };
    unit.status = StorageUnitStatus.RESERVED;
    database.payments.push(payment);
    database.reservations.unshift(reservation);
    database.quotes = database.quotes.filter((candidate) => candidate.id !== quote.id);
    saveMockDatabase(database);
    return [201, envelope(reservation, "Đặt kho và thanh toán tiền cọc thành công")];
  });

  mock.onGet("/reservations/mine").reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    if (user.role !== UserRole.STORAGE_CUSTOMER) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền xem dữ liệu này")];
    }
    return [200, envelope(database.reservations.filter((item) => item.customerId === user.id))];
  });

  mock.onGet(/\/reservations\/[^/]+$/).reply((config) => {
    const database = getMockDatabase();
    const user = currentUser(config, database);
    if (!user) return [401, errorBody(ApiErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập")];
    const reservationId = config.url?.split("/")[2] ?? "";
    const reservation = database.reservations.find((item) => item.id === reservationId);
    if (!reservation) {
      return [404, errorBody(ApiErrorCode.NOT_FOUND, "Không tìm thấy reservation")];
    }
    if (reservation.customerId !== user.id) {
      return [403, errorBody(ApiErrorCode.FORBIDDEN, "Bạn không có quyền xem reservation này")];
    }
    return [200, envelope(reservation)];
  });
}
