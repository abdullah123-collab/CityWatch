/*
  REVIEW ONLY - DO NOT EXECUTE AUTOMATICALLY

  Purpose:
    Add password-hash and revocable-session storage for approved application
    authentication without changing or deleting any existing CityWatch rows.

  Preconditions:
    Review in SSMS and take an approved backup/change window before execution.
    The application must be updated to hash passwords and store only session
    token hashes before these tables are used.
*/

IF OBJECT_ID('dbo.Auth_Account', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auth_Account (
        account_id       INT IDENTITY(1,1) PRIMARY KEY,
        account_type     VARCHAR(20) NOT NULL,
        citizen_id       INT NULL,
        staff_id         INT NULL,
        password_hash    VARCHAR(255) NOT NULL,
        role_name        VARCHAR(20) NOT NULL,
        is_active        BIT NOT NULL CONSTRAINT DF_Auth_Account_is_active DEFAULT 1,
        created_at       DATETIME NOT NULL CONSTRAINT DF_Auth_Account_created_at DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME NOT NULL CONSTRAINT DF_Auth_Account_updated_at DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT CK_Auth_Account_type
            CHECK (account_type IN ('Citizen', 'Staff')),
        CONSTRAINT CK_Auth_Account_role
            CHECK (role_name IN ('Citizen', 'Staff', 'Admin')),
        CONSTRAINT CK_Auth_Account_owner
            CHECK (
                (account_type = 'Citizen' AND citizen_id IS NOT NULL AND staff_id IS NULL)
                OR
                (account_type = 'Staff' AND citizen_id IS NULL AND staff_id IS NOT NULL)
            ),
        CONSTRAINT FK_Auth_Account_citizen
            FOREIGN KEY (citizen_id) REFERENCES dbo.Citizen(citizen_id),
        CONSTRAINT FK_Auth_Account_staff
            FOREIGN KEY (staff_id) REFERENCES dbo.Staff(staff_id)
    );

    CREATE UNIQUE INDEX UX_Auth_Account_citizen
        ON dbo.Auth_Account(citizen_id)
        WHERE citizen_id IS NOT NULL;

    CREATE UNIQUE INDEX UX_Auth_Account_staff
        ON dbo.Auth_Account(staff_id)
        WHERE staff_id IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.Auth_Session', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auth_Session (
        session_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
        account_id       INT NOT NULL,
        token_hash       VARBINARY(64) NOT NULL,
        expires_at       DATETIME NOT NULL,
        revoked_at       DATETIME NULL,
        created_at       DATETIME NOT NULL CONSTRAINT DF_Auth_Session_created_at DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT FK_Auth_Session_account
            FOREIGN KEY (account_id) REFERENCES dbo.Auth_Account(account_id)
    );

    CREATE UNIQUE INDEX UX_Auth_Session_token_hash
        ON dbo.Auth_Session(token_hash);

    CREATE INDEX IX_Auth_Session_active
        ON dbo.Auth_Session(account_id, expires_at, revoked_at);
END;
GO
