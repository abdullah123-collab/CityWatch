# 🏙️ CityWatch — Citizen Complaint Management System

> A web-based civic complaint management system designed to help citizens report urban issues and track the status of their complaints.

CityWatch is a university **Database Management System (DBMS)** project that demonstrates how a civic complaint workflow can be designed using a simple web interface, structured complaint data, validation, and an SQL database schema.

---

## 🎯 Project Overview

Citizens need a simple way to report common civic issues such as:

- 🛣️ Road and infrastructure problems
- 💡 Street light issues
- 🗑️ Waste and sanitation problems
- 💧 Water-related issues
- 🚦 Traffic and public-area problems

CityWatch provides a simple interface where users can submit complaints, view their complaint history, and monitor complaint status.

The current frontend uses **localStorage** for demonstration purposes, while an SQL database schema is also included for future backend integration.

---

## ✨ Features

- 📝 **Complaint Reporting** — Submit new civic complaints with category and description
- 📋 **Complaint History** — View previously submitted complaints
- 📊 **Dashboard** — View complaint statistics and recent complaints
- 🔐 **Login Interface** — Basic login workflow
- ✅ **Form Validation** — Client-side validation for complaint forms
- 💾 **Local Storage** — Store demonstration data using browser `localStorage`
- 🗄️ **SQL Schema** — Database schema included for future backend integration

---

## 🔄 Complaint Workflow

```text
Citizen
   │
   ▼
Login
   │
   ▼
Dashboard
   │
   ▼
Submit Complaint
   │
   ▼
Form Validation
   │
   ▼
Store Complaint
   │
   ▼
Complaint History
   │
   ▼
Track Status
````

---

## 📁 Project Structure

```text
CityWatch/
├── frontend/        # Citizen React Application (Vite, Port 5173)
├── backend/         # Express REST API & SQL Server Layer (Node.js, Port 3000)
├── staff/           # Field Staff Officer React Application (Vite, Port 5174)
├── admin/           # Municipal Administrator React Application (Vite, Port 5175)
├── Database/        # Existing Advanced DBMS SQL scripts (Preserved)
└── package.json     # Workspace management and orchestrator scripts
```

### Directory Responsibilities

1. **`frontend/` (Citizen Portal - Port 5173)**
   - Modern civic landing page with municipal impact statistics and category highlights.
   - Citizen registration with password hashing, phone validation, and SQL Server persistence.
   - Manual Email & Password login with secure session cookie handling.
   - Two-Factor Google OAuth login: Identity token verification followed by a 5-minute cryptographically secure Email OTP.
   - Resident Dashboard with live complaint statistics queried from SQL Server.
   - New Complaint submission form with:
     - Department and category selection.
     - Interactive Leaflet OpenStreetMap with draggable pin, GPS geolocation, and reverse geocoding.
     - Multipart evidence upload (JPG, PNG, WEBP, PDF up to 5MB) with image preview.
   - Searchable, filterable complaint history with status badges and timeline tracking.
   - Complaint details view with interactive location map, secure evidence gallery, status timeline, and 5-star citizen satisfaction rating review.
   - Citizen profile and secure logout.

2. **`backend/` (Express REST API - Port 3000)**
   - Exclusive gateway to Microsoft SQL Server using Windows Integrated Authentication (`msnodesqlv8`).
   - Secure REST endpoints (`/api/auth`, `/api/complaints`, `/api/staff`, `/api/admin`, `/api/departments`, `/api/diagnostics`).
   - Argon2id / bcrypt password hashing (cost factor 12).
   - Session storage in `dbo.Auth_Session` with SHA-256 token hashing and httpOnly Lax cookies.
   - Cryptographic 6-digit OTP generator with SHA-256 hash storage in `dbo.Auth_OTP`, 5-minute expiration, and SMTP email dispatch.
   - Multipart file upload handling with disk storage in `backend/uploads/`, UUID sanitization, MIME-type verification, and access-controlled streaming endpoints.
   - Transaction-safe complaint assignment, status transitions, and `dbo.Staff.active_cases` workload constraint tracking.
   - Structured audit logging to `dbo.Audit_Log`.
   - Comprehensive automated integration test suite (`npm test`).

3. **`staff/` (Field Staff Portal - Port 5174)**
   - Officer authentication with individual staff credentials and role verification.
   - Staff Dashboard displaying officer's active case workload bar against the database constraint (`BETWEEN 0 AND 5`).
   - Assigned complaints table with status filtering and citizen contact details.
   - Case Review page with citizen details, incident coordinates on Leaflet map, and evidence preview.
   - Status Update action modal: transitions case to `In Progress`, `Resolved`, or `Rejected` with mandatory inspector remarks and history recording.

4. **`admin/` (Administrator Command Center - Port 5175)**
   - Secure administrator login with administrative role gating.
   - Live system-wide metrics queried directly from SQL Server: Total complaints, Pending, In Progress, Resolved, Rejected, Citizens, Staff, Average satisfaction rating.
   - Department grievance distribution and resolution rate analytics.
   - Staff capacity utilization monitor.
   - City-wide complaints registry with department and status filters, and one-click "Assign Staff" modal that checks department compatibility and officer capacity (`active_cases < 5`).
   - Staff directory with active/deactivated toggling and "Add New Staff Member" provisioning modal.
   - Registered citizens registry.
   - Department management.
   - Citizen review reports.
   - Live SQL Server `dbo.Audit_Log` audit trail viewer.

---

## 2. Getting Started & Running the Platform

### Prerequisites
- Node.js (v18+)
- Microsoft SQL Server with Windows Authentication enabled
- ODBC Driver 18 for SQL Server (or ODBC Driver 17)
- Database named `CityWatch` with base schema loaded

### Running the Applications

#### Option A: Run All Concurrently (Recommended)
You can open 4 separate terminal windows or run each service from the project root:

```bash
# Terminal 1: Start Backend API (Port 3000)
npm run dev:backend

