import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { PhysicalUnitsView } from "./physical-units-view";

const mockUnits = [
  {
    id: "unit-1",
    facilityId: "fac-1",
    unitTypeId: "type-1",
    code: "U-101",
    floor: "1",
    locationDescription: "Khu A",
    status: "AVAILABLE",
    unitTypeName: "Kho Nhỏ",
    unitTypeSize: 2,
    monthlyPrice: 500000,
    currentBookingId: null,
    currentBookingCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "unit-2",
    facilityId: "fac-1",
    unitTypeId: "type-1",
    code: "U-102",
    floor: "1",
    locationDescription: "Khu A",
    status: "OCCUPIED",
    unitTypeName: "Kho Nhỏ",
    unitTypeSize: 2,
    monthlyPrice: 500000,
    currentBookingId: "bk-1",
    currentBookingCode: "BK-999",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock("./hooks", () => ({
  useFacilityUnits: () => ({
    data: mockUnits,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAvailability: () => ({
    data: [{ unitTypeId: "type-1", name: "Kho Nhỏ", sizeLabel: "2m²" }],
  }),
  useUpdateUnitStatusMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PhysicalUnitsView facilityId="fac-1" facilityName="Kho Tân Bình" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("PhysicalUnitsView", () => {
  it("renders physical unit list with statuses and codes", () => {
    renderComponent();

    expect(screen.getByText("Quản lý Ô kho Vật lý")).toBeInTheDocument();
    expect(screen.getByText("U-101")).toBeInTheDocument();
    expect(screen.getByText("U-102")).toBeInTheDocument();
    expect(screen.getByText("BK-999")).toBeInTheDocument();
    expect(screen.getByText("Đang sử dụng")).toBeInTheDocument();
  });

  it("opens transition modal when clicking action button on available unit", async () => {
    renderComponent();

    const changeStatusButton = screen.getByRole("button", { name: /Chuyển trạng thái/i });
    expect(changeStatusButton).toBeInTheDocument();

    fireEvent.click(changeStatusButton);

    await waitFor(() => {
      expect(screen.getByText("Chuyển đổi trạng thái ô kho")).toBeInTheDocument();
    });
  });
});
