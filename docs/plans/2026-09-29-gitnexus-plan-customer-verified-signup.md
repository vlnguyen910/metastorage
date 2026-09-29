# GitNexus Engineering Plan

> Task: Customer registration with email verification and verified linking to guest Customer profiles, across API/Web/Mobile; retain nullable User.phone.
> Evidence verified at commit ec5f091f3abf27782b4200cac0914412c390ed3e; GitNexus index refreshed in this session with --index-only --pdg; runner identity v4 current (GitNexus 1.6.12, Node v24.18.0).
> Evidence provenance schema 2; global dirty digest 0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd; cited-path manifest 63 sorted entries; exact generated plan path excluded.

## 1. Objective

Implement Customer signup end-to-end. Signup remains unverified and unauthenticated until the user opens a Resend email link; verified ownership then atomically associates an existing guest Customer without changing that Customer's profile, or creates a Customer when none exists. Web and Mobile redirect to explicit sign-in after verification.

## 2. Current Behaviour

- [verified] Better Auth email/password is enabled without required email verification; its HTTP wildcard is mounted at /api/auth (apps/api/src/modules/auth/auth.ts:7-57; apps/api/src/modules/auth/auth.routes.ts:6-33; apps/api/src/app.ts:39-49).
- [verified] User.phone is already nullable in Drizzle and optional in the User contract; Customer.phone is required (packages/database/src/schema/users.ts:18-30; packages/database/src/schema/customers.ts:5-20; packages/contracts/src/index.ts:80-101).
- [verified] Payment checkout transactionally inserts/reuses Customer by normalized email, preserves the existing profile on conflict, and locks the selected Customer (apps/api/src/modules/payments/payments.repository.ts:121-159).
- [verified] Rental access resolves Customer by customers.userId (apps/api/src/modules/rentals/rentals.repository.ts:39-45); this matches policy #77 that email equality alone never authorizes a User link (docs/db-diagram.md:285-316).
- [verified] Web has login/forgot-password but no registration; Mobile is a sample screen with no auth client/session storage (apps/web/src/features/auth/login-form.tsx:19-63; apps/mobile/App.tsx:1-35; apps/mobile/package.json:15-28).

## 3. Relevant Architecture

- [verified] API uses Route → Service → Repository and database transactions/row locks for consistent workflows (AGENTS.md:3-5; docs/backend-patterns.md:1-35).
- [verified] Web uses App Router adapters, feature forms, React Hook Form + Zod, and the centralized API client (docs/web-patterns.md:1-48).
- [verified] Mobile follows Screen → Feature Hook → API Client; Expo SDK 57 supports scheme deep links (docs/mobile-patterns.md:9-24; apps/mobile/app.json:1-25).
- [verified] Existing `users.phone` is nullable; retain it as optional User profile data. Customer registration still requires phone per the prior approved Customer rule; therefore no DB schema change or migration is warranted.
- [inferred] Use Better Auth emailVerification.sendVerificationEmail/afterEmailVerification and requireEmailVerification; Context7 docs support those hooks, and local Better Auth 1.7.5 source calls afterEmailVerification after its user update. Configure autoSignInAfterVerification=false.
- [inferred] Use Resend REST via native fetch inside an adapter rather than adding another dependency. Resend API requires `from`, `to`, `subject`, and HTML body.

## 4. GitNexus Findings

- [graph] `impact(auth, upstream, depth=3)` resolved zero callers with risk UNKNOWN and an explicit warning that module-scope/property references may be absent. Do not treat this as safe; direct source confirms buildApp registers authRoutes.
- [graph] `impact(toApiUser, upstream, depth=3)` reports LOW risk, 2 direct callers (UsersService.getUserById and updateUserRole), 1 transitive usersRoutes flow. `toApiUser` and the existing User phone contract remain unchanged.
- [graph] `impact(createPendingPayment, upstream, depth=3)` reports LOW risk: PaymentsService.pay at d=1 and paymentsRoutes at d=2. Checkout implementation remains unchanged.
- [graph] `query(customer registration/email verification)` found auth configuration, shared API login, Customer schema, User mapping and verification tables; no existing registration flow/test was found.
- [graph] GitNexus context and CLI status agree on HEAD ec5f091f, runner identity schema v4 current, `incompleteReasons=[]`, status up-to-date. Index refreshed with PDG because no PDG layer was previously present.

## 5. Statement-Level PDG Findings

- [graph] PDG controls for PaymentsRepository.createPendingPayment show the checkout/hold miss returns before Customer write; the normalized-email Customer insert/reselect FOR UPDATE runs only after that guard; failure to obtain the row throws before payment creation (PDG controls, apps/api/src/modules/payments/payments.repository.ts).
- [verified] Source lines 128-159 confirm the workflow is transaction-scoped, locks the checkout, inserts Customer with ON CONFLICT DO NOTHING, then locks the normalized-email row. [inferred] Customer verification reconciliation should use the same conflict-safe lock-and-reselect shape.
- [graph] Existing Rental repository reads `customers.userId`; changing link ownership without verified email would grant access to historical rentals, so verification is the required control gate.

## 6. Proposed Changes

- [verified] `packages/contracts/src/index.ts` / `packages/api-client/src/index.ts`: add shared Customer signup input and registration/resend API methods.
- [verified] `apps/api/src/modules/customers/`: add a customer-registration repository/service for duplicate checks and transactional verified Customer reconciliation; do not alter checkout logic.
- [verified] `apps/api/src/modules/auth/auth.routes.ts` / `auth.ts`: provide dedicated signup/resend endpoints, prevent raw public Better Auth signup bypass, require verified email, force Customer role, no post-verification session, and retry reconciliation before issuing a Customer session.
- [verified] `apps/api/src/common/adapters/mailer/`: add a narrow mailer boundary and Resend REST implementation; configure key/sender via env.
- [verified] `apps/web/src/app` and `features/auth`: add registration, check-email, and verification-result UI; add routes/links and keep explicit sign-in after verification.
- [verified] `apps/mobile/`: add Better Auth Expo client + SecureStore, register/login screens/hooks and storex://auth/verified deep-link handling.
- [verified] `docs/authentication.md` and the identity-policy section in `docs/db-diagram.md`: document the implemented verification/link rule and provider setup. No schema diagram change to the users table; no migration.

