# FastAPI SQL Connection Probe Plan

This plan is preparation only. It has not been executed and must not be run
until the administrator checklist in
[`fastapi-sql-integration-status.md`](fastapi-sql-integration-status.md) is
complete and the exact probe is approved.

## Required authorization

Before the probe, the administrator must confirm:

1. The isolated SQL Server instance and `CityWatch` database name.
2. The backup and rollback plan for that target.
3. The dedicated least-privilege application identity and its effective grants.
4. The Windows/process identity under which FastAPI will run, or the approved
   secret-managed SQL authentication identity.
5. The approved ODBC driver, encryption, certificate, and timeout settings.
6. That this exact read-only probe is approved.

The existing developer identity and read-only inspection identity must not be
used as the application identity.

## Probe sequence

The future probe must be a separate command or test process with both safety
flags still false until the approval record is complete. It must:

1. Resolve and record the non-secret configured server/database target.
2. Resolve and record the actual process identity without recording secrets.
3. Verify that the process identity matches the approved FastAPI identity.
4. Open one bounded-time connection using the approved configuration.
5. Execute only the approved read-only identity/target check, such as the
   server/database context query authorized by the DBA.
6. Close the connection in `finally` and report only success/failure, target
   name, process identity, and sanitized error category.

The probe must not enumerate application data, inspect personal records, write
rows, run migrations, create sessions, alter permissions, or seed fixtures.
It must not print connection strings, usernames when classified as secret,
passwords, tokens, hashes, or query results containing personal information.

## Exit conditions

Abort before opening a connection if the target, process identity, approved
permissions, or probe authorization does not match the approval record. A
successful probe verifies connectivity and target identity only; it does not
prove that all feature permissions or schema contracts are correct.