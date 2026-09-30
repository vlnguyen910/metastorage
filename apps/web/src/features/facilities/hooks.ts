"use client";

import type { CatalogFacilityListParams } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const facilityKeys = {
  all: ["facilities"] as const,
  list: (params: CatalogFacilityListParams) => [...facilityKeys.all, "list", params] as const,
  detail: (id: string) => [...facilityKeys.all, "detail", id] as const,
  unitTypes: (id: string) => [...facilityKeys.all, "unit-types", id] as const,
};

export function useFacilities(params: CatalogFacilityListParams) {
  return useQuery({
    queryKey: facilityKeys.list(params),
    queryFn: () => api.catalog.listFacilities(params),
  });
}

export function useFacility(id: string) {
  return useQuery({
    queryKey: facilityKeys.detail(id),
    queryFn: () => api.catalog.getFacility(id),
  });
}

export function useAvailability(id: string) {
  return useQuery({
    queryKey: facilityKeys.unitTypes(id),
    queryFn: () => api.catalog.listUnitTypes(id),
    enabled: Boolean(id),
  });
}
