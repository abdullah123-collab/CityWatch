# CityWatch Python-Only Migration Plan & Feature-Parity Checklist

**Last Updated:** 2026-10-16  
**Status:** Completed — 100% Pure Python/FastAPI + Jinja2 Application  

---

## 1. Objectives & Architectural Principles

- **Single Runtime:** Entire system (Citizen, Staff, and Admin portals + REST endpoints) runs purely on Python using **FastAPI** and **Jinja2** templates.
- **Zero Node.js Runtime in Final Delivery:** No Vite, React, JSX/TSX, Express, or Node runtime required to start or run the system. All `node_modules`, `dist/`, Vite configs, and package manifests have been completely removed.
- **Database Safety & Integrity:** The existing Microsoft SQL Server database schema, tables, ACID transactions, and existing records are preserved. SQL identity gates are respected: connection is disabled pending approved credentials (`db_enabled=False`), with safe offline development and mock-driver testing.
- **Design & Workflow Parity:** Preserves the visual design (CSS design tokens, typography, layout), form validation, complaint lifecycle, role-based access control, file attachment handling, and authorized staff contact privacy.
- **Recoverable Backup:** Before deleting the original React/Express components, an isolated backup archive was created at `C:\Users\ZC\.gemini\antigravity\brain\75f3b21d-f7cf-4c0b-abb0-929f8ca7ba5d\legacy_react_express_backup\`.

---

## 2. Page-by-Page Feature Parity & Migration Checklist

### 2.1 Citizen Portal (`/`)

| Route | Original React/Vite Page | Jinja2 Template | Status | Verified Functionality |
|---|---|---|---|---|
| `GET /` | `frontend/src/pages/LandingPage.jsx` | `templates/citizen/landing.html` | ✅ Done | Hero section, 3 pillars of transparent governance, department showcase with category badges, CTA buttons. |
| `GET /login`<br>`POST /login` | `frontend/src/pages/LoginPage.jsx` | `templates/citizen/login.html` | ✅ Done | Email/password login, bcrypt hash verification (cost 10-12), signed session cookies, Google/OTP permanently removed, honest DB offline reporting. |
| `GET /register`<br>`POST /register` | `frontend/src/pages/RegisterPage.jsx` | `templates/citizen/register.html` | ✅ Done | Full name, email, phone, registered address, password validation (min 8 chars, matching confirm), duplicate email handling, creates `Citizen` + `Auth_Account` records. |
| `GET /dashboard` | `frontend/src/pages/DashboardPage.jsx` | `templates/citizen/dashboard.html` | ✅ Done | Role-restricted (Citizen), metric cards (Total, Pending, In Progress, Resolved), recent 5 submissions table with status/priority badges, empty state. |
| `GET /complaints` | `frontend/src/pages/ComplaintHistoryPage.jsx` | `templates/citizen/complaint_history.html` | ✅ Done | Citizen ownership check, keyword search across title/description, status filter, priority filter, sort order (newest/oldest), complaint cards with location, date, department. |
| `GET /complaints/new`<br>`POST /complaints/new` | `frontend/src/pages/NewComplaintPage.jsx` | `templates/citizen/new_complaint.html` | ✅ Done | Department dropdown, manual address fields (Area/Locality, City, District, Postal Code), priority selector, description, file attachment dropzone (max 5 files, 5MB each, JPEG/PNG/WEBP/PDF), ACID transaction. |
| `GET /complaints/{id}` | `frontend/src/pages/ComplaintDetailsPage.jsx` | `templates/citizen/complaint_detail.html` | ✅ Done | Ownership check (403 if not owner), incident details, manual address card, attachment download links, status transition history timeline, feedback submission form (stars + comments). |
| `POST /complaints/{id}/feedback` | `ComplaintDetailsPage.jsx` (feedback) | Server-rendered POST handler | ✅ Done | Citizen ownership check, rating (1-5), comments, writes to `dbo.Feedback`. |
| `GET /complaints/{id}/attachments/{att_id}` | Attachment preview/download | Server-rendered streaming/download | ✅ Done | File validation, path verification, secure file response. |
| `GET /profile`<br>`POST /logout` | `frontend/src/pages/ProfilePage.jsx` | `templates/citizen/profile.html` | ✅ Done | Citizen account details (full name, email, phone, registered address), verified badge, session termination. |

---

### 2.2 Staff Portal (`/staff/`)

| Route | Original React/Vite Page | Jinja2 Template | Status | Verified Functionality |
|---|---|---|---|---|
| `GET /staff/login`<br>`POST /staff/login` | `staff/src/pages/StaffLoginPage.jsx` | `templates/staff/login.html` | ✅ Done | Official municipal staff login, role check (`Staff` or `Admin`), bcrypt password verification, signed session cookie. |
| `GET /staff/dashboard` | `staff/src/pages/StaffDashboardPage.jsx` | `templates/staff/dashboard.html` | ✅ Done | Assigned cases only, active workload capacity progress bar (e.g., 2/5 active cases), metric counters, quick search and status filter. |
| `GET /staff/complaints` | `staff/src/pages/StaffDashboardPage.jsx` | `templates/staff/complaint_list.html` | ✅ Done | Full list of assigned cases with priority/status badges, incident locations, reporting citizen info. |
| `GET /staff/complaints/{id}` | `staff/src/pages/StaffComplaintDetailPage.jsx` | `templates/staff/complaint_detail.html` | ✅ Done | Authorized staff check (staff must be assigned to complaint or admin), **Authorized Citizen Phone display** (privacy rule: only revealed to assigned officer), case history, attachment downloads. |
| `POST /staff/complaints/{id}/status` | `staff/src/components/StatusUpdateModal.jsx` | Server-rendered POST handler | ✅ Done | Status transitions (`In Progress`, `Resolved`, `Rejected`), mandatory inspector remarks, appends to `dbo.Complaint_History`, updates workload. |
| `GET /staff/profile`<br>`POST /staff/logout` | `staff/src/pages/StaffProfilePage.jsx` | `templates/staff/profile.html` | ✅ Done | Staff member designation, department, active cases, sign out. |

---

### 2.3 Admin Portal (`/admin/`)

| Route | Original React/Vite Page | Jinja2 Template | Status | Verified Functionality |
|---|---|---|---|---|
| `GET /admin/login`<br>`POST /admin/login` | `admin/src/pages/AdminLoginPage.jsx` | `templates/admin/login.html` | ✅ Done | Command Center authentication, strictly requires `Admin` role, session security. |
| `GET /admin/dashboard` | `admin/src/pages/AdminDashboardPage.jsx` | `templates/admin/dashboard.html` | ✅ Done | System-wide analytics: total complaints, pending triage, under investigation, resolved, total citizens, total staff, avg rating; department breakdown, staff workload overview. |
| `GET /admin/complaints` | `admin/src/pages/AdminComplaintsPage.jsx` | `templates/admin/complaints.html` | ✅ Done | City-wide complaint registry, filters by department, status, priority, and search keyword; assign staff action. |
| `GET /admin/complaints/{id}` | Case file detail | `templates/admin/complaint_detail.html` | ✅ Done | Complete audit case file, all attachments, citizen contact, full lifecycle history, inspector assignment modal/form. |
| `POST /admin/complaints/{id}/assign` | `admin/src/components/AssignModal.jsx` | Server-rendered POST handler | ✅ Done | Reassign complaint to department staff, updates `Staff.active_cases`, adds history record with admin actor name. |
| `GET /admin/staff`<br>`POST /admin/staff` | `admin/src/pages/AdminStaffPage.jsx` | `templates/admin/staff.html` | ✅ Done | Staff directory with active cases, department, status toggle (`POST /admin/staff/{id}/status`), Add Staff form (bcrypt hash, Auth_Account creation). |
| `GET /admin/citizens` | `admin/src/pages/AdminCitizensPage.jsx` | `templates/admin/citizens.html` | ✅ Done | Registered citizens directory with email, phone, registered address. |
| `GET /admin/departments`<br>`POST /admin/departments` | `admin/src/pages/AdminDepartmentsPage.jsx` | `templates/admin/departments.html` | ✅ Done | Department registry, complaint volume, active staff count, Add Department form. |
| `GET /admin/feedback` | `admin/src/pages/AdminFeedbackPage.jsx` | `templates/admin/feedback.html` | ✅ Done | Citizen satisfaction feedback, star ratings, comments, linked complaint ID and citizen name. |
| `GET /admin/audit-logs` | `admin/src/pages/AdminAuditLogsPage.jsx` | `templates/admin/audit_logs.html` | ✅ Done | Immutable audit trail, operation types, target tables, record IDs, error/status messages, timestamps. |

---

### 2.4 Shared & Error Pages

| Route | Purpose | Template | Status |
|---|---|---|---|
| `404 / 500` | Exception handlers | `templates/shared/error.html` | ✅ Done |
| `/health`, `/api/health` | System health and honest DB readiness probe | Direct JSON response | ✅ Done |
| `/api/departments` | Department listing JSON convenience endpoint | Direct JSON response | ✅ Done |

---

## 3. Migration Roadmap & Execution Status

- [x] **Phase 0:** Codebase audit & architecture confirmation.
- [x] **Phase 1:** Core FastAPI configuration, security helpers (bcrypt cost 12, signed cookies, role dependencies), and pyodbc database adapter.
- [x] **Phase 2:** CSS static asset migration (`citizen.css`, `staff.css`, `admin.css`) preserving exact municipal design tokens and responsive layouts.
- [x] **Phase 3:** Complete Jinja2 templates (19 templates across Citizen, Staff, Admin, and Shared portals) with semantic HTML and vanilla JavaScript.
- [x] **Phase 4:** Comprehensive Python regression test suite (46 passed tests across 6 test suites) covering all routers, authentication, session security, permissions, privacy (citizen phone isolation), complaint lifecycle, and template rendering.
- [x] **Phase 5:** Recoverable backup of React (`frontend/`, `staff/`, `admin/`, `dist/`) and Express (`backend/`, `backend-fastapi/`) assets stored outside active application tree.
- [x] **Phase 6:** Complete removal of React/Vite/Express codebases, build manifests (`package*.json`), root config files (`server.js`, `vite.config.js`), and legacy directories; created root `run.py` launcher and cleaned `.gitignore`.
- [x] **Phase 7:** End-to-end verification of pure Python-only application with zero Node.js/npm dependencies.
