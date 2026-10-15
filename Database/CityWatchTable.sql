CREATE TABLE Citizen (
    citizen_id     INT  PRIMARY KEY IDENTITY(1,1),
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    address        VARCHAR(255),
    registered_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE Location (
    location_id  INT  PRIMARY KEY IDENTITY(1,1),
    area_name    VARCHAR(100) NOT NULL,
    city         VARCHAR(80)  NOT NULL,
    district     VARCHAR(80)  NOT NULL,
    pincode      VARCHAR(10)  NOT NULL,
    latitude     DECIMAL(9,6),
    longitude    DECIMAL(9,6)
);


CREATE TABLE Department (
    dept_id        INT  PRIMARY KEY IDENTITY(1,1),
    dept_name      VARCHAR(100) NOT NULL,
    category       VARCHAR(80)  NOT NULL,
    contact_email  VARCHAR(100),
    contact_phone  VARCHAR(20),
    head_officer   VARCHAR(100)
);

CREATE TABLE Staff (
    staff_id     INT  PRIMARY KEY IDENTITY(1,1),
    dept_id      INT NOT NULL,
    full_name    VARCHAR(100) NOT NULL,
    designation  VARCHAR(80)  NOT NULL,
    email        VARCHAR(100) UNIQUE,
    phone        VARCHAR(20),
    joined_at    DATE NOT NULL,
    CONSTRAINT fk_staff_dept FOREIGN KEY (dept_id)
        REFERENCES Department(dept_id) ON DELETE CASCADE
);


CREATE TABLE Complaint (
    complaint_id  INT  PRIMARY KEY IDENTITY(1,1),
    citizen_id    INT NOT NULL,
    dept_id       INT NOT NULL,
    location_id   INT NOT NULL,
    staff_id      INT,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    category      VARCHAR(80)  NOT NULL,
    priority      VARCHAR(10) DEFAULT 'Medium',
    status        VARCHAR(20) DEFAULT 'Pending',
    submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at   DATETIME,
    CONSTRAINT fk_comp_citizen  FOREIGN KEY (citizen_id)   REFERENCES Citizen(citizen_id),
    CONSTRAINT fk_comp_dept     FOREIGN KEY (dept_id)      REFERENCES Department(dept_id),
    CONSTRAINT fk_comp_location FOREIGN KEY (location_id)  REFERENCES Location(location_id),
    CONSTRAINT fk_comp_staff    FOREIGN KEY (staff_id)     REFERENCES Staff(staff_id)
);


CREATE TABLE Complaint_History (
    history_id    INT  PRIMARY KEY IDENTITY(1,1),
    complaint_id  INT NOT NULL,
    staff_id      INT,
    old_status    VARCHAR(50) NOT NULL,
    new_status    VARCHAR(50) NOT NULL,
    remarks       TEXT,
    changed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hist_complaint FOREIGN KEY (complaint_id)
        REFERENCES Complaint(complaint_id) ON DELETE CASCADE,
    CONSTRAINT fk_hist_staff FOREIGN KEY (staff_id)
        REFERENCES Staff(staff_id) ON DELETE SET NULL
);
 

-- 1. Add active_cases to Staff if it does not exist
IF COL_LENGTH('dbo.Staff', 'active_cases') IS NULL
BEGIN
    ALTER TABLE dbo.Staff
    ADD active_cases INT NOT NULL
        CONSTRAINT DF_Staff_active_cases DEFAULT 0;

    ALTER TABLE dbo.Staff
    ADD CONSTRAINT CK_Staff_active_cases
        CHECK (active_cases BETWEEN 0 AND 5);
END;
GO

-- 2. Validate Complaint priority
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Complaint_Priority'
)
BEGIN
    ALTER TABLE dbo.Complaint
    ADD CONSTRAINT CK_Complaint_Priority
        CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'));
END;
GO

-- 3. Validate Complaint status
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_Complaint_Status'
)
BEGIN
    ALTER TABLE dbo.Complaint
    ADD CONSTRAINT CK_Complaint_Status
        CHECK (status IN ('Pending', 'In Progress', 'Resolved', 'Rejected'));
END;
GO

-- 4. Feedback table
IF OBJECT_ID('dbo.Feedback', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Feedback (
        feedback_id INT IDENTITY(1,1) PRIMARY KEY,
        complaint_id INT NOT NULL,
        citizen_id INT NOT NULL,
        rating INT NOT NULL,
        comments VARCHAR(MAX),
        submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT FK_Feedback_Complaint
            FOREIGN KEY (complaint_id)
            REFERENCES dbo.Complaint(complaint_id),

        CONSTRAINT FK_Feedback_Citizen
            FOREIGN KEY (citizen_id)
            REFERENCES dbo.Citizen(citizen_id),

        CONSTRAINT CK_Feedback_Rating
            CHECK (rating BETWEEN 1 AND 5)
    );
END;
GO

-- 5. Audit_Log table
IF OBJECT_ID('dbo.Audit_Log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Audit_Log (
        log_id INT IDENTITY(1,1) PRIMARY KEY,
        operation_type VARCHAR(50) NOT NULL,
        table_name VARCHAR(128),
        record_id INT,
        error_message VARCHAR(MAX),
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
END;
GO
