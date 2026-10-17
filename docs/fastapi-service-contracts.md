# FastAPI Service Contracts

This document defines proposed boundaries for the future FastAPI backend while
preserving the current Express route contracts. It is design-only: no service
below performs database work in this phase.

## Common contract rules

- Preserve the `/api` prefix and existing camelCase request fields where the
  portals already depend on them.
- Preserve the HTTP-only `citywatch_session` cookie design. FastAPI must not
  issue a cookie until session persistence is implemented and tested.
- Preserve JSON errors with `error` and `statusCode` fields where practical.
- Never return password hashes, OTP hashes, session token hashes, or raw tokens.
- Citizens may see their own contact information; staff/admin responses must
  expose contact fields only when required for an authorized workflow.
- All database writes use explicit transactions and parameterized statements.
- No route is considered migrated until it has contract, authorization,
  transaction, and approved-database tests.

## Authentication and session service

**Responsibility:** Account login/registration, session-cookie lifecycle, and
role resolution. Google identity verification and OTP orchestration are
excluded from the presentation migration scope.

**Tables:** `Citizen`, `Staff`, `Department`, `Auth_Account`,
`Auth_Session`, and the verified live `Audit_Log` shape.

**Endpoints and contracts:**

| Endpoint | Request | Response | Access |
| --- | --- | --- | --- |
| `GET /api/auth/config` | none | Existing capability object | Public |
| `GET /api/auth/me` | HTTP-only `citywatch_session` | `{ user }` | Valid session |
| `POST /api/auth/register` | `fullName`, `email`, `phone`, `address`, `password` | `201 { user, message }` | Public |
| `POST /api/auth/login` | `email`, `password` | `{ user, message }` and cookie | Public |
| `POST /api/auth/staff-login` | `email`, `password` | `{ user, message }` and cookie | Public |
| `POST /api/auth/logout` | session cookie | `{ message }`, cleared cookie | Public/session |

**Transactions:** Registration inserts `Citizen` and `Auth_Account` together.
Session issuance inserts `Auth_Session` before the cookie is returned.

**Validation/errors:** Preserve existing 400/401/403/409/429/503 meanings.
Normalize email before lookup. Rate-limit login and OTP attempts. Never reveal
whether a password hash, OTP, or session token exists.

**Unresolved:** Password hash algorithm, email delivery implementation, Google
audience configuration, account provisioning rules, and live auth-table parity.

The current FastAPI implementation intentionally leaves all stateful operations
as explicit `501` placeholders until the approved SQL identity and password
compatibility gates are complete.

## Citizen and profile service

**Responsibility:** Authorized citizen profile reads and updates, if profile
editing is approved.

**Tables:** `Citizen`, `Auth_Account`.

**Proposed endpoints:**

- `GET /api/citizens/me` — Citizen; returns approved profile fields.
- `PATCH /api/citizens/me` — Citizen; request fields must be explicitly
  approved; returns `{ user }`.

**Validation:** Email uniqueness, phone format, field lengths, and ownership
  are server-side checks. Do not expose other citizens' contact information.

**Unresolved:** The current portals do not establish a profile-write contract;
  do not add one until the UI and schema behavior are agreed.

## Complaint creation and tracking service

**Responsibility:** Create complaints, validate location and department,
  provide citizen/staff/admin case views, and expose history/feedback
  aggregates.

**Tables:** `Citizen`, `Department`, `Location`, `Complaint`, `Staff`,
`Complaint_History`, `Complaint_Attachment`, `Feedback`.

**Existing-compatible endpoints:**

| Endpoint | Request/query | Response | Access |
| --- | --- | --- | --- |
| `POST /api/complaints` | Multipart: `departmentId`, `title`, `description`, `category`, `priority`, JSON `location`, up to five `attachments` | `201 { success, complaintId, complaint, message }` | Citizen |
| `GET /api/complaints` | `search`, `status`, `priority`, `sort` | Complaint array | Citizen's own cases |
| `GET /api/complaints/:id` | path ID | `{ complaint, attachments, history, feedback }` | Authorized citizen/staff/admin |
| `POST /api/complaints/:id/feedback` | `rating`, `comments` | `201 { success, feedback }` | Owning Citizen |
| `GET /api/complaints/:id/attachments/:attachmentId` | path IDs | File stream | Authorized user |

**Create transaction:** Validate the citizen and department first; insert
`Location`, `Complaint`, attachments, and initial `Complaint_History` in one
transaction. Remove any filesystem files if the database transaction rolls
back. Apply a deliberate duplicate-submission policy rather than assuming a
database uniqueness constraint.

**Validation:** Latitude/longitude ranges, required location fields, title
length, approved category/priority values, attachment count/size, and
content-based image validation. The recorded live database rejects `Critical`;
the service must not silently send that value to production until an approved
compatibility decision exists.

