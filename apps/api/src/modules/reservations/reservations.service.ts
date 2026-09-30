import { createHash, randomBytes } from "node:crypto";
import type {
  ReservationDraft,
  ReservationDraftContact,
  ReservationHold,
} from "@metastorage/contracts";
import { AppError, BadRequestError, NotFoundError } from "../../common/errors/app-error";
import { RESERVATION_MESSAGES } from "./reservations.messages";
import type { ReservationsRepository } from "./reservations.repository";
import type { CreateReservationDraftBody } from "./reservations.schema";

const DEFAULT_OPEN_TIME = "06:00:00";
const DEFAULT_CLOSE_TIME = "22:00:00";
const TIMEZONE = "Asia/Ho_Chi_Minh";
const MAX_ADVANCE_BOOKING_DAYS = 30;

function parseParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    dayOfWeek: weekdays.indexOf(get("weekday")),
    time: `${get("hour")}:${get("minute")}:00`,
  };
}

function addMonths(value: Date, months: number): Date {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function isWithinHours(value: string, openTime: string, closeTime: string): boolean {
  return value >= openTime && value <= closeTime;
}

function toContact(contact: ReservationDraftContact): ReservationDraft["contact"] {
  return contact;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class ReservationsService {
  constructor(private readonly repository: ReservationsRepository) {}

  async createDraft(input: CreateReservationDraftBody): Promise<ReservationDraft> {
    const context = await this.repository.findActiveContext(input.facilityId, input.unitTypeId);
    if (!context) throw new NotFoundError(RESERVATION_MESSAGES.facilityOrUnitTypeUnavailable);

    const checkInAt = new Date(input.checkInAt);
    const now = new Date();
    const latest = new Date(now.getTime() + MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000);
    if (Number.isNaN(checkInAt.getTime()) || checkInAt < now || checkInAt > latest) {
      throw new BadRequestError(RESERVATION_MESSAGES.checkInOutsideAdvanceWindow);
    }

    const local = parseParts(checkInAt);
    const hours = await this.repository.findOperatingHours(input.facilityId, local.dayOfWeek);
    const openTime = hours?.openTime ?? DEFAULT_OPEN_TIME;
    const closeTime = hours?.closeTime ?? DEFAULT_CLOSE_TIME;
    if (!isWithinHours(local.time, openTime, closeTime)) {
      throw new BadRequestError(RESERVATION_MESSAGES.checkInOutsideOperatingHours);
    }

    const rentalEndAt = addMonths(checkInAt, input.durationMonths);
    const capacity = await this.repository.countCapacity(input.unitTypeId, checkInAt, rentalEndAt);
    if (capacity < 1) {
      throw new AppError(
        RESERVATION_MESSAGES.unitTypeCapacityUnavailable,
        409,
        "CAPACITY_UNAVAILABLE",
      );
    }

    const draftAccessToken = randomBytes(32).toString("hex");
    const draft = await this.repository.createDraft({
      facilityId: input.facilityId,
      unitTypeId: input.unitTypeId,
      checkInAt,
      rentalEndAt,
      durationMonths: input.durationMonths,
      contactName: input.contact.fullName,
      contactEmail: input.contact.email,
      contactPhone: input.contact.phone,
      accessTokenHash: hashToken(draftAccessToken),
      status: "DRAFT",
      pricingStatus: "PRICING_NOT_CONFIGURED",
    });

    return {
      id: draft.id,
      facilityId: draft.facilityId,
      unitTypeId: draft.unitTypeId,
      checkInAt: draft.checkInAt.toISOString(),
      rentalEndAt: draft.rentalEndAt.toISOString(),
      durationMonths: draft.durationMonths,
      contact: toContact({
        fullName: draft.contactName,
        email: draft.contactEmail,
        phone: draft.contactPhone,
      }),
      draftAccessToken,
      status: "DRAFT",
      pricingStatus: "PRICING_NOT_CONFIGURED",
      pricing: null,
    };
  }

  async createHold(draftId: string, draftAccessToken: string): Promise<ReservationHold> {
    const hold = await this.repository.createHold(draftId, hashToken(draftAccessToken));
    if (hold === null) throw new NotFoundError(RESERVATION_MESSAGES.reservationDraftNotFound);
    if (!hold) {
      throw new AppError(RESERVATION_MESSAGES.unitTypeCapacityUnavailable, 409, "HOLD_CONFLICT");
    }
    return {
      holdId: hold.id,
      holdToken: draftAccessToken,
      unitTypeId: hold.unitTypeId,
      startsAt: hold.startsAt.toISOString(),
      endsAt: hold.endsAt.toISOString(),
      expiresAt: hold.expiresAt?.toISOString() ?? new Date(0).toISOString(),
      status: "ACTIVE",
    };
  }
}
