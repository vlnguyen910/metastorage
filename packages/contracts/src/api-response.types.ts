import type { ApiErrorCode } from "./api-response";

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
