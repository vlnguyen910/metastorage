# metastorage database diagram

This diagram records every table and column currently declared in
`packages/database/src/schema`. Rental and guest access remain future work;
Booking and Payment are introduced by issue #18.

```mermaid
erDiagram
  users o|--o| customers : links_after_verification
  users ||--o{ accounts : authenticates_with
  users ||--o{ sessions : signs_in_with
  users ||--o{ facility_assignments : receives
  facilities ||--o{ facility_assignments : has
  facilities ||--o{ unit_types : offers
  unit_types ||--o{ storage_units : materializes
  facilities ||--o{ storage_units : contains
  facilities ||--o{ facility_operating_hours : schedules
  facilities ||--o{ reservation_drafts : receives
  unit_types ||--o{ reservation_drafts : selects
  unit_types ||--o{ capacity_allocations : allocates
  facilities ||--o{ capacity_allocations : reserves
  customers ||--o{ bookings : owns
  users o|--o{ bookings : assigned_to
  customers ||--o{ payments : makes
  bookings ||--o{ payments : records
  bookings ||--o{ booking_confirmation_emails : notifies
  bookings ||--o{ checkin_verifications : verifies
  users ||--o{ checkin_verifications : performs
  facilities ||--o{ checkin_verifications : scopes
  unit_assignments ||--o{ checkin_verifications : snapshots

  users {
    uuid id PK
    text name
    varchar email UK
    boolean email_verified
    text image
    varchar phone UK
    varchar password_hash
    role role
    status status
    timestamptz created_at
    timestamptz updated_at
  }

  customers {
    uuid id PK
    uuid user_id FK,UK "nullable"
    varchar full_name
    varchar email UK "normalized lookup"
    varchar phone
    timestamptz created_at
    timestamptz updated_at
  }

  accounts {
    text id PK
    uuid user_id FK
    text account_id
    text provider_id
    text access_token
    text refresh_token
    text id_token
    timestamptz access_token_expires_at
    timestamptz refresh_token_expires_at
    text scope
    text password
    timestamptz created_at
    timestamptz updated_at
  }

  sessions {
    text id PK
    uuid user_id FK
    text token UK
    timestamptz expires_at
    text ip_address
    text user_agent
    timestamptz created_at
    timestamptz updated_at
  }

  verifications {
    text id PK
    text identifier
    text value
    timestamptz expires_at
    timestamptz created_at
    timestamptz updated_at
  }

  facility_assignments {
    uuid id PK
    uuid user_id FK
    uuid facility_id FK
    timestamptz assigned_at
    timestamptz ended_at
    boolean is_active
    role role
  }

  facilities {
    uuid id PK
    varchar code UK
    varchar name
    text address
    text description
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  unit_types {
    uuid id PK
    uuid facility_id FK
    varchar code
    varchar name
    varchar size_label
    real size_sqm
    integer monthly_price
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  storage_units {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    varchar code UK
    storage_unit_status status
    timestamptz created_at
    timestamptz updated_at
  }

  facility_operating_hours {
    uuid id PK
    uuid facility_id FK
    integer day_of_week
    time open_time
    time close_time
    varchar timezone
  }

  reservation_drafts {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    timestamptz check_in_at
    timestamptz rental_end_at
    integer duration_months
    varchar contact_name
    varchar contact_email
    varchar contact_phone
    reservation_draft_status status
    reservation_pricing_status pricing_status
    jsonb pricing "nullable, immutable checkout price snapshot"
    timestamptz created_at
    timestamptz updated_at
  }

  capacity_allocations {
    uuid id PK
    uuid facility_id FK
    uuid unit_type_id FK
    uuid reference_id
    capacity_allocation_kind kind
    capacity_allocation_status status
    timestamptz starts_at
    timestamptz ends_at
    timestamptz created_at
    timestamptz updated_at
  }

  bookings {
    uuid id PK
    varchar booking_code UK
    uuid customer_id FK
    uuid facility_id FK
    uuid unit_type_id FK
    integer requested_months
    varchar contact_name
    varchar contact_email
    varchar contact_phone
    timestamptz check_in_slot_start
    timestamptz check_in_slot_end
    timestamptz rental_end_at
    numeric monthly_rate_snapshot
    numeric rental_fee_amount
    numeric deposit_amount
    numeric total_amount
    varchar currency
    varchar status
    varchar qr_token_hash UK
    timestamptz paid_at
    timestamptz created_at
    timestamptz updated_at
  }

  payments {
    uuid id PK
    uuid booking_id FK
    uuid draft_id FK
    uuid customer_id FK
    varchar provider
    varchar provider_payment_id
    varchar payment_code UK
    varchar hold_token_hash
    varchar idempotency_key UK
    numeric monthly_rate_snapshot
    numeric rental_fee_amount
    numeric deposit_amount
    numeric total_amount
    varchar currency
    payment_status status
    timestamptz paid_at
    timestamptz created_at
    timestamptz updated_at
  }

  payment_provider_events {
    uuid id PK
    varchar provider
    varchar provider_event_id
    uuid payment_id FK
    varchar payment_code
    numeric amount
    varchar transfer_type
    varchar reference_code
    payment_provider_event_status status
    jsonb payload_metadata
    timestamptz created_at
    timestamptz updated_at
  }

  unit_assignments {
    uuid id PK
    uuid booking_id FK
    uuid physical_unit_id FK
    uuid assigned_by FK
    varchar status
    timestamptz assigned_at
    timestamptz ended_at
    text reason
  }

  booking_confirmation_emails {
    uuid id PK
    uuid booking_id FK
    varchar recipient_email
    varchar template
    booking_email_status status
    integer attempts
    text last_error
    varchar provider_message_id
    timestamptz sent_at
    timestamptz created_at
    timestamptz updated_at
  }

  checkin_verifications {
    uuid id PK
    uuid booking_id FK
    uuid facility_id FK
    uuid staff_id FK
    uuid unit_assignment_id FK
    checkin_verification_status status
    timestamptz verified_at
    timestamptz consumed_at
    timestamptz invalidated_at
    text invalidated_reason
    timestamptz created_at
    timestamptz updated_at
  }
```

