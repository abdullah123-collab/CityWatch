# CityWatch Presentation Guide — Pure Python / FastAPI Architecture

## 1. System Overview

CityWatch is a municipal civic grievance management system engineered entirely in **Python**, utilizing **FastAPI** for high-performance backend routing and **Jinja2** for server-rendered HTML presentation with vanilla CSS and JavaScript.

The previous Node.js, Express, React, and Vite toolchains have been completely eliminated from the runtime. A single Python process serves all three municipal portals, static assets, and upload storage.

### Key Architectural Highlights
- **Pure Python Application:** Runs with standard Python (`python run.py`) and standard libraries/frameworks (`FastAPI`, `Jinja2`, `Uvicorn`).
- **Unified Portal Serving:**
  - Citizen Portal: `http://127.0.0.1:8000/`
  - Field Staff Portal: `http://127.0.0.1:8000/staff/`
  - Administrator Command Center: `http://127.0.0.1:8000/admin/`
  - Health & Diagnostics: `http://127.0.0.1:8000/health` and `http://127.0.0.1:8000/api/health`
- **Zero Node.js Dependency:** No Node.js, npm, Vite, or Express required for startup, presentation, or testing.
- **Visual Design Parity:** Exact municipal CSS design tokens, typography, responsive card layouts, and status badge color coding preserved.
- **Offline Safety Gate:** Database connection is safely gated by `db_enabled=False` by default; endpoints report honest status without throwing unhandled exceptions or presenting false success.

---

## 2. High-Level Architecture Diagram

```text
Browser Client (Desktop / Mobile)
        │
        │ HTTP Requests (Cookies / Forms / Multipart Uploads)
        ▼
┌────────────────────────────────────────────────────────┐
│                   Uvicorn / FastAPI                    │
│                 (http://127.0.0.1:8000)                │
├───────────────────┬───────────────────┬────────────────┤
│   Citizen Router  │   Staff Router    │  Admin Router  │
│        (/)        │     (/staff/)     │   (/admin/)    │
├───────────────────┴───────────────────┴────────────────┤
│            Security & Session Middleware               │
│      - Signed HttpOnly Lax session cookies             │
│      - Role-Based Access Control (RBAC)                │
│      - Citizen phone isolation (Assigned staff/Admin)  │
├────────────────────────────────────────────────────────┤
│                 Jinja2 Template Engine                 │
│      - 19 server-rendered templates (HTML/CSS/vanilla) │
│      - Static file mounting (/static/css, images)      │
│      - Upload directory mounting (/uploads)            │
├────────────────────────────────────────────────────────┤
│              Data Repositories & Services              │
│      - auth_repository, complaint_repository, etc.     │
├────────────────────────────────────────────────────────┤
│                Database Adapter Layer                  │
│      - pyodbc adapter (ODBC Driver 17/18 for MSSQL)    │
│      - Offline Mock Driver for isolated test suites    │
│      - Safety Gate: db_enabled=False by default        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Civic Complaint Lifecycle

1. **Submission:** A verified citizen submits a complaint with category, priority, description, structured manual address (Area, City, District, Postal Code), and optional evidence attachments (JPG, PNG, WEBP, PDF up to 5MB).
2. **Initial State (`Pending`):** Complaint is logged with an initial status of `Pending`.
3. **Department & Officer Assignment:** An administrator assigns the complaint to an officer within the appropriate municipal department whose active workload constraint is satisfied (`active_cases < 5`).
4. **Investigation (`In Progress`):** Assigned staff review the complaint details. Assigned officers can view the citizen's contact phone number (blocked for unauthorized officers). The officer updates the status to `In Progress` with inspector remarks.
5. **Resolution Submission & Approval:** The officer submits a resolution note. The complaint is reviewed and marked `Resolved` upon approval, or `Rejected` if the investigation proves invalid.
6. **Citizen Feedback:** Once resolved, the citizen can rate the service (1–5 stars) and submit satisfaction remarks, persisted in `dbo.Feedback`.

---

## 4. Running the Platform Locally

### Quick Start (Single Command)

```powershell
# 1. Activate Python virtual environment
.\.venv\Scripts\Activate.ps1

# 2. Run the application
python run.py
```

Console output confirms startup:
```text
======================================================================
  CityWatch — Municipal Civic Grievance Management System
  Starting on http://127.0.0.1:8000
  Citizen Portal:  http://127.0.0.1:8000/
  Staff Portal:    http://127.0.0.1:8000/staff/
  Admin Portal:    http://127.0.0.1:8000/admin/
