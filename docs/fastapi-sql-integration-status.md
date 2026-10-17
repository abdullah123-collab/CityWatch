# FastAPI SQL Integration Status

## Current gate decision

No SQL Server connection is authorized for this phase. The repository has no
evidence that a dedicated least-privilege FastAPI application identity has been
provisioned, that its effective permissions were verified, that the target and
backup were approved, or that the FastAPI process will run under that identity.

The safety gates remain unchanged:

- `CITYWATCH_DB_ENABLED=false`
- `CITYWATCH_DB_APPLICATION_IDENTITY_VERIFIED=false`

The second flag is only an additional local gate; setting it would not prove
that permissions or process identity were verified. The existing developer and
read-only inspection identities are not valid substitutes.

## Offline work complete

- `DatabaseSettings` validates the opt-in gate, target, authentication mode,
  timeout, and secret requirements.
- `SqlServerAdapter` lazily opens connections, uses parameterized execution,
  commits successful transactions, rolls back failures, closes connections,
  and retries only bounded deadlock indicators.
- The FastAPI complaint workflow uses an explicit repository interface and a
  deterministic `InMemoryComplaintRepository`.
- Mock API tests cover citizen ownership, staff assignment, admin review,
  status transitions, priority validation, and unauthorized roles.
- The FastAPI authentication endpoints remain truthful `501` placeholders;
  they do not issue cookies or claim a user was authenticated.

## Source-verified schema map

These are repository-source findings, not a fresh live metadata query:

| Table | Relevant columns/relationships |
| --- | --- |
| `Citizen` | `citizen_id`, profile fields; owns `Complaint` and `Auth_Account` |
| `Staff` | `staff_id`, `dept_id`, `active_cases`; referenced by complaints/history/accounts |
| `Department` | `dept_id`, department/category/contact fields |
| `Location` | `location_id`, area/city/district/pincode/coordinates |
| `Complaint` | owner, department, location, staff, title/details, priority/status/timestamps |
| `Complaint_History` | complaint/staff, old/new status, remarks, changed time |
| `Complaint_Attachment` | complaint, file metadata, stored path metadata |
| `Feedback` | complaint/citizen, rating/comments/time |
| `Auth_Account` | account ownership, password hash, role, active state |
| `Auth_Session` | account, token hash, expiry, revocation |
| `Auth_OTP` | email, OTP hash, attempts, expiry/consumption |

`Audit_Log` is intentionally not treated as writable: the recorded live shape
(`audit_id`, `action_type`, `action_details`, `action_by`, `action_at`) differs
from `Database/CityWatchTable.sql` (`log_id`, `operation_type`,
`error_message`, `logged_at`). It must be verified by an authorized metadata
review before any audit insert is designed.

## SQL operations still required

- Authentication: account lookup and role joins; password verification using
  the approved existing hash format; session insert, lookup, expiry, and
  revocation; atomic registration and session issuance.
- Citizen complaints: validate citizen/department, insert `Location`, insert
  `Complaint`, insert attachments only after storage design approval, and add
  initial `Complaint_History` in one transaction.
- Citizen/staff/admin reads: parameterized joins filtered by citizen ownership,
  staff assignment, or admin role; omit unauthorized citizen contact fields.
- Staff workflow: assignment-aware status/history updates and resolution
  metadata using only verified columns.
- Admin workflow: assignment/review updates and audit events after the live
  audit schema is verified.

## Known blockers and mismatches

1. Dedicated application identity, effective grants, process identity, target,
   and backup approval are not evidenced.
2. Password hash algorithm and authentication-table live parity are unresolved.
3. `Critical` is accepted by existing frontend/Express code but the recorded
   live database allows only `Low`, `Medium`, and `High`; no constraint change
   is proposed.
4. Live `Audit_Log` differs from the base SQL script; no audit SQL is proposed.
5. Assignment history, feedback uniqueness, status concurrency, and attachment
   storage/content-validation details remain unresolved.
6. The current Phase 2E API stores attachment metadata in memory only; it does
   not implement persistent upload storage or claim MIME metadata is proof of
   file content.

## Required administrator action before Phase C

Obtain written confirmation for each item below. A configuration value is not
evidence of any item.

- [ ] A dedicated FastAPI application identity is provisioned.
- [ ] The intended SQL Server instance and `CityWatch` database are confirmed.
- [ ] An appropriate backup and rollback plan is confirmed for the isolated
      development/test target.
- [ ] Effective minimum object-level permissions are independently verified.
- [ ] The actual Windows/process identity used by FastAPI is verified.
- [ ] The exact first read-only connection probe is explicitly approved.

Only after all six confirmations are recorded may the two local gates be
updated through approved configuration. No schema migration is proposed or
approved by this status document.

## Exact implementation inventory

Prepared offline:

- `SqlServerComplaintRepository.create`: inserts `Location`, `Complaint`, and
  initial `Complaint_History` in one transaction.
- `SqlServerComplaintRepository.get`: reads one complaint and its history with
  ownership filtering performed by the service layer.
- `SqlServerComplaintRepository.list_for_citizen`: filters by `citizen_id`.
- `SqlServerComplaintRepository.list_for_staff`: filters by assigned
  `staff_id`.
- `SqlServerComplaintRepository.save`: persists verified complaint status and
  history columns; final resolution remains controlled by the existing service.
- `SqlServerAdapter.run_read`: closes read connections without committing.

Still missing before SQL-backed runtime integration:

- Runtime repository selection that remains mock-backed while the database gate
  is false and selects SQL only after approval.
- `AuthRepository.find_account`, `create_session`, `get_session_user`, and
  `revoke_session`, plus the password-hash compatibility decision.
- `StaffRepository.assign`, `reassign`, and workload/history updates with
  department and capacity checks.
- `AdminReviewRepository.review_resolution` with a verified persistence shape
  for resolution notes/evidence.
- `AuditRepository.append` and admin audit reads after live `Audit_Log` metadata
  is verified.
- SQL-backed service wiring and approved integration tests for all of the above.

The SQL repository intentionally rejects persistent attachments and resolution
evidence because the verified schema does not establish an approved storage
workflow for the current metadata-only API.
