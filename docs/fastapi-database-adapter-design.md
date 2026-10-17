# FastAPI SQL Server Adapter Design

This document describes the Phase 2C integration boundary. It does not
connect to SQL Server, execute SQL, provision identities, or change the
existing database.

## Implementation boundary

The adapter is in
[`backend-fastapi/app/db/`](../backend-fastapi/app/db/):

- `config.py` validates environment-backed settings.
- `adapter.py` lazily imports `pyodbc` only when a connection is requested.
- `DatabaseSettings.enabled` defaults to `false`.
- `SqlServerAdapter` opens no connection during construction.
- The FastAPI application does not instantiate or use the adapter yet.

The driver dependency is declared in
[`backend-fastapi/requirements.txt`](../backend-fastapi/requirements.txt), but
installing it does not connect to a database.

## Configuration

The adapter uses the `CITYWATCH_DB_` prefix:

| Setting | Purpose | Default |
| --- | --- | --- |
| `CITYWATCH_DB_ENABLED` | Explicit connection gate | `false` |
| `CITYWATCH_DB_APPLICATION_IDENTITY_VERIFIED` | Independent provisioning/identity verification gate | `false` |
| `CITYWATCH_DB_SERVER` | SQL Server host/instance | empty |
| `CITYWATCH_DB_DATABASE` | Database name | empty |
| `CITYWATCH_DB_PORT` | Optional TCP port | empty |
| `CITYWATCH_DB_ODBC_DRIVER` | Installed ODBC driver name | ODBC Driver 18 for SQL Server |
| `CITYWATCH_DB_AUTH` | `windows` or `sql` | `windows` |
| `CITYWATCH_DB_USER` | SQL authentication login | empty |
| `CITYWATCH_DB_PASSWORD` | SQL authentication secret | empty |
| `CITYWATCH_DB_ENCRYPT` | Driver encryption setting | `true` |
| `CITYWATCH_DB_TRUST_SERVER_CERTIFICATE` | Certificate trust override | `false` |
| `CITYWATCH_DB_CONNECTION_TIMEOUT_SECONDS` | Login timeout | `15` |
| `CITYWATCH_DB_REQUEST_TIMEOUT_SECONDS` | Future command timeout | `30` |
| `CITYWATCH_DB_DEADLOCK_MAX_ATTEMPTS` | Maximum total transaction attempts | `3` |
| `CITYWATCH_DB_DEADLOCK_BACKOFF_SECONDS` | Linear retry base delay | `0.5` |

The template contains names and safe defaults only. It contains no existing
server value, username, password, token, or connection string.

## Authentication modes

### Windows Integrated Authentication

Set `CITYWATCH_DB_AUTH=windows`. The process identity is authenticated by
Windows and the adapter uses `Trusted_Connection=yes`.

This is consistent with the existing Node configuration's default mode, but
the FastAPI process must eventually run under an explicitly approved
least-privilege application identity. The developer's broad inspection
identity must not be reused.

### SQL Server Authentication

Set `CITYWATCH_DB_AUTH=sql` and provide the login through secret management.
The settings validator requires both a username and a non-empty password.
The password is held as a `SecretStr` and is used only while constructing the
driver string; it must never be logged, returned by an endpoint, or committed.

Neither mode is usable until `CITYWATCH_DB_ENABLED=true` is explicitly
approved and `CITYWATCH_DB_APPLICATION_IDENTITY_VERIFIED=true` confirms that a
dedicated application identity was provisioned and independently verified. The
current application does not enable either mode. This flag is not proof of
permissions; it is an additional local safety gate that must only be set after
the separate administrator verification process succeeds.

## Pooling and lifecycle

`pyodbc.pooling` is enabled immediately before the first driver connection.
The driver manages pooled connections; no connection is opened at adapter
construction time. The existing Node implementation uses a bounded pool,
whereas pyodbc does not expose the same application-level maximum. A future
production adapter decision is required if an explicit maximum equivalent to
the Node `DB_POOL_MAX` is mandatory.

Each transaction:

1. Opens or obtains one pooled connection.
2. Runs caller-supplied parameterized work.
3. Commits on success.
4. Rolls back on any exception.
5. Closes the connection in `finally`, returning it to the driver pool.

The adapter does not accept SQL values through string interpolation. Future
services must use `SqlServerAdapter.execute` with parameters.

## Deadlock retry policy

Only errors containing SQL Server deadlock indicators (`1205`, SQLSTATE
`40001`, or `deadlock`) are retried. The whole transaction is retried, not an
individual statement. The default is at most three total attempts with linear
backoff. Permission, validation, timeout, connection, and other errors are not
silently retried.

Transaction work must be safe to retry. Non-idempotent operations need an
application idempotency strategy or an explicit decision not to retry them.
Assignment and status-transition services require separate concurrency tests
before enabling this behavior.

## Identity and permissions

The future application identity differs from the read-only inspection identity:

| Identity | Purpose | Intended permissions |
| --- | --- | --- |
| Inspection identity | Metadata and separately approved read-only assessment | `CONNECT`, `VIEW DEFINITION`, and later limited `SELECT`; no writes |
| FastAPI application identity | Normal request processing | Least-privilege DML on only required objects |

No identity is created or granted permissions by this change.

The future application identity will need, subject to DBA review:

- `CONNECT` to the `CityWatch` database.
- `SELECT` on tables required for authentication, departments, complaints,
  staff, history, attachments, feedback, locations, and audit reads.
- `INSERT` on rows created by approved workflows, including citizens,
  accounts, sessions, OTP records, complaints, attachments, history,
  feedback, and audit entries.
- `UPDATE` on rows changed by approved workflows, including sessions,
  accounts, complaints, staff workload fields, OTP state, and audit-related
  workflow objects where applicable.
- `DELETE` only where an approved application workflow requires it; no broad
  delete grant should be assumed.

It should not receive `db_owner`, `db_datawriter`, `db_ddladmin`, `CONTROL`,
`ALTER`, `TAKE OWNERSHIP`, `IMPERSONATE`, or server administrative roles.
`EXECUTE` is not required for the current handwritten-query design. Exact
object-level grants must be finalized from the implemented FastAPI queries and
reviewed by the database administrator.

## Known compatibility issues

- Application code and the frontend accept `Critical` complaint priority, but
  the live database check constraint rejects it. This is unresolved and is not
  changed here.
- The live `Audit_Log` columns differ from the base schema documentation. The
  adapter must follow verified live metadata only after the relevant query
  contract is designed.
- No dedicated migration/version ledger was identified. Schema-version
  handling remains a separate design decision.

## Approval gates

Before the first real connection:

1. Approve the exact development/test database target.
2. Approve the application identity and its object-level permissions.
3. Verify the identity is not an inspection account with broad privileges.
4. Approve the ODBC driver and authentication mode.
5. Approve the first connection probe and its timeout behavior.
6. Add database integration tests that use only an approved test target.

Until those gates are complete, leave both database flags false. The existing
developer identity and the read-only inspection identity must not be used as a
fallback application identity.

No FastAPI route uses this adapter yet, and no frontend traffic is directed to
FastAPI.
