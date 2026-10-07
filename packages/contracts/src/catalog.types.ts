export interface CatalogFacilityListParams {
  search?: string;
  city?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "price" | "availability";
}