## Existing constraints and behavior

- UUID primary keys on `users`, `customers`, `facilities`, `facility_assignments`,
  `unit_types`, `storage_units`, `facility_operating_hours`, `reservation_drafts`
  and `capacity_allocations` default to generated random UUIDs. Auth tables
  `accounts`, `sessions` and `verifications` use text primary keys.
- `users.email`, `users.phone`, `facilities.code`, `storage_units.code` and
  `sessions.token` are unique. `users.phone` is nullable. `customers.user_id` is
  nullable and unique. `customers.email` is unique by its trimmed, lowercase
  value; its index is an expression index, not a plain column constraint.
- Varchar limits are `users.email` 255, `users.phone` 20,
  `users.password_hash` 255; `customers.full_name` 150, `customers.email` 320,
  `customers.phone` 32; `facilities.code` 50, `facilities.name` 150;
  `unit_types.code` 80, `unit_types.name` 100, `unit_types.size_label` 50;
  `storage_units.code` 80; `facility_operating_hours.timezone` 64; and
  reservation draft contact name/email/phone 150/320/32.
- Nullable columns are `users.image`, `users.phone`, `users.password_hash`,
  `users.role`, `users.status`, `customers.user_id`, `facilities.description`,
  `facility_assignments.ended_at`, `sessions.ip_address`,
  `sessions.user_agent`, and the optional token, expiry, scope and password
  fields in `accounts`. Every other column shown is required.
