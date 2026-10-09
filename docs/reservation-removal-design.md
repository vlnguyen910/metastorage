# Reservation removal — thiết kế và dependency inventory (#113, task 1)

> Quyết định hiện hành: xem **Guest identity decision — 1A / 2A** ở cuối tài liệu.
> Phần audit bên dưới ghi baseline lịch sử; mô hình Customer đã được thay thế.

## Trạng thái và nguồn bằng chứng

Audit ngày 2026-10-09, source tại commit `2d8311a0c166feaf04b7e9ac1332829145a9344d`.
Đã kiểm kê source, dependency graph và dữ liệu database đang cấu hình bằng transaction
read-only. Đây là kết quả khảo sát và đề xuất thiết kế; các quyết định được ghi là
**đề xuất/chờ chốt** chưa phải authorization để triển khai business rule mới.

GitNexus impact depth 3: ReservationsService (4 dependents), ReservationsRepository
(5), PaymentsRepository (5), useReservationCheckout (4), đều báo LOW trên graph.
Graph báo chậm HEAD một commit; `analyze --index-only` trả `Already up to date` nhưng
MCP vẫn báo behind. Vì vậy số lượng graph chỉ phục vụ điều hướng, không phải danh sách
dependency đầy đủ hay đánh giá rủi ro tổng thể. Source dưới đây là bằng chứng chính.
Query quá giới hạn output không được dùng làm bằng chứng hoàn chỉnh.

## Dependency map

| Khu vực | Source hiện tại | Phụ thuộc cần chuyển |
| --- | --- | --- |
| API registration | `apps/api/src/app.ts` | Đăng ký reservationsRoutes dưới `/api/reservations` |
| Draft/hold | `apps/api/src/modules/reservations/{reservations.routes,reservations.service,reservations.repository,reservations.schema,reservations.messages}.ts` | Draft validation/contact/pricing, hash token, inventory và allocation locks |
| Shared slot | `apps/api/src/modules/bookings/check-in-slots.{repository,service}.ts` | Tái sử dụng; payment slot lookup phải cùng transaction |
| Payment | `apps/api/src/modules/payments/payments.{routes,service,repository,schema}.ts` | Pricing provider, checkout join, pending payment, replay scope và completion đều dùng draftId/reservationDrafts |
| Provider | `apps/api/src/modules/payments/sepay.{gateway,types}.ts` | Provider session/return URLs dùng `/reservations/payment-result` và draftId |
| Database | `packages/database/src/schema/{reservation-drafts,payments,relations,index}.ts` | Bảng/enum draft, FK payments.draft_id, relations và exports |
| Allocation | `packages/database/src/schema/capacity-allocations.ts` | HOLD.referenceId là draft ID; BOOKING.referenceId là Booking ID; referenceId hiện không có FK tới một trong hai bảng |
| Seed | `packages/database/src/seed.ts` | Raw SQL tạo legacy draft và payment draft_id; phải chuyển cùng schema |
| Contracts/client | `packages/contracts/src/{reservations,reservations.types,reservation-contact,payments}.ts`, `packages/api-client/src/index.ts` | Types/schema, api.reservations và endpoint paths |
| Web checkout | `apps/web/src/features/reservations/`, `apps/web/src/app/reservations/` | Draft/hold/pay mutations, form/contact comparison, countdown, polling và payment result |
| Customer web | `apps/web/src/modules/customer/reservations/`, `apps/web/src/modules/customer/dashboard/customer-dashboard-screen.tsx` | List/detail/dashboard vẫn đọc legacy reservations.mine/get |
| Mocks | `apps/web/src/mocks/handlers/reservations.handlers.ts`, `apps/web/src/mocks/types.ts` | Có cả draft/hold/pay và model quote/confirm/mine/get cũ |
| Worker | `apps/worker/src/index.ts` | Sweep HOLD mỗi 30 giây; confirmation đọc Booking và email outbox. Không đọc Reservation trực tiếp, nhưng chịu ảnh hưởng allocation/outbox semantics |
| Mobile | `apps/mobile/src` | Không tìm thấy Reservation/draftId consumer hiện hành; vẫn chịu ảnh hưởng nếu dùng shared client về sau |
| Booking readers | `bookings.repository.ts`; payments/check-ins/rentals repositories | DRAFT bị loại khỏi operational Booking reads; ba repository sau còn dùng bookings.projection.ts |