## 7. Implementation Sequence

1. Add shared registration contract and validation tests; commit `feat(contracts): add customer signup contract`.
2. Implement customer registration service/repository and business-rule tests: normalized lookup, preserve existing guest details, create only after verification, conflict protection, idempotency and transaction row locks; commit `feat(api): reconcile verified customer accounts`.
3. Add Resend adapter/env config and Better Auth verification callbacks, safe login retry, and route-level guard against raw signup bypass; add API adapter/auth tests; commit `feat(api): require verified customer signup`.
4. Expose dedicated signup/resend behavior through shared API client and route tests; commit `feat(api-client): expose customer registration` if not already cohesive with step 3.
5. Add Web register/check-email/verify-result pages and links; run desktop/mobile Playwright + axe; commit `feat(web): add customer registration flow`.
6. Add Expo auth dependencies, SecureStore client, signup/login screens and cold/warm deep-link handling; typecheck and verify available iOS/Android targets; commit `feat(mobile): add customer auth flow`.
7. Update authentication and Customer identity docs, env templates and seed guidance; commit `docs(auth): document verified customer signup`.

Each implementation step is independently verified and committed with only its relevant files. Before each symbol edit run current-index impact; stage only that step's paths, run detect_changes(scope=staged), and commit immediately after the gate.

## 8. Test Strategy

- API business tests cover validation, duplicate User/recovery guidance, existing unlinked Customer preservation/link, absent Customer creation from verified details, conflict with another User, idempotent retry, and concurrent association.
- API auth tests cover no session before verification, required verification before login, no raw signup bypass, resend callback target, and no automatic sign-in after verification.
- Resend adapter tests mock fetch for success, provider errors, missing credentials, and token-safe logging.
- Shared Zod contract tests cover email/name/phone/password boundaries; no phone-format policy is added beyond required/non-empty and database length.
- Web Playwright tests cover accessible labels/errors/loading, check-email state, duplicate guidance and verification-result/login handoff on desktop and Pixel 7; run axe on form and error states.
- Mobile: typecheck plus available native builds/device checks; manually verify cold/warm deep-link, keyboard avoidance, 44px targets, SecureStore persistence and sign-in after verification. Real-device coverage is reported if unavailable.
- Run the complete repository verification command set in §11 after all commits.

## 9. Risk and Impact Analysis

- [graph] `auth` impact is UNKNOWN (not low); confirm callers via source and preserve wildcard Better Auth adapter for non-registration endpoints.
- [graph] `toApiUser` has two direct User-service callers, but its phone DTO remains unchanged, so no downstream response-shape change is expected.
- [inferred] Checkout and guest-tracking policy must not change; Customer association is gated by Better Auth's successful email verification.
- [inferred] Verification callback is a post-persistence side effect, not in Better Auth's user-update transaction; make reconciliation idempotent and retry it before allowing the verified Customer sign-in to complete.
- [inferred] Unique normalized-email and unique userId indexes are the race backstops; row locks and conflict reselect prevent profile overwrite or link theft.
- Operational: Resend key and a verified sender address must be configured outside source control; without them signup cannot deliver email.
- Mobile: native scheme/dependency changes require a rebuilt app; Expo Go/browser emulation alone is not proof of production deep links.

## 10. Files Expected to Change

