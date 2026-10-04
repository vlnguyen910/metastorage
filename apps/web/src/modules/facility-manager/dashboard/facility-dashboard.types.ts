export type FacilityManagerDashboardTab = "overview" | "units" | "check-in" | "staff";

export interface FacilityCapabilityCard {
  id: string;
  title: string;
  description: string;
  tabTarget: FacilityManagerDashboardTab;
  badge?: string;
}
