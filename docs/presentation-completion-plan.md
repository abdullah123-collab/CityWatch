# CityWatch Presentation Completion Plan

Last updated: 2026-10-16

## Current verified state

- [x] Three React/Vite portals exist: citizen `frontend/`, staff `staff/`,
      and admin `admin/`.
- [x] Existing Express/SQL Server backend remains the active runtime path.
- [x] FastAPI scaffold runs health/auth placeholders and contains the Phase 2E
      mock complaint workflow.
- [x] FastAPI mock API and adapter tests pass offline.
- [x] Offline bcrypt-compatible password verification and session repository
      preparation have mock-driver tests.
- [x] SQL Server flags remain disabled by default.
- [ ] FastAPI authentication and SQL persistence are not runtime-connected.
- [x] Google Sign-In/OTP controls and calls are removed from the active citizen
      login flow.
- [x] Complaint submission now uses manual address fields and does not invent
      coordinates or geocode the address.
- [x] Express complaint validation accepts nullable coordinates while still
      validating supplied coordinate ranges, so the active portal's manual
      address payload is compatible with the existing backend.
- [ ] Leaflet remains only for the read-only complaint-details map and is not
      used for address selection.

## Phase 0: Audit and checkpoint

- [x] Inspect actual project entry points, package scripts, portals, backend,
      FastAPI scaffold, tests, and relevant documentation.
- [x] Confirm current run commands: Express backend on port 3000; citizen,
      staff, and admin Vite portals on ports 5173, 5174, and 5175.
- [x] Record database identity/permission blocker and preserve safety gates.
- [x] Create this persistent plan.

## Phase 1: Simple Python backend

- [x] Verify the existing source password-hash format: bcrypt-compatible
      hashes with cost 10/12; live account compatibility remains unverified.
- [ ] Implement password/session repositories only after schema and identity
      compatibility are verified.
- [x] Keep complaint business rules in services with mock repository tests.
- [ ] Add SQL-backed runtime selection that cannot silently fall back to mock
      persistence when SQL mode is explicitly approved.
- [ ] Implement staff assignment and admin review persistence using verified
      columns only.
- [ ] Implement audit writes only after live `Audit_Log` metadata is verified.

## Phase 2: Manual address form

- [x] Replace map-pin/geocoding UI with required manual address entry.
- [x] Preserve only verified address fields; do not invent coordinates or
      claim geocoding.
- [ ] Remove Leaflet dependencies/configuration after the read-only details
      map is replaced or explicitly retained for presentation.
- [x] Add focused citizen frontend build and Express syntax validation checks.

## Phase 3: Authorized staff contact

- [x] Return citizen phone only for the assigned staff member's complaint.
- [x] Add server-side authorization tests for assigned and unrelated staff.
- [x] Existing staff complaint details render the authorized phone field.

## Phase 4: End-to-end complaint workflow

- [x] Mock citizen creation, ownership reads, staff resolution submission, and
      admin approval/rejection are implemented.
- [ ] Connect the workflow to approved SQL persistence.
- [ ] Verify history, assignment, resolution evidence, and audit persistence.
- [ ] Preserve final `Resolved` only after admin approval.

## Phase 5: SQL Server integration gate

- [ ] Dedicated FastAPI application identity provisioned.
- [ ] Intended SQL Server instance and database confirmed.
- [ ] Backup and rollback plan confirmed.
- [ ] Effective least-privilege permissions independently verified.
- [ ] Actual FastAPI process identity verified.
- [ ] First read-only connection probe explicitly approved.
- [ ] Run no connection, migration, or integration test before all items pass.

Current blocker: the six administrator confirmations above are not evidenced.
Until they are complete, continue with offline code, mock-driver tests, and
documentation only. Do not enable either database safety flag.

## Phase 6: Frontend alignment

- [x] Remove Google controls and Google/OTP calls from active citizen UI.
- [ ] Align citizen, staff, and admin API calls with tested FastAPI contracts.
- [ ] Keep Express available until FastAPI parity is actually verified.
- [ ] Do not change Vite proxies before backend contract tests pass.

## Phase 7: Validation

- [x] Run isolated FastAPI tests after backend changes.
- [x] Run complete FastAPI suite after meaningful phase boundaries.
- [x] Build all three Vite portals.
- [ ] Check Python diagnostics/imports and frontend build output.
- [ ] Verify no secrets, hashes, tokens, or personal records appear in output.

## Phase 8: Presentation materials

- [x] Create `docs/presentation-guide.md` from implemented behavior only.
- [x] Include architecture, REST/FastAPI, SQL relationships, transactions,
      authorization, complaint lifecycle, manual address decision, and demo
      commands.
- [x] Include at least 20 accurate viva questions and simple answers.

## Next safe implementation slice

The citizen map selector and Google UI are removed, the Express complaint
validator accepts manual addresses with nullable coordinates, and all portal
builds pass. The active Vite proxy still targets Express; FastAPI
authentication/persistence and approved routing are not claimed complete.
SQL persistence and real FastAPI authentication remain blocked until the
administrator confirmations are provided.