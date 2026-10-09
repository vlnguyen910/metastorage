export const SWAGGER_MESSAGES = {
  description: `HTTP API for the metastorage platform.

### Test with a development account
1. Run \`bun run db:seed\`, then \`bun run --filter api seed:auth\` to prepare the four development accounts. The auth seed resets their development passwords.
2. Open **Authentication → POST /api/auth/sign-in/email → Try it out**. Select CUSTOMER, FACILITY_STAFF, FACILITY_MANAGER, or BUSINESS_OPERATION_MANAGER from the examples dropdown, then Execute.
3. The browser saves the session cookie automatically. Call **GET /api/auth/me** to check the current role, then test other endpoints on this same origin. No bearer token is needed.
4. Use **POST /api/auth/sign-out** before signing in as another role.

Staff and facility manager accounts are assigned to HCM-01 by the database seed. Use that facility's ID when testing scoped endpoints. These accounts are development fixtures, separate from the frontend mock accounts.`,
  signInSummary: "Sign in as a seeded development role",
  signInDescription:
    "Select a role example. Login creates the session cookie used by Swagger requests.",
  sessionCreated: "Session cookie created",
  invalidCredentials: "Invalid email or password",
  verificationRequired: "Email verification required",
  signOutSummary: "Sign out before switching roles",
  sessionCleared: "Session cookie cleared",
  localServer: "Current origin (keeps the login session cookie on the same host)",
} as const;