| Files | Purpose |
| --- | --- |
| packages/contracts/src/index.ts, packages/contracts/src/index.test.ts, packages/api-client/src/index.ts | Shared input/client contract |
| apps/api/src/modules/customers/*registration*, apps/api/src/modules/auth/auth.ts, auth.routes.ts | Transactional link/create and verified signup boundary |
| apps/api/src/common/adapters/mailer/*, apps/api/src/config/env.ts, apps/api/.env.example | Resend delivery/config |
| apps/api/tests/units/{customers,auth,common}/*registration* / *resend* | Business and delivery tests |
| apps/web/src/app/{register,verify-email}, apps/web/src/features/auth/*registration*, auth links/routes, apps/web/e2e/customer-registration.spec.ts | Web flow and accessibility/regression coverage |
| apps/mobile/App.tsx, app.json, package.json, .env.example, src/features/auth/*, src/screens/auth/*, bun.lock | Expo auth/deep-link flow |
| docs/authentication.md, docs/db-diagram.md | Operational setup and verified-link policy |

## 11. Reusable Implementation Context

See the machine-readable implementation_context block below.

## 12. Assumptions and Open Questions

- [assumed] `users.phone` remains nullable and optional for User records, as already modeled; registration requires phone because Customer.phone is mandatory and this was explicitly selected earlier.
- [assumed] Deployment will supply RESEND_API_KEY and RESEND_FROM_EMAIL, and configure trusted web origins; no secrets are stored in the repo.
- Open questions: none. The business decisions (email link, link after verified ownership, preserve existing Customer, reject linked conflicts, Web + API + Mobile, deep link to app, manual re-login, Better Auth Expo + SecureStore) were confirmed by the user.

## 13. Definition of Done

- Signup works on Web and Mobile through the dedicated Customer flow; invalid inputs are rejected and duplicate/conflicting identities receive recovery guidance.
- Email verification is required; unverified accounts cannot sign in; verification returns to the correct platform and does not create a session.
- Verified Customer association is transaction-safe, retryable and preserves existing guest Customer profile and booking/rental ownership.
- Mobile persists sign-in via Better Auth Expo + SecureStore and handles both initial and in-app deep links.
- User.phone remains nullable, no pending table/schema change is introduced, and checkout behavior is unchanged.
- Relevant unit/E2E/accessibility/type/build checks pass; any unavailable provider credentials or native-device checks are explicitly reported.

## 11. Implementation Context Pack

```json
{
  "implementation_context": {
    "task_summary": "Implement verified Customer account registration across API, Web and Mobile, preserving guest Customer profiles and existing bookings; keep User.phone nullable.",
    "acceptance_criteria": [
      "Customer can register with full name, normalized email, required phone and password; signup does not establish an authenticated session.",
      "Resend sends an email verification link; login is blocked until email is verified; verification returns to the originating Web or Mobile surface and requires a fresh sign-in.",
      "After verification, a matching unlinked guest Customer is linked transactionally without changing its profile; if no Customer exists, one is created from the verified registration details.",
      "A User email already in use or a Customer linked to another User is rejected with sign-in/recovery guidance.",
      "Association is idempotent and can be retried safely after transient failure; concurrent attempts never create duplicate Customers or steal an existing link.",
      "Web and Mobile provide registration and login flows; Mobile uses Better Auth Expo client and SecureStore.",
      "User.phone remains nullable in the database and optional as a User field; Customer registration requires phone because customers.phone is required.",
      "No DB schema/migration change is needed; existing users.phone is already nullable."
    ],
    "evidence_provenance": {
      "schema_version": 2,
      "head_commit": "ec5f091f3abf27782b4200cac0914412c390ed3e",
      "generated_plan_path": "docs/plans/2026-09-29-gitnexus-plan-customer-verified-signup.md",
      "global_dirty_digest": {
        "algorithm": "sha256",
        "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
        "value": "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
      },
      "cited_path_manifest": [
        {
          "path": "AGENTS.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:679f6eb56e9ba2ac0dbbf2cea989df8fa74871c60f78aa94e6cd6690e5fbf660",
          "index_digest": "sha256:679f6eb56e9ba2ac0dbbf2cea989df8fa74871c60f78aa94e6cd6690e5fbf660",
          "worktree_digest": "sha256:679f6eb56e9ba2ac0dbbf2cea989df8fa74871c60f78aa94e6cd6690e5fbf660",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/.env.example",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:81c338c8edb059e3ef71f4f552bad96e087a93b27c0205f055e9f94b529cd2ec",
          "index_digest": "sha256:81c338c8edb059e3ef71f4f552bad96e087a93b27c0205f055e9f94b529cd2ec",
          "worktree_digest": "sha256:81c338c8edb059e3ef71f4f552bad96e087a93b27c0205f055e9f94b529cd2ec",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3b7fe6a8e8b57535ba2ba9f34e238e785fcf2361da8f355dfb3fb9114769f6a3",
          "index_digest": "sha256:3b7fe6a8e8b57535ba2ba9f34e238e785fcf2361da8f355dfb3fb9114769f6a3",
          "worktree_digest": "sha256:3b7fe6a8e8b57535ba2ba9f34e238e785fcf2361da8f355dfb3fb9114769f6a3",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/app.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:583ac18623da6f8068fd84633a3124963fac32c05914a6e8873d030d85e09ad1",
          "index_digest": "sha256:583ac18623da6f8068fd84633a3124963fac32c05914a6e8873d030d85e09ad1",
          "worktree_digest": "sha256:583ac18623da6f8068fd84633a3124963fac32c05914a6e8873d030d85e09ad1",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/common/adapters/mailer/mailer.interface.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/common/adapters/mailer/resend.adapter.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/common/errors/app-error.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f21a148f8dc0151b63e0ca8cf7db21ce7cebc94b1c18dc5e8a3acc407f38ddc4",
          "index_digest": "sha256:f21a148f8dc0151b63e0ca8cf7db21ce7cebc94b1c18dc5e8a3acc407f38ddc4",
          "worktree_digest": "sha256:f21a148f8dc0151b63e0ca8cf7db21ce7cebc94b1c18dc5e8a3acc407f38ddc4",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/config/env.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:2665084217cea01a3789fddb4a33c08103641272b2406a3508f91c58d491d747",
          "index_digest": "sha256:2665084217cea01a3789fddb4a33c08103641272b2406a3508f91c58d491d747",
          "worktree_digest": "sha256:2665084217cea01a3789fddb4a33c08103641272b2406a3508f91c58d491d747",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/auth/auth.routes.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a17fbed7bcf8cdf1d57a4d9514bb54e3908f5a9bd74c036517696ead069634d7",
          "index_digest": "sha256:a17fbed7bcf8cdf1d57a4d9514bb54e3908f5a9bd74c036517696ead069634d7",
          "worktree_digest": "sha256:a17fbed7bcf8cdf1d57a4d9514bb54e3908f5a9bd74c036517696ead069634d7",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/auth/auth.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:cd8881e1617c498f769eda4f0f0a441d4f2565b8b2f1fad84aaac258d5d394dc",
          "index_digest": "sha256:cd8881e1617c498f769eda4f0f0a441d4f2565b8b2f1fad84aaac258d5d394dc",
          "worktree_digest": "sha256:cd8881e1617c498f769eda4f0f0a441d4f2565b8b2f1fad84aaac258d5d394dc",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/customers/customer-registration.repository.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/customers/customer-registration.service.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/payments/payments.repository.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:494dfb28d9975340eb15b5ac9ee99af50557824db78e0b8000fd5100fd081859",
          "index_digest": "sha256:494dfb28d9975340eb15b5ac9ee99af50557824db78e0b8000fd5100fd081859",
          "worktree_digest": "sha256:494dfb28d9975340eb15b5ac9ee99af50557824db78e0b8000fd5100fd081859",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/payments/payments.service.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8d4076a7611c5ca2a8d0bb8edb1f21d68d31fde229382214e656db027eaae09e",
          "index_digest": "sha256:8d4076a7611c5ca2a8d0bb8edb1f21d68d31fde229382214e656db027eaae09e",
          "worktree_digest": "sha256:8d4076a7611c5ca2a8d0bb8edb1f21d68d31fde229382214e656db027eaae09e",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/rentals/rentals.repository.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:895029cced8be1f31533ce1b721fda83bebd6fff183e1e2b709e03f57bcb3678",
          "index_digest": "sha256:895029cced8be1f31533ce1b721fda83bebd6fff183e1e2b709e03f57bcb3678",
          "worktree_digest": "sha256:895029cced8be1f31533ce1b721fda83bebd6fff183e1e2b709e03f57bcb3678",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/users/users.mapper.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:26d79572254b4a930ee657d4425c6b40c8624d6a52b1f34aa2cb39951932afdf",
          "index_digest": "sha256:26d79572254b4a930ee657d4425c6b40c8624d6a52b1f34aa2cb39951932afdf",
          "worktree_digest": "sha256:26d79572254b4a930ee657d4425c6b40c8624d6a52b1f34aa2cb39951932afdf",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/users/users.routes.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:53dc3581f6079fdad47a9eba2fcc01e3a4f3eb557a8bcde45ee6c87c9e4e389c",
          "index_digest": "sha256:53dc3581f6079fdad47a9eba2fcc01e3a4f3eb557a8bcde45ee6c87c9e4e389c",
          "worktree_digest": "sha256:53dc3581f6079fdad47a9eba2fcc01e3a4f3eb557a8bcde45ee6c87c9e4e389c",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/modules/users/users.service.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6d1d4f00f1d7d1207fd4b12fefe83da4f3d3530d9d2e33168cb77b772ab13d5e",
          "index_digest": "sha256:6d1d4f00f1d7d1207fd4b12fefe83da4f3d3530d9d2e33168cb77b772ab13d5e",
          "worktree_digest": "sha256:6d1d4f00f1d7d1207fd4b12fefe83da4f3d3530d9d2e33168cb77b772ab13d5e",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/src/seed-auth.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:2db017c8fad2d60272372a1c1e583caea1777670e525a1db13d05905db5088b4",
          "index_digest": "sha256:2db017c8fad2d60272372a1c1e583caea1777670e525a1db13d05905db5088b4",
          "worktree_digest": "sha256:2db017c8fad2d60272372a1c1e583caea1777670e525a1db13d05905db5088b4",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/tests/units/auth/auth.authorization.test.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7d52506d7c5be86ef451a076090a077ae47d0105b97e3d4ddca9b041da9df397",
          "index_digest": "sha256:7d52506d7c5be86ef451a076090a077ae47d0105b97e3d4ddca9b041da9df397",
          "worktree_digest": "sha256:7d52506d7c5be86ef451a076090a077ae47d0105b97e3d4ddca9b041da9df397",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/tests/units/auth/auth.routes.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/tests/units/common/resend.adapter.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/tests/units/customers/customer-registration.repository.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/api/tests/units/customers/customer-registration.service.test.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/.env.example",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/App.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ac19d9164e4a135e542560a6476c795b073d774876c5d29712587706229c0dcc",
          "index_digest": "sha256:ac19d9164e4a135e542560a6476c795b073d774876c5d29712587706229c0dcc",
          "worktree_digest": "sha256:ac19d9164e4a135e542560a6476c795b073d774876c5d29712587706229c0dcc",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/app.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ef91753432b3165c757921c65d8e1e2787b8f10e50527014059b65aefaa7bb32",
          "index_digest": "sha256:ef91753432b3165c757921c65d8e1e2787b8f10e50527014059b65aefaa7bb32",
          "worktree_digest": "sha256:ef91753432b3165c757921c65d8e1e2787b8f10e50527014059b65aefaa7bb32",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:29c7191442ae3b66747eca1a8806a596cc1165363989cf2b04bea68fb6eaf9b0",
          "index_digest": "sha256:29c7191442ae3b66747eca1a8806a596cc1165363989cf2b04bea68fb6eaf9b0",
          "worktree_digest": "sha256:29c7191442ae3b66747eca1a8806a596cc1165363989cf2b04bea68fb6eaf9b0",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/metro.config.js",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:4f72948e4c3d8d1f8246312704f544d32da12c1541bca4a884ccaaa85067b456",
          "index_digest": "sha256:4f72948e4c3d8d1f8246312704f544d32da12c1541bca4a884ccaaa85067b456",
          "worktree_digest": "sha256:4f72948e4c3d8d1f8246312704f544d32da12c1541bca4a884ccaaa85067b456",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3b9d8165fb54c286f6c0daaa2ef881eb50db1c333a8d18839874324a473a2350",
          "index_digest": "sha256:3b9d8165fb54c286f6c0daaa2ef881eb50db1c333a8d18839874324a473a2350",
          "worktree_digest": "sha256:3b9d8165fb54c286f6c0daaa2ef881eb50db1c333a8d18839874324a473a2350",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/src/features/auth/auth-client.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/src/features/auth/use-customer-auth.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/src/screens/auth/login-screen.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/mobile/src/screens/auth/register-screen.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/e2e/customer-registration.spec.ts",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/e2e/frontend-quality.spec.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:cc94a66e2af317981bb45052a24b8c7ea4343b01fb182fe4d62a5f6eb33728fa",
          "index_digest": "sha256:cc94a66e2af317981bb45052a24b8c7ea4343b01fb182fe4d62a5f6eb33728fa",
          "worktree_digest": "sha256:cc94a66e2af317981bb45052a24b8c7ea4343b01fb182fe4d62a5f6eb33728fa",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:46924911069e7a97d911d2c7868b39f902ab3b282fa6404411baf887f765024c",
          "index_digest": "sha256:46924911069e7a97d911d2c7868b39f902ab3b282fa6404411baf887f765024c",
          "worktree_digest": "sha256:46924911069e7a97d911d2c7868b39f902ab3b282fa6404411baf887f765024c",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/playwright.config.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:340a1a1ae3529e5f32d53d4a5835b6e03bbfb990ec1bf27052113f2822e277e5",
          "index_digest": "sha256:340a1a1ae3529e5f32d53d4a5835b6e03bbfb990ec1bf27052113f2822e277e5",
          "worktree_digest": "sha256:340a1a1ae3529e5f32d53d4a5835b6e03bbfb990ec1bf27052113f2822e277e5",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/app/login/page.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:daa2fa5aa43c324ef485d47ce26eceee3ed313d5d472c27652c90bea77b62daa",
          "index_digest": "sha256:daa2fa5aa43c324ef485d47ce26eceee3ed313d5d472c27652c90bea77b62daa",
          "worktree_digest": "sha256:daa2fa5aa43c324ef485d47ce26eceee3ed313d5d472c27652c90bea77b62daa",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/app/register/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/app/verify-email/page.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/components/layout/public-header.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7d2bd7d4e68ddef20d4d3696dfeea092f959fbef9aca571ea2b16700d6cb1489",
          "index_digest": "sha256:7d2bd7d4e68ddef20d4d3696dfeea092f959fbef9aca571ea2b16700d6cb1489",
          "worktree_digest": "sha256:7d2bd7d4e68ddef20d4d3696dfeea092f959fbef9aca571ea2b16700d6cb1489",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/config/routes/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:58942d00178bcbb4f5f77d21ad2f7dada5b979b1d68a6ebf4f783a6681cfa456",
          "index_digest": "sha256:58942d00178bcbb4f5f77d21ad2f7dada5b979b1d68a6ebf4f783a6681cfa456",
          "worktree_digest": "sha256:58942d00178bcbb4f5f77d21ad2f7dada5b979b1d68a6ebf4f783a6681cfa456",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/config/routes/public.routes.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:bcd67f426c7642ed0f6c428584ed5eaa20e6525b3db01b0dd7dc7175c25e85b3",
          "index_digest": "sha256:bcd67f426c7642ed0f6c428584ed5eaa20e6525b3db01b0dd7dc7175c25e85b3",
          "worktree_digest": "sha256:bcd67f426c7642ed0f6c428584ed5eaa20e6525b3db01b0dd7dc7175c25e85b3",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/features/auth/customer-registration-form.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/features/auth/email-verification-result.tsx",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "absent"
          },
          "state": "absent",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "absent"
        },
        {
          "path": "apps/web/src/features/auth/login-form.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1a326950f2e4d4445173fafecae810372e75252f232f5445c02dd63591691ae3",
          "index_digest": "sha256:1a326950f2e4d4445173fafecae810372e75252f232f5445c02dd63591691ae3",
          "worktree_digest": "sha256:1a326950f2e4d4445173fafecae810372e75252f232f5445c02dd63591691ae3",
          "untracked_digest": "absent"
        },
        {
          "path": "docs/authentication.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3a837990f205d3ff55af4dd3ccbecbe30da00d6c004d4ec74f40d97aedb94eb7",
          "index_digest": "sha256:3a837990f205d3ff55af4dd3ccbecbe30da00d6c004d4ec74f40d97aedb94eb7",
          "worktree_digest": "sha256:3a837990f205d3ff55af4dd3ccbecbe30da00d6c004d4ec74f40d97aedb94eb7",
          "untracked_digest": "absent"
        },
        {
          "path": "docs/backend-patterns.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6b0451250402733b23a4ca1f2ff09b9a4a040a57af86ea03396f0b21405e2ee1",
          "index_digest": "sha256:6b0451250402733b23a4ca1f2ff09b9a4a040a57af86ea03396f0b21405e2ee1",
          "worktree_digest": "sha256:6b0451250402733b23a4ca1f2ff09b9a4a040a57af86ea03396f0b21405e2ee1",
          "untracked_digest": "absent"
        },
        {
          "path": "docs/db-diagram.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1973e9b8ada6b30c78cd048349e4c61b5c94ccfd569a124ca147060205ab5893",
          "index_digest": "sha256:1973e9b8ada6b30c78cd048349e4c61b5c94ccfd569a124ca147060205ab5893",
          "worktree_digest": "sha256:1973e9b8ada6b30c78cd048349e4c61b5c94ccfd569a124ca147060205ab5893",
          "untracked_digest": "absent"
        },
        {
          "path": "docs/mobile-patterns.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:23f44cd080eebba81bd090e57f6b5e6856f3c914c3cee6e3ef416bfd84d60926",
          "index_digest": "sha256:23f44cd080eebba81bd090e57f6b5e6856f3c914c3cee6e3ef416bfd84d60926",
          "worktree_digest": "sha256:23f44cd080eebba81bd090e57f6b5e6856f3c914c3cee6e3ef416bfd84d60926",
          "untracked_digest": "absent"
        },
        {
          "path": "docs/web-patterns.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:847cb6e2ee7f1b97cf28d3c2a5111b830b1d2848a71e0ffe993b4831a3c7b481",
          "index_digest": "sha256:847cb6e2ee7f1b97cf28d3c2a5111b830b1d2848a71e0ffe993b4831a3c7b481",
          "worktree_digest": "sha256:847cb6e2ee7f1b97cf28d3c2a5111b830b1d2848a71e0ffe993b4831a3c7b481",
          "untracked_digest": "absent"
        },
        {
          "path": "package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:434276c70fecec24739bc0c255e32c4e78b701d2b2fe5b0af4fd57ce045a8fbe",
          "index_digest": "sha256:434276c70fecec24739bc0c255e32c4e78b701d2b2fe5b0af4fd57ce045a8fbe",
          "worktree_digest": "sha256:434276c70fecec24739bc0c255e32c4e78b701d2b2fe5b0af4fd57ce045a8fbe",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/api-client/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:843148f0cb8c4b4c89c55a8856cc926ca4215eee565c05ff7ce93c07aa34346f",
          "index_digest": "sha256:843148f0cb8c4b4c89c55a8856cc926ca4215eee565c05ff7ce93c07aa34346f",
          "worktree_digest": "sha256:843148f0cb8c4b4c89c55a8856cc926ca4215eee565c05ff7ce93c07aa34346f",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/api-client/src/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:41b2ca9295bb4c70197fe604ed9e702cc17d2aa3328543e01fe70f17bf2445bf",
          "index_digest": "sha256:41b2ca9295bb4c70197fe604ed9e702cc17d2aa3328543e01fe70f17bf2445bf",
          "worktree_digest": "sha256:41b2ca9295bb4c70197fe604ed9e702cc17d2aa3328543e01fe70f17bf2445bf",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/contracts/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8e3b65212c4e8e1b62bfe1494187ca3fa4d7243dcab6ac6883d36348ae0555f3",
          "index_digest": "sha256:8e3b65212c4e8e1b62bfe1494187ca3fa4d7243dcab6ac6883d36348ae0555f3",
          "worktree_digest": "sha256:8e3b65212c4e8e1b62bfe1494187ca3fa4d7243dcab6ac6883d36348ae0555f3",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/contracts/src/index.test.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e0427684b335ed3efe973d33b8a3eca7436fb8033a4d9546ff66815ceb42d1be",
          "index_digest": "sha256:e0427684b335ed3efe973d33b8a3eca7436fb8033a4d9546ff66815ceb42d1be",
          "worktree_digest": "sha256:e0427684b335ed3efe973d33b8a3eca7436fb8033a4d9546ff66815ceb42d1be",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/contracts/src/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7dec94feea08d67d70ccc3e84c79f8ecd50bcdec93eb389c5a980fec0c344671",
          "index_digest": "sha256:7dec94feea08d67d70ccc3e84c79f8ecd50bcdec93eb389c5a980fec0c344671",
          "worktree_digest": "sha256:7dec94feea08d67d70ccc3e84c79f8ecd50bcdec93eb389c5a980fec0c344671",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/database/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:9df85f7b5b449a311307310997ce4645dd54227db384c4b3f48c93d15f7e3f28",
          "index_digest": "sha256:9df85f7b5b449a311307310997ce4645dd54227db384c4b3f48c93d15f7e3f28",
          "worktree_digest": "sha256:9df85f7b5b449a311307310997ce4645dd54227db384c4b3f48c93d15f7e3f28",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/database/src/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:535ec2b8ce3ff4cd0f5fb282b8f8b2bbddd8ccc6d1feb260675f17d1a9457e0d",
          "index_digest": "sha256:535ec2b8ce3ff4cd0f5fb282b8f8b2bbddd8ccc6d1feb260675f17d1a9457e0d",
          "worktree_digest": "sha256:535ec2b8ce3ff4cd0f5fb282b8f8b2bbddd8ccc6d1feb260675f17d1a9457e0d",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/database/src/schema/customers.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f109433a231de8c082f9a1e00fe84976a346b58211291eb4ca6fcff927cadd88",
          "index_digest": "sha256:f109433a231de8c082f9a1e00fe84976a346b58211291eb4ca6fcff927cadd88",
          "worktree_digest": "sha256:f109433a231de8c082f9a1e00fe84976a346b58211291eb4ca6fcff927cadd88",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/database/src/schema/users.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:528ea90f76b8e4c05f227b23093fbbafabfae794ad4f59316dfa26b4831fdbf3",
          "index_digest": "sha256:528ea90f76b8e4c05f227b23093fbbafabfae794ad4f59316dfa26b4831fdbf3",
          "worktree_digest": "sha256:528ea90f76b8e4c05f227b23093fbbafabfae794ad4f59316dfa26b4831fdbf3",
          "untracked_digest": "absent"
        },
        {
          "path": "packages/database/src/seed.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:31dac4604dbc166fbe8724bb3194eaf5440bdb0e4043b522ef5c4db0c76e6fe4",
          "index_digest": "sha256:31dac4604dbc166fbe8724bb3194eaf5440bdb0e4043b522ef5c4db0c76e6fe4",
          "worktree_digest": "sha256:31dac4604dbc166fbe8724bb3194eaf5440bdb0e4043b522ef5c4db0c76e6fe4",
          "untracked_digest": "absent"
        }
      ]
    },
    "primary_symbols": [
      {
        "symbol": "auth",
        "file": "apps/api/src/modules/auth/auth.ts",
        "lines": "7-57",
        "role": "Better Auth configuration and verification lifecycle"
      },
      {
        "symbol": "authRoutes",
        "file": "apps/api/src/modules/auth/auth.routes.ts",
        "lines": "6-33",
        "role": "Better Auth HTTP adapter and registration endpoint boundary"
      },
      {
        "symbol": "createPendingPayment",
        "file": "apps/api/src/modules/payments/payments.repository.ts",
        "lines": "121-189",
        "role": "Existing transactional guest Customer create/reuse pattern"
      },
      {
        "symbol": "toApiUser",
        "file": "apps/api/src/modules/users/users.mapper.ts",
        "lines": "12-22",
        "role": "Current API User mapping; User.phone remains in contract"
      },
      {
        "symbol": "usersRoutes",
        "file": "apps/api/src/modules/users/users.routes.ts",
        "lines": "9-77",
        "role": "User profile and list consumers"
      }
    ],
    "related_symbols": [
      {
        "symbol": "buildApp",
        "relationship": "registers authRoutes",
        "relevance": "auth module is mounted at /api/auth"
      },
      {
        "symbol": "PaymentsService.pay",
        "relationship": "CALLS createPendingPayment",
        "relevance": "guest checkout path must retain behavior"
      },
      {
        "symbol": "RentalsRepository.findCustomerId",
        "relationship": "queries customers.userId",
        "relevance": "linking unlocks existing rentals"
      },
      {
        "symbol": "LoginForm",
        "relationship": "calls shared api.auth.login",
        "relevance": "Web login/recovery links and post-verification entry"
      },
      {
        "symbol": "createStorexApiClientImpl",
        "relationship": "central API client",
        "relevance": "Web/Mobile registration uses the shared client"
      }
    ],
    "execution_path": [
      "Web/Mobile submits shared registration contract to POST /api/auth/customer-sign-up.",
      "Route validates availability and input, then calls Better Auth signUpEmail with role forced to CUSTOMER and no callback session.",
      "Better Auth persists unverified User (including nullable phone field) and sends a Resend verification link with platform-specific callbackURL.",
      "Email verification marks ownership; afterEmailVerification invokes a transactional, idempotent Customer reconciliation service.",
      "The service locks a normalized-email Customer row; links an unlinked guest Customer without overwriting fields, or creates one from verified User data; conflicting link is rejected.",
      "If the verification callback's Customer reconciliation failed transiently, the same safe reconciliation is retried before a verified Customer session is issued.",
      "Verification redirects to Web confirmation or storex://auth/verified; the user signs in again."
    ],
    "pdg_constraints": [
      {
        "description": "Existing payment checkout serializes the draft/hold with FOR UPDATE before creating/reusing Customer; then inserts with ON CONFLICT DO NOTHING and selects the normalized-email row FOR UPDATE.",
        "affected_statements": [
          "apps/api/src/modules/payments/payments.repository.ts:128-159"
        ],
        "implementation_consequence": "Keep signup reconciliation in a DB transaction, lock the matched Customer row, preserve conflict-safe insert/select ordering, and leave checkout semantics unchanged."
      },
      {
        "description": "Existing Rental lookup resolves the User through customers.userId.",
        "affected_statements": [
          "apps/api/src/modules/rentals/rentals.repository.ts:39-45"
        ],
        "implementation_consequence": "Only the verified transaction may set customers.userId; email equality alone must not grant access."
      }
    ],
    "architectural_patterns": [
      {
        "pattern": "Route → service → repository",
        "example_location": "apps/api/src/modules/payments/payments.routes.ts / payments.service.ts / payments.repository.ts",
        "usage_guidance": "Keep registration HTTP parsing thin and place identity decisions in the customer registration service/repository."
      },
      {
        "pattern": "Transactional consistency with row-level locks",
        "example_location": "apps/api/src/modules/payments/payments.repository.ts:121-189",
        "usage_guidance": "Use a transaction and FOR UPDATE for link/create, with conflict-safe normalized-email lookup."
      },
      {
        "pattern": "Web form uses React Hook Form + Zod and shared API client",
        "example_location": "apps/web/src/features/auth/login-form.tsx:19-63",
        "usage_guidance": "Use field-linked errors, visible loading state, and no direct component HTTP."
      },
      {
        "pattern": "Mobile Screen → Feature Hook → API Client",
        "example_location": "docs/mobile-patterns.md:9-24",
        "usage_guidance": "Keep network/business orchestration out of the screen; SecureStore belongs to Better Auth Expo client."
      }
    ],
    "files_to_modify": [
      {
        "file": "packages/contracts/src/index.ts",
        "symbols": [
          "CustomerSignUpInputSchema"
        ],
        "intended_change": "Add shared registration input validation/types; phone required for this Customer flow."
      },
      {
        "file": "packages/contracts/src/index.test.ts",
        "symbols": [],
        "intended_change": "Cover valid input, normalization and invalid/missing fields."
      },
      {
        "file": "packages/api-client/src/index.ts",
        "symbols": [
          "createStorexApiClientImpl"
        ],
        "intended_change": "Add registration and verification-resend methods to centralized client."
      },
      {
        "file": "apps/api/src/modules/customers/customer-registration.repository.ts",
        "symbols": [],
        "intended_change": "Add transactional verified Customer claim/create and normalized-email lookup."
      },
      {
        "file": "apps/api/src/modules/customers/customer-registration.service.ts",
        "symbols": [],
        "intended_change": "Implement duplicate checks, conflict guidance, and idempotent verified reconciliation."
      },
      {
        "file": "apps/api/src/modules/auth/auth.routes.ts",
        "symbols": [
          "authRoutes"
        ],
        "intended_change": "Expose customer registration; prevent bypass through raw public Better Auth signup endpoint."
      },
      {
        "file": "apps/api/src/modules/auth/auth.ts",
        "symbols": [
          "auth"
        ],
        "intended_change": "Require email verification, disable auto-login, configure Resend and Expo origins, invoke reconciliation and retry seam."
      },
      {
        "file": "apps/api/src/common/adapters/mailer/mailer.interface.ts",
        "symbols": [],
        "intended_change": "Define small email sending boundary."
      },
      {
        "file": "apps/api/src/common/adapters/mailer/resend.adapter.ts",
        "symbols": [],
        "intended_change": "Send verification link through Resend REST API using environment credentials."
      },
      {
        "file": "apps/api/src/config/env.ts",
        "symbols": [
          "envSchema"
        ],
        "intended_change": "Read Resend key and sender configuration without making API startup depend on an unconfigured provider."
      },
      {
        "file": "apps/api/.env.example",
        "symbols": [],
        "intended_change": "Document RESEND_API_KEY and RESEND_FROM_EMAIL placeholders."
      },
      {
        "file": "apps/api/tests/units/customers/customer-registration.service.test.ts",
        "symbols": [],
        "intended_change": "Cover verified linking, creation, conflicts, preservation, idempotency and retries."
      },
      {
        "file": "apps/api/tests/units/customers/customer-registration.repository.test.ts",
        "symbols": [],
        "intended_change": "Cover transaction/locking and conflict-safe create/reuse behavior."
      },
      {
        "file": "apps/api/tests/units/auth/auth.routes.test.ts",
        "symbols": [],
        "intended_change": "Cover route input, duplicate guidance, blocked raw signup and resend path."
      },
      {
        "file": "apps/api/tests/units/common/resend.adapter.test.ts",
        "symbols": [],
        "intended_change": "Cover request payload, provider rejection and missing configuration."
      },
      {
        "file": "apps/web/src/app/register/page.tsx",
        "symbols": [],
        "intended_change": "Add public registration route."
      },
      {
        "file": "apps/web/src/app/verify-email/page.tsx",
        "symbols": [],
        "intended_change": "Show verification result and explicit sign-in-again action."
      },
      {
        "file": "apps/web/src/features/auth/customer-registration-form.tsx",
        "symbols": [],
        "intended_change": "Build accessible registration form and resend-verification state."
      },
      {
        "file": "apps/web/src/features/auth/email-verification-result.tsx",
        "symbols": [],
        "intended_change": "Render callback result and login link."
      },
      {
        "file": "apps/web/src/features/auth/login-form.tsx",
        "symbols": [
          "LoginForm"
        ],
        "intended_change": "Link to registration and explain unverified account/recovery errors."
      },
      {
        "file": "apps/web/src/config/routes/public.routes.ts",
        "symbols": [
          "publicRoutes"
        ],
        "intended_change": "Add register and verification route constants."
      },
      {
        "file": "apps/web/src/components/layout/public-header.tsx",
        "symbols": [
          "PublicHeader"
        ],
        "intended_change": "Expose registration entry from public navigation."
      },
      {
        "file": "apps/web/e2e/customer-registration.spec.ts",
        "symbols": [],
        "intended_change": "Test Web registration, duplicate guidance, verification state, responsive layout and axe."
      },
      {
        "file": "apps/mobile/package.json",
        "symbols": [],
        "intended_change": "Add Better Auth Expo client and SDK-compatible SecureStore dependencies."
      },
      {
        "file": "apps/mobile/app.json",
        "symbols": [],
        "intended_change": "Configure storex:// deep-link scheme."
      },
      {
        "file": "apps/mobile/.env.example",
        "symbols": [],
        "intended_change": "Document public API base URL for mobile development."
      },
      {
        "file": "apps/mobile/src/features/auth/auth-client.ts",
        "symbols": [],
        "intended_change": "Configure Better Auth Expo client with SecureStore."
      },
      {
        "file": "apps/mobile/src/features/auth/use-customer-auth.ts",
        "symbols": [],
        "intended_change": "Orchestrate registration/login and expose pending verification/session state."
      },
      {
        "file": "apps/mobile/src/screens/auth/login-screen.tsx",
        "symbols": [],
        "intended_change": "Add mobile login UI."
      },
      {
        "file": "apps/mobile/src/screens/auth/register-screen.tsx",
        "symbols": [],
        "intended_change": "Add mobile registration UI with required phone."
      },
      {
        "file": "apps/mobile/App.tsx",
        "symbols": [
          "App"
        ],
        "intended_change": "Replace sample screen with auth flow and consume cold/warm storex://auth/verified links."
      },
      {
        "file": "apps/api/src/seed-auth.ts",
        "symbols": [
          "seedBetterAuth"
        ],
        "intended_change": "Keep internal staff seed compatible with verified-email defaults; avoid exposing public signup."
      },
      {
        "file": "docs/authentication.md",
        "symbols": [],
        "intended_change": "Document customer signup, Resend config, verification, admin seed and sign-in behavior."
      },
      {
        "file": "docs/db-diagram.md",
        "symbols": [],
        "intended_change": "Update identity-policy text from TBD to the implemented verified-ownership link behavior; schema unchanged."
      },
      {
        "file": "bun.lock",
        "symbols": [],
        "intended_change": "Lock Expo auth/SecureStore dependencies."
      }
    ],
    "tests": [
      {
        "file": "apps/api/tests/units/customers/customer-registration.service.test.ts",
        "scenarios": [
          "Normalize email then reject an existing User with sign-in/recovery guidance and do not send a second signup email.",
          "For an unlinked guest Customer, verified registration links userId and preserves the existing fullName/email/phone.",
          "For no matching Customer, verified registration creates one from verified User details and required phone.",
          "Customer already linked to another User fails without modifying either record.",
          "Repeat reconciliation is idempotent; a transient first failure succeeds on retry.",
          "Concurrent reconciliation yields one Customer link/create and never reassigns a linked Customer."
        ]
      },
      {
        "file": "apps/api/tests/units/auth/auth.routes.test.ts",
        "scenarios": [
          "Missing/invalid name, email, phone or password is rejected before Better Auth is called.",
          "Existing account and already-linked Customer receive recovery guidance.",
          "Raw Better Auth sign-up route cannot bypass Customer validation/link workflow.",
          "Signup response does not create an authenticated session.",
          "Verification resend uses the originating platform callback."
        ]
      },
      {
        "file": "apps/api/tests/units/common/resend.adapter.test.ts",
        "scenarios": [
          "Resend receives the expected recipient/from/subject/verification URL payload.",
          "Provider non-2xx and missing credentials produce a recoverable registration error without exposing the token in logs."
        ]
      },
      {
        "file": "packages/contracts/src/index.test.ts",
        "scenarios": [
          "Valid normalized signup input is accepted; missing phone, invalid email, too-long name/phone, weak password and mismatched confirmation are rejected."
        ]
      },
      {
        "file": "apps/web/e2e/customer-registration.spec.ts",
        "scenarios": [
          "Desktop and Pixel 7 registration form has accessible labels and associated validation errors.",
          "Successful request shows check-email state; duplicate response links to login and password recovery.",
          "Verification result route shows success/failure and requires a fresh login.",
          "Run axe on form and validation error state; assert responsive primary actions remain visible."
        ]
      },
      {
        "file": "apps/mobile/src/features/auth/use-customer-auth.ts",
        "scenarios": [
          "Manual/device verification: registration shows check-email state; deep link cold-start and warm-start return to verification state; login after verification persists session with SecureStore."
        ]
      }
    ],
    "verification_commands": [
      "bun run --filter api test",
      "bun run --filter api check-types",
      "bun run --filter web test",
      "bun run --filter web test:e2e",
      "bun run --filter web check-types",
      "bun run --filter mobile check-types",
      "bun run check",
      "bun run check-types",
      "bun run build"
    ],
    "risks": [
      "afterEmailVerification runs after Better Auth persists emailVerified; customer reconciliation must be atomic and idempotent, with a retry path before granting an authenticated Customer session.",
      "Raw /auth/sign-up/email must not remain a bypass around required phone and linked-Customer conflict checks; preserve internal Better Auth signUpEmail for trusted seed code.",
      "Customer email normalized unique index and customers.userId unique index are the concurrency backstop; transaction ordering must not overwrite guest profile data.",
      "Resend credentials/sender are not present in the repository; registration email delivery is operationally unavailable until deployment environment supplies them.",
      "Mobile deep linking requires a native rebuild and cannot be fully proven by Web Playwright alone.",
      "Duplicate-email responses intentionally guide sign-in/recovery per user decision and disclose that signup cannot proceed; keep wording limited to that recovery action."
    ],
    "assumptions": [
      "User.phone column is retained and nullable (already true at HEAD); the Customer registration form/API still requires phone based on the earlier explicit customer-business decision.",
      "Resend API credentials and verified sender will be provided through RESEND_API_KEY and RESEND_FROM_EMAIL before deployment.",
      "Mobile app scheme will be storex:// and callback path storex://auth/verified.",
      "Email ownership is the sole proof required for linking a Customer; no separate OTP or staff approval is introduced."
    ],
    "open_questions": [],
    "avoid": [
      "Do not add a pending-registration table; the verified signup's User.phone field stores the required Customer phone temporarily and remains nullable for other User records.",
      "Do not modify users.phone schema or generate a migration: it is already nullable and the user chose to keep it.",
      "Do not overwrite an existing guest Customer profile during signup, verification or email match.",
      "Do not expose raw public Better Auth sign-up as a bypass to the dedicated Customer flow.",
      "Do not automatically sign in after email verification.",
      "Do not change guest checkout, booking, rental, or payment rules outside verified Customer linking.",
      "Do not add the Resend SDK; use the existing runtime fetch behind a small adapter."
    ]
  }
}
```
