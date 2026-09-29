import type {
  ApiEnvelope,
  ApiUser,
  AssignPhysicalUnitInput,
  BookingListItem,
  BookingQrVerificationInput,
  BookingQrVerificationResult,
  CatalogFacility,
  CatalogFacilityListParams,
  CatalogUnitType,
  ClientSession,
  ConfirmReservationInput,
  CookieSession,
  CustomerSignUpInput,
  DashboardSummary,
  EligibleUnit,
  Facility,
  FacilityListParams,
  LoginInput,
  PaginatedResult,
  PaymentCheckoutInput,
  PaymentResult,
  PhysicalUnitAssignment,
  RentalDetail,
  RentalListItem,
  Reservation,
  ReservationDraft,
  ReservationDraftInput,
  ReservationHold,
  ReservationQuote,
  ReservationQuoteInput,
  Session,
  SessionTokens,
  UnitAvailabilityOption,
  UserRole,
} from "@storex/contracts";
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

export interface TokenProvider {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  updateTokens: (tokens: SessionTokens) => void;
  clearSession: () => void;
}

export interface HttpClientOptions {
  baseURL: string;
  tokenProvider: TokenProvider;
}

export type AuthMode = "mock" | "better-auth";
type SessionFor<Mode extends AuthMode> = Mode extends "mock"
  ? Session
  : Mode extends "better-auth"
    ? CookieSession
    : ClientSession;

export function createHttpClient({ baseURL, tokenProvider }: HttpClientOptions): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15_000, withCredentials: true });
  let refreshPromise: Promise<SessionTokens> | null = null;

  client.interceptors.request.use((config) => {
    const token = tokenProvider.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (error.response?.status !== 401 || !config || config._retry || config.skipAuthRefresh) {
        return Promise.reject(error);
      }

      const refreshToken = tokenProvider.getRefreshToken();
      if (!refreshToken) {
        tokenProvider.clearSession();
        return Promise.reject(error);
      }

      config._retry = true;
      refreshPromise ??= client
        .post<ApiEnvelope<SessionTokens>>("/auth/refresh", { refreshToken }, {
          skipAuthRefresh: true,
        } as RetryConfig)
        .then((response) => response.data.data)
        .finally(() => {
          refreshPromise = null;
        });

      try {
        const tokens = await refreshPromise;
        tokenProvider.updateTokens(tokens);
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return client.request(config);
      } catch (refreshError) {
        tokenProvider.clearSession();
        return Promise.reject(refreshError);
      }
    },
  );

  return client;
}

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

function toSession(user: ApiUser): CookieSession {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions: [],
      assignedFacilityIds: [],
    },
  };
}

