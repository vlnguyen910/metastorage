import { CustomerBookingDetailScreen } from "@/modules/customer/bookings/customer-booking-detail-screen";
export default async function Page({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingDetailScreen bookingId={bookingId} />;
}
