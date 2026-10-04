import {
  BookingLifecycleRepository,
  BookingRefundsRepository,
  db,
  loadApiEnv,
} from "@metastorage/database";
import { canSimulateRefund, MockRefundAdapter } from "./refund-adapter";
export async function sweepNoShow() {
  return { processed: await new BookingLifecycleRepository(db).sweepNoShow(new Date()) };
}
export async function sweepRefunds() {
  const localEnv = loadApiEnv();
  if (
    !canSimulateRefund(
      process.env.NODE_ENV ?? localEnv.NODE_ENV,
      process.env.SEPAY_ENV ?? localEnv.SEPAY_ENV,
    )
  )
    return { processed: 0 };
  const repository = new BookingRefundsRepository(db);
  const refunds = await repository.claim(new Date());
  const adapter = new MockRefundAdapter();
  for (const refund of refunds) {
    if (!refund.leaseToken) continue;
    try {
      const result = await adapter.refund({
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
      });
      await repository.complete(refund.id, refund.leaseToken, result.reference, new Date());
    } catch {
      await repository.fail(refund.id, refund.leaseToken, refund.attempts, new Date());
    }
  }
  return { processed: refunds.length };
}
