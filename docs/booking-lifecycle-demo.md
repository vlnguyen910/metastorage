# Booking lifecycle demo (#91)

Customer actions use a signed-in CUSTOMER account linked through `customers.user_id`.
Web: `/customer/bookings`; mobile: sign in as a Customer to open Booking list.
Guest OTP tracking is provided by #92, not by entering a Booking ID.

Apply the generated migrations to your development database with `bun run db:migrate`.
Run API, web and worker using `bun run --filter api dev`, `bun run --filter web dev`,
and `bun run --filter worker dev`. The worker needs Redis (`REDIS_URL`).

For simulated refunds configure `NODE_ENV=development` and `SEPAY_ENV=sandbox`
in API local environment or worker process environment. Worker process variables
take precedence. No refund credentials or bank transfer is used for this demo.
Cancellation creates a PENDING refund of the paid rental fee; the deposit is forfeited.
The refund sweep runs every 10 seconds and shows SUCCEEDED with simulation=true.
In production, or with SEPAY_ENV=production, refund requests remain PENDING until
a real refund adapter is implemented. Payment remains SUCCEEDED (partial refund).

No-show sweep runs every 30 seconds, using slot end (or check-in start when absent)
plus two hours. VERIFIED/CONSUMED arrival and ACTIVE Rental prevent no-show.
Rescheduling preserves the price and duration; old physical/staff assignments are
cleared so operations can assign them again.

Integration tests require a dedicated `TEST_DATABASE_URL`; they create and remove
only their isolated test schema. Never point it at production or a shared database.
Without the explicit test URL they are skipped and do not use DATABASE_URL.