# Terminal 2: Start Citizen Portal (Port 5173)
npm run dev:frontend

# Terminal 3: Start Field Staff Portal (Port 5174)
npm run dev:staff

# Terminal 4: Start Administrator Portal (Port 5175)
npm run dev:admin
```

#### Option B: Run Independent Directories
Each folder has its own self-contained package configuration:

```bash
# Backend
cd backend
node server.js

# Citizen Frontend
cd frontend
npm run dev

# Staff Frontend
cd staff
npm run dev

# Admin Frontend
cd admin
npm run dev
```

---

## 3. Database Migrations & Pre-Seeded Accounts

### Safe Migrations
The database migration script `backend/src/migrations/migrate.js` is idempotent and non-destructive:
- Verifies or creates `dbo.Complaint_Attachment` for file uploads.
- Verifies or creates `dbo.Auth_OTP` for two-factor Google email verification.
- Provisions initial accounts with individual secure passwords.

Run the migration and seeding at any time:
```bash
npm run migrate
```

### Pre-Configured Test Credentials

| Role | Email | Password | Access Portal |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@citywatch.gov` | `AdminPass123!` | [http://localhost:5175](http://localhost:5175) |
| **Sanitation Staff** | `ahmed.staff@example.com` | `StaffPass123!` | [http://localhost:5174](http://localhost:5174) |
| **Roads Staff** | `usman.staff@example.com` | `StaffPass123!` | [http://localhost:5174](http://localhost:5174) |
| **Water Staff** | `hassan.staff@example.com` | `StaffPass123!` | [http://localhost:5174](http://localhost:5174) |
| **Electricity Staff** | `bilal.staff@example.com` | `StaffPass123!` | [http://localhost:5174](http://localhost:5174) |
| **Demo Citizen** | `ali.ahmed@example.com` | `Citizen123!` | [http://localhost:5173](http://localhost:5173) |
| **New Citizen** | Register directly via registration form | [http://localhost:5173](http://localhost:5173) |

---

## 4. Configuration & Environment Variables

Copy `.env.example` to `.env` in the project root and in `backend/.env`.

```env
# Database Connection (Windows Integrated Authentication)
DB_SERVER=DESKTOP-QDJFKS0\SQLEXPRESS
DB_DATABASE=CityWatch
DB_PORT=
DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUST_SERVER_CERTIFICATE=true

# Server
PORT=3000
NODE_ENV=development

# Google OAuth 2.0 (Optional - for Google Identity verification)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# SMTP Email Configuration (Optional - for Email OTP dispatch)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=CityWatch Civic Support <noreply@citywatch.gov>
```

> **Note on Google OAuth and Email OTP:**
> If `GOOGLE_CLIENT_ID` or SMTP credentials are omitted, manual email/password registration and login remain 100% functional. When Google sign-in is invoked without credentials, the system informs the user that configuration parameters must be supplied in `.env`.

---

## 5. Automated Integration Test Suite

CityWatch includes a comprehensive test suite in `backend/src/tests/run_tests.js` verifying database connectivity, registration, password hashing, manual login, staff/admin authentication, authorization barriers, complaint creation with coordinates, assignment, and status updates:

```bash
npm test
```

### Verified Test Results
- ✓ `Diagnostic endpoint verifies SQL Server connection`
- ✓ `Registration rejects weak passwords and invalid email formats`
- ✓ `Citizen registration succeeds and persists in SQL Server`
- ✓ `Citizen manual login succeeds with registered credentials`
- ✓ `Citizen manual login rejects incorrect password`
- ✓ `Staff authentication succeeds for municipal staff account`
- ✓ `Admin authentication succeeds for administrator account`
- ✓ `Citizen is blocked with 403 when requesting Admin dashboard`
- ✓ `Staff is blocked with 403 when requesting Admin dashboard`
- ✓ `Admin successfully retrieves system-wide metrics from SQL Server`
- ✓ `Citizen creates complaint with location coordinates`
- ✓ `Citizen retrieves complaint details with timeline history`
- ✓ `Admin assigns complaint to authorized staff member`
- ✓ `Assigned staff updates complaint status to In Progress with remarks`
- ✓ `Citizen submits rating and feedback on complaint`

**Total: 15 Passed, 0 Failed.**