function createStorexApiClientImpl(http: AxiosInstance, authMode: AuthMode) {
  return {
    http,
    auth: {
      login: async (input: LoginInput) => {
        if (authMode === "mock") {
          return http.post<ApiEnvelope<Session>>("/auth/login", input).then(unwrap);
        }

        await http.post("/auth/sign-in/email", input);
        try {
          const user = await http.get<ApiEnvelope<ApiUser>>("/users/me").then(unwrap);
          return toSession(user);
        } catch (error) {
          await http.post("/auth/sign-out").catch(() => undefined);
          throw error;
        }
      },
      me: async () => {
        if (authMode === "mock") {
          return http.get<ApiEnvelope<Session["user"]>>("/auth/me").then(unwrap);
        }

        const user = await http.get<ApiEnvelope<ApiUser>>("/users/me").then(unwrap);
        return toSession(user).user;
      },
      logout: () =>
        authMode === "mock"
          ? http.post<ApiEnvelope<null>>("/auth/logout").then(unwrap)
          : http.post("/auth/sign-out").then(() => null),
      forgotPassword: (email: string) =>
        http.post<ApiEnvelope<null>>("/auth/forgot-password", { email }).then(unwrap),
      registerCustomer: (input: CustomerSignUpInput) =>
        http
          .post<{ message: string }>("/auth/customer-sign-up", input)
          .then((response) => response.data),
    },
    users: {
      list: () =>
        http.get<ApiEnvelope<ApiUser[]>>("/users", { params: { limit: 100 } }).then(unwrap),
      setRole: (userId: string, role: ApiUser["role"]) =>
        http.patch<ApiEnvelope<ApiUser>>(`/users/${userId}/role`, { role }).then(unwrap),
    },
    facilities: {
      list: (params: FacilityListParams = {}) =>
        http.get<ApiEnvelope<PaginatedResult<Facility>>>("/facilities", { params }).then(unwrap),
      get: (facilityId: string) =>
        http.get<ApiEnvelope<Facility>>(`/facilities/${facilityId}`).then(unwrap),
      availability: (facilityId: string) =>
        http
          .get<ApiEnvelope<UnitAvailabilityOption[]>>(`/facilities/${facilityId}/availability`)
          .then(unwrap),
    },
    catalog: {
      listFacilities: (params: CatalogFacilityListParams = {}) =>
        http
          .get<ApiEnvelope<PaginatedResult<CatalogFacility>>>("/catalog/facilities", { params })
          .then(unwrap),
      getFacility: (facilityId: string) =>
        http.get<ApiEnvelope<CatalogFacility>>(`/catalog/facilities/${facilityId}`).then(unwrap),
      listUnitTypes: (facilityId: string) =>
        http
          .get<ApiEnvelope<CatalogUnitType[]>>(`/catalog/facilities/${facilityId}/unit-types`)
          .then(unwrap),
    },
    reservations: {
      createDraft: (input: ReservationDraftInput) =>
        http.post<ApiEnvelope<ReservationDraft>>("/reservations/drafts", input).then(unwrap),
      createHold: (draftId: string, draftAccessToken: string) =>
        http
          .post<ApiEnvelope<ReservationHold>>(`/reservations/drafts/${draftId}/hold`, {
            draftAccessToken,
          })
          .then(unwrap),
      pay: (draftId: string, input: PaymentCheckoutInput) =>
        http
          .post<ApiEnvelope<PaymentResult>>(`/reservations/drafts/${draftId}/pay`, input)
          .then(unwrap),
      quote: (input: ReservationQuoteInput) =>
        http.post<ApiEnvelope<ReservationQuote>>("/reservations/quote", input).then(unwrap),
      confirm: (input: ConfirmReservationInput) =>
        http.post<ApiEnvelope<Reservation>>("/reservations/confirm", input).then(unwrap),
      mine: () => http.get<ApiEnvelope<Reservation[]>>("/reservations/mine").then(unwrap),
      get: (reservationId: string) =>
        http.get<ApiEnvelope<Reservation>>(`/reservations/${reservationId}`).then(unwrap),
    },
    bookings: {
      verifyQr: (input: BookingQrVerificationInput) =>
        http
          .post<ApiEnvelope<BookingQrVerificationResult>>("/bookings/verify-qr", input)
          .then(unwrap),
      listFacilityBookings: (facilityId: string, status?: string) =>
        http
          .get<ApiEnvelope<BookingListItem[]>>(`/facilities/${facilityId}/bookings`, {
            params: { status },
          })
          .then(unwrap),
      get: (bookingId: string) =>
        http.get<ApiEnvelope<BookingListItem>>(`/bookings/${bookingId}`).then(unwrap),
      getEligibleUnits: (bookingId: string) =>
        http.get<ApiEnvelope<EligibleUnit[]>>(`/bookings/${bookingId}/eligible-units`).then(unwrap),
      assignUnit: (bookingId: string, input: AssignPhysicalUnitInput) =>
        http
          .post<ApiEnvelope<PhysicalUnitAssignment>>(`/bookings/${bookingId}/assign-unit`, input)
          .then(unwrap),
    },
    rentals: {
      mine: () => http.get<ApiEnvelope<RentalListItem[]>>("/rentals/mine").then(unwrap),
      get: (rentalId: string) =>
        http.get<ApiEnvelope<RentalDetail>>(`/rentals/${rentalId}`).then(unwrap),
    },
    dashboards: {
      get: (role: UserRole) =>
        http.get<ApiEnvelope<DashboardSummary>>(`/dashboards/${role}`).then(unwrap),
    },
  };
}

export type StorexApiClient<Mode extends AuthMode = "mock"> = Omit<
  ReturnType<typeof createStorexApiClientImpl>,
  "auth"
> & {
  auth: Omit<ReturnType<typeof createStorexApiClientImpl>["auth"], "login" | "me"> & {
    login: (input: LoginInput) => Promise<SessionFor<Mode>>;
    me: () => Promise<SessionFor<Mode>["user"]>;
  };
};

export function createStorexApiClient(http: AxiosInstance): StorexApiClient<"mock">;
export function createStorexApiClient(
  http: AxiosInstance,
  authMode: "mock",
): StorexApiClient<"mock">;
export function createStorexApiClient(
  http: AxiosInstance,
  authMode: "better-auth",
): StorexApiClient<"better-auth">;
export function createStorexApiClient(
  http: AxiosInstance,
  authMode: AuthMode,
): StorexApiClient<AuthMode>;
export function createStorexApiClient(
  http: AxiosInstance,
  authMode: AuthMode = "mock",
): StorexApiClient<AuthMode> {
  return createStorexApiClientImpl(http, authMode) as StorexApiClient<AuthMode>;
}
