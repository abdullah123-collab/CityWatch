# CityWatch Schema Mapping for FastAPI

This is a source- and recorded-metadata-based design document. It does not
connect to SQL Server or execute metadata queries. “Verified” below means
present in repository SQL/source or explicitly recorded from the approved
metadata inspection. It does not mean that the current database was queried
again during this phase.

## Evidence boundaries

- The base table definitions come from
  [`Database/CityWatchTable.sql`](../Database/CityWatchTable.sql).
- Authentication tables come from
  [`Database/AuthMigration.review.sql`](../Database/AuthMigration.review.sql).
- Attachment and OTP definitions come from
  [`backend/src/migrations/01_safe_migrations.sql`](../backend/src/migrations/01_safe_migrations.sql).
- Application expectations come from the existing Node services and routes.
- Live differences come only from the previously recorded metadata findings.
- No citizen rows, authentication values, tokens, OTPs, phone numbers, or
  uploaded file content were inspected in this phase.

## Table inventory

### `Citizen`

- **Purpose:** Citizen profile and complaint owner.
- **Verified primary key:** `citizen_id`.
- **Verified columns from base schema:** `full_name`, `email`, `phone`,
  `address`, `registered_at`.
- **Verified constraints:** `email` is unique and required in the base schema.
- **Relationships:** Referenced by `Complaint.citizen_id`,
  `Feedback.citizen_id`, and `Auth_Account.citizen_id`.
- **FastAPI services:** Authentication/session, citizen/profile, complaint
  tracking, feedback, admin citizen management.
- **Unresolved:** Exact live column types, lengths, indexes, and whether any
  live additions differ from the base schema require metadata review before
  implementation.

### `Staff`

- **Purpose:** Staff identity, department membership, and workload state.
- **Verified primary key:** `staff_id`.
- **Verified columns from source/schema:** `dept_id`, `full_name`,
  `designation`, `email`, `phone`, `joined_at`; `active_cases` is added by the
  migration and used by services.
- **Verified relationships:** `dept_id -> Department.dept_id` with recorded
  `ON DELETE CASCADE`; referenced by `Complaint.staff_id`,
  `Complaint_History.staff_id`, and `Auth_Account.staff_id`.
- **Verified constraint:** Recorded `active_cases` check is between 0 and 5.
- **FastAPI services:** Authentication/session, staff workload and complaint
  service, admin staff management, assignment, audit.
- **Unresolved:** Whether the live staff columns and cascading behavior still
  exactly match source documentation must be treated as a schema dependency.

### `Department`

- **Purpose:** Complaint routing and department contact information.
- **Verified primary key:** `dept_id`.
- **Verified columns:** `dept_name`, `category`, `contact_email`,
  `contact_phone`, `head_officer`.
- **Relationships:** Referenced by `Staff.dept_id` and `Complaint.dept_id`.
- **FastAPI services:** Public department listing, complaint creation,
  assignment, admin department management.
- **Unresolved:** The application must confirm whether department category
  values are constrained beyond the documented column definition.

### `Location`

- **Purpose:** Structured complaint location and map coordinates.
- **Verified primary key:** `location_id`.
- **Verified columns:** `area_name`, `city`, `district`, `pincode`,
  `latitude`, `longitude`.
- **Relationships:** Referenced by `Complaint.location_id`.
- **FastAPI services:** Complaint creation, complaint detail/tracking, map
  location handling.
- **Unresolved:** Coordinate precision and any geographic validation beyond the
  documented decimal definition must be confirmed against live metadata.

### `Complaint`

- **Purpose:** Citizen-submitted civic case and current workflow state.
- **Verified primary key:** `complaint_id`.
- **Verified columns:** `citizen_id`, `dept_id`, `location_id`, `staff_id`,
  `title`, `description`, `category`, `priority`, `status`, `submitted_at`,
  `resolved_at`.
- **Verified foreign keys:** `citizen_id -> Citizen`, `dept_id -> Department`,
  `location_id -> Location`, `staff_id -> Staff`.
- **Recorded live constraints:** Status values are `Pending`, `In Progress`,
  `Resolved`, `Rejected`; live priority allows only `Low`, `Medium`, `High`.
- **FastAPI services:** Complaint creation/tracking, assignment, staff
  resolution, admin case management, audit.
- **Unresolved:** Assignment concurrency, optimistic locking/versioning, and
  whether `staff_id` updates are protected against races require design review.

### `Complaint_Attachment`

- **Purpose:** Attachment metadata associated with a complaint.
- **Verified primary key:** `attachment_id`.
- **Verified columns from migration:** `complaint_id`, `file_name`,
  `stored_name`, `file_path`, `file_size`, `mime_type`, `uploaded_at`.
- **Verified relationship:** `complaint_id -> Complaint.complaint_id` with
  recorded `ON DELETE CASCADE`.
- **FastAPI services:** Complaint creation, attachment validation/storage,
  secure attachment delivery.