- Enum values are `role`: `CUSTOMER`, `FACILITY_STAFF`, `FACILITY_MANAGER`,
  `BUSINESS_OPERATION_MANAGER`, `SYSTEM_ADMIN`; `status`: `ACTIVE`, `INACTIVE`;
  `storage_unit_status`: `AVAILABLE`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`,
  `INSPECTION`, `RETURN_PENDING`, `LOCKED`, `INACTIVE`;
  `reservation_draft_status`: `DRAFT`; `reservation_pricing_status`:
  `PRICING_NOT_CONFIGURED`, `PRICED`; `capacity_allocation_kind`: `HOLD`, `BOOKING`; and
  `capacity_allocation_status`: `ACTIVE`, `RELEASED`, `EXPIRED`.
- Composite unique indexes exist on `facility_assignments(user_id, facility_id)`,
  `unit_types(facility_id, code)`, `unit_types(id, facility_id)` and
  `facility_operating_hours(facility_id, day_of_week)`.
- `storage_units`, `reservation_drafts` and `capacity_allocations` each use a
  composite foreign key `(unit_type_id, facility_id)` to
  `unit_types(id, facility_id)`. `capacity_allocations.reference_id` is a UUID
  reference value without a database foreign key at this stage.
- User foreign keys use `ON DELETE CASCADE` for `accounts`, `sessions` and
  `facility_assignments`, and `ON DELETE SET NULL` for `customers.user_id`.
  Facility foreign keys use `ON DELETE CASCADE` for `unit_types`,
  `storage_units`, `facility_operating_hours` and `facility_assignments`, and
  `ON DELETE RESTRICT` for reservation drafts and capacity allocations.
  Composite Unit Type foreign keys use `ON DELETE RESTRICT`.
- `created_at` and `updated_at` columns default to `now()` wherever shown;
  `assigned_at` also defaults to `now()`. `facilities.is_active`,
  `unit_types.is_active` and `facility_assignments.is_active` default to true.
  `storage_units.status` defaults to `AVAILABLE`,
  `reservation_drafts.status` to `DRAFT`,
  `reservation_drafts.pricing_status` to `PRICING_NOT_CONFIGURED`, and
  `capacity_allocations.status` to `ACTIVE`. The default operating timezone is
  `Asia/Ho_Chi_Minh`.

For public catalog queries, a facility is eligible when it is active and has at
least one `storage_units.status = AVAILABLE`. Unit Type availability is grouped
by `unit_types.id` and counts only `AVAILABLE` units. Reservation, hold and
booking flows reference the Unit Type ID; a physical unit is assigned later by
operations and is never selected by the customer.

## M0 customer identity decision (#77)

`users` represents authentication identity. `customers` represents the renter in
the business domain. A customer can exist without a User account, so
`customers.user_id` is nullable. The nullable unique index allows at most one
Customer to be linked to a User. Checkout reuses an existing Customer when the
trimmed, lowercase email matches; otherwise it creates a Customer. The unique
email index keeps this rule consistent under concurrent checkouts. Matching an
email for checkout association does not itself prove the guest owns that email
or authorize access to previous bookings. An unverified checkout must not
overwrite an existing Customer's profile fields or `user_id`; its submitted
name, email and phone belong in the new Booking's contact snapshot. Deleting a
User unlinks its Customer rather than deleting business history.

The current reservation draft stores the guest's name, email and phone without
requiring a User or creating a Customer. Booking and Rental will reference
`customers.id`, never `users.id`, when their tables are introduced by their
respective issues. A Booking must also retain a snapshot of the contact details
used for that transaction. Successful payment is the point at which checkout
creates or associates the business Customer and Booking. No Booking, Rental or
guest access session table is introduced by this M0 schema change.

Linking a Customer to a User requires verified ownership of the contact channel;
an authenticated session or an equal email string alone does not authorize a
User link. Guest access to a Booking/Rental likewise requires contact
verification and a short-lived, scoped session. Checkout association by email
must never create a guest access session or a User link. Once the Customer is
linked to a User, new bookings associated by that email will belong to the same
Customer and become visible to that User; this is an accepted consequence of
the chosen reuse policy. The tracking mechanism (email OTP or signed magic
link), expiry and claim workflow are **TBD** for the dependent Booking,
tracking and account-linking implementation.

## Payment and Booking notes (#18)

- New checkout drafts store an immutable `pricing` snapshot: rental fee equals
  the monthly rate times the requested months; the deposit equals one month's
  rate; total equals rental fee plus deposit, in VND. Payments use this stored
  quote even if catalog prices change later. Legacy unpriced drafts must be recreated.

- `bookings.customer_id` references `customers.id`, never `users.id`.
- Booking stores contact and pricing snapshots so later Customer profile
  changes do not rewrite historical transaction data.
- Payment provider integration is selected through a gateway adapter. The
  current implementation provides a mock/test adapter; the production provider
  pricing policy uses the confirmed one-month deposit rule for checkout.
- A successful payment changes the matching active capacity allocation from
  `HOLD` to `BOOKING` inside the same transaction. No physical unit is assigned
  at checkout.
- `payments.idempotency_key` and `(provider, provider_payment_id)` are unique.
- `payments.draft_id` and the hash of the hold token scope idempotent replay to
  the original checkout; plaintext hold tokens are never stored.
