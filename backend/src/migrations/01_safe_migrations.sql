/*
  CityWatch Safe Database Migration Script
  - Creates Complaint_Attachment table if not exists (for uploaded evidence)
  - Creates Auth_OTP table if not exists (for secure 5-minute hashed OTP verification)
  - Non-destructive: preserves all existing data and constraints
*/

-- 1. Complaint_Attachment Table
IF OBJECT_ID('dbo.Complaint_Attachment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Complaint_Attachment (
        attachment_id  INT IDENTITY(1,1) PRIMARY KEY,
        complaint_id   INT NOT NULL,
        file_name      VARCHAR(255) NOT NULL,
        stored_name    VARCHAR(255) NOT NULL,
        file_path      VARCHAR(500) NOT NULL,
        file_size      INT NOT NULL,
        mime_type      VARCHAR(100) NOT NULL,
        uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_Complaint_Attachment FOREIGN KEY (complaint_id)
            REFERENCES dbo.Complaint(complaint_id) ON DELETE CASCADE
    );
    PRINT 'Complaint_Attachment table created successfully.';
END
ELSE
BEGIN
    PRINT 'Complaint_Attachment table already exists.';
END;

-- 2. Auth_OTP Table
IF OBJECT_ID('dbo.Auth_OTP', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auth_OTP (
        otp_id       INT IDENTITY(1,1) PRIMARY KEY,
        email        VARCHAR(100) NOT NULL,
        otp_hash     VARBINARY(64) NOT NULL,
        attempts     INT NOT NULL DEFAULT 0,
        expires_at   DATETIME NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        consumed_at  DATETIME NULL
    );
    CREATE INDEX IX_Auth_OTP_lookup ON dbo.Auth_OTP(email, expires_at, consumed_at);
    PRINT 'Auth_OTP table created successfully.';
END
ELSE
BEGIN
    PRINT 'Auth_OTP table already exists.';
END;