- **Unresolved:** The database does not prove that the referenced file exists
  on disk. File-content validation, path confinement, cleanup after rollback,
  and storage retention remain application responsibilities.

### `Complaint_History`

- **Purpose:** Status transition timeline and staff remarks.
- **Verified primary key:** `history_id`.
- **Verified columns:** `complaint_id`, `staff_id`, `old_status`, `new_status`,
  `remarks`, `changed_at`.
- **Verified relationships:** `complaint_id -> Complaint` with `ON DELETE
  CASCADE`; `staff_id -> Staff` with `ON DELETE SET NULL`.
- **FastAPI services:** Complaint tracking, staff resolution, admin review,
  audit/history presentation.
- **Unresolved:** The table does not by itself prove an assignment history,
  actor identity for administrators, resolution verification state, or a
  uniqueness rule for transitions.

### `Feedback`

- **Purpose:** Citizen rating and comments for a complaint.
- **Verified primary key:** `feedback_id`.
- **Verified columns:** `complaint_id`, `citizen_id`, `rating`, `comments`,
  `submitted_at`.
- **Verified relationships:** `complaint_id -> Complaint`,
  `citizen_id -> Citizen`.
- **Verified constraint:** Rating is between 1 and 5 in the documented schema.
- **FastAPI services:** Citizen feedback, complaint detail, admin feedback
  reporting.
- **Unresolved:** No verified unique constraint prevents duplicate feedback
  from the same citizen for the same complaint. This requires design review;
  do not assume one-feedback-per-complaint.

### `Auth_Account`

- **Purpose:** Account credential ownership and application role.
- **Verified primary key:** `account_id`.
- **Verified columns from review script:** `account_type`, `citizen_id`,
  `staff_id`, `password_hash`, `role_name`, `is_active`, `created_at`,
  `updated_at`.
- **Verified relationships:** `citizen_id -> Citizen`; `staff_id -> Staff`.
- **Verified checks/indexes in review script:** Citizen/Staff ownership
  consistency, account type and role values, filtered unique owner indexes.
- **FastAPI services:** Authentication/session, admin staff provisioning,
  audit.
- **Unresolved:** Password policy, hash algorithm migration policy, and live
  index/constraint parity require confirmation without exposing hashes.

### `Auth_Session`

- **Purpose:** Revocable session-token hash storage.
- **Verified primary key:** `session_id`.
- **Verified columns:** `account_id`, `token_hash`, `expires_at`,
  `revoked_at`, `created_at`.
- **Verified relationship:** `account_id -> Auth_Account.account_id`.
- **Verified indexes:** Unique token-hash index and active-session lookup index
  are documented in the review script.
- **FastAPI services:** Authentication/session and logout.
- **Unresolved:** Cookie/session rotation, cleanup policy, and concurrent
  revocation behavior require service design.

### `Auth_OTP`

- **Purpose:** Hashed, expiring OTP records for the Google/email flow.
- **Verified primary key:** `otp_id`.
- **Verified columns:** `email`, `otp_hash`, `attempts`, `expires_at`,
  `created_at`, `consumed_at`.
- **Verified index:** Lookup index on `email`, `expires_at`, and `consumed_at`
  is defined by the migration script.
- **FastAPI services:** Google sign-in and email OTP service.
- **Unresolved:** Email normalization, retry/rate-limit semantics, and
  concurrency protection for consuming one OTP require design review.

### `Audit_Log`

- **Purpose:** Administrative/application audit events.
- **Verified from current recorded live metadata:** `audit_id`,
  `table_name`, `action_type`, `record_id`, `action_details`, `action_by`,
  `action_at`; action type is constrained to `INSERT`, `UPDATE`, `DELETE`,
  with defaults for actor/time.
- **Base-schema discrepancy:** `Database/CityWatchTable.sql` documents
  `log_id`, `operation_type`, `table_name`, `record_id`, `error_message`, and
  `logged_at`.
- **FastAPI services:** Audit logging and admin audit-log reads.
- **Unresolved:** Do not write against either column set until verified live
  metadata is used to define the adapter contract. Audit failures must have an
  explicit policy; silently swallowing security-relevant audit failures is not
  acceptable.

## Cross-table relationship summary

```text
Citizen 1---* Complaint *---1 Department
                 |
                 *---1 Location
                 |
                 *---0..1 Staff
                 |
                 *---* Complaint_History
                 |
                 *---* Complaint_Attachment
                 |
                 *---* Feedback

Citizen 1---0..1 Auth_Account
Staff   1---0..1 Auth_Account
Auth_Account 1---* Auth_Session
```

The cardinalities shown are design readings from the documented foreign keys
and indexes. They are not claims about current row contents.

## Required schema review before implementation

Before database-backed FastAPI services are enabled, confirm live metadata for
all columns used by a service, the current `Audit_Log` definition, nullable
behavior, indexes, foreign-key actions, and any missing uniqueness or
concurrency protections. No service should infer a missing column or silently
fall back to the outdated base schema.
