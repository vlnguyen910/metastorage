export type BookingDraftPricing = {
  monthlyRateSnapshot: string;
  rentalFeeAmount: string;
  depositAmount: string;
  totalAmount: string;
  currency: "VND";
};

export type BookingDraft = {
  id: string;
  facilityId: string;
  unitTypeId: string;
  checkInAt: string;
  rentalEndAt: string;
  durationMonths: number;
  draftAccessToken: string;
  status: "DRAFT";
  pricing: BookingDraftPricing;
};
