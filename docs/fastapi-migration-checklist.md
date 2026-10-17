# FastAPI Migration Checklist

Phase 2A creates a parallel health-only backend. The existing Node.js backend
and all three React portals remain unchanged.

## Current baseline

- [x] Preserve `backend/` as the active Express backend.
- [x] Preserve `frontend/`, `staff/`, and `admin/` without proxy changes.
- [x] Record existing route and authentication contracts.
- [x] Add `backend-fastapi/` with a database-free health endpoint.
- [x] Add safe environment defaults without copying secrets.
- [x] Record authentication request schemas and portal differences.
- [x] Add explicit authentication placeholders without fake sessions.
- [x] Design a disabled-by-default SQL Server adapter with mock-only tests.
- [x] Document verified schema mappings and unresolved live-schema questions.
- [x] Define FastAPI service boundaries and compatibility contracts.
- [x] Add mock-only policy tests for priorities, status transitions, and
      attachment content validation.
- [ ] Do not claim any existing route is migrated.

## Route migration order

1. Implement password verification and citizen/staff account lookup.
2. Implement session-cookie persistence and authentication contract tests.
3. Implement Google token verification and email OTP flow after external-service
   approval.
4. Implement public department reads.
5. Implement citizen complaint listing, detail, feedback, and creation.
6. Implement secure attachment metadata and file delivery.
7. Implement staff dashboard, filtering, and status transitions.
8. Implement admin dashboards, assignment, staff/departments, feedback, and
   audit-log reads.
9. Reassess diagnostics separately; do not expose sensitive database details by
   default.

For every route, record request schema, response schema, status codes,
authorization, validation, SQL parameters, transaction boundaries, and tests.

## Database gate

- [ ] Confirm the dedicated development/test target.
- [ ] Confirm backup and rollback procedures.
- [ ] Obtain a dedicated read-only identity for inspection.
- [ ] Complete metadata and compatibility review.
- [ ] Resolve the `Critical` priority contract mismatch by an approved design
      decision; do not silently change the live constraint.
- [ ] Design a separate least-privilege application identity.
- [ ] Independently verify the application identity before enabling adapter
      connectivity.
- [ ] Approve the adapter's exact object-level DML permissions.
- [ ] Add database integration only after explicit approval.

## Cutover gate

- [ ] Existing Node routes remain available during parity work.
- [ ] Contract tests pass for each migrated route.
- [ ] Authorization tests cover Citizen, Staff, and Admin boundaries.
- [ ] Transaction and concurrency tests cover assignment and status changes.
- [ ] Attachment validation and path safety are tested.
- [ ] Observability does not log credentials, tokens, OTPs, or password data.
- [ ] A rollback switch back to the Node backend is documented.
- [ ] Frontend proxy changes are approved separately and performed last.