Graph xác nhận routes → service/repository và ReservationWizard → useReservationCheckout.
Các method `api.reservations.*` được xác minh bằng source vì factory/object properties
không thể coi là đã kiểm kê đủ chỉ từ caller graph của API-client factory.

## Baseline phải giữ

### API và guest access

- `POST /api/reservations/drafts`: facilityId, unitTypeId, checkInAt, durationMonths
  (1–12), contact gồm fullName/email/phone. Trả priced draft, normalized schedule và
  draftAccessToken. Không cần account; không tạo Customer tại bước này.
- `POST /api/reservations/drafts/:draftId/hold`: draftAccessToken; trả holdToken và expiresAt.
- `POST /api/reservations/drafts/:draftId/pay`: holdToken, idempotencyKey,
  paymentMethodToken. Mock trả kết quả hoàn tất; SePay có thể trả PENDING.
- Payment status: `/api/payments/:paymentId/status`; callbacks:
  `/api/payments/webhooks/sepay`, `/api/sepay/ipn`. Sandbox finalizer chỉ đăng ký khi
  non-production và SEPAY_TEST_MODE. Giữ nguyên điều kiện này.
- quote/confirm/mine/get tồn tại ở client và mocks nhưng không có route tương ứng trong
  reservations.routes.ts. Không xây thêm endpoint cho chúng chỉ để giữ mock model cũ;
  phải thiết kế cách chuyển customer list/detail sang Booking access đúng scope.

### Lịch, giá, capacity và tokens

- Validate facility, Unit Type và facility offering đều active. Check-in phải ở tương lai,
  nằm trong operating hours (fallback 06:00–22:00), thuộc đúng một slot. Slot start
  inclusive/end exclusive, normalize về đầu slot trong Asia/Ho_Chi_Minh và validate lại.
- Rental end hiện dùng `setUTCMonth`; không âm thầm thay semantics ngày cuối tháng trong refactor.
- Draft kiểm tra capacity nhưng chưa chiếm capacity. Snapshot gồm monthly rate,
  rental fee = rate × months, deposit = rate, total = rate × (months + 1), VND.
- Inventory draft/hold loại INACTIVE, LOCKED, MAINTENANCE; eligible-unit query Booking
  còn loại INSPECTION. Đây là khác biệt có thật, không tự hợp nhất trong refactor.
- Capacity trừ ACTIVE allocation overlap `start < requestedEnd && end > requestedStart`,
  chỉ tính allocation chưa expiry hoặc không có expiry.
- Hold locks draft, inventory và allocations, reuse hold chưa hết hạn; hold mới có TTL
  10 phút. Rời checkout không release hold; worker đổi status EXPIRED định kỳ, availability
  đã loại hold hết hạn bằng timestamp dù worker chưa sweep.
- Secret random 32 bytes dạng hex; chỉ lưu SHA-256. Hiện holdToken bằng draftAccessToken,
  không phải một secret độc lập. ID không thay thế token.
- DRAFT hiện không có expiry riêng. Draft cũ có thể xin hold mới nếu còn capacity;
  repository chưa kiểm tra lại lịch quá khứ ở bước tạo hold. Không diễn giải đây là policy đã chốt.

### Customer và payment

- createPendingPayment tạo/reuse Customer theo trimmed lowercase email. Không overwrite
  Customer profile, không link User và không cấp guest tracking session do email trùng.
- Nếu contact khác hồ sơ Customer, operational booking contact lấy hồ sơ hiện có;
  confirmation recipient lấy draft email. UI hiện chưa có bước giải thích khác biệt này.
- Idempotency replay scoped theo draftId + holdTokenHash; unique idempotency key và
  `(provider, providerPaymentId)`. Failed attempt dùng key mới; pending cần reconciliation.
- Payment success transaction insert Booking CONFIRMED, set QR hash, update payment,
  insert confirmation outbox, chuyển allocation HOLD → BOOKING. Không assign physical unit.
- SePay verify provider event, check direction/amount, tìm pending payment theo paymentCode;
  event được record trước completion và PROCESSED sau transaction. Retry FAILED event có thể
  xử lý lại. Không coi event state và booking transaction là một transaction hiện hành.
- Error baseline gồm CHECK_IN_IN_PAST, CHECK_IN_OUTSIDE_HOURS, CHECK_IN_OUTSIDE_SLOTS,
  CAPACITY_UNAVAILABLE, HOLD_CONFLICT, HOLD_EXPIRED, CHECK_IN_SLOT_CHANGED,
  PRICING_NOT_CONFIGURED, IDEMPOTENCY_KEY_REUSED, PAYMENT_PENDING,
  PAYMENT_ATTEMPT_FINALIZED và PAYMENT_UNCERTAIN; giữ contract hoặc ghi mapping khi đổi.