======================================================================
```

### Running the Automated Test Suite

```powershell
pytest
```
Expected result: **46 passed** tests verifying routes, session cookies, input validation, role permissions, phone isolation, and mock driver workflows.

---

## 5. Live Presentation Demo Sequence

1. **Opening / Landing Page:**
   - Navigate to `http://127.0.0.1:8000/`.
   - Point out the civic landing page: municipal mission, transparency pillars, department categories, and call-to-action buttons.
   - Explain that all HTML is server-rendered via FastAPI and Jinja2 without any JavaScript framework dependencies.

2. **Citizen Registration & Login Flow:**
   - Click **Sign In** (`/login`) or **Register** (`/register`).
   - Demonstrate the clean form with client-side and server-side validation.
   - Highlight security: bcrypt password hashing (cost factor 12) and signed `HttpOnly` session cookies. Explain that brittle third-party OAuth and email OTP dependencies were removed for reliability.

3. **Complaint Submission & Address Handling:**
   - Navigate to `/complaints/new`.
   - Show the structured address fields: Area/Locality, City, District, and Postal Code.
   - Highlight the multipart evidence upload dropzone supporting images and PDF documents.

4. **Staff Portal & Citizen Privacy Protection:**
   - Navigate to `http://127.0.0.1:8000/staff/login`.
   - Explain role-based authentication: only accounts with `Staff` or `Admin` roles can enter.
   - Demonstrate the Staff Dashboard with the workload capacity gauge (`active_cases` / 5 max).
   - **Crucial Privacy Rule:** Show the complaint detail page. Highlight that the citizen's phone number is **strictly isolated**: visible *only* to the authorized staff officer assigned to that case or an administrator, protecting citizen privacy.

5. **Administrator Command Center:**
   - Navigate to `http://127.0.0.1:8000/admin/login`.
   - Display the system overview dashboard: system-wide complaint counters, department grievance volume, and staff capacity monitoring.
   - Review Complaints (`/admin/complaints`), Staff Directory (`/admin/staff`), Citizens Registry (`/admin/citizens`), Department Management (`/admin/departments`), Citizen Feedback (`/admin/feedback`), and Audit Trail (`/admin/audit-logs`).

6. **Safety Gate & Database Transparency:**
   - Show `http://127.0.0.1:8000/health`.
   - Highlight the honest JSON response:
     ```json
     {
       "status": "ok",
       "service": "CityWatch Python Web Application",
       "database": "disabled_pending_approval",
       "environment": "development"
     }
     ```
   - Explain the engineering rationale: the system operates safely offline during presentation, protecting SQL Server records while running complete automated test suites with mock drivers.

---

## 6. Viva Questions & Model Answers

1. **Why did you migrate CityWatch from React/Vite/Express to FastAPI/Jinja2?**  
   *Answer:* A unified Python application drastically simplifies deployment and presentation by eliminating multiple concurrent Node.js dev servers, complex build steps, and cross-origin CORS overhead. Server-side rendering with Jinja2 provides faster initial page loads, semantic HTML, and unified server-side security.

2. **What role does FastAPI play in the application?**  
   *Answer:* FastAPI acts as the primary web application framework, providing asynchronous request handling, typed dependency injection, secure cookie handling, form parsing, file upload streaming, and REST API routing.

3. **How is session security handled without external auth providers?**  
   *Answer:* We use cryptographic signed session cookies using `itsdangerous.URLSafeTimedSerializer`. Passwords are verified against bcrypt hashes. The cookie is marked `HttpOnly` and `SameSite=Lax` to prevent XSS and CSRF token theft.

4. **How is citizen phone privacy protected?**  
   *Answer:* Phone privacy is enforced strictly on the server: `ComplaintRepository` and the router only populate `citizen_phone` when the authenticated user is an administrator or the specific staff officer assigned to that complaint. Unassigned staff and other citizens receive masked/null values.

5. **What happens during a complaint lifecycle?**  
   *Answer:* The lifecycle follows: `Pending` -> Assigned to Staff -> `In Progress` (with inspector remarks) -> `Resolved` (with resolution notes) -> Citizen 5-star Feedback.

6. **How does the system ensure database safety during development?**  
   *Answer:* Through the `db_enabled=False` safety gate. The application operates in safe offline mode, honestly displaying connectivity status rather than creating corrupt mock data. The regression test suite uses mock drivers to verify SQL query generation and transaction handling without opening live sockets.

7. **How are attachments handled?**  
   *Answer:* Uploads are validated for allowed MIME types (JPEG, PNG, WEBP, PDF) and size (<=5MB), assigned a UUID-prefixed safe filename, stored in `uploads/`, and tracked with records in `dbo.Complaint_Attachment`.

8. **How does the staff workload constraint work?**  
   *Answer:* The database and application enforce a capacity constraint where each staff officer can have at most 5 active complaints (`BETWEEN 0 AND 5`). If an officer is at capacity, the admin assignment workflow blocks additional assignments to prevent backlog fatigue.