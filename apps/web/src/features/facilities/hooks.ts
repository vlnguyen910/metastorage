"use client";

import type {
  CatalogFacilityListParams,
  FacilityUnitListParams,
  UpdateUnitStatusInput,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const facilityKeys = {
  all: ["facilities"] as const,
  list: (params: CatalogFacilityListParams) => [...facilityKeys.all, "list", params] as const,
  detail: (id: string) => [...facilityKeys.all, "detail", id] as const,
  unitTypes: (id: string) => [...facilityKeys.all, "unit-types", id] as const,
  units: (id: string, params?: FacilityUnitListParams) =>
    [...facilityKeys.all, "units", id, params] as const,
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

export function useFacilityUnits(facilityId: string, params: FacilityUnitListParams = {}) {
  return useQuery({
    queryKey: facilityKeys.units(facilityId, params),
    queryFn: () => api.facilities.listUnits(facilityId, params),
    enabled: Boolean(facilityId),
  });
}

export function useUpdateUnitStatusMutation(facilityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }: { unitId: string; input: UpdateUnitStatusInput }) =>
      api.facilities.updateUnitStatus(facilityId, unitId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...facilityKeys.all, "units", facilityId],
      });
    },
  });
}