## Kiểm kê dữ liệu thực tế

Read-only snapshot lúc `2026-10-09T04:17:14.047Z` của database do cấu hình workspace chọn;
không chứng minh đây là production và không đại diện mọi môi trường deploy.
Chỉ đọc aggregate và metadata constraints, không thu thập contact/token/plaintext secrets.

| Dữ liệu | Kết quả |
| --- | --- |
| Reservation drafts | 3; tất cả PRICING_NOT_CONFIGURED, thiếu pricing và accessTokenHash |
| Payments | 3 SUCCEEDED, provider MOCK; tổng 22,500,000.00; tất cả có bookingId |
| Bookings | 2 CONFIRMED, 1 NO_SHOW; tất cả có Customer |
| Capacity allocations | 0; không có HOLD active/expired hoặc BOOKING allocation |
| Mapping draft → paid Booking | Mỗi draft có đúng 1 distinct bookingId qua payments; không có mapping nhiều Booking |
| Draft chưa có payment / pending payment | 0 / 0 |
| Orphan allocation references | 0, trên tập allocation rỗng |
| FK vào reservation_drafts | payments_draft_id_reservation_drafts_id_fk, ON DELETE RESTRICT theo schema |

Quyết định mới: project đang dev; user cho phép clear và seed lại toàn bộ dữ liệu.
Audit trên chỉ là bằng chứng khảo sát, không tạo yêu cầu giữ lịch sử, mapping hoặc backfill.
Task 2 kiểm chứng schema/migration/seed trên database cô lập; database dev có thể clear và
seed lại theo schema mới. Không cần cơ chế chuyển tiếp checkout cũ.

## Thiết kế đề xuất và quyết định còn mở

| Chủ đề | Đề xuất | Trạng thái |
| --- | --- | --- |
| Entity/lifecycle | Cùng Booking ID: DRAFT → CONFIRMED khi payment thành công; Rental riêng | Mục tiêu đã thống nhất trong #113 |
| Pricing | DRAFT bắt buộc priced; giữ required pricing columns và VND hiện hành | Giữ baseline; không mở scope unpriced drafts |
| Contact trước payment | Client giữ form, gửi contact lúc start-payment; không lưu contact ở backend trong bước tạo draft | User đã chốt |
| Contact mỗi Booking | Booking dùng contact nhập cho chính lần đặt đó; không ghi đè Customer profile khi email trùng | User đã chốt; thay thế đề xuất dùng contact hiện có của Customer |
| Lưu contact từ payment | Persist contact của lần đặt theo bookingId khi start-payment, trước khi trả PENDING/call provider; callback và operational reads dùng contact này | Cần thiết để thực hiện quyết định đã chốt; vị trí fields/table trình trong thiết kế schema bước 2 |
| API | POST /api/bookings/drafts; POST /api/bookings/:bookingId/hold; POST /api/bookings/:bookingId/pay (handler vẫn thuộc Payments); shared client api.bookings | Đề xuất kỹ thuật chờ review, đặc biệt list/detail customer access |
| Checkout token | Dùng accessTokenHash trên Booking; giữ cùng secret cho draft/hold để giảm contract change; không cấp quyền đọc lịch sử | Đề xuất bảo toàn baseline; TTL/revocation sau payment cần ghi rõ |
| Abandoned draft | Hold expire độc lập; không đổi Booking thành CANCELLED/NO_SHOW; chưa thêm DRAFT_EXPIRED | Đề xuất; draft retention/cleanup và re-hold khi lịch qua cần chốt |
| Cutover dev | Clear toàn bộ dữ liệu dev và seed lại theo schema mới; bỏ checkout cũ | User đã chốt; không giữ mapping/backfill hoặc lịch sử dev |
| Production cutover | Không thuộc phạm vi project dev hiện tại | Không triển khai drain/mapping/compatibility cho dữ liệu cũ |
| Late callback/expired hold | Không confirm nếu hold hết hạn; tiền đã nhận cần reconciliation/refund policy | Nguyên tắc hold từ #17; chi tiết tài chính/cutover vẫn TBD |

