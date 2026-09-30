import type { ApiErrorCode, User } from "./index";

export interface CookieSession {
  user: User;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  error: {
    code: ApiErrorCode;
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface FacilityListParams {
  search?: string;
  city?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "price" | "availability";
}

export interface CatalogFacilityListParams {
  search?: string;
  city?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "price" | "availability";
}

export interface ReservationQuoteInput {
  facilityId: string;
  unitTypeId: string;
  startDate: string;
  durationMonths: number;
}

export interface ConfirmReservationInput {
  quoteId: string;
  paymentToken: string;
  cardBrand: string;
  cardLast4: string;
}

export interface DashboardKpi {
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "accent" | "warning" | "neutral";
}

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  time: string;
}

export interface DashboardSummary {
  title: string;
  subtitle: string;
  facilityName?: string;
  kpis: DashboardKpi[];
  activities: DashboardActivity[];
}
