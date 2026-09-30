# Authentication and role setup

The web app uses Better Auth's database-backed cookie session in remote mode. The API reads the
session cookie on protected requests and loads the user's current role and status from PostgreSQL.
The browser's stored user object only supports navigation; it does not grant API access.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env`. For local development, set
   `NODE_ENV=development`, a private `BETTER_AUTH_SECRET` of at least 32 characters, and
   `DATABASE_URL` for the database you intend to use. Set `DOCKER_DATABASE_URL` only when
   you want to override that URL with a local Docker database.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`. The default mode is `remote`, with the
   API at `http://localhost:4000/api`. Set `NEXT_PUBLIC_API_MODE=mock` only to use demo accounts.
3. Configure Resend in `apps/api/.env`: set `RESEND_API_KEY` and a verified sender in
   `RESEND_FROM_EMAIL`. Signup returns `503 EMAIL_DELIVERY_UNAVAILABLE` until both are set.
4. For Mobile, copy `apps/mobile/.env.example` to `apps/mobile/.env.local`. A physical device must
   use the development machine's LAN address instead of `localhost` for
   `EXPO_PUBLIC_API_BASE_URL`.
5. From the repository root, run `bun run db:migrate` to apply existing migrations to the
   configured database, then start the API and Web/Mobile workspaces.
6. Register from `/register` on Web or the Customer signup screen on Mobile. Verify the email link
   before signing in. For the initial System Administrator, promote the verified account once using
   a trusted database connection:

   ```sql
   UPDATE users
   SET role = 'SYSTEM_ADMIN'
   WHERE email = 'admin@metastorage.test' AND email_verified = true;
   ```

   Public signup cannot set or change a role. The raw Better Auth `/sign-up/email` route is blocked;
   Customer accounts must use `/api/auth/customer-sign-up` so the API can validate and associate the
   Customer record.

## Customer registration

- Signup requires name, normalized email, phone, password, password confirmation, and a fixed
  callback target (`web` or `mobile`). `users.phone` remains nullable/optional in the database;
  signup requires a phone because a Customer profile requires one.
- Email must not already belong to a User or to a Customer linked to another User. The response
  directs the person to sign in or recover the existing account.
- If an unlinked guest Customer already has the verified email, the account is linked only after
  email verification. The guest's name, phone, and other profile fields remain unchanged, so their
  existing bookings/rentals become visible through the linked Customer. If no Customer exists, one
  is created from the verified signup details.
- Signup never creates a session. Verification redirects to `/verify-email` on Web or the
  `metastorage://auth/verified` deep link on Mobile; the user then signs in. An unverified sign-in attempt
  sends a fresh verification link.
- No database schema migration is needed: `users.phone` is already nullable, and the existing
  Customer link/normalized-email constraints support this flow.

## Session and authorization behavior

- Login and logout use Better Auth's `/sign-in/email` and `/sign-out` endpoints. The API client sends
  cookies with credentialed requests. Session lookup uses `GET /api/users/me`, whose API guard
  validates the Better Auth cookie before returning the current database user.
- Fastify route guards verify the Better Auth session, reject inactive accounts, and enforce role
  access. Facility routes also check the user's active facility assignment.
- Assigning `FACILITY_STAFF` or `FACILITY_MANAGER` sets the global role only. Access to a specific
  facility still requires a separate facility assignment.
- For facility access, the account role and the active facility assignment role must match. An
  expired, revoked, or mismatched assignment grants no access. Facility staff and managers see only
  their assigned facilities in `GET /api/facilities`; customers retain the facility listing, and
  System Administrators and Business Operation Managers retain global facility access.
- The mock API remains available for UI demos and is not connected to PostgreSQL.