Contact tạm không đồng nghĩa historical snapshot. Client-only giảm schema nhưng có thể
mất form khi refresh và không khôi phục cross-device. Backend vẫn validate contact; khi
payment đã PENDING, callback phải hoàn tất từ dữ liệu server (Customer/Booking/Payment),
không cần client gửi lại. Bảng checkout tạm giữ khả năng resume nhưng thêm PII lifecycle;
tạo Customer sớm giảm staging model nhưng thêm hồ sơ từ draft bỏ dở và đổi quyết định hiện tại.

## Những điểm phải xử lý trong implementation tiếp theo

- completePendingPayment hiện không recheck expiry trong transaction, chỉ check trước đó;
  finalizer mới phải kiểm tra state/expiry/amount/token trong lock scope và ngăn confirm lần hai.
- findActiveHoldForPayment hiện không match holdTokenHash; cần đảm bảo payment attempt không
  được finalise bằng một hold khác khi draft được re-hold, theo thiết kế token/attempt đã chốt.
- Draft schema chỉ có status DRAFT kể cả sau payment; hold repo chưa chặn draft đã có paid
  Booking. Booking finalizer cùng-ID phải ngăn re-hold/re-pay trên CONFIRMED.
- Không retry hoặc tự refund callback tiền thật bằng rule suy diễn. Expired hold phải đi
  reconciliation theo policy được chốt; cancellation #13/#91 không tự áp dụng cho checkout.
- Customer booking list/detail access hiện có legacy mock-only dependency. Không trỏ
  `reservations.mine` sang facility-scoped operations list hoặc expose booking bằng ID.
- bookings.projection.ts vẫn dùng ở payments, check-ins, rentals. Có thể refactor joins
  theo từng consumer; đây là dependency còn lại, không phải bằng chứng file đã xóa được.

## Tests tái sử dụng và giới hạn

- `apps/web/src/features/reservations/use-reservation-checkout.test.tsx`: pending/retry,
  polling và confirmation; hooks được mock, không chứng minh SQL/transaction đúng.
- `checkout-validation.test.ts`, `checkout-confirmation.test.tsx`: validation/hiển thị.
- `apps/web/src/mocks/mock-api.test.ts`: legacy quote/confirm/mine cần chuyển hoặc bỏ.
- `apps/web/e2e/reservation.spec.ts`: flow cũ login/card/reservation; Playwright config
  chạy mock mode. Không thể dùng nguyên test này làm acceptance cho guest checkout thật.
- API hiện chỉ có `apps/api/tests/integration/facilities.test.ts`, repositories được mock.
  Chưa có automated DB integration test draft/hold/payment trong source hiện tại.
- Bước implementation cần DB integration cho capacity/expiry/idempotency/rollback và E2E
  backend thật + gateway test; task inventory này không chạy payment, migration hay mutating test.

## Nguồn quyết định và điều kiện hoàn tất task 1

Đối chiếu #12, #13, #16–#19, #20–#22, #27, #66–#69, #77, #91, #92, #112 và các
issue trùng phạm vi được liệt kê ở #113. #77/#92 đã chốt email OTP cho guest tracking;
Đã sửa docs/db-diagram.md để phản ánh quyết định OTP; không mở lại lựa chọn magic link.
Đã sửa mô tả scalar subquery: Booking repository
đã dùng joins + aggregated payments; các consumer projection còn dùng scalar subquery.

Hoàn tất phần khảo sát: dependency map, baseline và audit database đang cấu hình.
User đã chốt contact chỉ ở client trước payment và Booking dùng contact của lần đặt đó.
Điều này thay thế quyết định cũ operational DTO dùng contact hiện tại của Customer; cần
lưu contact theo Booking từ start-payment, không thể chỉ giữ ở client sau bước này.
Không auto-link User hoặc sửa Customer profile theo contact chưa verify.

Các quyết định cốt lõi đã đủ cho task 2. Giữ lifecycle/retention draft hiện tại,
không thêm cleanup policy mới; API/customer access được triển khai đúng scope ở task 3–5.
Cutover đã chốt clear/seed dev, không thêm cơ chế giữ dữ liệu cũ.

## Task 2 — schema và reset dữ liệu dev

- Thêm ba contact columns nullable trên Booking, CHECK all-null hoặc all-present.
- Cho phép payments.draft_id null nếu đã có booking_id; giữ FK và uniqueness hiện có.
- Generate migration `0027_slippery_maginty.sql` bằng `bun run db:generate`.
- Seed tạo ba Booking có contact riêng và ba Payment gắn Booking, không tạo Reservation draft.
- Bỏ mọi script backfill và yêu cầu bảo toàn dữ liệu dev cũ theo quyết định mới của user.
- Giữ bảng/FK Reservation đến khi code consumer được chuyển ở task 3–6; đây là thứ tự
  refactor source, không phải cơ chế đồng bộ dữ liệu hoặc giữ checkout cũ.