**Unresolved:** Location deduplication, complaint versioning, feedback
uniqueness, attachment retention, and live schema details.

## Attachment validation and storage service

**Responsibility:** Validate file bytes, isolate storage paths, write metadata,
  and securely stream only authorized files.

**Tables/filesystem:** `Complaint_Attachment`, approved upload root.

**Contract:** Existing upload field is `attachments`; response metadata
  includes `attachment_id`, `file_name`, `stored_name`, `file_size`,
  `mime_type`, and `uploaded_at`. Do not expose arbitrary `file_path`.

**Validation:** Inspect magic bytes/content signatures, then compare against a
  deliberately supported type. Do not trust the extension or MIME header.
  Generate server-side names, prevent path traversal, enforce size/count
  limits, and delete orphaned files after rollback.

**Unresolved:** Whether PDFs remain supported in addition to images, malware
  scanning, retention, and storage availability monitoring.

## Staff assignment and resolution-submission service

**Responsibility:** Department-compatible assignment, workload accounting,
  status transitions, remarks, and resolution submission.

**Tables:** `Complaint`, `Staff`, `Department`, `Complaint_History`,
`Auth_Account`, and verified live `Audit_Log`.

**Existing-compatible endpoints:**

- `GET /api/staff/dashboard` — Staff/Admin.
- `GET /api/staff/complaints?search=&status=&priority=` — Staff/Admin.
- `PATCH /api/staff/complaints/:id/status` with `{ status, remarks }` —
  assigned Staff/Admin.
- `POST /api/admin/complaints/:id/assign` with `{ staffId }` — Admin.

**Rules:** Staff may update only assigned complaints. Department must match.
`active_cases` must remain within the recorded 0–5 range. Existing transitions
are `Pending -> In Progress/Rejected` and `In Progress -> Resolved/Rejected`;
closed cases are not reopened by ordinary staff.

Final `Resolved` status requires an explicit administrator verification step
before it becomes final. The current Express route does not fully express that
requirement, so a compatible interim response and a future endpoint/field need
design approval rather than silent behavior change.

**Transactions/concurrency:** Assignment must atomically validate workload,
  decrement old staff, update complaint, increment new staff, and append
  history. Status changes must atomically update complaint, history, and
  workload. Deadlock retries must retry the complete safe transaction only.
  Row-locking or optimistic versioning remains unresolved.

## Admin and department management service

**Responsibility:** Admin dashboards, complaints, staff accounts, departments,
  feedback, assignments, and audit views.

**Tables:** `Department`, `Staff`, `Auth_Account`, `Complaint`, `Citizen`,
`Feedback`, and live-compatible `Audit_Log`.

**Existing-compatible endpoints:**

- `GET /api/admin/dashboard`
- `GET /api/admin/complaints`
- `GET /api/admin/complaints/:id`
- `GET/POST /api/admin/staff`
- `PATCH /api/admin/staff/:id/status`
- `GET /api/admin/citizens`
- `GET/POST /api/admin/departments`
- `GET /api/admin/feedback`
- `GET /api/admin/audit-logs`
- `POST /api/admin/complaints/:id/assign`

All require the Admin role. Staff creation and activation changes require a
transaction covering the staff/account relationship and an audit event.

**Unresolved:** Whether department deletion is allowed given the recorded
`Staff.dept_id ON DELETE CASCADE`, and whether admin APIs may return citizen or
staff phone/contact fields in each view.

## Audit logging service

**Responsibility:** Record security-relevant account, assignment, status,
feedback, and administration events using the verified live schema.

**Table:** Live `Audit_Log` only after schema compatibility is confirmed.

**Proposed internal contract:**

```text
write_event(
    table_name,
    action_type,
    record_id,
    action_details,
    action_by
)
```

`action_type` must be limited to the recorded live values `INSERT`, `UPDATE`,
and `DELETE` unless later metadata proves more values are supported.

**Transaction policy:** For security-critical writes, decide whether the audit
event is in the same transaction as the business mutation. If audit failure is
allowed to fail the business action, document that explicitly; otherwise emit a
prominent operational error rather than silently reporting success.

**Unresolved:** The live/base column mismatch, retention, redaction, and
administrator visibility rules.

## Compatibility risks

1. The current FastAPI auth router has schemas and placeholders, not working
   authentication.
2. Existing portals expect cookies, exact paths, and existing response shapes.
3. `Critical` is accepted by current application code but rejected by live
   database metadata.
4. The live audit schema differs from the base script and must not be guessed.
5. Staff department cascade deletes could remove staff needed by history.
6. No migration/version ledger is confirmed.
7. Duplicate feedback and assignment history are not guaranteed by documented
   constraints.
8. Contact fields require role- and purpose-specific response filtering.
9. Attachment validation in the existing middleware trusts extension and MIME
   declarations; FastAPI must validate file content.
10. Admin verification of staff resolutions is a required business rule but is
    not fully represented by the current Express route contract.
