create database CityWatch; 

CREATE TABLE Citizen (
    citizen_id     INT  PRIMARY KEY IDENTITY(1,1),
    full_name      VARCHAR(100),
    email          VARCHAR(100) UNIQUE,
    phone          VARCHAR(12),
    address        VARCHAR(255),
    registered_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE Location (
    location_id  INT  PRIMARY KEY IDENTITY(1,1),
    area_name    VARCHAR(100),
    city         VARCHAR(80),
    district     VARCHAR(80),
    pincode      VARCHAR(10),
    latitude     DECIMAL(9,6),
    longitude    DECIMAL(9,6)
);


CREATE TABLE Department (
    dept_id        INT  PRIMARY KEY IDENTITY(1,1),
    dept_name      VARCHAR(100),
    category       VARCHAR(80),
    contact_email  VARCHAR(100),
    contact_phone  VARCHAR(20),
    head_officer   VARCHAR(100)
);

CREATE TABLE Staff (
    staff_id     INT  PRIMARY KEY IDENTITY(1,1),
    dept_id      INT,
    full_name    VARCHAR(100),
    designation  VARCHAR(80),
    email        VARCHAR(100) UNIQUE,
    phone        VARCHAR(20),
    joined_at    DATE   ,
    
    FOREIGN KEY (dept_id) REFERENCES Department(dept_id) ON DELETE CASCADE
);


CREATE TABLE Complaint (
    complaint_id  INT  PRIMARY KEY IDENTITY(1,1),
    citizen_id    INT,
    dept_id       INT,
    location_id   INT,
    staff_id      INT,
    title         VARCHAR(200),
    description   TEXT,
    category      VARCHAR(80),
    priority      VARCHAR(10) DEFAULT 'Medium',
    status        VARCHAR(20) DEFAULT 'Pending',
    submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at   DATETIME,
    
    FOREIGN KEY (citizen_id)   REFERENCES Citizen(citizen_id),
    FOREIGN KEY (dept_id)      REFERENCES Department(dept_id),
    FOREIGN KEY (location_id)  REFERENCES Location(location_id),
    FOREIGN KEY (staff_id)     REFERENCES Staff(staff_id)
);


CREATE TABLE Complaint_History (
    history_id    INT  PRIMARY KEY IDENTITY(1,1),
    complaint_id  INT,
    staff_id      INT,
    old_status    VARCHAR(50),
    new_status    VARCHAR(50),
    remarks       TEXT,
    changed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (complaint_id) REFERENCES Complaint(complaint_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES Staff(staff_id) ON DELETE SET NULL
);
 