- Các guard nullable trong Payment hiện tại chỉ giữ type compatibility; task 4 sẽ chuyển
  finalizer sang Booking. Chưa coi schema mới là checkout Booking đã triển khai hoàn chỉnh.

Kiểm chứng: áp dụng toàn bộ generated migrations vào PostgreSQL cô lập; seed và clear/seed
đều pass. Mười checks thực tế xác minh contact completeness, reference bắt buộc, FK,
idempotency/provider uniqueness, customer constraint và DRAFT có thể chưa có contact/Customer.
Type-check toàn monorepo, tests hiện có và Biome file thay đổi đều pass.
Không chạy migration/clear/seed lên database dev đang dùng trong lượt này.

Khi reset dev theo schema đã hoàn tất: `bun run db:clear`, `bun run db:migrate`,
`bun run db:seed`. Kiểm tra cấu hình kết nối trỏ đúng database dev trước khi chạy.

## Endpoint 1 — tạo Booking DRAFT

Đã thêm `POST /api/bookings/drafts` (guest, không cần đăng nhập). Input gồm
`facilityId`, `unitTypeId`, `checkInAt` có timezone offset và `durationMonths` 1–12.
Trả HTTP 201 với Booking ID (`data.id`), lịch đã normalize, pricing snapshot,
`status: DRAFT` và `draftAccessToken`. Chỉ SHA-256 của token được lưu trên Booking.
Contact vẫn null; Booking guest có userId null; chưa tạo Payment, QR, assignment hoặc capacity allocation.
Không cần database migration: dùng các cột Booking đã chuẩn bị ở task 2.

Booking điều phối các service Facilities (active/operating hours), Facility Unit Types
(active offering và giá), Check-in Slots (resolve lịch), Storage Units (capacity preview).
Giữ baseline giờ mặc định 06:00–22:00, timezone Asia/Ho_Chi_Minh, slot start inclusive/end
exclusive, cộng tháng bằng setUTCMonth và giá rental + deposit một tháng. Capacity preview
loại INACTIVE/LOCKED/MAINTENANCE và bỏ hold hết hạn; không bảo đảm capacity cho đến bước hold.

Endpoint này chưa nối vào web checkout. Hold theo Booking ID và payment cùng-ID được
triển khai ở các lượt sau; các route Reservation hiện tại chưa bị xóa hoặc đổi hành vi.

Tests: `apps/api/tests/integration/booking-drafts.test.ts`. Chạy trên PostgreSQL cô lập
đã migrate, chưa seed check-in slots, với `DATABASE_URL` và `BOOKING_TEST_DATABASE_URL`
cùng trỏ đến database test, rồi chạy `bun test apps/api/tests/integration/booking-drafts.test.ts`.
Khi không có biến test URL, suite này được skip trong lệnh test thông thường.

## Guest identity decision — 1A / 2A

The user supersedes the Customer identity model in #77/#92: remove `customers` and
customer foreign keys. Booking contact is the transaction contact; repeated email
never merges contact or implicitly links account history. `bookings.user_id` is
nullable and only written from an authenticated session or a future explicit claim.

1A: booking code + email → email OTP → scoped access before private details.
2A: signed-in Booking creation saves it to that account; guest bookings require
verification plus an explicit Save to account action. Login/email verification
never scans or attaches bookings with a matching email. Claim conflicts are TBD.

This change removes Customer reconciliation from Auth, reads contact from Booking
in operations/payment/check-in, and reads Rental ownership through Booking.userId.
Legacy Reservation payment copies draft contact when confirming its new Booking;
it remains guest-only until the planned Booking payment migration. No backfill.
OTP/claim endpoints and UI remain separate work, one endpoint per turn.

Verification: generated migrations `0028_uneven_luminals.sql` (remove customer FKs/columns,
add nullable Booking user ownership and contact constraint), then `0029_ambiguous_komodo.sql`
(drop Customer). Two generated steps avoid Drizzle dropping already-cascaded FKs.
Fresh PostgreSQL 18 migrations, seed → clear → seed, 46 API integration tests,
47 web tests, all workspace type checks and Biome passed. The My Storage detail
Playwright check passed with mock API; this does not verify the pending OTP/claim UI.
Migrations have not been applied to the configured development database.
